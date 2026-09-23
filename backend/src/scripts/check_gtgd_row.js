const ExcelJS = require('exceljs');
const path = require('path');

async function checkGtgd() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2', 'review_output', 'Thong ke gia tri giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  const ws = wb.getWorksheet('T09.2026');

  console.log('=== THONG KE GIA TRI GIAO DICH ACM 2026.XLSX ===');
  // Find row with 2026-09-17
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const c1 = row.getCell(1).value;
    const str = JSON.stringify(c1);
    if (str && (str.includes('2026-09-17') || str.includes('46288') || str.includes('46.288'))) {
      console.log(`Found row ${r}:`);
      for (let c = 1; c <= 10; c++) {
        const val = row.getCell(c).value;
        console.log(`  Col ${c}: ${typeof val === 'object' ? JSON.stringify(val) : (typeof val === 'number' ? val.toLocaleString('vi-VN') : val)}`);
      }
    }
  }
}

checkGtgd();
