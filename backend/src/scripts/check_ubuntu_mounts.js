const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');
  const cmd = `
    rm -f /opt/mxv-checklist/backend/src/scripts/test_4_chromes_stress.js
    free -h
    pm2 list
  `;
  conn.exec(cmd, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).on('error', err => console.error('SSH error:', err))
  .connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
