const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  const code = `
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost:27017/mxv-shift-db').then(async () => {
      const db = mongoose.connection.db;
      const jobs = await db.collection('bot_jobs').find({
        createdAt: { $gte: new Date('2026-10-16T10:00:00Z'), $lte: new Date('2026-10-16T16:00:00Z') }
      }).sort({ createdAt: 1 }).toArray();
      console.log('Jobs between 17:00 and 23:00 GMT+7: count =', jobs.length);
      for (const j of jobs) {
        console.log('Job:', j._id.toString(), j.jobType, j.status, j.createdAt, j.updatedAt);
        if (j.error) console.log('  Error:', j.error);
        if (j.logs) {
          const msLogs = j.logs.filter(l => l.includes('MS'));
          console.log('  MS logs:', msLogs.slice(-3));
        }
      }
      process.exit(0);
    }).catch(e => { console.error(e); process.exit(1); });
  `;
  conn.exec(`node -e "${code.replace(/\n/g, ' ')}"`, (err, stream) => {
    if (err) throw err;
    let out = '';
    stream.on('data', d => out += d);
    stream.on('close', () => {
      console.log(out);
      conn.end();
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
