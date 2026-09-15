const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== 1. CHECK SRC recon-jobs.handler.ts ==="
    grep -n "checkTttt:" /opt/mxv-checklist/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts
    echo "=== 2. CHECK DIST recon-jobs.handler.js ==="
    grep -n "checkTttt" /opt/mxv-checklist/backend/dist/modules/bot-engine/handlers/recon-jobs.handler.js | head -n 5
    echo "=== 3. PM2 LOGS LAST 20 LINES ==="
    pm2 logs mxv-backend --lines 20 --nostream
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
