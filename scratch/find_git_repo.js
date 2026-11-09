const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`find /home/mxvadmin /opt -name ".git" -type d 2>/dev/null`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

