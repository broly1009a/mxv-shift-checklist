import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { parseExcelBuffer } from './modules/lot-statistics/helpers/excel-parser.helper';
import { classifyDsgd } from './modules/lot-statistics/helpers/trade-classifier.helper';
import { getSPFromDsgd } from './modules/lot-statistics/helpers/lot-aggregator.helper';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const dailyMsDir = path.join(baseDir, 'Backup MS', '16.07');
  const dsgdPath = path.join(dailyMsDir, 'DSGD.xlsx');

  const buf = fs.readFileSync(dsgdPath);
  const dsgdSheet = await parseExcelBuffer(buf);

  const { dsgdAcm } = classifyDsgd(dsgdSheet.rows);

  console.log('=== ACM TRADES IN DSGD ===');
  const map = new Map<string, number>();
  for (const r of dsgdAcm) {
    const maKyHan = String(
      r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['col6'] ?? r['col9'],
    );
    const lot = Number(
      r['KL giao dịch'] ?? r['KL'] ?? r['col13'] ?? r['col17'] ?? 0,
    );
    map.set(maKyHan, (map.get(maKyHan) ?? 0) + lot);
  }

  for (const [maKyHan, lot] of map.entries()) {
    const row = dsgdAcm.find(
      (r) =>
        String(r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['col6'] ?? r['col9']) ===
        maKyHan,
    );
    console.log(
      `maKyHan: ${maKyHan} | Lot: ${lot} | getSP: ${getSPFromDsgd(row!)}`,
    );
  }
}

main().catch(console.error);
