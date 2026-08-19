import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GttCheckerService } from '../modules/bot-engine/gtt-checker.service';

async function bootstrap() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const gttService = app.get(GttCheckerService);

  console.log('Running runFullGttCheck with downloadMarketCsv: false...');
  try {
    const report = await gttService.runFullGttCheck({
      downloadMarketCsv: false,
    });
    console.log(
      '\n============================================================',
    );
    console.log('✅ TEST REPORT COMPLETED');
    console.log('============================================================');
    console.log(`Total contracts checked: ${report.totalContracts}`);
    console.log(`Matched: ${report.matched}`);
    console.log(`Diff count: ${report.diffCount}`);
    console.log(`MS Only count: ${report.msOnlyCount}`);
    console.log(`CQG Only count: ${report.cqgOnlyCount}`);
    console.log(
      '============================================================\n',
    );
  } catch (err: any) {
    console.error('❌ Service execution failed:', err);
  } finally {
    await app.close();
  }
}

bootstrap();
