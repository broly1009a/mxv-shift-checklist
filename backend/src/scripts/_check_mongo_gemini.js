const { Client } = require('ssh2');
const conn = new Client();

const checkScript = `
const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));

  const acm = await sysSetCol.findOne({ key: 'bot_credentials_acm' });
  console.log('bot_credentials_acm:', JSON.stringify(acm, null, 2));

  await mongoose.disconnect();
}

check().catch(console.error);
`;

const b64 = Buffer.from(checkScript).toString('base64');
conn.on('ready', () => {
  const cmd = `echo "${b64}" | base64 -d > /tmp/_check_creds.js && NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/_check_creds.js && rm -f /tmp/_check_creds.js`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
