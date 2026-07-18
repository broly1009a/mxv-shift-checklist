/**
 * Debug: calcFrProduct breakdown - xem frProduct bị trừ bao nhiêu từ đâu
 */
import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';
import { classifyFr } from './modules/lot-statistics/helpers/trade-classifier.helper';
import { calcFrProduct } from './modules/lot-statistics/helpers/fr-calculator.helper';
import { sumFrLot } from './modules/lot-statistics/helpers/lot-aggregator.helper';

async function main() {
  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup CQG\\16.07';
  const files = fs.readdirSync(baseDir);
  const frFile = files.find(f => f.toLowerCase().includes('fr') && f.endsWith('.xlsx'));
  const buf = fs.readFileSync(path.join(baseDir, frFile!));
  const sheet = await parseExcelBuffer(buf);
  const { fr, frSpread, frLme, frOptions } = classifyFr(sheet.rows);

  const ngayGD = new Date('2026-07-16');

  // No exclusions
  const resultNoExcl = calcFrProduct(fr, frSpread, frLme, frOptions, {
    ngayGD,
    truDates: [],
    fefDates: [],
    zftDates: [],
  });
  console.log('frProduct (no exclusions):', resultNoExcl.frProduct);
  console.log('breakdown:', JSON.stringify(resultNoExcl.breakdown, null, 2));

  // With exclusions matching run_in_place params
  const resultWithExcl = calcFrProduct(fr, frSpread, frLme, frOptions, {
    ngayGD,
    truDates: ['2026-07-03', '2026-07-02', '2026-07-01', '2026-06-30'].map(d => new Date(d)),
    fefDates: ['2026-07-03', '2026-07-02'].map(d => new Date(d)),
    zftDates: ['2026-07-03', '2026-07-02'].map(d => new Date(d)),
    deadline: 46217.208333,
  });
  console.log('\nfrProduct (with exclusions):', resultWithExcl.frProduct);
  console.log('breakdown:', JSON.stringify(resultWithExcl.breakdown, null, 2));

  // Sanity check sumFrLot
  console.log('\nsumFrLot(fr):', sumFrLot(fr));
  console.log('sumFrLot(frSpread):', sumFrLot(frSpread));
  console.log('sumFrLot(frLme):', sumFrLot(frLme));
  console.log('sumFrLot(frOptions):', sumFrLot(frOptions));
}

main().catch(console.error);
