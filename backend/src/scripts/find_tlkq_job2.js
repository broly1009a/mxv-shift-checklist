const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const job = db.bot_jobs.findOne({ _id: ObjectId("6ab1f9b217ac749b67f1424a") });
      if (job) {
        print("Status: " + job.status);
        print("Payload: " + JSON.stringify(job.payload));
        job.logs.forEach(l => print(l));
      }
    '
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
