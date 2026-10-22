const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `find /mnt/qlgd-it/ -name "*DSGD*.xlsx" -mtime -2 2>/dev/null; find /opt/mxv-checklist/ -name "*DSGD*.xlsx" -mtime -2 2>/dev/null`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
