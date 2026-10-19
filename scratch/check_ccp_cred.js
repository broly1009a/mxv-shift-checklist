const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));
const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
const crypto = require('crypto');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const s = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
  console.log('val length:', s ? (s.value ? s.value.length : 0) : 0);
  console.log('val preview:', s ? (s.value ? s.value.substring(0, 35) : '') : '');
  
  const text = s ? s.value : '';
  const parts = text.split(':');
  console.log('parts length:', parts.length);
  if (parts.length === 2) {
    const iv = Buffer.from(parts[0], 'hex');
    const enc = Buffer.from(parts[1], 'hex');
    
    // Method A: sha256 of mxv_secret_salt_fixed
    try {
      const keyA = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
      const decA = crypto.createDecipheriv('aes-256-cbc', keyA, iv);
      const resA = Buffer.concat([decA.update(enc), decA.final()]).toString('utf8');
      console.log('Method A (mxv_secret_salt_fixed sha256): SUCCESS! username =', JSON.parse(resA).username);
    } catch(e) { console.log('Method A failed:', e.message); }

    // Method B: sha256 of ENCRYPTION_KEY
    try {
      const keyB = crypto.createHash('sha256').update(process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!').digest();
      const decB = crypto.createDecipheriv('aes-256-cbc', keyB, iv);
      const resB = Buffer.concat([decB.update(enc), decB.final()]).toString('utf8');
      console.log('Method B (ENCRYPTION_KEY sha256): SUCCESS! username =', JSON.parse(resB).username);
    } catch(e) { console.log('Method B failed:', e.message); }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.sftp((err, sftp) => {
    if (err) { console.error(err); conn.end(); return; }
    const writeStream = sftp.createWriteStream('/opt/mxv-checklist/scratch_cred.js');
    writeStream.write(remoteScript);
    writeStream.end();
    writeStream.on('close', () => {
      conn.exec('node /opt/mxv-checklist/scratch_cred.js', (err2, stream) => {
        if (err2) { console.error(err2); conn.end(); return; }
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
