const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== TOP PROCESSES BY CPU / MEM ==="',
    'ps aux --sort=-%mem | head -n 15',
    'echo "=== RECENT NGINX ACCESS (LAST 30) ==="',
    'tail -n 30 /var/log/nginx/access.log',
    'echo "=== BACKEND PROCESS STATUS ==="',
    'pm2 show mxv-backend',
    'echo "=== FRONTEND PROCESS STATUS ==="',
    'pm2 show mxv-frontend',
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
