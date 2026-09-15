const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function downloadFresh() {
  console.log('--- ĐANG TẢI LẠI FILE TTTT MỚI NHẤT VÀO THƯ MỤC BACKUP MS 10.09 ---');
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist');
  const setting = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  const creds = JSON.parse(decrypt(setting.value));
  await mongoose.disconnect();

  const targetPath = 'C:/Users/hiepth/Downloads/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures/2026/T09.2026/10.09/TTTT.xlsx';
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

  const browser = await chromium.launch({
    headless: true,
    executablePath: fs.existsSync(edgePath) ? edgePath : undefined,
  });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  console.log('1. Đăng nhập M-System...');
  await page.goto(creds.url || 'https://msadmin.mxv.com.vn/#/login');
  await page.waitForTimeout(2000);

  await page.fill('input[name="username"]', creds.username);
  await page.fill('input[name="password"]', creds.password);
  await page.click('button.btn-primary');

  await page.waitForSelector('div.pincode', { timeout: 15000 });
  for (const digit of (creds.pin || '123456').split('')) {
    await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
    await page.waitForTimeout(300);
  }
  await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 30000 });
  console.log('-> Đăng nhập thành công.');

  console.log('2. Điều hướng: QL trạng thái -> Trạng thái tất toán...');
  await page.click("xpath=//*[self::a or self::span][normalize-space(text())='QL trạng thái']", { force: true });
  await page.waitForTimeout(1000);
  await page.click("xpath=//*[self::a or self::span][normalize-space(text())='Trạng thái tất toán']", { force: true });
  await page.waitForURL(/finalPositionInfo/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const exportBtnSelector = "button:has(i.fa-file-excel), button:has(i.fa-file-csv), button.btn-info, i.fa-file-excel, i.fa-file-csv";
  await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 20000 });

  console.log('3. Tải file TTTT...');
  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await page.locator(exportBtnSelector).first().click({ force: true });
  const download = await downloadPromise;

  const suggested = download.suggestedFilename();
  console.log('-> File trả về từ M-System:', suggested);
  if (!/^trang-thai-tat-toan/i.test(suggested)) {
    throw new Error('Sai lệch file tải về: ' + suggested);
  }

  await download.saveAs(targetPath);
  const sizeKb = (fs.statSync(targetPath).size / 1024).toFixed(2);
  console.log(` ĐÃ LƯU THÀNH CÔNG TTTT.xlsx MỚI NHẤT VÀO: ${targetPath} (${sizeKb} KB)`);

  await browser.close();
  console.log('--- HOÀN TẤT ---');
}

downloadFresh().catch(e => { console.error('LỖI:', e.message); process.exit(1); });
