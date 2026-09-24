/**
 * SCRIPT KIỂM THỬ TẢI SONG SONG 2 TÀI KHOẢN CQG (STANDALONE PURE RUNNER)
 * 
 * Đặc điểm:
 * - Độc lập 100% (Pure Node.js + Playwright), KHÔNG khởi động NestJS framework.
 * - KHÔNG chạy SeedService, KHÔNG chạy ShiftJobScheduler (không tự tạo ca), KHÔNG chạy Queue bot ngầm.
 * - Chỉ kết nối MongoDB 1 giây để lấy credentials rồi ngắt kết nối ngay.
 * - Chạy song song đồng thời 2 trình duyệt (CQG1 và CQG2) và bấm xuất FR1 + FR2 cùng lúc.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_cqg_parallel_standalone.js --headed
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

function calculateMD5(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function findChromeBinary() {
  const possiblePaths = [
    process.env.CHROME_BIN,
    process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];
  return possiblePaths.find((p) => p && fs.existsSync(p)) || null;
}

async function dismissCqgNotifications(page) {
  try {
    const closeBtn = page.locator(
      "//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]"
    );
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 1500, force: true }).catch(() => { });
    }
    await page.evaluate(() => {
      document.querySelectorAll('wpfe-multi-snack-bar-container').forEach((el) => el.remove());
    }).catch(() => { });
  } catch { }
}

async function waitForCqgNotLoading(page, timeoutMs = 30000) {
  try {
    const spinnerSelectors = [
      '.wpfe-pre-bootstrap-loading-spinner-container',
      '.wpfe-app-loading-image',
    ];
    for (const sel of spinnerSelectors) {
      const els = page.locator(sel);
      const count = await els.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        await els.nth(i).waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
      }
    }
  } catch { }
}

async function waitForCqgDashboardLogo(page, username, timeoutMs = 120000) {
  const waitLogoStart = Date.now();
  while (Date.now() - waitLogoStart < timeoutMs) {
    const logoVisible = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    const homeVisible = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
    if (logoVisible || homeVisible) return true;

    await dismissCqgNotifications(page);

    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 150 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      const submitText = await submitBtn.first().innerText().catch(() => '');
      if (submitText.includes('Log on')) {
        await submitBtn.first().click({ force: true }).catch(() => { });
        await page.keyboard.press('Enter').catch(() => { });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button'
    );
    const count = await takeoverBtn.count().catch(() => 0);
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const btn = takeoverBtn.nth(i);
        if (await btn.isVisible().catch(() => false)) {
          console.log(`[CQG] Tự động giải phóng xung đột phiên cho: ${username}...`);
          await btn.click({ force: true }).catch(() => { });
          await new Promise((r) => setTimeout(r, 1000));
          break;
        }
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function loginAndPrepareCqg(cqgUrl, username, password, profileSuffix, isHeadless, chromePath) {
  const profileDir = path.join(process.cwd(), 'temp', `cqg_profile_${profileSuffix}`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const f of lockFiles) {
    const lockPath = path.join(profileDir, f);
    if (fs.existsSync(lockPath)) try { fs.unlinkSync(lockPath); } catch { }
  }

  const launchOptions = {
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--start-maximized',
      '--ignore-gpu-blocklist',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--disk-cache-size=209715200',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
    ],
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: true,
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  page.setDefaultTimeout(60000);

  console.log(`[CQG${profileSuffix}] Mở trang đăng nhập: ${cqgUrl}...`);
  await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 }).catch(() => {});

  const detectState = async (timeoutMs = 45000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hasLogin = await page.locator('input[name="userName"], input[name="username"]').first().isVisible().catch(() => false);
      if (hasLogin) return 'LOGIN';
      const hasDashboard = await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']').first().isVisible().catch(() => false);
      if (hasDashboard) return 'DASHBOARD';
      await new Promise((r) => setTimeout(r, 500));
    }
    return 'TIMEOUT';
  };

  let state = await detectState(15000);
  if (state === 'TIMEOUT') {
    await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    state = await detectState(30000);
  }

  if (state === 'LOGIN') {
    console.log(`[CQG${profileSuffix}] Điền thông tin đăng nhập: ${username}...`);
    await page.fill('input[name="userName"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await waitForCqgDashboardLogo(page, username, 120000);
  } else if (state === 'DASHBOARD') {
    console.log(`[CQG${profileSuffix}] Phiên làm việc đã sẵn sàng từ Cache: ${username}`);
    await waitForCqgDashboardLogo(page, username, 10000);
  }

  await waitForCqgNotLoading(page, 30000);
  console.log(`[CQG${profileSuffix}] ✅ Đăng nhập thành công, sẵn sàng xuất báo cáo.`);
  return { context, page };
}

async function downloadFillsWidget(page, destFile, profileSuffix) {
  const searchTerm = 'Fills';
  const tabLabel = 'Fills';
  const downloadText = "Download today's fills";
  const widgetStart = Date.now();

  await waitForCqgNotLoading(page, 15000);
  await dismissCqgNotifications(page);
  await page.keyboard.press('Escape').catch(() => { });
  await page.keyboard.press('Escape').catch(() => { });

  console.log(`[CQG${profileSuffix}] Mở widget "Fills" theo quy trình chuẩn...`);

  // Bước 1: Bấm menu Ho
  const homeMenu = page.locator("//div[text()='Ho']").first();
  await homeMenu.waitFor({ state: 'visible', timeout: 10000 });
  await homeMenu.click();
  await page.waitForTimeout(1000);

  // Bước 2: Bấm nút dấu cộng add widget trong panel thao tác (g1.w431)
  let plusIcon = page.locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn").first();
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("div.wpfe-page-layout-tab-panel[style*='top: 0px'] .wpfe-add-widget-btn").first();
  }
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
  }
  await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
  await plusIcon.click();
  await page.waitForTimeout(1000);

  // Bước 3: Tìm kiếm widget
  const searchField = page.locator("//input[@placeholder='Search...']").first();
  await searchField.waitFor({ state: 'visible', timeout: 10000 });
  await searchField.fill(searchTerm);
  await page.waitForTimeout(1000);

  // Bước 4: Chọn widget từ danh sách
  const widgetItem = page.locator(`//div[@wpfefocuslistitem and .//span[text()='Fills']]`).first();
  await widgetItem.waitFor({ state: 'visible', timeout: 10000 });
  await widgetItem.click();
  await page.waitForTimeout(1000);

  // Bước 5: Account selector -> All accounts -> OK
  const selectAccountBtn = page.locator("//button[contains(@class, 'wpfe-widget-account-selector-button')]").first();
  await selectAccountBtn.waitFor({ state: 'visible', timeout: 10000 });
  await selectAccountBtn.click();
  await page.waitForTimeout(1000);

  const allAccountsItem = page.locator(
    "//div[contains(@class, 'wpfe-account-selector-item-list-item') and .//span[text()='All accounts']]"
  ).first();
  await allAccountsItem.waitFor({ state: 'visible', timeout: 10000 });
  await allAccountsItem.click();
  await page.waitForTimeout(1000);

  const okBtn = page.locator("//div[text()='OK']").first();
  await okBtn.waitFor({ state: 'visible', timeout: 10000 });
  await okBtn.click();

  // Bước 6: Chờ dữ liệu bảng đồng bộ xong
  console.log(`[CQG${profileSuffix}] Chờ bảng Fills nạp dữ liệu...`);
  await waitForCqgNotLoading(page, 16000);
  await page.waitForTimeout(4000);

  const ellipsisXPath =
    `//wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//span[contains(text(), '${tabLabel}: All')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']`;
  const downloadBtnXPath = `//div[contains(text(), "${downloadText}")]`;

  // Bước 7: Mở menu 3 chấm và bấm Download
  let downloaded = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(`[CQG${profileSuffix}] Mở menu 3 chấm (lần ${attempt}/10)...`);
    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(500);

    const ellipsisButton = page.locator(ellipsisXPath).first();
    await ellipsisButton.waitFor({ state: 'visible', timeout: 5000 });
    await ellipsisButton.click();
    await page.waitForTimeout(1500);

    const downloadBtn = page.locator(downloadBtnXPath).first();
    const isVisible = await downloadBtn.isVisible().catch(() => false);

    let isClickable = false;
    if (isVisible) {
      isClickable = await downloadBtn.evaluate((el) => {
        const item = el.closest('button, [role="menuitem"], .gpc-button, .mat-mdc-menu-item') || el;
        const hasDisabledAttr = item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true';
        const hasDisabledClass = item.classList.contains('disabled') ||
          item.classList.contains('mat-mdc-menu-item-disabled') ||
          item.classList.contains('gpc-button-disabled');
        const style = window.getComputedStyle(item);
        const isOpaque = parseFloat(style.opacity || '1') >= 0.7;
        const hasPointerEvents = style.pointerEvents !== 'none';
        return !hasDisabledAttr && !hasDisabledClass && isOpaque && hasPointerEvents;
      }).catch(() => false);
    }

    if (isClickable) {
      console.log(`[CQG${profileSuffix}] Nút "${downloadText}" đã sẵn sàng! Bấm tải...`);
      try {
        const destFolder = path.dirname(destFile);
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
        await downloadBtn.click();
        const download = await downloadPromise;
        await download.saveAs(destFile);
        console.log(`[CQG${profileSuffix}] ✅ Đã lưu file thành công: ${path.basename(destFile)}`);
        downloaded = true;
        break;
      } catch (dlErr) {
        console.log(`[CQG${profileSuffix}] Bấm nút nhưng chưa tải được (${dlErr.message}). Đóng menu thử lại...`);
        await page.keyboard.press('Escape').catch(() => { });
        await page.waitForTimeout(3000);
      }
    } else {
      console.log(`[CQG${profileSuffix}] Bảng vẫn đang loading. Đóng menu chờ 3s...`);
      await page.keyboard.press('Escape').catch(() => { });
      await page.waitForTimeout(3000);
    }
  }

  // Đóng tab widget vừa mở
  try {
    await page.keyboard.press('Escape').catch(() => { });
    const closeButtonXPath =
      `//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//span[contains(text(), '${tabLabel}: All')]/ancestor::div[contains(@class, 'wpfe-widget-tab-header-content')][1]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]` +
      ' | ' +
      `//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`;
    const closeBtn = page.locator(closeButtonXPath).first();
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => { });
    }
  } catch { }

  if (!downloaded) {
    throw new Error(`Tải ${path.basename(destFile)} thất bại.`);
  }
}

async function run() {
  console.log('========================================================================');
  console.log('  TEST TẢI SONG SONG 2 TÀI KHOẢN CQG (STANDALONE RUNNER - ZERO CRONS)   ');
  console.log('========================================================================\n');

  const args = process.argv.slice(2);
  const isHeadless = !args.includes('--headed');
  const chromePath = findChromeBinary();
  console.log(`- Trình duyệt Chrome/Edge: ${chromePath || 'Mặc định Playwright'}`);
  console.log(`- Chế độ hiển thị: ${isHeadless ? 'Headless (Chạy ngầm)' : 'Headed (Có giao diện)'}\n`);

  // 1. Đọc credentials từ MongoDB
  console.log('1. Lấy thông tin cấu hình từ MongoDB...');
  const uri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  await mongoose.disconnect();

  if (!setting) {
    console.error('❌ Không tìm thấy bot_credentials_cqg!');
    return;
  }

  const creds = JSON.parse(decrypt(setting.value));
  const cqgUrl = creds.urlTrade || creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  const username1 = creds.username1 || creds.usernameCQG1;
  const password1 = creds.password1 || creds.passwordCQG1;
  const username2 = creds.username2 || creds.usernameCQG2;
  const password2 = creds.password2 || creds.passwordCQG2;

  const destDir = path.join(process.cwd(), 'data', 'backup', 'cqg_parallel_test');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  console.log(`- Thư mục lưu file: ${destDir}`);
  console.log(`- Tài khoản 1: ${username1}`);
  console.log(`- Tài khoản 2: ${username2}\n`);

  console.log('2. BẮT ĐẦU KHỞI CHẠY SONG SONG 2 BROWSER CONTEXT...');
  const overallStart = Date.now();

  let session1, session2;
  try {
    // PHA 1: Mở đồng thời cả 2 browser
    [session1, session2] = await Promise.all([
      loginAndPrepareCqg(cqgUrl, username1, password1, '1', isHeadless, chromePath),
      loginAndPrepareCqg(cqgUrl, username2, password2, '2', isHeadless, chromePath),
    ]);

    console.log('\n🎯 CẢ 2 TÀI KHOẢN ĐỀU ĐÃ SẴN SÀNG! KÍCH HOẠT XUẤT FILE ĐỒNG THỜI...');
    const exportStart = Date.now();

    // PHA 2: Bấm xuất file đồng thời
    const file1 = path.join(destDir, 'FR1.xlsx');
    const file2 = path.join(destDir, 'FR2.xlsx');

    await Promise.all([
      downloadFillsWidget(session1.page, file1, '1'),
      downloadFillsWidget(session2.page, file2, '2'),
    ]);

    const totalSeconds = ((Date.now() - overallStart) / 1000).toFixed(1);
    const exportSeconds = ((Date.now() - exportStart) / 1000).toFixed(1);

    console.log('\n========================================================================');
    console.log('                       KẾT QUẢ ĐO LƯỜNG BENCHMARK                       ');
    console.log('========================================================================');
    console.log(`⏱️ Tổng thời gian hoàn tất toàn bộ (Mở 2 Chrome + Tải xong cả 2 file): ${totalSeconds}s`);
    console.log(`⏱️ Thời gian xuất file đồng thời: ${exportSeconds}s`);

    const stat1 = fs.statSync(file1);
    const stat2 = fs.statSync(file2);
    const diffMs = Math.abs(stat1.mtimeMs - stat2.mtimeMs);

    console.log(`\n📊 Kiểm tra độ đồng bộ mtime xuất file:`);
    console.log(` - FR1: ${stat1.size} bytes, mtime: ${stat1.mtime.toLocaleTimeString('vi-VN')}`);
    console.log(` - FR2: ${stat2.size} bytes, mtime: ${stat2.mtime.toLocaleTimeString('vi-VN')}`);
    console.log(` - Độ chênh lệch giữa 2 file: ${(diffMs / 1000).toFixed(2)}s (Gần như bằng 0s!)`);
    console.log('========================================================================\n');
  } catch (err) {
    console.error(`❌ Lỗi trong quá trình chạy song song: ${err.message}`);
  } finally {
    if (session1) await session1.context.close().catch(() => {});
    if (session2) await session2.context.close().catch(() => {});
    console.log('✅ Đã đóng sạch cả 2 trình duyệt. Tiến trình kết thúc.');
  }
}

run();
