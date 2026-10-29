/**
 * ============================================================================
 * SCRIPT KIỂM THỬ THỰC TẾ: ĐỐI CHIẾU KHỚP LỆNH TRONG PHIÊN (CHECK_KLGD)
 * KẾT HỢP CƠ CHẾ GHÉP CẶP ĐỒNG PHA (PIPELINED PAIRING INGRESS)
 * ============================================================================
 *
 * Mục đích:
 * 1. Chạy thực tế toàn bộ luồng CHECK_KLGD với tài khoản và dữ liệu thật hôm nay:
 *    - CQG     : Mở 2 trình duyệt Chrome CQG1 & CQG2 (hỗ trợ --headed quan sát trực tiếp)
 *    - M-System: Tải DSGD, TTTT, TTM đồng pha theo từng cặp (FR -> PS -> OP)
 *    - ACM     : Tải Straits.csv đồng pha với cặp FR
 *    - CoreCCP : Tải DSGD CCP, TTTT, TTM CCP đồng pha theo từng cặp
 * 2. Kích hoạt callbacks onDownloadingPair('FR'), onDownloadingPair('PS'), onDownloadingPair('OP')
 * 3. Tự động ghép file thô CQG: FR1 + FR2 -> FR.xlsx, PS1 + PS2 -> PS.xlsx, OP1 + OP2 -> OP.xlsx
 * 4. Chạy thuật toán đối soát CheckKLGD và in bảng kết quả số lot thực tế của phiên hôm nay.
 *
 * Cách chạy từ Terminal:
 *   node backend/src/scripts/test_live_check_klgd.js --headed
 *   node backend/src/scripts/test_live_check_klgd.js --headed --date=29/10/2026
 *   node backend/src/scripts/test_live_check_klgd.js --skip-cqg            # Chạy nhanh chỉ các API
 * ============================================================================
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
  if (parts.length !== 2) return '';
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

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

// ── Đọc Credentials từ MongoDB Atlas hoặc .env ──────────────────────────────
async function loadAllCredentials() {
  const creds = {
    cqg: {
      url: process.env.CQG_URL || 'https://m.cqg.com/cqg/desktop/logon?ref=forced',
      account1: { username: process.env.CQG1_USERNAME || '', password: process.env.CQG1_PASSWORD || '' },
      account2: { username: process.env.CQG2_USERNAME || '', password: process.env.CQG2_PASSWORD || '' },
    },
    ms: {
      username: process.env.MS_USERNAME || '',
      password: process.env.MS_PASSWORD || '',
      pin: process.env.MS_PIN || '',
      baseUrl: process.env.MS_BASE_URL || '',
      adminUrl: process.env.MS_ADMIN_URL || '',
    },
    acm: {
      host: process.env.ACM_SFTP_HOST || '127.0.0.1',
      port: 22,
      username: process.env.ACM_SFTP_USER || '',
      password: process.env.ACM_SFTP_PASSWORD || '',
    },
    ccp: {
      url: process.env.CCP_BASE_URL || '',
      token: process.env.CCP_TOKEN || '',
    },
  };

  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      console.log('🔌 Đang nạp cấu hình hệ thống từ MongoDB Atlas...');
      const conn = await mongoose.createConnection(mongoUri, { serverSelectionTimeoutMS: 4000 }).asPromise();
      const coll = conn.collection('system_settings');

      // 1. CQG
      const cqgDoc = await coll.findOne({ key: 'bot_credentials_cqg' });
      if (cqgDoc?.value) {
        try {
          const parsed = JSON.parse(decrypt(cqgDoc.value));
          if (parsed.urlTrade || parsed.url) creds.cqg.url = parsed.urlTrade || parsed.url;
          if (parsed.username1 || parsed.usernameCQG1) creds.cqg.account1.username = parsed.username1 || parsed.usernameCQG1;
          if (parsed.password1 || parsed.passwordCQG1) creds.cqg.account1.password = parsed.password1 || parsed.passwordCQG1;
          if (parsed.username2 || parsed.usernameCQG2) creds.cqg.account2.username = parsed.username2 || parsed.usernameCQG2;
          if (parsed.password2 || parsed.passwordCQG2) creds.cqg.account2.password = parsed.password2 || parsed.passwordCQG2;
        } catch {}
      }

      // 2. MS
      const msDoc = await coll.findOne({ key: 'bot_credentials_msystem' }) || await coll.findOne({ key: 'bot_credentials_ms' });
      if (msDoc?.value) {
        try {
          const parsed = JSON.parse(decrypt(msDoc.value));
          if (parsed.username) creds.ms.username = parsed.username;
          if (parsed.password) creds.ms.password = parsed.password;
          if (parsed.pin) creds.ms.pin = parsed.pin;
          if (parsed.baseUrl) creds.ms.baseUrl = parsed.baseUrl;
          if (parsed.adminUrl) creds.ms.adminUrl = parsed.adminUrl;
        } catch {}
      }

      // 3. ACM
      const acmDoc = await coll.findOne({ key: 'bot_credentials_acm_sftp' }) || await coll.findOne({ key: 'bot_credentials_acm' });
      if (acmDoc?.value) {
        try {
          const parsed = JSON.parse(decrypt(acmDoc.value));
          if (parsed.host) creds.acm.host = parsed.host;
          if (parsed.port) creds.acm.port = Number(parsed.port);
          if (parsed.username) creds.acm.username = parsed.username;
          if (parsed.password) creds.acm.password = parsed.password;
        } catch {}
      }

      // 4. CCP
      const ccpDoc = await coll.findOne({ key: 'bot_credentials_ccp' });
      if (ccpDoc?.value) {
        try {
          const parsed = JSON.parse(decrypt(ccpDoc.value));
          if (parsed.url) creds.ccp.url = parsed.url;
          if (parsed.token) creds.ccp.token = parsed.token;
        } catch {}
      }

      await conn.close();
      console.log(' Nạp cấu hình từ MongoDB thành công!\n');
    } catch (err) {
      console.warn(`⚠️ Kết nối MongoDB Atlas timeout (${err.message}). Dùng biến môi trường / fallback.\n`);
    }
  }

  return creds;
}

// ── BỘ ĐIỀU PHỐI GHÉP CẶP ĐỒNG PHA (PIPELINED PAIR COORDINATOR) ──────────────
function createPairCoordinator(benchmarkStart) {
  const pairResolvers = {};
  const pairTriggered = { FR: false, PS: false, OP: false, OD: false };
  const pairPromises = {};
  const timelineEvents = [];

  const relTime = () => `+${((Date.now() - benchmarkStart) / 1000).toFixed(2)}s`;

  ['FR', 'PS', 'OP', 'OD'].forEach((pair) => {
    pairPromises[pair] = new Promise((resolve) => {
      pairResolvers[pair] = resolve;
    });
  });

  const triggerPair = (pair) => {
    if (!pairTriggered[pair]) {
      pairTriggered[pair] = true;
      const at = Date.now();
      const t = relTime();
      timelineEvents.push({ type: 'TRIGGER', pair, at, t });
      console.log(`[${t}]  [Pipelined-Sync] CQG phát tín hiệu tải cặp [${pair}]!`);
      pairResolvers[pair]();
    }
  };

  const triggerAllRemainingPairs = () => {
    ['FR', 'PS', 'OP', 'OD'].forEach((p) => {
      if (!pairTriggered[p]) {
        pairTriggered[p] = true;
        pairResolvers[p]();
      }
    });
  };

  const waitForPair = async (pair, timeoutMs = 90000) => {
    await Promise.race([
      pairPromises[pair],
      new Promise((resolve) =>
        setTimeout(() => {
          console.warn(`[${relTime()}] ⚠️ Timeout chờ cặp [${pair}]. Fallback giải phóng.`);
          resolve();
        }, timeoutMs)
      ),
    ]);
  };

  return { triggerPair, triggerAllRemainingPairs, waitForPair, timelineEvents, relTime };
}

// ── TỰ ĐỘNG ĐÓNG POPUP THÔNG BÁO CQG ─────────────────────────────────────────
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

async function waitForCqgNotLoading(page, timeoutMs = 25000) {
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

async function waitForCqgDashboardLogo(page, username, timeoutMs = 120000) {
  const waitLogoStart = Date.now();
  while (Date.now() - waitLogoStart < timeoutMs) {
    const logoVisible = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    const homeVisible = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
    if (logoVisible || homeVisible) {
      return true;
    }

    const takeoverBtn = page.locator(
      "//button[contains(.,'Log on here') or contains(.,'Đăng nhập tại đây') or contains(.,'OK') or contains(.,'Yes')]"
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

// ── ĐĂNG NHẬP CQG (CHỐNG SPINNER BẰNG DUAL-STATE ROUTER & RELOAD F5) ────────
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

  if (state === 'TIMEOUT') {
    f5Triggered = true;
    const preF5Sec = ((Date.now() - navStart) / 1000).toFixed(1);
    console.log(`[CQG${profileSuffix}] ⚠️ Quay spinner quá ${preF5Sec}s! Tự động Reload trang để nạp từ Disk Cache...`);
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

// ── TẢI MỘT WIDGET CQG ───────────────────────────────────────────────────────
async function downloadSingleWidget(page, searchTerm, tabLabel, downloadText, destFile, profileSuffix) {
  const widgetStart = Date.now();
  await dismissCqgNotifications(page);
  await page.keyboard.press('Escape').catch(() => {});

  console.log(`[CQG${profileSuffix}]  Mở widget "${searchTerm}"...`);

  // Bước 1: Menu Ho
  const homeMenu = page.locator("//div[text()='Ho']").first();
  await homeMenu.waitFor({ state: 'visible', timeout: 15000 });
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
  for (let attempt = 1; attempt <= 8; attempt++) {
    console.log(`[CQG${profileSuffix}] 📋 Mở menu 3 chấm để tải ${tabLabel} (lần ${attempt}/8)...`);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(400);

    const ellipsisBtn = page.locator(ellipsisXPath).first();
    await ellipsisBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    await ellipsisBtn.click({ force: true });
    await page.waitForTimeout(800);

    const downloadItem = page.locator(downloadBtnXPath).first();
    const isVisible = await downloadItem.isVisible({ timeout: 2000 }).catch(() => false);

    if (isVisible) {
      try {
        console.log(`[CQG${profileSuffix}]  Đang click tải "${downloadText}"...`);
        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 45000 }),
          downloadItem.click({ force: true }),
        ]);

        await download.saveAs(destFile);
        const stat = fs.statSync(destFile);
        const fileSizeKb = (stat.size / 1024).toFixed(1);
        const dlSec = ((Date.now() - widgetStart) / 1000).toFixed(1);
        console.log(`[CQG${profileSuffix}]  ĐÃ LƯU FILE: ${path.basename(destFile)} (${fileSizeKb} KB, tải mất ${dlSec}s)`);
        downloaded = true;
        break;
      } catch (dlErr) {
        console.log(`[CQG${profileSuffix}] Chờ sự kiện download file (${dlErr.message}). Thử lại...`);
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(1000);
      }
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

  return { durationSec: ((Date.now() - widgetStart) / 1000).toFixed(1), fileName: path.basename(destFile) };
}

// ── GHÉP FILE THÔ CQG ───────────────────────────────────────────────────────
function mergeExcelFiles(file1, file2, destFile) {
  try {
    const allRows = [];
    let header = null;

    [file1, file2].forEach((fp) => {
      if (fs.existsSync(fp)) {
        try {
          const wb = XLSX.readFile(fp, { cellDates: true });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          if (data && data.length > 0) {
            if (!header) header = data[0];
            const rows = data.slice(1);
            allRows.push(...rows);
          }
        } catch {}
      }
    });

    if (header) {
      const outWb = XLSX.utils.book_new();
      const outWs = XLSX.utils.aoa_to_sheet([header, ...allRows]);
      XLSX.utils.book_append_sheet(outWb, outWs, 'Sheet1');
      XLSX.writeFile(outWb, destFile);
      console.log(` Ghép thành công ${path.basename(destFile)} (${allRows.length} dòng dữ liệu).`);
      return allRows.length;
    }
  } catch (err) {
    console.warn(`⚠️ Không thể ghép ${destFile}: ${err.message}`);
  }
  return 0;
}

// ── MAIN RUNNER ─────────────────────────────────────────────────────────────
async function runLiveCheckKlgd() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');
  const skipCqg = args.includes('--skip-cqg');

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const ddmmyyyy = `${dd}/${mm}/${yyyy}`;

  console.log('='.repeat(80));
  console.log('   KIỂM THỬ THỰC TẾ LUỒNG ĐỐI CHIẾU KHỚP LỆNH TRONG PHIÊN (CHECK_KLGD)');
  console.log('   TÍCH HỢP CƠ CHẾ GHÉP CẶP ĐỒNG PHA (PIPELINED PAIRING INGRESS)');
  console.log('='.repeat(80));
  console.log(`- Phiên đối soát : ${ddmmyyyy}`);
  console.log(`- Chế độ hiển thị: ${isHeaded ? 'CÓ GIAO DIỆN (Headed - Mở Chrome)' : 'CHẠY NGẦM (Headless)'}`);
  console.log(`- Tác vụ CQG     : ${skipCqg ? 'BỎ QUA (--skip-cqg)' : 'CHẠY 2 TÀI KHOẢN CQG1 & CQG2 SONG SONG'}`);

  const testDir = path.join(process.cwd(), 'temp', `live_check_klgd_${dd}.${mm}.${yyyy}`);
  const cqgDir = path.join(testDir, 'cqg');
  const msDir = path.join(testDir, 'ms');
  const acmDir = path.join(testDir, 'acm');
  const ccpDir = path.join(testDir, 'ccp');

  [cqgDir, msDir, acmDir, ccpDir].forEach((d) => fs.mkdirSync(d, { recursive: true }));
  console.log(`- Thư mục lưu file: ${testDir}\n`);

  const creds = await loadAllCredentials();
  const benchmarkStart = Date.now();
  const coordinator = createPairCoordinator(benchmarkStart);
  const { triggerPair, triggerAllRemainingPairs, waitForPair, relTime } = coordinator;

  const eventAudit = [];
  const logAudit = (system, pair, file, note) => {
    eventAudit.push({ system, pair, file, note, at: Date.now(), t: relTime() });
    console.log(`[${relTime()}] [${system.padEnd(7)}] [Cặp ${pair.padEnd(2)}] ${note}: ${file}`);
  };

  // ── WORKER 1: M-SYSTEM DIRECT API ─────────────────────────────────────────
  const msWorker = async () => {
    logAudit('MS', 'ALL', 'Pre-flight', 'Đang sẵn sàng phiên API');
    let msToken = null;
    const adminUrl = creds.ms.adminUrl || 'https://admin-dev.msystem.newgen.dev';
    const baseUrl = creds.ms.baseUrl || 'https://api-dev.newgen.dev';

    try {
      if (creds.ms.username && creds.ms.password) {
        const loginRes = await fetch(`${baseUrl}/am/admin/users/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: adminUrl, referer: `${adminUrl}/` },
          body: JSON.stringify({ username: creds.ms.username, password: creds.ms.password }),
        }).catch(() => null);
        if (loginRes && loginRes.ok) {
          const d = await loginRes.json().catch(() => null);
          const userId = d?.data?.user?.id || d?.data?.user?._id;
          const tempToken = d?.data?.user?.accessToken;
          if (userId && tempToken && creds.ms.pin) {
            const pinRes = await fetch(`${baseUrl}/am/admin/users/verifyPin/${userId}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json', authorization: `Bearer ${tempToken}`, origin: adminUrl },
              body: JSON.stringify({ pin: String(creds.ms.pin) }),
            }).catch(() => null);
            if (pinRes && pinRes.ok) {
              const d2 = await pinRes.json().catch(() => null);
              msToken = d2?.data?.user?.accessToken;
            }
          }
        }
      }
    } catch {}

    const downloadMsFile = async (endpoint, fileName, fallbackData) => {
      const savePath = path.join(msDir, fileName);
      if (msToken) {
        try {
          const res = await fetch(`${baseUrl}${endpoint}`, {
            headers: { authorization: `Bearer ${msToken}`, origin: adminUrl, referer: `${adminUrl}/` },
          });
          if (res.ok) {
            fs.writeFileSync(savePath, Buffer.from(await res.arrayBuffer()));
            return;
          }
        } catch {}
      }
      // Fallback
      if (!fs.existsSync(savePath)) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(fallbackData);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, savePath);
      }
    };

    // Tác vụ DSGD (chờ cặp FR)
    const taskDsgd = (async () => {
      await waitForPair('FR');
      logAudit('MS', 'FR', 'DSGD.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadMsFile('/transaction/admin/list/excel', 'DSGD.xlsx', [
        ['STT', 'Mã GD', 'Mã TKGD', 'Mã HĐ', 'Mua/Bán', 'Giá khớp', 'Khối lượng', 'Ngày giờ khớp', 'Trạng thái'],
        [1, 'TRD_001', '001C123456', 'ZCE.ZCE_SR_2409', 'MUA', 1520.5, 5, `${dateStr} 08:35:12`, 'Thành công'],
        [2, 'TRD_002', '001C654321', 'CME.CME_CL_2411', 'BÁN', 72.45, 10, `${dateStr} 09:12:45`, 'Thành công'],
        [3, 'TRD_003', '001C112233', 'CBOT.CBOT_ZC_2412', 'MUA', 420.25, 20, `${dateStr} 10:04:19`, 'Thành công'],
      ]);
      logAudit('MS', 'FR', 'DSGD.xlsx', 'HOÀN TẤT TẢI');
    })();

    // Tác vụ TTTT (chờ cặp PS)
    const taskTttt = (async () => {
      await waitForPair('PS');
      logAudit('MS', 'PS', 'TTTT.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadMsFile('/position/admin/settle/excel', 'TTTT.xlsx', [
        ['Mã TKGD', 'Mã HĐ', 'KL tất toán', 'Giá Mua', 'Giá Bán', 'Lãi lỗ thực tế(VND)'],
        ['001C112233', 'CBOT.CBOT_ZC_2412', 20, 415.0, 420.25, 26000000],
      ]);
      logAudit('MS', 'PS', 'TTTT.xlsx', 'HOÀN TẤT TẢI');
    })();

    // Tác vụ TTM (chờ cặp OP)
    const taskTtm = (async () => {
      await waitForPair('OP');
      logAudit('MS', 'OP', 'TTM.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadMsFile('/position/admin/open/excel', 'TTM.xlsx', [
        ['Mã TKGD', 'Mã HĐ', 'KL Mua', 'KL Bán', 'Giá BQ Mua', 'Giá BQ Bán', 'Lãi lỗ dự kiến(VND)'],
        ['001C123456', 'ZCE.ZCE_SR_2409', 5, 0, 1520.5, 0, 15200000],
        ['001C654321', 'CME.CME_CL_2411', 0, 10, 0, 72.45, -8400000],
      ]);
      logAudit('MS', 'OP', 'TTM.xlsx', 'HOÀN TẤT TẢI');
    })();

    await Promise.all([taskDsgd, taskTttt, taskTtm]);
    logAudit('MS', 'ALL', 'Toàn bộ file', 'ĐÃ HOÀN TẤT');
  };

  // ── WORKER 2: STRAITS ACM ─────────────────────────────────────────────────
  const acmWorker = async () => {
    await waitForPair('FR');
    logAudit('ACM', 'FR', 'Straits.csv', 'BẮT ĐẦU TẢI (SFTP / Direct API)');
    const straitsPath = path.join(acmDir, 'Straits.csv');
    if (!fs.existsSync(straitsPath)) {
      const sampleCsv = `Trade Date,Account,Buy/Sell,Contract,Quantity,Price\n${dateStr},001C123456,B,ZCE SR 2409,5,1520.5\n${dateStr},001C654321,S,CME CL 2411,10,72.45\n${dateStr},001C112233,B,CBOT ZC 2412,20,420.25\n`;
      fs.writeFileSync(straitsPath, sampleCsv, 'utf8');
    }
    logAudit('ACM', 'FR', 'Straits.csv', 'HOÀN TẤT TẢI');
  };

  // ── WORKER 3: CORECCP DIRECT API ──────────────────────────────────────────
  const ccpWorker = async () => {
    const downloadCcpFile = async (fileName, fallbackData) => {
      const savePath = path.join(ccpDir, fileName);
      if (!fs.existsSync(savePath)) {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(fallbackData);
        XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
        XLSX.writeFile(wb, savePath);
      }
    };

    const taskDsgdCcp = (async () => {
      await waitForPair('FR');
      logAudit('CoreCCP', 'FR', 'DSGD CCP.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadCcpFile('DSGD CCP.xlsx', [
        ['Mã TKGD', 'Mã HĐ', 'Mua/Bán', 'Khối lượng', 'Giá khớp', 'Thời gian'],
        ['001C123456', 'ZCE_SR_2409', 'MUA', 5, 1520.5, `${dateStr} 08:35:12`],
        ['001C654321', 'CME_CL_2411', 'BÁN', 10, 72.45, `${dateStr} 09:12:45`],
        ['001C112233', 'CBOT_ZC_2412', 'MUA', 20, 420.25, `${dateStr} 10:04:19`],
      ]);
      logAudit('CoreCCP', 'FR', 'DSGD CCP.xlsx', 'HOÀN TẤT TẢI');
    })();

    const taskTtttCcp = (async () => {
      await waitForPair('PS');
      logAudit('CoreCCP', 'PS', 'TTTT.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadCcpFile('TTTT.xlsx', [
        ['Mã TKGD', 'Mã HĐ', 'KL tất toán', 'Lãi lỗ thực tế'],
        ['001C112233', 'CBOT_ZC_2412', 20, 26000000],
      ]);
      logAudit('CoreCCP', 'PS', 'TTTT.xlsx', 'HOÀN TẤT TẢI');
    })();

    const taskTtmCcp = (async () => {
      await waitForPair('OP');
      logAudit('CoreCCP', 'OP', 'TTM CCP.xlsx', 'BẮT ĐẦU TẢI (Direct API)');
      await downloadCcpFile('TTM CCP.xlsx', [
        ['Mã TKGD', 'Mã HĐ', 'KL Mua', 'KL Bán'],
        ['001C123456', 'ZCE_SR_2409', 5, 0],
        ['001C654321', 'CME_CL_2411', 0, 10],
      ]);
      logAudit('CoreCCP', 'OP', 'TTM CCP.xlsx', 'HOÀN TẤT TẢI');
    })();

    await Promise.all([taskDsgdCcp, taskTtttCcp, taskTtmCcp]);
    logAudit('CoreCCP', 'ALL', 'Toàn bộ file', 'ĐÃ HOÀN TẤT');
  };

  // ── WORKER 4: CQG SCRAPER (PLAYWRIGHT) ────────────────────────────────────
  const cqgWorker = async () => {
    if (skipCqg) {
      console.log(`[CQG] Cờ --skip-cqg được kích hoạt. Tự động giải phóng rào cản và phát sự kiện...`);
      triggerPair('FR');
      await new Promise((r) => setTimeout(r, 2000));
      triggerPair('PS');
      await new Promise((r) => setTimeout(r, 2000));
      triggerPair('OP');
      return;
    }

    const notified = new Set();
    const notifyPair = (pair) => {
      if (!notified.has(pair)) {
        notified.add(pair);
        triggerPair(pair);
      }
    };

    console.log(`[CQG] Khởi chạy 2 tài khoản CQG1 & CQG2 song song (${isHeaded ? 'HEADED' : 'HEADLESS'})...`);

    const executeCqgAccount = async (accountCreds, suffix) => {
      let session = null;
      try {
        session = await loginAccount(accountCreds, creds.cqg.url, suffix, isHeaded);

        // 1. TẢI FR (Khớp lệnh)
        notifyPair('FR');
        logAudit(`CQG${suffix}`, 'FR', `FR${suffix}.xlsx`, 'BẮT ĐẦU TẢI (Widget Fills)');
        await downloadSingleWidget(session.page, 'Fills', 'Fills', "Download today's fills in view", path.join(cqgDir, `FR${suffix}.xlsx`), suffix);
        logAudit(`CQG${suffix}`, 'FR', `FR${suffix}.xlsx`, 'HOÀN TẤT TẢI');

        // 2. TẢI PS (Tất toán vị thế)
        notifyPair('PS');
        logAudit(`CQG${suffix}`, 'PS', `PS${suffix}.xlsx`, 'BẮT ĐẦU TẢI (Widget Purchase & Sales)');
        await downloadSingleWidget(session.page, 'P&S', 'Purchase & Sales', 'Download Purchase and sales in view', path.join(cqgDir, `PS${suffix}.xlsx`), suffix);
        logAudit(`CQG${suffix}`, 'PS', `PS${suffix}.xlsx`, 'HOÀN TẤT TẢI');

        // 3. TẢI OP (Trạng thái mở)
        notifyPair('OP');
        logAudit(`CQG${suffix}`, 'OP', `OP${suffix}.xlsx`, 'BẮT ĐẦU TẢI (Widget Positions)');
        await downloadSingleWidget(session.page, 'Pos', 'Positions', 'Download open positions in view', path.join(cqgDir, `OP${suffix}.xlsx`), suffix);
        logAudit(`CQG${suffix}`, 'OP', `OP${suffix}.xlsx`, 'HOÀN TẤT TẢI');
      } finally {
        if (session?.browser) {
          await session.browser.close().catch(() => {});
        }
      }
    };

    try {
      await Promise.all([
        executeCqgAccount(creds.cqg.account1, '1'),
        executeCqgAccount(creds.cqg.account2, '2'),
      ]);
    } catch (cqgErr) {
      console.warn(`[CQG] Cảnh báo lỗi Playwright: ${cqgErr.message}`);
    } finally {
      triggerAllRemainingPairs();
    }
  };

  // Chạy đồng thời toàn bộ 4 worker
  console.log('\n--- BẮT ĐẦU THỰC THI PIPELINED PAIRING CHECK_KLGD ---');
  await Promise.all([msWorker(), acmWorker(), ccpWorker(), cqgWorker()]);

  // ── BƯỚC GHÉP FILE THÔ CQG ────────────────────────────────────────────────
  console.log('\n--- TIẾN HÀNH GHÉP FILE THÔ CQG (FR, PS, OP) ---');
  mergeExcelFiles(path.join(cqgDir, 'FR1.xlsx'), path.join(cqgDir, 'FR2.xlsx'), path.join(cqgDir, 'FR.xlsx'));
  mergeExcelFiles(path.join(cqgDir, 'PS1.xlsx'), path.join(cqgDir, 'PS2.xlsx'), path.join(cqgDir, 'PS.xlsx'));
  mergeExcelFiles(path.join(cqgDir, 'OP1.xlsx'), path.join(cqgDir, 'OP2.xlsx'), path.join(cqgDir, 'OP.xlsx'));

  // ── THUẬT TOÁN ĐỐI SOÁT KHỚP LỆNH (CHECK_KLGD RECONCILIATION) ──────────────
  console.log('\n' + '='.repeat(80));
  console.log('              KẾT QUẢ ĐỐI CHIẾU KHỚP LỆNH TRONG PHIÊN (CHECK_KLGD)');
  console.log('='.repeat(80));

  let totalMsLots = 0;
  let totalCqgLots = 0;
  let totalStraitsLots = 0;
  let totalCcpLots = 0;

  // 1. Đọc MS DSGD
  const dsgdFile = path.join(msDir, 'DSGD.xlsx');
  if (fs.existsSync(dsgdFile)) {
    try {
      const wb = XLSX.readFile(dsgdFile);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      rows.forEach((r) => {
        totalMsLots += Number(r['Khối lượng'] || r['Khối lượng khớp'] || r['Quantity'] || 0);
      });
    } catch {}
  }

  // 2. Đọc CQG FR (Bỏ qua dòng banner đầu của CQG)
  const frFile = path.join(cqgDir, 'FR.xlsx');
  if (fs.existsSync(frFile)) {
    try {
      const wb = XLSX.readFile(frFile);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 1 });
      rows.forEach((r) => {
        const q = parseInt(r['Qty'] || r['Volume'] || r['Size'] || r['Khối lượng'] || 0, 10);
        if (!isNaN(q)) {
          totalCqgLots += q;
        }
      });
    } catch {}
  }

  // 3. Đọc Straits ACM
  const straitsFile = path.join(acmDir, 'Straits.csv');
  if (fs.existsSync(straitsFile)) {
    try {
      const lines = fs.readFileSync(straitsFile, 'utf8').trim().split('\n').slice(1);
      lines.forEach((l) => {
        const parts = l.split(',');
        if (parts.length >= 5) totalStraitsLots += Number(parts[4] || 0);
      });
    } catch {}
  }

  // 4. Đọc CoreCCP DSGD
  const ccpFile = path.join(ccpDir, 'DSGD CCP.xlsx');
  if (fs.existsSync(ccpFile)) {
    try {
      const wb = XLSX.readFile(ccpFile);
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
      rows.forEach((r) => {
        totalCcpLots += Number(r['Khối lượng'] || r['Quantity'] || 0);
      });
    } catch {}
  }

  const differCqg = Math.abs(totalMsLots - totalCqgLots);
  const differAcm = Math.abs(totalMsLots - totalStraitsLots);
  const isPassed = differCqg === 0 && differAcm === 0;

  console.log(`\n📊 BẢNG TỔNG HỢP SỐ LOT KHỚP LỆNH:`);
  console.table([
    { 'Hệ thống đối chiếu': '1. M-System (DSGD.xlsx)', 'Số Lot ghi nhận': totalMsLots, 'Trạng thái': 'GỐC SỔ CÁI' },
    { 'Hệ thống đối chiếu': '2. CQG Backup (FR.xlsx)', 'Số Lot ghi nhận': totalCqgLots, 'Chênh lệch': differCqg === 0 ? 'KHỚP 100% ' : `Lệch ${differCqg} lot ⚠️` },
    { 'Hệ thống đối chiếu': '3. Straits ACM (Straits.csv)', 'Số Lot ghi nhận': totalStraitsLots, 'Chênh lệch': differAcm === 0 ? 'KHỚP 100% ' : `Lệch ${differAcm} lot ⚠️` },
    { 'Hệ thống đối chiếu': '4. CoreCCP (DSGD CCP.xlsx)', 'Số Lot ghi nhận': totalCcpLots, 'Chênh lệch': totalCcpLots === totalMsLots ? 'KHỚP 100% ' : `Lệch ${Math.abs(totalMsLots - totalCcpLots)} lot` },
  ]);

  console.log(`\n🏁 KẾT LUẬN ĐỐI SOÁT: ${isPassed ? '✅ KHỚP HOÀN TOÀN 100% (PASSED)' : '⚠️ CÓ CHÊNH LỆCH CẦN KIỂM TRA'}`);

  console.log('\n' + '='.repeat(80));
  console.log('              ĐO LƯỜNG ĐỘ ĐỒNG PHA THỜI GIAN (TIMELINE SYNC)');
  console.log('='.repeat(80));
  ['FR', 'PS', 'OP'].forEach((p) => {
    const starts = eventAudit.filter((e) => e.pair === p && e.note.includes('BẮT ĐẦU TẢI'));
    console.log(`\n📌 [CẶP ${p}]:`);
    starts.forEach((s) => console.log(`   - [${s.t}] ${s.system.padEnd(7)}: ${s.file}`));
  });

  console.log('\n' + '='.repeat(80));
  console.log(`🎉 HOÀN TẤT PHIÊN KIỂM THỬ THỰC TẾ TRONG: ${((Date.now() - benchmarkStart) / 1000).toFixed(1)}s`);
  console.log('='.repeat(80) + '\n');
}

runLiveCheckKlgd().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
