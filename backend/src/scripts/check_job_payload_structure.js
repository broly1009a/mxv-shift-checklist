const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  // Lấy một token từ DB hoặc query API bằng script nodejs nội bộ trên Ubuntu
  const cmd = `
    node -e "
      const { MongoClient } = require('mongodb');
      const dotenv = require('dotenv');
      dotenv.config({ path: '/opt/mxv-checklist/backend/.env' });
      const uri = process.env.MONGODB_URI;
      
      async function run() {
        const client = new MongoClient(uri);
        await client.connect();
        const db = client.db();
        
        // Tim job 6aab0b84cbae7980bc5366a8 hoặc job mới nhất của 2026-09-17
        const job = await db.collection('bot_jobs').findOne({ _id: new (require('mongodb').ObjectId)('6aab0b84cbae7980bc5366a8') });
        console.log('--- FOUND JOB 6aab0b84cbae7980bc5366a8 ---');
        console.log('Status:', job?.status);
        console.log('Payload result totals:', JSON.stringify(job?.payload?.result?.totals, null, 2));
        console.log('Keys of payload:', Object.keys(job?.payload || {}));
        if (job?.payload?.result) {
          console.log('Keys of payload.result:', Object.keys(job.payload.result));
        }

        await client.close();
      }
      run().catch(console.error);
    "
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
