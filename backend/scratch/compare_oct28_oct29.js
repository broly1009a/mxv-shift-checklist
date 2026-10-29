const { Client } = require('c:/Users/hiepth/OneDrive - MERCANTILE EXCHANGE OF VIETNAM/Documents/Github/mxv-cqg-download-investigation/backend/node_modules/ssh2');
const conn = new Client();
conn.on('ready', () => {
  const code = `
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");
async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const col = mongoose.connection.db.collection("bot_jobs");

  // Tìm job vào lúc 04:18 ngày 28/10/2026
  const jobFast = await col.findOne({
    jobType: "CHECK_KLGD",
    createdAt: {
      $gte: new Date("2026-10-28T04:15:00Z"),
      $lte: new Date("2026-10-28T04:20:00Z")
    }
  });

  console.log("=== LOGS JOB NHANH NGÀY 28/10 (04:18) ===");
  if (jobFast) {
    console.log("ID:", jobFast._id.toString());
    (jobFast.logs || []).forEach(l => console.log(l));
  } else {
    console.log("Không tìm thấy job 04:18!");
  }

  // Tìm job vào lúc 01:27 ngày 29/10/2026
  const jobRecent = await col.findOne({
    jobType: "CHECK_KLGD",
    createdAt: {
      $gte: new Date("2026-10-29T01:25:00Z"),
      $lte: new Date("2026-10-29T01:30:00Z")
    }
  });

  console.log("\\n=== LOGS JOB GẦN ĐÂY NGÀY 29/10 (01:27) ===");
  if (jobRecent) {
    console.log("ID:", jobRecent._id.toString());
    (jobRecent.logs || []).forEach(l => console.log(l));
  }

  await mongoose.disconnect();
}
run().catch(console.error);
`;
  conn.exec(`cat << 'EOF' > /tmp/compare_oct28_oct29.js\n${code}\nEOF\nnode /tmp/compare_oct28_oct29.js`, (err, stream) => {
    let out = '';
    stream.on('data', d => out += d);
    stream.stderr.on('data', d => console.error(d.toString()));
    stream.on('close', () => {
      conn.end();
      console.log(out);
    });
  });
}).connect({ host: '10.0.0.26', port: 22, username: 'mxvadmin', password: 'MxV!,#2o26' });
