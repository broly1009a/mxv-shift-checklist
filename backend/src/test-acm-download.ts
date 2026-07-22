import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RpaDownloaderService } from './modules/bot-engine/rpa-downloader.service';
import * as path from 'path';
import * as fs from 'fs';

async function testAcm() {
  console.log('Booting NestJS application context for ACM test...');
  const app = await NestFactory.createApplicationContext(AppModule);

  const rpaDownloaderService = app.get(RpaDownloaderService);
  const tempDir = path.join(process.cwd(), 'temp', 'test-acm');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const jobLogs: string[] = [];
  console.log('Calling loginACM...');
  
  try {
    const { browser, page } = await rpaDownloaderService.loginACM(
      tempDir,
      async (base64Img) => {
        console.log('HUMAN-IN-THE-LOOP REQUIRED. Please check the image. Code requires manual input!');
        return 'MOCKED_CAPTCHA';
      },
      jobLogs
    );

    console.log('loginACM resolved successfully!');
    console.log('Logs so far:', jobLogs);

    console.log('Calling downloadAcmBackup...');
    await rpaDownloaderService.downloadAcmBackup(page, tempDir, jobLogs);
    console.log('downloadAcmBackup resolved successfully!');
    
    await browser.close();
  } catch (err: any) {
    console.error('ACM test failed with error:', err);
  } finally {
    console.log('Final job logs:', jobLogs);
    await app.close();
  }
}

testAcm().catch(console.error);
