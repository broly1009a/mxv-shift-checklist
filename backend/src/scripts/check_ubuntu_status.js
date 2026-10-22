const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== PM2 STATUS ==="',
    'pm2 status',
    'echo "=== BACKEND LAST 25 LOGS ==="',
    'pm2 logs mxv-backend --lines 25 --nostream',
    'echo "=== FRONTEND LAST 25 LOGS ==="',
    'pm2 logs mxv-frontend --lines 25 --nostream',
    'echo "=== CURL LOCALHOST:3000/login (FRONTEND) ==="',
    'curl -I -s http://127.0.0.1:3000/login || echo "CURL 3000 FAILED"',
    'echo "=== CURL LOCALHOST:3001/api/v1/users (BACKEND) ==="',
    'curl -I -s http://127.0.0.1:3001/api/v1/users || echo "CURL 3001 FAILED"',
    'echo "=== NGINX STATUS ==="',
    'systemctl is-active nginx',
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
      console.log(`\n=== CHECK HOAN TAT (Exit Code: ${code}) ===`);
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
