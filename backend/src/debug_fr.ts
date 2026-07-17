/**
 * Debug script: inspect FR file column structure to find correct Qty column
 */
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import * as fs from 'fs';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';
import { classifyFr } from './modules/lot-statistics/helpers/trade-classifier.helper';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup CQG\\16.07';

  // Find FR file
  const files = fs.readdirSync(baseDir);
  const frFile = files.find(f => f.toLowerCase().includes('fr') && f.endsWith('.xlsx'));
  if (!frFile) { console.log('FR file not found in', baseDir); return; }
  
  const frPath = path.join(baseDir, frFile);
  console.log('FR file:', frFile);

  // Dump raw headers (rows 1-3)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(frPath);
  const ws = wb.worksheets[0];
  console.log(`\nSheet: ${ws.name}, Rows: ${ws.rowCount}, Cols: ${ws.columnCount}`);
  
  console.log('\n=== RAW HEADERS (rows 1-3) ===');
  for (let c = 1; c <= Math.min(ws.columnCount, 15); c++) {
    const r1 = ws.getCell(1, c).value;
    const r2 = ws.getCell(2, c).value;
    const r3 = ws.getCell(3, c).value;
    // Sample data from row 4
    const r4 = ws.getCell(4, c).value;
    console.log(`Col ${c}: R1=${JSON.stringify(r1)}, R2=${JSON.stringify(r2)}, R3=${JSON.stringify(r3)}, R4Sample=${JSON.stringify(r4)}`);
  }

  // Parse and check FR lots
  const buf = fs.readFileSync(frPath);
  const sheet = await parseExcelBuffer(buf);
  console.log(`\nParsed ${sheet.rows.length} FR rows`);
  if (sheet.rows.length > 0) {
    const sample = sheet.rows[0];
    console.log('\nSample FR row keys:', Object.keys(sample));
    console.log('Sample FR row:', JSON.stringify(sample));
  }

  const { fr } = classifyFr(sheet.rows);
  console.log(`\nclassifyFr: fr=${fr.length} rows`);
  
  // Try summing with various column keys
  let totalQty = 0, totalCol6 = 0, totalCol9 = 0;
  for (const r of fr) {
    totalQty += Number(r['Qty'] ?? 0);
    totalCol6 += Number(r['col6'] ?? 0);
    totalCol9 += Number(r['col9'] ?? 0);
  }
  console.log(`\nSum by key - Qty: ${totalQty}, col6: ${totalCol6}, col9: ${totalCol9}`);
  console.log('Expected total FR lots: ~7387');
}

main().catch(console.error);
