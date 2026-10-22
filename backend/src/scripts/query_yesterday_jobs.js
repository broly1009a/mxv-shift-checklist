const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteScript = `
    const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
    async function run() {
      await mongoose.connect('mongodb://127.0.0.1:27017/mxv_shift_checklist');
      const jobs = await mongoose.connection.collection('bot_jobs').find({
        jobType: { $in: ['CHECK_KLGD', 'CHECK_DSGD_BEFORE_EOD'] },
        status: 'COMPLETED',
        createdAt: { $lt: new Date('2026-10-22T00:00:00.000Z') }
      }).sort({ createdAt: -1 }).limit(10).toArray();

      console.log('Found yesterday completed jobs:', jobs.length);
      for (const j of jobs) {
        console.log('=== YESTERDAY JOB ===');
        console.log('ID:', j._id.toString());
        console.log('Type:', j.jobType);
        console.log('Created:', j.createdAt);
        console.log('Completed:', j.completedAt);
        if (j.createdAt && j.completedAt) {
          const dur = (new Date(j.completedAt) - new Date(j.createdAt)) / 1000;
          console.log('Duration (s):', dur);
        }
        if (j.logs && j.logs.length > 0) {
          console.log('Log count:', j.logs.length);
          const sampleLogs = j.logs.filter(l => l.message && (
            l.message.includes('CQG') || 
            l.message.includes('Đã tải') ||
            l.message.includes('Ghép')
          ));
          console.log('Sample logs:');
          sampleLogs.slice(0, 10).forEach(l => console.log('  [' + (l.timestamp ? new Date(l.timestamp).toISOString() : '') + '] ' + l.message));
        }
      }
      await mongoose.disconnect();
    }
    run().catch(console.error);
  `;

  conn.exec(`cat << 'EOF' > /tmp/check_yesterday_jobs.js\n${remoteScript}\nEOF\nnode /tmp/check_yesterday_jobs.js`, (err, stream) => {
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
