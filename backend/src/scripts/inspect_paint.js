const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-14/001C6332468"
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-15/001C6332468"
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem/2026-09-16/001C6332468"
  `;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', (d) => (out += d.toString()));
    stream.stderr.on('data', (d) => (out += d.toString()));
    stream.on('close', () => {
      console.log('OUTPUT:\n' + out);
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
