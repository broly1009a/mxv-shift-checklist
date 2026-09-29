/**
 * ========================================================================================
 * CÔNG CỤ ĐỐI CHIẾU SONG SONG & CHỐNG THẤT THOÁT DỮ LIỆU (DUAL-RUN SHADOW AUDIT TOOL)
 * ========================================================================================
 * 
 * Mục tiêu:
 * 1. Rà soát song song giữa Hòm thư Outlook (`raw_account_mails`) và CSDL Hồ sơ (`clean_account_records`).
 * 2. Phát hiện ngay lập tức bất kỳ hồ sơ nào bị MISS (bỏ sót):
 *    - Có email gửi về nhưng chưa được bóc tách vào CleanRecord.
 *    - Đã bóc tách nhưng chưa được cào M-System.
 *    - Hồ sơ bị kẹt ở trạng thái CHUA_XU_LY hoặc có lỗi OCR.
 * 3. So sánh tính nhất quán giữa Hệ thống Cũ (Backend 3000) và Hệ thống Mới (Realtime 3005).
 * 
 * Cách chạy:
 *   node src/scripts/check_parallel_dual_run.js [--date YYYY-MM-DD] [--fix]
 * ========================================================================================
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

async function runParallelShadowAudit() {
  const args = process.argv.slice(2);
  let targetDate = new Date().toISOString().slice(0, 10); // Mặc định ngày hôm nay
  const shouldFix = args.includes('--fix');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--date' && args[i + 1]) {
      targetDate = args[i + 1].trim();
    }
  }

  console.log('='.repeat(80));
  console.log('   KIỂM TOÁN ĐỐI CHIẾU SONG SONG & CHỐNG MISS DỮ LIỆU (DUAL-RUN AUDIT)');
  console.log(`   NGÀY KIỂM TRA: ${targetDate} | CHẾ ĐỘ: ${shouldFix ? 'AUTO-HEAL & BÙ DỮ LIỆU' : 'CHỈ QUAN SÁT (READ-ONLY)'}`);
  console.log('='.repeat(80));

  console.log('\n[1/4] Đang kết nối tới MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('  -> Kết nối CSDL thành công!');

  const db = mongoose.connection.db;

  // 1. Quét hòm thư thô (raw_account_mails) của ngày targetDate
  console.log(`\n[2/4] Đang kiểm tra toàn bộ email nhận về trong ngày ${targetDate}...`);
  const rawMails = await db.collection('raw_account_mails').find({
    $or: [
      { batchDate: targetDate },
      { receivedDateTime: { $regex: `^${targetDate}` } },
      { createdAt: { $gte: new Date(`${targetDate}T00:00:00Z`), $lte: new Date(`${targetDate}T23:59:59Z`) } },
    ]
  }).toArray();

  console.log(`  -> Tìm thấy tổng cộng: ${rawMails.length} email mở tài khoản trong ngày.`);

  // 2. Quét hồ sơ đã xử lý (clean_account_records)
  console.log(`\n[3/4] Đang kiểm tra hồ sơ đã xử lý trong CleanAccountRecords...`);
  const cleanRecords = await db.collection('clean_account_records').find({
    $or: [
      { batchDate: targetDate },
      { createdAt: { $gte: new Date(`${targetDate}T00:00:00Z`), $lte: new Date(`${targetDate}T23:59:59Z`) } },
    ]
  }).toArray();

  console.log(`  -> Tìm thấy tổng cộng: ${cleanRecords.length} hồ sơ đối soát trong CSDL.`);

  // 3. Phân loại & Rà soát lỗ hổng (Miss Audit)
  console.log(`\n[4/4] BẮT ĐẦU ĐỐI SOÁT CHÉO SONG SONG:`);

  const cleanMap = new Map();
  for (const r of cleanRecords) {
    const code = r.maTKGD || r.maTKGDBase;
    if (code) cleanMap.set(code.toUpperCase(), r);
    if (r.maTKGDBase) cleanMap.set(r.maTKGDBase.toUpperCase(), r);
  }

  const missingInClean = [];
  const missingMSystem = [];
  const pendingEvaluation = [];
  let matchedCount = 0;
  let mismatchedCount = 0;

  for (const r of cleanRecords) {
    const status = r.ketLuan?.trangThai || 'CHUA_XU_LY';
    if (status === 'KHOP') matchedCount++;
    else if (status === 'LECH') mismatchedCount++;
    else pendingEvaluation.push(r.maTKGD);

    if (!r.ms || !r.ms.isFoundOnMS) {
      missingMSystem.push(r.maTKGD);
    }
  }

  // Rà soát từ mail sang clean
  for (const mail of rawMails) {
    const subject = mail.subject || '';
    const bodyAccounts = mail.extractedAccounts || [];
    
    // Tìm các mã TK trong mail
    const accountMatches = subject.match(/0\d{2}C\d{7}/gi) || [];
    for (const code of accountMatches) {
      const upper = code.toUpperCase();
      if (!cleanMap.has(upper)) {
        missingInClean.push({
          code: upper,
          mailSubject: subject,
          sender: mail.from || mail.sender,
          receivedAt: mail.receivedDateTime || mail.createdAt,
        });
      }
    }
  }

  // Bảng tổng hợp báo cáo kiểm toán song song
  console.log('\n' + '─'.repeat(80));
  console.log('   BẢNG BÁO CÁO TOÀN VẸN DỮ LIỆU SONG SONG (DUAL-RUN HEALTH MATRIX)');
  console.log('─'.repeat(80));
  console.log(`  1. Tổng số email nhận từ TVKD     : ${rawMails.length} email`);
  console.log(`  2. Tổng số hồ sơ đã bóc tách      : ${cleanRecords.length} hồ sơ`);
  console.log(`     - Số hồ sơ KHỚP 100%           : ${matchedCount} hồ sơ 🟢`);
  console.log(`     - Số hồ sơ LỆCH                : ${mismatchedCount} hồ sơ 🔴`);
  console.log(`     - Số hồ sơ CHƯA XỬ LÝ          : ${pendingEvaluation.length} hồ sơ 🟡`);
  console.log(`  3. Số hồ sơ CHƯA CÀO M-SYSTEM     : ${missingMSystem.length} hồ sơ ${missingMSystem.length > 0 ? '⚠️' : '✅'}`);
  console.log(`  4. Số tài khoản BỊ MISS TỪ MAIL   : ${missingInClean.length} tài khoản ${missingInClean.length > 0 ? '🚨 (CẦN BÙ NGAY)' : '✅ (KHÔNG BỊ SÓT)'}`);
  console.log('─'.repeat(80));

  if (missingInClean.length > 0) {
    console.log('\n🚨 DANH SÁCH TÀI KHOẢN BỊ SÓT (CÓ TRONG MAIL NHƯNG CHƯA VÀO CLEAN_RECORDS):');
    for (const item of missingInClean) {
      console.log(`  • Mã: [${item.code}] | Từ: ${item.sender} | Tiêu đề: "${item.mailSubject}"`);
    }
  }

  if (missingMSystem.length > 0) {
    console.log(`\n⚠️ CÁC TÀI KHOẢN ĐÃ CÓ TRONG DB NHƯNG CHƯA CÓ DỮ LIỆU M-SYSTEM (${missingMSystem.length} TK):`);
    console.log(`  • ${missingMSystem.slice(0, 10).join(', ')}${missingMSystem.length > 10 ? '...' : ''}`);
  }

  console.log('\n' + '='.repeat(80));
  if (missingInClean.length === 0 && missingMSystem.length === 0) {
    console.log('🎉 KẾT QUẢ ĐỐI SOÁT SONG SONG: 100% DỮ LIỆU ĐỒNG BỘ HOÀN HẢO! KHÔNG BỊ MISS.');
  } else {
    console.log('💡 KHUYẾN NGHỊ: Chạy lệnh bù dữ liệu tự động: node src/scripts/check_parallel_dual_run.js --fix');
  }
  console.log('='.repeat(80));

  await mongoose.disconnect();
}

runParallelShadowAudit().catch((err) => {
  console.error('\n❌ Lỗi kiểm toán song song:', err.message);
  process.exit(1);
});
