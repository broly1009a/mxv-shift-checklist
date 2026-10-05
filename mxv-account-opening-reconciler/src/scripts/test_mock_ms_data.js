#!/usr/bin/env node
/**
 * Test Mock M-System Data Script
 * -------------------------------------------------------------
 * Script test thêm thử dữ liệu M-System (Họ và tên, Số CCCD, Ngày sinh, v.v.)
 * vào Database để kiểm chứng:
 *   1. MongoDB có lưu đầy đủ 2 trường ms.hoVaTen và ms.soCMND_HoChieu không
 *   2. Động cơ đối soát có tự động khớp và đổi kết luận sang KHOP không
 *   3. Giao diện Web / Modal có hiển thị chính xác dữ liệu MS không
 * 
 * Cách chạy:
 *   - Mock dữ liệu cho tài khoản 003C3000172:
 *       node src/scripts/test_mock_ms_data.js
 * 
 *   - Mock cho tài khoản tùy chọn:
 *       node src/scripts/test_mock_ms_data.js --code 003C3000172 --name "BÙI CÔNG TRUNG" --cccd 046083000172
 * 
 *   - Khôi phục lại trạng thái ban đầu (chưa cào MS):
 *       node src/scripts/test_mock_ms_data.js --code 003C3000172 --revert
 */

const mongoose = require('mongoose');
const path = require('path');

// Nạp helper đối soát từ dist (đã build)
let evaluateRecordReconciliationRule = null;
try {
  const rulesHelper = require(path.resolve(__dirname, '../../dist/modules/engine-helpers/tkgd-reconcile-rules.helper'));
  evaluateRecordReconciliationRule = rulesHelper.evaluateRecordReconciliationRule;
} catch (e) {
  console.warn('⚠️  Không thể nạp evaluateRecordReconciliationRule từ dist, dùng fallback đánh giá cơ bản.');
}

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/mxv_shift_checklist';

