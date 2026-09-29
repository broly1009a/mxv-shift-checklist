const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== 1. PM2 STATUS ==="
    pm2 status
    echo ""
    echo "=== 2. MONGODB BOT_JOBS (PENDING/PROCESSING/AWAITING) ==="
    mongosh mxv_shift_checklist --eval 'db.bot_jobs.find({ status: { $in: ["PENDING", "PROCESSING", "AWAITING_CAPTCHA"] } }, { jobType: 1, status: 1, attempts: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 }).limit(10).toArray()'
    echo ""
    echo "=== 3. RUNNING CHROME / PLAYWRIGHT PROCESSES ==="
    ps aux | grep -E 'chrome|chromium|playwright' | grep -v grep | head -n 20
    echo ""
    echo "=== 4. RECENT BACKEND LOGS (LAST 30 LINES) ==="
    pm2 logs mxv-backend --lines 30 --nostream
  `;

  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('SSH Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
