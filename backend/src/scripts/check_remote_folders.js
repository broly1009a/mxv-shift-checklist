const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -la /mnt/qlgd-it/ 2>&1; ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/" 2>&1', (err, stream) => {
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => {
  console.error(err);
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
