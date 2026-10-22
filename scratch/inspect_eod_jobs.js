const path = require('path');
const { Client } = require(path.resolve(__dirname, '../backend/node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `cd /opt/mxv-checklist/backend && node -e "
    const mongoose = require('mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const db = mongoose.connection.db;
      const jobTypes = await db.collection('bot_jobs').distinct('jobType');
      console.log('DISTINCT JOB TYPES:', jobTypes);
      const jobs = await db.collection('bot_jobs').find().sort({ createdAt: -1 }).limit(10).toArray();
      console.log(JSON.stringify(jobs.map(j => ({
        id: j._id,
        jobType: j.jobType,
        status: j.status,
        createdAt: j.createdAt,
        payloadTargetDate: j.payload?.targetDate || j.payload?.sessionDate || j.payload?.date,
        resultTotals: j.payload?.result?.totals,
        resultSummary: j.payload?.result?.summary || j.payload?.result?.message
      })), null, 2));
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
  readyTimeout: 10000
});
