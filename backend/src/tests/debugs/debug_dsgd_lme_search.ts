import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from '../../modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const dsgdPath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\DSGD.xlsx';
  const buf = fs.readFileSync(dsgdPath);
  const sheet = await parseExcelBuffer(buf);

  console.log(`DSGD.xlsx has ${sheet.rows.length} rows.`);

  const matched = sheet.rows.filter((r: any) => {
    return Object.values(r).some((val) => {
      const s = String(val).toUpperCase();
      return (
        s.includes('041C0888668') ||
        s.includes('LTIZ') ||
        s.includes('041C0888668-L')
      );
    });
  });

  console.log(`Found ${matched.length} matched rows in DSGD.xlsx:`);
  matched.forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  });
}

main().catch(console.error);
