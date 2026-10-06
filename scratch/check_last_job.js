let Client;
try {
  Client = require('ssh2').Client;
} catch (e) {
  try {
    Client = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-shift-checklist/backend/node_modules/ssh2').Client;
  } catch (e2) {
    Client = require('../mock-sftp/node_modules/ssh2').Client;
  }
}

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `
    cd /opt/mxv-checklist/backend && node -e '
      const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
      require("/opt/mxv-checklist/backend/node_modules/dotenv").config({ path: "/opt/mxv-checklist/backend/.env" });

      (async () => {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/checklist");
        const db = mongoose.connection.db;
        const job = await db.collection("bot_jobs").find({ botCheckType: "CHECK_KLGD" }).sort({ createdAt: -1 }).limit(1).next();
        if (job) {
          console.log("Job ID:", job._id, "CreatedAt:", job.createdAt);
          console.log("Totals:", job.payload?.result?.totals);
          console.log("Passed:", job.payload?.result?.passed);
          console.log("Mismatched Count:", job.payload?.result?.mismatchedTrades?.length);
          console.log("First 3 mismatches:", job.payload?.result?.mismatchedTrades?.slice(0, 3));
        }
        await mongoose.disconnect();
      })();
    '
  `;

  conn.exec(remoteCmd, (err, stream) => {
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
