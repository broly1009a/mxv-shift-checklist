import * as ExcelJS from 'exceljs';

async function main() {
  const filePath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\14.07\\DSGD.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.worksheets[0];
  console.log('Searching for SI5CO or Nano trades...');
  for (let r = 2; r <= ws.rowCount; r++) {
    const maTKGD = String(ws.getCell(r, 4).value || '');
    const maHD = String(ws.getCell(r, 6).value || '');
    if (
      maTKGD.includes('SI5CO') ||
      maHD.includes('SI5CO') ||
      maTKGD.includes('PL1NY') ||
      maHD.includes('PL1NY') ||
      maTKGD.includes('CP2CO') ||
      maHD.includes('CP2CO')
    ) {
      console.log(
        `Row ${r}: maTKGD=${maTKGD}, maHD=${maHD}, qty=${ws.getCell(r, 13).value}`,
      );
    }
  }
}
main().catch(console.error);
