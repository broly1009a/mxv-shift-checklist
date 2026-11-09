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
        console.log(\`=== THÁNG \${d.monthYear} ===\`);
        console.log("Keys:", Object.keys(d));
        console.log("kpiOverview:", d.kpiOverview);
        console.log("cqgMembers count:", (d.cqgMembers || []).length);
        console.log("acmMembers count:", (d.acmMembers || []).length);
        console.log("cqgMembers Top 3:", (d.cqgMembers || []).slice(0, 3).map(x => ({ code: x.memberCode, name: x.memberName, t1: x.lotMonthT1, t: x.lotMonthT })));
        console.log("acmMembers Top 3:", (d.acmMembers || []).slice(0, 3).map(x => ({ code: x.memberCode, name: x.memberName, t1: x.lotMonthT1, t: x.lotMonthT })));
    }
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_db_fields.js\n${remoteNode}\nEOF\nnode /tmp/check_db_fields.js\nrm -f /tmp/check_db_fields.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

