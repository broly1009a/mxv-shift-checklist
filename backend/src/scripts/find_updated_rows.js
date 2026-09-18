const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function findUpdatedRows() {
  const reviewDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'review_output');
  const filePath = path.join(reviewDir, 'Thong ke so lot giao dich ACM 2026.xlsx');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  wb.eachSheet((sheet, id) => {
    console.log(`Checking Sheet ${id}: ${sheet.name}`);
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const cellsWithNumbers = [];
      row.eachCell((cell, col) => {
        if (typeof cell.value === 'number' && cell.value > 0 && col >= 3) {
          cellsWithNumbers.push({ col, val: cell.value });
        }
      });
      if (cellsWithNumbers.length > 0) {
        console.log(`  Row ${r} (Col 1: ${row.getCell(1).value}, Col 2: ${row.getCell(2).value}):`, cellsWithNumbers);
      }
    }
  });
}

findUpdatedRows().catch(console.error);
