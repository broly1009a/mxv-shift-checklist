const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const j = db.bot_jobs.findOne({ _id: ObjectId("6aab0b84cbae7980bc5366a8") });
      print("=== JOB 6aab0b84cbae7980bc5366a8 ===");
      print("Status: " + j.status);
      print("JobType: " + j.jobType);
      print("CreatedAt: " + j.createdAt);
      print("Payload Keys: " + Object.keys(j.payload || {}));
      if (j.payload && j.payload.result) {
        print("Result Keys: " + Object.keys(j.payload.result));
        print("Totals: " + JSON.stringify(j.payload.result.totals));
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
