/**
 * SCRIPT WARM-UP & GIỮ ẤM CACHE PROFILE CQG (CQG1 & CQG2)
 *
 * Mục tiêu:
 * - Khởi chạy tuần tự Chrome cho từng profile (cqg_profile_1, sau đó cqg_profile_2)
 * - Tự động đăng nhập vào CQG Desktop Web (m.cqg.com)
 * - Nạp lần lượt 4 widget cốt lõi: Fills (FR), P&S (PS), Positions (OP), Orders (OD)
 * - Tải và biên dịch sẵn toàn bộ mã WebAssembly, Angular JS bundles, icon fonts vào SSD
 * - Giúp các ca chạy đối soát tự động tiếp theo nạp thẳng từ SSD Cache với tốc độ nhanh gấp 2-3 lần
 *
 * Cách chạy:
 *   node backend/src/scripts/warmup_cqg_cache.js
 *   node backend/src/scripts/warmup_cqg_cache.js --account=1   (chỉ warm-up CQG1)
 *   node backend/src/scripts/warmup_cqg_cache.js --account=2   (chỉ warm-up CQG2)
 *   node backend/src/scripts/warmup_cqg_cache.js --headed      (có giao diện trên Windows)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');

// Load file .env nếu có
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
const rootEnvPath = path.resolve(__dirname, '../../../.env');
if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}

const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');
const targetAccountArg = args.find((a) => a.startsWith('--account='));
const targetAccount = targetAccountArg ? targetAccountArg.split('=')[1] : 'all';

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

function getDirSizeMB(dir) {
  let size = 0;
  if (!fs.existsSync(dir)) return '0.00';
  function rec(d) {
    try {
      const items = fs.readdirSync(d);
      for (const item of items) {
        const full = path.join(d, item);
        const s = fs.statSync(full);
        if (s.isDirectory()) rec(full);
        else size += s.size;
      }
    } catch {}
  }
  rec(dir);
  return (size / 1024 / 1024).toFixed(2);
}

function getSecretKey() {
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  return crypto.createHash('sha256').update(rawKey).digest();
}

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    try {
      JSON.parse(encryptedText);
      return encryptedText;
    } catch {
      return encryptedText;
    }
  }
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');

  // Thử 1: Dùng getSecretKey()
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err1) {
    // Thử 2: Dùng mxv_secret_salt_fixed
    try {
      const fixedKey = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
      const decipherFixed = crypto.createDecipheriv('aes-256-cbc', fixedKey, iv);
      let decryptedFixed = decipherFixed.update(encrypted);
      decryptedFixed = Buffer.concat([decryptedFixed, decipherFixed.final()]);
      return decryptedFixed.toString('utf8');
    } catch {
      return encryptedText;
    }
  }
}

async function loadCredentials() {
  const creds = {
    url: process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
    account1: {
      username: process.env.CQG1_USERNAME || '',
      password: process.env.CQG1_PASSWORD || '',
    },
    account2: {
      username: process.env.CQG2_USERNAME || '',
      password: process.env.CQG2_PASSWORD || '',
    },
  };

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri && (!creds.account1.username || !creds.account2.username)) {
    try {
      console.log('🔌 Đang nạp tài khoản CQG từ MongoDB Atlas...');
      const mongoose = require('mongoose');
      const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 4000 }).asPromise();
      const doc = await conn.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
      if (doc?.value) {
        const parsed = JSON.parse(decrypt(doc.value));
        if (parsed.urlTrade || parsed.url) creds.url = parsed.urlTrade || parsed.url;
        if (parsed.username1 || parsed.usernameCQG1) creds.account1.username = parsed.username1 || parsed.usernameCQG1;
        if (parsed.password1 || parsed.passwordCQG1) creds.account1.password = parsed.password1 || parsed.passwordCQG1;
        if (parsed.username2 || parsed.usernameCQG2) creds.account2.username = parsed.username2 || parsed.usernameCQG2;
        if (parsed.password2 || parsed.passwordCQG2) creds.account2.password = parsed.password2 || parsed.passwordCQG2;
      }
      await conn.close();
      console.log(' Nạp thông tin tài khoản CQG từ DB thành công!');
    } catch (err) {
      console.warn(`⚠️ Không đọc được DB: ${err.message}. Sử dụng cấu hình từ .env.`);
    }
  }

  return creds;
}

async function dismissCqgNotifications(page) {
  try {
    const okButtons = page.locator('button.mat-mdc-button-base:has-text("OK"), button:has-text("OK")');
    const count = await okButtons.count().catch(() => 0);
    for (let i = 0; i < count; i++) {
      if (await okButtons.nth(i).isVisible().catch(() => false)) {
        await okButtons.nth(i).click({ force: true }).catch(() => {});
        await page.waitForTimeout(200);
      }
    }
    const closeBtn = page.locator(
      "//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]"
    );
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 1500, force: true }).catch(() => {});
    }
    await page
      .evaluate(() => {
        document.querySelectorAll('wpfe-multi-snack-bar-container, .wpfe-notification, .cdk-overlay-container, mat-snack-bar-container').forEach((el) => el.remove());
      })
      .catch(() => {});
  } catch {}
}

async function waitForCqgNotLoading(page, timeoutMs = 25000) {
  const spinnerSelector = 'mat-spinner, .mat-mdc-progress-spinner, .wpfe-loading-spinner, .wpfe-busy-indicator';
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isSpinner = await page.locator(spinnerSelector).first().isVisible().catch(() => false);
    if (!isSpinner) return;
    await page.waitForTimeout(400);
  }
}

async function waitForCqgDashboardLogo(page, username, timeoutMs = 120000) {
  const waitLogoStart = Date.now();
  console.log(`[CQG] Chờ logo Dashboard CQG hoặc xử lý tranh chấp phiên cho ${username}...`);

  while (Date.now() - waitLogoStart < timeoutMs) {
    const logoVisible = await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar').first().isVisible().catch(() => false);
    const homeVisible = await page.locator("//div[text()='Ho']").first().isVisible().catch(() => false);
    if (logoVisible || homeVisible) {
      console.log(`[CQG]  Dashboard đã hiển thị thành công cho ${username}!`);
      return;
    }

    await dismissCqgNotifications(page);

    const isLoginStillVisible = await page
      .locator('input[name="password"]')
      .isVisible({ timeout: 150 })
      .catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      const submitText = await submitBtn.first().innerText().catch(() => '');
      if (submitText.includes('Log on')) {
        await submitBtn.first().click({ force: true }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(1500);
      }
    }

    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), button:has-text("Logon here"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button'
    );
    if (await takeoverBtn.first().isVisible({ timeout: 250 }).catch(() => false)) {
      const btnText = await takeoverBtn.first().innerText().catch(() => '');
      console.log(`[CQG] ⚠️ Phát hiện popup xung đột phiên ("${btnText}"). Bấm chiếm quyền phiên cho ${username}...`);
      await takeoverBtn.first().click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    await page.waitForTimeout(300);
  }

  throw new Error(`Timeout ${timeoutMs}ms chờ logo dashboard sau khi đăng nhập CQG (${username}).`);
}

async function warmupSingleWidget(page, searchTerm, itemText, profileSuffix) {
  const start = Date.now();
  console.log(`[CQG${profileSuffix}] ⏳ Warm-up nạp widget "${itemText}"...`);
  await dismissCqgNotifications(page);
  await page.keyboard.press('Escape').catch(() => {});

  // 1. Menu Ho
  const homeMenu = page.locator("//div[text()='Ho']").first();
  await homeMenu.waitFor({ state: 'visible', timeout: 15000 });
  await homeMenu.click({ force: true });
  await page.waitForTimeout(400);

  // 2. Nút +
  let plusIcon = page.locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn").first();
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("div.wpfe-page-layout-tab-panel[style*='top: 0px'] .wpfe-add-widget-btn").first();
  }
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
  }
  await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
  await dismissCqgNotifications(page);
  await plusIcon.click({ force: true });
  await page.waitForTimeout(400);

  // 3. Search widget
  const searchField = page.locator("//input[@placeholder='Search...']").first();
  await searchField.waitFor({ state: 'visible', timeout: 10000 });
  await searchField.fill(searchTerm);
  await page.waitForTimeout(400);

  // 4. Click widget item
  const widgetItem = page.locator(`//div[@wpfefocuslistitem and .//span[text()='${itemText}']]`).first();
  await widgetItem.waitFor({ state: 'visible', timeout: 10000 });
  await widgetItem.click({ force: true });
  await page.waitForTimeout(800);

  // 5. Chờ widget nạp dữ liệu vào cache
  await waitForCqgNotLoading(page, 15000);
  await page.waitForTimeout(2000);

  // 6. Đóng tab widget vừa mở để giải phóng RAM
  try {
    await page.keyboard.press('Escape').catch(() => {});
    const closeBtn = page.locator(
      `//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`
    ).first();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
    }
  } catch {}

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[CQG${profileSuffix}]  Hoàn tất nạp widget "${itemText}" vào cache (${dur}s).`);
}

async function warmupAccount(accountData, profileSuffix, cqgUrl) {
  const { username, password } = accountData;
  if (!username || !password) {
    console.warn(`[CQG${profileSuffix}] Bỏ qua: thiếu username/password!`);
    return;
  }

  const backendDir = fs.existsSync(path.join(process.cwd(), 'temp'))
    ? process.cwd()
    : path.resolve(__dirname, '../..');
  const profileDir = path.join(backendDir, 'temp', `cqg_profile_${profileSuffix}`);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Dọn file lock nếu có
  const locks = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  locks.forEach((lock) => {
    const lockPath = path.join(profileDir, lock);
    if (fs.existsSync(lockPath)) {
      try { fs.unlinkSync(lockPath); } catch {}
    }
  });

  const cacheDir = path.join(profileDir, 'Default', 'Cache');
  const codeCacheDir = path.join(profileDir, 'Default', 'Code Cache');
  const startProfileMB = getDirSizeMB(profileDir);
  const startCacheMB = getDirSizeMB(cacheDir);
  const startCodeCacheMB = getDirSizeMB(codeCacheDir);

  console.log(`\n================================================================================`);
  console.log(`  BẮT ĐẦU WARM-UP PROFILE: CQG${profileSuffix} (${username})`);
  console.log(`  - Thư mục Profile   : ${profileDir}`);
  console.log(`  - Dung lượng Profile ban đầu: ${startProfileMB} MB`);
  console.log(`  - Dung lượng Cache ban đầu  : ${startCacheMB} MB`);
  console.log(`  - Dung lượng Code Cache     : ${startCodeCacheMB} MB`);
  console.log(`================================================================================`);

  const executablePath = getChromeExecutablePath();
  const launchOptions = {
    headless: !isHeaded,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
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
      '--no-default-browser-check',
    ],
    viewport: { width: 1280, height: 720 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: true,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  console.log(`[CQG${profileSuffix}] Khởi động Chrome (${isHeaded ? 'Headed' : 'Headless'})...`);
  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  page.setDefaultTimeout(60000);

  try {
    const navStart = Date.now();
    console.log(`[CQG${profileSuffix}] Mở trang đăng nhập: ${cqgUrl}...`);
    try {
      await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 });
    } catch {
      await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() =>
        page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 })
      );
    }

    // Nhận diện trạng thái LOGIN hay DASHBOARD
    const detectState = async (timeoutMs = 15000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const hasLogin = await page
          .locator('input[name="userName"], input[name="username"], input[type="password"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasLogin) return 'LOGIN';

        const hasDashboard =
          (await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar').first().isVisible().catch(() => false)) ||
          (await page.locator("//div[text()='Ho']").first().isVisible().catch(() => false));
        if (hasDashboard) return 'DASHBOARD';

        await new Promise((r) => setTimeout(r, 400));
      }
      return 'TIMEOUT';
    };

    let state = await detectState(15000);
    if (state === 'TIMEOUT') {
      console.log(`[CQG${profileSuffix}] ⚠️ Quay spinner quá lâu, reload trang...`);
      await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() => {});
      state = await detectState(30000);
    }

    console.log(`[CQG${profileSuffix}] Trạng thái ban đầu: ${state}`);

    if (state === 'LOGIN') {
      console.log(`[CQG${profileSuffix}] Điền thông tin đăng nhập (${username})...`);
      await page.fill('input[name="userName"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');

      await waitForCqgDashboardLogo(page, username, 120000);
    } else if (state === 'DASHBOARD') {
      console.log(`[CQG${profileSuffix}] Phiên đăng nhập còn hiệu lực từ Disk Cache!`);
      await waitForCqgDashboardLogo(page, username, 10000);
    }

    await waitForCqgNotLoading(page, 30000);

    // Warm-up tuần tự 4 widget cốt lõi
    console.log(`\n[CQG${profileSuffix}] --- BẮT ĐẦU WARM-UP 4 WIDGET CHÍNH ---`);
    await warmupSingleWidget(page, 'Fills', 'Fills', profileSuffix);
    await warmupSingleWidget(page, 'P&S', 'Purchase & Sales', profileSuffix);
    await warmupSingleWidget(page, 'Pos', 'Positions', profileSuffix);
    await warmupSingleWidget(page, 'Orders', 'Orders', profileSuffix);

    // Chờ 8 giây để Chrome flush V8 Code Cache và WASM bytecode xuống SSD
    console.log(`\n[CQG${profileSuffix}] 💾 Đang chờ Chromium ghi toàn bộ Code Cache & WASM xuống đĩa SSD...`);
    await page.waitForTimeout(8000);

    const totalDur = ((Date.now() - navStart) / 1000).toFixed(1);
    console.log(`[CQG${profileSuffix}]  Hoàn tất phiên Warm-up sau: ${totalDur}s!`);
  } catch (err) {
    console.error(`[CQG${profileSuffix}] ❌ Lỗi trong quá trình warm-up: ${err.message}`);
  } finally {
    console.log(`[CQG${profileSuffix}] Đóng Chrome để chốt hạ Cache...`);
    await context.close().catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));
  }

  const endProfileMB = getDirSizeMB(profileDir);
  const endCacheMB = getDirSizeMB(cacheDir);
  const endCodeCacheMB = getDirSizeMB(codeCacheDir);

  console.log(`\n📊 KẾT QUẢ WARM-UP PROFILE CQG${profileSuffix}:`);
  console.log(`  • Dung lượng Profile   : ${startProfileMB} MB ➔ ${endProfileMB} MB (+${(endProfileMB - startProfileMB).toFixed(2)} MB)`);
  console.log(`  • Dung lượng Cache HTTP: ${startCacheMB} MB ➔ ${endCacheMB} MB (+${(endCacheMB - startCacheMB).toFixed(2)} MB)`);
  console.log(`  • Dung lượng Code Cache: ${startCodeCacheMB} MB ➔ ${endCodeCacheMB} MB (+${(endCodeCacheMB - startCodeCacheMB).toFixed(2)} MB)`);
  console.log(`--------------------------------------------------------------------------------\n`);
}

async function main() {
  console.log('================================================================================');
  console.log('     CHƯƠNG TRÌNH WARM-UP & NUÔI GIỮ ẤM CACHE PROFILE CQG CHROMIUM');
  console.log('================================================================================');
  console.log(`- Môi trường chạy   : ${process.platform} (${process.arch})`);
  console.log(`- Chế độ hiển thị   : ${isHeaded ? 'CÓ GIAO DIỆN (Headed)' : 'CHẠY NGẦM (Headless)'}`);
  console.log(`- Tài khoản mục tiêu: ${targetAccount.toUpperCase()}`);

  const creds = await loadCredentials();

  if (targetAccount === '1' || targetAccount === 'all') {
    await warmupAccount(creds.account1, '1', creds.url);
  }

  if (targetAccount === '2' || targetAccount === 'all') {
    await warmupAccount(creds.account2, '2', creds.url);
  }

  console.log('================================================================================');
  console.log('  HOÀN TẤT TOÀN BỘ QUÁ TRÌNH WARM-UP CACHE! PROFILE ĐÃ SẴN SÀNG CHẠY NHANH.');
  console.log('================================================================================\n');
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
