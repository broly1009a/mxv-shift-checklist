const path = require('path');
const ExcelJS = require('exceljs');

async function inspectRow18() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'review_output', 'Thong ke gia tri giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  const ws = wb.getWorksheet('T09.2026');
  for (let r = 16; r <= 20; r++) {
    const row = ws.getRow(r);
    console.log(`Row ${r}: Col 1 = ${JSON.stringify(row.getCell(1).value)}, C2 = ${row.getCell(2).value}, C3 = ${row.getCell(3).value}, C4 = ${row.getCell(4).value}, C5 = ${JSON.stringify(row.getCell(5).value)}`);
  }
}

inspectRow18().catch(console.error);
