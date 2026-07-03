/**
 * TEST SCRIPT: CQG Quote Spreadsheet - 2 Tab Batch Flow
 * - Tab 1: Batch 1 (≤100 symbols)
 * - Tab 2: Batch 2 (remaining symbols)
 * Chạy: CQG_URL="..." CQG_USER="mxvprice" CQG_PASS='M#x!v@202502' npm.cmd run test:cqg-qss
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SystemSettingsService } from './modules/system-settings/system-settings.service';
import { decrypt } from './modules/bot-engine/utils/crypto';
import { chromium } from 'playwright-core';
import * as path from 'path';
import * as fs from 'fs';

const DEBUG_DIR = path.join(process.cwd(), 'temp', 'debug', 'cqg-qss-test');
const BATCH_SIZE = 100;

// =========================================================
// Full list of 130 contracts (provided by user)
// =========================================================
const ALL_SYMBOLS = [
  'ALIQ26','ALIU26','ALIZ26','C.ZCEQ264400','C.ZCEU264500','C.ZCEU264550','C.ZCEV264600',
  'CCEH27','CCEU26','CP2COQ26','CP2COU26','CP2COV26','CPEF27','CPEQ26','CPEU26','CPEX26',
  'CPEZ26','CTEH27','CTEV26','CTEZ26','FEFU26','FEFV26','FEFZ26','KCEH27','KCEU26','KCEZ26',
  'KWEH27','KWEK27','KWEU26','KWEZ26','LRCF27','LRCH27','LRCK27','LRCU26','LRCX26',
  'MHGH27','MHGK27','MHGQ26','MHGU26','MHGV26','MHGZ26','MPOU26','MQCU26','MZCH27',
  'MZCU26','MZCZ26','MZLU26','MZLV26','MZLZ26','MZMU26','MZMV26','MZMZ26','MZSF27',
  'MZSH27','MZSU26','MZSX26','MZWU26','MZWZ26','P.ZCEQ263900','P.ZCEU263850',
  'PL1NYF27','PL1NYJ27','PL1NYN27','PL1NYV26','PLEF27','PLEV26','QWH27','QWV26','QWZ26',
  'SBEH27','SBEK27','SBEV26','SI5COF27','SI5COH27','SI5COU26','SI5COZ26','SILF27',
  'SILH27','SILK27','SILQ26','SILU26','SILZ26','SNDD22U26','SNDD23U26','TRUN26','TRUU26',
  'XBF27','XBQ26','XBU26','XBX26','XCH27','XCU26','XCZ26','XWH27','XWK27','XWU26',
  'XWZ26','ZCEH27','ZCEK27','ZCEU26',
  // --- Batch 2 starts here ---
  'ZCEZ26','ZDSD04U26','ZDSD13Q26','ZFTQ26','ZFTU26','ZFTV26','ZFTX26','ZFTZ26',
  'ZLEF27','ZLEH27','ZLEK27','ZLEN26','ZLEQ26','ZLEU26','ZLEV26','ZLEZ26',
  'ZMEH27','ZMEQ26','ZMEU26','ZMEV26','ZMEZ26','ZSEH27','ZSEK27','ZSEQ26',
  'ZSEU26','ZSEX26','ZWAH27','ZWAK27','ZWAU26','ZWAZ26',
];

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
 * Right-click QSS column header → Add columns → Search "Settlement" → Select S → Add + Close
 * Only needed once per tab. If S column already visible, skip.
 */
