const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. LIST BACKUP MS ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026"
    echo "=== 2. LIST BACKUP MS 07.10 ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/07.10" 2>/dev/null || echo "07.10 not found"
    echo "=== 3. LIST BACKUP MS 08.10 ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/08.10" 2>/dev/null || echo "08.10 not found"
    echo "=== 4. LIST BACKUP CCP ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026"
    echo "=== 5. LIST BACKUP CQG ==="
    ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures/2026/T10.2026"
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
