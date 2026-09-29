const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "1. Killing lingering headless chromium..."
    pkill -9 -f chrome-headless-shell || true
    sleep 1
    echo "2. Restarting PM2 mxv-backend..."
    pm2 restart mxv-backend
    sleep 3
    echo "3. Checking PM2 status..."
    pm2 status
  `;
  conn.exec(cmd, (err, stream) => {
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => {
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
