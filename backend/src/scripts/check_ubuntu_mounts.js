const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  console.log('Connected to Ubuntu 10.0.0.26');
  
  // Find where files at 4:32 AM came from, or how backup is executed
  const cmd = `
    echo "=== PM2 LIST ==="
    pm2 list
    echo "=== RECENT PM2 LOGS FOR TTTT ==="
    pm2 logs mxv-backend --lines 50 --nostream | grep -i -E "TTTT|backup|download" | tail -n 20
    echo "=== CHECK BACKUP SERVICE IN SRC ==="
    grep -rn "TTTT.xlsx" /opt/mxv-checklist/backend/src/ 2>/dev/null
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
