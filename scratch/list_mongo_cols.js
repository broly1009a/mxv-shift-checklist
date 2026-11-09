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
    const cols = await db.listCollections().toArray();
    console.log("Collections:", cols.map(c => c.name));
    
    // Check if there is monthly_snapshots or similar
    for (const c of cols) {
        if (c.name.includes('month') || c.name.includes('snapshot') || c.name.includes('trading')) {
            const count = await db.collection(c.name).countDocuments();
            console.log(\`  Collection \${c.name}: \${count} docs\`);
        }
    }
    await client.close();
}
main().catch(console.error);
`;

  const cmd = `cat << 'EOF' > /tmp/list_cols.js\n${remoteNode}\nEOF\nnode /tmp/list_cols.js\nrm -f /tmp/list_cols.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });

