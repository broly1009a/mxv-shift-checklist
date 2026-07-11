/**
 * SCRIPT: CQG CAST - Tự động đăng nhập và tải Accounts_Balances.xlsx
 *
 * PHÂN TÍCH doLogon() từ Logon.js.asp:
 * ─────────────────────────────────────
 * 1. localeinfoproviderObj (ActiveX): CHỈ trong try/catch, không critical
 *    → Đây là NGUYÊN NHÂN crash trên Chrome, nhưng CAN BE MOCKED
 *
 * 2. Flow login thực sự là AJAX 2 bước:
 *    a. POST /CAST/Logon/Logon/GetLogonParams     → { useAuthServer: bool }
 *    b. POST /CAST/Logon/Logon/InitializeTwoStepLogon → { routineId, encodingType, ... }
 *    c. Cast.LoginPassword.encodePassword(pass, type, params) → encodedPassword
 *    d. POST /CAST/Logon/Logon/FinishTwoStepLogon → redirect nếu thành công
 *
 * 3. CSRF token gửi qua HTTP Header (không phải form field)
 *    → RequestManager.js set header trước mỗi AJAX call
 *
 * GIẢI PHÁP BYPASS:
 * ─────────────────
 * Dùng Playwright, inject mock localeinfoproviderObj vào window TRƯỚC khi page JS chạy.
 * Sau đó gọi doLogon() bình thường - nó sẽ dùng AJAX của trang, hoàn toàn hợp lệ.
 * Không cần IE Mode.
 *
 * Chạy:
 *   $env:CAST_USER="mxvhoangvan"; $env:CAST_PASS="mat_khau"; npm.cmd run test:cast-download
 *
 * Explore mode (giữ browser mở 90s sau login):
 *   $env:CAST_EXPLORE="1"; $env:CAST_USER="mxvhoangvan"; $env:CAST_PASS="mat_khau"; npm.cmd run test:cast-download
 */

import * as path from 'path';
import * as fs from 'fs';
import { chromium } from 'playwright-core';

// ─── Config ──────────────────────────────────────────────────────────────────
const CAST_BASE    = 'https://www.cqgtrader.com';
const LOGIN_URL    = `${CAST_BASE}/CAST/Logon/Logon.asp`;
const DOWNLOAD_DIR = path.join(process.cwd(), 'temp', 'cast-downloads');
const DEBUG_DIR    = path.join(process.cwd(), 'temp', 'debug', 'cast');
const EXPLORE_MODE = process.env.CAST_EXPLORE === '1';
const USERNAME     = process.env.CAST_USER || '';
const PASSWORD     = process.env.CAST_PASS || '';

// Filter values cho Accounts: Balances report
const FCM_VALUE    = process.env.CAST_FCM  || 'MXV';
const CCY_VALUE    = process.env.CAST_CCY  || 'USD';
const DESC_VALUE   = process.env.CAST_DESC || 'current';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString('vi-VN')}] ${msg}`);
}
function step(msg: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`⚡ ${msg}`);
  console.log('─'.repeat(60));
}
async function screenshot(page: any, name: string) {
  const file = path.join(DEBUG_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch(() => {});
  log(`📸 ${file}`);
}
async function saveHTML(page: any, name: string) {
  const file = path.join(DEBUG_DIR, `${name}.html`);
  const html = await page.content().catch(() => '');
  if (html) fs.writeFileSync(file, html, 'utf8');
}

// ─── Script inject vào browser: mock IE-specific objects ─────────────────────
// Đây là đoạn JS sẽ được inject vào page TRƯỚC khi Logon.js.asp chạy
// Mục đích: bypass lỗi "Cannot read properties of undefined" của localeinfoproviderObj
const IE_MOCK_SCRIPT = `
  // Mock localeinfoproviderObj (IE ActiveX COM object)
  // Trong doLogon(), nó nằm trong try/catch nên crash không sao,
  // nhưng để sạch hơn, ta cung cấp object giả với các properties cần thiết
  if (typeof window.localeinfoproviderObj === 'undefined') {
    window.localeinfoproviderObj = {
      ShortDateFormat:   'MM/dd/yyyy',
      TimeFormat:        'hh:mm:ss tt',    // 12h format (không chứa 'H' → Use12HourFormat = true)
      DecimalPoint:      '.',
      ThousandSeparator: ',',
      DigitsGrouping:    '3;0',
      DigitsAfterDecimal: 2
    };
  }

  // Mock window.event (IE-specific global event object)
  // Dùng trong UNIKeyPress() - chỉ là keypress handler, không ảnh hưởng login
  if (typeof window.event === 'undefined') {
    Object.defineProperty(window, 'event', {
      get: function() { return { keyCode: 0 }; },
      configurable: true
    });
  }

  console.log('[IE-MOCK] Injected: localeinfoproviderObj + window.event');
