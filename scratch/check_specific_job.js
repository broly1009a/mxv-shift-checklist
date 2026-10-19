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
    mongosh mxv_shift_checklist --eval '
      const job = db.bot_jobs.findOne({ _id: ObjectId("6ad237c831a9aa9799e5a144") });
      print("RESULT TOTALS:");
      printjson(job.payload?.result?.totals);
      print("MISMATCHED TRADES COUNT: " + (job.payload?.result?.mismatchedTrades?.length || 0));
      printjson(job.payload?.result?.mismatchedTrades);
      print("DETAILS TOTALS:");
      printjson(job.payload?.result?.details?.totals);
      print("OPTIONS:");
      printjson(job.payload?.options);
      print("PARAMETERS:");
      printjson(job.payload?.parameters);
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
