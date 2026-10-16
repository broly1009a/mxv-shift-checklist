const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    echo "=== INGRESS ENVIRONMENT VARIABLES ON UBUNTU ==="
    grep -i ingress /opt/mxv-checklist/backend/.env 2>/dev/null || echo "No ingress env vars in .env"
    echo ""
    echo "=== MODULE INGRESS EXISTENCE ==="
    ls -la /opt/mxv-checklist/backend/src/modules/ingress/adapters 2>/dev/null || echo "No ingress adapters dir"
    echo ""
    echo "=== RECENT CRON / JOB CODE IN RECON-JOBS.HANDLER.TS ==="
    grep -n "ingress_mode" /opt/mxv-checklist/backend/src/modules/bot-engine/handlers/recon-jobs.handler.ts 2>/dev/null || echo "No ingress_mode in recon-jobs.handler.ts"
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
