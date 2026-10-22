const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const mongoose = require('mongoose');
    const jwt = require('jsonwebtoken');

    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const user = await mongoose.connection.db.collection('users').findOne({});
      const token = jwt.sign(
        { sub: user._id.toString(), username: user.username, role: user.role, permissions: user.permissions || ['ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE'] },
        'trading_mxv_secret_key_2026'
      );
      
      const res = await fetch('http://127.0.0.1:3001/api/v1/trading-ops/latest-dsgd-before-eod?system=CCP&tradingDate=2026-10-21', {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      });
      console.log('STATUS:', res.status);
      const data = await res.json();
      console.log('DATA LATEST:', JSON.stringify(data, null, 2));
      await mongoose.disconnect();
    }
    run().catch(console.error);
  "`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 10000
});
