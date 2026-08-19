import * as fs from 'fs';
import { parseExcelBuffer } from '../../modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const ttttPath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\TTTT.xlsx';
  const buf = fs.readFileSync(ttttPath);
  const sheet = await parseExcelBuffer(buf);

  // Search for 041C0888668 or LTIZ anywhere in each row
  const matched = sheet.rows.filter((r: any) => {
    return Object.values(r).some((val) => {
      const s = String(val).toUpperCase();
      return (
        s.includes('041C0888668') ||
        s.includes('LTIZ') ||
        s.includes('041C0888668L')
      );
    });
  });

  console.log(`Found ${matched.length} matched rows in TTTT.xlsx:`);
  matched.forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  });
}

main().catch(console.error);
