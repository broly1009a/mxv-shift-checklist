import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { decrypt } from './modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

async function runMSystemDownloadTest() {
  console.log('----------------------------------------------------');
  console.log('🚀 RUNNING M-SYSTEM REPORT DOWNLOAD TEST (PLAYWRIGHT)');
  console.log('----------------------------------------------------');

  console.log('Connecting to database and fetching credentials...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  let username = process.env.MS_USER;
  let password = process.env.MS_PASS;
  let pin = process.env.MS_PIN;
  let msystemUrl = 'https://msadmin.mxv.com.vn/'; // Defaulting to the admin URL from user screenshots

  const credentialsRaw = await settingsService.getSetting(
    'bot_credentials_msystem',
    '',
  );
  if (credentialsRaw) {
    try {
      const credentials = JSON.parse(decrypt(credentialsRaw));
      username = username || credentials.username;
      password = password || credentials.password;
      pin = pin || credentials.pin;
      msystemUrl = credentials.url || msystemUrl;
    } catch (err) {
      console.error(
        '❌ Error decrypting bot credentials from DB:',
        err.message,
      );
    }
  }

  if (!username || !password || !pin) {
    console.error('❌ M-System credentials not configured in DB or Env.');
    await app.close();
    process.exit(1);
  }

  console.log(`Detected Username: ${username}`);
  console.log(`Target Portal URL: ${msystemUrl}`);
  console.log('Launching browser in HEADFUL mode...');

  const launchOptions: any = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };

  const bundledPath = path.join(
    process.cwd(),
    '..',
    'it-tool-src',
    'operate-transaction-app',
    'Chrome',
    'chrome-win',
    'chrome.exe',
  );

  if (fs.existsSync(bundledPath)) {
    console.log(`Phát hiện Chrome tích hợp tại: ${bundledPath}`);
    launchOptions.executablePath = bundledPath;
  } else {
    console.log(
      'Không tìm thấy Chrome tích hợp. Sử dụng trình duyệt mặc định.',
    );
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Helper to click export button and download file
  async function downloadExcel(
    targetUrl: string,
    destFileName: string,
    pageType: string,
  ) {
    console.log(`\nNavigating to ${pageType} page: ${targetUrl}...`);
    await page.goto(targetUrl);
    await page.waitForTimeout(4000); // Wait for data to render

    console.log('Debugging buttons on page:');
    const buttons = await page.$$('button');
    let exportBtn = null;

    for (let i = 0; i < buttons.length; i++) {
      const text = (await buttons[i].innerText()).trim();
      const cls = await buttons[i].getAttribute('class');
      const title = await buttons[i].getAttribute('title');
      const icon = await buttons[i].$('i');
      const iconCls = icon ? await icon.getAttribute('class') : '';

      console.log(
        `- Button ${i}: text="${text}", title="${title}", class="${cls}", iconClass="${iconCls}"`,
      );

      // Match the export button by standard attributes
      if (
        (iconCls &&
          (iconCls.includes('document') ||
            iconCls.includes('download') ||
            iconCls.includes('export') ||
            iconCls.includes('csv') ||
            iconCls.includes('excel') ||
            iconCls.includes('file'))) ||
        (title &&
          (title.toLowerCase().includes('export') ||
            title.toLowerCase().includes('download') ||
            title.toLowerCase().includes('csv') ||
            title.toLowerCase().includes('excel'))) ||
        text.toLowerCase().includes('export') ||
        text.toLowerCase().includes('tải')
      ) {
        if (!exportBtn) {
          exportBtn = buttons[i];
          console.log(`👉 Selected Button ${i} as Export Button`);
        }
      }
    }

    // Fallback: if no exportBtn found, select the blue one next to green/red in the header
    if (!exportBtn) {
      console.log(
        'Fallback: attempting to locate button by blue/teal document class...',
      );
      const fallbackLocators = [
        'button:has(i.el-icon-document)',
        'button:has(i.el-icon-download)',
        'button.el-button--primary:has(i)',
        '.el-card__header button',
      ];
      for (const sel of fallbackLocators) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible().catch(() => false)) {
          exportBtn = btn;
          console.log(`👉 Selected fallback button via selector: ${sel}`);
          break;
        }
      }
    }

    if (!exportBtn) {
      throw new Error(`Could not find export button on ${pageType} page.`);
    }

    // Download wait
    console.log('Clicking Export/Download button...');
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;

    const tempDir = path.join(process.cwd(), 'temp', 'downloads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const destPath = path.join(tempDir, destFileName);
    await download.saveAs(destPath);
    console.log(`✅ SUCCESS: Downloaded and saved report to: ${destPath}`);
  }

  try {
    // 1. LOGIN FLOW
    console.log(`Going to login page: ${msystemUrl}...`);
    await page.goto(msystemUrl);

    console.log('Filling username and password...');
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);

    console.log('Clicking login...');
    await page.click('button.btn-primary');

    console.log('Waiting for virtual PIN board...');
    await page.waitForSelector('div.pincode', {
      state: 'visible',
      timeout: 15000,
    });

    console.log('Entering PIN digits...');
    const pinDigits = pin.split('');
    for (const digit of pinDigits) {
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      await page.waitForSelector(digitSelector, { state: 'visible' });
      await page.click(digitSelector);
      await page.waitForTimeout(500);
    }

    console.log('Verifying login redirection...');
    await page.waitForSelector(
      'xpath=.//div[contains(text(),"Ngày phiên hiện tại:")]',
      {
        state: 'visible',
        timeout: 20000,
      },
    );
    console.log('🎉 Login successful!');

    // 2. DOWNLOAD PAGE 1: OPEN POSITIONS
    const positionsUrl =
      'https://msadmin.mxv.com.vn/#/positionManagement/openPositionInfo';
    await downloadExcel(positionsUrl, 'open_positions.xlsx', 'Open Positions');

    // 3. DOWNLOAD PAGE 2: ORDER LIST (PENDING ORDERS)
    const ordersUrl = 'https://msadmin.mxv.com.vn/#/orderManagement/orderList';
    console.log(`\nNavigating to Orders page: ${ordersUrl}...`);
    await page.goto(ordersUrl);
    await page.waitForTimeout(4000); // Wait for tabs to render

    console.log('Searching for tab containing "Lệnh chờ khớp" on page...');
    const matches = await page.evaluate(() => {
      const elms = Array.from(document.querySelectorAll('*'));
      return elms
        .filter(
          (el) =>
            el.textContent &&
            el.textContent.includes('Lệnh') &&
            el.children.length === 0,
        )
        .map((el) => ({
          tagName: el.tagName,
          className: el.className,
          textContent: el.textContent ? el.textContent.trim() : '',
        }));
    });
    console.log('Matches found for "Lệnh":', JSON.stringify(matches, null, 2));

    console.log('Clicking tab "Lệnh chờ khớp" (Pending orders)...');
    let tabClicked = false;
    const tabSelectors = [
      'div.el-tabs__item:has-text("Lệnh chờ khớp")',
      'xpath=//div[contains(@class, "el-tabs__item") and contains(text(), "Lệnh chờ khớp")]',
      'xpath=//div[contains(text(), "Lệnh chờ khớp")]',
      'text="Lệnh chờ khớp"',
    ];
    for (const sel of tabSelectors) {
      if (
        await page
          .locator(sel)
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await page.click(sel);
        console.log(`Successfully clicked tab using selector: ${sel}`);
        tabClicked = true;
        break;
      }
    }
    if (!tabClicked) {
      console.log(
        '⚠️ Could not find "Lệnh chờ khớp" tab by standard selectors. Trying fallback click...',
      );
      await page
        .click('text="Lệnh chờ khớp"')
        .catch((e) => console.log('Fallback click failed:', e.message));
    }
    await page.waitForTimeout(4000); // Wait for table to reload

    // Run download for orders list page
    await downloadExcel(ordersUrl, 'pending_orders.xlsx', 'Pending Orders');

    console.log('\n🎉 ALL DOWNLOADS COMPLETED SUCCESSFULLY!');
    console.log(
      'Keeping browser open for 15 seconds so you can verify the downloads...',
    );
    await page.waitForTimeout(15000);
  } catch (err: any) {
    console.error('\n❌ Error occurred during automation:', err.message);
  } finally {
    console.log('Closing browser...');
    await browser.close();
    console.log('Disconnecting from database...');
    await app.close();
    console.log('Completed!');
  }
}

runMSystemDownloadTest().catch((err) => {
  console.error('❌ Test execution failed:', err);
  process.exit(1);
});
