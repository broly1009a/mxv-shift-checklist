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
    
    const docs = await col.find({}).project({
        year: 1,
        month: 1,
        monthYear: 1,
        status: 1,
        totalTradingDays: 1,
        summary: 1
    }).toArray();
    
    console.log("=== CURRENT DATABASE SNAPSHOTS (monthly_report_snapshots) ===");
    for (const d of docs) {
        console.log(\`Tháng \${d.monthYear} (\${d.status}):\`);
        console.log(\`  Ngày giao dịch: \${d.totalTradingDays}\`);
        console.log(\`  Tổng Volume: \${(d.summary?.totalVolume || 0).toLocaleString()} lots\`);
        console.log(\`  CQG Volume: \${(d.summary?.cqgVolume || 0).toLocaleString()} lots\`);
        console.log(\`  ACM Volume: \${(d.summary?.acmVolume || 0).toLocaleString()} lots\`);
    }
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_db_snaps2.js\n${remoteNode}\nEOF\nnode /tmp/check_db_snaps2.js\nrm -f /tmp/check_db_snaps2.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

