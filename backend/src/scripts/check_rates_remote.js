const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T09.2026" -iname "*gia*" -o -iname "*rate*" 2>/dev/null
find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026" -iname "*gia*" -o -iname "*rate*" 2>/dev/null
`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', (d) => out += d.toString());
    stream.on('close', () => {
      console.log('SEARCH RESULT:');
      console.log(out || 'NONE FOUND');
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
