const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/15.09"', (err, stream) => {
    let data = '';
    stream.on('data', c => data += c);
    stream.on('close', () => {
      console.log('--- 15.09 CONTENTS ---');
      console.log(data);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
