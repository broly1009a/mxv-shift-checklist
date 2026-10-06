const path = require('path');
const { Client } = require(path.join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');

  const checkCmd = `
    head -n 5 "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM/Futures/ACM/2026/T09.2026/25.09/EOD FO trades_PT Straits Financial Indonesia - 10017890000_25092026.csv"
  `;

  conn.exec(checkCmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => {
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
});

conn.connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
