const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const mongoCmd = `mongosh mxv_shift_checklist --quiet --eval '
    const activeJobs = db.bot_jobs.find({ status: { $in: ["PENDING", "PROCESSING"] } }).toArray();
    print("ACTIVE JOBS COUNT: " + activeJobs.length);
    activeJobs.forEach(j => {
      print(j._id + " | " + j.jobType + " | " + j.status + " | created: " + j.createdAt);
    });
  '`;
  conn.exec(mongoCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d.toString()));
    stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => console.error('SSH Error:', err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
