/**
 * Script kiểm tra độ an toàn của từng cờ tối ưu trên 1 phiên CQG thật
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const mongoose = require('mongoose');
const crypto = require('crypto');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

async function testSingleFlag() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  const doc = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  const creds = JSON.parse(decrypt(doc.value));
  await mongoose.disconnect();

  const username = creds.username1 || creds.usernameCQG1;
  const password = creds.password1 || creds.passwordCQG1;
  const cqgUrl = creds.urlTrade || creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  console.log('Testing with safe production args...');
  const tempProfile = path.join(os.tmpdir(), `test_cqg_flag_${Date.now()}`);

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = candidates.find((p) => fs.existsSync(p));

  // Kiểm tra cờ nghi vấn: --disable-background-networking và --renderer-process-limit
  const context = await chromium.launchPersistentContext(tempProfile, {
    headless: true,
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
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
      '--js-flags=--max-old-space-size=512',
    ],
    viewport: { width: 1280, height: 720 },
  });

  const page = context.pages()[0] || await context.newPage();
  console.log('Navigating to CQG...');
  await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });

  await page.fill('input[name="userName"], input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"], button:has-text("Log on")').catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});

  console.log('Waiting for Dashboard...');
  const start = Date.now();
  let inDash = false;
  while (Date.now() - start < 30000) {
    inDash = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      return text.includes('Ho') || text.includes('Orders') || text.includes('Fills') || text.includes('Pos');
    }).catch(() => false);
    if (inDash) break;
    await page.waitForTimeout(500);
  }

  console.log(`Result with prod args: In Dashboard = ${inDash} in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  await context.close();
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
}

testSingleFlag().catch(e => console.error(e.message));
