import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const sheet1 = wb.worksheets.find(w => w.name.toLowerCase() === 'sheet1')!;

  const printCell = (r: number, c: number) => {
    const val = sheet1.getCell(r, c).value;
    if (val === null || val === undefined) return '';
    if (typeof val === 'object' && val !== null) {
      if ('formula' in val) {
        return `[F: ${val.formula} | R: ${JSON.stringify(val.result)}]`;
      }
      return JSON.stringify(val);
    }
    return String(val);
  };

  console.log('Row | Col J | Col K | Col L');
  for (let r = 11; r <= 77; r++) {
    console.log(`${r} | ${printCell(r, 10)} | ${printCell(r, 11)} | ${printCell(r, 12)}`);
  }

  console.log('\nRow | Col M | Col N');
  for (let r = 12; r <= 20; r++) {
    console.log(`${r} | ${printCell(r, 13)} | ${printCell(r, 14)}`);
  }

  console.log('\nRow | Col R | Col S | Col T');
  for (let r = 11; r <= 13; r++) {
    console.log(`${r} | ${printCell(r, 18)} | ${printCell(r, 19)} | ${printCell(r, 20)}`);
  }
}
main().catch(console.error);
