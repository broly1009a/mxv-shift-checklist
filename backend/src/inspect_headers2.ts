import * as ExcelJS from 'exceljs';
import * as path from 'path';

const folder = `c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot`;

const files = [
  'Thong ke so lot giao dich 2026 2.xlsx',
  'Thong ke so lot giao dich ACM 2026 2.xlsx'
];

async function main() {
  for (const filename of files) {
    const filePath = path.join(folder, filename);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(filePath);
    const lastSheet = wb.worksheets[wb.worksheets.length - 1];
    
    console.log(`\n=== FILE: ${filename} (Sheet: ${lastSheet.name}) ===`);
    for (let r = 1; r <= 4; r++) {
      const row = lastSheet.getRow(r);
      const vals: any[] = [];
      for (let c = 1; c <= 35; c++) {
        const val = row.getCell(c).value;
        vals.push(val);
      }
      console.log(`Row ${r}:`, vals.map(v => {
        if (v && typeof v === 'object' && 'richText' in v) {
          return (v as any).richText.map((rt: any) => rt.text).join('');
        }
        return v;
      }));
    }
  }
}

main().catch(console.error);
