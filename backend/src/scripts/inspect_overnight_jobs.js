const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `
    mongosh mxv_shift_checklist --quiet --eval '
      const jobs = db.bot_jobs.find({
        createdAt: {
          $gte: new Date("2026-09-28T17:00:00.000Z"),
          $lte: new Date("2026-09-29T00:30:00.000Z")
        }
      }).sort({ createdAt: 1 }).toArray();

      print("Found " + jobs.length + " jobs overnight (00:00 - 07:30 VN):");
      jobs.forEach(j => {
        print("----------------------------------");
        print("ID: " + j._id + " | Type: " + (j.botCheckType || j.jobType) + " | Status: " + j.status + " | Time: " + j.createdAt);
        print("Payload: " + JSON.stringify({
          targetDate: j.payload?.targetDate,
          sessionDay: j.payload?.sessionDay,
          date: j.payload?.date,
          passed: j.payload?.result?.passed,
          totals: j.payload?.result?.totals,
          mismatchedCount: j.payload?.result?.mismatchedTrades?.length
        }));
        if (j.payload?.result?.mismatchedTrades?.length > 0) {
          print("First 3 mismatches: " + JSON.stringify(j.payload.result.mismatchedTrades.slice(0, 3)));
        }
      });
    '
  `;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26'
});
