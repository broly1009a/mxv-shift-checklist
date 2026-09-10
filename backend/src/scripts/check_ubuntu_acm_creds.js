const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');
    const crypto = require('crypto');
    require('dotenv').config();

    function decrypt(text) {
      if (!text) return '';
      const parts = text.split(':');
      if (parts.length !== 2) return text;
      const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
      const secretKey = crypto.createHash('sha256').update(rawKey).digest();
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
      let dec = decipher.update(encrypted);
      dec = Buffer.concat([dec, decipher.final()]);
      return dec.toString('utf8');
    }

    async function run() {
      await mongoose.connect(process.env.MONGODB_URI);
      const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_acm' });
      if (s) {
        try {
          console.log('Ubuntu bot_credentials_acm:', JSON.parse(decrypt(s.value)));
        } catch(e) {
          console.log('Raw:', s.value);
        }
      }
      await mongoose.disconnect();
    }
    run();
  `;
  conn.exec(`cd /opt/mxv-checklist/backend && node -e "${nodeScript.replace(/"/g, '\\"')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
