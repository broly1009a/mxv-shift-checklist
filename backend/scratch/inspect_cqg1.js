/**
 * Chụp ảnh màn hình CQG1 xem hiện trạng đang là gì
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

async function inspectCqg1() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  const doc = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  const creds = JSON.parse(decrypt(doc.value));
  await mongoose.disconnect();

  const username = creds.username1 || creds.usernameCQG1;
  const password = creds.password1 || creds.passwordCQG1;
  const cqgUrl = creds.urlTrade || creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const executablePath = candidates.find((p) => fs.existsSync(p));

  const tempProfile = path.join(os.tmpdir(), `test_cqg1_inspect_${Date.now()}`);
  const context = await chromium.launchPersistentContext(tempProfile, {
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-extensions'],
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 30000 });
  await page.waitForTimeout(2000);

  await page.fill('input[name="userName"], input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"], button:has-text("Log on")').catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});

  await page.waitForTimeout(6000);
  const shotPath = path.join(process.cwd(), 'scratch', 'cqg1_debug_screen.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved screenshot to:', shotPath);

  const text = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 500) : '');
  console.log('Page Text:', text.replace(/\n+/g, ' '));

  await context.close();
  try { fs.rmSync(tempProfile, { recursive: true, force: true }); } catch {}
}

inspectCqg1().catch(e => console.error(e.message));
