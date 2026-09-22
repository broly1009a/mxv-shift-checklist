const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const dir = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp';
  conn.exec(`ls -lh "${dir}"`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d.toString());
    stream.on('close', () => {
      console.log('FILES IN THONG KE CCP:');
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
