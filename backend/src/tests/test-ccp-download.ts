import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

async function runCcpDownloadTest() {
  console.log('Booting NestJS application context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const settingsService = app.get(SystemSettingsService);

  const ccpRaw = await settingsService.getSetting('bot_credentials_ccp', '');
  if (!ccpRaw) {
    console.error('Chưa cấu hình tài khoản đăng nhập CCP.');
    await app.close();
    return;
  }
  const ccpCreds = JSON.parse(decrypt(ccpRaw));
  const ccpUrl = (ccpCreds.url || 'https://uat-coreccp.mxv.com.vn').replace(/\/login\/?$/, '').replace(/\/$/, '');

  const bundledPath = path.join(
    process.cwd(),
    '..',
    'it-tool-src',
    'operate-transaction-app',
    'Chrome',
    'chrome-win',
    'chrome.exe',
  );
  const executablePath = fs.existsSync(bundledPath) ? bundledPath : undefined;
  if (executablePath) {
    console.log(`Using bundled Chrome binary at: ${executablePath}`);
  } else {
    console.warn('Bundled Chrome binary not found. Will try default playwright path.');
  }

  console.log('Starting Playwright session (Headful Mode)...');
  const launchOptions: any = {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,800',
    ],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log(`Navigating to CCP Login: ${ccpUrl}/login`);
    await page.goto(`${ccpUrl}/login`);

    const userInputSelector = 'input#username, input[type="text"], input[name="username"]';
    const passInputSelector = 'input#password, input[type="password"], input[name="password"]';
    const submitBtnSelector = 'button.submit-button, button[type="submit"], button.btn-primary';

    await page.waitForSelector(userInputSelector, { state: 'visible' });
    await page.fill(userInputSelector, ccpCreds.username);
    await page.fill(passInputSelector, ccpCreds.password);
    await page.waitForTimeout(500);
    await page.click(submitBtnSelector);

    console.log('Waiting for login success...');
    const result = await Promise.race([
      page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 15000 }).then(() => 'success'),
      page.waitForSelector('text=Xin chào', { state: 'visible', timeout: 15000 }).then(() => 'success'),
      page.waitForSelector('.message-error', { state: 'visible', timeout: 15000 }).then(() => 'error'),
    ]);

    if (result === 'error') {
      const errorText = await page.locator('.message-error').innerText();
      throw new Error(`Đăng nhập thất bại: ${errorText}`);
    }

    console.log('Logged in successfully. URL is now:', page.url());
    await page.waitForTimeout(3000);

    const mmUrl = `${ccpUrl}/ORDERS/ORDERMATCH_DETAIL_MM`;
    console.log(`Navigating directly to MM Trades detail page: ${mmUrl}`);
    await page.goto(mmUrl);
    await page.waitForTimeout(3000);
    console.log('Current URL after navigation:', page.url());

    const destDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const destFile = path.join(destDir, 'DSGD MM CCP.xlsx');

    console.log('Clicking export excel button...');
    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });

    const exportBtn = page.locator('button:has-text("Kết xuất")').first();
    await exportBtn.waitFor({ state: 'visible', timeout: 10000 });

    console.log('Trying to hover or click to choose "Xuất tất cả"...');
    let clicked = false;
    try {
      await exportBtn.hover().catch(() => { });
      await page.waitForTimeout(1000);

      const exportAllBtn = page.getByText('Xuất tất cả').first();
      let isVisible = await exportAllBtn.isVisible().catch(() => false);

      if (!isVisible) {
        console.log('Dropdown not visible on hover, trying single click to open dropdown...');
        await exportBtn.click().catch(() => { });
        await page.waitForTimeout(1000);
        isVisible = await exportAllBtn.isVisible().catch(() => false);
      }

      if (isVisible) {
        console.log('Found "Xuất tất cả", clicking it...');
        await exportAllBtn.click();
        clicked = true;
      } else {
        console.log('"Xuất tất cả" dropdown option is still not visible.');
      }
    } catch (btnErr) {
      console.warn('Error trying to use dropdown menu:', btnErr);
    }

    if (!clicked) {
      console.log('Dropdown option not triggered, trying double click on "Kết xuất" button...');
      await exportBtn.dblclick({ delay: 150 }).catch(async (dblErr) => {
        console.warn('Double click failed, trying regular click as last resort:', dblErr);
        await exportBtn.click();
      });
    }

    const download = await downloadPromise;
    await download.saveAs(destFile);
    console.log(`DSGD MM CCP downloaded successfully to: ${destFile}`);

    // Capture screenshot to see if we reached the MM page
    const screenshotPath = path.join(process.cwd(), 'uploads', 'ccp-mm-navigation-test.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to: ${screenshotPath}`);

    // Wait 10 seconds for user to look at the screen
    console.log('Waiting 10 seconds in headful mode before closing...');
    await page.waitForTimeout(10000);

  } catch (err: any) {
    console.error('❌ Error during Playwright execution:', err);
    try {
      const errScreenshotPath = path.join(process.cwd(), 'uploads', 'ccp-mm-error.png');
      await page.screenshot({ path: errScreenshotPath });
      console.log(`Error screenshot saved to: ${errScreenshotPath}`);
    } catch (screenshotErr) {
      console.error('Failed to take error screenshot:', screenshotErr);
    }
  } finally {
    console.log('Closing browser...');
    await browser.close();
    await app.close();
    process.exit(0);
  }
}

runCcpDownloadTest().catch((err) => {
  console.error('❌ Execution failed:', err);
  process.exit(1);
});
