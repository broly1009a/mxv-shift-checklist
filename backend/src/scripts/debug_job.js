const { Client } = require('ssh2');

const scriptContent = `
const mongoose = require('mongoose');
async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const j = await mongoose.connection.collection('bot_jobs').findOne({
    _id: new mongoose.Types.ObjectId('6ae1d1cd53698abafc08d680')
  });
  console.log('JOB:', JSON.stringify(j, null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
`;

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.writeFile('/opt/mxv-checklist/backend/find_job.js', scriptContent, (wErr) => {
      if (wErr) throw wErr;
      conn.exec('cd /opt/mxv-checklist/backend && node find_job.js && rm -f find_job.js', (cErr, stream) => {
        if (cErr) throw cErr;
        stream.on('data', d => process.stdout.write(d.toString()));
        stream.stderr.on('data', d => process.stderr.write(d.toString()));
        stream.on('close', () => conn.end());
      });
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
