import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailWatcherService } from '../modules/bot-engine/email-watcher.service';

async function run() {
  console.log('🚀 Booting NestJS Application Context for M365 Email Watcher Test...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const emailWatcher = appContext.get(EmailWatcherService);

  try {
    console.log('Testing M365 checkEmailTaskDelegated with simulation = false...');
    // We will test connection by running checkEmailTaskDelegated with dummy target
    const target = '{"subject": "Job Snapshot", "sender": "anhdao@mxv.vn"}';
    const result = await emailWatcher.checkEmailTaskDelegated(target, 'thành công');
    console.log('\n--- SCAN RESULT ---');
    console.log(JSON.stringify(result, null, 2));

  } catch (err: any) {
    console.error(`\n❌ Error testing email watcher:`, err.message);
  } finally {
    await appContext.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
