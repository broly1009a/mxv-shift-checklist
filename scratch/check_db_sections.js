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
    
    const docs = await col.find({}).toArray();
    for (const d of docs) {
        console.log(\`=== THÁNG \${d.monthYear} (\${d.status}) ===\`);
        const s1 = d.section1Tvkd || {};
        console.log(\`  CQG Members: \${(s1.cqgRanking || []).length}\`);
        console.log(\`  ACM Members: \${(s1.acmRanking || []).length}\`);
        
        let sumCqg = 0;
        (s1.cqgRanking || []).forEach(x => sumCqg += (x.lotMonthT || 0));
        let sumAcm = 0;
        (s1.acmRanking || []).forEach(x => sumAcm += (x.lotMonthT || 0));
        
        console.log(\`  Tổng CQG: \${sumCqg.toLocaleString()} lots\`);
        console.log(\`  Tổng ACM: \${sumAcm.toLocaleString()} lots\`);
        console.log(\`  Tổng: \${(sumCqg + sumAcm).toLocaleString()} lots\`);
        
        if ((s1.acmRanking || []).length > 0) {
            console.log("  Top 3 ACM:", s1.acmRanking.slice(0, 3).map(x => \`\${x.tvkdCode}: T-1=\${x.lotMonthT1}, T=\${x.lotMonthT}\`).join(' | '));
        }
    }
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_db_sections.js\n${remoteNode}\nEOF\nnode /tmp/check_db_sections.js\nrm -f /tmp/check_db_sections.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

