/**
 * Script Migration: Chuyển đổi toàn bộ TAG CHECK_DSGD_BEFORE_EOD -> CHECK_DSGD_BEFORE_EOD trong MongoDB
 *
 * Phạm vi tác động:
 *  1. Collection `templates`:
 *     - tasks.botCheckType: 'CHECK_DSGD_BEFORE_EOD' -> 'CHECK_DSGD_BEFORE_EOD'
 *  2. Collection `shift_logs`:
 *     - details.botCheckTypeSnapshot: 'CHECK_DSGD_BEFORE_EOD' -> 'CHECK_DSGD_BEFORE_EOD'
 *     - details.botCheckType: 'CHECK_DSGD_BEFORE_EOD' -> 'CHECK_DSGD_BEFORE_EOD'
 *  3. Collection `bot_jobs`:
 *     - jobType: 'CHECK_DSGD_BEFORE_EOD' -> 'CHECK_DSGD_BEFORE_EOD'
 *  4. Collection `trading_recon_logs`:
 *     - reconType: 'DSGD_BEFORE_EOD' -> 'DSGD_BEFORE_EOD'
 *
 * Chế độ an toàn:
 *  - Mặc định: DRY-RUN (Chỉ quét & đếm số lượng bản ghi bị ảnh hưởng, KHÔNG ghi vào DB)
 *  - Áp dụng thật: Truyền cờ `--apply` hoặc `--execute`
 *
 * Cách chạy:
 *  1. Dry-run: npx ts-node -r dotenv/config src/scripts/migrate_dsgd_before_eod_to_dsgd_before_eod.ts
 *  2. Execute: npx ts-node -r dotenv/config src/scripts/migrate_dsgd_before_eod_to_dsgd_before_eod.ts --apply
 */

import * as dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv_shift_checklist';
const isApply = process.argv.includes('--apply') || process.argv.includes('--execute');

