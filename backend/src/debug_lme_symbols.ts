import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07';

  // Parse DSTKGD-LME.xlsx
  const lmeFile = path.join(baseDir, 'DSTKGD-LME.xlsx');
  if (fs.existsSync(lmeFile)) {
    const lmeSheet = await parseExcelBuffer(fs.readFileSync(lmeFile));
    console.log(`DSTKGD-LME.xlsx has ${lmeSheet.rows.length} rows.`);
    if (lmeSheet.rows.length > 0) {
      console.log('Sample LME row:', JSON.stringify(lmeSheet.rows[0]));
    }
  }

  // Parse TTTT.xlsx
  const ttttFile = path.join(baseDir, 'TTTT.xlsx');
  const ttttSheet = await parseExcelBuffer(fs.readFileSync(ttttFile));
  console.log(`TTTT.xlsx has ${ttttSheet.rows.length} rows.`);

  // Find LME transactions in TTTT by checking contract or symbol
  const lmeBySymbol = ttttSheet.rows.filter((r: any) => {
    const symbol = String(r['Mã HĐ'] ?? r['col10'] ?? '').toUpperCase();
    // LME commodities are typically: LME Lead (LLD), LME Zinc (SZN), LME Copper (MCU), LME Nickel (MNI), LME Aluminium (MAL), LME Tin (LTI)
    return ['LLD', 'SZN', 'MCU', 'MNI', 'MAL', 'LTI'].some((code) =>
      symbol.startsWith(code),
    );
  });

  console.log(`Found ${lmeBySymbol.length} LME rows by symbol in TTTT.xlsx:`);
  lmeBySymbol.forEach((r, idx) => {
    console.log(`Row ${idx + 1}:`, JSON.stringify(r));
  });
}

main().catch(console.error);
