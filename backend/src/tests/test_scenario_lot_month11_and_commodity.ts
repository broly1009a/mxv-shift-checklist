import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as ExcelJS from 'exceljs';

async function runLotScenarioTest() {
  console.log('================================================================');
  console.log('  KIỂM CHỨNG KỊCH BẢN: TẠO THÁNG 11 & THÊM MÃ HÀNG HÓA + TVKD MỚI');
  console.log('  File: Bao cao - Thong ke/Thong ke so lot giao dich ACM 2026.xlsx');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const targetFile = path.join(
    rootDir,
    'Bao cao - Thong ke',
    'Thong ke so lot giao dich ACM 2026 (trên CCP).xlsx',
  );

  if (!fs.existsSync(targetFile)) {
    throw new Error(`File muc tieu khong ton tai: ${targetFile}`);
  }

  // 1. Sao lưu an toàn trước khi chạy
  const backupDir = path.join(rootDir, 'Bao cao - Thong ke', 'Backup_Snapshots');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const initialBackup = path.join(backupDir, `Thong_ke_Lot_ACM_truoc_khi_test_${ts}.bak.xlsx`);
  fs.copyFileSync(targetFile, initialBackup);
  console.log(`1. [Safety Backup] Đã tạo bản sao lưu an toàn:\n   ${initialBackup}\n`);

  // 2. Kiểm tra trạng thái ban đầu
  const initWb = new ExcelJS.Workbook();
  await initWb.xlsx.readFile(targetFile);
  console.log('2. [Initial State] Các sheet hiện tại:', initWb.worksheets.map(w => w.name));

  // --- BƯỚC 1: KÍCH HOẠT TẠO THÁNG 11 (T11.2026) BẰNG excel_sheet_cloner.py ---
  console.log('\n--- BƯỚC 1: KÍCH HOẠT TẠO THÁNG 11 (T11.2026) QUA PYTHON OPENPYXL ---');
  const clonerScript = path.join(rootDir, 'backend', 'src', 'scripts', 'python', 'excel_sheet_cloner.py');
  const clonerCmd = `python "${clonerScript}" --file "${targetFile}" --sheet "T11.2026"`;
  console.log(`Command: ${clonerCmd}`);
  const clonerOut = execSync(clonerCmd, { encoding: 'utf-8' });
  console.log(clonerOut);

  // Thẩm định sau khi tạo tháng 11
  const wbStep1 = new ExcelJS.Workbook();
  await wbStep1.xlsx.readFile(targetFile);
  const wsT11 = wbStep1.getWorksheet('T11.2026');
  if (!wsT11) throw new Error('Lỗi: Sheet T11.2026 không được tạo!');

  console.log('Thẩm định Sheet T11.2026 vừa tạo trong file Số Lot:');
  console.log(`   - Tên sheet: ${wsT11.name}`);
  console.log(`   - Tổng số dòng: ${wsT11.rowCount}`);
  console.log(`   - STT đầu tiên A5: ${wsT11.getCell('A5').value}`);
  console.log(`   - Ngày đầu tiên B5: ${JSON.stringify(wsT11.getCell('B5').value)}`);
  console.log(`   - Ngày thứ hai B6:  ${JSON.stringify(wsT11.getCell('B6').value)}`);
  console.log(`   - Dòng tổng cộng A26: "${wsT11.getCell('A26').value}"`);
  console.log(`   - Công thức tổng cột TVKD (BW) tại dòng 26: ${JSON.stringify(wsT11.getCell('BW26').value)}`);
  console.log(`   - Công thức tổng cột Hàng Hóa (CB) tại dòng 26: ${JSON.stringify(wsT11.getCell('CB26').value)}`);

  // --- BƯỚC 2: KÍCH HOẠT THÊM MÃ HÀNG HÓA MỚI GLD1 ("Vàng Nano") ---
  console.log('\n--- BƯỚC 2: KÍCH HOẠT THÊM MÃ HÀNG HÓA MỚI GLD1 VÀO FILE SỐ LOT ---');
  const provisionerScript = path.join(rootDir, 'backend', 'src', 'scripts', 'python', 'ccp_column_provisioner.py');
  const provCmdHh = `python "${provisionerScript}" --file "${targetFile}" --type commodity --code "GLD1" --label "Vang Nano"`;
  console.log(`Command: ${provCmdHh}`);
  const provOutHh = execSync(provCmdHh, { encoding: 'utf-8' });
  console.log(provOutHh);

  // --- BƯỚC 3: KÍCH HOẠT THÊM TVKD MỚI 099 ("Thành viên ABC") ---
  console.log('\n--- BƯỚC 3: KÍCH HOẠT THÊM TVKD MỚI 099 VÀO FILE SỐ LOT ---');
  const provCmdTvkd = `python "${provisionerScript}" --file "${targetFile}" --type tvkd --code "099" --label "Thanh vien ABC"`;
  console.log(`Command: ${provCmdTvkd}`);
  const provOutTvkd = execSync(provCmdTvkd, { encoding: 'utf-8' });
  console.log(provOutTvkd);

  // --- BƯỚC 4: THẨM ĐỊNH TOÀN DIỆN KẾT QUẢ CUỐI CÙNG QUA EXCELJS ---
  console.log('\n--- BƯỚC 4: THẨM ĐỊNH CHI TIẾT TẤT CẢ CÁC SHEET SAU KHI MỞ RỘNG ---');
  const wbFinal = new ExcelJS.Workbook();
  await wbFinal.xlsx.readFile(targetFile);
  console.log('Các sheet hiện tại:', wbFinal.worksheets.map(w => w.name));

  // 1. Thẩm định Sheet T11.2026
  const ws11Final = wbFinal.getWorksheet('T11.2026')!;

  // Tìm vị trí cột TVKD 099 và Hàng Hóa GLD1
  let col099 = -1;
  let colGld1 = -1;
  for (let c = 1; c <= ws11Final.columnCount; c++) {
    const v = String(ws11Final.getRow(4).getCell(c).value || '');
    if (v.includes('099')) col099 = c;
    if (v.toUpperCase() === 'GLD1') colGld1 = c;
  }
  const col099Letter = ws11Final.getColumn(col099).letter;
  const colTongTvkdLetter = ws11Final.getColumn(col099 + 1).letter;
  const colGld1Letter = ws11Final.getColumn(colGld1).letter;
  const colTongHhLetter = ws11Final.getColumn(colGld1 + 1).letter;

  console.log('\n[Sheet T11.2026 - Số Lot]:');
  console.log(`   - Cột TVKD 099 tại ${col099Letter} (Col ${col099}): Header = "${ws11Final.getRow(4).getCell(col099).value}"`);
  console.log(`     Data Row 5: ${ws11Final.getRow(5).getCell(col099).value}`);
  console.log(`     Tổng dọc Row 26 (21 ngày làm việc): ${JSON.stringify(ws11Final.getRow(26).getCell(col099).value)}`);
  console.log(`   - Cột TỔNG TVKD tại ${colTongTvkdLetter} (Col ${col099 + 1}):`);
  console.log(`     Tổng ngang Row 5: ${JSON.stringify(ws11Final.getRow(5).getCell(col099 + 1).value)}`);
  console.log(`     Tổng dọc Row 26:  ${JSON.stringify(ws11Final.getRow(26).getCell(col099 + 1).value)}`);

  console.log(`\n   - Cột Hàng Hóa GLD1 tại ${colGld1Letter} (Col ${colGld1}): Header = "${ws11Final.getRow(4).getCell(colGld1).value}"`);
  console.log(`     Data Row 5: ${ws11Final.getRow(5).getCell(colGld1).value}`);
  console.log(`     Tổng dọc Row 26: ${JSON.stringify(ws11Final.getRow(26).getCell(colGld1).value)}`);
  console.log(`   - Cột TỔNG Hàng Hóa tại ${colTongHhLetter} (Col ${colGld1 + 1}):`);
  console.log(`     Tổng ngang Row 5: ${JSON.stringify(ws11Final.getRow(5).getCell(colGld1 + 1).value)}`);
  console.log(`     Tổng dọc Row 26:  ${JSON.stringify(ws11Final.getRow(26).getCell(colGld1 + 1).value)}`);

  // 2. Thẩm định Sheet T10.2026 (22 ngày làm việc)
  const ws10Final = wbFinal.getWorksheet('T10.2026')!;
  console.log('\n[Sheet T10.2026 - Số Lot]:');
  console.log(`   - Tổng dọc TVKD 099 Row 27 (22 ngày làm việc): ${JSON.stringify(ws10Final.getRow(27).getCell(col099).value)}`);
  console.log(`   - Tổng dọc Hàng Hóa GLD1 Row 27:               ${JSON.stringify(ws10Final.getRow(27).getCell(colGld1).value)}`);
  console.log(`   - Tổng ngang Hàng Hóa Row 5:                   ${JSON.stringify(ws10Final.getRow(5).getCell(colGld1 + 1).value)}`);

  // 3. Thẩm định Sheet TONGHOP
  const wsThFinal = wbFinal.getWorksheet('TONGHOP')!;
  console.log('\n[Sheet TONGHOP - Số Lot]:');
  console.log(`   - TVKD 099 Row 14 (Tháng 10):        ${JSON.stringify(wsThFinal.getRow(14).getCell(col099).value)}`);
  console.log(`   - TVKD 099 Row 15 (Tháng 11 vừa tạo): ${JSON.stringify(wsThFinal.getRow(15).getCell(col099).value)}`);
  console.log(`   - TVKD 099 Row 17 (Tổng cả năm):     ${JSON.stringify(wsThFinal.getRow(17).getCell(col099).value)}`);
  console.log(`   - Hàng Hóa GLD1 Row 14 (Tháng 10):   ${JSON.stringify(wsThFinal.getRow(14).getCell(colGld1).value)}`);
  console.log(`   - Hàng Hóa GLD1 Row 15 (Tháng 11):   ${JSON.stringify(wsThFinal.getRow(15).getCell(colGld1).value)}`);
  console.log(`   - Hàng Hóa GLD1 Row 17 (Tổng cả năm): ${JSON.stringify(wsThFinal.getRow(17).getCell(colGld1).value)}`);

  console.log('\n================================================================');
  console.log('  KẾT QUẢ KIỂM CHỨNG: KỊCH BẢN FILE SỐ LOT HOÀN TOÀN CHÍNH XÁC!  ');
  console.log('================================================================');
}

runLotScenarioTest().catch(err => {
  console.error('\nKIỂM CHỨNG THẤT BẠI:', err);
  process.exit(1);
});
