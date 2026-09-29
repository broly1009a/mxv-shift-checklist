const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const query = `ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026/26.09"`;
  conn.exec(query, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
