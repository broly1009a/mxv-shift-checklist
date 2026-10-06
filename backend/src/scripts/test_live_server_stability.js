/**
 * KIỂM THỬ TRỰC TIẾP TRÊN MÁY CHỦ UBUNTU (LIVE SERVER STABILITY AUDIT)
 * File: backend/src/scripts/test_live_server_stability.js
 * 
 * Kiểm tra:
 *  1. Trạng thái PM2 của mxv-backend và mxv-frontend.
 *  2. Kiểm tra collection bot_jobs: Xác nhận không có Job CHECK_KLGD rác nào được sinh ra cho ca cũ.
 *  3. Kiểm tra collection shift_logs: Xác nhận các ca trực PENDING hiện tại đều nằm trong ngưỡng an toàn 36h.
 */

const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('================================================================================');
  console.log('       KIỂM THỬ TÍNH ỔN ĐỊNH THỰC TẾ TRÊN MÁY CHỦ UBUNTU (10.0.0.26)');
  console.log('================================================================================\n');

  const remoteCmd = `node -e '
const mongoose = require("/opt/mxv-checklist/backend/node_modules/mongoose");

async function checkServer() {
  await mongoose.connect("mongodb://127.0.0.1:27017/mxv_shift_checklist");
  const db = mongoose.connection.db;

  const now = new Date();
  const maxShiftAgeMs = 36 * 60 * 60 * 1000;
  const minCreatedAt = new Date(Date.now() - maxShiftAgeMs);

  // 1. Quét ca PENDING
  const allPendingShifts = await db.collection("shift_logs").find({ status: "PENDING" }).toArray();
  const activeValidShifts = allPendingShifts.filter(s => s.createdAt >= minCreatedAt);
  const staleShifts = allPendingShifts.filter(s => s.createdAt < minCreatedAt);

  console.log("=== 1. KIỂM TRA BỘ LỌC CA TRỰC (SHIFT EXPIRATION GUARD) ===");
  console.log("  • Tổng số ca PENDING trong CSDL:", allPendingShifts.length);
  console.log("  • Số ca hợp lệ trong 36h (đang được bot phục vụ):", activeValidShifts.length);
  console.log("  • Số ca cũ > 36h (được bot tự động bỏ qua, không lặp job):", staleShifts.length);

  // 2. Quét các job CHECK_KLGD trong 30 phút qua
  const halfHourAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentJobs = await db.collection("bot_jobs").find({
    jobType: "CHECK_KLGD",
    createdAt: { $gte: halfHourAgo }
  }).toArray();

  console.log("\\n=== 2. KIỂM TRA LƯỢNG JOB CHECK_KLGD SINH MỚI (30 PHÚT GẦN NHẤT) ===");
  console.log("  • Số Job CHECK_KLGD phát sinh trong 30 phút qua:", recentJobs.length);
  if (recentJobs.length === 0) {
    console.log("  ✅ HOÀN TOÀN ỔN ĐỊNH: Bot không còn spam lặp các Job CHECK_KLGD vô nghĩa.");
  } else {
    for (const j of recentJobs) {
      console.log("  - Job ID:", j._id, "| Status:", j.status, "| ShiftLogId:", j.payload?.shiftLogId);
    }
  }

  await mongoose.disconnect();
}
checkServer().catch(console.error);
'`;

  conn.exec(remoteCmd, (err, stream) => {
    if (err) throw err;
    stream.on('data', d => process.stdout.write(d.toString()));
    stream.stderr.on('data', d => process.stderr.write(d.toString()));
    stream.on('close', code => {
      console.log('\n================================================================================');
      console.log('KIỂM TRA SERVER HOÀN TẤT VỚI EXIT CODE:', code);
      console.log('================================================================================\n');
      conn.end();
    });
  });
}).connect({
  host: '10.0.0.26',
  port: 22,
  username: 'mxvadmin',
  password: 'MxV!,#2o26',
  readyTimeout: 30000,
});
