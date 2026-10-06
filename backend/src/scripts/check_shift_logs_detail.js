const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmd = `node -e "
const mongoose = require('/opt/mxv-checklist/backend/node_modules/mongoose');
async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist');
  const db = mongoose.connection.db;
  const ids = ['6abfe34c8efdf4107b682aa2', '6ac2864c8efdf4107b69c880'].map(id => new mongoose.Types.ObjectId(id));
  const shifts = await db.collection('shift_logs').find({ _id: { \\$in: ids } }).toArray();
  console.log(JSON.stringify(shifts.map(s => ({
    id: s._id,
    shiftDate: s.shiftDate,
    status: s.status,
    templateTitle: s.templateTitleSnapshot || s.templateTitle,
    createdAt: s.createdAt,
    completedAt: s.completedAt
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
