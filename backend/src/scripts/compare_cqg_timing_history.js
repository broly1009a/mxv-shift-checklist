const { Client } = require('ssh2');

async function main() {
  const conn = new Client();
  conn.on('ready', () => {
    const remoteCmd = `node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const db = mongoose.connection.db;

  const jobs = await db.collection("bot_jobs").find({
    jobType: "CHECK_KLGD"
  }).sort({ createdAt: -1 }).limit(10).toArray();

  console.log("===THỐNG KÊ THỜI GIAN TẢI CQG CÁC LẦN GẦN ĐÂY===");
  jobs.forEach((j, idx) => {
    const logs = j.logs || [];
    const startLog = logs.find(l => l.includes("Mở đồng thời 2 tài khoản CQG1 & CQG2") || l.includes("CQG  [Bước 1: Chuẩn bị]"));
    const downloadDoneLog = logs.find(l => l.includes("CQG  Đã tải:") || l.includes("Đã tải: FR1.xlsx"));
    const mergeDoneLog = logs.find(l => l.includes("Ghép file CQG hoàn tất") || l.includes("Đã hoàn tất và đóng trình duyệt CQG"));

    let downloadSec = "N/A";
    let mergeSec = "N/A";
    let totalCqgSec = "N/A";

    if (startLog && downloadDoneLog) {
      const tStart = new Date(startLog.substring(1, 25)).getTime();
      const tDown = new Date(downloadDoneLog.substring(1, 25)).getTime();
      downloadSec = ((tDown - tStart) / 1000).toFixed(1);

      if (mergeDoneLog) {
        const tMerge = new Date(mergeDoneLog.substring(1, 25)).getTime();
        mergeSec = ((tMerge - tDown) / 1000).toFixed(1);
        totalCqgSec = ((tMerge - tStart) / 1000).toFixed(1);
      }
    }

    console.log("Lần " + (idx + 1) + " | ID: " + j._id + " | Giờ chạy: " + new Date(j.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }));
    console.log("  - Trạng thái Job: " + j.status + " | Tổng Duration Job: " + (j.durationMs ? (j.durationMs/1000).toFixed(1) + "s" : "N/A"));
    console.log("  - Thời gian tải 8 file (CQG1 + CQG2 song song): " + downloadSec + " giây");
    console.log("  - Thời gian ghép 3 cặp file thô (FR, OP, PS): " + mergeSec + " giây");
    console.log("  - Tổng thời gian hoàn tất CQG: " + totalCqgSec + " giây");
    if (downloadDoneLog) {
      console.log("  - Danh sách file tải: " + downloadDoneLog.split("CQG  ")[1]);
    }
    console.log("");
  });

  await mongoose.disconnect();
}
run().catch(console.error);
'`;

    let stdout = '';
    conn.exec(remoteCmd, { maxBuffer: 50 * 1024 * 1024 }, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        return;
      }
      stream.on('data', d => stdout += d.toString());
      stream.stderr.on('data', d => console.error(d.toString()));
      stream.on('close', () => {
        conn.end();
        console.log(stdout);
      });
    });
  }).connect({
    host: '10.0.0.26',
    port: 22,
    username: 'mxvadmin',
    password: 'MxV!,#2o26',
    readyTimeout: 15000,
  });
}
main().catch(console.error);
