const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const target = '/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10/DSGD CCP.xlsx';
  conn.exec(`rm -f "${target}" && ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/TradingCheck/CCP/Futures/2026/T10.2026/16.10"`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => {
      console.log('\n[Done] Dummy DSGD CCP.xlsx removed.');
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
