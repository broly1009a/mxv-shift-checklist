const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

// AES Decryption matching NestJS crypto util
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

async function runPlaywrightNkthtTest() {
  console.log('=== KÍCH HOẠT PLAYWRIGHT UI TEST (HEADLESS: FALSE) BÁO CÁO NKTTHT ===');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log('Đang kết nối database để lấy credentials...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  
  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  if (!setting) {
    console.error('❌ Không tìm thấy setting bot_credentials_msystem trong DB!');
    await mongoose.disconnect();
    return;
  }

  let credentials = {};
  try {
    credentials = JSON.parse(decrypt(setting.value));
  } catch (e) {
    console.error('❌ Lỗi giải mã credentials:', e.message);
    await mongoose.disconnect();
    return;
  }
  
  await mongoose.disconnect();

  const msUrl = credentials.url || 'https://msadmin.mxv.com.vn/';
  const username = credentials.username || 'mxvsupport';
  const password = credentials.password || '';
  const pin = credentials.pin || '123456';

  console.log(`- M-System URL: ${msUrl}`);
  console.log(`- Username: ${username}`);
  console.log(`- Password: ${password ? '******' : '(trống)'}`);

  const msEdgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const launchOptions = {
    headless: false,
    slowMo: 500,
    args: ['--start-maximized']
  };

  if (fs.existsSync(msEdgePath)) {
    console.log(`Phát hiện Edge tại: ${msEdgePath}`);
    launchOptions.executablePath = msEdgePath;
  } else {
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: null
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log(`\n1. Truy cập M-System...`);
    await page.goto(msUrl);
    
    console.log('Chờ tải trang M-System (Đăng nhập hoặc Trang chủ)...');
    const pageState = await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }).then(() => 'login'),
      page.waitForSelector('xpath=//*[self::a or self::span or self::li or self::div][contains(text(), "QL hệ thống")]', { timeout: 15000 }).then(() => 'dashboard')
    ]).catch(() => 'timeout');

    console.log('-> Trạng thái trang hiện tại:', pageState);

    if (pageState === 'login') {
      console.log('2. Nhập tài khoản và mật khẩu...');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      console.log('3. Chờ bảng PIN xuất hiện...');
      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
      console.log('Nhập mã PIN bàn phím số...');
      const pinDigits = pin.split('');
      for (const digit of pinDigits) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(500);
      }

      console.log('4. Chờ xác thực đăng nhập hoàn tất...');
      await page.waitForSelector('xpath=//*[self::a or self::span or self::li or self::div][contains(text(), "QL hệ thống")]', { state: 'visible', timeout: 20000 });
    }

    console.log('5. Chờ giao diện ổn định...');
    await page.waitForTimeout(3000);

    console.log(`\n6. Thao tác Click Sidebar Menu: QL hệ thống -> Thông tin chung -> Nhật ký thao tác hệ thống...`);
    const menuSteps = ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'];

    for (let i = 0; i < menuSteps.length; i++) {
      const menu = menuSteps[i];
      const selector = `xpath=//*[self::a or self::span or self::li or self::div][contains(text(), '${menu}')]`;
      console.log(`- Bấm Menu [${i + 1}/${menuSteps.length}]: "${menu}"`);
      await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
      await page.click(selector, { force: true });
      await page.waitForTimeout(2000);
    }

    console.log('\n7. Chờ màn hình Nhật ký thao tác hệ thống và tìm nút xuất Excel...');
    await page.waitForTimeout(2000);
    const csvBtn = page.locator('button:has(i.fa-file-excel), button:has(i.fa-file-csv), i.fa-file-excel, i.fa-file-csv, .fa-file-excel, .fa-file-csv, button:has(.fa-download), .fa-download, button[title*="Excel"], button[title*="Xuất"]').first();

    if (await csvBtn.isVisible().catch(() => false)) {
      console.log('8. Bấm nút Xuất Excel và chờ tải file...');
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await csvBtn.click();
      const download = await downloadPromise;
      const savePath = path.join(__dirname, '..', '..', 'temp_NKTTHT_test.xlsx');
      await download.saveAs(savePath);
      console.log(`\n✅ TẢI THÀNH CÔNG RỰC RỠ! File đã được lưu tại:\n   ${savePath}`);
      console.log(`Kích thước file: ${(fs.statSync(savePath).size / 1024).toFixed(2)} KB`);
    } else {
      console.log('Không tìm thấy nút xuất file trên giao diện!');
    }
  } catch (err) {
    console.error(`❌ LỖI PLAYWRIGHT TEST:`, err.message);
  } finally {
    console.log('\nGiữ trình duyệt 10 giây trước khi đóng...');
    await page.waitForTimeout(10000);
    await browser.close();
  }
}

runPlaywrightNkthtTest().catch(console.error);
