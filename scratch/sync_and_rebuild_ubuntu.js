const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp(async (err, sftp) => {
    if (err) throw err;

    function put(local, remote) {
      return new Promise((res, rej) => {
        sftp.fastPut(local, remote, (putErr) => {
          if (putErr) rej(putErr);
          else {
            console.log('Uploaded:', remote);
            res();
          }
        });
      });
    }

    try {
      await put(
        path.resolve('backend/src/modules/trading-ops/services/reporting/monthly-reporting.service.ts'),
        '/opt/mxv-checklist/backend/src/modules/trading-ops/services/reporting/monthly-reporting.service.ts'
      );
      await put(
        path.resolve('backend/src/modules/trading-ops/controllers/monthly-reporting.controller.ts'),
        '/opt/mxv-checklist/backend/src/modules/trading-ops/controllers/monthly-reporting.controller.ts'
      );
      await put(
        path.resolve('frontend/src/app/trading-manager/components/monthly-report/MonthlyReportSection.tsx'),
        '/opt/mxv-checklist/frontend/src/app/trading-manager/components/monthly-report/MonthlyReportSection.tsx'
      );

      console.log('All files uploaded. Building backend and frontend on Ubuntu...');

      const cmd = `
        set -e
        echo "=== 1. BUILD BACKEND ==="
        cd /opt/mxv-checklist/backend
        npm run build

        echo "=== 2. BUILD FRONTEND ==="
        cd /opt/mxv-checklist/frontend
        npm run build

        echo "=== 3. PM2 RESTART ==="
        pm2 restart mxv-backend mxv-frontend
        pm2 status
        echo "=== ALL DONE ==="
      `;

      conn.exec(cmd, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log('Build & Restart exit code:', code);
          conn.end();
        });
        stream.on('data', (d) => process.stdout.write(d));
        stream.stderr.on('data', (d) => process.stderr.write(d));
      });
    } catch (e) {
      console.error(e);
      conn.end();
    }
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

