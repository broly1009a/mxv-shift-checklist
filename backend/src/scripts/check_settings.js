const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const nodeScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const settings = await db.collection('system_settings').find({}).toArray();
  console.log('=== SYSTEM SETTINGS ===');
  settings.forEach(s => console.log(s.key, '=', s.value));
  await mongoose.disconnect();
}
check().catch(console.error);
`;
  const b64 = Buffer.from(nodeScript).toString('base64');
  conn.exec(`echo "${b64}" | base64 -d | node`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
