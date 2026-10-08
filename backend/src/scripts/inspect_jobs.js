const { Client } = require('ssh2');

const conn = new Client();

conn.on('ready', () => {
  const nodeScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const job = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ac6b68ca137e79d622ba831') });
  console.log('=== JOB CCP 6ac6b68ca137e79d622ba831 ===');
  console.log('Payload:', JSON.stringify(job?.payload, null, 2));
  console.log('Created:', job?.createdAt);

  const cqgJob = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ac6b401a137e79d622ba826') });
  console.log('=== CQG JOB 6ac6b401a137e79d622ba826 ===');
  console.log('Payload:', JSON.stringify(cqgJob?.payload, null, 2));
  console.log('Created:', cqgJob?.createdAt);
  console.log('Error:', cqgJob?.error);

  const rpaJob = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ac6b3b6a137e79d622ba823') });
  console.log('=== RPA JOB 6ac6b3b6a137e79d622ba823 ===');
  console.log('Payload:', JSON.stringify(rpaJob?.payload, null, 2));
  console.log('Created:', rpaJob?.createdAt);

  // Check the active shift log details around that time
  const shift = await db.collection('shift_logs').findOne({ status: 'PENDING' });
  console.log('=== ACTIVE SHIFT LOG ===');
  console.log('ID:', shift?._id);
  console.log('shiftDay:', shift?.shiftDay);
  console.log('shiftName:', shift?.shiftName);

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
