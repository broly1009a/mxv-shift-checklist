const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s "http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10"', (err, stream) => {
    if (err) throw err;
    let buf = '';
    stream.on('data', d => buf += d.toString());
    stream.on('close', () => {
      try {
        const j = JSON.parse(buf);
        const d = j.raw || j.data || j;
        console.log('Spread summary:', JSON.stringify(d.section3Specials?.spread?.summary));
        console.log('LME summary:', JSON.stringify(d.section3Specials?.lme?.summary));
        console.log('Options summary:', JSON.stringify(d.section3Specials?.options?.summary));
        console.log('LME 003:', JSON.stringify(d.section3Specials?.lme?.items?.find(x => x.tvkdCode === '003')));
        console.log('Options 045:', JSON.stringify(d.section3Specials?.options?.items?.find(x => x.tvkdCode === '045')));
      } catch (e) {
        console.log('ERROR:', e.message, buf.substring(0, 500));
      }
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });
