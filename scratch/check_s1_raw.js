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
    
    const doc = await col.findOne({ monthYear: '2026-10' });
    console.log("2026-10 section1Tvkd keys:", Object.keys(doc.section1Tvkd || {}));
    console.log("Sample section1Tvkd:", JSON.stringify(doc.section1Tvkd).substring(0, 500));
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/check_s1_raw.js\n${remoteNode}\nEOF\nnode /tmp/check_s1_raw.js\nrm -f /tmp/check_s1_raw.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

