const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const jobs = await mongoose.connection.collection('bot_jobs').find({
        jobType: { $in: ['CHECK_KLGD', 'CHECK_DSGD_BEFORE_EOD'] }
      }).sort({ createdAt: -1 }).limit(10).toArray();

      for (const j of jobs) {
        console.log('=== JOB ===');
        console.log('ID:', j._id.toString());
        console.log('Type:', j.jobType);
        console.log('Status:', j.status);
        console.log('Created:', j.createdAt);
        console.log('Started:', j.startedAt);
        console.log('Completed:', j.completedAt);
        if (j.startedAt && j.completedAt) {
          const dur = (new Date(j.completedAt) - new Date(j.startedAt)) / 1000;
          console.log('Duration (s):', dur);
        }
        if (j.logs && j.logs.length > 0) {
          const cqgLogs = j.logs.filter(l => l.message && (
            l.message.includes('CQG') || 
            l.message.includes('Đã tải') || 
            l.message.includes('Bắt đầu') || 
            l.message.includes('Hoàn thành')
          ));
          console.log('Key Logs:');
          cqgLogs.forEach(l => console.log('  [' + (l.timestamp ? new Date(l.timestamp).toISOString() : '') + '] ' + l.message));
        }
      }
      await mongoose.disconnect();
    }
    run().catch(console.error);
  `;

  conn.exec(`cat << 'EOF' > /tmp/check_jobs.js\n${remoteScript}\nEOF\nnode /tmp/check_jobs.js`, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).on('error', err => console.error(err)).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
