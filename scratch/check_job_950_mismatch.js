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
        const j = await db.collection("bot_jobs").findOne({ _id: new mongoose.Types.ObjectId("6abc790617fb960fe8132989") });
        console.log("Job 09:50 Mismatched:", JSON.stringify(j.payload?.result?.mismatchedTrades, null, 2));
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
