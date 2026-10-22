const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = [
    'echo "=== CHECK JOB 6ad9d128a066642fccdc13da ==="',
    'curl -s http://127.0.0.1:3001/api/v1/bot-engine/jobs/6ad9d128a066642fccdc13da | grep -o \'"status":"[^"]*","jobType":"[^"]*"\'',
    'echo "=== HOST MEMORY USAGE ==="',
    'free -h',
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
