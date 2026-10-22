const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== REQUESTS FROM 10.0.19.34 ==="',
    'grep "10.0.19.34" /var/log/nginx/access.log | tail -n 25 || echo "No requests from 10.0.19.34"',
    'echo "=== REQUESTS FROM 10.0.19.35 ==="',
    'grep "10.0.19.35" /var/log/nginx/access.log | tail -n 25 || echo "No requests from 10.0.19.35"',
    'echo "=== NGINX CONFIG TEST ==="',
    'nginx -t',
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
