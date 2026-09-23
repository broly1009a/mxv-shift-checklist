const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== CHI TIẾT FILE TLKQHSKQ.xlsx NGÀY 18.09 ==="
    stat "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/18.09/TLKQHSKQ.xlsx"
    echo ""
    echo "=== THỜI GIAN CỦA TẤT CẢ CÁC FILE TRONG THƯ MỤC 18.09 ==="
    ls -la --time-style=full-iso "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/18.09/"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
