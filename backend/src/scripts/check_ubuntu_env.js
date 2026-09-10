const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('cat /opt/mxv-checklist/backend/.env | grep -E "BACKUP|DATA|PATH"', (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
