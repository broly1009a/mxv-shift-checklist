const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('pm2 status && ls -la /opt/mxv-checklist/backend/src/modules/ccp-statistics/inputExampleCppFull_2/review_output', (err, stream) => {
    let out = '';
    stream.on('data', (d) => (out += d));
    stream.stderr.on('data', (d) => (out += d));
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
