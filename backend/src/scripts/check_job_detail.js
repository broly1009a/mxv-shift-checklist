const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const job = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d5b7a066642fccdc13e8') });
  
  console.log('=== JOB 6ad9d5b7a066642fccdc13e8 ===');
  console.log('Status:', job.status);
  console.log('Payload result summary:', JSON.stringify({
    totals: job.payload?.result?.totals,
    cutoffTime: job.payload?.result?.cutoffTime,
    cqgCutoffTime: job.payload?.result?.cqgCutoffTime,
    discrepancies: job.payload?.result?.discrepancies,
    preservedOrders: job.payload?.result?.preservedOrders,
  }, null, 2));

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/check_job_payload.js\n${remoteScript}\nEOF\nnode /tmp/check_job_payload.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
