const path = require('path');
const ExcelJS = require('exceljs');

async function inspectCol2() {
  const reviewDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'review_output');
  const filePath = path.join(reviewDir, 'Thong ke so lot giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const sheet = wb.getWorksheet('T09.2026');

  for (let r = 5; r <= 25; r++) {
    const c1 = sheet.getCell(r, 1).value;
    const c2 = sheet.getCell(r, 2).value;
    console.log(`Row ${r}: Col 1 = ${JSON.stringify(c1)}, Col 2 = ${JSON.stringify(c2)}`);
  }
}

inspectCol2().catch(console.error);
