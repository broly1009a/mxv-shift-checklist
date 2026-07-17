import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LotStatisticsService } from './modules/lot-statistics/lot-statistics.service';
import { ProcessLotDto } from './modules/lot-statistics/dto/lot-statistics.dto';
import * as path from 'path';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(LotStatisticsService);

  const baseDir = 'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke lot';
  const dailyMsDir = path.join(baseDir, 'Backup MS', '16.07');
  const dailyCqgDir = path.join(baseDir, 'Backup CQG', '16.07');

  console.log('Scanning daily directories...');
  const files = service.loadFilesFromDirectories(dailyMsDir, dailyCqgDir);

  const params: ProcessLotDto = {
    ngayGD: '2026-07-16',
    truDates: ['2026-07-03', '2026-07-02', '2026-07-01', '2026-06-30'],
    fefDates: ['2026-07-03', '2026-07-02'],
    zftDates: ['2026-07-03', '2026-07-02'],
    filterLmeKyHan: 'U26',
    deadline: 46217.208333,
    updateCumulative: true,
    pathDsgdCumulative: path.join(baseDir, 'DSGD T07.2026.xlsx'),
    pathNormal: path.join(baseDir, 'Thong ke so lot giao dich 2026 2.xlsx'),
    pathAcm: path.join(baseDir, 'Thong ke so lot giao dich ACM 2026 2.xlsx'),
    pathLme: path.join(baseDir, 'Thong ke so lot giao dich LME 2026.xlsx'),
    pathOptions: path.join(baseDir, 'Thong ke so lot giao dich Options 2026.xlsx'),
    pathSpread: path.join(baseDir, 'Thong ke so lot giao dich Spread 2026.xlsx'),
  };

  console.log('Running processLotStatistics in-place...');
  await service.processLotStatistics(files, params);
  console.log('Done running in-place!');

  await app.close();
}

main().catch(console.error);
