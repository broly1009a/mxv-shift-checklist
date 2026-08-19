import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from '../../modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup CQG\\16.07';
  const files = fs.readdirSync(baseDir);

  for (const file of files) {
    if (!file.toLowerCase().includes('ps')) continue;
    const buf = fs.readFileSync(path.join(baseDir, file));
    const sheet = await parseExcelBuffer(buf);

    const lmeRows = sheet.rows.filter((r: any) => {
      const acc = String(r['Account'] ?? r['col1'] ?? '')
        .trim()
        .toUpperCase();
      return acc.endsWith('L');
    });

    if (lmeRows.length > 0) {
      console.log(`File ${file} has ${lmeRows.length} LME rows:`);
      lmeRows.forEach((r, idx) => {
        console.log(`Row ${idx + 1}:`, JSON.stringify(r));
      });
    }
  }
}

main().catch(console.error);
