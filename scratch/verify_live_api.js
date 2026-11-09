const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.exec('curl -s http://127.0.0.1:3001/api/v1/trading-ops/monthly-report/2026/10', (err, stream) => {
    if (err) throw err;
    let buf = '';
    stream.on('data', d => buf += d.toString());
    stream.on('close', () => {
      try {
        const j = JSON.parse(buf);
        const d = j.data;
        console.log('=== LIVE API SUMMARY (THÁNG 10/2026) ===');
        console.log('Total Volume Current:', d.summary.totalVolumeCurrentMonth.toLocaleString(), 'lots');
        console.log('Total Volume Prev:', d.summary.totalVolumePrevMonth.toLocaleString(), 'lots');
        console.log('Growth Rate:', (d.summary.volumeGrowthRate * 100).toFixed(2) + '%');
        console.log('CQG Volume:', d.summary.cqgVolume.toLocaleString(), 'lots', '(' + d.summary.cqgTradingDays + ' phiên)');
        console.log('ACM Volume:', d.summary.acmVolume.toLocaleString(), 'lots', '(' + d.summary.acmTradingDays + ' phiên)');
        console.log('Top 1 TVKD:', JSON.stringify(d.summary.top1Member));
        console.log('Top 1 Commodity:', JSON.stringify(d.summary.top1Commodity));

        console.log('\n=== TOP 5 TVKD CQG ===');
        d.part1Members.cqgMembers.slice(0, 5).forEach(m => {
          console.log('  STT ' + m.stt + ': TVKD ' + m.memberCode + ' (' + m.memberName + ')');
          console.log('    Volume: ' + m.currentMonthVolume.toLocaleString() + ' lots | Thị phần: ' + (m.shareRate * 100).toFixed(2) + '%');
          console.log('    Đỉnh: ' + m.maxDayDate + ' (' + m.maxDayVolume.toLocaleString() + ' lots) | Đáy: ' + m.minDayDate + ' (' + m.minDayVolume.toLocaleString() + ' lots) | Số phiên: ' + m.tradingDaysCount);
        });

        console.log('\n=== TOP 5 TVKD ACM ===');
        d.part1Members.acmMembers.slice(0, 5).forEach(m => {
          console.log('  STT ' + m.stt + ': TVKD ' + m.memberCode + ' (' + m.memberName + ')');
          console.log('    Volume: ' + m.currentMonthVolume.toLocaleString() + ' lots | Thị phần: ' + (m.shareRate * 100).toFixed(2) + '%');
          console.log('    Đỉnh: ' + m.maxDayDate + ' (' + m.maxDayVolume.toLocaleString() + ' lots) | Đáy: ' + m.minDayDate + ' (' + m.minDayVolume.toLocaleString() + ' lots) | Số phiên: ' + m.tradingDaysCount);
        });
      } catch (e) {
        console.log('ERROR:', e.message, buf.substring(0, 500));
      }
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', username: 'mxvadmin', password: 'MxV!,#2o26' });
