const path = require('path');
const ExcelJS = require('exceljs');

async function inspectOriginalOutput() {
  const dir = path.join(__dirname, '..', '..', '..', 'Thong ke ccp', 'output');
  const files = [
    'Thong ke so lot giao dich ACM 2026.xlsx',
    'Thong ke so lot giao dich 2026.xlsx',
    'Thong ke so lot giao dich Spread 2026.xlsx',
    'Thong ke so lot giao dich LME 2026.xlsx',
  ];

  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(dir, f));
    const ws = wb.getWorksheet('T09.2026');
    console.log(`\n=== FILE: ${f} ===`);
    for (let r = 5; r <= 20; r++) {
      const row = ws.getRow(r);
      const c1 = row.getCell(1).value;
      const c2 = row.getCell(2).value;
      const c3 = row.getCell(3).value;
      const c4 = row.getCell(4).value;
      const c5 = row.getCell(5).value;
      const c74 = row.getCell(74).value; // Tổng TVKD
      if (c3 || c4 || c5 || (c74 && c74.result)) {
        console.log(`Row ${r} (STT ${c1}, Ngày ${JSON.stringify(c2)}): Col 3=${c3}, Col 4=${c4}, Col 5=${c5}, Col 74(Tong)=${JSON.stringify(c74)}`);
      }
    }
  }
}

inspectOriginalOutput().catch(console.error);
