/**
 * re_evaluate_sequential.js
 * CHẠY TÁI THẨM ĐỊNH TUẦN TỰ (STREAMING CURSOR - ZERO RAM SPIKE)
 * 
 * Đọc từng bản ghi qua Cursor (batchSize: 20), đánh giá lại theo bộ quy tắc mới,
 * cập nhật tuần tự từng hồ sơ, không bao giờ gom toàn bộ DB vào bộ nhớ RAM.
 */

const mongoose = require('mongoose');
const path = require('path');

async function main() {
  console.log('🚀 Bắt đầu quá trình tái thẩm định dữ liệu tuần tự...');
  
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const col = db.collection('clean_account_records');

  // Nạp rule engine chuẩn từ dist
  const { evaluateRecordReconciliationRule } = require('/opt/mxv-checklist/backend/dist/modules/bot-engine/helpers/tkgd-reconcile-rules.helper');

  // Đếm tổng số hồ sơ cần xử lý
  const query = { 'ketLuan.trangThai': { $in: ['LECH', 'CAN_KIEM_TRA'] } };
  const totalToProcess = await col.countDocuments(query);

  console.log(`📊 Tổng số hồ sơ đang LỆCH hoặc CẦN KIỂM TRA: ${totalToProcess} hồ sơ`);
  console.log(`⚙️  Chế độ: Đọc tuần tự qua MongoDB Cursor (batchSize: 20) - Bảo vệ RAM tối đa\n`);

  const cursor = col.find(query).batchSize(20);

  let processedCount = 0;
  let salvagedToKhop = 0;
  let updatedCount = 0;
  let stillLechCount = 0;

  for await (const doc of cursor) {
    processedCount++;

    const res = evaluateRecordReconciliationRule(doc);
    const oldStatus = doc.ketLuan?.trangThai;
    const oldErrors = doc.ketLuan?.danhSachLoi || [];

    const isStatusChanged = oldStatus !== res.finalStatus;
    const isErrorsChanged = JSON.stringify(oldErrors) !== JSON.stringify(res.finalErrors);

    if (isStatusChanged || isErrorsChanged) {
      updatedCount++;
      if (oldStatus === 'LECH' && res.finalStatus === 'KHOP') {
        salvagedToKhop++;
        console.log(`  [${processedCount}/${totalToProcess}] 🟢 CỨU THÀNH CÔNG: TK ${doc.maTKGD || doc._id} (LỆCH -> KHỚP)`);
      } else if (res.finalStatus === 'LECH') {
        stillLechCount++;
      }

      // Cập nhật tuần tự bản ghi này vào database
      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            'ketLuan.trangThai': res.finalStatus,
            'ketLuan.danhSachLoi': res.finalErrors,
            'ketLuan.reconciledAt': new Date(),
          },
        }
      );
    } else {
      if (res.finalStatus === 'LECH') {
        stillLechCount++;
      }
    }

    // In tiến trình định kỳ mỗi 50 hồ sơ
    if (processedCount % 50 === 0 || processedCount === totalToProcess) {
      const pct = ((processedCount / totalToProcess) * 100).toFixed(1);
      console.log(`⏳ Tiến độ: ${processedCount}/${totalToProcess} (${pct}%) | Cứu sang KHỚP: ${salvagedToKhop} | Đã cập nhật: ${updatedCount}`);
    }
  }

  console.log('\n================================================================');
  console.log('🎉 HOÀN TẤT TÁI THẨM ĐỊNH TUẦN TỰ TOÀN BỘ HỒ SƠ!');
  console.log(` - Tổng số hồ sơ đã duyệt qua  : ${processedCount}`);
  console.log(` - Số hồ sơ có thay đổi         : ${updatedCount}`);
  console.log(` - Số hồ sơ LỆCH chuyển sang KHỚP: 🟢 ${salvagedToKhop}`);
  console.log(` - Số hồ sơ LỆCH thực tế còn lại: 🔴 ${stillLechCount}`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Lỗi trong quá trình tái thẩm định:', err);
  process.exit(1);
});
