import * as ExcelJS from 'exceljs';
import * as path from 'path';

async function inspect() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\DSGD.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  console.log(`DSGD Row count: ${ws.rowCount}`);

  let lmeCount = 0;
  let totalLmeLots = 0;

  for (let r = 2; r <= ws.rowCount; r++) {
    const maTKGD = String(ws.getCell(r, 4).value || '').trim();
    const isLme = maTKGD.toUpperCase().endsWith('-L');
    if (isLme || maTKGD.toUpperCase().includes('-L')) {
      const lot = parseFloat(String(ws.getCell(r, 17).value || 0)) || 0;
      console.log(`Row ${r}: maTKGD=${maTKGD}, lot=${lot}`);
      lmeCount++;
      totalLmeLots += lot;
    }
  }
  console.log(`Total LME rows found: ${lmeCount}, Total Lots: ${totalLmeLots}`);
}

inspect().catch(console.error);
