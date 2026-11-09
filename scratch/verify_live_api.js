const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const http = require('http');

    function get(url) {
      return new Promise((res, rej) => {
        http.get(url, (r) => {
          let data = '';
          r.on('data', d => data += d);
          r.on('end', () => {
            try { res(JSON.parse(data)); } catch (e) { res(data); }
          });
        }).on('error', rej);
      });
    }

    async function check() {
      for (const m of [9, 10, 11]) {
        const res = await get('http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/' + m);
        const cqgTot = res.data?.summary?.totalCqgVolume || res.data?.totals?.cqg?.currentMonthVolume || res.raw?.section1Tvkd?.cqg?.summary?.lotCurrentMonth;
        const acmTot = res.data?.summary?.totalAcmVolume || res.data?.totals?.acm?.currentMonthVolume || res.raw?.section1Tvkd?.acm?.summary?.lotCurrentMonth;
        console.log('Tháng ' + m + '/2026:', {
          success: res.success,
          cqgItems: res.raw?.section1Tvkd?.cqg?.items?.length,
          acmItems: res.raw?.section1Tvkd?.acm?.items?.length,
          cqgLot: cqgTot,
          acmLot: acmTot,
          cqgCommodities: res.raw?.section2Commodities?.cqg?.items?.length,
        });
      }
    }
    check().catch(console.error);
  "`, (err, stream) => {
    if (err) throw err;
    stream.on('close', () => conn.end());
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});

