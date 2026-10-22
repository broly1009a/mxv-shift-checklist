const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== NGINX RECENT ACCESS LOGS ==="',
    'tail -n 20 /var/log/nginx/access.log',
    'echo "=== NGINX RECENT ERROR LOGS ==="',
    'tail -n 20 /var/log/nginx/error.log',
    'echo "=== PM2 STATUS DETAILED ==="',
    'pm2 jlist | grep -o \'"name":"[^"]*","pm_id":[0-9]*,"monit":{"memory":[0-9]*,"cpu":[0-9]*},"pm2_env":{"status":"[^"]*"\'',
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
