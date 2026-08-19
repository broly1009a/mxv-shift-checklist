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
  console.log('\n=== CALCULATED VALUES FOR 16-Jul-2026 ===');
  console.log('M-System LME:');
  console.log(`- dsgdLme: ${result.summary.dsgdLme}`);
  console.log(`- ttttLme (summary): ${result.summary.ttttLme}`);
  console.log(`- ttmLme: ${result.summary.ttmLme}`);

  console.log('CQG LME:');
  console.log(`- frLme: ${result.summary.frLme}`);
  console.log(`- psLme (summary): ${result.summary.psLme}`);
  console.log(`- opLme: ${result.summary.opLme}`);

  console.log('Extra info:');
  // Let's compute manually from the parsed rows in result
  console.log(`- frBreakdown:`, result.frBreakdown);

  await app.close();
}

main().catch(console.error);
