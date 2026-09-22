const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({
        createdAt: {
          $gte: new Date("2026-09-17T17:00:00.000Z"),
          $lte: new Date("2026-09-18T17:00:00.000Z")
        }
      }).sort({ createdAt: 1 }).toArray();
      print("Tổng số jobs ngày 18.09: " + jobs.length);
      jobs.forEach(j => {
        print("Time: " + j.createdAt.toISOString() + " | Type: " + j.jobType + " | Status: " + j.status + " | Targets: " + JSON.stringify(j.payload?.targets || []));
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
