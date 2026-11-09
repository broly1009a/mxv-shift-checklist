const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist')
  .then(async () => {
    const s = await mongoose.connection.collection('monthly_report_snapshots').findOne({ monthYear: '2026-10' });
    if (!s) {
      console.log('KHONG TIM THAY SNAPSHOT');
    } else {
      console.log(JSON.stringify({
        status: s.status,
        generatedBy: s.generatedBy,
        note: s.note,
        cqgLots: s.section1Tvkd?.cqg?.summary?.lotCurrentMonth,
        acmLots: s.section1Tvkd?.acm?.summary?.lotCurrentMonth,
        itemsTop3: (s.section1Tvkd?.cqg?.items || []).slice(0, 3)
      }, null, 2));
    }
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
`;
    sftp.writeFile('/tmp/read_snap.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/read_snap.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
