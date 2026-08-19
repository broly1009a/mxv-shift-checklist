import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { LotStatisticsService } from '../../modules/lot-statistics/lot-statistics.service';
import * as path from 'path';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(LotStatisticsService);

  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const dailyMsDir = path.join(baseDir, 'Backup MS', '16.07');
  const dailyCqgDir = path.join(baseDir, 'Backup CQG', '16.07');

  const files = service.loadFilesFromDirectories(dailyMsDir, dailyCqgDir);

  const params = {
    ngayGD: '2026-07-16',
    truDates: ['2026-07-03', '2026-07-02', '2026-07-01', '2026-06-30'],
    fefDates: ['2026-07-03', '2026-07-02'],
    zftDates: ['2026-07-03', '2026-07-02'],
    filterLmeKyHan: 'U26',
    deadline: 46217.208333,
    updateCumulative: false,
  };

  const result = await service.processLotStatistics(files, params);
  console.log('\n=== M-SYSTEM DETAILED SUMMARY VALUES ===');
  console.log(`- dsgdProduct: ${result.summary.dsgdProduct}`);
  console.log(`- ttttProduct: ${result.summary.ttttProduct}`);
  console.log(`- ttmProduct: ${result.summary.ttmProduct}`);
  console.log(`- dsgdSpread: ${result.summary.dsgdSpread}`);
  console.log(`- ttttSpread: ${result.summary.ttttSpread}`);
  console.log(`- ttmSpread: ${result.summary.ttmSpread}`);
  console.log(`- dsgdLme: ${result.summary.dsgdLme}`);
  console.log(`- ttttLme: ${result.summary.ttttLme}`);
  console.log(`- ttmLme: ${result.summary.ttmLme}`);
  console.log(`- dsgdOptions: ${result.summary.dsgdOptions}`);
  console.log(`- ttttOptions: ${result.summary.ttttOptions}`);
  console.log(`- ttmOptions: ${result.summary.ttmOptions}`);

  await app.close();
}

main().catch(console.error);
