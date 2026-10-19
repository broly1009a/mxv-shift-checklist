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
      (async () => {
        await mongoose.connect("mongodb://localhost:27017/mxv_shift_checklist");
        const job = await mongoose.connection.db.collection("bot_jobs").findOne({ _id: new mongoose.Types.ObjectId("6ad237c831a9aa9799e5a144") });
        console.log("Job keys:", Object.keys(job));
        console.log("Payload keys:", Object.keys(job.payload || {}));
        console.log("Payload result keys:", Object.keys(job.payload?.result || {}));
        console.log("Payload result:", JSON.stringify({
          ...job.payload?.result,
          logs: undefined
        }, null, 2));

        // Find trading_recon_logs if any
        const reconLogs = await mongoose.connection.db.collection("trading_recon_logs").find().sort({ createdAt: -1 }).limit(3).toArray();
        console.log("Recon logs in local db:", reconLogs.length);
        if (reconLogs.length > 0) {
          console.log("Latest recon log:", JSON.stringify(reconLogs[0], null, 2));
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
