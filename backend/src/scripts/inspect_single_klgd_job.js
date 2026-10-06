const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const s = await mongoose.connection.db.collection("shift_logs").findOne({});
  console.log("SHIFT KEYS:", Object.keys(s));
  console.log("SAMPLE SHIFT:", JSON.stringify({
    _id: s._id,
    date: s.date,
    shift: s.shift,
    shiftName: s.shiftName,
    templateName: s.templateName,
    status: s.status,
    totalTasks: s.details?.length
  }, null, 2));
  await mongoose.disconnect();
}
run().catch(console.error);
'`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
