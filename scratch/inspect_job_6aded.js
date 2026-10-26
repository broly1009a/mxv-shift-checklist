const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const mongoose = require('mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;
      const job = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6adedab63c0f60968b484592') });
      console.log('--- JOB SUMMARY ---');
      console.log('Status:', job?.status);
      console.log('Result:', JSON.stringify(job?.result || job?.payload?.result || job?.payload, null, 2));
      await mongoose.disconnect();
    }
    run().catch(console.error);
  "`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 15000
});
