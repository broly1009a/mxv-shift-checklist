const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T11.2026/05.11"`, (err, stream) => {
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

