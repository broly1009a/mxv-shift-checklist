const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec('sed -n "215,245p" /opt/mxv-checklist/backend/src/database/seed.service.ts', (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
