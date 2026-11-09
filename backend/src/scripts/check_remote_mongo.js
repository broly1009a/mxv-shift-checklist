const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
      const snap9 = await mongoose.connection.collection('monthly_report_snapshots').findOne({ monthYear: '2026-09' });
      console.log('snap9.section1Tvkd keys:', Object.keys(snap9.section1Tvkd || {}));
      if (snap9.section1Tvkd.cqg) {
        console.log('snap9.section1Tvkd.cqg items top 5:');
        for (const it of snap9.section1Tvkd.cqg.items.slice(0, 5)) {
          console.log(it.stt, it.tvkdCode, it.tvkdName, '| fullName:', it.fullName);
        }
      }
      process.exit(0);
    });
  `;
  const cmd = `cd /opt/mxv-checklist/backend && node -e "${remoteScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
