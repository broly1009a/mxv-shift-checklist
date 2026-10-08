const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const cmd = `
    echo "=== 1. LOGS AROUND 04:03:40 - 04:04:00 ==="
    grep "4:03:" /home/mxvadmin/.pm2/logs/mxv-backend-out.log | tail -n 25
    echo "=== 2. LOGS AROUND 04:15:50 - 04:16:00 ==="
    grep "4:15:" /home/mxvadmin/.pm2/logs/mxv-backend-out.log | tail -n 25
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
