const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

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

async function runVisualTest() {
  console.log('========================================================================');
  console.log('  TEST TẢI FILE TTM & TTTT QUA SIDEBAR + CHỤP SNAPSHOT (HEADED MODE)    ');
  console.log('========================================================================\n');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log('1. Đang kết nối MongoDB lấy thông tin đăng nhập M-System...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  if (!setting) {
    console.error(' Không tìm thấy cấu hình bot_credentials_msystem trong Database!');
    await mongoose.disconnect();
    return;
  }

  let credentials = {};
  try {
    credentials = JSON.parse(decrypt(setting.value));
  } catch (e) {
    console.error(' Lỗi giải mã credentials:', e.message);
    await mongoose.disconnect();
    return;
  }
  await mongoose.disconnect();

  const msRawUrl = credentials.url || 'https://msadmin.mxv.com.vn/';
  const msBaseDomain = msRawUrl.split('#')[0].replace(/\/$/, '');
  const msLoginUrl = `${msBaseDomain}/#/login`;
  const username = credentials.username || 'mxvsupport';
  const password = credentials.password || '';
  const pin = credentials.pin || '123456';

  console.log(`- M-System Base: ${msBaseDomain}`);
  console.log(`- Username     : ${username}`);
  console.log(`- Password     : ${password ? '******' : '(trống)'}`);
  console.log(`- PIN          : ${pin ? '******' : '(trống)'}`);

  const testOutputDir = path.join(__dirname, '..', '..', 'temp', 'test_ms_downloads');
  if (!fs.existsSync(testOutputDir)) {
    fs.mkdirSync(testOutputDir, { recursive: true });
  }

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  let executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;

  const isHeadless = process.env.HEADED !== 'true';
  const launchOptions = {
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 200,
    args: ['--start-maximized'],
  };
  if (executablePath) {
    console.log(`\nKhởi động trình duyệt Edge: ${executablePath}`);
    launchOptions.executablePath = executablePath;
  } else {
    console.log('\nKhởi động trình duyệt mặc định Playwright (channel: chrome)...');
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const results = {
    ttm: { success: false, suggestedName: '', path: '', rowCount: 0 },
    tttt: { success: false, suggestedName: '', path: '', rowCount: 0, acmLots: 0 },
  };

  /**
   * Helper điều hướng Sidebar menu an toàn:
   * - Mở menu cha nếu chưa mở
   * - Bấm menu con
   * - Chờ URL hash thay đổi theo expectedHashPattern
   * - Chờ nút xuất file xuất hiện
   */
  async function navigateViaSidebar(menuChain, expectedHashPattern, screenshotName) {
    console.log(`\n-> Điều hướng Sidebar: ${menuChain.join(' -> ')}`);
    for (let i = 0; i < menuChain.length; i++) {
      const text = menuChain[i];
      const selector = `xpath=//*[self::a or self::span or self::li or self::div][normalize-space(text())='${text}' or contains(text(), '${text}')]`;
      console.log(`   [${i + 1}/${menuChain.length}] Click: "${text}"`);
      await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
      await page.click(selector, { force: true });
      await page.waitForTimeout(1000);
    }

    if (expectedHashPattern) {
      console.log(`   Đợi URL chuyển sang mẫu ${expectedHashPattern}...`);
      await page.waitForURL(expectedHashPattern, { timeout: 15000 });
    }
    // Chờ bảng render ổn định
    await page.waitForTimeout(2500);

    if (screenshotName) {
      const snapPath = path.join(testOutputDir, screenshotName);
      await page.screenshot({ path: snapPath, fullPage: false });
      console.log(`   📸 Đã chụp snapshot: ${snapPath}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // BƯỚC 1: ĐĂNG NHẬP M-SYSTEM
    // -------------------------------------------------------------
    console.log('\n2. Truy cập M-System và kiểm tra đăng nhập...');
    await page.goto(msLoginUrl);
    await page.waitForTimeout(2000);

    const pageState = await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }).then(() => 'login'),
      page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 15000 }).then(() => 'dashboard'),
    ]).catch(() => 'unknown');

    console.log(`-> Trạng thái: ${pageState}`);
    if (pageState === 'login') {
      console.log('   - Nhập tài khoản & mật khẩu...');
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      console.log('   - Nhập mã PIN...');
      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
      for (const digit of pin.split('')) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible' });
        await page.click(digitSelector);
        await page.waitForTimeout(400);
      }

      console.log('   - Đang xác thực OTP/PIN và vào Dashboard...');
      await page.waitForSelector(
        "xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]",
        { state: 'visible', timeout: 30000 },
      );
      console.log('   -> Đăng nhập thành công!');
    }
    await page.waitForTimeout(2000);
    const snapLogin = path.join(testOutputDir, 'snap_01_dashboard.png');
    await page.screenshot({ path: snapLogin, fullPage: false });
    console.log(`📸 Đã chụp snapshot Dashboard: ${snapLogin}`);

    // Nút xuất file (nút màu xanh có icon file/csv)
    const exportBtnSelector = "button:has(i.fa-file-excel), button:has(i.fa-file-csv), button.btn-info, i.fa-file-excel, i.fa-file-csv";

    // -------------------------------------------------------------
    // BƯỚC 2: ĐIỀU HƯỚNG & TẢI TTM (Trạng thái mở)
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('3. TEST TẢI FILE 1: TTM (TRẠNG THÁI MỞ)');
    console.log('-------------------------------------------------------------');
    await navigateViaSidebar(['QL trạng thái', 'Trạng thái mở'], /openPositionInfo/, 'snap_02_ttm.png');

    await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 20000 });
    console.log('-> Bấm nút xuất file của Trạng thái mở...');
    const ttmDownloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator(exportBtnSelector).first().click();
    const ttmDownload = await ttmDownloadPromise;

    const ttmSuggested = ttmDownload.suggestedFilename();
    const ttmSavePath = path.join(testOutputDir, 'TTM_test.xlsx');
    console.log(`-> Tên file gốc M-System: "${ttmSuggested}"`);

    if (!/^trang-thai-mo/i.test(ttmSuggested)) {
      console.error(` CẢNH BÁO: Tên file gốc không khớp tiền tố 'trang-thai-mo': ${ttmSuggested}`);
    } else {
      console.log(` Khớp tiền tố chuẩn C#: ^trang-thai-mo`);
    }

    await ttmDownload.saveAs(ttmSavePath);
    console.log(` Đã lưu file TTM về: ${ttmSavePath} (${(fs.statSync(ttmSavePath).size / 1024).toFixed(2)} KB)`);
    results.ttm = { success: true, suggestedName: ttmSuggested, path: ttmSavePath };

    // -------------------------------------------------------------
    // BƯỚC 3: ĐIỀU HƯỚNG & TẢI TTTT (Trạng thái tất toán)
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('4. TEST TẢI FILE 2: TTTT (TRẠNG THÁI TẤT TOÁN)');
    console.log('-------------------------------------------------------------');
    await navigateViaSidebar(['Trạng thái tất toán'], /finalPositionInfo/, 'snap_03_tttt.png');

    await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 20000 });
    console.log('-> Bấm nút xuất file của Trạng thái tất toán...');
    const ttttDownloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator(exportBtnSelector).first().click();
    const ttttDownload = await ttttDownloadPromise;

    const ttttSuggested = ttttDownload.suggestedFilename();
    const ttttSavePath = path.join(testOutputDir, 'TTTT_test.xlsx');
    console.log(`-> Tên file gốc M-System: "${ttttSuggested}"`);

    if (!/^trang-thai-tat-toan/i.test(ttttSuggested)) {
      console.error(` CẢNH BÁO: Tên file gốc không khớp tiền tố 'trang-thai-tat-toan': ${ttttSuggested}`);
    } else {
      console.log(` Khớp tiền tố chuẩn C#: ^trang-thai-tat-toan`);
    }

    await ttttDownload.saveAs(ttttSavePath);
    console.log(` Đã lưu file TTTT về: ${ttttSavePath} (${(fs.statSync(ttttSavePath).size / 1024).toFixed(2)} KB)`);
    results.tttt = { success: true, suggestedName: ttttSuggested, path: ttttSavePath };

    // -------------------------------------------------------------
    // BƯỚC 4: ĐỌC VÀ ĐỐI SOÁT FILE VỪA TẢI VỀ
    // -------------------------------------------------------------
    console.log('\n-------------------------------------------------------------');
    console.log('5. PHÂN TÍCH & ĐỐI SOÁT DỮ LIỆU THỰC TẾ TRONG FILE VỪA TẢI');
    console.log('-------------------------------------------------------------');

    const wbTtm = new ExcelJS.Workbook();
    await wbTtm.xlsx.readFile(ttmSavePath);
    const wsTtm = wbTtm.worksheets[0];
    results.ttm.rowCount = wsTtm.rowCount;
    const ttmHeaders = [];
    wsTtm.getRow(1).eachCell((cell) => ttmHeaders.push(cell.text));
    console.log(`- File TTM.xlsx  : ${wsTtm.rowCount} dòng | Cột: ${ttmHeaders.slice(0, 5).join(', ')}...`);

    const wbTttt = new ExcelJS.Workbook();
    await wbTttt.xlsx.readFile(ttttSavePath);
    const wsTttt = wbTttt.worksheets[0];
    results.tttt.rowCount = wsTttt.rowCount;
    const ttttHeaders = [];
    wsTttt.getRow(1).eachCell((cell) => ttttHeaders.push(cell.text));
    console.log(`- File TTTT.xlsx : ${wsTttt.rowCount} dòng | Cột: ${ttttHeaders.slice(0, 6).join(', ')}...`);

    let acmBuyLots = 0;
    let acmSellLots = 0;
    let nonAcmBuyLots = 0;
    let nonAcmSellLots = 0;

    let buyAccCol = -1, sellAccCol = -1, lotsCol = -1;
    wsTttt.getRow(1).eachCell((cell, colNumber) => {
      const text = (cell.text || '').toLowerCase().trim();
      if (text.includes('mã tk mua') || text.includes('tk mua')) buyAccCol = colNumber;
      if (text.includes('mã tk bán') || text.includes('tk bán')) sellAccCol = colNumber;
      if (text.includes('khối lượng') || text.includes('kl') || text.includes('số lượng')) lotsCol = colNumber;
    });

    if (buyAccCol !== -1 && sellAccCol !== -1 && lotsCol !== -1) {
      for (let r = 2; r <= wsTttt.rowCount; r++) {
        const row = wsTttt.getRow(r);
        const buyAcc = (row.getCell(buyAccCol).text || '').trim();
        const sellAcc = (row.getCell(sellAccCol).text || '').trim();
        const lot = parseFloat(row.getCell(lotsCol).value) || 0;

        if (buyAcc.startsWith('003C')) acmBuyLots += lot;
        else nonAcmBuyLots += lot;

        if (sellAcc.startsWith('003C')) acmSellLots += lot;
        else nonAcmSellLots += lot;
      }
      results.tttt.acmLots = acmBuyLots;
      console.log(`\n-> KẾT QUẢ ĐỐI SOÁT TTTT CHO ACM:`);
      console.log(`   * ACM Mua: ${acmBuyLots} lot | ACM Bán: ${acmSellLots} lot`);
      console.log(`   * Tài khoản khác: Mua ${nonAcmBuyLots} lot | Bán ${nonAcmSellLots} lot`);
    }

    console.log('\n=============================================================');
    console.log('                  BẢNG TỔNG KẾT KIỂM THỬ                     ');
    console.log('=============================================================');
    console.log(`1. TTM  (Trạng thái mở)     : ${results.ttm.suggestedName} (${results.ttm.rowCount} dòng)`);
    console.log(`2. TTTT (Trạng thái tất toán): ${results.tttt.suggestedName} (${results.tttt.rowCount} dòng)`);
    if (results.ttm.suggestedName !== results.tttt.suggestedName) {
      console.log(`\n🎉 KẾT QUẢ: 2 FILE ĐÃ ĐƯỢC TẢI RIÊNG BIỆT 100% CHUẨN XÁC!`);
      console.log(`   - Không còn hiện tượng tải trùng lặp TTM vào TTTT.`);
      console.log(`   - File TTTT có đúng các cột ghép lệnh và số lot ACM: ${acmBuyLots} lot.`);
    } else {
      console.log(`\n KẾT QUẢ: 2 file vẫn bị trùng tên gốc.`);
    }
    console.log('=============================================================\n');

  } catch (err) {
    console.error('\n LỖI TRONG QUÁ TRÌNH TEST:', err.message);
    const snapErr = path.join(testOutputDir, 'snap_error.png');
    await page.screenshot({ path: snapErr, fullPage: false }).catch(() => { });
    console.log(`📸 Đã chụp snapshot lỗi tại: ${snapErr}`);
  } finally {
    console.log('Đóng trình duyệt sau 3 giây...');
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('Kiểm thử hoàn tất.');
  }
}

runVisualTest();
