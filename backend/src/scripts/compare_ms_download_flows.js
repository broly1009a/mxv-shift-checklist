const path = require('path');
const { Client } = require(path.join(__dirname, '../../node_modules/ssh2'));

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({
        jobType: "RPA_DOWNLOAD_REPORTS"
      }).sort({ createdAt: -1 }).limit(10).toArray();

      print("Tìm thấy " + jobs.length + " jobs:");
      jobs.forEach(j => {
        print("--------------------------------------------------");
        print("ID: " + j._id + " | Type: " + j.jobType + " | Status: " + j.status + " | Created: " + j.createdAt);
        print("Targets: " + JSON.stringify(j.payload?.targets));
        const matchedLogs = (j.logs || []).filter(l => l.match(/TLKQ|TLQ|Copied.*TLK/i));
        print("Matched Logs (" + matchedLogs.length + "):");
        matchedLogs.forEach(l => print("   " + l));
      });

      print("\n=== 2. TÌM CÁC TASK TRONG SHIFT_LOGS NGÀY 18.09 CÓ LIÊN QUAN ĐẾN BACKUP MS ===");
      const shifts = db.shift_logs.find({
        shiftDate: { $regex: /2026-09-18|18\/09\/2026/ }
      }).toArray();
      print("Tìm thấy " + shifts.length + " ca trực ngày 18.09:");
      shifts.forEach(s => {
        print("Ca: " + s.shiftDate + " | ShiftSlot: " + s.shiftSlotId + " | Details count: " + (s.details ? s.details.length : 0));
        (s.details || []).forEach(d => {
          if (d.taskName && d.taskName.match(/backup|tải|ms|m-system|rpa/i)) {
            print("   -> Task: " + d.taskId + " | Name: " + d.taskName + " | BotCheckType: " + d.botCheckType + " | Status: " + d.status);
          }
        });
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