async function addSettlementColumn(page: any, batchNum: number): Promise<void> {
  console.log('\n📊 Thêm cột S (Settlement)...');

  // Check if S column already exists
  const sColExists = await page.locator('[class*="column-header"]:has-text("S"), th:has-text("S")').isVisible({ timeout: 2000 }).catch(() => false);
  if (sColExists) {
    console.log('✅ Cột S đã tồn tại, bỏ qua bước thêm cột.');
    return;
  }

  // Right-click on the column header area (try "Symbol" header text first)
  const headerSelectors = [
    'th:has-text("Symbol")',
    '[role="columnheader"]:has-text("Symbol")',
    '[class*="column-header"]:has-text("Symbol")',
    '[class*="grid-header"]',
    '.wpfe-quote-spread-sheet-header',
  ];

  let headerClicked = false;
  for (const sel of headerSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`Right-click header: ${sel}`);
      await el.click({ button: 'right' });
      headerClicked = true;
      break;
    }
  }

  if (!headerClicked) {
    console.log('⚠️  Không tìm thấy header để right-click, bỏ qua bước thêm cột S');
    await screenshot(page, `tab${batchNum}-settlement-header-not-found`);
    return;
  }

  await page.waitForTimeout(1000);
  await screenshot(page, `tab${batchNum}-07-context-menu`);

  // Click "Add columns..." in context menu
  await page.waitForSelector('text=Add columns', { state: 'visible', timeout: 5000 });
  await page.click('text=Add columns');
  await page.waitForTimeout(1500);
  await screenshot(page, `tab${batchNum}-08-manage-columns-dialog`);
  console.log('✅ Mở Manage Columns dialog');

  // Search for "Settlement" in the DIALOG filter input ONLY
  // Key: use wpfe-column-picker-dialog-search-input to avoid filling the QSS toolbar filter
  const FILTER_INPUT = '.wpfe-column-picker-dialog-search-input input[placeholder="Type to filter"]';
  await page.waitForSelector(FILTER_INPUT, { state: 'visible', timeout: 8000 });
  await page.fill(FILTER_INPUT, 'Settlement');
  await page.waitForTimeout(1000);
  await screenshot(page, `tab${batchNum}-09-settlement-search`);
  console.log('✅ Đã tìm kiếm "Settlement" trong dialog');

  // Click the "S" item (Last settlement price)
  const S_ITEM_SELECTORS = [
    '.wpfe-list-item-content:has-text("Last settlement")',
    '.wpfe-list-item-name-content:has-text("S")',
    '.wpfe-focus-list-item:has-text("Last settlement")',
  ];

  let itemClicked = false;
  for (const sel of S_ITEM_SELECTORS) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      itemClicked = true;
      console.log(`✅ Đã chọn cột S: ${sel}`);
      break;
    }
  }

  if (!itemClicked) {
    console.log('⚠️  Không tìm thấy item "S (Last settlement price)"');
    await screenshot(page, `tab${batchNum}-settlement-item-not-found`);
    await page.keyboard.press('Escape');
    return;
  }

  await page.waitForTimeout(500);

  // Click "Add + Close" button
  const ADD_CLOSE_BTN = 'button:has-text("Add + Close"), .gpc-button-wrapper-content:has-text("Add + Close")';
  await page.waitForSelector(ADD_CLOSE_BTN, { state: 'visible', timeout: 5000 });
  await page.click(ADD_CLOSE_BTN);
  await page.waitForTimeout(2000);
  await screenshot(page, `tab${batchNum}-10-settlement-column-added`);
  console.log('✅ Đã thêm cột S (Last settlement price)!');
}


