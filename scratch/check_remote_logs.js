const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c "
with open('/home/mxvadmin/.pm2/logs/mxv-backend-out.log', 'r', errors='ignore') as f:
    lines = f.readlines()
for l in lines[-2000:]:
    if '10/05/2026, 8:0' in l:
        if 'GET /api/v1/' not in l:
            print(l.strip())
"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