async function runMigration() {
  console.log('================================================================================');
  console.log(`🚀 BẮT ĐẦU MIGRATION: CHECK_DSGD_BEFORE_EOD -> CHECK_DSGD_BEFORE_EOD`);
  console.log(`📡 MongoDB URI: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
  console.log(`🛡️  Chế độ: ${isApply ? '⚠️  EXECUTE (ÁP DỤNG THẬT VÀO DATABASE)' : '🔍 DRY-RUN (CHỈ XEM THỬ, KHÔNG GHI DỮ LIỆU)'}`);
  console.log('================================================================================\n');

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Không thể kết nối đến Database!');
  }

  // 1. Quét Collection `templates`
  const templatesColl = db.collection('templates');
  const templatesAffected = await templatesColl.countDocuments({
    $or: [
      { 'tasks.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
      { 'tasks.subTasks.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
    ],
  });
  console.log(`1. Templates ca trực:`);
  console.log(`   • Phát hiện ${templatesAffected} template có task cấu hình CHECK_DSGD_BEFORE_EOD.`);

  if (isApply && templatesAffected > 0) {
    // Update tasks cấp 1
    const res1 = await templatesColl.updateMany(
      { 'tasks.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
      { $set: { 'tasks.$[elem].botCheckType': 'CHECK_DSGD_BEFORE_EOD' } },
      { arrayFilters: [{ 'elem.botCheckType': 'CHECK_DSGD_BEFORE_EOD' }] },
    );
    // Update subTasks cấp 2 nếu có
    const res2 = await templatesColl.updateMany(
      { 'tasks.subTasks.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
      { $set: { 'tasks.$[].subTasks.$[subElem].botCheckType': 'CHECK_DSGD_BEFORE_EOD' } },
      { arrayFilters: [{ 'subElem.botCheckType': 'CHECK_DSGD_BEFORE_EOD' }] },
    );
    console.log(`   -> Đã cập nhật thành công ${res1.modifiedCount + res2.modifiedCount} template.`);
  }

  // 2. Quét Collection `shift_logs`
  const shiftLogsColl = db.collection('shift_logs');
  const shiftLogsAffected = await shiftLogsColl.countDocuments({
    $or: [
      { 'details.botCheckTypeSnapshot': 'CHECK_DSGD_BEFORE_EOD' },
      { 'details.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
    ],
  });
  console.log(`\n2. Ca trực thực tế (shift_logs):`);
  console.log(`   • Phát hiện ${shiftLogsAffected} ca trực có chứa task CHECK_DSGD_BEFORE_EOD.`);

  if (isApply && shiftLogsAffected > 0) {
    const resSnap = await shiftLogsColl.updateMany(
      { 'details.botCheckTypeSnapshot': 'CHECK_DSGD_BEFORE_EOD' },
      { $set: { 'details.$[elem].botCheckTypeSnapshot': 'CHECK_DSGD_BEFORE_EOD' } },
      { arrayFilters: [{ 'elem.botCheckTypeSnapshot': 'CHECK_DSGD_BEFORE_EOD' }] },
    );
    const resType = await shiftLogsColl.updateMany(
      { 'details.botCheckType': 'CHECK_DSGD_BEFORE_EOD' },
      { $set: { 'details.$[elem].botCheckType': 'CHECK_DSGD_BEFORE_EOD' } },
      { arrayFilters: [{ 'elem.botCheckType': 'CHECK_DSGD_BEFORE_EOD' }] },
    );
    console.log(`   -> Đã cập nhật thành công ${resSnap.modifiedCount} ca trực.`);
  }

  // 3. Quét Collection `bot_jobs`
  const botJobsColl = db.collection('bot_jobs');
  const botJobsAffected = await botJobsColl.countDocuments({
    jobType: 'CHECK_DSGD_BEFORE_EOD',
  });
  console.log(`\n3. Lịch sử lượt chạy Bot (bot_jobs):`);
  console.log(`   • Phát hiện ${botJobsAffected} job bot có jobType = 'CHECK_DSGD_BEFORE_EOD'.`);

  if (isApply && botJobsAffected > 0) {
    const resJobs = await botJobsColl.updateMany(
      { jobType: 'CHECK_DSGD_BEFORE_EOD' },
      { $set: { jobType: 'CHECK_DSGD_BEFORE_EOD' } },
    );
    console.log(`   -> Đã cập nhật thành công ${resJobs.modifiedCount} bản ghi bot_jobs.`);
  }

  // 4. Quét Collection `trading_recon_logs`
  const reconLogsColl = db.collection('trading_recon_logs');
  const reconLogsAffected = await reconLogsColl.countDocuments({
    reconType: { $in: ['DSGD_BEFORE_EOD', 'CHECK_DSGD_BEFORE_EOD'] },
  });
  console.log(`\n4. Nhật ký đối chiếu (trading_recon_logs):`);
  console.log(`   • Phát hiện ${reconLogsAffected} bản ghi đối chiếu Dsgd-Before-EOD.`);

  if (isApply && reconLogsAffected > 0) {
    const resRecon = await reconLogsColl.updateMany(
      { reconType: { $in: ['DSGD_BEFORE_EOD', 'CHECK_DSGD_BEFORE_EOD'] } },
      { $set: { reconType: 'DSGD_BEFORE_EOD' } },
    );
    console.log(`   -> Đã cập nhật thành công ${resRecon.modifiedCount} bản ghi trading_recon_logs.`);
  }

  console.log('\n================================================================================');
  if (isApply) {
    console.log(' Hoàn tất 100% Migration! Toàn bộ Database đã chuyển sang CHECK_DSGD_BEFORE_EOD.');
  } else {
    console.log(' Kết thúc kiểm thử Dry-Run (Chưa có dữ liệu nào bị thay đổi).');
    console.log('👉 Để thực hiện cập nhật thật, hãy chạy:');
    console.log('   npx ts-node -r dotenv/config src/scripts/migrate_dsgd_before_eod_to_dsgd_before_eod.ts --apply');
  }
  console.log('================================================================================\n');

  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('❌ Lỗi khi thực thi Migration:', err);
  process.exit(1);
});
