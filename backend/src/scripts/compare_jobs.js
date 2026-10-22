const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  
  const jobFast = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad91cfd8c3a20a9674cf4c1') });
  const jobToday = await mongoose.connection.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ad9d128a066642fccdc13da') });

  console.log('=== FAST JOB YESTERDAY (67s) ===');
  for (const l of (jobFast && jobFast.logs ? jobFast.logs : [])) {
    console.log(typeof l === 'string' ? l : JSON.stringify(l));
  }

  console.log('=== TODAY JOB (95s) ===');
  for (const l of (jobToday && jobToday.logs ? jobToday.logs : [])) {
    console.log(typeof l === 'string' ? l : JSON.stringify(l));
  }

  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/compare_jobs.js\n${remoteScript}\nEOF\nnode /tmp/compare_jobs.js`, (err, stream) => {
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
