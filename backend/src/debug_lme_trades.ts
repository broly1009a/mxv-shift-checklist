import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07';
  const files = ['DSLKD.xlsx', 'DSLH.xlsx', 'DSLK.xlsx'];

  for (const file of files) {
    const filePath = path.join(baseDir, file);
    if (!fs.existsSync(filePath)) continue;
    const buf = fs.readFileSync(filePath);
    const sheet = await parseExcelBuffer(buf);
    
    const lmeRows = sheet.rows.filter((r: any) => {
      return Object.values(r).some(val => String(val).toUpperCase().includes('L') && String(val).toUpperCase().includes('041'));
    });

    console.log(`\n=== File ${file} has LME rows: ===`);
    lmeRows.forEach((r, idx) => {
      console.log(`Row ${idx+1}:`, JSON.stringify(r));
    });
  }
}

main().catch(console.error);
