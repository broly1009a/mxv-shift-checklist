const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `cd /opt/mxv-checklist/backend && node -e '
    const mongoose = require("mongoose");
    mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist").then(async () => {
      const configs = await mongoose.connection.collection("system_settings").find({}).toArray();
      console.log("Settings count:", configs.length);
      configs.forEach(c => console.log(c.key, ":", c.value));
      const job = await mongoose.connection.collection("bot_jobs")
        .findOne({ _id: new mongoose.Types.ObjectId("6ae29b5e2c223769c4d305b1") });
      console.log("JOB LOGS:", (job.logs || []).join("\\n"));
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
