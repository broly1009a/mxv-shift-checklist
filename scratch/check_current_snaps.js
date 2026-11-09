const path = require('path');
const { Client } = require(path.resolve('backend/node_modules/ssh2'));
const conn = new Client();
conn.on('ready', () => {
  conn.exec(`NODE_PATH=/opt/mxv-checklist/backend/node_modules node -e "
    const mongoose = require('mongoose');
    async function check() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const snaps = await mongoose.connection.collection('monthly_report_snapshots').find({}, { projection: { monthYear: 1, status: 1, generatedBy: 1, 'section1Tvkd.cqg.summary': 1 } }).toArray();
      console.log('Snapshots in DB:', snaps);
      const stats = await mongoose.connection.collection('daily_trading_stats').countDocuments();
      console.log('daily_trading_stats count:', stats);
      process.exit(0);
    }
    check();
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

