const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. COPY MS FILES FROM 08.10 TO 07.10 (ONLY IF MISSING OR OLD) ==="
    # All the files generated before 05:00 AM belong to 07.10
    mkdir -p "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/07.10"
    cp -vn "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/08.10/"* "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/07.10/" 2>/dev/null || true

    echo "=== 2. COPY CCP FILES FROM 08.10 TO 07.10 (ONLY IF MISSING) ==="
    mkdir -p "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/07.10"
    cp -vn "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/08.10/"* "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/07.10/" 2>/dev/null || true

    echo "=== 3. VERIFY 07.10 FOLDERS ==="
    echo "--- MS 07.10 ---"
    ls -lh "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T10.2026/07.10" | head -n 15
    echo "--- CCP 07.10 ---"
    ls -lh "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CCP/Futures/2026/T10.2026/07.10" | head -n 15
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