async function openQSSTabWithSymbols(page: any, symbols: string[], batchNum: number): Promise<void> {
  const label = `Batch ${batchNum} (${symbols.length} symbols)`;
  const symbolStr = symbols.join(', ');

  step(`Mở QSS Tab ${batchNum}: ${label}`);
  console.log(`Symbols: ${symbolStr.substring(0, 80)}...`);

  // 1. Click "+" add widget button
  console.log('Click nút "+"...');
  await page.waitForSelector('.wpfe-add-widget-btn', { state: 'visible', timeout: 15000 });
  await page.click('.wpfe-add-widget-btn');
  await page.waitForTimeout(2000);
  await screenshot(page, `tab${batchNum}-01-add-clicked`);

  // 2. Click "Quotes" in the left panel
  console.log('Click "Quotes"...');
  await page.waitForSelector('.wpfe-list-item:has-text("Quotes")', { state: 'visible', timeout: 10000 });
  await page.click('.wpfe-list-item:has-text("Quotes")');
  await page.waitForTimeout(1000);

  // 3. Click "Quote spreadsheet" widget (unique selector: data-widgetclass)
  console.log('Click "Quote spreadsheet"...');
  await page.waitForSelector('[data-widgetclass="wpfe-QuoteSpreadSheet"]', { state: 'visible', timeout: 10000 });
  await page.click('[data-widgetclass="wpfe-QuoteSpreadSheet"]');
  await page.waitForTimeout(3000);
  await screenshot(page, `tab${batchNum}-02-qss-opened`);

  // 4. In "Open a list" dialog → click "New list..."
  console.log('Click "New list..."...');
  await page.waitForSelector('button:has-text("New list")', { state: 'visible', timeout: 10000 });
  await page.click('button:has-text("New list")');
  await page.waitForTimeout(2000);
  await screenshot(page, `tab${batchNum}-03-new-list-dialog`);

  // 5. Fill "Search symbols" input with comma-separated list
  // This input is NOT readonly (confirmed from HTML), so fill() works directly
  const SEARCH_INPUT = 'input[placeholder="Search symbols"]';
  console.log(`Chờ ô "Search symbols"...`);
  await page.waitForSelector(SEARCH_INPUT, { state: 'visible', timeout: 15000 });

  console.log(`Nhập ${symbols.length} symbols vào ô search...`);
  await page.fill(SEARCH_INPUT, symbolStr);
  await page.waitForTimeout(1500);
  await screenshot(page, `tab${batchNum}-04-symbols-filled`);
  console.log('✅ Đã nhập symbol list!');

  // 6. Click "OK" button to confirm the list
  // Note: OK button becomes enabled after typing
  const OK_BTN = 'button:has-text("OK"), .wpfe-text-input-button:has-text("OK")';
  const okVisible = await page.locator(OK_BTN).isVisible({ timeout: 3000 }).catch(() => false);

  if (okVisible) {
    console.log('Click "OK"...');
    await page.click(OK_BTN);
    await page.waitForTimeout(3000);
    await screenshot(page, `tab${batchNum}-05-after-ok`);
    console.log('✅ Đã click OK!');
  } else {
    // Try pressing Enter as alternative
    console.log('⚠️  OK button not found/visible, thử nhấn Enter...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await screenshot(page, `tab${batchNum}-05-after-enter`);
  }

  // 7. Wait for Quote Spreadsheet to load with the symbols
  console.log(`Chờ QSS Tab ${batchNum} load dữ liệu (5 giây)...`);
  await page.waitForTimeout(5000);
  await screenshot(page, `tab${batchNum}-06-qss-loaded`);

  // 8. Add settlement column "S" via right-click → Manage Columns
  await addSettlementColumn(page, batchNum);

  await screenshot(page, `tab${batchNum}-FINAL`);
  console.log(`✅ QSS Tab ${batchNum} hoàn tất!`);
}

async function runCQGQSSTest() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 CQG QSS 2-BATCH TEST (HEADFUL)');
  console.log(`📊 Tổng: ${ALL_SYMBOLS.length} symbols → ${Math.ceil(ALL_SYMBOLS.length / BATCH_SIZE)} tab(s)`);
  console.log('='.repeat(60) + '\n');

  if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR, { recursive: true });
  }

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < ALL_SYMBOLS.length; i += BATCH_SIZE) {
    batches.push(ALL_SYMBOLS.slice(i, i + BATCH_SIZE));
  }
  console.log(`Batch plan: ${batches.map((b, i) => `Tab${i + 1}=${b.length}mã`).join(', ')}`);

  // Boot NestJS for DB credentials
  step('Kết nối cơ sở dữ liệu...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const settingsService = app.get(SystemSettingsService);

  let username = process.env.CQG_USER;
  let password = process.env.CQG_PASS;
  let cqgUrl = process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  if (!username || !password) {
    const credentialsRaw = await settingsService.getSetting('bot_credentials_cqg', '');
    if (credentialsRaw) {
      try {
        const creds = JSON.parse(decrypt(credentialsRaw));
        username = creds.username;
        password = creds.password;
        cqgUrl = creds.url || cqgUrl;
      } catch {}
    }
  }

  if (!username || !password) {
    console.log('❌ Chưa cấu hình tài khoản CQG.');
    await app.close();
    process.exit(1);
  }

  // Launch system Chrome
  step('Khởi chạy Chrome...');
  const localAppData = process.env.LOCALAPPDATA || '';
  const chromePaths = [
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter(p => fs.existsSync(p));

  const launchOptions: any = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized', '--proxy-auto-detect'],
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

  try {
    // Login CQG
    step('Đăng nhập CQG...');
    await page.goto(cqgUrl);
    await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 20000 });
    await page.fill('input[name="userName"]', username!);
    await page.fill('input[name="password"]', password!);
    await page.click('button[type="submit"]');
    await page.waitForSelector('div.wpfe-logo-image', { state: 'visible', timeout: 60000 });
    await screenshot(page, '00-login-success');
    console.log('✅ Đăng nhập THÀNH CÔNG!');
    await page.waitForTimeout(3000);

    // Open QSS tab for each batch
    for (let i = 0; i < batches.length; i++) {
      await openQSSTabWithSymbols(page, batches[i], i + 1);

      if (i < batches.length - 1) {
        console.log('\n⏸ Dừng 3 giây trước khi mở tab tiếp theo...');
        await page.waitForTimeout(3000);
      }
    }

    // Final state
    await screenshot(page, 'FINAL-both-tabs-loaded');
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST 2 TAB HOÀN TẤT!');
    console.log('='.repeat(60));
    console.log(`📁 Screenshots: ${DEBUG_DIR}`);
    console.log('\n⏸ Chờ 30 giây để bạn kiểm tra kết quả trên trình duyệt...');
    await page.waitForTimeout(30000);

  } catch (err: any) {
    console.error(`\n❌ Lỗi: ${err.message}`);
    await screenshot(page, 'ERROR-final').catch(() => {});
    const html = await page.content().catch(() => '');
    if (html) fs.writeFileSync(path.join(DEBUG_DIR, 'ERROR-page.html'), html, 'utf8');
  } finally {
    await browser.close();
    await app.close();
    console.log('Hoàn tất!');
  }
}

runCQGQSSTest().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
