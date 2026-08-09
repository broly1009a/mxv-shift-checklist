import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { OmsWatcherService } from './modules/bot-engine/oms-watcher.service';

async function runOmsTest() {
  console.log('Force activating PLAYWRIGHT_HEADLESS=false for local visual check...');
  process.env.PLAYWRIGHT_HEADLESS = 'false';

  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const omsWatcherService = app.get(OmsWatcherService);

  console.log('Starting checkOmsStatus (Headful Mode: Chrome will open)...');
  try {
    const result = await omsWatcherService.checkOmsStatus();
    console.log('\n===========================================');
    console.log('KẾT QUẢ KIỂM TRA:');
    console.log(JSON.stringify(result, null, 2));
    console.log('===========================================');
  } catch (err: any) {
    console.error('❌ Lỗi thực thi checkOmsStatus:', err);
  } finally {
    console.log('Đang đóng NestJS Context...');
    await app.close();
    process.exit(0);
  }
}

runOmsTest().catch((err) => {
  console.error('❌ Oms Test execution failed:', err);
  process.exit(1);
});
