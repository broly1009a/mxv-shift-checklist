const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const code = `
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const col = mongoose.connection.db.collection("bot_jobs");

  // Job f64bc12c (64s)
  const jobFast = await col.findOne({ _id: new mongoose.Types.ObjectId("6ae11494c1ce74d2f64bc12c") }) || (await col.find({ jobType: "CHECK_KLGD" }).skip(28).limit(1).toArray())[0];
  // Job c4d305cb (89s)
  const jobSlow = await col.findOne({ _id: new mongoose.Types.ObjectId("6ae29fff2c223769c4d305cb") }) || (await col.find({ jobType: "CHECK_KLGD" }).limit(1).toArray())[0];

  console.log("=== LOGS JOB NHANH (64s) ===");
  if (jobFast) {
    (jobFast.logs || []).forEach(l => console.log(l));
  }

  console.log("\\n=== LOGS JOB CHẬM (89s) ===");
  if (jobSlow) {
    (jobSlow.logs || []).forEach(l => console.log(l));
  }

  await mongoose.disconnect();
}
run().catch(console.error);
`;
  conn.exec(`cat << 'EOF' > /tmp/compare_two_jobs.js\n${code}\nEOF\nnode /tmp/compare_two_jobs.js`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => console.error(d.toString()));
    stream.on('close', () => {
      conn.end();
      console.log(out);
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
