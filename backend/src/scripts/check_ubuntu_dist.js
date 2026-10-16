const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== CHECKING BACKEND DIST TIMESTAMP ==="
    ls -l --time-style=full-iso /opt/mxv-checklist/backend/dist/modules/bot-engine/handlers/recon-jobs.handler.js 2>/dev/null
    echo ""
    echo "=== CHECKING INGRESS IN DIST ==="
    ls -l /opt/mxv-checklist/backend/dist/modules/ingress/adapters 2>/dev/null
    echo ""
    echo "=== CHECKING IF SCHEDULER HAS NEW HELPER ==="
    grep -n "getRecommendedMarketCloseDownloadTime" /opt/mxv-checklist/backend/dist/modules/bot-engine/scheduler.service.js 2>/dev/null || echo "Not yet compiled into dist"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
