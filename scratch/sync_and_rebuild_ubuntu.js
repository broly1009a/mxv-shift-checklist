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
        path.resolve('backend/src/modules/ingress/adapters/ms-api.adapter.ts'),
        '/opt/mxv-checklist/backend/src/modules/ingress/adapters/ms-api.adapter.ts'
      );
      await put(
        path.resolve('backend/src/modules/trading-ops/services/reporting/monthly-reporting.service.ts'),
        '/opt/mxv-checklist/backend/src/modules/trading-ops/services/reporting/monthly-reporting.service.ts'
      );
      await put(
        path.resolve('backend/src/modules/trading-ops/services/reporting/monthly-excel-exporter.service.ts'),
        '/opt/mxv-checklist/backend/src/modules/trading-ops/services/reporting/monthly-excel-exporter.service.ts'
      );

      console.log('All files uploaded. Building backend on Ubuntu...');

      const cmd = `
        set -e
        echo "=== 1. BUILD BACKEND ==="
        cd /opt/mxv-checklist/backend
        npm run build

        echo "=== 2. PM2 RESTART BACKEND ==="
        pm2 restart mxv-backend
        sleep 6
        echo "=== 3. FORCE REFRESH MONTH 10 SNAPSHOT ==="
        curl -s "http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10?forceRefresh=true" | node -e 'let d=""; process.stdin.on("data", c=>d+=c); process.stdin.on("end", ()=>{ const j=JSON.parse(d); const raw = j.raw || j.data; console.log("CQG Total Members:", raw?.section1Tvkd?.cqg?.totalMembers); console.log("Last 6 CQG Members:", raw?.section1Tvkd?.cqg?.items?.slice(-6)?.map(x=>x.tvkdCode + ": " + x.tvkdName + " (" + x.lotPreviousMonth + " -> " + x.lotCurrentMonth + ")")); console.log("ACM Total Members:", raw?.section1Tvkd?.acm?.totalMembers, "PrevSum:", raw?.section1Tvkd?.acm?.summary?.lotPreviousMonth, "CurSum:", raw?.section1Tvkd?.acm?.summary?.lotCurrentMonth); console.log("CQG Commodities Count:", raw?.section2Commodities?.cqg?.totalCommodities, "ACM Commodities Count:", raw?.section2Commodities?.acm?.totalCommodities); console.log("Section 3 Spread:", raw?.section3Specials?.spread?.summary); console.log("Section 3 LME:", raw?.section3Specials?.lme?.summary); console.log("Section 3 Options:", raw?.section3Specials?.options?.summary); });'
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

