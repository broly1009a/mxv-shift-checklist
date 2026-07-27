import * as fs from 'fs';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const ttttPath =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\TTTT.xlsx';
  const buf = fs.readFileSync(ttttPath);
  const sheet = await parseExcelBuffer(buf);

  // Filter rows where member code (Mã TVKD) is 041
  const vqbRows = sheet.rows.filter((r: any) => {
    const tvkd = String(r['Mã TVKD'] ?? r['col2'] ?? '').trim();
    return tvkd === '041';
  });

  console.log(`Found ${vqbRows.length} rows for VQB (041) in TTTT.xlsx:`);
  vqbRows.forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  });
}

main().catch(console.error);
