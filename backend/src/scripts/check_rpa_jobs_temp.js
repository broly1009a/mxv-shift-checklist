const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({ jobType: "RPA_DOWNLOAD_REPORTS" }).sort({ createdAt: -1 }).limit(3).toArray();
      jobs.forEach(j => {
        print("==================================================");
        print("ID: " + j._id + " | Status: " + j.status + " | Created: " + j.createdAt);
        print("Error: " + j.error);
        print("Targets: " + JSON.stringify(j.payload?.targets));
        print("Logs count: " + (j.logs ? j.logs.length : 0));
        print("Last 15 Logs:");
        (j.logs || []).slice(-15).forEach(l => print("  " + l));
      });
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
