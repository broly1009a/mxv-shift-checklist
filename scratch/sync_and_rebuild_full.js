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
      await put(
        path.resolve('frontend/src/app/trading-manager/monthly-report/page.tsx'),
        '/opt/mxv-checklist/frontend/src/app/trading-manager/monthly-report/page.tsx'
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
        echo "=== ALL BUILD & RESTART DONE ==="
      `;

      conn.exec(cmd, (execErr, stream) => {
        if (execErr) throw execErr;
        stream.on('close', (code) => {
          console.log('Build & Restart exit code:', code);
          
          // Now run fresh sync for Month 10/2026 using NestJS context or direct node runner
          console.log('\n=== 4. RUN FRESH SYNC FOR OCTOBER 2026 ON UBUNTU ===');
          const syncScript = `
const { MongoClient } = require('/opt/mxv-checklist/backend/node_modules/mongodb');
const fs = require('fs');
const path = require('path');
const XLSX = require('/opt/mxv-checklist/backend/node_modules/xlsx');

async function main() {
    const client = new MongoClient('mongodb://127.0.0.1:27017/mxv_shift_checklist');
    await client.connect();
    const db = client.db('mxv_shift_checklist');

    // Delete existing snapshot and daily stats for 2026-10 to force clean re-sync
    await db.collection('monthly_report_snapshots').deleteMany({ monthYear: '2026-10' });
    await db.collection('daily_trading_stats').deleteMany({ date: /^2026-10/ });
    console.log('Cleared old snapshot and daily stats for 2026-10 in mxv_shift_checklist');

    await client.close();
}
main().catch(console.error);
`;
          const runCmd = `cat << 'EOF' > /tmp/clean_old_oct.js\n${syncScript}\nEOF\nnode /tmp/clean_old_oct.js\nrm -f /tmp/clean_old_oct.js\ncurl -s -X GET "http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10?forceRefresh=true" | cut -c 1-200`;
          conn.exec(runCmd, (runErr, runStream) => {
            if (runErr) throw runErr;
            runStream.on('data', d => process.stdout.write(d.toString()));
            runStream.on('close', () => conn.end());
          });
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

