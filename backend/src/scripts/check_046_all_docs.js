const { Client } = require('ssh2');
const conn = new Client();
const remoteScript = `
const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const docs = await mongoose.connection.db.collection('clean_account_records').find({ maTKGD: '046C0002936' }).toArray();
  console.log('Docs found:', docs.length);
  docs.forEach(d => console.log('ID:', d._id, 'batchDate:', d.batchDate, 'ketLuan:', d.ketLuan?.trangThai));
  await mongoose.disconnect();
}
run();
`;

conn.on('ready', () => {
  const cmd = `cd /opt/mxv-checklist/backend && node -e "${remoteScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
