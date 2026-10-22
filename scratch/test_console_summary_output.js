const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const mongoose = require('mongoose');
    async function run() {
      const res = await fetch('http://127.0.0.1:3001/api/v1/trading-ops/console-summary?date=2026-10-21');
      const data = await res.json();
      console.log('FULL DATA KEYS:', Object.keys(data));
      console.log('DATA:', JSON.stringify(data, null, 2).slice(0, 500));
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
