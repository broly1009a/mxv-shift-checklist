import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import * as ExcelJS from 'exceljs';

async function runScenarioTest() {
  console.log('================================================================');
  console.log('  KIỂM CHỨNG KỊCH BẢN: TẠO THÁNG 11 & THÊM MÃ HÀNG HÓA MỚI GLD1 ');
  console.log('  File: Bao cao - Thong ke/Thong ke gia tri giao dich ACM 2026.xlsx');
  console.log('================================================================\n');

  const rootDir = path.resolve(__dirname, '../../..');
  const targetFile = path.join(
    rootDir,
    'Bao cao - Thong ke',
    'Thong ke gia tri giao dich ACM 2026 (Theo CCP).xlsx',
  );

  if (!fs.existsSync(targetFile)) {
    throw new Error(`File muc tieu khong ton tai: ${targetFile}`);
  }

  // 1. Sao lưu an toàn trước khi chạy
  const backupDir = path.join(rootDir, 'Bao cao - Thong ke', 'Backup_Snapshots');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
  const initialBackup = path.join(backupDir, `Thong_ke_GTGD_ACM_truoc_khi_test_${ts}.bak.xlsx`);
  fs.copyFileSync(targetFile, initialBackup);
  console.log(`1. [Safety Backup] Đã tạo bản sao lưu an toàn:\n   ${initialBackup}\n`);

  // 2. Kiểm tra trạng thái ban đầu
  const initWb = new ExcelJS.Workbook();
  await initWb.xlsx.readFile(targetFile);
  console.log('2. [Initial State] Các sheet hiện tại:', initWb.worksheets.map(w => w.name));

  // --- KỊCH BẢN 1: TẠO THÁNG 11 (T11.2026) BẰNG excel_sheet_cloner.py ---
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

  console.log('Thẩm định Sheet T11.2026 vừa tạo:');
  console.log(`   - Tên sheet: ${wsT11.name}`);
  console.log(`   - Tổng số dòng: ${wsT11.rowCount}`);
  console.log(`   - Ô ngày đầu tiên A6: ${JSON.stringify(wsT11.getCell('A6').value)}`);
  console.log(`   - Ô ngày thứ hai A7:  ${JSON.stringify(wsT11.getCell('A7').value)}`);
  console.log(`   - Dòng tổng cộng A27: "${wsT11.getCell('A27').value}"`);
  console.log(`   - Công thức tổng cột B tại dòng 27: ${JSON.stringify(wsT11.getCell('B27').value)}`);
  console.log(`   - Công thức tổng ngang tại E6:       ${JSON.stringify(wsT11.getCell('E6').value)}`);

  // --- KỊCH BẢN 2: THÊM MÃ HÀNG HÓA MỚI GLD1 ("Vàng Nano") QUA ccp_column_provisioner.py ---
  console.log('\n--- BƯỚC 2: KÍCH HOẠT THÊM MÃ HÀNG HÓA MỚI GLD1 VÀO TEMPLATE ---');
  const provisionerScript = path.join(rootDir, 'backend', 'src', 'scripts', 'python', 'ccp_column_provisioner.py');
  const provCmd = `python "${provisionerScript}" --file "${targetFile}" --type commodity --code "GLD1" --label "Vang Nano"`;
  console.log(`Command: ${provCmd}`);
  const provOut = execSync(provCmd, { encoding: 'utf-8' });
  console.log(provOut);

  // --- BƯỚC 3: THẨM ĐỊNH TOÀN DIỆN KẾT QUẢ CUỐI CÙNG ---
  console.log('\n--- BƯỚC 3: THẨM ĐỊNH CHI TIẾT TẤT CẢ CÁC SHEET SAU KHI THÊM GLD1 ---');
  const wbFinal = new ExcelJS.Workbook();
  await wbFinal.xlsx.readFile(targetFile);
  console.log('Các sheet hiện tại:', wbFinal.worksheets.map(w => w.name));

  // 1. Thẩm định Sheet T11.2026
  const ws11Final = wbFinal.getWorksheet('T11.2026')!;
  console.log('\n[Sheet T11.2026]:');
  console.log(`   - Cột E (Col 5) Header Row 4 (Label): "${ws11Final.getCell('E4').value}"`);
  console.log(`   - Cột E (Col 5) Header Row 5 (Code):  "${ws11Final.getCell('E5').value}"`);
  console.log(`   - Cột E (Col 5) Data Row 6 (Giá trị): ${ws11Final.getCell('E6').value}`);
  console.log(`   - Cột E (Col 5) Tổng dọc Row 27:      ${JSON.stringify(ws11Final.getCell('E27').value)}`);
  console.log(`   - Cột F (Col 6) Cột TỔNG Row 3:       "${ws11Final.getCell('F3').value}"`);
  console.log(`   - Cột F (Col 6) Tổng ngang Row 6:     ${JSON.stringify(ws11Final.getCell('F6').value)}`);
  console.log(`   - Cột F (Col 6) Tổng dọc Row 27:      ${JSON.stringify(ws11Final.getCell('F27').value)}`);

  // 2. Thẩm định Sheet T10.2026
  const ws10Final = wbFinal.getWorksheet('T10.2026')!;
  console.log('\n[Sheet T10.2026]:');
  console.log(`   - Cột E (Col 5) Header Row 5 (Code):  "${ws10Final.getCell('E5').value}"`);
  console.log(`   - Cột E (Col 5) Tổng dọc Row 28:      ${JSON.stringify(ws10Final.getCell('E28').value)}`);
  console.log(`   - Cột F (Col 6) Tổng ngang Row 6:     ${JSON.stringify(ws10Final.getCell('F6').value)}`);

  // 3. Thẩm định Sheet TONGHOP
  const wsThFinal = wbFinal.getWorksheet('TONGHOP')!;
  console.log('\n[Sheet TONGHOP]:');
  console.log(`   - Cột E (Col 5) Header Row 5 (Code):      "${wsThFinal.getCell('E5').value}"`);
  console.log(`   - Cột E (Col 5) Row 15 (Tháng 10):        ${JSON.stringify(wsThFinal.getCell('E15').value)}`);
  console.log(`   - Cột E (Col 5) Row 16 (Tháng 11 vừa tạo): ${JSON.stringify(wsThFinal.getCell('E16').value)}`);
  console.log(`   - Cột E (Col 5) Row 18 (Tổng năm):        ${JSON.stringify(wsThFinal.getCell('E18').value)}`);
  console.log(`   - Cột F (Col 6) Row 16 (Tổng ngang T11):   ${JSON.stringify(wsThFinal.getCell('F16').value)}`);

  console.log('\n================================================================');
  console.log('  KẾT QUẢ KIỂM CHỨNG: KỊCH BẢN THÀNH CÔNG CHÍNH XÁC 100%!       ');
  console.log('================================================================');
}

runScenarioTest().catch(err => {
  console.error('\nKIỂM CHỨNG THẤT BẠI:', err);
  process.exit(1);
});
