const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist')
      .then(async () => {
        const s = await mongoose.connection.collection('monthly_report_snapshots').findOne({ monthYear: '2026-10' });
        if (!s) {
          console.log('KHONG TIM THAY SNAPSHOT 2026-10');
        } else {
          console.log('=== SNAPSHOT 2026-10 TRONG MONGODB ===');
          console.log('status:', s.status);
          console.log('generatedBy:', s.generatedBy);
          console.log('note:', s.note);
          console.log('generatedAt:', s.generatedAt);
          console.log('CQG lots:', s.section1Tvkd?.cqg?.summary?.lotCurrentMonth);
          console.log('ACM lots:', s.section1Tvkd?.acm?.summary?.lotCurrentMonth);
          console.log('Total lots:', (s.section1Tvkd?.cqg?.summary?.lotCurrentMonth || 0) + (s.section1Tvkd?.acm?.summary?.lotCurrentMonth || 0));
          console.log('Top 5 TVKD CQG:');
          (s.section1Tvkd?.cqg?.items || []).slice(0, 5).forEach(it => {
            console.log('  ' + it.stt + '. [' + it.tvkdCode + '] ' + it.fullName + ' | T9: ' + it.lotPreviousMonth + ' | T10: ' + it.lotCurrentMonth + ' | Phien: ' + it.sessionCount + ' | Dinh: ' + it.maxDate + ' (' + it.maxLotDay + ')');
          });
        }
        process.exit(0);
      })
      .catch(e => { console.error(e); process.exit(1); });
  `;

  conn.exec(`node -e "${remoteScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
