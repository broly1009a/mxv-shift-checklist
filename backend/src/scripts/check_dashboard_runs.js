const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const jobs = await mongoose.connection.collection('bot_jobs').find({
    jobType: 'CHECK_KLGD',
    createdAt: { $gte: new Date('2026-10-22T00:00:00.000Z') }
  }).sort({ createdAt: 1 }).toArray();

  console.log('Total jobs today:', jobs.length);
  for (const j of jobs) {
    const vnDate = new Date(new Date(j.createdAt).getTime() + 7 * 3600 * 1000);
    const timeStr = String(vnDate.getUTCHours()).padStart(2, '0') + ':' + String(vnDate.getUTCMinutes()).padStart(2, '0');
    const totalNano = j.payload?.result?.totals?.totalNano || 0;
    const totalDSGD = j.payload?.result?.totals?.totalDSGD || 0;
    console.log(timeStr + ' | Status: ' + j.status.padEnd(10) + ' | Nano: ' + totalNano + ' | DSGD: ' + totalDSGD + ' | ID: ' + j._id);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
`;

  conn.exec(`cat << 'EOF' > /tmp/check_dashboard_runs.js\n${remoteScript}\nEOF\nnode /tmp/check_dashboard_runs.js`, (err, stream) => {
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
