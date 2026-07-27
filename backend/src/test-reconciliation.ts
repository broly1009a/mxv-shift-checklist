import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { decrypt } from './modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const DEBUG_DIR = path.join(
  process.cwd(),
  'temp',
  'debug',
  'reconciliation-test',
);

function step(msg: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚡ BƯỚC: ${msg}`);
  console.log('='.repeat(60));
}

async function screenshot(page: any, name: string) {
  const file = path.join(DEBUG_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch(() => {});
  console.log(`📸 Screenshot: ${file}`);
  return file;
}

/**
 * Parse market.csv from M-System to get mapping: symbol -> settlementPrice
 */
function parseMSMarketCsv(filePath: string): Map<string, number> {
  const map = new Map<string, number>();
  if (!fs.existsSync(filePath)) return map;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  if (lines.length < 2) return map;

  const headerLine = lines[0].replace(/^\uFEFF/, '').replace(/"/g, '');
  const headers = headerLine.split(',');
  const contractIdx = headers.findIndex(
    (h) => h.includes('Mã hợp đồng') || h.includes('Contract code'),
  );
  const settleIdx = headers.findIndex(
    (h) => h.includes('Giá thanh toán') || h.includes('Settlement price'),
  );

  console.log(
    `[CSV Parser] Mã hợp đồng Index: ${contractIdx}, Giá thanh toán Index: ${settleIdx}`,
  );

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line
      .split(',')
      .map((c) => c.replace(/^"/, '').replace(/"$/, '').trim());
    if (cells.length > Math.max(contractIdx, settleIdx)) {
      const symbol = cells[contractIdx];
      const priceStr = cells[settleIdx];
      const price = parseFloat(priceStr);
      if (symbol && !isNaN(price)) {
        map.set(symbol, price);
      }
    }
  }
  return map;
}

/**
 * Parse unique open contract symbols from M-System's trang-thai-mo.xlsx
 */
function parseUniqueMSContracts(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (data.length < 2) return [];

  const headers = data[0];
  const contractIndex = headers.indexOf('Mã HĐ');
  if (contractIndex === -1) {
    console.error('⚠️ Không tìm thấy cột "Mã HĐ" trong file Excel!');
    return [];
  }

  const uniqueContracts = new Set<string>();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row && row[contractIndex]) {
      uniqueContracts.add(row[contractIndex].toString().trim());
    }
  }
  return Array.from(uniqueContracts).sort();
}

/**
 * Add column S (Last settlement price) to the Quote Spreadsheet grid
 */
async function addSettlementColumn(page: any, batchNum: number): Promise<void> {
  console.log('\n📊 Thêm cột S (Settlement)...');

  // Wait for the grid header to be rendered and visible first
  await page
    .waitForSelector('.ag-header-cell[col-id="symbol"]', {
      state: 'visible',
      timeout: 10000,
    })
    .catch(() => {});

  const sColExists = await page
    .locator('[class*="column-header"]:has-text("S"), th:has-text("S")')
    .isVisible({ timeout: 2000 })
    .catch(() => false);
  if (sColExists) {
    console.log('✅ Cột S đã tồn tại, bỏ qua bước thêm cột.');
    return;
  }

  const headerSelectors = [
    '.ag-header-cell[col-id="symbol"]',
    '.ag-header-cell[col-id="trade"]',
    '.ag-header-cell[col-id="bid"]',
    '.ag-header-cell[col-id="ask"]',
    '.ag-header-cell[col-id="tradenc"]',
    '.ag-header-cell:has-text("Symbol")',
    '[role="columnheader"]:has-text("Symbol")',
  ];

  let headerClicked = false;
  for (const sel of headerSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
      console.log(`Right-click header: ${sel}`);
      await el.click({ button: 'right' });
      headerClicked = true;
      break;
    }
  }

  if (!headerClicked) {
    console.log(
      '⚠️ Không tìm thấy header để right-click, bỏ qua bước thêm cột S',
    );
    await screenshot(page, `tab${batchNum}-settlement-header-not-found`);
    return;
  }

  await page.waitForTimeout(1000);
  await screenshot(page, `tab${batchNum}-07-context-menu`);

  const ADD_COLUMNS_SEL =
    'wpfe-dropdown-menu-item-text:has-text("Add columns")';
  await page.waitForSelector(ADD_COLUMNS_SEL, {
    state: 'visible',
    timeout: 5000,
  });
  await page.click(ADD_COLUMNS_SEL);
  await page.waitForTimeout(1500);
  await screenshot(page, `tab${batchNum}-08-manage-columns-dialog`);
  console.log('✅ Mở Manage Columns dialog');

  const FILTER_INPUT =
    '.wpfe-column-picker-dialog-search-input input[placeholder="Type to filter"]';
  await page.waitForSelector(FILTER_INPUT, { state: 'visible', timeout: 8000 });
  await page.fill(FILTER_INPUT, 'Settlement');
  await page.waitForTimeout(1000);
  await screenshot(page, `tab${batchNum}-09-settlement-search`);
  console.log('✅ Đã tìm kiếm "Settlement" trong dialog');

  const S_ITEM_SELECTORS = [
    '.wpfe-list-item-content:has-text("Last settlement")',
    '.wpfe-list-item-name-content:has-text("S")',
    '.wpfe-focus-list-item:has-text("Last settlement")',
  ];

  let itemClicked = false;
  for (const sel of S_ITEM_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`Click item: ${sel}`);
      await el.click();
      itemClicked = true;
      break;
    }
  }

  if (!itemClicked) {
    console.log(
      '⚠️ Không click được cột S trong list, thử double click dòng đầu tiên',
    );
    await page.dblclick('.wpfe-list-item-content').catch(() => {});
  }

  await page.waitForTimeout(500);
  await screenshot(page, `tab${batchNum}-10-settlement-column-added`);

  // Click "Add + Close" button
  const ADD_CLOSE_BTN =
    'button:has-text("Add + Close"), .gpc-button-wrapper-content:has-text("Add + Close")';
  await page.waitForSelector(ADD_CLOSE_BTN, {
    state: 'visible',
    timeout: 5000,
  });
  await page.click(ADD_CLOSE_BTN);
  await page.waitForTimeout(2000);

  console.log('✅ Đã thêm cột S (Last settlement price)!');
}

/**
 * Scrape settlement prices from Quote Spreadsheet with scrolling support
 */
async function scrapeQSSPrices(
  page: any,
  resultsMap: Map<string, number>,
): Promise<void> {
  const viewportSelector = '.ag-body-viewport';
  const hasViewport = await page
    .locator(viewportSelector)
    .first()
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (hasViewport) {
    console.log(
      'Phát hiện viewport của grid. Bắt đầu cuộn để đọc dữ liệu virtualized...',
    );
    let previousCount = -1;
    let retries = 0;

    while (retries < 6) {
      const data = await page.evaluate(() => {
        const parseCQGPrice = (textVal: string | null) => {
          if (!textVal) return NaN;
          textVal = textVal.trim().replace(/,/g, '');
          if (textVal.includes("'")) {
            const parts = textVal.split("'");
            const isNegative = parts[0].startsWith('-');
            const main = Math.abs(parseFloat(parts[0]) || 0);
            const fraction = parseFloat(parts[1] || '0');
            const price = main + fraction / 8;
            return isNegative ? -price : price;
          }
          return parseFloat(textVal);
        };

        const batch: { symbol: string; price: number }[] = [];
        const symbolRows = document.querySelectorAll(
          '.ag-pinned-left-cols-container [role="row"]',
        );
        symbolRows.forEach((row) => {
          const rowId = row.getAttribute('row-id');
          const symbolEl = row.querySelector(
            '.wpfe-qss-symbol-cell-primary-text',
          );
          if (symbolEl && rowId) {
            const symbol = symbolEl.textContent.trim().split(/\s+/)[0];
            const settleRow = document.querySelector(
              `.ag-center-cols-container [row-id="${rowId}"]`,
            );
            if (settleRow) {
              const priceEl = settleRow.querySelector(
                '[col-id="settle"] .wpfe-price',
              );
              if (priceEl) {
                const price = parseCQGPrice(priceEl.textContent);
                if (!isNaN(price)) {
                  batch.push({ symbol, price });
                }
              }
            }
          }
        });
        return batch;
      });

      for (const item of data) {
        resultsMap.set(item.symbol, item.price);
      }

      if (resultsMap.size === previousCount) {
        retries++;
      } else {
        retries = 0;
        previousCount = resultsMap.size;
      }

      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel);
        if (el) el.scrollTop += 300;
      }, viewportSelector);

      await page.waitForTimeout(400);
    }

    await page.evaluate((sel: string) => {
      const el = document.querySelector(sel);
      if (el) el.scrollTop = 0;
    }, viewportSelector);
  } else {
    const data = await page.evaluate(() => {
      const parseCQGPrice = (textVal: string | null) => {
        if (!textVal) return NaN;
        textVal = textVal.trim().replace(/,/g, '');
        if (textVal.includes("'")) {
          const parts = textVal.split("'");
          const isNegative = parts[0].startsWith('-');
          const main = Math.abs(parseFloat(parts[0]) || 0);
          const fraction = parseFloat(parts[1] || '0');
          const price = main + fraction / 8;
          return isNegative ? -price : price;
        }
        return parseFloat(textVal);
      };

      const batch: { symbol: string; price: number }[] = [];
      const symbolRows = document.querySelectorAll(
        '.ag-pinned-left-cols-container [role="row"]',
      );
      symbolRows.forEach((row) => {
        const rowId = row.getAttribute('row-id');
        const symbolEl = row.querySelector(
          '.wpfe-qss-symbol-cell-primary-text',
        );
        if (symbolEl && rowId) {
          const symbol = symbolEl.textContent.trim().split(/\s+/)[0];
          const settleRow = document.querySelector(
            `.ag-center-cols-container [row-id="${rowId}"]`,
          );
          if (settleRow) {
            const priceEl = settleRow.querySelector(
              '[col-id="settle"] .wpfe-price',
            );
            if (priceEl) {
              const price = parseCQGPrice(priceEl.textContent);
              if (!isNaN(price)) {
                batch.push({ symbol, price });
              }
            }
          }
        }
      });
      return batch;
    });

    for (const item of data) {
      resultsMap.set(item.symbol, item.price);
    }
  }
}

async function runEndToEndReconciliation() {
  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }

  // 1. Boot NestJS Context to fetch settings/credentials (if needed)
  console.log('Đang khởi động kết nối cơ sở dữ liệu...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const settingsService = appContext.get(SystemSettingsService);

  // Get credentials from Env or fall back to DB
  let msUser = process.env.MS_USER;
  let msPass = process.env.MS_PASS;
  let msPin = process.env.MS_PIN;
  let msUrl = process.env.MS_URL || 'https://msadmin.mxv.com.vn/';

  let cqgUser = process.env.CQG_USER;
  let cqgPass = process.env.CQG_PASS;
  let cqgUrl =
    process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  if (!msUser || !msPass || !msPin || !cqgUser || !cqgPass) {
    console.log('Đang nạp cấu hình bảo mật từ cơ sở dữ liệu...');
    if (!msUser || !msPass || !msPin) {
      const msCredsRaw = await settingsService.getSetting(
        'bot_credentials_msystem',
        '',
      );
      if (msCredsRaw) {
        try {
          const creds = JSON.parse(decrypt(msCredsRaw));
          if (!msUser) msUser = creds.username;
          if (!msPass) msPass = creds.password;
          if (!msPin) msPin = creds.pin;
          if (creds.url) msUrl = creds.url;
        } catch {}
      }
    }

    if (!cqgUser || !cqgPass) {
      const cqgCredsRaw = await settingsService.getSetting(
        'bot_credentials_cqg',
        '',
      );
      if (cqgCredsRaw) {
        try {
          const creds = JSON.parse(decrypt(cqgCredsRaw));
          if (!cqgUser) cqgUser = creds.username;
          if (!cqgPass) cqgPass = creds.password;
          if (creds.url) cqgUrl = creds.url;
        } catch {}
      }
    }
  }

  if (!msUser || !msPass || !msPin || !cqgUser || !cqgPass) {
    console.error(
      '❌ Thiếu thông tin tài khoản đăng nhập MS hoặc CQG. Vui lòng kiểm tra lại cấu hình hoặc biến môi trường!',
    );
    process.exit(1);
  }

  console.log('Cấu hình đã nạp thành công!');

  const browser = await chromium.launch({
    headless: false, // Run headful for debug visibility
    executablePath:
      'C:\\Users\\hiepth\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const marketCsvPath = path.join(DEBUG_DIR, 'market.csv');
  const trangThaiMoPath = path.join(DEBUG_DIR, 'trang-thai-mo.xlsx');

  // =========================================================================
  // BƯỚC 1: ĐĂNG NHẬP M-SYSTEM & TẢI 2 FILE BÁO CÁO
  // =========================================================================
  step('Đăng nhập M-System');
  try {
    await page.goto(msUrl);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    await screenshot(page, '01-ms-login-page');

    console.log('Nhập tài khoản và mật khẩu...');
    await page.waitForSelector('input[name="username"]', { state: 'visible' });
    await page.fill('input[name="username"]', msUser);
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', msPass);
    await page.waitForTimeout(1000);
    await screenshot(page, '02-ms-credentials-entered');

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
      await screenshot(page, `02-ms-retry-login-click-attempt-${attempt}`);
      await page.click('button.btn-primary').catch(() => {});
      await page.waitForTimeout(2000);
    }

    await page.waitForSelector('div.pincode', {
      state: 'visible',
      timeout: 10000,
    });
    await screenshot(page, '03-ms-pin-page');

    console.log('Đang tự động click mã PIN ảo...');
    const pinDigits = msPin.split('');
    for (const digit of pinDigits) {
      console.log(`- Click số: ${digit}`);
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      await page.waitForSelector(digitSelector, { state: 'visible' });
      await page.click(digitSelector);
      await page.waitForTimeout(500);
    }
    await screenshot(page, '04-ms-pin-entered');

    console.log('Xác thực đăng nhập...');
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(3000);
    await screenshot(page, '05-ms-login-success');
    console.log('🎉 ĐĂNG NHẬP M-SYSTEM THÀNH CÔNG!');

    // TẢI FILE 1: Bảng giá (market.csv)
    const orderCreatingUrl = `${msUrl.split('#')[0]}#/orderManagement/orderCreating`;
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
          await download.saveAs(marketCsvPath);
          console.log(
            `✅ Đã tải và lưu thành công file CSV bảng giá: ${marketCsvPath}`,
          );
          marketCsvDownloaded = true;
          break;
        } catch (downloadErr: any) {
          console.error(
            `❌ Lỗi khi tải bằng selector ${sel}:`,
            downloadErr.message,
          );
        }
      }
    }

    // TẢI FILE 2: Trạng thái mở (trang-thai-mo.xlsx)
    const openPositionUrl = `${msUrl.split('#')[0]}#/positionManagement/openPositionInfo`;
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
          await download.saveAs(trangThaiMoPath);
          console.log(
            `✅ Đã tải và lưu thành công file trạng thái mở: ${trangThaiMoPath}`,
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

    if (!marketCsvDownloaded || !openPositionDownloaded) {
      throw new Error('Không tải đủ 2 file báo cáo cần thiết từ M-System!');
    }
  } catch (err: any) {
    console.error('❌ Lỗi M-System:', err.message);
    await browser.close();
    process.exit(1);
  }

  // =========================================================================
  // BƯỚC 2: TRÍCH XUẤT DANH SÁCH HỢP ĐỒNG MỞ TỪ FILE EXCEL
  // =========================================================================
  step('Trích xuất danh sách hợp đồng mở từ Excel');
  const symbols = parseUniqueMSContracts(trangThaiMoPath);
  console.log(
    `🔍 Tìm thấy ${symbols.length} mã hợp đồng đang có trạng thái mở.`,
  );
  if (symbols.length === 0) {
    console.error('❌ Không có mã hợp đồng nào để kiểm tra đối soát!');
    await browser.close();
    process.exit(1);
  }

  // =========================================================================
  // BƯỚC 3: ĐĂNG NHẬP CQG & LẤY GIÁ THANH TOÁN (QSS)
  // =========================================================================
  step('Mở CQG Desktop & lấy giá thanh toán');
  const cqgPricesMap = new Map<string, number>();

  try {
    console.log(`Đi tới trang đăng nhập CQG: ${cqgUrl}...`);
    await page.goto(cqgUrl);
    await page.waitForTimeout(3000);
    await screenshot(page, '08-cqg-login-page');

    console.log('Nhập tài khoản CQG...');
    await page.waitForSelector('input[name="userName"]', {
      state: 'visible',
      timeout: 20000,
    });
    await page.fill('input[name="userName"]', cqgUser);
    await page.fill('input[name="password"]', cqgPass);
    await screenshot(page, '09-cqg-credentials-entered');

    console.log('Bấm Login...');
    await page.click('button[type="submit"]');

    // Đợi login thành công
    await page.waitForSelector('div.wpfe-logo-image', {
      state: 'visible',
      timeout: 60000,
    });
    await page.waitForTimeout(3000);
    await screenshot(page, '10-cqg-login-success');
    console.log('✅ Đăng nhập CQG THÀNH CÔNG!');

    // CQG limits list to 100 symbols, we split into batches
    const BATCH_LIMIT = 95;
    const batches: string[][] = [];
    for (let i = 0; i < symbols.length; i += BATCH_LIMIT) {
      batches.push(symbols.slice(i, i + BATCH_LIMIT));
    }

    console.log(
      `Phân chia ${symbols.length} hợp đồng thành ${batches.length} batch(es) để đưa vào Quote Spreadsheet.`,
    );

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batchNum = batchIdx + 1;
      const batchSymbols = batches[batchIdx];
      const symbolStr = batchSymbols.join(', ');
      console.log(
        `\n--- BẮT ĐẦU BATCH ${batchNum}/${batches.length} (${batchSymbols.length} mã) ---`,
      );

      // 1. Click "+" add widget button
      console.log('Click nút "+"...');
      await page.waitForSelector('.wpfe-add-widget-btn', {
        state: 'visible',
        timeout: 15000,
      });
      await page.click('.wpfe-add-widget-btn');
      await page.waitForTimeout(2000);
      await screenshot(page, `tab${batchNum}-01-add-clicked`);

      // 2. Click "Quotes" in the left panel
      console.log('Click "Quotes"...');
      await page.waitForSelector('.wpfe-list-item:has-text("Quotes")', {
        state: 'visible',
        timeout: 10000,
      });
      await page.click('.wpfe-list-item:has-text("Quotes")');
      await page.waitForTimeout(1000);

      // 3. Click "Quote spreadsheet" widget
      console.log('Click "Quote spreadsheet"...');
      await page.waitForSelector('[data-widgetclass="wpfe-QuoteSpreadSheet"]', {
        state: 'visible',
        timeout: 10000,
      });
      await page.click('[data-widgetclass="wpfe-QuoteSpreadSheet"]');
      await page.waitForTimeout(3000);
      await screenshot(page, `tab${batchNum}-02-qss-opened`);

      // 4. Click "New list..."
      console.log('Click "New list..."...');
      await page.waitForSelector('button:has-text("New list")', {
        state: 'visible',
        timeout: 10000,
      });
      await page.click('button:has-text("New list")');
      await page.waitForTimeout(2000);
      await screenshot(page, `tab${batchNum}-03-new-list-dialog`);

      // 5. Fill search symbols
      const SEARCH_INPUT = 'input[placeholder="Search symbols"]';
      console.log(`Chờ ô "Search symbols"...`);
      await page.waitForSelector(SEARCH_INPUT, {
        state: 'visible',
        timeout: 15000,
      });
      console.log(`Nhập ${batchSymbols.length} symbols vào ô search...`);
      await page.fill(SEARCH_INPUT, symbolStr);
      await page.waitForTimeout(1500);
      await screenshot(page, `tab${batchNum}-04-symbols-filled`);

      // 6. Click OK
      const okBtn = page
        .locator(
          'button.wpfe-button-primary:has-text("OK"), button:has-text("OK")',
        )
        .first();
      await okBtn.click();
      await page.waitForTimeout(5000);
      await screenshot(page, `tab${batchNum}-05-qss-loaded`);

      // 7. Add Column S
      await addSettlementColumn(page, batchNum);

      // 8. Scrape prices
      console.log(`Đang quét giá cho Batch ${batchNum}...`);
      await scrapeQSSPrices(page, cqgPricesMap);
      console.log(
        `Batch ${batchNum} quét xong! Lũy kế đã có ${cqgPricesMap.size} giá từ CQG.`,
      );
    }
  } catch (err: any) {
    console.error('❌ Lỗi CQG:', err.message);
  } finally {
    await browser.close();
  }

  // =========================================================================
  // BƯỚC 4: ĐỐI CHIẾU GIÁ THANH TOÁN (RECONCILIATION)
  // =========================================================================
  step('Đối chiếu giá thanh toán (MS vs CQG)');
  const msPricesMap = parseMSMarketCsv(marketCsvPath);
  console.log(`📊 Đã đọc ${msPricesMap.size} mã giá thanh toán từ M-System.`);

  const report: {
    symbol: string;
    cqgPrice: number | string;
    msPrice: number | string;
    status: 'MATCH' | 'MISMATCH' | 'MISSING_IN_MS' | 'MISSING_IN_CQG';
    diff?: number;
  }[] = [];

  let matchCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;

  for (const symbol of symbols) {
    const cqgPrice = cqgPricesMap.get(symbol);
    const msPrice = msPricesMap.get(symbol);

    if (cqgPrice === undefined && msPrice === undefined) {
      continue;
    }

    if (cqgPrice === undefined) {
      report.push({
        symbol,
        cqgPrice: 'N/A',
        msPrice: msPrice!,
        status: 'MISSING_IN_CQG',
      });
      missingCount++;
      continue;
    }

    if (msPrice === undefined) {
      report.push({
        symbol,
        cqgPrice,
        msPrice: 'N/A',
        status: 'MISSING_IN_MS',
      });
      missingCount++;
      continue;
    }

    const diff = Math.abs(cqgPrice - msPrice);
    if (diff < 0.0001) {
      report.push({
        symbol,
        cqgPrice,
        msPrice,
        status: 'MATCH',
        diff: 0,
      });
      matchCount++;
    } else {
      report.push({
        symbol,
        cqgPrice,
        msPrice,
        status: 'MISMATCH',
        diff: cqgPrice - msPrice,
      });
      mismatchCount++;
    }
  }

  console.log('\n' + '#'.repeat(60));
  console.log('📊 BÁO CÁO ĐỐI CHIẾU GIÁ THANH TOÁN (GTT) HẰNG NGÀY');
  console.log('#'.repeat(60));
  console.log(`- Tổng số mã vị thế mở cần check: ${symbols.length}`);
  console.log(`- Khớp chính xác (MATCH):         ${matchCount}`);
  console.log(`- Lệch tỷ giá (MISMATCH):         ${mismatchCount}`);
  console.log(`- Thiếu thông tin (MISSING):      ${missingCount}`);
  console.log('-'.repeat(60));

  if (mismatchCount > 0) {
    console.log('🚨 DANH SÁCH CÁC MÃ BỊ LỆCH GIÁ:');
    report
      .filter((r) => r.status === 'MISMATCH')
      .forEach((r) => {
        console.log(
          `  👉 Mã: ${r.symbol} | CQG: ${r.cqgPrice} | MS: ${r.msPrice} | Lệch: ${r.diff}`,
        );
      });
  } else {
    console.log(
      '✅ TUYỆT VỜI! Tất cả các mã đều khớp giá hoàn hảo giữa M-System và CQG.',
    );
  }

  if (missingCount > 0) {
    console.log('\n⚠️ DANH SÁCH MÃ THIẾU THÔNG TIN TRÊN 1 HỆ THỐNG:');
    report
      .filter((r) => r.status.startsWith('MISSING'))
      .forEach((r) => {
        console.log(
          `  👉 Mã: ${r.symbol} | Trạng thái: ${r.status} | CQG: ${r.cqgPrice} | MS: ${r.msPrice}`,
        );
      });
  }
  console.log('#'.repeat(60) + '\n');

  // Save report JSON
  const reportPath = path.join(DEBUG_DIR, 'reconciliation-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        summary: {
          total: symbols.length,
          matched: matchCount,
          mismatched: mismatchCount,
          missing: missingCount,
          timestamp: new Date().toISOString(),
        },
        details: report,
      },
      null,
      2,
    ),
    'utf8',
  );

  console.log(`💾 Báo cáo chi tiết đã được lưu tại: ${reportPath}`);

  await appContext.close();
  process.exit(0);
}

runEndToEndReconciliation().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
