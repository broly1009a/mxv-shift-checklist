const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const { decrypt } = require('/opt/mxv-checklist/backend/dist/shared/helpers/crypto');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const s = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  if (s) {
    try {
      const dec = decrypt(s.value);
      const parsed = JSON.parse(dec);
      console.log('Username in DB:', parsed.username);
      console.log('Password length in DB:', parsed.password ? parsed.password.length : 0);
      console.log('Url in DB:', parsed.url);
      console.log('Password mask in DB:', parsed.password ? parsed.password[0] + '***' + parsed.password.slice(-1) : '');
    } catch (e) {
      console.log('Error decrypting with shared crypto:', e.message);
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`node -e "${remoteScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
