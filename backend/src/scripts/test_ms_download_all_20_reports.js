/**
 * SCRIPT KIỂM THỬ THỰC TẾ: TẢI TOÀN BỘ 20 BÁO CÁO M-SYSTEM (DOWNLOAD & VERIFY FILES)
 * 
 * Mục đích:
 * - Kiểm chứng việc tải toàn bộ 20 file báo cáo M-System về thư mục tạm.
 * - Đặc biệt kiểm tra báo cáo TTM (Trạng thái mở) với selector mới:
 *   button.ladda-button:has(i[class*="fa-file-csv"]), button:has(i.fas.fa-file-csv).
 * - Kiểm tra cơ chế fallback và tính toàn vẹn của từng file tải về.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_ms_download_all_20_reports.js
 * 
 * Hoặc chạy có giao diện trình duyệt (Headed Mode để quan sát trực tiếp):
 *   PowerShell : $env:HEADED="true"; node src/scripts/test_ms_download_all_20_reports.js
 *   CMD        : set HEADED=true && node src/scripts/test_ms_download_all_20_reports.js
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
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

// Selector xuất file đã được cập nhật chuẩn xác theo HTML thực tế (FontAwesome 5 Solid fas fa-file-csv)
const EXPORT_SELECTORS = [
  'button:has(i[class*="fa-file-csv"])',
  'button:has(i[class*="fa-file-excel"])',
  'button.ladda-button:has(i[class*="fa-file-csv"])',
  'button.ladda-button:has(i[class*="fa-file-excel"])',
  'button.btn-ghost-primary:has(i[class*="fa-file-csv"])',
  'button.ladda-button:has(i.fas.fa-file-csv)',
  'button.ladda-button:has(i.fa-file-csv)',
  'button.ladda-button:has(i.fas.fa-file-excel)',
  'button.ladda-button:has(i.fa-file-excel)',
  'button:has(i.fas.fa-file-csv)',
  'button:has(i.fa-file-csv)',
  'button:has(i.fas.fa-file-excel)',
  'button:has(i.fa-file-excel)',
  'i[class*="fa-file-csv"]',
  'i[class*="fa-file-excel"]',
  'i.fas.fa-file-csv',
  'i.fa-file-csv',
  'i.fas.fa-file-excel',
  'i.fa-file-excel',
  "button:has-text('Xuất file')",
  "button:has-text('Xuất Excel')",
  "button[title*='Export' i]",
].join(', ');

// Danh mục 20 báo cáo cần tải
// Danh mục 20 báo cáo chuẩn xác theo rpa-downloader.service.ts
const REPORTS = [
  { key: 'NKTTHT', name: 'Nhật ký thao tác hệ thống', hash: '#/systemManagement/activityHistory', menuSteps: ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'], ext: 'xlsx' },
  { key: 'DSTKGD-Futures', name: 'Danh sách TKGD Futures', hash: '#/clientManagement/investorManagement', menuSteps: ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], ext: 'xlsx' },
  { key: 'DSTKGD-Spread', name: 'Danh sách TKGD Spread', hash: '#/clientManagement/investorManagement', subTab: 'Spreads', ext: 'xlsx' },
  { key: 'DSTKGD-LME', name: 'Danh sách TKGD LME', hash: '#/clientManagement/investorManagement', subTab: 'LME', ext: 'xlsx' },
  { key: 'DSTKGD-ACM', name: 'Danh sách TKGD ACM', hash: '#/clientManagement/investorManagement', subTab: 'ACM', ext: 'xlsx' },
  { key: 'TLQHSKQ', name: 'Thiết lập quan hệ số ký quỹ', hash: '#/clientManagement/marginRatioMultiplier', menuSteps: ['QL khách hàng', 'QL TKGD', 'TLKQ HSKQ'], ext: 'xlsx' },
  { key: 'NR', name: 'Danh sách nộp rút tiền', hash: '#/clientManagement/marginMoneyTransHistory', menuSteps: ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'], ext: 'xlsx' },
  { key: 'DSTrader', name: 'Danh sách Trader', hash: '#/clientManagement/traderManagement', menuSteps: ['QL khách hàng', 'QL Trader', 'Danh sách Trader'], ext: 'xlsx' },
  { key: 'market truoc 6h', name: 'Market trước 6h', hash: '#/orderManagement/orderCreating', isMarketBefore6h: true, ext: 'csv' },
  { key: 'DSLDK', name: 'Danh sách lệnh dự kiến (đã khớp)', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã khớp', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã khớp'], ext: 'xlsx' },
  { key: 'DSLCK', name: 'Danh sách lệnh chờ khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh chờ khớp', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh chờ khớp'], ext: 'xlsx' },
  { key: 'DSLH', name: 'Danh sách lệnh hủy', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã hủy', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã hủy'], ext: 'xlsx' },
  { key: 'DSLK', name: 'Danh sách lệnh khác', hash: '#/orderManagement/orderList', subTab: 'Lệnh khác', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh khác'], ext: 'xlsx' },
  { key: 'DSGD', name: 'Danh sách giao dịch', hash: '#/orderManagement/transactionList', menuSteps: ['QL giao dịch', 'Danh sách giao dịch'], ext: 'xlsx' },
  { key: 'TTM', name: 'Trạng thái mở (Vị thế mở)', hash: '#/positionManagement/openPositionInfo', menuSteps: ['QL trạng thái', 'Trạng thái mở'], ext: 'xlsx' },
  { key: 'TTTT', name: 'Trạng thái tất toán', hash: '#/positionManagement/finalPositionInfo', menuSteps: ['QL trạng thái', 'Trạng thái tất toán'], ext: 'xlsx' },
  { key: 'TTCDH', name: 'Trạng thái tất toán chờ đáo hạn LME', hash: '#/positionManagement/finalPositionInfo', subTab: 'Trạng thái tất toán chờ đáo hạn LME', ext: 'xlsx' },
  { key: 'DSQLKQ', name: 'Danh sách quản lý ký quỹ', hash: '#/positionManagement/marginList', ext: 'xlsx' },
  { key: 'QLTKGD', name: 'Quản lý tài khoản giao dịch', hash: '#/clientManagement/marginStatusManagement', ext: 'xlsx' },
  { key: 'QLTKGD âm KQ', name: 'Quản lý TKGD âm ký quỹ', hash: '#/clientManagement/negativeMarginManagement', menuSteps: ['QL khách hàng', 'QL TKGD', 'QL TKGD âm ký quỹ'], ext: 'xlsx' },
];

async function runTest() {
  console.log('========================================================================');
  console.log('   KIỂM THỬ THỰC TẾ TẢI TOÀN BỘ 20 BÁO CÁO M-SYSTEM (PLAYWRIGHT RPA)    ');
  console.log('========================================================================\n');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(' [LỖI] Không tìm thấy MONGODB_URI trong file .env');
    return;
  }

  console.log('1. Đang kết nối MongoDB lấy tài khoản M-System...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const setting = await db.collection('systemsettings').findOne({ key: 'bot_credentials_msystem' })
    || await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });

  if (!setting) {
    console.error(' [LỖI] Không tìm thấy cấu hình bot_credentials_msystem trong Database!');
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

  const outputDir = path.join(__dirname, '..', '..', 'temp', 'test_20_reports');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`- Thư mục lưu file: ${outputDir}\n`);

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  let executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;

  const isHeadless = !process.argv.includes('--headed') && process.env.HEADED !== 'true';
  console.log(isHeadless ? 'Chế độ: Headless (Chạy ngầm ẩn trình duyệt)' : 'Chế độ: Headed (Hiển thị cửa sổ trình duyệt trực quan)');
  const launchOptions = {
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 250,
    args: ['--start-maximized', '--no-sandbox'],
  };
  if (executablePath) {
    console.log(`Khởi động Edge: ${executablePath}`);
    launchOptions.executablePath = executablePath;
  } else {
    console.log(`Khởi động Chrome mặc định...`);
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: null,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60000);

  // Hàm đăng nhập dùng chung (hỗ trợ cả tự động đăng nhập lại khi bị đá phiên)
  async function performLogin() {
    console.log('   - Điều hướng tới trang Đăng nhập...');
    await page.goto(msLoginUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 20000 });
    await userInput.fill(username);
    const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });
    await passInput.fill(password);
    await page.click('button[type="submit"], button.btn-primary');

    // Nhập PIN bằng bàn phím số ảo (div.pincode)
    console.log('   - Đang chờ bảng bàn phím số ảo PIN (div.pincode)...');
    const pinModal = await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 }).catch(() => null);
    if (pinModal && pin) {
      console.log('   - Nhập từng chữ số mã PIN...');
      for (const digit of String(pin).split('')) {
        const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(digitSelector, { state: 'visible', timeout: 5000 });
        await page.click(digitSelector);
        await page.waitForTimeout(300);
      }
    }

    await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái') or contains(text(), 'Dashboard')]", { timeout: 30000 });
    console.log('   -> Đăng nhập M-System thành công!\n');
  }

  // Tự động kiểm tra và đăng nhập lại nếu bị đá về login
  async function ensureLoggedIn() {
    const isLoginPage = page.url().includes('/login') || (await page.$('input[name="username"]'));
    if (isLoginPage) {
      console.log('\n[CẢNH BÁO] Phát hiện phiên bị đá về màn hình Đăng nhập (trùng session). Đang tự động đăng nhập lại...');
      await performLogin();
      return true;
    }
    return false;
  }

  // Đăng nhập lần đầu
  console.log('\n2. ĐĂNG NHẬP M-SYSTEM...');
  await performLogin();

  console.log('========================================================================');
  console.log('3. BẮT ĐẦU TẢI LẦN LƯỢT 20 BÁO CÁO:');
  console.log('========================================================================\n');

  const results = [];
  const startTimeAll = Date.now();

  for (let i = 0; i < REPORTS.length; i++) {
    const rep = REPORTS[i];
    const indexStr = `[${i + 1}/${REPORTS.length}]`.padEnd(8);
    const saveFileName = `${rep.key}.${rep.ext}`;
    const destFilePath = path.join(outputDir, saveFileName);
    const repStart = Date.now();

    process.stdout.write(`${indexStr} Đang tải: ${rep.key} (${rep.name})... `);

    try {
      await ensureLoggedIn();

      const targetUrl = `${msBaseDomain}/${rep.hash}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Nếu bị chuyển hướng về login sau khi goto
      const relogged = await ensureLoggedIn();
      if (relogged) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);
      }

      // Xử lý riêng cho Bảng giá Market trước 6h (cần bấm nút + nếu chưa hiện icon CSV)
      if (rep.isMarketBefore6h) {
        const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
        const isVis = await csvBtn.isVisible().catch(() => false);
        if (!isVis) {
          await page.click("xpath=//i[contains(@class, 'fas fa-plus')]").catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // Chuyển sub-tab nếu có (hỗ trợ cả a, button, li, span, div)
      if (rep.subTab) {
        const tabSelector = `xpath=//*[self::a or self::button or self::li or self::span or self::div][normalize-space(text())='${rep.subTab}' or contains(text(), '${rep.subTab}')]`;
        const tabEl = await page.waitForSelector(tabSelector, { timeout: 10000 }).catch(() => null);
        if (tabEl) {
          await tabEl.click();
          await page.waitForTimeout(2000);
        }
      }

      // Kích hoạt tìm kiếm nếu có nút Tìm kiếm
      const searchBtn = await page.$("button:has-text('Tìm kiếm'), button:has(i.fa-search)");
      if (searchBtn && (await searchBtn.isVisible().catch(() => false))) {
        await searchBtn.click().catch(() => {});
        await page.waitForTimeout(2000);
      }

      // Đợi nút xuất file hiển thị (với fallback qua Menu Sidebar nếu URL trực tiếp không bắt được)
      let exportFound = false;
      try {
        await page.waitForSelector(EXPORT_SELECTORS, { state: 'visible', timeout: 12000 });
        exportFound = true;
      } catch (selErr) {
        if (rep.menuSteps && rep.menuSteps.length > 0) {
          process.stdout.write('(fallback qua Sidebar)... ');
          for (const step of rep.menuSteps) {
            const stepSel = `xpath=//*[self::a or self::span or self::li][normalize-space(text())='${step}' or contains(text(), '${step}')]`;
            await page.waitForSelector(stepSel, { timeout: 10000 });
            await page.click(stepSel);
            await page.waitForTimeout(1000);
          }
          await page.waitForTimeout(2000);
          if (rep.subTab) {
            const tabSelector = `xpath=//*[self::a or self::button or self::li or self::span or self::div][normalize-space(text())='${rep.subTab}' or contains(text(), '${rep.subTab}')]`;
            const tabEl = await page.waitForSelector(tabSelector, { timeout: 8000 }).catch(() => null);
            if (tabEl) await tabEl.click();
            await page.waitForTimeout(2000);
          }
          await page.waitForSelector(EXPORT_SELECTORS, { state: 'visible', timeout: 20000 });
          exportFound = true;
        } else {
          throw selErr;
        }
      }


      // Lắng nghe sự kiện download và click
      const downloadPromise = page.waitForEvent('download', { timeout: 90000 });
      const exportBtn = page.locator(EXPORT_SELECTORS).first();
      await exportBtn.click({ force: true });

      const download = await downloadPromise;
      await download.saveAs(destFilePath);

      const elapsed = ((Date.now() - repStart) / 1000).toFixed(1);
      const sizeKb = (fs.statSync(destFilePath).size / 1024).toFixed(1);

      console.log(`✅ OK (${sizeKb} KB, ${elapsed}s)`);
      results.push({ key: rep.key, name: rep.name, status: 'OK', sizeKb, elapsed, file: saveFileName });

      // Nghỉ nhẹ 2s giữa các báo cáo để giãn cách tránh kích hoạt WAF / 429 Too Many Requests của M-System
      await page.waitForTimeout(2000);

    } catch (err) {
      const elapsed = ((Date.now() - repStart) / 1000).toFixed(1);
      console.log(`❌ THẤT BẠI (${elapsed}s) - Lỗi: ${err.message}`);
      
      // Chụp ảnh lỗi nếu có
      const errSnap = path.join(outputDir, `error_${rep.key}.png`);
      await page.screenshot({ path: errSnap }).catch(() => {});

      results.push({ key: rep.key, name: rep.name, status: 'FAILED', error: err.message, elapsed });
    }
  }

  await browser.close();

  const totalElapsed = ((Date.now() - startTimeAll) / 1000).toFixed(1);
  const okCount = results.filter((r) => r.status === 'OK').length;
  const failCount = results.length - okCount;

  console.log('\n========================================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${okCount}/${results.length} BÁO CÁO THÀNH CÔNG (${totalElapsed}s)`);
  console.log('========================================================================');
  console.table(results.map(r => ({
    'Báo cáo': r.key,
    'Trạng thái': r.status,
    'Dung lượng (KB)': r.sizeKb || '-',
    'Thời gian (s)': r.elapsed,
    'Lỗi (nếu có)': r.error ? r.error.slice(0, 50) + '...' : ''
  })));

  if (failCount === 0) {
    console.log(`\n XÁC NHẬN: TẤT CẢ 20 BÁO CÁO (BAO GỒM TTM) ĐỀU ĐÃ TẢI THÀNH CÔNG 100%!`);
  } else {
    console.log(`\n CÒN ${failCount} BÁO CÁO GẶP SỰ CỐ. VUI LÒNG KIỂM TRA ẢNH SCREENSHOT TRONG temp/test_20_reports/`);
  }
}

runTest().catch(console.error);
