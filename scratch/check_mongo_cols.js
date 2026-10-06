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
        const cols = await db.listCollections().toArray();
        console.log("Collections:", cols.map(c => c.name));
        for (const c of ["bot_jobs", "jobs", "shift_logs"]) {
          const count = await db.collection(c).countDocuments();
          console.log(c, "count:", count);
        }
        const lastJob = await db.collection("bot_jobs").find({}).sort({ _id: -1 }).limit(1).next();
        console.log("Last bot_job:", lastJob ? { id: lastJob._id, jobType: lastJob.jobType, botCheckType: lastJob.botCheckType, createdAt: lastJob.createdAt } : null);
        if (lastJob) {
          console.log("Last job result totals:", lastJob.payload?.result?.totals);
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
