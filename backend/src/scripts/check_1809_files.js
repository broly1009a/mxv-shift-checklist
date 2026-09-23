const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== DANH SÁCH FILE NGÀY 18.09 TRÊN M-DRIVE ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/18.09" | grep -i tlk || echo "Không tìm thấy file tlk nào"
    echo "=== TỔNG SỐ FILE NGÀY 18.09 ==="
    ls -1 "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/18.09" | wc -l
    echo "=== TẤT CẢ FILE NGÀY 18.09 ==="
    ls -1 "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/18.09"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
