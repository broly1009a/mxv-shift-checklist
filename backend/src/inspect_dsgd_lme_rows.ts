import * as fs from 'fs';
import * as path from 'path';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';
import { classifyDsgd } from './modules/lot-statistics/helpers/trade-classifier.helper';
import { aggregateByTvkd } from './modules/lot-statistics/helpers/lot-aggregator.helper';

async function main() {
  const filePath = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot\\Backup MS\\16.07\\DSGD.xlsx';
  const buffer = fs.readFileSync(filePath);
  const sheet = await parseExcelBuffer(buffer);
  
  const { dsgdLme } = classifyDsgd(sheet.rows);
  console.log(`Found ${dsgdLme.length} LME rows:`);
  for (const r of dsgdLme) {
    console.log(JSON.stringify(r));
  }

  const tvkdLots = aggregateByTvkd(dsgdLme);
  console.log('TVKD Lots:', JSON.stringify(tvkdLots));
}

main().catch(console.error);
