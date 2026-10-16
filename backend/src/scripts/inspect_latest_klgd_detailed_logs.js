const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  conn.on('ready', () => {
    const remoteCmd = `node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const db = mongoose.connection.db;

  const jobs = await db.collection("bot_jobs").find({
    jobType: "CHECK_KLGD"
  }).sort({ createdAt: -1 }).limit(3).toArray();

  jobs.forEach((j, i) => {
    console.log("================================================================================");
    console.log("JOB #" + (i+1) + " ID: " + j._id + " | Status: " + j.status);
    console.log("CreatedAt: " + j.createdAt + " | DurationMs: " + j.durationMs + " ms (~" + (j.durationMs/1000).toFixed(1) + "s)");
    console.log("Summary: " + (j.summary || ""));
    console.log("--- CHI TIẾT TOÀN BỘ LOGS CỦA JOB ---");
    (j.logs || []).forEach(l => console.log(l));
    console.log("================================================================================\\n");
  });

  await mongoose.disconnect();
}
run().catch(console.error);
'`;

    let stdout = '';
    conn.exec(remoteCmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => console.error(d.toString()));
      stream.on('close', () => {
        conn.end();
        console.log(stdout);
      });
    });
  }).connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
    readyTimeout: 15000,
  });
}
main().catch(console.error);
