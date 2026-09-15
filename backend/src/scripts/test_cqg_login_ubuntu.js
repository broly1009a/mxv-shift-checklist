const { chromium } = require('playwright-core');
const { MongoClient } = require('mongodb');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Script kiểm tra trực tiếp khả năng tải và đăng nhập CQG trên Ubuntu Server
 * Chạy lệnh: node src/scripts/test_cqg_login_ubuntu.js
 */

const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
const getSecretKey = () => crypto.createHash('sha256').update(rawKey).digest();

function decrypt(text) {
  if (!text) return '';
  const textParts = text.split(':');
  if (textParts.length < 2) return text;
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function getChromeExecutablePath() {
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function runTest() {
  console.log('================================================================');
  console.log('  KIỂM TRA KẾT NỐI & TẢI TRANG ĐĂNG NHẬP CQG TRÊN UBUNTU SERVER  ');
  console.log('================================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  let creds = null;

  try {
    console.log(`[1/5] Đang kết nối MongoDB để đọc cấu hình bot_credentials_cqg...`);
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db();
    const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
    await client.close();

    if (setting && setting.value) {
      try {
        creds = JSON.parse(decrypt(setting.value));
        console.log(`✅ Đã đọc cấu hình CQG từ CSDL thành công.`);
      } catch (e) {
        console.warn(` Không thể giải mã credentials: ${e.message}`);
      }
    }
  } catch (err) {
    console.warn(` Lỗi kết nối CSDL (${err.message}). Tiếp tục với cấu hình mặc định...`);
  }

  const cqgUrl = (creds && creds.url) ? creds.url : 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced';
  const username = (creds && (creds.username1 || creds.usernameCQG1)) ? (creds.username1 || creds.usernameCQG1) : 'MXV_DEMO';

  console.log(`\n[2/5] Thông tin cấu hình:`);
  console.log(`   - URL: ${cqgUrl}`);
  console.log(`   - User: ${username}`);
  console.log(`   - Chrome Path: ${getChromeExecutablePath() || 'Mặc định Playwright Chromium'}`);

  console.log(`\n[3/5] Đang khởi động trình duyệt Chromium Headless với cờ tối ưu Linux...`);
  const launchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
    ],
  };
  const execPath = getChromeExecutablePath();
  if (execPath) launchOptions.executablePath = execPath;

  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    console.log(`\n[4/5] Đang điều hướng tới: ${cqgUrl} (chế độ domcontentloaded)...`);
    const startNav = Date.now();
    await page.goto(cqgUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    const elapsedNav = ((Date.now() - startNav) / 1000).toFixed(2);
    console.log(`✅ Tải trang HTML thành công trong ${elapsedNav} giây!`);

    console.log(`\n[5/5] Đang kiểm tra form đăng nhập (input[name="userName"])...`);
    const inputUser = await page.waitForSelector('input[name="userName"]', {
      state: 'visible',
      timeout: 25000,
    });

    if (inputUser) {
      console.log(`✅ Tìm thấy ô nhập tài khoản (userName) hiển thị sẵn sàng trên giao diện!`);
    }

    const debugDir = path.join(process.cwd(), 'temp', 'debug');
    if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
    const snapPath = path.join(debugDir, 'cqg_test_snapshot.png');
    await page.screenshot({ path: snapPath, fullPage: true });
    console.log(`📸 Đã chụp ảnh snapshot màn hình thành công tại: ${snapPath}`);

    console.log('\n================================================================');
    console.log('🎉 KẾT QUẢ: KẾT NỐI & TẢI TRANG CQG TRÊN UBUNTU HOÀN TOÀN TỐT!');
    console.log('================================================================');
  } catch (err) {
    console.error(`\n LỖI TRONG QUÁ TRÌNH KIỂM THỬ: ${err.message}`);
  } finally {
    await browser.close().catch(() => { });
    process.exit(0);
  }
}

runTest();
