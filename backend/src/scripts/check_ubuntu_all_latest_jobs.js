const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({}).sort({ createdAt: -1 }).limit(10).toArray();
      jobs.forEach(j => {
        print(j._id + " | " + j.jobType + " | " + j.status + " | " + j.createdAt);
      });
    '
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
