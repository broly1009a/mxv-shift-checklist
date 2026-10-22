const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'admin', username: 'admin', role: 'ADMIN', permissions: ['ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE'] },
      'trading_mxv_secret_key_2026'
    );
    
    fetch('http://127.0.0.1:3001/api/v1/trading-ops/console-summary?date=2026-10-21', {
      headers: { 'Authorization': 'Bearer ' + token }
    })
    .then(r => r.json())
    .then(d => {
      console.log('RESPONSE:', JSON.stringify(d, null, 2));
    })
    .catch(console.error);
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
