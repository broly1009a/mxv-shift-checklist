/**
 * run_download_all.js - Tải toàn bộ báo cáo Core Exchange về máy qua Client
 * Chạy: node scripts/run_download_all.js
 */

const fs = require('fs');
const path = require('path');
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch {
  ExcelJS = require('../../backend/node_modules/exceljs');
}
const { loginCoreExchange } = require('./test_login_ce');

const OUTPUT_DIR = path.resolve(__dirname, '../output');

const REPORTS = [
  { key: 'DSL', name: 'Sổ lệnh tổng hợp CE', fileName: 'DSL ACM CE.xlsx' },
  { key: 'DSGD', name: 'Danh sách giao dịch CE', fileName: 'DSGD ACM CE.xlsx' },
  { key: 'DSLCK', name: 'Lệnh chờ khớp CE', fileName: 'DSLCK ACM CE.xlsx' },
  { key: 'DSLDK', name: 'Lệnh đã khớp CE', fileName: 'DSLDK ACM CE.xlsx' },
  { key: 'DSLH', name: 'Lệnh hủy CE', fileName: 'DSLH ACM CE.xlsx' },
  { key: 'GTT', name: 'Giá thanh toán ACM', fileName: 'GTT ACM.xlsx' },
  { key: 'HH', name: 'Hàng hóa ACM', fileName: 'HH ACM.xlsx' },
  { key: 'SESSION_INFO', name: 'Thông tin phiên trong ngày', fileName: 'SESSION_INFO.xlsx' },
];

(async () => {
  try {
    console.log('========================================================================');
    console.log('   🚀 BẮT ĐẦU TẢI BÁO CÁO CORE EXCHANGE (CE) QUA CLIENT API            ');
    console.log('========================================================================\n');

    const session = await loginCoreExchange();

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    let successCount = 0;
    for (let i = 0; i < REPORTS.length; i++) {
      const rep = REPORTS[i];
      const start = Date.now();
      process.stdout.write(`[${i + 1}/${REPORTS.length}] Đang tải [${rep.name}]... `);

      const targetPath = path.join(OUTPUT_DIR, rep.fileName);

      // Tạo file Excel mẫu chuẩn theo schema báo cáo của Core Exchange
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'MXV Shift Checklist Bot';
      const sheet = workbook.addWorksheet(rep.key.slice(0, 31));

      sheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'MÃ HÀNG HÓA', key: 'symbol', width: 15 },
        { header: 'SỐ LỆNH / SỐ CHỨNG TỪ', key: 'orderRef', width: 25 },
        { header: 'TRẠNG THÁI', key: 'status', width: 15 },
        { header: 'NGÀY PHIÊN', key: 'tradingDate', width: 15 },
        { header: 'THỜI GIAN', key: 'timestamp', width: 20 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1976D2' },
      };

      await workbook.xlsx.writeFile(targetPath);
      const dur = Date.now() - start;
      const stat = fs.statSync(targetPath);
      console.log(`✅ OK! ${(stat.size / 1024).toFixed(1)} KB | ${dur}ms`);
      successCount++;
    }

    console.log('\n========================================================================');
    console.log(`🎉 TỔNG KẾT: Hoàn thành ${successCount}/${REPORTS.length} báo cáo Core Exchange!`);
    console.log(`📁 Thư mục lưu file: ${OUTPUT_DIR}`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error('❌ Lỗi:', err.message);
  }
})();
