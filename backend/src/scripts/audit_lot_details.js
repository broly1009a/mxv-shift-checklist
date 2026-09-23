const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

async function checkLotFiles() {
  const reviewDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'review_output');

  const lotFiles = [
    'Thong ke so lot giao dich ACM 2026.xlsx',
    'Thong ke so lot giao dich Spread 2026.xlsx',
    'Thong ke so lot giao dich LME 2026.xlsx',
    'Thong ke so lot giao dich 2026.xlsx',
  ];

  for (const filename of lotFiles) {
    const filePath = path.join(reviewDir, filename);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);

    console.log(`\n======================================================`);
    console.log(`FILE: ${filename}`);
    console.log(`======================================================`);

    const sheet = wb.getWorksheet('T09.2026') || wb.getWorksheet('T9.2026') || wb.worksheets[0];
    console.log(`Sheet: ${sheet.name}`);

    // Dòng 4 là header TVKD / Tên SP
    const headerRow = sheet.getRow(4);
    const subHeaderRow = sheet.getRow(5);

    const headers = {};
    for (let c = 1; c <= sheet.columnCount; c++) {
      const h4 = headerRow.getCell(c).value;
      const h5 = subHeaderRow ? subHeaderRow.getCell(c).value : null;
      let name = '';
      if (h4) name += String(h4).trim();
      if (h5 && String(h5).trim() !== String(h4).trim()) name += ` (${String(h5).trim()})`;
      if (name) headers[c] = name;
    }

    // Dòng 21 là ngày 17
    const row17 = sheet.getRow(21);
    console.log(`Dòng 21 (Ngày ${row17.getCell(1).value}):`);
    const writtenCells = [];
    let sumTVKD = 0;

    for (let c = 1; c <= 80; c++) {
      const cell = row17.getCell(c);
      let val = cell.value;
      let formula = null;
      if (val && typeof val === 'object') {
        formula = val.formula;
        val = val.result;
      }

      const hName = headers[c] || `Col ${c}`;
      if (val !== null && val !== undefined && val !== '') {
        writtenCells.push({ col: c, header: hName, value: val, formula, numFmt: cell.numFmt });
        if (typeof val === 'number' && c >= 3 && c <= 73) {
          sumTVKD += val;
        }
      }
    }

    console.log(`-> Các ô có giá trị / công thức:`);
    writtenCells.forEach(item => {
      const fText = item.formula ? ` [Công thức: =${item.formula}]` : '';
      console.log(`   Col ${item.col.toString().padStart(2, '0')} | ${item.header.padEnd(25, ' ')}: ${item.value}${fText} (fmt: ${item.numFmt || 'none'})`);
    });
    console.log(`-> Tổng các cột TVKD (Col 3-73) cộng tay: ${sumTVKD}`);
  }
}

checkLotFiles().catch(console.error);
