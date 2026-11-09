const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteNode = `
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017/mxv_shift_checklist');
    await client.connect();
    const db = client.db('mxv_shift_checklist');
    const col = db.collection('monthly_report_snapshots');
    
    const docs = await col.find({}).sort({ monthYear: 1 }).toArray();
    for (const d of docs) {
        console.log(\`========================================\`);
        console.log(\`THÁNG: \${d.monthYear} | Status: \${d.status}\`);
        const s1 = d.section1Tvkd || {};
        const cqgItems = s1.cqg?.items || [];
        const acmItems = s1.acm?.items || [];
        
        let sumCqgT1 = 0, sumCqgT = 0;
        cqgItems.forEach(x => { sumCqgT1 += (x.lotPreviousMonth || 0); sumCqgT += (x.lotCurrentMonth || 0); });
        
        let sumAcmT1 = 0, sumAcmT = 0;
        acmItems.forEach(x => { sumAcmT1 += (x.lotPreviousMonth || 0); sumAcmT += (x.lotCurrentMonth || 0); });
        
        console.log(\`  CQG: T-1=\${sumCqgT1.toLocaleString()} | T=\${sumCqgT.toLocaleString()} lots (\${cqgItems.length} TVKD)\`);
        console.log(\`  ACM: T-1=\${sumAcmT1.toLocaleString()} | T=\${sumAcmT.toLocaleString()} lots (\${acmItems.length} TVKD)\`);
        console.log(\`  TỔNG: T-1=\${(sumCqgT1 + sumAcmT1).toLocaleString()} | T=\${(sumCqgT + sumAcmT).toLocaleString()} lots\`);
        
        console.log(\`  Top 3 CQG: \`, cqgItems.slice(0, 3).map(x => \`\${x.tvkdCode} (\${(x.lotCurrentMonth || 0).toLocaleString()})\`).join(', '));
        console.log(\`  Top 3 ACM: \`, acmItems.slice(0, 3).map(x => \`\${x.tvkdCode} (\${(x.lotCurrentMonth || 0).toLocaleString()})\`).join(', '));
    }
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_all_snaps_summary.js\n${remoteNode}\nEOF\nnode /tmp/check_all_snaps_summary.js\nrm -f /tmp/check_all_snaps_summary.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

