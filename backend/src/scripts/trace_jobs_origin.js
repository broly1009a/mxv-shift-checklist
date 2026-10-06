const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `python3 -c "
with open('/home/mxvadmin/.pm2/logs/mxv-backend-out.log', 'r', errors='ignore') as f:
    lines = f.readlines()
for l in lines[-5000:]:
    if '6ac2f7478efdf4107b6a23d2' in l or '6ac2f70c8efdf4107b6a23af' in l:
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
