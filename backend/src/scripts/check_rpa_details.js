const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({
        jobType: "RPA_DOWNLOAD_REPORTS"
      }).sort({ createdAt: -1 }).limit(8).toArray();

      print("--- CÁC JOBS RPA_DOWNLOAD_REPORTS GẦN ĐÂY ---");
      jobs.forEach(j => {
        print("JobId: " + j._id + " | Status: " + j.status + " | Created: " + j.createdAt);
        print("  Targets: " + JSON.stringify(j.payload?.targets));
        print("  Logs count: " + (j.logs ? j.logs.length : 0));
        if (j.logs && j.logs.length > 0) {
          print("  Last 3 logs: " + JSON.stringify(j.logs.slice(-3)));
        }
      });
    '
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) {
      console.error('Exec error:', err);
      conn.end();
      return;
    }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', (err) => {
  console.error('Conn error:', err);
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
