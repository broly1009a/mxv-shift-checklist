const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM" -type f 2>/dev/null | tail -n 20', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
