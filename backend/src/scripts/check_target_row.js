const ExcelJS = require('exceljs');
const path = require('path');
const { findOrCreateTargetRow } = require('../../dist/modules/lot-statistics/helpers/excel-accumulator.helper');

async function testTargetRow() {
  const p = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2', 'review_output', 'Thong ke so lot giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p);
  const ws = wb.getWorksheet('T09.2026');
  const testDate = new Date('2026-09-17');
  const rIdx = findOrCreateTargetRow(ws, testDate);
  console.log(`findOrCreateTargetRow for 2026-09-17 returned row index: ${rIdx}`);

  const row = ws.getRow(rIdx);
  console.log(`Row ${rIdx} values:`);
  for (let c = 1; c <= 80; c++) {
    const val = row.getCell(c).value;
    if (val !== null && val !== undefined && val !== '') {
      console.log(`  Col ${c}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
    }
  }
}

testTargetRow();