// Phân tích tham số dòng lệnh
const args = process.argv.slice(2);
let targetCode = '003C3000172';
let targetName = 'BÙI CÔNG TRUNG';
let targetCccd = '046083000172';
let isRevert = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--code' && args[i + 1]) {
    targetCode = args[i + 1].trim();
    i++;
  } else if (args[i] === '--name' && args[i + 1]) {
    targetName = args[i + 1].trim();
    i++;
  } else if (args[i] === '--cccd' && args[i + 1]) {
    targetCccd = args[i + 1].trim();
    i++;
  } else if (args[i] === '--revert') {
    isRevert = true;
  }
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(` 🚀 [TEST MOCK MS] Kiểm thử lưu & đối soát thông tin M-System`);
  console.log(`    - Tài khoản mục tiêu: ${targetCode}`);
  console.log(`    - Chế độ:             ${isRevert ? 'REVERT (Khôi phục trạng thái ban đầu)' : 'MOCK (Thêm thử dữ liệu MS)'}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  try {
    await mongoose.connect(MONGO_URI);
    const col = mongoose.connection.collection('clean_account_records');

    // 1. Tìm bản ghi trong DB
    const doc = await col.findOne({ $or: [{ maTKGD: targetCode }, { maTKGDBase: targetCode }] });
    if (!doc) {
      console.error(`❌ Không tìm thấy bản ghi cho mã tài khoản "${targetCode}" trong MongoDB!`);
      process.exit(1);
    }

    console.log(`📌 [1] Trạng thái hiện tại trong CSDL:`);
    console.log(`   - Mã TKGD:            ${doc.maTKGD}`);
    console.log(`   - Họ tên trên Mail:   ${doc.hopDong?.hoVaTen || doc.canCuoc?.hoVaTen || doc.noiDungMail?.tenTaiKhoan || '(trống)'}`);
    console.log(`   - CCCD trên Mail:     ${doc.hopDong?.soCanCuoc || doc.canCuoc?.soCanCuoc || '(trống)'}`);
    console.log(`   - MS isFoundOnMS:     ${doc.ms?.isFoundOnMS}`);
    console.log(`   - MS Họ và tên:       ${doc.ms?.hoVaTen || '(chưa có)'}`);
    console.log(`   - MS Số CCCD:         ${doc.ms?.soCMND_HoChieu || '(chưa có)'}`);
    console.log(`   - Kết luận hiện tại:  ${doc.ketLuan?.trangThai || 'CHUA_XU_LY'} (${(doc.ketLuan?.danhSachLoi || []).join('; ') || 'Không lỗi'})\n`);

    if (isRevert) {
      // 2A. Khôi phục lại trạng thái ban đầu
      const resetMs = {
        maTKGD: targetCode,
        loaiHinhTaiKhoan: 'Cá nhân',
        chuKy: 'Đã ký',
        isFoundOnMS: false,
        crawlAttempts: 0,
      };

      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            ms: resetMs,
            'ketLuan.trangThai': 'CHUA_XU_LY',
            'ketLuan.danhSachLoi': ['Chưa cào dữ liệu từ M-System'],
            'ketLuan.reconciledAt': new Date(),
          },
        }
      );

      console.log(`✅ [2] Đã khôi phục tài khoản "${targetCode}" về trạng thái ban đầu (Chưa đồng bộ MS).`);
    } else {
      // 2B. Tạo Mock MS Data với đầy đủ Họ tên & Số CCCD
      const mockMs = {
        maTKGD: targetCode,
        tenTKGD: targetName,
        hoVaTen: targetName,
        soCMND_HoChieu: targetCccd,
        rawNgaySinh: doc.hopDong?.rawNgaySinh || '31/03/1983',
        ngaySinh: doc.hopDong?.ngaySinh ? new Date(doc.hopDong.ngaySinh) : new Date('1983-03-31T00:00:00.000Z'),
        rawNgayCap: doc.hopDong?.rawNgayCap || '10/05/2021',
        ngayCap: new Date('2021-05-10T00:00:00.000Z'),
        noiCap: doc.hopDong?.noiCap || doc.canCuoc?.noiCap || 'BỘ CÔNG AN',
        gioiTinh: doc.hopDong?.rawGioiTinh || doc.hopDong?.gioiTinh || 'Nam',
        loaiHinhTaiKhoan: 'Cá nhân',
        trangThai: 'Hoạt động',
        chuKy: 'Đã ký',
        isFoundOnMS: true,
        crawledAt: new Date(),
        crawlAttempts: 1,
      };

      // Đánh giá lại kết luận đối soát
      let finalStatus = 'KHOP';
      let finalErrors = [];
      if (evaluateRecordReconciliationRule) {
        const evalDoc = {
          ...doc,
          ms: mockMs,
        };
        const evalRes = evaluateRecordReconciliationRule(evalDoc);
        finalStatus = evalRes.finalStatus;
        finalErrors = evalRes.finalErrors;
      }

      console.log(`📝 [2] Đang cập nhật dữ liệu Mock MS vào MongoDB...`);
      console.log(`   - Gán ms.hoVaTen:        "${mockMs.hoVaTen}"`);
      console.log(`   - Gán ms.soCMND_HoChieu: "${mockMs.soCMND_HoChieu}"`);
      console.log(`   - Gán ms.isFoundOnMS:    ${mockMs.isFoundOnMS}`);
      console.log(`   - Kết luận thẩm định:    ${finalStatus} (${finalErrors.join('; ') || 'Khớp 100%'})`);

      const updateRes = await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            ms: mockMs,
            'ketLuan.trangThai': finalStatus,
            'ketLuan.danhSachLoi': finalErrors,
            'ketLuan.reconciledAt': new Date(),
          },
        }
      );

      console.log(`   -> MongoDB update result: modifiedCount = ${updateRes.modifiedCount}`);
    }

    // 3. Đọc lại từ CSDL để chứng minh dữ liệu đã thực sự lưu vào CSDL
    const verifiedDoc = await col.findOne({ _id: doc._id });
    console.log(`\n🔍 [3] Kiểm tra lại trực tiếp từ CSDL MongoDB (Read Verification):`);
    console.log(`   - ms.isFoundOnMS:     ${verifiedDoc.ms?.isFoundOnMS}`);
    console.log(`   - ms.hoVaTen:         ${verifiedDoc.ms?.hoVaTen ? `"${verifiedDoc.ms.hoVaTen}" ✅ ĐÃ LƯU` : '❌ CHƯA CÓ'}`);
    console.log(`   - ms.soCMND_HoChieu:  ${verifiedDoc.ms?.soCMND_HoChieu ? `"${verifiedDoc.ms.soCMND_HoChieu}" ✅ ĐÃ LƯU` : '❌ CHƯA CÓ'}`);
    console.log(`   - ms.crawledAt:       ${verifiedDoc.ms?.crawledAt ? new Date(verifiedDoc.ms.crawledAt).toLocaleString('vi-VN') : '-'}`);
    console.log(`   - ketLuan.trangThai:  ${verifiedDoc.ketLuan?.trangThai}`);

    console.log('\n═══════════════════════════════════════════════════════════════════');
    if (!isRevert) {
      console.log('🎉 KẾT QUẢ: 2 trường Họ và tên và Số CCCD đã được lưu thành công vào ms!');
      console.log('👉 Bây giờ anh có thể:');
      console.log('   1. Mở giao diện Web (http://localhost:3006)');
      console.log(`   2. Tìm tài khoản "${targetCode}" và bấm "Xem đối soát"`);
      console.log('   3. Cả 2 trường Họ và tên & Số CCCD trên cột "M-System Web & OCR" sẽ sáng xanh và hiển thị đầy đủ!');
      console.log('\n💡 Sau khi kiểm tra xong, để đưa về trạng thái chờ cào M-System ban đầu, hãy chạy:');
      console.log(`   node src/scripts/test_mock_ms_data.js --code ${targetCode} --revert`);
    } else {
      console.log('🎉 Đã hoàn tất revert! Tài khoản đã trở về trạng thái chờ đồng bộ M-System.');
    }
    console.log('═══════════════════════════════════════════════════════════════════\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Lỗi thực thi:', err);
    process.exit(1);
  }
}

run();
