const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const remote = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const items = await mongoose.connection.db.collection('system_settings').find({}).toArray();
  console.log('Keys in system_settings:', items.map(i => i.key));
  const ccp = items.find(i => i.key.includes('ccp'));
  console.log('CCP setting key:', ccp ? ccp.key : 'none');
  console.log('CCP setting value length:', ccp ? ccp.value?.length : 0);
  await mongoose.disconnect();
}
run().catch(console.error);
`;
  conn.sftp((err, sftp) => {
    const s = sftp.createWriteStream('/tmp/check_keys.js');
    s.write(remote);
    s.end(() => {
      conn.exec('node /tmp/check_keys.js', (err2, stream2) => {
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
