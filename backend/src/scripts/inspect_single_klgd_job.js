const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const remoteCmd = `node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const shift = await mongoose.connection.db.collection("shift_logs").findOne({ _id: new mongoose.Types.ObjectId("6acfb54ca919c51bfe1a61dc") });
  if (!shift) {
    console.log("SHIFT NOT FOUND: 6acfb54ca919c51bfe1a61dc");
  } else {
    console.log("=== SHIFT ===", shift._id, shift.shiftName, shift.shiftDate, shift.status);
    console.log("Tasks:", shift.details?.map(d => ({ taskId: d.taskId, title: d.title, botCheckType: d.botCheckTypeSnapshot, status: d.status, isBotCheck: d.isBotCheckSnapshot })));
  }
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
