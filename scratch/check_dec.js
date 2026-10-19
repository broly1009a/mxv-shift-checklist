const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const remote = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  console.log('rawCred length:', s.value.length);
  console.log('rawCred start:', s.value.substring(0, 40));
  try {
    const dec = decrypt(s.value);
    console.log('Decrypted text length:', dec.length);
    const parsed = JSON.parse(dec);
    console.log('Parsed username:', parsed.username);
  } catch (err) {
    console.error('Error decrypting:', err);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
`;
  conn.sftp((err, sftp) => {
    const s = sftp.createWriteStream('/tmp/check_dec.js');
    s.write(remote);
    s.end(() => {
      conn.exec('node /tmp/check_dec.js', (err2, stream2) => {
        stream2.on('data', d => process.stdout.write(d.toString()));
        stream2.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
