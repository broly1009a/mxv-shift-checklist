const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    "mongosh mxv_shift_checklist --quiet --eval 'JSON.stringify(db.bot_jobs.find({ jobType: \"RPA_DOWNLOAD_REPORTS\" }).sort({ createdAt: -1 }).limit(5).toArray())'",
    (err, stream) => {
      let out = '';
      stream.on('data', (d) => (out += d));
      stream.on('close', () => {
        const jobs = JSON.parse(out);
        for (const j of jobs) {
          console.log(`Job: ${j._id}, Status: ${j.status}, CreatedAt: ${j.createdAt}, Payload: ${JSON.stringify(j.payload)}`);
          if (j.logs) {
            const copyLogs = j.logs.filter(l => l.includes('Backup MS folder') || l.includes('Copied'));
            console.log(`  Copy logs:`, copyLogs);
          }
        }
        conn.end();
      });
    }
  );
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
