const ExcelJS = require('exceljs');

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('M:/Tailieuchung/QLGD-IT/Quanlygiaodich/Tai lieu hoat dong/Thong ke ccp/Thong ke so lot giao dich 2026.xlsx');
  const ws = wb.getWorksheet('T09.2026');
  const r17 = ws.getRow(17);
  const r3 = ws.getRow(3);
  const r4 = ws.getRow(4);
  const r5 = ws.getRow(5);

  console.log('=== ROW 17 THONG KE SO LOT GIAO DICH ACM 2026.xlsx ===');
  for (let c = 1; c <= 100; c++) {
    const val = r17.getCell(c).value;
    const h3 = (r3.getCell(c).text || '').replace(/\n/g, ' ').trim();
    const h4 = (r4.getCell(c).text || '').replace(/\n/g, ' ').trim();
    const h5 = (r5.getCell(c).text || '').replace(/\n/g, ' ').trim();
    const header = [h3, h4, h5].filter(Boolean).join(' | ');

    if (val !== null && val !== undefined && val !== 0 && val !== '') {
      console.log(`Col ${c} [${header}]: ${JSON.stringify(val)}`);
    }
  }
}

inspect().catch(console.error);