`;

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('🚀 CQG CAST - Tự động tải Accounts_Balances.xlsx');
  console.log(`👤 User: ${USERNAME || '(chưa cung cấp)'}`);
  console.log(`🔧 Mode: ${EXPLORE_MODE ? 'EXPLORE (giữ browser 90s)' : 'DOWNLOAD'}`);
  console.log('═'.repeat(60) + '\n');

  if (!USERNAME || !PASSWORD) {
    console.error('❌ Thiếu credentials!');
    console.error('Chạy: $env:CAST_USER="user"; $env:CAST_PASS="pass"; npm.cmd run test:cast-download');
    process.exit(1);
  }

  [DOWNLOAD_DIR, DEBUG_DIR].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

  // ── Tìm trình duyệt ────────────────────────────────────────────────────────
  const localAppData = process.env.LOCALAPPDATA || '';
  const progFiles    = process.env.PROGRAMFILES || 'C:\\Program Files';
  const progFiles86  = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)';

  // Ưu tiên Edge vì tương thích tốt hơn với CAST
  const edgePaths = [
    path.join(progFiles,   'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(progFiles86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(p => fs.existsSync(p));

  const chromePaths = [
    path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(progFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(p => fs.existsSync(p));

  const execPath = edgePaths[0] || chromePaths[0] || undefined;
  log(`Trình duyệt: ${execPath || 'Playwright default (Chromium)'}`);
  if (edgePaths[0]) log('✅ Dùng Microsoft Edge');
  else log('ℹ️  Dùng Chrome (Edge không tìm thấy)');

  // ── Launch browser ──────────────────────────────────────────────────────────
  const browser = await chromium.launch({
    headless: false,
    executablePath: execPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
    ],
    slowMo: 150,
  });

  const context = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
    // User-Agent giả vờ là IE11 để server không show warning
    // (Không cần IE Mode thực sự vì ta đã mock localeinfoproviderObj)
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Trident/7.0; rv:11.0) like Gecko',
  });

  // Inject IE mock script vào MỌI page TRƯỚC khi page JS nào chạy
  await context.addInitScript(IE_MOCK_SCRIPT);
  log('✅ Đã đăng ký IE mock script (inject trước page JS)');

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[IE-MOCK]')) log(`[IE-MOCK] ${text}`);
    else if (msg.type() === 'error') log(`[Browser Error] ${text.substring(0, 200)}`);
  });

  // Lắng nghe dialog (alert) từ trang
  page.on('dialog', async dialog => {
    log(`[Dialog] ${dialog.type()}: "${dialog.message()}"`);
    await dialog.dismiss();
  });

  try {
    // ── BƯỚC 1: Mở trang login ──────────────────────────────────────────────
    step('Mở trang đăng nhập CAST...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    await screenshot(page, '01-login-page');
    log(`URL: ${page.url()}`);
    log(`Title: ${await page.title()}`);

    // Kiểm tra mock đã inject chưa
    const mockOk = await page.evaluate(() => {
      return typeof (window as any).localeinfoproviderObj !== 'undefined';
    });
    log(`IE Mock injected: ${mockOk ? '✅ YES' : '❌ NO - sẽ có thể lỗi'}`);

    // Kiểm tra warning có còn không (với IE UA thì server có thể ẩn đi)
    const warningText = await page.locator('.logon-status-error').textContent({ timeout: 2000 }).catch(() => '');
    if (warningText?.trim()) {
      log(`⚠️  Server warning: "${warningText.trim()}"`);
      log('   → Sẽ bypass bằng mock, không ảnh hưởng đến login');
    } else {
      log('✅ Không có warning - server chấp nhận UA này');
    }

    // ── BƯỚC 2: Điền credentials ────────────────────────────────────────────
    step('Điền username và password...');

    await page.locator('#userNameInput').fill(USERNAME);
    log(`✅ Username: ${USERNAME}`);

    await page.locator('#passwordInput').fill(PASSWORD);
    log('✅ Password: ***');

    await screenshot(page, '02-credentials-filled');

    // ── BƯỚC 3: Gọi doLogon() qua page.evaluate() ──────────────────────────
    // Không click button (tránh onclick handler IE), gọi trực tiếp hàm JS
    step('Gọi doLogon() trực tiếp (bypass IE onclick)...');

    // Chờ Logon.js.asp load xong
    await page.waitForFunction(() => typeof (window as any).doLogon === 'function', { timeout: 10000 });
    log('✅ doLogon() function sẵn sàng');

    // Gọi doLogon()
    await page.evaluate(() => {
      (window as any).doLogon();
    });
    log('✅ doLogon() được gọi');

    // ── BƯỚC 4: Chờ kết quả login ───────────────────────────────────────────
    step('Chờ login hoàn tất...');

    // Chờ navigate ra khỏi trang login (tối đa 30 giây)
    try {
      await page.waitForNavigation({
        url: url => !url.href.includes('Logon'),
        timeout: 30000,
      });
      log(`✅ Đã navigate sang: ${page.url()}`);
    } catch {
      // Có thể là AJAX redirect không trigger waitForNavigation
      await page.waitForTimeout(5000);
      const currentUrl = page.url();
      const statusText = await page.locator('#logonStatus').textContent({ timeout: 2000 }).catch(() => '');
      log(`URL hiện tại: ${currentUrl}`);
      if (statusText) log(`Login status: "${statusText}"`);
    }

    await screenshot(page, '03-after-login');
    const afterUrl = page.url();
    const afterTitle = await page.title();
    log(`URL sau login: ${afterUrl}`);
    log(`Title sau login: ${afterTitle}`);

    if (afterUrl.toLowerCase().includes('logon')) {
      const statusEl = await page.locator('#logonStatus').textContent({ timeout: 2000 }).catch(() => '?');
      throw new Error(`Login thất bại! Status: "${statusEl}". Kiểm tra lại credentials.`);
    }

    log('🎉 ĐĂNG NHẬP THÀNH CÔNG!');

    // ── BƯỚC 5: Log tất cả frames (CAST dùng frameset) ─────────────────────
    await page.waitForTimeout(2000);
    const allFrames = page.frames();
    log(`\nFrames trên trang (${allFrames.length}):`);
    allFrames.forEach((f: any, i: number) => log(`  [${i}] ${f.url()}`));

    if (EXPLORE_MODE) {
      step('🔍 EXPLORE MODE - Giữ browser mở 90 giây...');
      log('Xem cấu trúc trang, ghi lại URL của Reporting Tool frame.');
      await saveHTML(page, '04-main-explore');
      await page.waitForTimeout(90000);
      await screenshot(page, '04-explore-end');
      log('Explore xong. Files tại: ' + DEBUG_DIR);
      return;
    }

    // ── BƯỚC 6: Navigate đến Reporting Tool ─────────────────────────────────
    step('Navigate đến Reports → Reporting Tool...');

    // Tìm frame nav bên trái
    let navFrame: any = null;
    for (const frame of allFrames) {
      const rtLink = frame.locator('a:has-text("Reporting Tool")');
      if (await rtLink.isVisible({ timeout: 1000 }).catch(() => false)) {
        navFrame = frame;
        log(`✅ Nav frame: ${frame.url()}`);
        break;
      }
    }

    if (navFrame) {
      // Click "Reports" để expand nếu cần
      const reportsExpand = navFrame.locator('a:has-text("Reports")').first();
      if (await reportsExpand.isVisible({ timeout: 1000 }).catch(() => false)) {
        await reportsExpand.click();
        await page.waitForTimeout(1000);
      }
      await navFrame.locator('a:has-text("Reporting Tool")').click();
      log('✅ Clicked Reporting Tool');
    } else {
      // Thử navigate trực tiếp
      log('⚠️  Không tìm thấy nav frame, navigate trực tiếp...');
      await page.goto(`${CAST_BASE}/CAST/ReportingTool/ReportingTool.asp`, { timeout: 20000 }).catch(() => {});
    }

    await page.waitForTimeout(3000);
    await screenshot(page, '05-reporting-tool');

    // ── BƯỚC 7: Tìm main frame chứa form ────────────────────────────────────
    step('Tìm form filter và chọn Accounts: Balances...');
    const frames2 = page.frames();
    log(`Frames hiện tại: ${frames2.length}`);
    frames2.forEach((f: any, i: number) => log(`  [${i}] ${f.url()}`));

    let mainFrame: any = page;
    for (const frame of frames2) {
      const cnt = await frame.locator('select').count().catch(() => 0);
      if (cnt > 0) {
        mainFrame = frame;
        log(`✅ Main frame (có ${cnt} select): ${frame.url()}`);
        break;
      }
    }

    // ── BƯỚC 8: Chọn template ────────────────────────────────────────────────
    const templateSelect = mainFrame.locator('select').first();
    await templateSelect.waitFor({ state: 'visible', timeout: 15000 });
    const options = await templateSelect.locator('option').allTextContents();
    log(`Options (${options.length}): ${options.slice(0, 5).join(', ')}...`);

    const targetOption = options.find((o: string) =>
      o.includes('Accounts: Balances') || o.includes('Accounts:Balances')
    );
    if (!targetOption) throw new Error(`Không tìm thấy "Accounts: Balances". Options: ${options.join(', ')}`);
    await templateSelect.selectOption({ label: targetOption });
    log(`✅ Selected: ${targetOption}`);
    await page.waitForTimeout(3000);
    await screenshot(page, '06-template-selected');

    // ── BƯỚC 9: Fill filters ─────────────────────────────────────────────────
    step(`Fill filters: FCM=${FCM_VALUE}, Currency=${CCY_VALUE}, RecordDesc=${DESC_VALUE}...`);

    async function setFilterRow(frame: any, colName: string, operation: string, value: string) {
      const row = frame.locator(`tr`).filter({ hasText: colName }).first();
      if (!await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        log(`  ⚠️  Row "${colName}" không tìm thấy`);
        return;
      }
      const opSel = row.locator('select').first();
      if (await opSel.isVisible({ timeout: 1000 }).catch(() => false)) {
        await opSel.selectOption({ label: operation });
        await frame.waitForTimeout(200);
      }
      const valIn = row.locator('input[type="text"]').first();
      if (await valIn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await valIn.fill(value);
        log(`  ✅ "${colName}" = "${value}" (${operation})`);
      }
    }

    await setFilterRow(mainFrame, 'FCM', 'Equals', FCM_VALUE);
    await setFilterRow(mainFrame, 'Currency', 'Like', CCY_VALUE);
    await setFilterRow(mainFrame, 'Record Description', 'Like', DESC_VALUE);
    await screenshot(page, '07-filters-filled');

    // ── BƯỚC 10: Create Report + Download ────────────────────────────────────
    step('Click Create Report và chờ download...');
    const downloadPromise = context.waitForEvent('download', { timeout: 120000 });

    for (const sel of ['input[value="Create Report"]', 'button:has-text("Create Report")', 'input[type="submit"]']) {
      const btn = mainFrame.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        log(`✅ Click: ${sel}`);
        break;
      }
    }

    log('⏳ Chờ server tạo report (tối đa 120s)...');
    const download = await downloadPromise;
    log(`✅ Download: ${download.suggestedFilename()}`);

    const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '');
    const savePath = path.join(DOWNLOAD_DIR, `Accounts_Balances_${ts}.xlsx`);
    await download.saveAs(savePath);

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 TẢI THÀNH CÔNG!');
    console.log(`📁 ${savePath}`);
    console.log('═'.repeat(60));

    await page.waitForTimeout(3000);

  } catch (err: any) {
    log(`\n❌ Lỗi: ${err.message}`);
    await screenshot(page, 'ERROR').catch(() => {});
    await saveHTML(page, 'ERROR').catch(() => {});
    console.error(err.stack);
    process.exitCode = 1;
  } finally {
    log('Đóng browser...');
    await browser.close();
    log('Xong! Files debug: ' + DEBUG_DIR);
  }
}

main();
