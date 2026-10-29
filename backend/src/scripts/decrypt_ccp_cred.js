const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const script = `
    const { decrypt } = require('./dist/shared/utils/crypto.util');
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
      const s = await mongoose.connection.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
      const dec = decrypt(s.value);
      console.log('Decrypted credentials:', dec);
      process.exit(0);
    });
  `;

  conn.exec(`cd /opt/mxv-checklist/backend && node -e "${script.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
