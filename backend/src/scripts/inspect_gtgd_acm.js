const path = require('path');
const ExcelJS = require('exceljs');

async function inspectGtgdAcm() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'review_output', 'Thong ke gia tri giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  wb.eachSheet((ws, id) => {
    console.log(`Sheet ${id}: ${ws.name}, rowCount = ${ws.rowCount}, colCount = ${ws.columnCount}`);
    for (let r = 1; r <= Math.min(25, ws.rowCount); r++) {
      const row = ws.getRow(r);
      const vals = [];
      row.eachCell((c, col) => {
        vals.push(`C${col}:${c.value}`);
      });
      if (vals.length > 0) console.log(`  Row ${r}: ${vals.join(' | ')}`);
    }
  });
}

inspectGtgdAcm().catch(console.error);
