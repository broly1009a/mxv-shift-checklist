const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');

    async function test() {
      const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/mxv_shift_checklist').asPromise();
      const user = await conn.db.collection('users').findOne({});
      console.log('Using user:', user.username, user._id.toString());
      const token = jwt.sign(
        { sub: user._id.toString(), username: user.username, role: user.role || 'ADMIN' },
        'trading_mxv_secret_key_2026',
        { expiresIn: '1h' }
      );
      await conn.close();

      console.log('Calling fetch-eod-email with targetDate 2026-09-25...');
      const res = await fetch('http://127.0.0.1:3001/api/v1/bot-engine/fetch-eod-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ targetDate: '2026-09-25' })
      });
      const data = await res.json();
      console.log('Response status:', res.status);
      console.log('Response body:', JSON.stringify(data, null, 2));
      process.exit(0);
    }
    test().catch(console.error);
  `;
  const b64 = Buffer.from(nodeScript).toString('base64');
  const cmd = `cd /opt/mxv-checklist/backend && node -e "eval(Buffer.from('${b64}', 'base64').toString())"`;
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    let output = '';
    stream.on('data', (d) => { output += d.toString(); });
    stream.stderr.on('data', (d) => { output += d.toString(); });
    stream.on('close', () => {
      console.log(output);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
