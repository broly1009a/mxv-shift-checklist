const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== JOBS AROUND 03:00 - 06:00 AM ==="
    grep -E "10/08/2026, [345]:" /home/mxvadmin/.pm2/logs/mxv-backend-out.log | grep -E "Job|JOB|CQG|RPA|DOWNLOAD|EOD" | grep -v "/api/v1/bot-engine/jobs" | tail -n 80
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
