const { Client } = require('ssh2');

const cmd = process.argv.slice(2).join(' ') || 'cd /opt/mxv-checklist && pwd && git status && git log -n 3 --oneline && git remote -v';

const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.pipe(process.stdout);
    stream.stderr.pipe(process.stderr);
    stream.on('close', (code) => {
      conn.end();
      process.exit(code || 0);
    });
  });
}).on('error', (err) => {
  console.error('SSH Error:', err.message);
  process.exit(1);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
