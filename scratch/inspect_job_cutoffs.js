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
      const fs = require("fs");
      const path = require("path");
      
      const klgdService = require("/opt/mxv-checklist/backend/dist/modules/trading-ops/services/klgd-recon.service");
      const KlgdReconService = klgdService.KlgdReconService;

      // Instantiate or inspect the job payload details
      const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
      (async () => {
        await mongoose.connect("mongodb://localhost:27017/mxv_shift_checklist");
        const job = await mongoose.connection.db.collection("bot_jobs").findOne({ _id: new mongoose.Types.ObjectId("6ad237c831a9aa9799e5a144") });
        console.log("Job details.pendingSyncTrades count:", job.payload?.result?.details?.pendingSyncTrades?.length);
        console.log("Job details.pendingSyncTrades:", JSON.stringify(job.payload?.result?.details?.pendingSyncTrades, null, 2));
        console.log("Job details.cutoffTime:", job.payload?.result?.details?.cutoffTime);
        console.log("Job details.cqgCutoffTime:", job.payload?.result?.details?.cqgCutoffTime);
        console.log("Job details.checkTime:", job.payload?.result?.details?.checkTime);
        console.log("Job details.sessionStart:", job.payload?.result?.details?.sessionStart);

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
