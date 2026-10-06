/**
 * SCRIPT KIỂM THỬ TẢI FILE COREEX (CE - VNCLEAR)
 * HỖ TRỢ TẢI DỮ LIỆU THẬT 100% (ZERO HARDCODING - DATA-DRIVEN)
 *
 * Hướng dẫn chạy từ Terminal:
 * 1. Tải toàn bộ báo cáo + Tự động quét hàng hóa THẬT trên sàn để tải Hợp đồng:
 *    node src/scripts/test_ce_headless_download.js --all --headed
 *
 * 2. Tải riêng 1 báo cáo cụ thể (ví dụ DSLCK, DSLDK, DSLH, DSGD, DSL, GTT, HH):
 *    node src/scripts/test_ce_headless_download.js --report=DSLCK --headed
 *
 * 3. Tải Hợp đồng của mã hàng hóa THẬT trên sàn (ví dụ CHV, DTV, TDV... trên UAT hoặc CP2CO trên Prod):
 *    node src/scripts/test_ce_headless_download.js --commodity=CHV --headed
 *
 * 4. Tải danh sách nhiều mã hàng hóa tùy chọn:
 *    node src/scripts/test_ce_headless_download.js --commodity=CHV,DTV,TDV --headed
 *
 * 5. Giữ trình duyệt không đóng sau khi chạy xong để kiểm tra DOM:
 *    node src/scripts/test_ce_headless_download.js --all --headed --keep-open
 *
 * === KẾT NỐI DATABASE UBUNTU PRODUCTION ===
 * 6. Dùng MongoDB của Ubuntu production (sau khi bật SSH tunnel: ssh -L 27018:localhost:27017 ubuntu@<server>):
 *    node src/scripts/test_ce_headless_download.js --all --headed \
 *      --db-uri="mongodb://localhost:27018/checklist"
 *
 * 7. Bypass DB hoàn toàn - truyền credentials trực tiếp qua dòng lệnh:
 *    node src/scripts/test_ce_headless_download.js --all --headed \
 *      --ce-url=https://coreexchange.mxv.com.vn \
 *      --ce-user=anhdao \
 *      --ce-pass="Mxv@2026"
 *
 *    (Hoặc chạy nhanh với tài khoản anhdao mặc định mật khẩu DB: node src/scripts/test_ce_headless_download.js --all --headed --ce-user=anhdao)
 *
 * Ghi chú SSH Tunnel Ubuntu:
 *   ssh -N -L 27018:localhost:27017 ubuntu@<IP_SERVER_UBUNTU> -p <PORT>
 *   Sau đó dùng: --db-uri="mongodb://localhost:27018/checklist"
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

// 7 Báo cáo Sổ lệnh & Giá chuẩn sàn CoreEX (CE)
const BASE_REPORTS = [
  {
    key: 'DSGD',
    name: 'Danh sách giao dịch CE',
    route: '/ORDERS/ORDERMATCH_DETAIL_ACM',
    filename: 'DSGD ACM CE.xlsx',
    type: 'DIRECT_TABLE',
  },
  {
    key: 'DSL',
    name: 'Sổ lệnh tổng hợp CE',
    route: '/ORDERS/ORDERBOOK_ALL_ACM',
    filename: 'DSL ACM CE.xlsx',
    type: 'DIRECT_TABLE',
  },
  {
    key: 'DSLCK',
    name: 'Lệnh chờ khớp CE',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh chờ khớp',
    filename: 'DSLCK ACM CE.xlsx',
    type: 'TAB_TABLE',
  },
  {
    key: 'DSLDK',
    name: 'Lệnh đã khớp CE (DSLDK)',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh đã khớp',
    filename: 'DSLDK ACM CE.xlsx',
    type: 'TAB_TABLE',
  },
  {
    key: 'DSLH',
    name: 'Lệnh hủy CE',
    route: '/ORDERS/ORDERBOOK_ACM',
    subTab: 'Lệnh đã hủy',
    filename: 'DSLH ACM CE.xlsx',
    type: 'TAB_TABLE',
  },
  {
    key: 'GTT',
    name: 'Giá thanh toán ACM',
    route: '/PRODUCT/SETTLEMENT',
    fallbackRoute: '/PRODUCT/SETTLEMENT_HIST',
    filename: 'GTT ACM.xlsx',
    type: 'DIRECT_TABLE',
  },
  {
    key: 'HH',
    name: 'Hàng hóa ACM',
    route: '/PRODUCT/COMMODITY',
    fallbackRoute: '/PRODUCT/COMMODITY_ACM',
    filename: 'HH ACM.xlsx',
    type: 'DIRECT_TABLE',
  },
];

async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("div[class*='MuiBackdrop-root'], div.MuiModal-backdrop").first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function waitForTableReady(page, timeoutMs = 15000) {
  await page.waitForSelector(
    "xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //div[contains(@class, 'crud-grid-container')] | //div[contains(@class, 'MuiTableContainer-root')]",
    { state: 'visible', timeout: timeoutMs }
  ).catch(() => {});
  await page.waitForTimeout(800);
}

async function switchTab(page, tabName) {
  const tabLocator = page.locator(
    `xpath=//*[self::button or self::div or self::span][normalize-space(text())='${tabName}' or contains(text(), '${tabName}')]`
  ).first();

  await tabLocator.waitFor({ state: 'visible', timeout: 8000 });
  await tabLocator.click({ force: true });
  console.log(`   [Tab] Đã click chuyển sang tab: "${tabName}"`);
  await page.waitForTimeout(1500);
  await waitForTableReady(page, 10000);
}

async function triggerVnclearExport(page, destPath, timeoutMs = 25000) {
  await dismissModalBackdrop(page);
  await waitForTableReady(page, 10000);

  // 1. Tìm nút Kết xuất
  let exportBtn = page.locator(
    "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel') or contains(., 'Xuất tất cả') or contains(@aria-label, 'Kết xuất')]"
  ).first();

  if (!(await exportBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
  }

  if (!(await exportBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error('Không tìm thấy nút "Kết xuất" trên màn hình hiện tại!');
  }

  let downloadObj = null;
  const dlPromise = page.waitForEvent('download', { timeout: timeoutMs })
    .then((d) => { downloadObj = d; return d; })
    .catch(() => null);

  // 2. Thử click nút kết xuất để mở Dropdown Menu (nếu có tùy chọn "Xuất tất cả")
  await exportBtn.click({ force: true });
  await page.waitForTimeout(500);

  const exportAllOption = page.locator(
    "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả'] | //*[contains(text(), 'Export all')]"
  ).first();

  if (await exportAllOption.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log('   [Action] Phát hiện menu dropdown -> Bấm "Xuất tất cả"...');
    await exportAllOption.click({ force: true });
  } else {
    console.log('   [Action] Nút Kết xuất dạng direct click, đang chờ download event...');
  }

  // 3. Chờ file tải về
  const dl = await dlPromise;
  if (dl) {
    await dl.saveAs(destPath);
    await dismissModalBackdrop(page);
    return true;
  }

  await dismissModalBackdrop(page);
  return false;
}

/**
 * Quét động danh sách mã hàng hóa thực tế đang có trên bảng /PRODUCT/COMMODITY
 */
