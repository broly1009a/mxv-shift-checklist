const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
  conn.exec("cd /opt/mxv-checklist/backend && node -e 'const mongoose = require(\"mongoose\"); async function f() { await mongoose.connect(\"mongodb://127.0.0.1:27017/mxv_shift_checklist\"); const docs = await mongoose.connection.collection(\"clean_account_records\").find({ maTKGD: { $regex: \"003C2333888\" } }).toArray(); console.log(JSON.stringify(docs.map(d => ({ _id: d._id, maTKGD: d.maTKGD, batchDate: d.batchDate, createdAt: d.createdAt, updatedAt: d.updatedAt, ketLuan: d.ketLuan, canCuoc: d.canCuoc, files: d.files })), null, 2)); await mongoose.disconnect(); } f();'", (err, stream) => {
    if (err) { console.error(err); conn.end(); return; }
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', () => conn.end());
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
});
