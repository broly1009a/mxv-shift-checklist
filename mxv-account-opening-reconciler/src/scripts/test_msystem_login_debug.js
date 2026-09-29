/**
 * test_msystem_login_debug.js
 * Tool kiem tra va debug qua trinh dang nhap M-System (Playwright)
 * Chuan hoa theo pattern tu rpa-downloader.service.ts da kiem chung trong production.
 *
 * Cach chay (USER tu chay tren Terminal):
 *   node src/scripts/test_msystem_login_debug.js
 *   node src/scripts/test_msystem_login_debug.js --headless
 *   node src/scripts/test_msystem_login_debug.js --email hieptruong@mxv.vn
 *   node src/scripts/test_msystem_login_debug.js --slow 500
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { chromium } = require('playwright-core');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Doc tham so CLI
const args = process.argv.slice(2);
const headless = args.includes('--headless');
const emailIdx = args.indexOf('--email');
const targetEmail = emailIdx !== -1 ? args[emailIdx + 1] : 'hieptruong@mxv.vn';
const slowIdx = args.indexOf('--slow');
const slowMo = slowIdx !== -1 ? parseInt(args[slowIdx + 1], 10) || 0 : 300;

function getSecretKey() {
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  return crypto.createHash('sha256').update(rawKey).digest();
}

function decrypt(enc) {
  if (!enc) return '';
  const parts = enc.split(':');
  if (parts.length !== 2) throw new Error('Format ma hoa khong hop le');
  const iv = Buffer.from(parts[0], 'hex');
  const data = Buffer.from(parts[1], 'hex');
  const d = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}

function findBrowser() {
  const cands = process.platform === 'linux'
    ? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    : [
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
  return cands.find(c => fs.existsSync(c));
}

function log(label, msg) {
  const ts = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${ts}] [${label}] ${msg}`);
}

function step(n, total, title) {
  console.log('\n' + '='.repeat(60));
  console.log(`  BUOC ${n}/${total}: ${title}`);
  console.log('='.repeat(60));
}

async function main() {
  console.log('\n' + '#'.repeat(60));
  console.log('  TEST DANG NHAP M-SYSTEM (DEBUG PLAYWRIGHT)');
  console.log('  Pattern: checklist rpa-downloader.service.ts (Production)');
  console.log('#'.repeat(60));
  log('MODE', headless ? 'HEADLESS (Chay ngam khong cua so)' : 'HEADED (Hien thi trinh duyet)');
  log('EMAIL TARGET', targetEmail);
  log('SLOWMO', `${slowMo} ms/thao tac`);

  // BUOC 1: Ket noi MongoDB
  step(1, 6, 'Ket noi MongoDB lay thong tin dang nhap...');
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/mxv_shift_checklist';
  log('MONGO_URI', mongoUri);
  await mongoose.connect(mongoUri);
  log('DB', 'Ket noi MongoDB thanh cong!');

  // BUOC 2: Doc va giai ma credentials tu collection tkgd_user_configs
  step(2, 6, 'Doc thong tin tai khoan M-System...');
  const cfg = await mongoose.connection.collection('tkgd_user_configs').findOne(
    { userEmail: targetEmail },
    { projection: { 'msystem.username': 1, 'msystem.passwordEncrypted': 1, 'msystem.pinEncrypted': 1 } }
  );

  if (!cfg || !cfg.msystem) {
    console.error(`\n[LOI] Khong tim thay ban ghi tkgd_user_configs cho email: ${targetEmail}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const username = cfg.msystem.username || '';
  const passwordEnc = cfg.msystem.passwordEncrypted || '';
  const pinEnc = cfg.msystem.pinEncrypted || '';

  log('USERNAME', username || '(TRONG)');
  log('PASSWORD_ENC', passwordEnc ? `Co du lieu (${passwordEnc.slice(0, 16)}...)` : 'TRONG');
  log('PIN_ENC', pinEnc ? `Co du lieu (${pinEnc.slice(0, 16)}...)` : 'TRONG');

  if (!username || !passwordEnc) {
    console.error('\n[LOI] Thieu username hoac password trong CSDL!');
    await mongoose.disconnect();
    process.exit(1);
  }

  let password = '';
  let pin = '';
  try {
    password = decrypt(passwordEnc);
    log('PASSWORD_STATUS', `Giai ma thanh cong (${password.length} ky tu)`);
  } catch (e) {
    console.error(`\n[LOI] Giai ma password that bai: ${e.message}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (pinEnc) {
    try {
      pin = decrypt(pinEnc);
      log('PIN_STATUS', `Giai ma thanh cong (${pin.length} ky tu)`);
    } catch (e) {
      log('WARN', `Giai ma PIN that bai: ${e.message}`);
    }
  } else {
    log('WARN', 'Khong co ma PIN ma hoa trong DB!');
  }

  await mongoose.disconnect();
  log('DB', 'Da ngat ket noi MongoDB.');

  // BUOC 3: Khoi chay Playwright
  step(3, 6, 'Khoi tao trinh duyet Playwright...');
  const executablePath = findBrowser();
  log('BROWSER_BIN', executablePath || '(Mac dinh cua Playwright)');

  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless,
    slowMo,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1366,768',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  const screenshotDir = path.resolve(__dirname, '../../test_screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  try {
    // BUOC 4: Truy cap M-System va dien form dang nhap (Chuan 100% test_ms_headless_download.js)
    step(4, 6, 'Truy cap trang dang nhap va nhap thong tin...');
    const loginUrl = 'https://msadmin.mxv.com.vn/#/login';
    log('NAVIGATE', `Dang vao ${loginUrl} ...`);
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1000);
    log('CURRENT_URL', page.url());

    // Doi form input username hien thi
    log('WAIT', 'Cho input username on dinh...');
    await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", { state: 'visible', timeout: 15000 });

    log('ACTION', `Dien username: "${username}"`);
    await page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", username);

    log('ACTION', 'Dien password...');
    await page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", password);

    await page.waitForTimeout(500);
    const shot1 = path.join(screenshotDir, '01_login_filled.png');
    await page.screenshot({ path: shot1 });
    log('SCREENSHOT', shot1);

    // BUOC 5: Submit va xu ly PIN (Chuan 100% test_ms_headless_download.js)
    step(5, 6, 'Submit va nhap PIN...');
    log('ACTION', 'Bam nut Dang nhap...');
    await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await page.waitForTimeout(2000);

    const shot2 = path.join(screenshotDir, '02_after_submit.png');
    await page.screenshot({ path: shot2 });
    log('SCREENSHOT', shot2);

    const pinPad = page.locator('div.pincode');
    const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPinPad && pin) {
      log('PIN_INPUT', `Phat hien ban phim PIN ao -> Dang nhap ma PIN (${pin.length} so)...`);
      for (const digit of String(pin).split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        log('PIN_DIGIT', `Click thanh cong so: [ ${digit} ]`);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(2000);
      log('PIN_INPUT', 'Da nhap xong toan bo ma PIN!');
    } else if (hasPinPad && !pin) {
      log('WARN', 'Co ban phim PIN nhung khong co ma PIN trong DB!');
    } else {
      log('INFO', 'Khong yeu cau nhap PIN hoac da bo qua buoc PIN.');
    }

    const shot3 = path.join(screenshotDir, '03_after_pin.png');
    await page.screenshot({ path: shot3 });
    log('SCREENSHOT', shot3);

    // BUOC 6: Kiem tra ket qua dieu huong
    step(6, 6, 'Kiem tra ket qua dieu huong...');
    await page.waitForURL(/.*dashboard.*/, { timeout: 15000 }).catch(() => {});
    const finalUrl = page.url();
    log('FINAL_URL', finalUrl);

    const shot4 = path.join(screenshotDir, '04_final_result.png');
    await page.screenshot({ path: shot4 });
    log('SCREENSHOT', shot4);

    if (finalUrl.includes('/login')) {
      const errText = await page
        .locator('text=/sai|lỗi|invalid|error/i')
        .first()
        .textContent()
        .catch(() => '');
      console.log('\n' + '!'.repeat(60));
      console.log('  [KET QUA]: THAT BAI - URL van o trang /login');
      if (errText) console.log(`  Thong bao loi tren man hinh: ${errText.trim()}`);
      console.log('!'.repeat(60) + '\n');
    } else {
      console.log('\n' + '*'.repeat(60));
      console.log('  [KET QUA]: DANG NHAP THANH CONG!');
      console.log(`  Trang hien tai: ${finalUrl}`);
      console.log('*'.repeat(60) + '\n');
    }

    if (!headless) {
      log('INFO', 'Trinh duyet se giu nguyen 20 giay de ban quan sat (hoac bam Ctrl+C de dong)...');
      await new Promise(r => setTimeout(r, 20000));
    }
  } catch (err) {
    console.error(`\n[FATAL ERROR] ${err.message}`);
    const errShot = path.join(screenshotDir, 'debug_error.png');
    await page.screenshot({ path: errShot }).catch(() => {});
    log('SCREENSHOT_ERROR', errShot);
  } finally {
    await browser.close();
    log('CLEANUP', 'Da dong trinh duyet an toan.');
  }

  console.log(`\nToan bo anh chup debug duoc luu tai: ${screenshotDir}\n`);
}

main().catch(err => {
  console.error('Loi khoi chay script:', err.message);
  process.exit(1);
});
