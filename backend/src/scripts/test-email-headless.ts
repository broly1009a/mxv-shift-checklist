import * as dotenv from 'dotenv';
dotenv.config();

// Run in headless mode to match the production/background behavior
process.env.HEADLESS_BOT = 'true';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { RpaDownloaderService } from '../modules/bot-engine/rpa-downloader.service';
import * as path from 'path';
import * as fs from 'fs';

async function run() {
  console.log('🚀 Booting NestJS Application Context (HEADLESS Mode)...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const rpaDownloader = appContext.get(RpaDownloaderService);

  const tempDir = path.join(process.cwd(), 'temp', 'test-email-headless');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const targetDate = '2026-07-22';
  console.log(
    `📅 Running email history report download test in headless mode for date: ${targetDate}`,
  );

  // We will intercept loginMSystem or modify page object to capture screenshots
  // Let's monkeypatch loginMSystem to get reference to the page or just handle it here
  const originalLogin = rpaDownloader.loginMSystem.bind(rpaDownloader);
  let activePage: any = null;

  rpaDownloader.loginMSystem = async function (
    downloadDir: string,
    overrideUrl?: string,
  ) {
    const result = await originalLogin(downloadDir, overrideUrl);
    activePage = result.page;
    return result;
  };

  try {
    const filePath = await rpaDownloader.downloadEmailHistoryReport(
      tempDir,
      targetDate,
    );
    console.log(`\n✅ SUCCESS! File downloaded: ${filePath}`);
  } catch (err: any) {
    console.error(`\n❌ FAILED:`, err.message);
    if (activePage) {
      const screenshotPath = path.join(tempDir, 'fail-screenshot.png');
      console.log(`Saving failure screenshot to: ${screenshotPath}`);
      await activePage.screenshot({ path: screenshotPath, fullPage: true });
    }
  } finally {
    await appContext.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
