const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  conn.exec('grep -i "MICROSOFT" /opt/mxv-checklist/backend/.env 2>/dev/null; grep -i "M365" /opt/mxv-checklist/backend/.env 2>/dev/null', (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log('ENV ON UBUNTU:');
      out.split('\n').forEach(line => {
        const parts = line.split('=');
        if (parts[0]) {
          console.log(parts[0].trim() + ' = ' + (parts[1] ? parts[1].trim().slice(0, 8) + '...' : 'empty'));
        }
      });
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