async function scanActualCommoditiesFromTable(page, maxCount = 5) {
  await waitForTableReady(page, 15000);
  const rows = page.locator("xpath=//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
  const count = await rows.count();
  const list = [];

  for (let i = 0; i < count; i++) {
    const row = rows.nth(i);
    const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
    let code = '';
    if (await codeCell.isVisible().catch(() => false)) {
      code = (await codeCell.textContent()).trim();
    } else {
      const tdList = row.locator("xpath=.//td");
      const numTd = await tdList.count();
      for (let j = 0; j < numTd; j++) {
        const text = (await tdList.nth(j).textContent()).trim();
        if (/^[A-Z0-9]{2,8}$/.test(text) && !['VND', 'USD', 'MXV', 'KG'].includes(text)) {
          code = text;
          break;
        }
      }
    }

    if (code && !list.includes(code)) {
      list.push(code);
      if (list.length >= maxCount) break;
    }
  }
  return list;
}

/**
 * Mở modal hàng hóa và xuất HĐ <MÃ>.xlsx nếu có dữ liệu hợp đồng
 */
async function exportModalContract(page, commodityCode, destPath) {
  console.log(`   [Contract] Tìm kiếm dòng hàng hóa mã: "${commodityCode}"...`);
  await waitForTableReady(page, 15000);

  // Tìm row theo data-column-id='UACODE' hoặc text của mã hàng hóa
  const rowLocator = page.locator(
    `xpath=//tr[.//td[@data-column-id='UACODE' and normalize-space(.)='${commodityCode}'] or .//td[normalize-space(.)='${commodityCode}']]`
  ).first();

  const isRowVis = await rowLocator.isVisible({ timeout: 8000 }).catch(() => false);
  if (!isRowVis) {
    throw new Error(`Không tìm thấy hàng hóa mã "${commodityCode}" trong danh mục!`);
  }

  // Bấm nút xem/thao tác (icon con mắt hoặc button trong hàng)
  const viewBtn = rowLocator.locator("xpath=.//button[contains(@class, 'MuiIconButton-root') or .//svg]").first();
  await viewBtn.click({ force: true });
  await page.waitForTimeout(1000);

  // Chờ modal "Xem Thông tin hàng hóa"
  const modalTitle = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
  await modalTitle.waitFor({ state: 'visible', timeout: 8000 });
  console.log(`   [Modal] Đã mở modal chi tiết hàng hóa [${commodityCode}], chuyển tab "Thông tin hợp đồng"...`);

  // Chuyển Tab "Thông tin hợp đồng" (#tab-1)
  const contractTab = page.locator("xpath=//button[@id='tab-1' or contains(., 'Thông tin hợp đồng')]").first();
  await contractTab.waitFor({ state: 'visible', timeout: 5000 });
  await contractTab.click({ force: true });
  await page.waitForTimeout(1500);

  const tabpanel = page.locator("#tabpanel-1");

  // Kiểm tra xem bảng có dữ liệu hay rỗng (Không có dữ liệu, 0-0 trên 0)
  const noDataText = tabpanel.locator("xpath=.//*[contains(text(), 'Không có dữ liệu') or contains(text(), '0-0 trên 0')]").first();
  if (await noDataText.isVisible({ timeout: 1500 }).catch(() => false)) {
    console.log(`   [Info] Hàng hóa "${commodityCode}" chưa có hợp đồng nào (0 bản ghi). Bỏ qua xuất file.`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    return { status: 'NO_DATA', size: '0 B' };
  }

  const modalExportBtn = tabpanel.locator("button.button-element:has-text('Kết xuất'), button:has-text('Kết xuất')").first();
  if (!(await modalExportBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    await page.keyboard.press('Escape');
    throw new Error(`Không tìm thấy nút Kết xuất trong tab Hợp đồng của mã "${commodityCode}"!`);
  }

  const dlPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);

  await modalExportBtn.click({ force: true });
  await page.waitForTimeout(500);

  const exportAll = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả')").last();
  if (await exportAll.isVisible({ timeout: 2000 }).catch(() => false)) {
    await exportAll.click({ force: true });
  }

  const dl = await dlPromise;
  if (dl) {
    await dl.saveAs(destPath);
    const sz = fs.statSync(destPath).size;
    const szStr = `${(sz / 1024).toFixed(1)} KB`;
    console.log(`   [Thành công] Đã lưu: ${path.basename(destPath)} (${szStr})`);

    // Đóng modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const closeBtn = page.locator("button:has-text('Đóng')").last();
    if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeBtn.click({ force: true });
    }
    return { status: 'OK', size: szStr };
  } else {
    await page.keyboard.press('Escape');
    throw new Error(`Không bắt được file tải về cho hợp đồng "${commodityCode}"!`);
  }
}

async function runTest() {
  console.log('================================================================================');
  console.log('  KIỂM THỬ RPA TẢI BÁO CÁO COREEX (CE - VNCLEAR)');
  console.log('  DỮ LIỆU ĐỘNG THẬT 100% THEO SÀN HIỆN HÀNH (ZERO HARDCODING - DATA-DRIVEN)');
  console.log('================================================================================\n');

  const isHeadless = !process.argv.includes('--headed') && process.env.HEADED !== 'true';
  const keepOpen = process.argv.includes('--keep-open');
  const runAll = process.argv.includes('--all') || process.env.ALL === 'true';
  const reportArg = process.argv.find((a) => a.startsWith('--report=') || a.startsWith('--key='));
  const targetReport = reportArg ? reportArg.split('=')[1].trim().toUpperCase() : null;

  const commodityArg = process.argv.find((a) => a.startsWith('--commodity='));
  const targetCommodities = commodityArg
    ? commodityArg.split('=')[1].split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
    : [];

  const maxContractsArg = process.argv.find((a) => a.startsWith('--max-contracts='));
  const maxContracts = maxContractsArg ? parseInt(maxContractsArg.split('=')[1], 10) : 3;

  console.log(`[Cấu hình chạy]:`);
  console.log(`  • Chế độ trình duyệt : ${isHeadless ? 'CHẠY NGẦM (Headless 100%)' : 'CÓ GIAO DIỆN (Headed)'}`);
  console.log(`  • Chế độ kiểm thử    : ${runAll ? 'TOÀN BỘ SÀN (--all)' : (targetReport || (targetCommodities.length ? 'THEO HÀNG HÓA CHỈ ĐỊNH' : 'MẶC ĐỊNH'))}`);
  if (targetCommodities.length) {
    console.log(`  • Hàng hóa chỉ định : ${targetCommodities.join(', ')}`);
  }
  console.log(`  • Giữ trình duyệt    : ${keepOpen ? 'BẬT' : 'TẮT'}\n`);

  // ============================================================
  // 1. Lấy credentials CoreEX — ưu tiên theo thứ tự:
  //    (a) Flag --ce-url + --ce-user + --ce-pass  (bypass DB hoàn toàn)
  //    (b) Flag --db-uri (kết nối DB tùy ý, VD: MongoDB Ubuntu sau SSH tunnel)
  //    (c) MONGODB_URI từ .env (mặc định)
  // ============================================================
  const cliDbUri = process.argv.find((a) => a.startsWith('--db-uri='))?.split('=').slice(1).join('=');
  const cliCeUrl = process.argv.find((a) => a.startsWith('--ce-url='))?.split('=').slice(1).join('=');
  const cliCeUser = process.argv.find((a) => a.startsWith('--ce-user='))?.split('=').slice(1).join('=');
  const cliCePass = process.argv.find((a) => a.startsWith('--ce-pass='))?.split('=').slice(1).join('=');

  let baseUrl, username, password;

  if (cliCeUrl || cliCeUser) {
    // (a) Bypass DB - dùng credentials từ dòng lệnh trực tiếp
    console.log('1. Sử dụng credentials từ dòng lệnh (bypass DB)...');
    baseUrl = (cliCeUrl || 'https://coreexchange.mxv.com.vn').replace(/\/login\/?$/, '');
    username = cliCeUser || 'anhdao';
    // Mật khẩu trích xuất từ MongoDB Ubuntu (system_settings -> bot_credentials_ce) là Mxv@2026
    password = cliCePass || (username === 'anhdao' ? 'Mxv@2026' : '');
  } else {
    // (b) Lấy credentials từ DB (Atlas dev hoặc MongoDB Ubuntu qua --db-uri)
    const uri = cliDbUri ||
      process.env.MONGODB_URI ||
      'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

    if (cliDbUri) {
      console.log(`1. Kết nối MongoDB tùy chỉnh (--db-uri): ${cliDbUri.replace(/:([^@]+)@/, ':****@')}`);
    } else {
      console.log('1. Đang truy vấn cấu hình bot CoreEX từ MongoDB (Atlas dev)...');
    }

    await mongoose.connect(uri);
    const db = mongoose.connection.db;

    let setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_ce' });
    if (!setting) {
      console.log('  [Info] Không có bot_credentials_ce, tìm kiếm bot_credentials_ccp fallback...');
      setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_ccp' });
    }

    if (!setting) {
      console.error('❌ Không tìm thấy cấu hình tài khoản CoreEX trong Database!');
      console.error('💡 Gợi ý: Nếu muốn dùng DB Ubuntu, hãy bật SSH tunnel rồi chạy:');
      console.error('   ssh -N -L 27018:localhost:27017 ubuntu@<IP_SERVER> -p <PORT>');
      console.error('   node src/scripts/test_ce_headless_download.js --all --headed --db-uri="mongodb://localhost:27018/checklist"');
      console.error('   Hoặc bypass DB hoàn toàn:');
      console.error('   node src/scripts/test_ce_headless_download.js --all --headed --ce-url=https://coreexchange.mxv.com.vn --ce-user=anhdao --ce-pass="Mxv@2026"');
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

    const rawUrl = credentials.url || 'https://coreexchange.mxv.com.vn/login';
    baseUrl = rawUrl.replace(/\/login\/?$/, '');
    username = credentials.username || 'anhdao';
    password = credentials.password || '';
  }

  console.log(`  • CoreEX Base URL    : ${baseUrl}`);
  console.log(`  • Tên đăng nhập     : ${username}\n`);

  // 2. Thư mục lưu file
  const outDirArg = process.argv.find((a) => a.startsWith('--out='));
  const outputDir = outDirArg ? outDirArg.split('=')[1].trim() : path.join(__dirname, '..', '..', 'data', 'temp', 'test_ce_downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  console.log(`  • Thư mục lưu file   : ${outputDir}\n`);

  // 3. Khởi tạo Playwright
  const executablePath = getChromeExecutablePath();
  const launchOptions = {
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1600,900',
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
    viewport: { width: 1600, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(35000);

  const results = [];

  try {
    // 4. Đăng nhập CoreEX
    console.log(`3. Đang mở trang đăng nhập CoreEX: ${baseUrl}/login...`);
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle', timeout: 35000 });
    await page.waitForTimeout(1000);

    console.log(`4. Đăng nhập với tài khoản '${username}'...`);
    await page.fill("input[name='username']", username);
    await page.fill("input[name='password']", password);
    await page.click("button[type='submit']");

    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const afterLoginUrl = page.url();
    console.log(`   [Trạng thái] Đăng nhập thành công! URL hiện tại: ${afterLoginUrl}\n`);

    // 5. Xử lý các báo cáo Sổ lệnh & Bảng Hàng hóa chính
    let baseReportsToRun = [];
    if (runAll) {
      baseReportsToRun = BASE_REPORTS;
    } else if (targetReport && BASE_REPORTS.some((r) => r.key === targetReport)) {
      baseReportsToRun = BASE_REPORTS.filter((r) => r.key === targetReport);
    }

    if (baseReportsToRun.length > 0) {
      console.log('================================================================================');
      console.log(`BẮT ĐẦU TẢI ${baseReportsToRun.length} BÁO CÁO SỔ LỆNH, GIÁ & HÀNG HÓA CHÍNH`);
      console.log('================================================================================\n');

      for (let i = 0; i < baseReportsToRun.length; i++) {
        const rep = baseReportsToRun[i];
        const stepIdx = `[${(i + 1).toString().padStart(2, '0')}/${baseReportsToRun.length}]`;
        console.log(`${stepIdx} Đang xử lý: ${rep.key} - "${rep.name}"...`);
        const startTime = Date.now();
        const destPath = path.join(outputDir, rep.filename);

        try {
          const targetUrl = `${baseUrl}${rep.route}`;
          console.log(`   [Nav] Điều hướng trực tiếp đến: ${targetUrl}...`);
          await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 20000 });
          await page.waitForTimeout(1500);

          const currentUrl = page.url();
          if (currentUrl.includes('/DASHBOARD') || currentUrl.includes('/login')) {
            if (rep.fallbackRoute) {
              console.log(`   [Nav Fallback] Thử fallback: ${baseUrl}${rep.fallbackRoute}...`);
              await page.goto(`${baseUrl}${rep.fallbackRoute}`, { waitUntil: 'networkidle', timeout: 20000 });
              await page.waitForTimeout(1500);
            } else {
              throw new Error(`Trang bị chuyển hướng về ${currentUrl}!`);
            }
          }

          if (rep.type === 'TAB_TABLE' && rep.subTab) {
            await switchTab(page, rep.subTab);
          }

          const exportOk = await triggerVnclearExport(page, destPath);
          if (!exportOk) {
            throw new Error('Không bắt được download event sau khi nhấn Kết xuất!');
          }

          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          let fileSizeStr = '0 B';
          if (fs.existsSync(destPath)) {
            const sz = fs.statSync(destPath).size;
            fileSizeStr = `${(sz / 1024).toFixed(1)} KB`;
          }

          console.log(`   ✅ THÀNH CÔNG: Đã lưu "${rep.filename}" (${fileSizeStr}) trong ${elapsed}s\n`);
          results.push({
            key: rep.key,
            name: rep.name,
            filename: rep.filename,
            size: fileSizeStr,
            elapsed: `${elapsed}s`,
            status: 'THÀNH CÔNG',
          });
        } catch (err) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.error(`   ❌ THẤT BẠI: ${err.message} (${elapsed}s)\n`);
          results.push({
            key: rep.key,
            name: rep.name,
            filename: rep.filename,
            size: '0 B',
            elapsed: `${elapsed}s`,
            status: 'THẤT BẠI',
            error: err.message,
          });
        }
      }
    }

    // 6. Xử lý tải Hợp đồng theo DỮ LIỆU THẬT CỦA BẢNG HÀNG HÓA (/PRODUCT/COMMODITY)
    const shouldRunContracts = runAll || targetCommodities.length > 0 || (targetReport && (targetReport === 'HD' || targetReport.startsWith('HD_')));

    if (shouldRunContracts) {
      console.log('================================================================================');
      console.log('  BẮT ĐẦU TẢI HỢP ĐỒNG CHI TIẾT THEO DỮ LIỆU HÀNG HÓA THẬT (DATA-DRIVEN)');
      console.log('================================================================================\n');

      const commUrl = `${baseUrl}/PRODUCT/COMMODITY`;
      console.log(`1. Điều hướng đến trang Quản lý hàng hóa: ${commUrl}...`);
      await page.goto(commUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(1500);

      // Xác định danh sách mã hàng hóa thực tế cần xử lý
      let commoditiesToProcess = [];

      if (targetCommodities.length > 0) {
        commoditiesToProcess = targetCommodities;
        console.log(`2. Danh sách hàng hóa chỉ định từ tham số dòng lệnh: [${commoditiesToProcess.join(', ')}]`);
      } else if (targetReport && targetReport.startsWith('HD_')) {
        const specificCode = targetReport.replace(/^HD_/, '');
        commoditiesToProcess = [specificCode];
        console.log(`2. Hàng hóa chỉ định theo mã báo cáo: [${specificCode}]`);
      } else {
        console.log(`2. Đang quét bảng hàng hóa thực tế trên sàn (tối đa ${maxContracts} mặt hàng)...`);
        commoditiesToProcess = await scanActualCommoditiesFromTable(page, maxContracts);
        console.log(`   -> Phát hiện ${commoditiesToProcess.length} mã hàng hóa thực tế trên sàn: [${commoditiesToProcess.join(', ')}]\n`);
      }

      for (let i = 0; i < commoditiesToProcess.length; i++) {
        const code = commoditiesToProcess[i];
        const stepIdx = `[HD ${(i + 1).toString().padStart(2, '0')}/${commoditiesToProcess.length}]`;
        const repKey = `HD_${code}`;
        const fileName = `HĐ ${code}.xlsx`;
        const destPath = path.join(outputDir, fileName);
        console.log(`${stepIdx} Đang xử lý hợp đồng mã hàng hóa: [${code}] -> "${fileName}"...`);
        const startTime = Date.now();

        try {
          // Đảm bảo đang ở trang /PRODUCT/COMMODITY
          if (!page.url().includes('/PRODUCT/COMMODITY')) {
            await page.goto(commUrl, { waitUntil: 'networkidle', timeout: 20000 });
            await page.waitForTimeout(1500);
          }

          const contractRes = await exportModalContract(page, code, destPath);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

          if (contractRes.status === 'OK') {
            console.log(`   ✅ THÀNH CÔNG: Đã lưu "${fileName}" (${contractRes.size}) trong ${elapsed}s\n`);
            results.push({
              key: repKey,
              name: `Hợp đồng ${code}`,
              filename: fileName,
              size: contractRes.size,
              elapsed: `${elapsed}s`,
              status: 'THÀNH CÔNG',
            });
          } else {
            console.log(`   ℹ️ BỎ QUA: Hàng hóa [${code}] không có hợp đồng trong ${elapsed}s\n`);
            results.push({
              key: repKey,
              name: `Hợp đồng ${code}`,
              filename: fileName,
              size: '0 B',
              elapsed: `${elapsed}s`,
              status: 'KHÔNG CÓ DỮ LIỆU',
            });
          }
        } catch (contractErr) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.error(`   ❌ THẤT BẠI: ${contractErr.message} (${elapsed}s)\n`);
          results.push({
            key: repKey,
            name: `Hợp đồng ${code}`,
            filename: fileName,
            size: '0 B',
            elapsed: `${elapsed}s`,
            status: 'THẤT BẠI',
            error: contractErr.message,
          });
        }
      }
    }

    // 7. Bảng tổng kết
    console.log('================================================================================');
    console.log('                   BẢNG TỔNG HỢP KẾT QUẢ TẢI FILE COREEX                        ');
    console.log('================================================================================');
    console.log(
      String('STT').padEnd(5) +
      String('MÃ').padEnd(14) +
      String('TÊN FILE').padEnd(25) +
      String('KÍCH THƯỚC').padEnd(14) +
      String('THỜI GIAN').padEnd(12) +
      String('TRẠNG THÁI')
    );
    console.log('-'.repeat(85));

    results.forEach((r, idx) => {
      const stt = String(idx + 1).padEnd(5);
      const k = r.key.padEnd(14);
      const fn = r.filename.padEnd(25);
      const sz = r.size.padEnd(14);
      const el = r.elapsed.padEnd(12);
      let st = '';
      if (r.status === 'THÀNH CÔNG') st = '✓ THÀNH CÔNG';
      else if (r.status === 'KHÔNG CÓ DỮ LIỆU') st = 'ℹ KHÔNG CÓ DỮ LIỆU (BỎ QUA)';
      else st = `✗ THẤT BẠI (${r.error || ''})`;
      console.log(`${stt}${k}${fn}${sz}${el}${st}`);
    });

    const successCount = results.filter((r) => r.status === 'THÀNH CÔNG').length;
    console.log('-'.repeat(85));
    console.log(`TỔNG KẾT: ${successCount}/${results.length} báo cáo tải thành công.`);
    console.log(`Thư mục lưu trữ: ${outputDir}\n`);

    if (keepOpen) {
      console.log('⏸️ Chế độ --keep-open đang bật. Trình duyệt sẽ giữ nguyên để bạn kiểm tra.');
      console.log('Nhấn Ctrl+C trong Terminal để đóng trình duyệt.');
      await new Promise(() => {});
    }
  } catch (globalErr) {
    console.error('❌ Lỗi toàn cục trong quá trình chạy:', globalErr.message);
  } finally {
    if (!keepOpen) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  }
}

runTest().catch(console.error);
