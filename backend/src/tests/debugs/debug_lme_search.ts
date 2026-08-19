import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from '../../modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07';
  const files = fs.readdirSync(baseDir);

  for (const file of files) {
    if (!file.endsWith('.xlsx')) continue;
    const buf = fs.readFileSync(path.join(baseDir, file));
    const sheet = await parseExcelBuffer(buf);

    // Check if any row has an account ending with L
    const lmeRows = sheet.rows.filter((r: any) => {
      for (const k of Object.keys(r)) {
        const val = String(r[k]).toUpperCase();
        if (val.endsWith('L') && val.length > 5 && /^\d/.test(val)) {
          return true;
        }
      }
      return false;
    });

    if (lmeRows.length > 0) {
      console.log(
        `File: ${file} has ${lmeRows.length} LME rows. Sample:`,
        JSON.stringify(lmeRows[0]),
      );
    }
  }
}

main().catch(console.error);
