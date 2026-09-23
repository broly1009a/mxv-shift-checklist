/**
 * reconcile_and_audit_records.ts
 * SCRIPT TÁI THẨM ĐỊNH TOÀN DIỆN & XUẤT NHẬT KÝ AUDIT CHO HỒ SƠ TKGD
 * 
 * Mục tiêu:
 * 1. Quét tuần tự toàn bộ hồ sơ (Cursor streaming, batchSize 50 - Zero RAM spike).
 * 2. Đánh giá lại bằng Tri-Party Reconciliation Rule Engine chuẩn doanh nghiệp.
 * 3. Cập nhật đồng bộ ketLuan và trangThaiDoiSoat, daDoiSoat vào MongoDB.
 * 4. Ghi file nhật ký Audit chi tiết (JSON & TXT) để phục vụ kiểm toán và lưu vết.
 * 5. Chỉ giữ lại trạng thái LỆCH cho các trường hợp lệch thực tế (tên, số CCCD, giả mạo...).
 */

import * as mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateRecordReconciliationRule } from '../modules/bot-engine/helpers/tkgd-reconcile-rules.helper';

interface AuditChangeItem {
  maTKGD: string;
  tenKhachHang?: string;
  maTVKD?: string;
  batchDate?: string;
  oldStatus: string;
  newStatus: string;
  oldErrors: string[];
  newErrors: string[];
  resolutionReason: string;
}

