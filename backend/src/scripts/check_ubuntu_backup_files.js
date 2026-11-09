const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('Ket noi thanh cong toi Ubuntu 10.0.0.26');

  const cmd = [
    'echo "=== 1. MONGO URI TRONG BACKEND .ENV ==="',
    'grep -E "MONGO|DATABASE" /opt/mxv-checklist/backend/.env | sed "s/:[^:@]*@/:***@/g"',
    'echo "=== 2. THU MUC BACKUP MS & CQG TRONG THANG 09/2026 HOAC GAN NHAT ==="',
    'find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS" -maxdepth 2 -type d 2>/dev/null | tail -n 15',
    'find "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG" -maxdepth 2 -type d 2>/dev/null | tail -n 15',
    'echo "=== 3. KIEM TRA CO FILE THONG KE SO LOT GIAO DICH / BAO CAO THANG KHONG ==="',
    'ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Thong ke so lot giao dich" 2>/dev/null || true',
    'ls -la "/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke" 2>/dev/null || true',
  ].join(' && ');

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
