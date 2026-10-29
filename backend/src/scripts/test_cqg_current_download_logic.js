/**
 * SCRIPT KIỂM THỬ TRỰC TIẾP LOGIC TẢI CQG HIỆN TẠI (CQG DOWNLOAD TEST BENCHMARK)
 * 
 * Mục đích:
 * - Kiểm tra chính xác logic tải CQG đang chạy trong hệ thống (phân hệ Ingress / RPA Scraper).
 * - Kiểm chứng cơ chế 2 Chrome độc lập (cqg_profile_1 vs cqg_profile_2).
 * - So sánh hiệu năng giữa Chạy Song Song (Parallel - mặc định của bot) vs Chạy Tuần Tự (Sequential).
 * - Đo lường chi tiết: thời gian nạp spinner, thời gian vào Dashboard, thời gian tải từng file (FR, PS, OP, OD),
 *   và độ chênh lệch mtime giữa các cặp file.
 * 
 * Cách chạy trên Terminal (User tự chạy trực tiếp):
 * 
 * 1. Test nhanh 2 file FR (khớp lệnh trong phiên) - CÓ GIAO DIỆN quan sát 2 Chrome:
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed
 * 
 * 2. Chỉ test riêng tài khoản 1 (CQG1) để kiểm tra xem có bị lag spinner không:
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed --account=1
 * 
 * 3. Chỉ test riêng tài khoản 2 (CQG2):
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed --account=2
 * 
 * 4. Test đối chiếu 6 file (FR, PS, OP) như ca trực:
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed --6
 * 
 * 5. Test toàn bộ 8 file (FR, PS, OP, OD):
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed --all
 * 
 * 6. Test chế độ Tuần Tự (chạy xong TK1 rồi mới mở TK2) để so sánh:
 *    node backend/src/scripts/test_cqg_current_download_logic.js --headed --mode=sequential
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');

// Tải biến môi trường
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();

// ── Hàm giải mã AES-256-CBC ──────────────────────────────────────────────────
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  }
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

// ── Lấy đường dẫn Chrome thực thi ────────────────────────────────────────────
function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const paths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    for (const p of paths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

// ── Lấy thông tin tài khoản CQG từ MongoDB hoặc .env ─────────────────────────
async function getCredentials() {
  let url = process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  let username1 = process.env.CQG1_USERNAME || '';
  let password1 = process.env.CQG1_PASSWORD || '';
  let username2 = process.env.CQG2_USERNAME || '';
  let password2 = process.env.CQG2_PASSWORD || '';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://10.0.0.26:27017/mxv_shift_checklist';
  try {
    console.log(`🔌 Đang kết nối CSDL để lấy cấu hình bot_credentials_cqg...`);
    const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 5000 }).asPromise();
    const settingDoc = await conn.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
    if (settingDoc && settingDoc.value) {
      const raw = decrypt(settingDoc.value);
      const parsed = JSON.parse(raw);
      if (parsed.urlTrade || parsed.url) url = parsed.urlTrade || parsed.url;
      if (parsed.username1 || parsed.usernameCQG1) username1 = parsed.username1 || parsed.usernameCQG1;
      if (parsed.password1 || parsed.passwordCQG1) password1 = parsed.password1 || parsed.passwordCQG1;
      if (parsed.username2 || parsed.usernameCQG2) username2 = parsed.username2 || parsed.usernameCQG2;
      if (parsed.password2 || parsed.passwordCQG2) password2 = parsed.password2 || parsed.passwordCQG2;
      console.log(` Đã tải cấu hình từ MongoDB thành công.`);
    }
    await conn.close();
  } catch (err) {
    console.warn(`⚠️ Không thể kết nối MongoDB (${err.message}). Sử dụng biến môi trường fallback.`);
  }

  return {
    url,
    account1: { username: username1, password: password1 },
    account2: { username: username2, password: password2 },
  };
}

// ── Tự động đóng popup thông báo của CQG ────────────────────────────────────
async function dismissCqgNotifications(page) {
  try {
    const closeBtn = page.locator(
      "//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]"
    );
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 1500, force: true }).catch(() => {});
    }
    await page.evaluate(() => {
      document.querySelectorAll('wpfe-multi-snack-bar-container, .wpfe-notification').forEach((el) => el.remove());
    }).catch(() => {});
  } catch {}
}

// ── Chờ loading spinner của CQG biến mất ────────────────────────────────────
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
        await els.nth(i).waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {});
      }
    }
  } catch {}
}

// ── Chờ Dashboard Logo và giải tỏa xung đột phiên ───────────────────────────
async function waitForCqgDashboardLogo(page, username, timeoutMs = 120000) {
  const waitLogoStart = Date.now();
  while (Date.now() - waitLogoStart < timeoutMs) {
    const logoVisible = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    const homeVisible = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
    if (logoVisible || homeVisible) {
      return true;
    }

    await dismissCqgNotifications(page);

    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 150 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      const submitText = await submitBtn.first().innerText().catch(() => '');
      if (submitText.includes('Log on')) {
        await submitBtn.first().click({ force: true }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button'
    );
    if (await takeoverBtn.first().isVisible({ timeout: 250 }).catch(() => false)) {
      const btnText = await takeoverBtn.first().innerText().catch(() => '');
      console.log(`[CQG] Phát hiện popup xung đột phiên ("${btnText}"). Bấm chiếm quyền phiên...`);
      await takeoverBtn.first().click().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error(`Timeout ${timeoutMs}ms chờ logo dashboard sau khi đăng nhập CQG (${username}).`);
}

// ── Đăng nhập 1 tài khoản CQG ────────────────────────────────────────────────
async function loginAccount(creds, cqgUrl, profileSuffix, isHeaded) {
  const { username, password } = creds;
  const profileDir = path.join(process.cwd(), 'temp', `cqg_profile_${profileSuffix}`);
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  // Dọn dẹp file lock mồ côi (SingletonLock)
  try {
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
    for (const f of lockFiles) {
      const lockPath = path.join(profileDir, f);
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
        console.log(`[CQG${profileSuffix}] Đã dọn dẹp file lock mồ côi: ${f}`);
      }
    }
  } catch {}

  const executablePath = getChromeExecutablePath();
  const launchOptions = {
    headless: !isHeaded,
    slowMo: isHeaded ? 50 : 0,
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
      '--enable-features=V8CodeCache,WebAssembly',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-session-crashed-bubble',
      '--hide-crash-restore-bubble',
      '--disable-features=DownloadBubble,DownloadBubbleV2,InsecureDownloadWarnings',
      '--no-default-browser-check',
    ],
    viewport: null,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: true,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  console.log(`[CQG${profileSuffix}] Khởi chạy Chrome riêng biệt (Profile: ${path.basename(profileDir)})...`);
  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  page.setDefaultTimeout(60000);

  const navStart = Date.now();
  console.log(`[CQG${profileSuffix}] Mở trang đăng nhập: ${cqgUrl}...`);
  try {
    await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 });
  } catch (navErr) {
    console.log(`[CQG${profileSuffix}] Tải trang lần 1 bị chậm (${navErr.message}), tự động reload...`);
    await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() =>
      page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 })
    );
  }

  // Dual-State Router: Nhận diện Form Login hoặc Dashboard
  const detectState = async (timeoutMs = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hasLogin = await page
        .locator('input[name="userName"], input[name="username"], input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasLogin) return 'LOGIN';

      const hasDashboard = await page
        .locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasDashboard) return 'DASHBOARD';

      await new Promise((r) => setTimeout(r, 400));
    }
    return 'TIMEOUT';
  };

  let state = await detectState(15000);
  let f5Triggered = false;
  let f5Time = 0;

  if (state === 'TIMEOUT') {
    f5Triggered = true;
    const preF5Sec = ((Date.now() - navStart) / 1000).toFixed(1);
    console.log(`[CQG${profileSuffix}] ⚠️ Quay spinner quá ${preF5Sec}s! Tự động Reload trang để nạp từ Disk Cache...`);
    f5Time = Date.now();
    await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() =>
      page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 })
    );
    state = await detectState(30000);
    if (state === 'TIMEOUT') {
      throw new Error(`[CQG${profileSuffix}] Không tìm thấy Form đăng nhập hoặc Dashboard sau 60s (${username}).`);
    }
  }

  const spinnerDoneSec = ((Date.now() - navStart) / 1000).toFixed(1);
  console.log(`[CQG${profileSuffix}]  Vòng quay spinner đã xong sau: ${spinnerDoneSec}s ${f5Triggered ? '(sau F5)' : '(trực tiếp từ cache)'}! Trạng thái: ${state}`);

  const loginStart = Date.now();
  if (state === 'LOGIN') {
    console.log(`[CQG${profileSuffix}] Điền tài khoản xác thực: ${username}...`);
    await page.fill('input[name="userName"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await waitForCqgDashboardLogo(page, username, 120000);
  } else {
    console.log(`[CQG${profileSuffix}] Đã có sẵn phiên Dashboard từ trước.`);
    await waitForCqgDashboardLogo(page, username, 10000);
  }

  await waitForCqgNotLoading(page, 30000);
  const loginDurationSec = ((Date.now() - loginStart) / 1000).toFixed(1);
  console.log(`[CQG${profileSuffix}]  Sẵn sàng tại Dashboard trong: ${loginDurationSec}s!`);

  return {
    browser: context,
    page,
    metrics: {
      profileSuffix,
      spinnerDoneSec,
      loginDurationSec,
      f5Triggered,
      totalReadySec: ((Date.now() - navStart) / 1000).toFixed(1),
    },
  };
}

// ── Tải một widget cụ thể ───────────────────────────────────────────────────
async function downloadSingleWidget(page, searchTerm, tabLabel, downloadText, destFile, profileSuffix) {
  const widgetStart = Date.now();
  await dismissCqgNotifications(page);
  await page.keyboard.press('Escape').catch(() => {});

  console.log(`[CQG${profileSuffix}]  Mở widget "${searchTerm}"...`);

  // Bước 1: Menu Ho
  const homeMenu = page.locator("//div[text()='Ho']").first();
  await homeMenu.waitFor({ state: 'visible', timeout: 10000 });
  await homeMenu.click();
  await page.waitForTimeout(400);

  // Bước 2: Nút +
  let plusIcon = page.locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn").first();
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("div.wpfe-page-layout-tab-panel[style*='top: 0px'] .wpfe-add-widget-btn").first();
  }
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
  }
  await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
  await plusIcon.click();
  await page.waitForTimeout(400);

  // Bước 3: Tìm kiếm widget
  const searchField = page.locator("//input[@placeholder='Search...']").first();
  await searchField.waitFor({ state: 'visible', timeout: 10000 });
  await searchField.fill(searchTerm);
  await page.waitForTimeout(400);

  // Bước 4: Chọn widget
  const itemText =
    searchTerm === 'P&S'
      ? 'Purchase & Sales'
      : searchTerm === 'Pos'
        ? 'Positions'
        : searchTerm === 'Orders'
          ? 'Orders'
          : 'Fills';
  const widgetItem = page.locator(`//div[@wpfefocuslistitem and .//span[text()='${itemText}']]`).first();
  await widgetItem.waitFor({ state: 'visible', timeout: 10000 });
  await widgetItem.click();
  await page.waitForTimeout(800);

  // Bước 5: Bắt buộc chọn "All accounts"
  const scopedBtn = page.locator(
    `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//button[contains(@class, 'wpfe-widget-account-selector-button')]`
  ).locator('visible=true').first();

  let targetAccountBtn = (await scopedBtn.count().catch(() => 0)) > 0
    ? scopedBtn
    : page.locator('button.wpfe-widget-account-selector-button:visible').first();

  const hasAccountBtn = await targetAccountBtn.waitFor({ state: 'visible', timeout: 4000 }).then(() => true).catch(() => false);
  if (hasAccountBtn) {
    const currentAccountText = await targetAccountBtn.innerText().catch(() => '');
    if (!currentAccountText.includes('All')) {
      console.log(`[CQG${profileSuffix}] Đang chọn All accounts cho ${tabLabel}...`);
      await targetAccountBtn.click();
      await page.waitForTimeout(600);

      const allAccountsItem = page.locator(
        "//div[contains(@class, 'wpfe-account-selector-item-list-item') and .//span[text()='All accounts']]"
      ).first();
      await allAccountsItem.waitFor({ state: 'visible', timeout: 8000 });
      await allAccountsItem.click();
      await page.waitForTimeout(400);

      const okBtn = page.locator("//div[text()='OK']").first();
      await okBtn.waitFor({ state: 'visible', timeout: 8000 });
      await okBtn.click();
      await page.waitForTimeout(800);
      console.log(`[CQG${profileSuffix}]  Đã chọn All accounts thành công!`);
    } else {
      console.log(`[CQG${profileSuffix}] Tab ${tabLabel} đã là All accounts.`);
    }
  }

  // Bước 6: Dynamic Wait - Chờ WebSocket nạp dữ liệu
  console.log(`[CQG${profileSuffix}] Chờ WebSocket nạp dữ liệu cho ${tabLabel}: All...`);
  await waitForCqgNotLoading(page, 16000);

  const widgetSpinnerSelector =
    "wpfe-widget-tab-control:has(.wpfe-tab-header-active) mat-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .mat-mdc-progress-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .wpfe-loading-spinner";
  const startWait = Date.now();
  while (Date.now() - startWait < 16000) {
    const hasSpinner = await page.locator(widgetSpinnerSelector).first().isVisible().catch(() => false);
    if (!hasSpinner && Date.now() - startWait >= 3000) {
      break;
    }
    await page.waitForTimeout(400);
  }

  // Bước 7: Mở menu 3 chấm và tải file
  const ellipsisXPath =
    `//wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//span[contains(text(), '${tabLabel}: All')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']`;
  const downloadBtnXPath = `//div[contains(text(), "${downloadText}")]`;

  const destFolder = path.dirname(destFile);
  if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

  let downloaded = false;
  const keyword = (searchTerm === 'Pos' ? 'position' : searchTerm === 'P&S' ? 'purchase' : searchTerm.toLowerCase());

  for (let attempt = 1; attempt <= 8; attempt++) {
    console.log(`[CQG${profileSuffix}] 📋 Mở menu 3 chấm để tải ${tabLabel} (lần ${attempt}/8)...`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    const ellipsisButton = page.locator(ellipsisXPath).first();
    await ellipsisButton.waitFor({ state: 'visible', timeout: 5000 });
    await ellipsisButton.click();
    await page.waitForTimeout(1000);

    // Dò tìm nút Download theo nhiều tầng (chính xác -> theo từ khóa -> mục Download duy nhất trong menu)
    const downloadBtnXPathMulti =
      `//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and contains(text(), "${downloadText}")]` +
      ' | ' +
      `//div[contains(text(), "${downloadText}")]` +
      ' | ' +
      `//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'download') and contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${keyword}')]` +
      ' | ' +
      `//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and contains(text(), 'Download')]` +
      ' | ' +
      `//div[contains(text(), 'Download') and contains(text(), 'view')]`;

    const downloadBtn = page.locator(downloadBtnXPathMulti).first();
    const isVisible = await downloadBtn.waitFor({ state: 'visible', timeout: 3000 }).then(() => true).catch(() => false);

    let isClickable = false;
    let foundText = '';
    if (isVisible) {
      foundText = await downloadBtn.innerText().catch(() => downloadText);
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
      console.log(`[CQG${profileSuffix}]  Nút "${foundText.trim()}" sẵn sàng! Kích hoạt tải...`);
      const downloadDlStart = Date.now();
      try {
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 30000 }),
          downloadBtn.click({ timeout: 5000 }),
        ]);
        await download.saveAs(destFile);
        const fileSizeKb = (fs.statSync(destFile).size / 1024).toFixed(1);
        const dlSec = ((Date.now() - downloadDlStart) / 1000).toFixed(1);
        console.log(`[CQG${profileSuffix}]  ĐÃ LƯU FILE: ${path.basename(destFile)} (${fileSizeKb} KB, tải mất ${dlSec}s)`);
        downloaded = true;
        break;
      } catch (dlErr) {
        console.log(`[CQG${profileSuffix}] Chờ sự kiện download file (${dlErr.message}). Thử lại...`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
      }
    } else if (isVisible) {
      console.log(`[CQG${profileSuffix}] ⏳ Nút "${foundText.trim()}" đang mờ/disabled (WebSocket còn nạp dữ liệu). Đóng menu chờ 2s...`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(2000);
    } else {
      console.log(`[CQG${profileSuffix}] ⚠️ Chưa thấy mục Download trong menu. Đóng menu thử lại...`);
      await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(1500);
    }
  }

  // Bước 8: Đóng tab vừa tạo để dọn dẹp RAM
  try {
    await page.keyboard.press('Escape').catch(() => {});
    const closeBtn = page.locator(
      `//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`
    ).first();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}

  if (!downloaded) {
    throw new Error(`[CQG${profileSuffix}] Không thể tải ${path.basename(destFile)}.`);
  }

  const durationSec = ((Date.now() - widgetStart) / 1000).toFixed(1);
  return { durationSec, fileName: path.basename(destFile) };
}

// ── Hàm đăng xuất giải phóng session ─────────────────────────────────────────
async function logoutCqg(page, profileSuffix) {
  try {
    console.log(`[CQG${profileSuffix}] Đang thực hiện Log off để giải phóng phiên...`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    const logoutIconSelectors = [
      "//mat-icon[@data-mat-icon-name='sign-out']",
      "//mat-icon[contains(@class, 'sign-out')]",
      "//div[contains(@class, 'wpfe-desktop-sidebar-toolbar-item')]//mat-icon[@data-mat-icon-name='sign-out']",
      "//button[contains(@aria-label, 'Sign out') or contains(@aria-label, 'Log off')]",
    ];
    const logoutIcon = page.locator(logoutIconSelectors.join(' | ')).first();
    let isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      const collapseIcon = page.locator(
        "//*[contains(@class, 'gpc-icon wpfe-desktop-sidebar-toolbar-item-header-icon gpc-icon-size-big gpc-icon-name-wpfe-chevron-up')]"
      ).first();
      if (await collapseIcon.isVisible({ timeout: 1500 }).catch(() => false)) {
        await collapseIcon.click().catch(() => {});
        await page.waitForTimeout(500);
      }
      isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);
    }

    if (isVisible) {
      await logoutIcon.click({ timeout: 3000 });
      await page.waitForTimeout(500);

      const logoffMenuItem = page.locator(
        "//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and (text()='Log off' or text()='Log out' or text()='Đăng xuất')] | //span[text()='Log off' or text()='Log out']"
      ).first();
      if (await logoffMenuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoffMenuItem.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }

      const dialogConfirmBtn = page.locator(
        "wpfe-confirmation-dialog button.wpfe-confirm, wpfe-confirmation-dialog button:has-text('Log off'), //wpfe-confirmation-dialog//button[contains(@class, 'wpfe-confirm')]"
      ).first();
      if (await dialogConfirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dialogConfirmBtn.click({ force: true, timeout: 3000 }).catch(() => {});
      }
      console.log(`[CQG${profileSuffix}]  Đã hoàn tất Log off.`);
    }
  } catch (err) {
    console.warn(`[CQG${profileSuffix}] Bỏ qua lỗi logoff: ${err.message}`);
  }
}

// ── MAIN RUNNER ──────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');
  const isAll = args.includes('--all');
  const is6Files = args.includes('--6') || args.includes('--6files');
  const accountArg = args.find((a) => a.startsWith('--account='));
  const modeArg = args.find((a) => a.startsWith('--mode='));

  let targetAccount = 'both'; // '1', '2', 'both'
  if (accountArg) {
    const val = accountArg.split('=')[1]?.trim();
    if (val === '1' || val === 'TK1') targetAccount = '1';
    else if (val === '2' || val === 'TK2') targetAccount = '2';
    else targetAccount = 'both';
  }

  const isSequential = modeArg?.includes('seq');

  let reportTypes = ['FR'];
  if (isAll) {
    reportTypes = ['FR', 'PS', 'OP', 'OD'];
  } else if (is6Files) {
    reportTypes = ['FR', 'PS', 'OP'];
  }

  console.log('================================================================================');
  console.log('         KIỂM THỬ TRỰC TIẾP TOÀN BỘ LOGIC TẢI BÁO CÁO CQG (BENCHMARK)          ');
  console.log('================================================================================');
  console.log(`- Chế độ hiển thị: ${isHeaded ? 'CÓ GIAO DIỆN (Headed - Mở cửa sổ Chrome)' : 'CHẠY NGẦM (Headless)'}`);
  console.log(`- Tài khoản kiểm tra: ${targetAccount === 'both' ? 'CẢ 2 TÀI KHOẢN (CQG1 & CQG2)' : `CHỈ TÀI KHOẢN CQG${targetAccount}`}`);
  console.log(`- Phương thức chạy: ${isSequential ? 'TUẦN TỰ (Chạy hết TK1 rồi mới mở TK2)' : 'SONG SONG (Mở đồng thời 2 Chrome cùng lúc - Chuẩn Production)'}`);
  console.log(`- Danh sách báo cáo: ${reportTypes.join(', ')} (${reportTypes.length * (targetAccount === 'both' ? 2 : 1)} files)`);

  const outDir = path.resolve(process.cwd(), 'temp', 'test_cqg_run');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  console.log(`- Thư mục lưu file: ${outDir}\n`);

  const { url, account1, account2 } = await getCredentials();
  console.log(`🔑 Tài khoản CQG1: ${account1.username || 'Chưa có'}`);
  console.log(`🔑 Tài khoản CQG2: ${account2.username || 'Chưa có'}\n`);

  const widgetDefs = {
    FR: { searchTerm: 'Fills', tabLabel: 'Fills', downloadText: "Download today's fills in view" },
    PS: { searchTerm: 'P&S', tabLabel: 'Purchase & Sales', downloadText: 'Download Purchase and sales in view' },
    OP: { searchTerm: 'Pos', tabLabel: 'Positions', downloadText: 'Download open positions in view' },
    OD: { searchTerm: 'Orders', tabLabel: 'Orders', downloadText: 'Download orders in view' },
  };

  const executeAccountDownload = async (creds, profileSuffix) => {
    const accStart = Date.now();
    let session = null;
    const downloadedFiles = [];
    try {
      session = await loginAccount(creds, url, profileSuffix, isHeaded);
      for (const rep of reportTypes) {
        const def = widgetDefs[rep];
        const destFile = path.join(outDir, `${rep}${profileSuffix}.xlsx`);
        const res = await downloadSingleWidget(session.page, def.searchTerm, def.tabLabel, def.downloadText, destFile, profileSuffix);
        downloadedFiles.push(res);
      }
      return {
        success: true,
        metrics: session.metrics,
        downloadedFiles,
        totalDurationSec: ((Date.now() - accStart) / 1000).toFixed(1),
      };
    } catch (err) {
      return {
        success: false,
        error: err.message,
        downloadedFiles,
        totalDurationSec: ((Date.now() - accStart) / 1000).toFixed(1),
      };
    } finally {
      if (session?.page) {
        await logoutCqg(session.page, profileSuffix).catch(() => {});
      }
      if (session?.browser) {
        await session.browser.close().catch(() => {});
        console.log(`[CQG${profileSuffix}] 🔒 Đã đóng hoàn toàn trình duyệt Chrome.`);
      }
    }
  };

  const totalBenchmarkStart = Date.now();
  let result1 = null;
  let result2 = null;

  if (targetAccount === '1') {
    result1 = await executeAccountDownload(account1, '1');
  } else if (targetAccount === '2') {
    result2 = await executeAccountDownload(account2, '2');
  } else if (isSequential) {
    console.log('🚀 BẮT ĐẦU CHẠY TUẦN TỰ: TÀI KHOẢN CQG1 TRƯỚC...\n');
    result1 = await executeAccountDownload(account1, '1');
    console.log('\n🚀 TIẾP TỤC CHẠY TÀI KHOẢN CQG2...\n');
    result2 = await executeAccountDownload(account2, '2');
  } else {
    console.log('🚀 BẮT ĐẦU CHẠY SONG SONG: MỞ ĐỒNG THỜI CẢ 2 TRÌNH DUYỆT CQG1 & CQG2...\n');
    [result1, result2] = await Promise.all([
      executeAccountDownload(account1, '1'),
      executeAccountDownload(account2, '2'),
    ]);
  }

  const totalBenchmarkSec = ((Date.now() - totalBenchmarkStart) / 1000).toFixed(1);

  console.log('\n================================================================================');
  console.log(`                     BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ CQG                         `);
  console.log('================================================================================');
  console.log(`⏱️ TỔNG THỜI GIAN THỰC HIỆN TOÀN BỘ: ${totalBenchmarkSec} GIÂY`);

  if (result1) {
    console.log(`\n🔹 [TÀI KHOẢN CQG1 - ${account1.username}]:`);
    console.log(`   - Trạng thái: ${result1.success ? ' THÀNH CÔNG' : '❌ THẤT BẠI (' + result1.error + ')'}`);
    if (result1.metrics) {
      console.log(`   - Vượt vòng quay Spinner: ${result1.metrics.spinnerDoneSec}s ${result1.metrics.f5Triggered ? '(sau F5)' : '(trực tiếp)'}`);
      console.log(`   - Đăng nhập vào Dashboard: ${result1.metrics.loginDurationSec}s`);
      console.log(`   - Tổng thời gian vào vị trí: ${result1.metrics.totalReadySec}s`);
    }
    console.log(`   - File đã tải: ${result1.downloadedFiles.map((f) => `${f.fileName} (${f.durationSec}s)`).join(', ') || 'Không có'}`);
    console.log(`   - Tổng thời gian CQG1: ${result1.totalDurationSec}s`);
  }

  if (result2) {
    console.log(`\n🔹 [TÀI KHOẢN CQG2 - ${account2.username}]:`);
    console.log(`   - Trạng thái: ${result2.success ? ' THÀNH CÔNG' : '❌ THẤT BẠI (' + result2.error + ')'}`);
    if (result2.metrics) {
      console.log(`   - Vượt vòng quay Spinner: ${result2.metrics.spinnerDoneSec}s ${result2.metrics.f5Triggered ? '(sau F5)' : '(trực tiếp)'}`);
      console.log(`   - Đăng nhập vào Dashboard: ${result2.metrics.loginDurationSec}s`);
      console.log(`   - Tổng thời gian vào vị trí: ${result2.metrics.totalReadySec}s`);
    }
    console.log(`   - File đã tải: ${result2.downloadedFiles.map((f) => `${f.fileName} (${f.durationSec}s)`).join(', ') || 'Không có'}`);
    console.log(`   - Tổng thời gian CQG2: ${result2.totalDurationSec}s`);
  }

  // So sánh mtime nếu tải cả 2 tài khoản
  if (result1?.success && result2?.success) {
    console.log(`\n📊 KIỂM TRA ĐỒNG BỘ THỜI GIAN XUẤT FILE GIỮA 2 TÀI KHOẢN:`);
    for (const rep of reportTypes) {
      const f1 = path.join(outDir, `${rep}1.xlsx`);
      const f2 = path.join(outDir, `${rep}2.xlsx`);
      if (fs.existsSync(f1) && fs.existsSync(f2)) {
        const s1 = fs.statSync(f1);
        const s2 = fs.statSync(f2);
        const delta = (Math.abs(s1.mtimeMs - s2.mtimeMs) / 1000).toFixed(2);
        console.log(`   - Cặp ${rep}1 vs ${rep}2: Chênh lệch mtime = ${delta}s (TK1: ${s1.mtime.toLocaleTimeString('vi-VN')} | TK2: ${s2.mtime.toLocaleTimeString('vi-VN')})`);
      }
    }
  }

  console.log('\n================================================================================');
  console.log('                          HOÀN TẤT KIỂM THỬ CQG                                 ');
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
