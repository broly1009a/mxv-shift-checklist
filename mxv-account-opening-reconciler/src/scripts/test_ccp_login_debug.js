/**
 * ============================================================================
 * test_ccp_login_debug.js
 * ============================================================================
 * Tool kiểm tra và debug quy trình đăng nhập CoreCCP (VNCLEAR) bằng Playwright.
 * Đồng thời kiểm tra điều hướng đến màn hình Danh sách TKGD (/ACCOUNTMNG/ACCOUNTS_INFO)
 * để chuẩn bị cho luồng thẩm định tiểu khoản (-A) tự động.
 *
 * Hướng dẫn chạy (USER tự chạy trực tiếp trên Terminal):
 *   # 1. Chạy có giao diện trực quan (Khuyến nghị để quan sát):
 *   node src/scripts/test_ccp_login_debug.js --headed
 *
 *   # 2. Chạy ngầm (Headless):
 *   node src/scripts/test_ccp_login_debug.js --headless
 *
 *   # 3. Kiểm tra thử 1 tiểu khoản cụ thể (-A):
 *   node src/scripts/test_ccp_login_debug.js --headed --subaccount 003C2886699-A
 *
 *   # 4. Tùy chỉnh URL / Tài khoản / Mật khẩu nếu cần:
 *   node src/scripts/test_ccp_login_debug.js --headed --username hieptruong --url https://uat-coreccp.mxv.com.vn/login
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { chromium } = require('playwright-core');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ─── 1. ĐỌC THAM SỐ DÒNG LỆNH (CLI) ──────────────────────────────────────────
const args = process.argv.slice(2);
const isHeaded = args.includes('--headed') || !args.includes('--headless');
const urlIdx = args.indexOf('--url');
const cliUrl = urlIdx !== -1 ? args[urlIdx + 1] : null;
const userIdx = args.indexOf('--username');
const cliUser = userIdx !== -1 ? args[userIdx + 1] : null;
const passIdx = args.indexOf('--password');
const cliPass = passIdx !== -1 ? args[passIdx + 1] : null;
const subAccIdx = args.indexOf('--subaccount');
const targetSubAccount = subAccIdx !== -1 ? args[subAccIdx + 1] : null;
const slowIdx = args.indexOf('--slow');
const slowMo = slowIdx !== -1 ? parseInt(args[slowIdx + 1], 10) || 0 : 200;

// Thư mục lưu ảnh chụp màn hình debug
const screenshotDir = path.resolve(process.cwd(), 'temp', 'screenshots', 'ccp_debug');
if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir, { recursive: true });

function log(label, msg) {
  const ts = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${ts}] [${label}] ${msg}`);
}

function step(n, total, title) {
  console.log('\n' + '='.repeat(65));
  console.log(`  BƯỚC ${n}/${total}: ${title}`);
  console.log('='.repeat(65));
}

function findBrowser() {
  if (process.platform === 'linux') {
    const linuxCandidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ];
    return linuxCandidates.find((c) => fs.existsSync(c));
  }

  const winCandidates = [
    path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  return winCandidates.find((c) => fs.existsSync(c));
}

function decryptCcp(enc) {
  if (!enc) return '';
  const parts = enc.split(':');
  if (parts.length !== 2) return enc;
  const iv = Buffer.from(parts[0], 'hex');
  const data = Buffer.from(parts[1], 'hex');

  try {
    const key1 = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
    const d1 = crypto.createDecipheriv('aes-256-cbc', key1, iv);
    return Buffer.concat([d1.update(data), d1.final()]).toString('utf8');
  } catch {
    try {
      const key2 = crypto
        .createHash('sha256')
        .update(process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!')
        .digest();
      const d2 = crypto.createDecipheriv('aes-256-cbc', key2, iv);
      return Buffer.concat([d2.update(data), d2.final()]).toString('utf8');
    } catch {
      return enc;
    }
  }
}

async function getCredentials() {
  if (cliUser && cliPass) {
    return {
      url: cliUrl || process.env.CCP_URL || 'https://uat-coreccp.mxv.com.vn/login',
      username: cliUser,
      password: cliPass,
      source: 'CLI_ARGS',
    };
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  try {
    log('DB', `Kết nối MongoDB lấy credentials: ${mongoUri}`);
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const row = await conn.connection.db.collection('bot_credentials').findOne({ botType: 'CCP' });
    if (row && row.credentialsEncrypted) {
      const dec = decryptCcp(row.credentialsEncrypted);
      const parsed = JSON.parse(dec);
      await mongoose.disconnect();
      return {
        url: cliUrl || parsed.url || 'https://uat-coreccp.mxv.com.vn/login',
        username: parsed.username,
        password: parsed.password,
        source: 'MONGODB (bot_credentials)',
      };
    }
    await mongoose.disconnect();
  } catch (err) {
    log('DB_WARN', `Không đọc được bot_credentials (${err.message}). Dùng biến môi trường / fallback.`);
  }

  return {
    url: cliUrl || process.env.CCP_URL || 'https://uat-coreccp.mxv.com.vn/login',
    username: cliUser || process.env.CCP_USERNAME || 'hieptruong',
    password: cliPass || process.env.CCP_PASSWORD || 'Taovipko0!',
    source: 'ENV / FALLBACK',
  };
}

async function dismissBackdrop(page) {
  try {
    const backdrop = page
      .locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]")
      .first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch {}
}

async function waitForTableReady(page, maxTimeoutMs = 25000) {
  const startTime = Date.now();
  await page.waitForTimeout(400);
  const spinnerSel =
    "xpath=//*[contains(@class, 'MuiCircularProgress-root') or contains(@class, 'MuiLinearProgress-root') or contains(@class, 'MuiBackdrop-root') or @role='progressbar' or contains(@id, 'mrt-progress') or contains(@class, 'MuiSkeleton-root')]";
  let stable = 0;
  while (Date.now() - startTime < maxTimeoutMs) {
    try {
      const noData = page
        .locator(
          "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')] | //*[text()='Không có dữ liệu']",
        )
        .first();
      if (await noData.isVisible({ timeout: 150 }).catch(() => false)) return true;
    } catch {}
    const spinners = await page.locator(spinnerSel).all();
    let vis = 0;
    for (const s of spinners) {
      try {
        if (await s.isVisible()) vis++;
      } catch {}
    }
    if (vis === 0) {
      stable++;
      if (stable >= 2) return true;
    } else {
      stable = 0;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

// ─── 2. HÀM CHÍNH THỰC THI ──────────────────────────────────────────────────
async function main() {
  console.log('\n' + '#'.repeat(65));
  console.log('  KIỂM TRA & DEBUG ĐĂNG NHẬP CORECCP (VNCLEAR PLAYWRIGHT)');
  console.log('  Hỗ trợ chuẩn bị thẩm định tiểu khoản (-A) trên CoreCCP');
  console.log('#'.repeat(65));

  log('CHẾ ĐỘ', isHeaded ? 'CÓ GIAO DIỆN (--headed)' : 'HEADLESS (Chạy ngầm)');
  log('TIỂU KHOẢN MỤC TIÊU', targetSubAccount || '(Không chỉ định, chỉ test login & mở danh sách)');
  log('THƯ MỤC SCREENSHOT', screenshotDir);

  // BƯỚC 1: Lấy credentials
  step(1, 5, 'Lấy thông tin đăng nhập CoreCCP...');
  const creds = await getCredentials();
  log('NGUỒN', creds.source);
  log('URL', creds.url);
  log('USERNAME', creds.username);
  log('PASSWORD', creds.password ? '****** (Đã nạp)' : '(RỖNG)');

  if (!creds.username || !creds.password) {
    console.error('\n❌ [LỖI] Thiếu username hoặc password CoreCCP!');
    process.exit(1);
  }

  // BƯỚC 2: Khởi chạy trình duyệt
  step(2, 5, 'Khởi chạy Chromium Playwright...');
  const execPath = findBrowser();
  log('BROWSER EXECUTABLE', execPath || 'Mặc định Playwright Chromium');

  const browser = await chromium.launch({
    headless: !isHeaded,
    slowMo,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    ...(execPath ? { executablePath: execPath } : {}),
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  const baseUrl = new URL(creds.url).origin;
  const startLogin = Date.now();

  try {
    // BƯỚC 3: Truy cập trang đăng nhập & điền Form
    step(3, 5, `Truy cập ${creds.url} & điền thông tin...`);
    await page.goto(creds.url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1000);

    const shot1 = path.join(screenshotDir, '01_login_page.png');
    await page.screenshot({ path: shot1 });
    log('SCREENSHOT', `Đã chụp màn hình trang login: ${shot1}`);

    const userInput = page.locator("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']").first();
    const passInput = page.locator("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']").first();

    await userInput.waitFor({ state: 'visible', timeout: 15000 });
    await userInput.fill(creds.username);
    await passInput.waitFor({ state: 'visible', timeout: 10000 });
    await passInput.fill(creds.password);
    await page.waitForTimeout(500);

    const shot2 = path.join(screenshotDir, '02_login_filled.png');
    await page.screenshot({ path: shot2 });
    log('SCREENSHOT', `Đã chụp màn hình sau khi điền form: ${shot2}`);

    // BƯỚC 4: Click đăng nhập & Kiểm tra Fail-Fast
    step(4, 5, 'Bấm Đăng nhập & Xác thực phiên...');
    const submitBtn = page.locator("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary").first();
    await submitBtn.click();

    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const postLoginUrl = page.url();
    log('POST_LOGIN_URL', postLoginUrl);

    if (postLoginUrl.includes('/login')) {
      const errText = await page
        .locator(
          "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@role, 'alert') or contains(@class, 'MuiFormHelperText-root')] | //*[contains(text(), 'sai') or contains(text(), 'lỗi') or contains(text(), 'không đúng')]",
        )
        .first()
        .textContent()
        .catch(() => '');

      const failShot = path.join(screenshotDir, '03_login_failed.png');
      await page.screenshot({ path: failShot });
      throw new Error(`Đăng nhập thất bại, vẫn kẹt ở /login! Thông báo: ${errText ? errText.trim() : 'Sai user/password'}`);
    }

    const duration = ((Date.now() - startLogin) / 1000).toFixed(2);
    log('AUTH_SUCCESS', `✅ ĐĂNG NHẬP CORECCP THÀNH CÔNG trong ${duration}s! URL hiện tại: ${postLoginUrl}`);

    const shot3 = path.join(screenshotDir, '03_login_success.png');
    await page.screenshot({ path: shot3 });
    await dismissBackdrop(page);

    // BƯỚC 5: Điều hướng kiểm tra màn hình Danh sách TKGD (/ACCOUNTMNG/ACCOUNTS_INFO)
    step(5, 5, 'Kiểm tra mở màn hình Danh sách TKGD (/ACCOUNTMNG/ACCOUNTS_INFO)...');
    const accountsUrl = `${baseUrl}/ACCOUNTMNG/ACCOUNTS_INFO`;
    log('NAVIGATE', `Điều hướng đến: ${accountsUrl}`);

    await page.goto(accountsUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    await dismissBackdrop(page);
    await waitForTableReady(page, 20000);

    const shot4 = path.join(screenshotDir, '04_accounts_info_screen.png');
    await page.screenshot({ path: shot4 });
    log('SCREENSHOT', `Đã chụp màn hình Danh sách TKGD: ${shot4}`);

    // Nếu có chỉ định mã tiểu khoản (-A), thử tìm kiếm trên bảng
    if (targetSubAccount) {
      log('SEARCH_SUBACC', `Thử tìm kiếm tiểu khoản [${targetSubAccount}]...`);
      const searchBox = page
        .locator(
          "xpath=//input[contains(@placeholder, 'Tìm kiếm') or contains(@placeholder, 'Search') or @aria-label='Search' or contains(@placeholder, 'Mã TKGD')]",
        )
        .first();

      if (await searchBox.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchBox.fill(targetSubAccount);
        await searchBox.press('Enter');
        await page.waitForTimeout(1000);
        await waitForTableReady(page, 15000);
      }

      const rowMatch = page.locator(`xpath=//tbody//tr[contains(., '${targetSubAccount}')]`).first();
      const isFound = await rowMatch.isVisible({ timeout: 3000 }).catch(() => false);

      if (isFound) {
        const text = (await rowMatch.textContent().catch(() => '')) || '';
        log('SUBACC_FOUND', `✅ TÌM THẤY tiểu khoản ${targetSubAccount} trên CoreCCP! Dữ liệu: "${text.slice(0, 120)}..."`);
      } else {
        log('SUBACC_NOT_FOUND', `⚠️ Chưa tìm thấy tiểu khoản ${targetSubAccount} trong bảng dữ liệu CoreCCP.`);
      }

      const shot5 = path.join(screenshotDir, '05_subaccount_search_result.png');
      await page.screenshot({ path: shot5 });
    }

    console.log('\n' + '='.repeat(65));
    console.log('🎉 KIỂM TRA ĐĂNG NHẬP & KẾT NỐI CORECCP HOÀN TOÀN THÀNH CÔNG!');
    console.log(`- Tài khoản: ${creds.username}`);
    console.log(`- Màn hình TKGD: ${accountsUrl} (Đã sẵn sàng cào/thẩm định -A)`);
    console.log(`- Thư mục ảnh chụp: ${screenshotDir}`);
    console.log('='.repeat(65));

    if (isHeaded) {
      log('WAIT', 'Giữ trình duyệt mở thêm 5 giây để quan sát...');
      await page.waitForTimeout(5000);
    }
  } catch (err) {
    console.error(`\n❌ [LỖI THỰC THI]: ${err.message}`);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
