const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('SSH Ready');
  const cmd = `node -e "
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist').then(async () => {
      const coll = mongoose.connection.collection('special_account_monthly_tracking');
      const docs = await coll.find({}).toArray();
      console.log('special_account_monthly_tracking count:', docs.length);
      for (const d of docs) {
        console.log(d.monthYear, d.category, d.tvkdCode, 'prev:', d.activeBeforeMonth, 'cur:', d.newActiveInMonth, 'tot:', d.totalActive);
      }
      const snaps = await mongoose.connection.collection('monthly_report_snapshots').find({}).project({ monthYear: 1, status: 1, version: 1 }).toArray();
      console.log('snapshots:', snaps);
      process.exit(0);
    });
  "`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('Exited with code:', code);
      conn.end();
    });
  });
}).on('error', err => {
  console.error('SSH Error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});

