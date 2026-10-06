const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `node -e "
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const logs = await db.collection('system_logs').find({
    createdAt: {
      \\$gte: new Date('2026-10-05T01:02:00.000Z'),
      \\$lte: new Date('2026-10-05T01:04:35.000Z')
    }
  }).sort({ createdAt: 1 }).toArray();
  console.log(JSON.stringify(logs.map(l => ({
    time: l.createdAt,
    eventType: l.eventType,
    action: l.action,
    message: l.message,
    metadata: l.metadata
  })), null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
"`;
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
