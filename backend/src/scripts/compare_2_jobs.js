const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const jobPrev = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d381a066642fccdc13e5') });
  const jobCurr = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d5b7a066642fccdc13e8') });

  console.log('=== JOB PREV (16:12) ===');
  console.log('Cutoff:', jobPrev.payload?.result?.cutoffTime);
  console.log('CQG Cutoff:', jobPrev.payload?.result?.cqgCutoffTime);
  console.log('Totals:', jobPrev.payload?.result?.totals);
  console.log('Discrepancies:', jobPrev.payload?.result?.discrepancies);

  console.log('\\n=== JOB CURR (16:21) ===');
  console.log('Cutoff:', jobCurr.payload?.result?.cutoffTime);
  console.log('CQG Cutoff:', jobCurr.payload?.result?.cqgCutoffTime);
  console.log('Totals:', jobCurr.payload?.result?.totals);
  console.log('Discrepancies:', jobCurr.payload?.result?.discrepancies);

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/compare_2_jobs.js\n${remoteScript}\nEOF\nnode /tmp/compare_2_jobs.js`, (err, stream) => {
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
