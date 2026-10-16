/**
 * test_check_dsgd_before_eod_m_drive.js
 *
 * Script kiểm thử tính năng CheckDSGDBeforeEOD với dữ liệu thực tế từ:
 * M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong
 *
 * Lệnh chạy từ terminal:
 *   node src/scripts/test_check_dsgd_before_eod_m_drive.js
 * hoặc:
 *   node src/scripts/test_check_dsgd_before_eod_m_drive.js --date 2026-10-08 --suffix 172842
 */

const path = require('path');
const fs = require('fs');

// Nạp service đã build từ dist/
const { DsgdBeforeEodService } = require('../../dist/modules/trading-ops/services/dsgd-before-eod.service');

// Phân tích tham số dòng lệnh
const args = process.argv.slice(2);
let targetDate = '2026-10-08';
let timeSuffix = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--date' && args[i + 1]) targetDate = args[i + 1];
  if (args[i] === '--suffix' && args[i + 1]) timeSuffix = args[i + 1];
}

console.log('================================================================================');
console.log('  KIỂM THỬ CHECK DSGD TRƯỚC EOD (CheckDSGDBeforeEOD) VỚI DỮ LIỆU Ổ M:');
console.log('================================================================================');
console.log(`• Ngày phiên kiểm tra : ${targetDate} (exactDate = true)`);
console.log(`• Suffix snapshot     : ${timeSuffix || '(Tự động lấy file snapshot mới nhất)'}`);
console.log(`• Thư mục gốc dữ liệu : M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong`);
console.log('--------------------------------------------------------------------------------\n');

// Mock SystemSettingsService trỏ thẳng vào ổ M:
const mockSettingsService = {
  getSetting: async (key, def) => {
    if (key === 'bot_backup_path_ms') {
      return 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures';
    }
    if (key === 'bot_backup_path_acm') {
      return 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures';
    }
    return def;
  },
};

const service = new DsgdBeforeEodService(mockSettingsService);

async function main() {
  const startTime = Date.now();
  try {
    const result = await service.runAutoCheckDSGDBeforeEOD({
      tradingDate: targetDate,
      timeSuffix: timeSuffix || undefined,
      exactDate: true,
    });

    const elapsed = Date.now() - startTime;

    console.log('--- 1. CÁC TỆP TIN ĐÃ TỰ ĐỘNG PHÁT HIỆN & ĐỌC ---');
    console.log(`• DSGD Gốc (M-System) : ${result.filesFound?.dsgdOriginal || 'Không tìm thấy'}`);
    console.log(`• DSGD Snapshot       : ${result.filesFound?.dsgdTemp || 'Không tìm thấy'}`);
    console.log(`• Straits ACM         : ${result.filesFound?.acmTrades || 'Không có file (hoặc không phát sinh GD)'}`);
    console.log('');

    console.log('--- 2. KẾT QUẢ TÍNH TOÁN & ĐỐI CHIẾU ---');
    console.log(`┌──────────────────────────────────────────────┬───────────────────┐`);
    console.log(`│ Tiêu chí đối soát                            │ Khối lượng (Lot)  │`);
    console.log(`├──────────────────────────────────────────────┼───────────────────┤`);
    console.log(`│ Tổng khối lượng DSGD gốc (đầu ngày)          │ ${String(result.totalOriginal).padStart(17)} │`);
    console.log(`│ Tổng khối lượng DSGD snapshot (chiều/tối)    │ ${String(result.totalTemp).padStart(17)} │`);
    console.log(`│ >> Chênh lệch Tổng (differTotal)             │ ${String(result.differTotal).padStart(17)} │`);
    console.log(`├──────────────────────────────────────────────┼───────────────────┤`);
    console.log(`│ Khối lượng tự doanh ACM M-System (đuôi 'A')  │ ${String(result.totalACMMS).padStart(17)} │`);
    console.log(`│ Khối lượng tự doanh Straits SFTP (ACM)       │ ${String(result.totalACMSFTP).padStart(17)} │`);
    console.log(`│ >> Chênh lệch ACM (differACM)                │ ${String(result.differACM).padStart(17)} │`);
    console.log(`└──────────────────────────────────────────────┴───────────────────┘`);
    console.log('');

    console.log('--- 3. TRẠNG THÁI & KẾT LUẬN NGHIỆP VỤ ---');
    console.log(`• Trạng thái vượt qua (Passed) : ${result.passed ? 'PASSED (KHỚP 100%)' : 'CHÊNH LỆCH (NEEDS ATTENTION)'}`);
    console.log(`• Thông báo chi tiết :`);
    result.messages.forEach((m, idx) => {
      console.log(`    ${idx + 1}. ${m}`);
    });
    console.log(`• Thời gian thực thi: ${elapsed}ms`);
    console.log('\n================================================================================');
    console.log('  KẾT THÚC KIỂM THỬ THÀNH CÔNG');
    console.log('================================================================================');
  } catch (err) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err.message);
    process.exit(1);
  }
}

main();
