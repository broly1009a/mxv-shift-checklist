const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    (async () => {
      const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const job = await mongoose.connection.collection('bot_jobs').findOne({
        _id: new mongoose.Types.ObjectId('6ab66b5ee3d0f7b1851bb357')
      });
      console.log('Job logs:');
      for (const l of job.logs || []) {
        if (l.includes('CCP') || l.includes('DSGD') || l.includes('Recon')) {
          console.log(l);
        }
      }
      await mongoose.disconnect();
    })();
  `;

  const b64 = Buffer.from(remoteScript).toString('base64');
  conn.exec(`node -e "eval(Buffer.from('${b64}', 'base64').toString())"`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d));
    stream.stderr.on('data', d => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26'
});
