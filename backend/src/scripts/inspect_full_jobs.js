const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const nodeScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const ccpJob = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ac6b68ca137e79d622ba831') });
  console.log('=== CCP JOB FULL ===');
  console.log('id:', ccpJob._id);
  console.log('jobType:', ccpJob.jobType);
  console.log('createdBy:', ccpJob.createdBy);
  console.log('createdAt:', ccpJob.createdAt);
  console.log('logs (first 10):', ccpJob.logs ? ccpJob.logs.slice(0, 10) : []);

  const rpaJob = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ac6b3b6a137e79d622ba823') });
  console.log('=== RPA JOB FULL ===');
  console.log('id:', rpaJob._id);
  console.log('jobType:', rpaJob.jobType);
  console.log('createdBy:', rpaJob.createdBy);
  console.log('createdAt:', rpaJob.createdAt);
  console.log('logs (first 10):', rpaJob.logs ? rpaJob.logs.slice(0, 10) : []);

  await mongoose.disconnect();
}
check().catch(console.error);
`;
  const b64 = Buffer.from(nodeScript).toString('base64');
  conn.exec(`echo "${b64}" | base64 -d | node`, (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
