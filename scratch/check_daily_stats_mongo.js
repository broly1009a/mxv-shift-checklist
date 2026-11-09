const { Client } = require(require('path').join(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    const remoteCode = `
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist')
  .then(async () => {
    const stats = await mongoose.connection.collection('daily_trading_stats').aggregate([
      { $match: { date: { $regex: '^2026-10' } } },
      { $group: {
          _id: { date: '$date', system: '$system' },
          totalLot: { $sum: '$lotTotal' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.system': 1 } }
    ]).toArray();

    console.log('=== THỐNG KÊ DAILY_TRADING_STATS THEO NGÀY TRONG MONGODB ===');
    let totalCqg = 0, totalAcm = 0;
    stats.forEach(s => {
      console.log(s._id.date + ' | ' + s._id.system + ' | Lots: ' + s.totalLot.toLocaleString().padStart(8) + ' | Rows: ' + s.count);
      if (s._id.system === 'CQG') totalCqg += s.totalLot;
      if (s._id.system === 'ACM') totalAcm += s.totalLot;
    });
    console.log('---------------------------------------------------------');
    console.log('TỔNG CQG:', totalCqg.toLocaleString());
    console.log('TỔNG ACM:', totalAcm.toLocaleString());
    console.log('TỔNG TOÀN TT:', (totalCqg + totalAcm).toLocaleString());
    process.exit(0);
  })
  .catch(e => { console.error(e); process.exit(1); });
`;
    sftp.writeFile('/tmp/check_daily_stats.js', remoteCode, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('NODE_PATH=/opt/mxv-checklist/backend/node_modules node /tmp/check_daily_stats.js', (cErr, stream) => {
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
