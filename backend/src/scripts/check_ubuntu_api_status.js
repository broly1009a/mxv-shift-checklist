const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('✅ SSH to 10.0.0.26 connected successfully.');
  
  // 1. Kiểm tra PM2 status
  // 2. Curl API console-summary trên local Ubuntu
  // 3. Xem 40 dòng log mới nhất của PM2
  const cmd = `
    echo "=== 1. PM2 STATUS ==="
    pm2 status

    echo "\n=== 2. TEST LOCAL API CONSOLE-SUMMARY (2026-09-18) ==="
    curl -s -i "http://127.0.0.1:3001/api/v1/reconciliation/console-summary?date=2026-09-18" | head -n 25

    echo "\n=== 3. TEST LOCAL API CONSOLE-SUMMARY (2026-09-17) ==="
    curl -s -i "http://127.0.0.1:3001/api/v1/reconciliation/console-summary?date=2026-09-17" | head -n 25

    echo "\n=== 4. LATEST PM2 LOGS (40 lines) ==="
    pm2 logs --lines 40 --nostream
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('SSH Exec Error:', err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => {
      console.log('\n--- FINISHED UBUNTU CHECK ---');
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection Failed:', err.message);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 10000,
});
