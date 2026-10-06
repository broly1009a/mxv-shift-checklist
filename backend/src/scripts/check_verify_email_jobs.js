const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `node -e "
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const jobs = await db.collection('bot_jobs').find({
    jobType: 'VERIFY_EMAIL_STATUS'
  }).sort({ createdAt: -1 }).limit(5).toArray();
  console.log(JSON.stringify(jobs.map(j => ({
    id: j._id,
    jobType: j.jobType,
    status: j.status,
    attempts: j.attempts,
    maxAttempts: j.maxAttempts,
    createdAt: j.createdAt,
    completedAt: j.completedAt,
    failedAt: j.failedAt,
    error: j.error,
    payload: j.payload,
    logsCount: j.logs?.length,
    firstLogs: j.logs?.slice(0, 5),
    lastLogs: j.logs?.slice(-5)
  })), null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
