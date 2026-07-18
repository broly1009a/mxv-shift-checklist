import * as ExcelJS from 'exceljs';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\14.07\\DSGD.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.worksheets[0];
  console.log('Headers (1-indexed):');
  const headers = ws.getRow(1).values as any[];
  for (let c = 1; c < headers.length; c++) {
    console.log(`${c} (${excelColName(c)}): ${headers[c]}`);
  }

  console.log('\nRow 2 values:');
  const row2 = ws.getRow(2).values as any[];
  for (let c = 1; c < row2.length; c++) {
    console.log(`${c} (${excelColName(c)}): ${row2[c]}`);
  }
}

function excelColName(col: number): string {
  let name = '';
  while (col > 0) {
    const temp = (col - 1) % 26;
    name = String.fromCharCode(65 + temp) + name;
    col = Math.floor((col - temp) / 26);
  }
  return name;
}

main().catch(console.error);
