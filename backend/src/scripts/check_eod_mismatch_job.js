const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/mxv-checklist/backend && node -e '
    const mongoose = require("mongoose");
    mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist").then(async () => {
      const job = await mongoose.connection.collection("bot_jobs")
        .findOne({ jobType: "CHECK_EOD_CCP" }, { sort: { createdAt: -1 } });
      if (!job) {
        console.log("No job found");
        process.exit(0);
      }
      console.log("Job ID:", job._id);
      console.log("Created At:", job.createdAt);
      console.log("Status:", job.status);
      const res = job.payload?.result || {};
      console.log("Total accounts:", res.totalAccounts);
      console.log("Mismatched count:", (res.mismatchedEOD || []).length);
      console.log("Mismatched details:", JSON.stringify(res.mismatchedEOD, null, 2));
      console.log("Files:", JSON.stringify(res.files || {}, null, 2));
      process.exit(0);
    }).catch(e => { console.error(e); process.exit(1); });
  '`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
