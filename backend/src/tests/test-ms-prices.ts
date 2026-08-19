import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SystemSettingsService } from '../modules/system-settings/system-settings.service';
import { decrypt } from '../modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const DEBUG_DIR = path.join(process.cwd(), 'temp', 'debug', 'ms-prices-test');

async function screenshot(page: any, name: string) {
  const filePath = path.join(DEBUG_DIR, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true }).catch(() => { });
  console.log(`📸 Screenshot: ${filePath}`);
}

async function runMSPricesTest() {
  console.log('----------------------------------------------------');
  console.log('🚀 KHỞI CHẠY TỰ ĐỘNG ĐĂNG NHẬP M-SYSTEM & LẤY BẢNG GIÁ');
  console.log('----------------------------------------------------');

  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }

  // 1. Boot NestJS
  console.log('Đang kết nối cơ sở dữ liệu...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  let username = process.env.MS_USER;
  let password = process.env.MS_PASS;
  let pin = process.env.MS_PIN;
  let msystemUrl = process.env.MS_URL || 'https://msadmin.mxv.com.vn/';

  console.log('DEBUG: Environment variables:');
  console.log('- MS_USER:', username);
  console.log('- MS_PASS:', password ? '******' : undefined);
  console.log('- MS_PIN:', pin);
  console.log('- MS_URL:', process.env.MS_URL);

  if (!username || !password || !pin) {
    console.log('DEBUG: Reading credentials from DB system settings...');
    const allSettings = await settingsService.findAll();
    console.log(
      'DEBUG: All settings keys found in DB:',
      allSettings.map((s) => s.key),
    );
    const credentialsRaw = await settingsService.getSetting(
      'bot_credentials_msystem',
      '',
    );
    console.log(
      'DEBUG: bot_credentials_msystem raw length:',
      credentialsRaw ? credentialsRaw.length : 0,
    );
    if (credentialsRaw) {
      try {
        const decryptedStr = decrypt(credentialsRaw);
        console.log(
          'DEBUG: Decrypted credentials string length:',
          decryptedStr ? decryptedStr.length : 0,
        );
        const credentials = JSON.parse(decryptedStr);
        username = credentials.username;
        password = credentials.password;
        pin = credentials.pin;
        msystemUrl = credentials.url || msystemUrl;
        console.log('DEBUG: Decrypted fields:');
        console.log('- Username:', username);
        console.log('- Pin:', pin);
        console.log('- Url:', msystemUrl);
      } catch (err: any) {
        console.error(
          '❌ Lỗi giải mã thông tin tài khoản từ CSDL:',
          err.message,
        );
      }
    }
  }

  if (!username || !password || !pin) {
    console.log('\n❌ THẤT BẠI: Chưa cấu hình tài khoản M-System!');
    await app.close();
    process.exit(1);
  }

  console.log(`Tài khoản: ${username}`);
  console.log(`URL đăng nhập: ${msystemUrl}`);

  // Launch system Chrome
  const localAppData = process.env.LOCALAPPDATA || '';
  const chromePaths = [
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter((p) => fs.existsSync(p));

  const launchOptions: any = {
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--proxy-auto-detect',
    ],
    slowMo: 200,
  };
  if (chromePaths.length > 0) {
    launchOptions.executablePath = chromePaths[0];
    console.log(`✅ Chrome: ${chromePaths[0]}`);
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // Monitor network responses to capture the price list API
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('application/json') || url.includes('/api/')) {
      try {
        const json = await response.json();
        // Log clean JSON responses for analysis
        const cleanUrl = url.split('?')[0];
        console.log(`\n[API Response] URL: ${cleanUrl}`);
        // If the JSON contains list of commodities or price data, write it to a debug file
        const jsonStr = JSON.stringify(json, null, 2);
        if (
          url.includes('priceList') ||
          jsonStr.includes('price') ||
          jsonStr.includes('symbol') ||
          jsonStr.includes('code') ||
          jsonStr.includes('Settlement')
        ) {
          const apiFileName = cleanUrl.replace(/[^a-zA-Z0-9]/g, '_') + '.json';
          fs.writeFileSync(path.join(DEBUG_DIR, apiFileName), jsonStr, 'utf8');
          console.log(`⭐ Saved interesting API response to: ${apiFileName}`);
        }
      } catch { }
    }
  });

  try {
    console.log(`Đi tới trang đăng nhập: ${msystemUrl}...`);
    await page.goto(msystemUrl);
    await page.waitForLoadState('networkidle').catch(() => { });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-login-page');

    console.log('Nhập tài khoản và mật khẩu...');
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    await page.fill('input[name="username"]', username);
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', password);
    await page.waitForTimeout(1000);
    await screenshot(page, '02-credentials-entered');

    console.log('Nhấn nút Đăng nhập...');
    await page.click('button.btn-primary');
    await page.waitForTimeout(2000);

    console.log('Đang đợi bảng nhập mã PIN ảo hiển thị...');
    let pinSelectorVisible = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      pinSelectorVisible = await page
        .locator('div.pincode')
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (pinSelectorVisible) {
        console.log('✅ Đã hiển thị bảng PIN!');
        break;
      }
      console.log(
        `⚠️ Chưa hiển thị bảng PIN (lần thử ${attempt}), thử click lại nút Đăng nhập...`,
      );
      await screenshot(page, `02-retry-login-click-attempt-${attempt}`);
      await page.click('button.btn-primary').catch(() => { });
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('div.pincode', {
      state: 'visible',
      timeout: 10000,
    });
    await screenshot(page, '03-pin-page');

    // Click each pin digit
    console.log('Đang tự động click mã PIN ảo...');
    const pinDigits = pin.split('');
    for (const digit of pinDigits) {
      console.log(`- Click số: ${digit}`);
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      await page.waitForSelector(digitSelector, { state: 'visible' });
      await page.click(digitSelector);
      await page.waitForTimeout(500);
    }
    await screenshot(page, '04-pin-entered');

    console.log('Xác thực đăng nhập...');
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => { });
    await page.waitForTimeout(3000);
    await screenshot(page, '05-login-success');
    console.log('🎉 ĐĂNG NHẬP M-SYSTEM THÀNH CÔNG!');

    // ==========================================
    // TẢI FILE 1: Bảng giá (market.csv)
    // ==========================================
    const orderCreatingUrl = `${msystemUrl.split('#')[0]}#/orderManagement/orderCreating`;
    console.log(`\nĐiều hướng đến trang bảng giá: ${orderCreatingUrl}...`);
    await page.goto(orderCreatingUrl);
    await page.waitForTimeout(5000);
    await screenshot(page, '06-order-creating-page');

    console.log('Đang tìm nút tải CSV bảng giá (market.csv)...');
    const orderCreatingCsvSelectors = [
      'div.edit-icon i.fa-file-csv',
      'div.edit-icon',
      'i.fa-file-csv.green',
    ];

    let marketCsvDownloaded = false;
    for (const sel of orderCreatingCsvSelectors) {
      const isVisible = await page
        .locator(sel)
        .first()
        .isVisible()
        .catch(() => false);
      if (isVisible) {
        console.log(
          `👉 Tìm thấy nút xuất CSV Bảng giá: selector="${sel}". Đang tải...`,
        );
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25000 }),
            page.locator(sel).first().click(),
          ]);
          const downloadPath = path.join(DEBUG_DIR, 'market.csv');
          await download.saveAs(downloadPath);
          console.log(
            `✅ Đã tải và lưu thành công file CSV bảng giá: ${downloadPath}`,
          );
          marketCsvDownloaded = true;

          // Preview the downloaded CSV content
          if (fs.existsSync(downloadPath)) {
            const content = fs.readFileSync(downloadPath, 'utf8');
            const lines = content.split('\n');
            console.log('\n--- PREVIEW FILE CSV TẢI VỀ (10 DÒNG ĐẦU) ---');
            lines.slice(0, 10).forEach((line, idx) => {
              console.log(`Dòng ${idx + 1}: ${line}`);
            });
            console.log('--------------------------------------------\n');
          }
          break;
        } catch (downloadErr: any) {
          console.error(
            `❌ Lỗi khi tải bằng selector ${sel}:`,
            downloadErr.message,
          );
        }
      }
    }

    if (!marketCsvDownloaded) {
      console.log('⚠️ Không tải được file market.csv từ M-System.');
    }

    // ==========================================
    // TẢI FILE 2: Trạng thái mở (trang-thai-mo.xlsx)
    // ==========================================
    const openPositionUrl = `${msystemUrl.split('#')[0]}#/positionManagement/openPositionInfo`;
    console.log(`\nĐiều hướng đến trang trạng thái mở: ${openPositionUrl}...`);
    await page.goto(openPositionUrl);
    await page.waitForTimeout(5000);
    await screenshot(page, '07-open-position-page');

    console.log('Đang tìm nút tải XLSX trạng thái mở (trang-thai-mo.xlsx)...');
    const openPositionCsvSelectors = [
      'button.ladda-button:has(i.fa-file-csv)',
      'button.ladda-button i.fa-file-csv',
      'button.ladda-button',
      'i.fa-file-csv',
    ];

    let openPositionDownloaded = false;
    for (const sel of openPositionCsvSelectors) {
      const isVisible = await page
        .locator(sel)
        .first()
        .isVisible()
        .catch(() => false);
      if (isVisible) {
        console.log(
          `👉 Tìm thấy nút xuất Trạng thái mở: selector="${sel}". Đang tải...`,
        );
        try {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25000 }),
            page.locator(sel).first().click(),
          ]);
          const downloadPath = path.join(DEBUG_DIR, 'trang-thai-mo.xlsx');
          await download.saveAs(downloadPath);
          console.log(
            `✅ Đã tải và lưu thành công file trạng thái mở: ${downloadPath}`,
          );
          openPositionDownloaded = true;
          break;
        } catch (downloadErr: any) {
          console.error(
            `❌ Lỗi khi tải bằng selector ${sel}:`,
            downloadErr.message,
          );
        }
      }
    }

    if (!openPositionDownloaded) {
      console.log('⚠️ Không tải được file trang-thai-mo.xlsx từ M-System.');
    }
  } catch (err: any) {
    console.error('\n❌ Lỗi:', err.message);
    await screenshot(page, 'ERROR-final');
    const html = await page.content().catch(() => '');
    if (html) {
      fs.writeFileSync(path.join(DEBUG_DIR, 'ERROR-page.html'), html, 'utf8');
    }
  } finally {
    console.log('Đang đóng trình duyệt...');
    await browser.close();
    await app.close();
    console.log('Hoàn tất kiểm thử!');
  }
}

runMSPricesTest().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
