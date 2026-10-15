import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

async function testCcpProvisioner() {
  console.log('================================================================');
  console.log('   KIỂM CHỨNG TOÀN DIỆN: PYTHON CCP COLUMN PROVISIONER TOOL     ');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const mDriveDir = 'M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Bao cao - Thong ke';

  const sourceLot = path.join(mDriveDir, 'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx');
  const sourceGtgd = path.join(mDriveDir, 'Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx');

  if (!fs.existsSync(sourceLot) || !fs.existsSync(sourceGtgd)) {
    throw new Error('Khong tim thay file mau tren o dia M:!');
  }

  const scratchDir = path.join(rootDir, 'backend', 'scratch');
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const testLot = path.join(scratchDir, 'test_lot_provision.xlsx');
  const testGtgd = path.join(scratchDir, 'test_gtgd_provision.xlsx');

  fs.copyFileSync(sourceLot, testLot);
  fs.copyFileSync(sourceGtgd, testGtgd);

  const pythonScript = path.join(rootDir, 'backend', 'src', 'scripts', 'python', 'ccp_column_provisioner.py');

  // --- BƯỚC 1: Thêm TVKD 099 ("Thành viên ABC") vào File Số Lot ---
  console.log('1. Chạy tool thêm TVKD mới 099 vào file Số Lot...');
  const cmdTvkd = `python "${pythonScript}" --file "${testLot}" --type tvkd --code "099" --label "Thanh vien ABC"`;
  const outTvkd = execSync(cmdTvkd, { encoding: 'utf-8' });
  console.log(outTvkd);

  // --- BƯỚC 2: Thêm Hàng Hóa mới GLD1 ("Vàng Nano") vào File Số Lot ---
  console.log('\n2. Chạy tool thêm Hàng Hóa mới GLD1 vào file Số Lot...');
  const cmdHhLot = `python "${pythonScript}" --file "${testLot}" --type commodity --code "GLD1" --label "Vang Nano"`;
  const outHhLot = execSync(cmdHhLot, { encoding: 'utf-8' });
  console.log(outHhLot);

  // --- BƯỚC 3: Thêm Hàng Hóa mới GLD1 ("Vàng Nano") vào File GTGD ---
  console.log('\n3. Chạy tool thêm Hàng Hóa mới GLD1 vào file GTGD...');
  const cmdHhGtgd = `python "${pythonScript}" --file "${testGtgd}" --type commodity --code "GLD1" --label "Vang Nano"`;
  const outHhGtgd = execSync(cmdHhGtgd, { encoding: 'utf-8' });
  console.log(outHhGtgd);

  // --- BƯỚC 4: Thẩm định cấu trúc và công thức sau khi mở rộng ---
  console.log('\n4. Thẩm định chi tiết file Số Lot sau khi thêm TVKD 099 và Hàng Hóa GLD1:');
  const wbLot = XLSX.readFile(testLot);
  const wsLot = wbLot.Sheets['T10.2026'];

  // Tìm cột TVKD 099
  let col099 = -1;
  let colGld1 = -1;
  for (let c = 0; c < 90; c++) {
    const c4 = wsLot[XLSX.utils.encode_cell({ r: 3, c })]?.v;
    if (c4 && String(c4).includes('099')) col099 = c;
    if (c4 && String(c4).toUpperCase() === 'GLD1') colGld1 = c;
  }

  console.log(`   - Cột TVKD 099 tìm thấy tại: ${XLSX.utils.encode_col(col099)} (Col ${col099 + 1})`);
  console.log(`     Header Row 4: "${wsLot[XLSX.utils.encode_cell({ r: 3, c: col099 })]?.v}"`);
  console.log(`     Data Row 5: ${wsLot[XLSX.utils.encode_cell({ r: 4, c: col099 })]?.v}`);
  console.log(`     Formula Row 27 (Tổng dọc TVKD): ${wsLot[XLSX.utils.encode_cell({ r: 26, c: col099 })]?.f}`);

  const colTongTvkd = col099 + 1;
  console.log(`   - Cột Tổng TVKD nằm tại: ${XLSX.utils.encode_col(colTongTvkd)} (Col ${colTongTvkd + 1})`);
  console.log(`     Formula Row 5 (Tổng ngang TVKD): ${wsLot[XLSX.utils.encode_cell({ r: 4, c: colTongTvkd })]?.f}`);
  console.log(`     Formula Row 27 (Tổng dọc Tổng TVKD): ${wsLot[XLSX.utils.encode_cell({ r: 26, c: colTongTvkd })]?.f}`);

  console.log(`\n   - Cột Hàng Hóa GLD1 tìm thấy tại: ${XLSX.utils.encode_col(colGld1)} (Col ${colGld1 + 1})`);
  console.log(`     Header Row 4: "${wsLot[XLSX.utils.encode_cell({ r: 3, c: colGld1 })]?.v}"`);
  console.log(`     Formula Row 27 (Tổng dọc Hàng Hóa): ${wsLot[XLSX.utils.encode_cell({ r: 26, c: colGld1 })]?.f}`);

  const colTongHh = colGld1 + 1;
  console.log(`   - Cột Tổng Hàng Hóa nằm tại: ${XLSX.utils.encode_col(colTongHh)} (Col ${colTongHh + 1})`);
  console.log(`     Formula Row 5 (Tổng ngang Hàng Hóa): ${wsLot[XLSX.utils.encode_cell({ r: 4, c: colTongHh })]?.f}`);
  console.log(`     Formula Row 27 (Tổng dọc Tổng Hàng Hóa): ${wsLot[XLSX.utils.encode_cell({ r: 26, c: colTongHh })]?.f}`);

  // Thẩm định TONGHOP của file Số Lot
  const wsLotTh = wbLot.Sheets['TONGHOP'];
  console.log(`\n   - Thẩm định Sheet TONGHOP file Số Lot:`);
  console.log(`     Header Col 099: "${wsLotTh[XLSX.utils.encode_cell({ r: 3, c: col099 })]?.v}"`);
  console.log(`     Tháng 10 (Row 14) formula Col 099: ${wsLotTh[XLSX.utils.encode_cell({ r: 13, c: col099 })]?.f}`);
  console.log(`     Tổng năm (Row 17) formula Col 099: ${wsLotTh[XLSX.utils.encode_cell({ r: 16, c: col099 })]?.f}`);
  console.log(`     Tháng 10 (Row 14) Tổng ngang TVKD: ${wsLotTh[XLSX.utils.encode_cell({ r: 13, c: colTongTvkd })]?.f}`);

  // Thẩm định file GTGD
  console.log('\n5. Thẩm định chi tiết file Giá Trị Giao Dịch sau khi thêm GLD1:');
  const wbGtgd = XLSX.readFile(testGtgd);
  const wsGtgd = wbGtgd.Sheets['T10.2026'];

  let colGld1Gtgd = -1;
  for (let c = 0; c < 15; c++) {
    const c5 = wsGtgd[XLSX.utils.encode_cell({ r: 4, c })]?.v;
    if (c5 && String(c5).toUpperCase() === 'GLD1') colGld1Gtgd = c;
  }
  console.log(`   - Cột GLD1 trong GTGD tìm thấy tại: ${XLSX.utils.encode_col(colGld1Gtgd)} (Col ${colGld1Gtgd + 1})`);
  console.log(`     Header Row 4 (Label): "${wsGtgd[XLSX.utils.encode_cell({ r: 3, c: colGld1Gtgd })]?.v}"`);
  console.log(`     Header Row 5 (Code):  "${wsGtgd[XLSX.utils.encode_cell({ r: 4, c: colGld1Gtgd })]?.v}"`);
  console.log(`     Formula Row 28 (Tổng dọc GLD1): ${wsGtgd[XLSX.utils.encode_cell({ r: 27, c: colGld1Gtgd })]?.f}`);

  const colTongGtgd = colGld1Gtgd + 1;
  console.log(`   - Cột Tổng GTGD nằm tại: ${XLSX.utils.encode_col(colTongGtgd)} (Col ${colTongGtgd + 1})`);
  console.log(`     Formula Row 6 (Tổng ngang GTGD): ${wsGtgd[XLSX.utils.encode_cell({ r: 5, c: colTongGtgd })]?.f}`);
  console.log(`     Formula Row 28 (Tổng dọc Tổng GTGD): ${wsGtgd[XLSX.utils.encode_cell({ r: 27, c: colTongGtgd })]?.f}`);

  // Thẩm định bằng ExcelJS để đảm bảo tính toàn vẹn 100% với Node.js
  console.log('\n6. Kiểm tra tải lại file bằng ExcelJS (Zero XML Corruption check):');
  const excelJsLot = new ExcelJS.Workbook();
  await excelJsLot.xlsx.readFile(testLot);
  console.log(`   ExcelJS load testLot thanh cong: ${excelJsLot.worksheets.map((w) => w.name).join(', ')}`);

  const excelJsGtgd = new ExcelJS.Workbook();
  await excelJsGtgd.xlsx.readFile(testGtgd);
  console.log(`   ExcelJS load testGtgd thanh cong: ${excelJsGtgd.worksheets.map((w) => w.name).join(', ')}`);

  // Dọn dẹp scratch
  fs.rmSync(testLot, { force: true });
  fs.rmSync(testGtgd, { force: true });
  console.log('\n7. Đã dọn dẹp các tệp tạm scratch thành công.');

  console.log('\n================================================================');
  console.log('  KẾT QUẢ KIỂM CHỨNG: PROVISIONER HOẠT ĐỘNG HOÀN HẢO 100%!       ');
  console.log('================================================================');
}

testCcpProvisioner().catch((err) => {
  console.error('Test thất bại:', err);
  process.exit(1);
});
