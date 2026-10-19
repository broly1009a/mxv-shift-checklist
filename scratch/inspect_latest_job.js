const { Client } = require(require('path').join(__dirname, '..', 'backend', 'node_modules', 'ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const jobs = await db.collection('bot_jobs').find({ botCheckType: 'CHECK_KLGD' }).sort({ createdAt: -1 }).limit(1).toArray();
  if (jobs.length > 0) {
    const job = jobs[0];
    console.log('JOB ID:', job._id);
    console.log('CREATED AT:', job.createdAt);
    console.log('RESULT TOTALS:', JSON.stringify(job.payload?.result?.totals || job.payload?.totals, null, 2));
    console.log('RESULT CCP STATUS:', job.payload?.result?.totals?.ccpStatus);
    console.log('RESULT MISMATCHED TRADES COUNT:', (job.payload?.result?.mismatchedTrades || []).length);
    console.log('PENDING SYNC TRADES COUNT:', (job.payload?.result?.pendingSyncTrades || []).length);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`node -e "${remoteScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
