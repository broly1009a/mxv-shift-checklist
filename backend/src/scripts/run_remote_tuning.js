const { Client } = require('ssh2');

const conn = new Client();

const commands = [
  // 1. Tinh chỉnh swappiness nhân Linux về mức 20 (chống nghẽn I/O đĩa)
  'echo "MxV!,#2o26" | sudo -S sysctl vm.swappiness=20',
  'echo "vm.swappiness=20" | sudo tee /etc/sysctl.d/99-swappiness.conf',
  'echo "MxV!,#2o26" | sudo -S sysctl vm.vfs_cache_pressure=50',
  'echo "vm.vfs_cache_pressure=50" | sudo tee -a /etc/sysctl.d/99-swappiness.conf',

  // 2. Cài đặt trần RAM bảo vệ cho các ứng dụng PM2
  'pm2 restart mxv-backend --max-memory-restart 800M',
  'pm2 restart mxv-frontend --max-memory-restart 500M',
  'pm2 restart mxv-aml --max-memory-restart 500M',
  'pm2 restart mock-sftp --max-memory-restart 250M',
  'pm2 save',

  // 3. Kiểm tra kết quả
  'cat /proc/sys/vm/swappiness',
  'pm2 list'
];

conn.on('ready', () => {
  console.log(' Đã kết nối SSH tới Ubuntu 10.0.0.26');
  const fullCmd = commands.join(' && ');

  conn.exec(fullCmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', (code) => {
      console.log(`\n=== HOÀN TẤT CẤU HÌNH BẢO VỆ TÀI NGUYÊN (Exit code: ${code}) ===`);
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err.message);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000,
});
