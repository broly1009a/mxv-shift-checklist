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

async function runTabVisualTest() {
  console.log('========================================================================');
  console.log('  TEST CHUYỂN SUB-TAB & TẢI FILE M-SYSTEM VỚI SNAPSHOT (HEADED MODE)    ');
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
    slowMo: isHeadless ? 0 : 150,
    args: ['--start-maximized'],
  };
  if (executablePath) {
    console.log(`\nKhởi động trình duyệt Edge: ${executablePath}`);
    launchOptions.executablePath = executablePath;
  } else {
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const exportBtnSelector = "button:has(i.fa-file-excel), button:has(i.fa-file-csv), button.btn-info, i.fa-file-excel, i.fa-file-csv";

  async function navigateSidebar(menuChain, expectedHashPattern) {
    console.log(`\n-> Điều hướng Sidebar: ${menuChain.join(' -> ')}`);
    for (let i = 0; i < menuChain.length; i++) {
      const text = menuChain[i];
      const selector = `xpath=//*[self::a or self::span or self::li or self::div][normalize-space(text())='${text}' or contains(text(), '${text}')]`;
      await page.waitForSelector(selector, { state: 'visible', timeout: 15000 });
      await page.click(selector, { force: true });
      await page.waitForTimeout(1000);
    }
    if (expectedHashPattern) {
      await page.waitForURL(expectedHashPattern, { timeout: 15000 }).catch(() => { });
    }
    await page.waitForTimeout(2000);
  }

  async function clickSubTab(tabName, snapshotName) {
    console.log(`\n-> [SubTab] Chuyển sang tab: "${tabName}"...`);
    const tabSelector = `xpath=//*[self::a or self::button or self::li or self::div or self::span][normalize-space(text())='${tabName}' or contains(text(), '${tabName}')]`;
    await page.waitForSelector(tabSelector, { state: 'visible', timeout: 15000 });

    // Kiểm tra active
    const isActive = await page.locator(tabSelector).first().evaluate((el) => {
      const parent = el.closest('li') || el.closest('div.nav-item') || el;
      return parent.classList.contains('active') || el.classList.contains('active') || el.getAttribute('aria-selected') === 'true';
    }).catch(() => false);

    if (isActive) {
      console.log(`   Tab "${tabName}" đã active sẵn.`);
    } else {
      await page.locator(tabSelector).first().click({ force: true });
      console.log(`   Đã click chuyển sang tab "${tabName}".`);
    }

    await page.waitForTimeout(2000);
    await page.waitForSelector('.ladda-loading, div.spinner, div.loading', { state: 'detached', timeout: 5000 }).catch(() => { });

    if (snapshotName) {
      const snapPath = path.join(testOutputDir, snapshotName);
      await page.screenshot({ path: snapPath, fullPage: false });
      console.log(`   📸 Đã chụp snapshot: ${snapPath}`);
    }
  }

  async function downloadCurrentTab(fileName, expectedPattern) {
    console.log(`   Đợi nút xuất file...`);
    await page.waitForSelector(exportBtnSelector, { state: 'visible', timeout: 20000 });
    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
    await page.locator(exportBtnSelector).first().click({ force: true });
    const download = await downloadPromise;

    const suggested = download.suggestedFilename();
    const savePath = path.join(testOutputDir, fileName);
    console.log(`   Tên file gốc từ M-System: "${suggested}"`);

    if (expectedPattern && !expectedPattern.test(suggested)) {
      console.error(`    CẢNH BÁO: Tên file gốc không khớp mẫu: ${suggested}`);
    } else {
      console.log(`   ✅ Tên file khớp chuẩn regex.`);
    }

    await download.saveAs(savePath);
    const sizeKb = (fs.statSync(savePath).size / 1024).toFixed(2);
    console.log(`   ✅ Đã lưu file về: ${savePath} (${sizeKb} KB)`);
    return { suggested, savePath, sizeKb };
  }

  try {
    // BƯỚC 1: ĐĂNG NHẬP
    console.log('\n2. Truy cập M-System và đăng nhập...');
    await page.goto(msLoginUrl);
    await page.waitForTimeout(2000);

    const pageState = await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }).then(() => 'login'),
      page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 15000 }).then(() => 'dashboard'),
    ]).catch(() => 'unknown');

    if (pageState === 'login') {
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
      for (const digit of pin.split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(400);
      }
      await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 30000 });
      console.log('   -> Đăng nhập thành công!');
    }

    // BƯỚC 2: KIỂM THỬ CHUYỂN TAB TRÊN TRANG TRẠNG THÁI TẤT TOÁN (TTTT -> TTCDH)
    console.log('\n=============================================================');
    console.log('3. TEST TAB TRÊN MÀN HÌNH "TRẠNG THÁI TẤT TOÁN"');
    console.log('=============================================================');

    // Điều hướng vào QL trạng thái -> Trạng thái tất toán
    await navigateSidebar(['QL trạng thái', 'Trạng thái tất toán'], /finalPositionInfo/);

    // Tab 1: Trạng thái tất toán mặc định
    console.log('\n--- Tab 1: "Trạng thái tất toán" ---');
    await clickSubTab('Trạng thái tất toán', 'snap_tab_01_tttt.png');
    const ttttRes = await downloadCurrentTab('TTTT_tab_test.xlsx', /^trang-thai-tat-toan.*\.xlsx$/i);

    // Tab 2: Chuyển sang "Trạng thái tất toán chờ đáo hạn LME" (TTCDH)
    console.log('\n--- Tab 2: "Trạng thái tất toán chờ đáo hạn LME" ---');
    await clickSubTab('Trạng thái tất toán chờ đáo hạn LME', 'snap_tab_02_ttcdh.png');
    const ttcdhRes = await downloadCurrentTab('TTCDH_tab_test.xlsx', /^trang-thai-tat-toan.*\.xlsx$/i);

    // BƯỚC 3: KIỂM THỬ CHUYỂN TAB TRÊN TRANG "DANH SÁCH TKGD" (FUTURES -> ACM)
    console.log('\n=============================================================');
    console.log('4. TEST TAB TRÊN MÀN HÌNH "DANH SÁCH TKGD"');
    console.log('=============================================================');
    await navigateSidebar(['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], /investorManagement/);

    console.log('\n--- Tab mặc định: "Futures" ---');
    await clickSubTab('Futures', 'snap_tab_03_dstkgd_futures.png');

    console.log('\n--- Chuyển sang Tab: "ACM" ---');
    await clickSubTab('ACM', 'snap_tab_04_dstkgd_acm.png');
    const acmRes = await downloadCurrentTab('DSTKGD_ACM_tab_test.xlsx', /^danh_sach_TKGD.*\.xlsx$/i);

    // BƯỚC 4: ĐỌC DỮ LIỆU CÁC FILE ĐÃ TẢI
    console.log('\n=============================================================');
    console.log('5. BÁO CÁO KẾT QUẢ ĐỐI SOÁT & KIỂM TRA DỮ LIỆU CÁC FILE TẢI VỀ');
    console.log('=============================================================');

    const wbTttt = new ExcelJS.Workbook();
    await wbTttt.xlsx.readFile(ttttRes.savePath);
    const wsTttt = wbTttt.worksheets[0];

    const wbTtcdh = new ExcelJS.Workbook();
    await wbTtcdh.xlsx.readFile(ttcdhRes.savePath);
    const wsTtcdh = wbTtcdh.worksheets[0];

    const wbAcm = new ExcelJS.Workbook();
    await wbAcm.xlsx.readFile(acmRes.savePath);
    const wsAcm = wbAcm.worksheets[0];

    console.log(`1. File TTTT (Tab Tất toán)         : ${wsTttt.rowCount} dòng | Size: ${ttttRes.sizeKb} KB | Tên gốc: ${ttttRes.suggested}`);
    console.log(`2. File TTCDH (Tab Chờ đáo hạn LME) : ${wsTtcdh.rowCount} dòng | Size: ${ttcdhRes.sizeKb} KB | Tên gốc: ${ttcdhRes.suggested}`);
    console.log(`3. File DSTKGD-ACM (Tab ACM)        : ${wsAcm.rowCount} dòng | Size: ${acmRes.sizeKb} KB | Tên gốc: ${acmRes.suggested}`);

    console.log('\n🎉 THỬ NGHIỆM THÀNH CÔNG: Helper chuyển tab và tải file hoạt động hoàn hảo 100%!');

  } catch (err) {
    console.error('\n LỖI TRONG QUÁ TRÌNH KIỂM THỬ:', err.message);
    const snapErr = path.join(testOutputDir, 'snap_tab_error.png');
    await page.screenshot({ path: snapErr, fullPage: false }).catch(() => { });
    console.log(`📸 Đã chụp snapshot lỗi tại: ${snapErr}`);
  } finally {
    console.log('\nĐóng trình duyệt sau 3 giây...');
    await page.waitForTimeout(3000);
    await browser.close();
    console.log('Kiểm thử hoàn tất.');
  }
}

runTabVisualTest();
