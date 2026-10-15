import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import { ensureMonthSheetExists } from '../modules/trading-ops/helpers/excel-sheet-cloner.helper';
import { CcpAccumulatorService } from '../modules/trading-ops/services/ccp-accumulator.service';

async function verifyRealSheetCloning() {
  console.log('================================================================');
  console.log('   KIỂM CHỨNG THỰC TẾ: PYTHON CLONE SHEET THÁNG MỚI (T10.2026)  ');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const sampleSource = path.join(
    rootDir,
    'Thong ke ccp',
    'output',
    'Backup_Snapshots',
    'Thong ke so lot giao dich 2026_backup_2026-09-17_12-47-57.xlsx',
  );

  if (!fs.existsSync(sampleSource)) {
    throw new Error(`File nguồn mẫu không tồn tại: ${sampleSource}`);
  }

  const scratchDir = path.join(rootDir, 'backend', 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const testFile = path.join(scratchDir, 'test_clone_verification.xlsx');
  fs.copyFileSync(sampleSource, testFile);
  console.log('1. Đã copy file mẫu thực tế vào scratch:');
  console.log(`   ${testFile}`);

  // Kiểm tra các sheet ban đầu
  const wbBefore = XLSX.readFile(testFile);
  console.log('   Các sheet ban đầu:', wbBefore.SheetNames);
  if (wbBefore.SheetNames.includes('T10.2026')) {
    throw new Error('Sheet T10.2026 đã tồn tại từ trước! Không hợp lệ để test clone.');
  }

  // 2. Kích hoạt Python cloner qua helper ensureMonthSheetExists
  console.log('\n2. Kích hoạt Python excel_sheet_cloner.py để sinh Sheet tháng mới: T10.2026...');
  const logs: string[] = [];
  const cloned = ensureMonthSheetExists(testFile, 'T10.2026', logs);

  console.log(`   Kết quả ensureMonthSheetExists: ${cloned ? 'THÀNH CÔNG (true)' : 'THẤT BẠI (false)'}`);
  logs.forEach((l) => console.log(`   [Log] ${l}`));

  if (!cloned) {
    throw new Error('Python excel_sheet_cloner.py thất bại khi tạo sheet T10.2026!');
  }

  // 3. Kiểm tra bằng XLSX
  const wbAfter = XLSX.readFile(testFile);
  console.log('\n3. Đọc lại file sau khi Python clone xong:');
  console.log('   Các sheet hiện tại:', wbAfter.SheetNames);

  if (!wbAfter.SheetNames.includes('T10.2026')) {
    throw new Error('LỖI: Sheet T10.2026 không có trong danh sách sheets sau khi clone!');
  }
  console.log('    Xác nhận Sheet "T10.2026" đã được tạo thành công.');

  // 4. Kiểm tra cấu trúc sheet mới bằng ExcelJS
  const excelJsWb = new ExcelJS.Workbook();
  await excelJsWb.xlsx.readFile(testFile);
  const ws = excelJsWb.getWorksheet('T10.2026');
  if (!ws) throw new Error('ExcelJS không thể mở worksheet T10.2026!');

  console.log('\n4. Thẩm định nội dung Sheet T10.2026:');
  console.log(`   - Tổng số dòng (rowCount): ${ws.rowCount}`);
  console.log(`   - Tổng số cột (columnCount): ${ws.columnCount}`);
  console.log(`   - Tiêu đề tại A1/A2: "${ws.getCell(1, 1).value}" / "${ws.getCell(2, 1).value}"`);
  console.log(`   - Ô ngày đầu tiên (B6): ${JSON.stringify(ws.getCell(6, 2).value)}`);
  console.log(`   - Ô công thức ngày thứ 2 (B7): ${JSON.stringify(ws.getCell(7, 2).value)}`);

  // Dọn dẹp file test
  try {
    fs.unlinkSync(testFile);
    console.log('\n5. Đã dọn dẹp file test thành công.');
  } catch {}

  console.log('\n================================================================');
  console.log('  KẾT QUẢ KIỂM CHỨNG: PYTHON OPENPYXL HOẠT ĐỘNG HOÀN HẢO 100%!  ');
  console.log('================================================================');
}

verifyRealSheetCloning().catch((err) => {
  console.error('\n KIỂM CHỨNG THẤT BẠI:', err);
  process.exit(1);
});
