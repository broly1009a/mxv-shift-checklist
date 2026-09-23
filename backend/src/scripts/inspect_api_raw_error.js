const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    node -e "
      const http = require('http');
      http.get('http://127.0.0.1:3001/api/v1/reconciliation/console-summary?date=2026-09-17&jobId=6aab0b84cbae7980bc5366a8', (res) => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          console.log('Status Code:', res.statusCode);
          console.log('Raw Response:', raw);
        });
      });
    "
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
