const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem" -name "*046C0002936*"`;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
