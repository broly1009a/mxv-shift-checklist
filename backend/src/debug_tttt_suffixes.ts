import * as fs from 'fs';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const ttttPath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\TTTT.xlsx';
  const buf = fs.readFileSync(ttttPath);
  const sheet = await parseExcelBuffer(buf);

  const suffixes: Record<string, number> = {};
  const accts: string[] = [];

  for (const r of sheet.rows) {
    const acc = String(r['Mã TKGD'] ?? r['col8'] ?? '').trim().toUpperCase();
    if (!acc) continue;
    
    // get last 2 chars
    const last2 = acc.slice(-2);
    suffixes[last2] = (suffixes[last2] || 0) + 1;
    
    if (acc.includes('L') || acc.endsWith('L')) {
      accts.push(acc);
    }
  }

  console.log('Account suffixes distribution:', suffixes);
  console.log('Accounts containing L:', accts.slice(0, 10));
}

main().catch(console.error);
