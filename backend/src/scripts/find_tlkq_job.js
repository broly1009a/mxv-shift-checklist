const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const job = db.bot_jobs.findOne({
        jobType: "RPA_DOWNLOAD_REPORTS",
        status: "COMPLETED",
        "payload.targets": "TLQHSKQ"
      }, { sort: { createdAt: -1 } });
      if (!job) {
        print("Không tìm thấy job COMPLETED với TLQHSKQ, tìm theo logs:");
        const job2 = db.bot_jobs.findOne({
          logs: { $regex: /TLKQHSKQ/i }
        }, { sort: { createdAt: -1 } });
        if (job2) {
          print("ID: " + job2._id + " | Status: " + job2.status + " | Created: " + job2.createdAt);
          job2.logs.forEach(l => { if (l.includes("TLKQ") || l.includes("TLQ")) print("  " + l); });
        }
      } else {
        print("Tìm thấy job:");
        print("ID: " + job._id + " | Created: " + job.createdAt);
        job.logs.forEach(l => { if (l.includes("TLKQ") || l.includes("TLQ")) print("  " + l); });
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