async function runReconcileAndAudit() {
  const startTime = new Date();
  const timestampStr = startTime.toISOString().replace(/[:.]/g, '-');
  
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU TÁI THẨM ĐỊNH TOÀN DIỆN & GHI AUDIT LOG TKGD');
  console.log(`⏰ Thời gian khởi chạy: ${startTime.toLocaleString('vi-VN')}`);
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  const conn = await mongoose.connect(mongoUri);
  const db = conn.connection.db;
  if (!db) {
    throw new Error('Không thể kết nối đến cơ sở dữ liệu MongoDB');
  }

  const col = db.collection('clean_account_records');
  const totalCount = await col.countDocuments();
  console.log(`📊 Tổng số hồ sơ trong CSDL: ${totalCount} bản ghi`);

  // Chuẩn bị thư mục logs
  const logsDir = path.resolve(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const logTxtPath = path.join(logsDir, `tkgd_audit_${timestampStr}.log`);
  const logJsonPath = path.join(logsDir, `tkgd_audit_${timestampStr}.json`);
  const logStream = fs.createWriteStream(logTxtPath, { flags: 'a', encoding: 'utf-8' });

  function writeLog(line: string) {
    console.log(line);
    logStream.write(line + '\n');
  }

  writeLog(`=== BÁO CÁO TÁI THẨM ĐỊNH TKGD [${timestampStr}] ===\n`);

  const cursor = col.find({}).batchSize(50);

  let processed = 0;
  let changedCount = 0;
  let rescuedToKhopCount = 0;
  let adjustedToCanktCount = 0;
  let remainingTrueLechCount = 0;
  let existingKhopCount = 0;

  const changesList: AuditChangeItem[] = [];
  const trueLechBreakdown: Record<string, number> = {};

  for await (const doc of cursor) {
    processed++;

    const res = evaluateRecordReconciliationRule(doc);
    const oldStatus = doc.ketLuan?.trangThai || doc.trangThaiDoiSoat || 'CHUA_XU_LY';
    const oldErrors: string[] = doc.ketLuan?.danhSachLoi || (doc.lyDoLoi ? [doc.lyDoLoi] : []);

    const isStatusChanged = oldStatus !== res.finalStatus;
    const isErrorsChanged = JSON.stringify(oldErrors) !== JSON.stringify(res.finalErrors);

    if (res.finalStatus === 'KHOP') {
      if (oldStatus === 'KHOP') {
        existingKhopCount++;
      } else {
        rescuedToKhopCount++;
      }
    } else if (res.finalStatus === 'CAN_KIEM_TRA') {
      adjustedToCanktCount++;
    } else if (res.finalStatus === 'LECH') {
      remainingTrueLechCount++;
      for (const err of res.finalErrors) {
        let cat = err;
        if (err.startsWith('Lệch họ tên')) cat = 'Lệch họ tên';
        else if (err.startsWith('Lệch số CCCD')) cat = 'Lệch số CCCD';
        else if (err.startsWith('Lệch ngày sinh')) cat = 'Lệch ngày sinh';
        else if (err.startsWith('Lệch ngày cấp')) cat = 'Lệch ngày cấp';
        else if (err.startsWith('Lệch giới tính')) cat = 'Lệch giới tính';
        else if (err.includes('M-System chưa')) cat = 'M-System chưa có số CCCD';
        else if (err.includes('Hồ sơ thiếu CCCD')) cat = 'Thiếu ảnh CCCD & HĐ';
        else if (err.includes('[PHÁT HIỆN CCCD BẤT THƯỜNG]')) cat = 'Cảnh báo CCCD bất thường / Giả mạo';

        trueLechBreakdown[cat] = (trueLechBreakdown[cat] || 0) + 1;
      }
    }

    if (isStatusChanged || isErrorsChanged) {
      changedCount++;

      let reason = 'Đồng bộ lại trạng thái đối soát theo Rule Engine mới';
      if (oldStatus !== 'KHOP' && res.finalStatus === 'KHOP') {
        if (oldErrors.some(e => e.includes('M-System chưa'))) {
          reason = 'M-System đã có dữ liệu CCCD hợp lệ, giải tỏa lỗi stale';
        } else if (oldErrors.some(e => e.includes('Lệch ngày cấp'))) {
          reason = 'Ưu tiên ngày cấp CCCD Bộ Công An, giải tỏa lỗi layout trùng ngày sinh của HĐ';
        } else if (oldErrors.some(e => e.includes('định dạng'))) {
          reason = 'Chuẩn hóa định dạng ngày tháng hợp lệ';
        } else {
          reason = 'Dữ liệu 3 bên khớp 100% sau khi thẩm định';
        }
      }

      changesList.push({
        maTKGD: doc.maTKGD || String(doc._id),
        tenKhachHang: doc.hopDong?.hoTen || doc.ms?.hoTen || doc.noiDungMail?.tenTaiKhoan,
        maTVKD: doc.maTVKD,
        batchDate: doc.batchDate,
        oldStatus,
        newStatus: res.finalStatus,
        oldErrors,
        newErrors: res.finalErrors,
        resolutionReason: reason,
      });

      // Cập nhật tuần tự vào MongoDB
      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            'ketLuan.trangThai': res.finalStatus,
            'ketLuan.danhSachLoi': res.finalErrors,
            'ketLuan.reconciledAt': new Date(),
            trangThaiDoiSoat: res.finalStatus,
            lyDoLoi: res.finalErrors.length > 0 ? res.finalErrors.join('; ') : '',
            daDoiSoat: true,
          },
        }
      );
    }

    // Tiến trình mỗi 200 bản ghi
    if (processed % 200 === 0 || processed === totalCount) {
      const pct = ((processed / totalCount) * 100).toFixed(1);
      console.log(`⏳ Đã duyệt: ${processed}/${totalCount} (${pct}%) | Cứu sang KHỚP: ${rescuedToKhopCount} | Đã cập nhật: ${changedCount}`);
    }
  }

  writeLog('\n================================================================');
  writeLog('📊 TỔNG KẾT KẾT QUẢ TÁI THẨM ĐỊNH TKGD');
  writeLog('================================================================');
  writeLog(`- Tổng số hồ sơ đã duyệt qua             : ${processed}`);
  writeLog(`- Số hồ sơ có thay đổi trạng thái/lỗi    : ${changedCount}`);
  writeLog(`- Số hồ sơ KHỚP ban đầu giữ nguyên       : ${existingKhopCount}`);
  writeLog(`- Số hồ sơ được CỨU SANG KHỚP THÀNH CÔNG : 🟢 ${rescuedToKhopCount}`);
  writeLog(`- Số hồ sơ thuộc diện CẦN KIỂM TRA       : 🟡 ${adjustedToCanktCount}`);
  writeLog(`- Số hồ sơ LỆCH THỰC TẾ CÒN LẠI          : 🔴 ${remainingTrueLechCount}`);
  writeLog('----------------------------------------------------------------');
  writeLog('🔍 Phân bố nguyên nhân trong các hồ sơ LỆCH THỰC TẾ:');
  for (const [cat, count] of Object.entries(trueLechBreakdown)) {
    writeLog(`   • ${cat.padEnd(45, ' ')}: ${count} hồ sơ`);
  }
  writeLog('================================================================\n');

  // Lưu file JSON chi tiết
  const auditReport = {
    generatedAt: new Date().toISOString(),
    executionDurationSeconds: ((Date.now() - startTime.getTime()) / 1000).toFixed(2),
    summary: {
      totalProcessed: processed,
      totalChanged: changedCount,
      rescuedToKhop: rescuedToKhopCount,
      canktCount: adjustedToCanktCount,
      remainingTrueLech: remainingTrueLechCount,
      trueLechBreakdown,
    },
    changes: changesList,
  };

  fs.writeFileSync(logJsonPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  logStream.end();

  console.log(`📁 File log chi tiết đã ghi:`);
  console.log(`   - Text Log: ${logTxtPath}`);
  console.log(`   - JSON Log: ${logJsonPath}`);

  await mongoose.disconnect();
  return auditReport;
}

if (require.main === module) {
  runReconcileAndAudit().then(() => {
    console.log('✅ Hoàn tất thành công!');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ Lỗi khi thực thi:', err);
    process.exit(1);
  });
}

export { runReconcileAndAudit };
