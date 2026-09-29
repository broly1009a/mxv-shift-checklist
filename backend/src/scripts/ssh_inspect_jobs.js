const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `node -e "
    const mongoose = require('mongoose');
    mongoose.connect('mongodb://localhost:27017/mxv-shift-checklist').then(async () => {
      const db = mongoose.connection.db;
      const j1 = await db.collection('bot_jobs').findOne({ _id: new mongoose.Types.ObjectId('6ab4a2f219e5e3ef94a5faa3') });
      console.log('=== JOB 6ab4a2f219e5e3ef94a5faa3 (11:11) ===');
      if (j1) {
        console.log('Status:', j1.status);
        console.log('Totals:', j1.payload?.result?.totals);
      } else {
        console.log('Not found');
      }

      const recent = await db.collection('bot_jobs')
        .find({ jobType: 'CHECK_KLGD' })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
      console.log('=== RECENT 3 CHECK_KLGD JOBS ON SERVER ===');
      for (const r of recent) {
        console.log('ID:', r._id, 'Status:', r.status, 'Created:', r.createdAt);
        console.log('Totals:', r.payload?.result?.totals);
      }
      mongoose.disconnect();
    });
  "`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => conn.end());
  });
});

conn.connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'Password123',
});
