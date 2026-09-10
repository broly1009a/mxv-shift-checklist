const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== 1. BACKUP MS FUTURES 10.09 ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/10.09" 2>/dev/null
    echo "=== 2. BACKUP CQG FUTURES 10.09 ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T09.2026/10.09" 2>/dev/null
    echo "=== 3. BACKUP ACM 10.09 ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/ACM/2026/T09.2026/10.09" 2>/dev/null
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
