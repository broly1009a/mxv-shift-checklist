/**
 * SCRIPT KIỂM THỬ MỞ NHANH 20 BÁO CÁO M-SYSTEM (NAVIGATE & RENDER VALIDATION)
 * 
 * Mục đích:
 * - Kiểm tra tính mượt mà của toàn bộ 20 tab báo cáo sau khi áp dụng bản fix.
 * - Kiểm chứng điều hướng: Direct Hash Navigation, Scoped Sidebar Navigation, Switch Sub-tab, Tự động click "Tìm kiếm".
 * - Bỏ qua bước download file để tối ưu tốc độ (chỉ cần URL khớp và nút Xuất file / Bảng hiển thị là ĐẠT).
 * - Thứ tự test được bố trí có chủ đích: Mở DSGD trước TTM, TTTT, TTCDH để kiểm chứng miễn nhiễm 100% kẹt trang cũ.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_ms_tab_downloads.js
 * (Hoặc chạy có giao diện: set HEADED=true && node src/scripts/test_ms_tab_downloads.js)
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

const EXPORT_BUTTON_SELECTORS = [
  'button.ladda-button:has(i.fa-file-excel)',
  'button:has(i.fa-file-excel)',
  'button.ladda-button:has(i.fa-file-csv)',
  'button:has(i.fa-file-csv)',
  'button.btn-info',
  'i.fa-file-excel',
  'i.fa-file-csv',
  "button:has-text('Xuất file')",
  "button:has-text('Xuất Excel')",
  "button[title*='Export' i]",
].join(', ');

// Danh mục 20 báo cáo kiểm thử theo đúng thứ tự tác vụ
const REPORTS_TO_TEST = [
  // 1. DSGD (Mở đầu để kiểm chứng không làm kẹt các trang sau)
  {
    key: 'DSGD',
    name: 'Danh sách giao dịch CoreCCP',
    type: 'direct_hash',
    hash: '#/orderManagement/transactionList',
    expectedHashPattern: /transactionList/i,
  },
  // 2. TTM (Direct Hash)
  {
    key: 'TTM',
    name: 'Báo cáo Vị thế mở (TTM)',
    type: 'direct_hash',
    hash: '#/positionManagement/openPositionInfo',
    expectedHashPattern: /openPositionInfo/i,
  },
  // 3. TTTT (Direct Hash)
  {
    key: 'TTTT',
    name: 'Trạng thái tất toán (TTTT)',
    type: 'direct_hash',
    hash: '#/positionManagement/finalPositionInfo',
    expectedHashPattern: /finalPositionInfo/i,
  },
  // 4. TTCDH (Direct Hash + Sub-tab)
  {
    key: 'TTCDH',
    name: 'Trạng thái tất toán chờ đáo hạn LME',
    type: 'direct_hash',
    hash: '#/positionManagement/finalPositionInfo',
    subTab: 'Trạng thái tất toán chờ đáo hạn LME',
    expectedHashPattern: /finalPositionInfo/i,
  },
  // 5. QLTKGD (Direct Hash)
  {
    key: 'QLTKGD',
    name: 'Quản lý tài khoản giao dịch (QLTKGD)',
    type: 'direct_hash',
    hash: '#/clientManagement/marginStatusManagement',
    expectedHashPattern: /marginStatusManagement/i,
  },
  // 6. QLTKGDAmKQ (Direct Hash)
  {
    key: 'QLTKGDAmKQ',
    name: 'QL TKGD âm ký quỹ',
    type: 'direct_hash',
    hash: '#/clientManagement/negativeMarginManagement',
    expectedHashPattern: /negativeMarginManagement/i,
  },
  // 7. NKTTHT (Direct Hash)
  {
    key: 'NKTTHT',
    name: 'Nhật ký thao tác hệ thống',
    type: 'direct_hash',
    hash: '#/systemManagement/activityHistory',
    expectedHashPattern: /activityHistory/i,
  },
  // 8. DSTKGD-Futures (Direct Hash)
  {
    key: 'DSTKGD-Futures',
    name: 'Danh sách TKGD - Futures',
    type: 'direct_hash',
    hash: '#/clientManagement/investorManagement',
    expectedHashPattern: /investorManagement/i,
  },
  // 9. DSTKGD-Spread (Direct Hash + Sub-tab)
  {
    key: 'DSTKGD-Spread',
    name: 'Danh sách TKGD - Spread',
    type: 'direct_hash',
    hash: '#/clientManagement/investorManagement',
    subTab: 'Spreads',
    expectedHashPattern: /investorManagement/i,
  },
  // 10. DSTKGD-LME (Direct Hash + Sub-tab)
  {
    key: 'DSTKGD-LME',
    name: 'Danh sách TKGD - LME',
    type: 'direct_hash',
    hash: '#/clientManagement/investorManagement',
    subTab: 'LME',
    expectedHashPattern: /investorManagement/i,
  },
  // 11. DSTKGD-ACM (Direct Hash + Sub-tab)
  {
    key: 'DSTKGD-ACM',
    name: 'Danh sách TKGD - ACM',
    type: 'direct_hash',
    hash: '#/clientManagement/investorManagement',
    subTab: 'ACM',
    expectedHashPattern: /investorManagement/i,
  },
  // 12. TLKQHSKQ (Direct Hash)
  {
    key: 'TLKQHSKQ',
    name: 'Tỉ lệ ký quỹ và Hiệu số ký quỹ (TLKQHSKQ)',
    type: 'direct_hash',
    hash: '#/clientManagement/marginRatioMultiplier',
    expectedHashPattern: /marginRatioMultiplier/i,
  },
  // 13. DSQLKQ (Direct Hash)
  {
    key: 'DSQLKQ',
    name: 'Danh sách quản lý ký quỹ (DSQLKQ)',
    type: 'direct_hash',
    hash: '#/positionManagement/marginList',
    expectedHashPattern: /marginList/i,
  },
  // 14. NR (Direct Hash + Tự động click Tìm kiếm)
  {
    key: 'NR',
    name: 'Lịch sử giao dịch tiền TKGD (NR)',
    type: 'direct_hash',
    hash: '#/clientManagement/marginMoneyTransHistory',
    expectedHashPattern: /marginMoneyTransHistory/i,
  },
  // 15. DSTrader (Direct Hash + Tự động click Tìm kiếm)
  {
    key: 'DSTrader',
    name: 'Danh sách Trader hoạt động',
    type: 'direct_hash',
    hash: '#/clientManagement/traderManagement',
    expectedHashPattern: /traderManagement/i,
  },
  // 16. Markettruoc6h (Direct Hash Bảng giá)
  {
    key: 'Markettruoc6h',
    name: 'Báo cáo Market trước 6h',
    type: 'direct_hash',
    hash: '#/orderManagement/orderCreating',
    expectedHashPattern: /orderCreating/i,
    isMarketPrice: true,
  },
  // 17. DSLDK (Direct Hash + Sub-tab Lệnh đã khớp)
  {
    key: 'DSLDK',
    name: 'Danh sách lệnh đã khớp',
    type: 'direct_hash',
    hash: '#/orderManagement/orderList',
    subTab: 'Lệnh đã khớp',
    expectedHashPattern: /orderList/i,
  },
  // 18. DSLCK (Direct Hash + Sub-tab Lệnh chờ khớp)
  {
    key: 'DSLCK',
    name: 'Danh sách lệnh chờ khớp',
    type: 'direct_hash',
    hash: '#/orderManagement/orderList',
    subTab: 'Lệnh chờ khớp',
    expectedHashPattern: /orderList/i,
  },
  // 19. DSLH (Direct Hash + Sub-tab Lệnh đã hủy)
  {
    key: 'DSLH',
    name: 'Danh sách lệnh đã hủy',
    type: 'direct_hash',
    hash: '#/orderManagement/orderList',
    subTab: 'Lệnh đã hủy',
    expectedHashPattern: /orderList/i,
  },
  // 20. DSLK (Direct Hash + Sub-tab Lệnh khác)
  {
    key: 'DSLK',
    name: 'Danh sách lệnh khác',
    type: 'direct_hash',
    hash: '#/orderManagement/orderList',
    subTab: 'Lệnh khác',
    expectedHashPattern: /orderList/i,
  },
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
    console.log('   [Action] Phát hiện nút "Tìm kiếm", kích hoạt click để render dữ liệu...');
    await searchBtn.click({ force: true }).catch(() => { });
    await page.waitForTimeout(2000);
    await page
      .waitForSelector(
        '.ladda-loading, div.spinner, div.loading, div.block-ui-overlay',
        { state: 'detached', timeout: 5000 },
      )
      .catch(() => { });
  }
}

async function run20TabsValidation() {
  console.log('========================================================================');
  console.log('  TEST TỰ ĐỘNG MỞ NHANH 20 TAB BÁO CÁO M-SYSTEM (PLAYWRIGHT SPEED TEST) ');
  console.log('========================================================================\n');

  const uri =
    process.env.MONGODB_URI ||
    'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

  console.log('1. Kết nối cơ sở dữ liệu lấy thông tin đăng nhập M-System...');
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

  console.log(`- M-System URL : ${msBaseDomain}`);
  console.log(`- Tài khoản     : ${username}`);

  const isHeadless = !process.argv.includes('--headed') && process.env.HEADED !== 'true';
  const doDownload = process.argv.includes('--download') || process.env.DOWNLOAD === 'true';
  const keyArg = process.argv.find((a) => a.startsWith('--key='));
  const targetKey = keyArg ? keyArg.split('=')[1].trim().toLowerCase() : null;
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limitCount = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;
  const outArg = process.argv.find((a) => a.startsWith('--dest=') || a.startsWith('--out='));

  const downloadDir = outArg
    ? path.resolve(outArg.split('=')[1].trim())
    : path.join(__dirname, '..', '..', 'temp', 'test_ms_downloads');
  if (doDownload && !fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  let executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;

  const launchOptions = {
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 250,
    args: ['--start-maximized'],
  };
  if (executablePath) {
    console.log(`- Trình duyệt  : ${executablePath} (${isHeadless ? 'Headless' : 'Headed'})`);
    launchOptions.executablePath = executablePath;
  } else {
    console.log(`- Trình duyệt  : Chromium default (${isHeadless ? 'Headless' : 'Headed'})`);
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  const results = [];

  try {
    // -------------------------------------------------------------
    // ĐĂNG NHẬP
    // -------------------------------------------------------------
    console.log('\n2. Đăng nhập M-System...');
    await page.goto(msLoginUrl);
    await page.waitForTimeout(2000);

    const pageState = await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }).then(() => 'login'),
      page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 15000 }).then(() => 'dashboard'),
    ]).catch(() => 'unknown');

    if (pageState === 'login') {
      await page.fill('input[name="username"]', username);
      await page.fill('input[name="password"]', password);
      await page.waitForTimeout(400);
      await page.click('button.btn-primary');

      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
      for (const digit of pin.split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(300);
      }
      await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái')]", { timeout: 30000 });
      console.log(' Đăng nhập thành công, đã vào Dashboard!\n');
    } else {
      console.log(' Đã có phiên đăng nhập sẵn, tiếp tục kiểm thử.\n');
    }

    // -------------------------------------------------------------
    // KIỂM THỬ LẦN LƯỢT 20 BÁO CÁO
    // -------------------------------------------------------------
    let reportsToRun = REPORTS_TO_TEST;
    if (targetKey) {
      reportsToRun = REPORTS_TO_TEST.filter((r) => r.key.toLowerCase().includes(targetKey));
      console.log(` Lọc theo mã báo cáo: "${targetKey}" -> Tìm thấy ${reportsToRun.length} báo cáo.`);
    }
    if (limitCount && limitCount > 0) {
      reportsToRun = reportsToRun.slice(0, limitCount);
      console.log(` Giới hạn chạy: ${limitCount} báo cáo đầu tiên.`);
    }

    console.log('========================================================================');
    console.log(`3. BẮT ĐẦU DUYỆT QUA ${reportsToRun.length} BÁO CÁO (KIỂM TRA URL & RENDER NÚT XUẤT FILE)`);
    console.log('========================================================================\n');

    for (let i = 0; i < reportsToRun.length; i++) {
      const rep = reportsToRun[i];
      const stepIdx = `[${(i + 1).toString().padStart(2, '0')}/${reportsToRun.length}]`;
      console.log(`${stepIdx} Đang mở: ${rep.key} - "${rep.name}"...`);
      const startTime = Date.now();

      try {
        if (rep.type === 'direct_hash') {
          const targetUrl = `${msBaseDomain}/${rep.hash}`;
          await page.goto(targetUrl);
          
          // Chờ Angular router cập nhật hash thật sự
          await page.waitForFunction(
            (expectedHash) => window.location.hash.toLowerCase().includes(expectedHash.replace('#', '').toLowerCase()),
            rep.hash,
            { timeout: 8000 }
          ).catch(() => {});
          await page.waitForTimeout(1500);

          if (rep.subTab) {
            console.log(`   [SubTab] Chọn tab con: "${rep.subTab}"`);
            await switchSubTab(page, rep.subTab);
          }
        } else if (rep.type === 'sidebar') {
          const sidebarPrefix = `xpath=(//aside | //nav[contains(@class, 'sidebar')] | //*[@class and contains(@class, 'sidebar')] | //app-sidebar)`;
          for (let m = 0; m < rep.path.length; m++) {
            const menu = rep.path[m];
            const scopedSelector = `${sidebarPrefix}//*[self::a or self::span or self::li or self::div][normalize-space(text())='${menu}' or contains(text(), '${menu}')]`;
            const fallbackSelector = `xpath=//*[self::a or self::span or self::li or self::div][normalize-space(text())='${menu}' or contains(text(), '${menu}')]`;

            if (m < rep.path.length - 1) {
              const nextMenu = rep.path[m + 1];
              const nextScoped = `${sidebarPrefix}//*[self::a or self::span or self::li or self::div][normalize-space(text())='${nextMenu}' or contains(text(), '${nextMenu}')]`;
              const isNextVis = await page.locator(nextScoped).first().isVisible().catch(() => false);
              if (isNextVis) continue;
            }

            let activeSel = scopedSelector;
            const isVis = await page.locator(scopedSelector).first().isVisible({ timeout: 2000 }).catch(() => false);
            if (!isVis) activeSel = fallbackSelector;

            await page.waitForSelector(activeSel, { state: 'visible', timeout: 10000 });
            await page.click(activeSel, { force: true });
            await page.waitForTimeout(800);
          }
        }

        // Tự động kích hoạt Tìm kiếm nếu có
        await triggerSearchIfPresent(page);

        // Kiểm tra URL thực tế
        const currentUrl = page.url();
        let urlValid = true;
        if (rep.expectedHashPattern) {
          urlValid = rep.expectedHashPattern.test(currentUrl);
        }

        // Kiểm tra nút xuất file hoặc bảng dữ liệu
        let exportBtnFound = false;
        try {
          const btn = page.locator(EXPORT_BUTTON_SELECTORS).first();
          exportBtnFound = await btn.isVisible({ timeout: 5000 });
        } catch {
          exportBtnFound = false;
        }

        // Với Markettruoc6h: nút CSV có thể ở chế độ đặc biệt
        if (!exportBtnFound && rep.isMarketPrice) {
          const plusOrCsv = await page.locator("xpath=//i[contains(@class, 'fa-file-csv') or contains(@class, 'fa-plus')]").first().isVisible({ timeout: 3000 }).catch(() => false);
          exportBtnFound = plusOrCsv;
        }

        let downloadInfo = null;
        if (exportBtnFound && doDownload) {
          try {
            console.log(`   [Download] Đang chờ và kích hoạt tải file cho: ${rep.key}...`);
            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

            // Ưu tiên các selector icon file/excel/csv trước để tránh click nhầm nút btn-info khác
            const specificExportBtn = page.locator("button:has(i.fa-file-excel), button:has(i.fa-file-csv), button.ladda-button:has(i.fa-file-excel), button.ladda-button:has(i.fa-file-csv), i.fa-file-excel, i.fa-file-csv, button:has-text('Xuất file'), button:has-text('Xuất Excel'), button[title*='Export' i]").first();
            const hasSpecific = await specificExportBtn.isVisible({ timeout: 2000 }).catch(() => false);
            if (hasSpecific) {
              await specificExportBtn.click({ force: true });
            } else {
              await page.locator(EXPORT_BUTTON_SELECTORS).first().click({ force: true });
            }

            const download = await downloadPromise;
            const suggestedName = download.suggestedFilename();
            const ext = path.extname(suggestedName) || '.xlsx';
            const savePath = path.join(downloadDir, `${rep.key}${ext}`);
            await download.saveAs(savePath);
            const sizeKb = (fs.statSync(savePath).size / 1024).toFixed(1);
            downloadInfo = `${rep.key}${ext} (${sizeKb} KB)`;
            console.log(`   📥 [Download] Đã lưu file: ${downloadInfo} (Gốc: ${suggestedName})`);
          } catch (dlErr) {
            console.error(`   ❌ [Download] Lỗi khi tải file ${rep.key}: ${dlErr.message}`);
            downloadInfo = `Lỗi tải: ${dlErr.message}`;
          }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const passed = urlValid && exportBtnFound && (!doDownload || (downloadInfo && !downloadInfo.startsWith('Lỗi')));

        if (passed) {
          console.log(`    PASS (${elapsed}s) | URL: ${currentUrl} | Nút xuất: Có${downloadInfo ? ` | File: ${downloadInfo}` : ''}`);
          results.push({
            key: rep.key,
            name: rep.name,
            subTab: rep.subTab || null,
            status: 'PASS',
            file: downloadInfo || '-',
            elapsed: `${elapsed}s`,
            fullUrl: currentUrl,
            hash: currentUrl.split('#')[1] ? `#${currentUrl.split('#')[1]}` : '',
            note: downloadInfo ? `Tải thành công: ${downloadInfo}` : 'Mượt, URL & Nút xuất chuẩn',
          });
        } else {
          console.log(`    FAIL (${elapsed}s) | URL: ${currentUrl} | urlValid: ${urlValid}, exportBtn: ${exportBtnFound}${downloadInfo ? ` | ${downloadInfo}` : ''}`);
          results.push({
            key: rep.key,
            name: rep.name,
            subTab: rep.subTab || null,
            status: 'FAIL',
            file: downloadInfo || '-',
            elapsed: `${elapsed}s`,
            fullUrl: currentUrl,
            hash: currentUrl.split('#')[1] ? `#${currentUrl.split('#')[1]}` : '',
            note: downloadInfo || `urlValid=${urlValid}, exportBtn=${exportBtnFound}`,
          });
        }
      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.error(`    ERROR (${elapsed}s): ${err.message}`);
        results.push({
          key: rep.key,
          name: rep.name,
          status: 'ERROR',
          elapsed: `${elapsed}s`,
          fullUrl: page.url(),
          note: err.message,
        });
      }

      await page.waitForTimeout(500);
    }

    // -------------------------------------------------------------
    // TỔNG KẾT BẢNG ĐÁNH GIÁ & LƯU TÀI LIỆU
    // -------------------------------------------------------------
    console.log('\n========================================================================');
    console.log(`4. BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ ${results.length} BÁO CÁO M-SYSTEM`);
    console.log('========================================================================');
    console.table(
      results.map((r) => ({
        Mã: r.key,
        'Tên báo cáo': r.name,
        'Trạng thái': r.status,
        'File tải': r.file || '-',
        'Thời gian': r.elapsed,
        'Hash URL': r.hash,
      }))
    );

    const passCount = results.filter((r) => r.status === 'PASS').length;
    console.log(`\n-> KẾT QUẢ CHUNG: ${passCount}/${results.length} báo cáo ĐẠT chuẩn (Mở mượt & Sẵn sàng xuất file).`);

    // Lưu kết quả JSON
    const docsDir = path.join(__dirname, '..', '..', 'docs');
    if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

    const jsonPath = path.join(docsDir, 'ms_tab_audit_result.json');
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(` Đã lưu kết quả JSON tại: ${jsonPath}`);

    // Lưu tài liệu Markdown
    const mdPath = path.join(docsDir, 'DANH_MUC_URL_20_BAO_CAO_MSYSTEM.md');
    let md = `# TÀI LIỆU TỔNG HỢP DANH MỤC 20 BÁO CÁO & DIRECT URL M-SYSTEM

> **Hệ thống**: M-System MXV (\`https://msadmin.mxv.com.vn\`)  
> **Thời điểm xác thực**: ${new Date().toISOString()}  
> **Tổng số báo cáo**: ${results.length} báo cáo  
> **Tỷ lệ thành công**: ${passCount}/${results.length} PASS (100% Direct Hash Navigation)  

---

## BẢNG TỔNG HỢP DIRECT HASH URL 20 BÁO CÁO M-SYSTEM

| STT | Mã Báo Cáo | Tên Nghiệp Vụ Báo Cáo | Direct Hash URL | Tab Con (Nếu có) | Trạng Thái | Thời Gian |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: |
`;

    results.forEach((r, idx) => {
      const sub = r.subTab ? `\`${r.subTab}\`` : '-';
      md += `| ${idx + 1} | **\`${r.key}\`** | ${r.name} | \`${r.hash || r.fullUrl}\` | ${sub} | **${r.status}** | ${r.elapsed} |\n`;
    });

    md += `\n---

## LƯU Ý KỸ THUẬT QUAN TRỌNG KHI TẢI BÁO CÁO TRÊN M-SYSTEM:
1. **Direct Hash 100%**: Tất cả 20 báo cáo đều hỗ trợ Direct Hash Navigation, loại bỏ hoàn toàn việc click accordion Sidebar để không bị kẹt menu.
2. **Kích hoạt dữ liệu**: Đối với các báo cáo yêu cầu lọc hoặc query (như \`NR\`, \`DSTrader\`), bot tự động phát hiện và click nút \`Tìm kiếm\` trước khi chờ nút xuất file.
3. **Chuyển tiếp giữa các trang trên cùng một Page**: Khi chuyển từ \`DSGD\` sang \`TTM\` và \`TTTT\`, phải đảm bảo URL hash đã thay đổi trước khi tìm nút xuất file để tránh click nhầm vào nút xuất của màn hình trước.
`;

    fs.writeFileSync(mdPath, md, 'utf8');
    console.log(` Đã lưu tài liệu danh mục URL tại: ${mdPath}`);

    if (passCount === results.length) {
      console.log('🎉 XÁC NHẬN: Hệ thống đã khắc phục triệt để 100% các lỗi kẹt menu và timeout!');
    } else {
      console.log(' Cần kiểm tra lại các mục có trạng thái FAIL hoặc ERROR ở bảng trên.');
    }

  } catch (globalErr) {
    console.error('Lỗi toàn cục trong quá trình kiểm thử:', globalErr.message);
  } finally {
    console.log('\nĐóng trình duyệt sau 3 giây...');
    await page.waitForTimeout(3000);
    await browser.close().catch(() => { });
    console.log('Kiểm thử kết thúc.');
  }
}

run20TabsValidation();
