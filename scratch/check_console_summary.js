const { Client } = require('../backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const nodeScript = `
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');

    async function test() {
      const conn = await mongoose.createConnection('mongodb://127.0.0.1:27017/mxv_shift_checklist').asPromise();
      const user = await conn.db.collection('users').findOne({});
      const token = jwt.sign(
        { sub: user._id.toString(), username: user.username, role: user.role || 'ADMIN' },
        'trading_mxv_secret_key_2026',
        { expiresIn: '1h' }
      );
      await conn.close();

      console.log('Calling get-console-summary for 2026-09-25...');
      const res = await fetch('http://127.0.0.1:3001/api/v1/reconciliation/get-console-summary?date=2026-09-25', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      const data = await res.json();
      console.log('PreEod Summary:');
      console.log('mismatchedEOD count:', data?.preEod?.mismatchedEOD?.length || 0);
      console.log('mismatchedPositions count:', data?.preEod?.mismatchedPositions?.length || 0);
      console.log('negativeMargin count:', data?.negativeMargin?.accounts?.length || 0);
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
