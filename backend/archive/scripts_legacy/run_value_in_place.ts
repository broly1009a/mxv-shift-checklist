import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValueStatisticsService } from './modules/lot-statistics/value-statistics.service';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(ValueStatisticsService);

  const baseDir =
    'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\Marco thong ke gia tri';
  const targetDate = new Date('2026-07-16');

  const payload = {
    ngayGD: '2026-07-16',
    macroPath:
      'c:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-shift-checklist\\marco\\Thong ke gia tri giao dich có ACM\\Macro thong ke gia tri giao dich có ACM.xlsm',
    targetRoot: baseDir,
    dsgdPath: path.join(baseDir, 'Backup MS', '16.07', 'DSGD.xlsx'),
    updateCumulative: true,
    pathNormal: path.join(baseDir, 'Thong ke gia tri giao dich 2026 1.xlsx'),
    pathAcm: path.join(baseDir, 'Thong ke gia tri giao dich ACM 2026 1.xlsx'),
    pathLme: path.join(baseDir, 'Thong ke gia tri giao dich LME 2026.xlsx'),
    pathOptions: path.join(
      baseDir,
      'Thong ke gia tri giao dich Options 2026.xlsx',
    ),
    pathSpread: path.join(
      baseDir,
      'Thong ke gia tri giao dich Spread 2026.xlsx',
    ),
  };

  console.log('Running processValueStatistics in-place...');
  const result = await service.processValueStatistics(targetDate, payload);
  console.log('Calculation and cumulative file updates completed!');

  // Export a Bot Check Report for trace/audit purposes
  const reportDir = path.join(baseDir, 'Bot_Check_Reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const reportPath = path.join(
    reportDir,
    'bot-check-value-report-20260716.json',
  );
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Generated Bot Check Report at: ${reportPath}`);

  await app.close();
}

main().catch(console.error);
