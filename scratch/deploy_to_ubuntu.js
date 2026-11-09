const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    set -e
    cd /opt/mxv-checklist
    echo "=== 1. GIT PULL ==="
    git pull origin v5-tai-theo-co-che-dong-bo

    echo "=== 2. BUILD BACKEND ==="
    cd /opt/mxv-checklist/backend
    npm run build

    echo "=== 3. BUILD FRONTEND ==="
    cd /opt/mxv-checklist/frontend
    npm run build

    echo "=== 4. PM2 RESTART ==="
    pm2 restart mxv-backend mxv-frontend
    pm2 status
    echo "=== DEPLOYMENT COMPLETED! ==="
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log('Deploy finished with exit code:', code);
      conn.end();
    });
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

