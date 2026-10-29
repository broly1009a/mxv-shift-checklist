const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `find /home/mxvadmin /opt /data -type f \\( -name "*28.10*.xlsx" -o -name "*28.10*.csv" -o -name "*QL*TT*TKGD*.xlsx" -o -name "*EOD*.xlsx" \\) 2>/dev/null | grep "28.10" | head -n 30`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
