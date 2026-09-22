const XLSX = require('xlsx');
const path = require('path');

const outDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2', 'review_output');

function inspectSheetDetail(fileName, sheetName, rowIdx) {
  const p = path.join(outDir, fileName);
  const wb = XLSX.readFile(p);
  const ws = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
  const headers = data[3] || data[2] || data[1] || [];
  const row = data[rowIdx];
  console.log(`\n======================================================`);
  console.log(`FILE: ${fileName} | SHEET: ${sheetName} | DÒNG: ${rowIdx + 1}`);
  console.log(`======================================================`);
  for (let c = 0; c < row.length; c++) {
    const val = row[c];
    if (val !== undefined && val !== null && val !== 0 && val !== '0' && val !== '') {
      const h = headers[c] || `Col_${c}`;
      console.log(`  - [Cột ${c}] ${String(h).padEnd(20)}: ${typeof val === 'number' ? val.toLocaleString('vi-VN') : val}`);
    }
  }
}

inspectSheetDetail('Thong ke so lot giao dich ACM 2026.xlsx', 'T09.2026', 20); // row 21 is idx 20
inspectSheetDetail('Thong ke gia tri giao dich ACM 2026.xlsx', 'T09.2026', 21); // row 22 is idx 21 (date 17)
inspectSheetDetail('Thong ke so lot giao dich LME 2026.xlsx', 'T09.2026', 20);
inspectSheetDetail('Thong ke so lot giao dich 2026.xlsx', 'T09.2026', 20);
