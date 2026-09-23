const { Client } = require('ssh2');
const conn = new Client();
const remoteScript = `
const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const emails = await mongoose.connection.db.collection('tkgd_raw_emails')
    .find({ $or: [{ subject: /046C0002936/i }, { bodyPreview: /046C0002936/i }, { body: /046C0002936/i }] })
    .toArray();
  console.log('Found emails:', emails.length);
  emails.forEach((e, idx) => {
    console.log(\`[\${idx}] Subject: \${e.subject} | Received: \${e.receivedDateTime}\`);
    console.log('Attachments:', e.attachments?.map(a => a.name));
  });
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
