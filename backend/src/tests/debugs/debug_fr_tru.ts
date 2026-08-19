import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from '../../modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup CQG\\16.07';
  const files = fs.readdirSync(baseDir);

  for (const file of files) {
    if (!file.toLowerCase().includes('fr')) continue;
    const buf = fs.readFileSync(path.join(baseDir, file));
    const sheet = await parseExcelBuffer(buf);

    // Search for TRU in the rows
    const truRows = sheet.rows.filter((r: any) => {
      const sp = String(r['Product'] ?? r['col3'] ?? '').toUpperCase();
      return sp.includes('TRU');
    });

    if (truRows.length > 0) {
      console.log(`\n=== File ${file} has ${truRows.length} TRU rows: ===`);
      truRows.forEach((r, idx) => {
        console.log(`Row ${idx + 1}:`, JSON.stringify(r));
      });
    }
  }
}

main().catch(console.error);
