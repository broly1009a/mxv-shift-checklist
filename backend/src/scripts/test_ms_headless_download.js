/**
 * SCRIPT KIỂM THỬ TẢI FILE M-SYSTEM (HỖ TRỢ TẢI 1 FILE HOẶC TOÀN BỘ 20 BÁO CÁO)
 * THEO CHUẨN MÃ NGUỒN C# (ChromeBot.cs)
 * 
 * Hướng dẫn chạy:
 * 1. Tải toàn bộ 20 báo cáo M-System (chạy ngầm):
 *    node src/scripts/test_ms_headless_download.js --all
 * 
 * 2. Tải toàn bộ 20 báo cáo có mở trình duyệt để quan sát:
 *    node src/scripts/test_ms_headless_download.js --all --headed
 * 
 * 3. Tải riêng 1 báo cáo cụ thể (ví dụ DSGD, TTM, TTTT, QLTKGD...):
 *    node src/scripts/test_ms_headless_download.js --report=DSGD --headed
 * 
 * 4. Giữ trình duyệt sau khi tải xong:
 *    node src/scripts/test_ms_headless_download.js --all --headed --keep-open
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');
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

function getChromeExecutablePath() {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  return edgePaths.find((p) => fs.existsSync(p)) || null;
}

// Danh mục 20 báo cáo M-System chuẩn hóa 100% theo C# (ChromeBot.cs) & DANH_MUC_URL_20_BAO_CAO_MSYSTEM.md
const ALL_REPORTS = [
  { key: 'DSGD', name: 'Danh sách giao dịch CoreCCP', hash: '#/orderManagement/transactionList', expected: /transactionList/i },
  { key: 'TTM', name: 'Báo cáo Vị thế mở (TTM)', hash: '#/positionManagement/openPositionInfo', expected: /openPositionInfo/i },
  { key: 'TTTT', name: 'Trạng thái tất toán (TTTT)', hash: '#/positionManagement/finalPositionInfo', expected: /finalPositionInfo/i },
  { key: 'TTCDH', name: 'Trạng thái tất toán chờ đáo hạn LME', hash: '#/positionManagement/finalPositionInfo', subTab: 'Trạng thái tất toán chờ đáo hạn LME', expected: /finalPositionInfo/i },
  { key: 'QLTKGD', name: 'Quản lý tài khoản giao dịch', hash: '#/clientManagement/marginStatusManagement', expected: /marginStatusManagement/i },
  { key: 'QLTKGDAmKQ', name: 'QL TKGD âm ký quỹ', hash: '#/clientManagement/negativeMarginManagement', expected: /negativeMarginManagement/i },
  { key: 'NKTTHT', name: 'Nhật ký thao tác hệ thống', hash: '#/systemManagement/activityHistory', expected: /activityHistory/i },
  { key: 'DSTKGD-Futures', name: 'Danh sách TKGD - Futures', hash: '#/clientManagement/investorManagement', expected: /investorManagement/i },
  { key: 'DSTKGD-Spread', name: 'Danh sách TKGD - Spread', hash: '#/clientManagement/investorManagement', subTab: 'Spreads', expected: /investorManagement/i },
  { key: 'DSTKGD-LME', name: 'Danh sách TKGD - LME', hash: '#/clientManagement/investorManagement', subTab: 'LME', expected: /investorManagement/i },
  { key: 'DSTKGD-ACM', name: 'Danh sách TKGD - ACM', hash: '#/clientManagement/investorManagement', subTab: 'ACM', expected: /investorManagement/i },
  { key: 'TLKQHSKQ', name: 'Thiết lập quan hệ số ký quỹ (TLKQ HSKQ)', hash: '#/clientManagement/marginRatioMultiplier', expected: /marginRatioMultiplier/i },
  { key: 'DSQLKQ', name: 'Danh sách quản lý ký quỹ (DSQLKQ)', hash: '#/positionManagement/marginList', expected: /marginList/i },
  { key: 'NR', name: 'Lịch sử giao dịch tiền TKGD (NR)', hash: '#/clientManagement/marginMoneyTransHistory', expected: /marginMoneyTransHistory/i },
  { key: 'DSTrader', name: 'Danh sách Trader', hash: '#/clientManagement/traderManagement', expected: /traderManagement/i },
  { key: 'Markettruoc6h', name: 'Báo cáo Bảng giá Market trước 6h', hash: '#/orderManagement/orderCreating', isMarketBefore6h: true, expected: /orderCreating/i },
  { key: 'DSLDK', name: 'Danh sách lệnh đã khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã khớp', expected: /orderList/i },
  { key: 'DSLCK', name: 'Danh sách lệnh chờ khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh chờ khớp', expected: /orderList/i },
  { key: 'DSLH', name: 'Danh sách lệnh đã hủy', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã hủy', expected: /orderList/i },
  { key: 'DSLK', name: 'Danh sách lệnh khác', hash: '#/orderManagement/orderList', subTab: 'Lệnh khác', expected: /orderList/i },
];

async function switchSubTab(page, tabName) {
  const tabSelector = `xpath=//*[self::a or self::button or self::li or self::div or self::span][normalize-space(text())='${tabName}' or contains(text(), '${tabName}')]`;
  const tabLocator = page.locator(tabSelector).first();
  await tabLocator.waitFor({ state: 'visible', timeout: 10000 });

  const isActive = await tabLocator.evaluate((el) => {
    const parent = el.closest('li') || el.closest('div.nav-item') || el;
    return (
      parent.classList.contains('active') ||
      el.classList.contains('active') ||
      el.getAttribute('aria-selected') === 'true'
    );
  }).catch(() => false);

  if (!isActive) {
    await tabLocator.click({ force: true });
  }
  await page.waitForTimeout(1500);
}

async function triggerSearchIfPresent(page) {
  const searchSelector =
    "button:has-text('Tìm kiếm'), button:has(i.fa-search), button.btn-primary:has-text('Tìm kiếm'), button[type='submit']:has-text('Tìm kiếm')";
  const searchBtn = page.locator(searchSelector).first();
  const isSearchVisible = await searchBtn.isVisible({ timeout: 1500 }).catch(() => false);
  if (isSearchVisible) {
    console.log('   [Action] Phát hiện nút "Tìm kiếm", bấm để kích hoạt render dữ liệu...');
    await searchBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.waitForSelector('.ladda-loading, div.spinner, div.loading, div.block-ui-overlay', {
      state: 'detached',
      timeout: 5000,
    }).catch(() => {});
  }
}

async function runTest() {
  console.log('================================================================================');
  console.log(' KIỂM THỬ RPA TẢI BÁO CÁO M-SYSTEM (CHẠY NGẦM HOẶC CÓ GIAO DIỆN)');
  console.log(' CHUẨN MÃ NGUỒN C# (ChromeBot.cs)');
  console.log('================================================================================\n');

  const isHeadless = !process.argv.includes('--headed') && process.env.HEADED !== 'true';
  const keepOpen = process.argv.includes('--keep-open');
  const runAll = process.argv.includes('--all') || process.env.ALL === 'true';
  const reportArg = process.argv.find((a) => a.startsWith('--report=') || a.startsWith('--key='));
  const targetReport = reportArg ? reportArg.split('=')[1].trim().toUpperCase() : null;

  let reportsToRun = ALL_REPORTS;
  if (!runAll && !targetReport) {
    // Mặc định nếu không truyền cờ gì thì tải cả 20 file theo yêu cầu của user
    reportsToRun = ALL_REPORTS;
  } else if (targetReport) {
    reportsToRun = ALL_REPORTS.filter((r) => r.key.toUpperCase() === targetReport);
    if (reportsToRun.length === 0) {
      console.error(`❌ Không tìm thấy báo cáo có mã: "${targetReport}". Danh sách mã hợp lệ:`);
      console.log(ALL_REPORTS.map((r) => r.key).join(', '));
      return;
    }
  }

  console.log(`[Cấu hình chạy]:`);
  console.log(`  • Chế độ trình duyệt : ${isHeadless ? 'CHẠY NGẦM (Headless 100%)' : 'CÓ GIAO DIỆN (Headed)'}`);
  console.log(`  • Số lượng báo cáo   : ${reportsToRun.length} báo cáo (${reportsToRun.map((r) => r.key).join(', ')})`);
  console.log(`  • Giữ trình duyệt    : ${keepOpen ? 'BẬT' : 'TẮT'}\n`);

  // 1. Kết nối CSDL lấy thông tin tài khoản M-System
  const uri =
    process.env.MONGODB_URI ||
    'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

  console.log('1. Đang truy vấn cấu hình bot M-System từ MongoDB...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  if (!setting) {
    console.error('❌ Không tìm thấy cấu hình bot_credentials_msystem trong Database!');
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

  const msRawUrl = credentials.url || 'https://msystem.mxv.vn/';
  const msBaseDomain = msRawUrl.split('#')[0].replace(/\/$/, '');
  const username = credentials.username || '';
  const password = credentials.password || '';
  const pin = credentials.pin || '';

  console.log(`  • M-System URL       : ${msBaseDomain}`);
  console.log(`  • Tên đăng nhập     : ${username}`);
  console.log(`  • Mã PIN cấu hình   : ${pin ? '******' : '(chưa có)'}\n`);

  // 2. Thư mục lưu file
  const outputDir = path.join(__dirname, '..', '..', 'data', 'temp', 'test_ms_downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 3. Khởi tạo trình duyệt Playwright
  const executablePath = getChromeExecutablePath();
  const launchOptions = {
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--window-size=1440,900',
    ],
  };
  if (executablePath) {
    launchOptions.executablePath = executablePath;
    console.log(`2. Khởi động trình duyệt: ${executablePath}`);
  } else {
    launchOptions.channel = 'chrome';
    console.log('2. Khởi động trình duyệt Chrome mặc định...');
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  page.setDefaultTimeout(35000);

  const results = [];

  try {
    // 4. Mở trang đăng nhập M-System
    console.log(`3. Đang điều hướng đến M-System: ${msBaseDomain}...`);
    await page.goto(msBaseDomain, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1000);

    // 5. Đăng nhập
    console.log('4. Nhập tên đăng nhập & mật khẩu...');
    await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập']", { state: 'visible', timeout: 15000 });
    await page.fill("input[name='username'], input[placeholder*='tên đăng nhập']", username);
    await page.fill("input[name='password'], input[placeholder*='mật khẩu']", password);
    await page.waitForTimeout(500);

    console.log('5. Bấm nút Đăng nhập...');
    await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await page.waitForTimeout(2000);

    // 6. Nhập PIN
    const pinPad = page.locator('div.pincode');
    const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPinPad && pin) {
      console.log(`6. Phát hiện bàn phím PIN ảo -> Đang nhập mã PIN...`);
      for (const digit of String(pin).split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(250);
      }
      await page.waitForTimeout(2000);
    }

    console.log(`   [Trạng thái] Đăng nhập thành công! URL: ${page.url()}\n`);

    // 7. Duyệt qua từng báo cáo để tải file
    console.log('================================================================================');
    console.log(`BẮT ĐẦU TẢI ${reportsToRun.length} BÁO CÁO THEO CHUẨN C# (ChromeBot.cs)`);
    console.log('================================================================================\n');

    for (let i = 0; i < reportsToRun.length; i++) {
      const rep = reportsToRun[i];
      const stepIdx = `[${(i + 1).toString().padStart(2, '0')}/${reportsToRun.length}]`;
      console.log(`${stepIdx} Đang xử lý: ${rep.key} - "${rep.name}"...`);
      const startTime = Date.now();

      try {
        const targetUrl = `${msBaseDomain}/${rep.hash}`;
        await page.goto(targetUrl);

        await page.waitForFunction(
          (expectedHash) => window.location.hash.toLowerCase().includes(expectedHash.replace('#', '').toLowerCase()),
          rep.hash,
          { timeout: 8000 }
        ).catch(() => {});
        await page.waitForTimeout(1500);

        if (rep.subTab) {
          console.log(`   [SubTab] Chuyển sang tab con: "${rep.subTab}"`);
          await switchSubTab(page, rep.subTab);
        }

        // Xử lý riêng cho Bảng giá Market trước 6h (chuẩn C# ChromeBot.cs#L2181-2193: bấm nút + nếu chưa hiện icon CSV)
        if (rep.isMarketBefore6h) {
          const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]").first();
          const isVis = await csvBtn.isVisible({ timeout: 2000 }).catch(() => false);
          if (!isVis) {
            console.log('   [Action] Bấm nút "+" để hiển thị bảng giá Market...');
            await page.click("xpath=//i[contains(@class, 'fas fa-plus') or contains(@class, 'fa-plus')]").catch(() => {});
            await page.waitForTimeout(2000);
          }
        }

        // Kích hoạt nút Tìm kiếm nếu có
        await triggerSearchIfPresent(page);

        // Chờ 3000ms bảng ổn định chuẩn C# ChromeBot.cs#L2375
        console.log(`   Chờ 3000ms bảng ổn định theo chuẩn C#...`);
        await page.waitForTimeout(3000);
        await page.waitForSelector('.ladda-loading, div.spinner, div.loading, div.block-ui-overlay', {
          state: 'detached',
          timeout: 5000,
        }).catch(() => {});

        // Định vị nút xuất file chuẩn C# (icon fa-file-csv hoặc fa-file-excel)
        const exportIcon = page.locator("xpath=//i[contains(@class, 'fa-file-csv') or contains(@class, 'fa-file-excel')]").first();
        const hasExportIcon = await exportIcon.isVisible({ timeout: 6000 }).catch(() => false);

        if (!hasExportIcon) {
          throw new Error('Không tìm thấy icon xuất CSV/Excel trên giao diện!');
        }

        const downloadedPath = path.join(outputDir, `${rep.key}.xlsx`);
        if (fs.existsSync(downloadedPath)) {
          fs.unlinkSync(downloadedPath);
        }

        console.log(`   Bấm nút xuất và bắt sự kiện download...`);
        const [downloadEvent] = await Promise.all([
          page.waitForEvent('download', { timeout: 45000 }),
          exportIcon.click({ timeout: 15000 }),
        ]);

        await downloadEvent.saveAs(downloadedPath);

        const stats = fs.statSync(downloadedPath);
        const sizeKb = (stats.size / 1024).toFixed(1);

        let rowCount = 0;
        let sheetName = '-';
        try {
          const wb = XLSX.readFile(downloadedPath);
          sheetName = wb.SheetNames[0] || 'Sheet1';
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
          rowCount = rows.length;
        } catch {}

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   ✅ TẢI THÀNH CÔNG: ${rep.key}.xlsx (${sizeKb} KB, ${rowCount} dòng, ${elapsed}s)\n`);

        results.push({
          key: rep.key,
          name: rep.name,
          status: 'THÀNH CÔNG',
          file: `${rep.key}.xlsx`,
          size: `${sizeKb} KB`,
          rows: rowCount,
          elapsed: `${elapsed}s`,
        });
      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`   ❌ LỖI: ${err.message} (${elapsed}s)\n`);
        results.push({
          key: rep.key,
          name: rep.name,
          status: 'LỖI',
          file: '-',
          size: '-',
          rows: 0,
          elapsed: `${elapsed}s`,
          note: err.message,
        });
      }

      await page.waitForTimeout(500);
    }

    // 8. Bảng tổng kết
    console.log('\n================================================================================');
    console.log(`BẢNG TỔNG KẾT KẾT QUẢ TẢI ${results.length} BÁO CÁO M-SYSTEM`);
    console.log('================================================================================');
    console.table(
      results.map((r) => ({
        Mã: r.key,
        'Tên báo cáo': r.name,
        'Trạng thái': r.status,
        'Tên file': r.file,
        'Kích thước': r.size,
        'Số dòng': r.rows,
        'Thời gian': r.elapsed,
      }))
    );

    const successCount = results.filter((r) => r.status === 'THÀNH CÔNG').length;
    console.log(`\n🎉 KẾT QUẢ CHUNG: ${successCount}/${results.length} BÁO CÁO TẢI THÀNH CÔNG!`);
    console.log(`Thư mục lưu file: ${outputDir}`);

    if (keepOpen) {
      console.log('\n⏳ [--keep-open] Giữ trình duyệt trong 20 giây để quan sát...');
      await page.waitForTimeout(20000);
    }
  } catch (globalErr) {
    console.error('Lỗi toàn cục:', globalErr.message);
  } finally {
    await browser.close();
    console.log('Đã đóng phiên trình duyệt.');
  }
}

runTest().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
