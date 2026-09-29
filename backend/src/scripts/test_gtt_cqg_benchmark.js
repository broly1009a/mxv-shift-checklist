/**
 * SCRIPT KIỂM THỬ THỰC TẾ & ĐO LƯỜNG HIỆU NĂNG LUỒNG GTT CQG
 * (GTT CQG BENCHMARK & REAL-WORLD PERFORMANCE EVALUATION)
 * 
 * Mục đích:
 * - Đánh giá thực tế bằng số liệu đo lường chính xác (Ground Truth), KHÔNG phỏng đoán suy diễn.
 * - So sánh trực tiếp:
 *   1. Trình duyệt Ephemeral (không cache) vs Persistent Profile (200MB cache + GPU flags).
 *   2. Chờ tĩnh (waitForTimeout 15-20s) vs Chờ động theo DOM (State-Driven Dynamic Wait).
 * - Chạy ĐỘC LẬP 100% (Standalone), không khởi động NestJS background crons.
 * 
 * Cách chạy trên Terminal:
 *   cd backend
 *   node src/scripts/test_gtt_cqg_benchmark.js --headed                 # Mặc định: Chạy chế độ TỐI ƯU (Profile + Chờ động)
 *   node src/scripts/test_gtt_cqg_benchmark.js --headed --legacy       # Chạy chế độ CŨ (Không cache + Chờ tĩnh 18s)
 *   node src/scripts/test_gtt_cqg_benchmark.js --headed --compare      # Chạy SO SÁNH cả 2 chế độ và in bảng Benchmark chi tiết
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const { performance } = require('perf_hooks');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// ── 1. Giải mã AES-256-CBC ──────────────────────────────────────────────────
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

// ── 2. Lấy thông tin tài khoản CQG từ MongoDB ──────────────────────────────
async function getCqgCredentials() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('Thiếu MONGODB_URI trong .env');
  await mongoose.connect(mongoUri);

  const setting = await mongoose.connection.collection('system_settings').findOne({
    key: 'bot_credentials_cqg',
  });

  let cqgUrl = 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  let cqgUser = process.env.CQG_USER || '';
  let cqgPass = process.env.CQG_PASSWORD || '';

  if (setting && setting.value) {
    try {
      const creds = JSON.parse(decrypt(setting.value));
      if (creds.urlPrice || creds.url) cqgUrl = creds.urlPrice || creds.url;
      if (creds.username) cqgUser = creds.username;
      if (creds.password) cqgPass = creds.password;
    } catch (err) {
      console.warn('Không thể giải mã credentials từ DB, dùng .env:', err.message);
    }
  }

  await mongoose.disconnect();
  return { cqgUrl, cqgUser, cqgPass };
}

// ── 3. Danh sách mã kiểm thử mẫu (Hàng hóa thanh khoản cao) ────────────────
const DEFAULT_TEST_SYMBOLS = ['ZCEZ26', 'ZLEZ26', 'CLEV26', 'QAF26', 'CAU26', 'KEEZ26', 'ZREZ26', 'ZSEZ26'];

// ── 4. Helper Chờ Spinner biến mất ─────────────────────────────────────────
async function waitForCqgNotLoading(page, timeoutMs = 30000) {
  const SPINNER_SELECTORS = [
    'mat-spinner',
    '.mat-mdc-progress-spinner',
    '.wpfe-loading-spinner',
    'div.wpfe-spinner',
    'div.loading-indicator',
    '.ag-overlay-loading-wrapper',
  ];
  const startTime = Date.now();
  for (const selector of SPINNER_SELECTORS) {
    try {
      const spinner = page.locator(selector).first();
      const isVisible = await spinner.isVisible({ timeout: 400 }).catch(() => false);
      if (isVisible) {
        const remainingTime = Math.max(1000, timeoutMs - (Date.now() - startTime));
        await spinner.waitFor({ state: 'hidden', timeout: remainingTime }).catch(() => {});
      }
    } catch {}
  }
}

// ── 5. Hàm chạy Benchmark luồng CQG GTT ─────────────────────────────────────
async function runGttBenchmark({ mode = 'OPTIMIZED', isHeaded = true, credentials, symbols }) {
  const isLegacy = mode === 'LEGACY';
  console.log(`\n========================================================================`);
  console.log(`🚀 BẮT ĐẦU CHẠY THỬ NGHIỆM: [${mode}]`);
  console.log(`- Trình duyệt : ${isLegacy ? 'EPHEMERAL (Không cache, không profile)' : 'PERSISTENT PROFILE (200MB cache + GPU flags)'}`);
  console.log(`- Cơ chế chờ  : ${isLegacy ? 'TĨNH (waitForTimeout cố định 18.5s)' : 'ĐỘNG (State-Driven Dynamic Wait)'}`);
  console.log(`- Số mã hàng  : ${symbols.length} mã (${symbols.join(', ')})`);
  console.log(`========================================================================\n`);

  const metrics = {
    mode,
    pageLoadMs: 0,
    spinnerDurationMs: 0,
    loginMs: 0,
    openWidgetMs: 0,
    loadSymbolsMs: 0,
    addColSMs: 0,
    scrapePricesMs: 0,
    totalDurationMs: 0,
    pricesCount: 0,
  };

  const totalStart = performance.now();
  let browser, context, page;

  const chromePathCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  let executablePath = chromePathCandidates.find((p) => fs.existsSync(p));

  const profileDir = path.join(__dirname, '..', '..', 'temp', 'cqg_profile_benchmark');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const commonArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
  ];

  const optimizedArgs = [
    ...commonArgs,
    '--disk-cache-size=209715200',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--enable-features=V8CodeCache,WebAssembly',
  ];

  const launchArgs = isLegacy ? commonArgs : optimizedArgs;

  try {
    // BƯỚC 1: KHỞI TẠO TRÌNH DUYỆT
    const browserStart = performance.now();
    if (isLegacy) {
      // Chế độ Cũ: Trình duyệt trắng hoàn toàn, không lưu cache đĩa
      browser = await chromium.launch({
        headless: !isHeaded,
        executablePath,
        args: launchArgs,
      });
      context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
      page = await context.newPage();
    } else {
      // Chế độ Tối ưu: Persistent Context với thư mục profile riêng
      context = await chromium.launchPersistentContext(profileDir, {
        headless: !isHeaded,
        executablePath,
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        args: launchArgs,
      });
      page = context.pages()[0] || (await context.newPage());
    }

    // BƯỚC 2: MỞ TRANG ĐĂNG NHẬP & ĐO THỜI GIAN SPINNER
    console.log(`[1/6] Đang điều hướng đến CQG Desktop: ${credentials.cqgUrl}...`);
    const pageOpenStart = performance.now();
    await page.goto(credentials.cqgUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    metrics.pageLoadMs = Math.round(performance.now() - pageOpenStart);

    console.log(`[2/6] Đang chờ Form đăng nhập (Đo thời gian quay spinner ban đầu)...`);
    const spinnerWaitStart = performance.now();
    const loginInput = await page.waitForSelector('input[name="userName"]', {
      state: 'visible',
      timeout: 25000,
    }).catch(() => null);

    metrics.spinnerDurationMs = Math.round(performance.now() - spinnerWaitStart);
    console.log(`⏱️ Thời gian kết thúc spinner & hiện Form đăng nhập: ${metrics.spinnerDurationMs} ms`);

    if (!loginInput) {
      console.warn('⚠️ Quá 25s chưa thấy form đăng nhập, thực hiện Reload (F5)...');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('input[name="userName"]', { state: 'visible', timeout: 20000 });
    }

    // BƯỚC 3: ĐĂNG NHẬP & CHỜ DASHBOARD
    console.log(`[3/6] Đang điền tài khoản: ${credentials.cqgUser}...`);
    const loginStart = performance.now();
    await page.fill('input[name="userName"]', credentials.cqgUser);
    await page.fill('input[name="password"]', credentials.cqgPass);
    await page.click('button[type="submit"]');

    await page.waitForSelector('div.wpfe-logo-image', { state: 'visible', timeout: 45000 });
    await waitForCqgNotLoading(page, 15000);
    if (isLegacy) {
      await page.waitForTimeout(3000); // Static sleep của bản cũ
    } else {
      await page.waitForSelector('.wpfe-add-widget-btn', { state: 'visible', timeout: 10000 }).catch(() => {});
    }
    metrics.loginMs = Math.round(performance.now() - loginStart);
    console.log(` Đăng nhập CQG thành công trong: ${metrics.loginMs} ms`);

    // BƯỚC 4: MỞ TAB QUOTE SPREADSHEET
    console.log(`[4/6] Mở tab Quote Spreadsheet...`);
    const widgetStart = performance.now();
    await page.waitForSelector('.wpfe-add-widget-btn', { state: 'visible', timeout: 15000 });
    await page.click('.wpfe-add-widget-btn');

    if (isLegacy) {
      await page.waitForTimeout(2000); // Static sleep dòng 1156
    } else {
      await page.waitForSelector('.wpfe-list-item:has-text("Quotes")', { state: 'visible', timeout: 5000 });
    }

    await page.click('.wpfe-list-item:has-text("Quotes")');

    if (isLegacy) {
      await page.waitForTimeout(1000); // Static sleep dòng 1164
    } else {
      await page.waitForSelector('[data-widgetclass="wpfe-QuoteSpreadSheet"]', { state: 'visible', timeout: 5000 });
    }

    await page.click('[data-widgetclass="wpfe-QuoteSpreadSheet"]');

    if (isLegacy) {
      await page.waitForTimeout(3000); // Static sleep dòng 1172
    } else {
      await page.waitForSelector('button:has-text("New list")', { state: 'visible', timeout: 8000 });
    }
    metrics.openWidgetMs = Math.round(performance.now() - widgetStart);
    console.log(`⏱️ Thời gian mở Widget Quote Spreadsheet: ${metrics.openWidgetMs} ms`);

    // BƯỚC 5: TẠO DANH SÁCH MÃ HÀNG
    console.log(`[5/6] Nhập danh sách ${symbols.length} mã hợp đồng...`);
    const symbolsStart = performance.now();
    await page.click('button:has-text("New list")');

    if (isLegacy) {
      await page.waitForTimeout(2000); // Static sleep dòng 1180
    } else {
      await page.waitForSelector('input[placeholder="Search symbols"]', { state: 'visible', timeout: 5000 });
    }

    await page.fill('input[placeholder="Search symbols"]', symbols.join(', '));

    if (isLegacy) {
      await page.waitForTimeout(1500); // Static sleep dòng 1189
    } else {
      await page.waitForSelector('button.wpfe-button-primary:has-text("OK"), button:has-text("OK")', { state: 'visible', timeout: 5000 });
    }

    const okBtn = page.locator('button.wpfe-button-primary:has-text("OK"), button:has-text("OK")').first();
    await okBtn.click();

    if (isLegacy) {
      await page.waitForTimeout(5000); // Static sleep dòng 1198
    } else {
      // Chờ bảng dữ liệu ag-grid hiển thị ít nhất 1 dòng mã
      await page.waitForSelector('.wpfe-qss-symbol-cell-primary-text, .ag-body-viewport', { state: 'visible', timeout: 10000 }).catch(() => {});
      await waitForCqgNotLoading(page, 5000);
    }
    metrics.loadSymbolsMs = Math.round(performance.now() - symbolsStart);
    console.log(`⏱️ Thời gian tải danh sách mã hàng: ${metrics.loadSymbolsMs} ms`);

    // BƯỚC 6: KIỂM TRA / THÊM CỘT S VÀ CÀO GIÁ
    console.log(`[6/6] Kiểm tra cột Settlement (S) và bóc tách giá...`);
    const scrapeStart = performance.now();

    // Check cột S
    const sColExists = await page.locator('[class*="column-header"]:has-text("S"), th:has-text("S")').isVisible({ timeout: 2000 }).catch(() => false);
    if (!sColExists) {
      console.log('Cột S chưa có, tiến hành thêm cột S...');
      const headerCell = page.locator('.ag-header-cell[col-id="symbol"], .ag-header-cell:has-text("Symbol")').first();
      await headerCell.click({ button: 'right' }).catch(() => {});
      if (isLegacy) await page.waitForTimeout(1000);

      const addColItem = page.locator('wpfe-dropdown-menu-item-text:has-text("Add columns")').first();
      if (await addColItem.isVisible({ timeout: 4000 }).catch(() => false)) {
        await addColItem.click();
        if (isLegacy) await page.waitForTimeout(1500);

        const filterInput = page.locator('.wpfe-column-picker-dialog-search-input input[placeholder="Type to filter"]').first();
        if (await filterInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await filterInput.fill('Settlement');
          if (isLegacy) await page.waitForTimeout(1000);

          const sItem = page.locator('.wpfe-list-item-content:has-text("Last settlement"), .wpfe-list-item-name-content:has-text("S")').first();
          if (await sItem.isVisible({ timeout: 4000 }).catch(() => false)) {
            await sItem.click();
          }
        }
      }
    } else {
      console.log('Cột S đã tồn tại sẵn trên widget.');
    }

    // Cào giá từ ag-grid
    const parsedPrices = await page.evaluate(() => {
      const results = {};
      const symbolRows = document.querySelectorAll('.ag-pinned-left-cols-container [role="row"]');
      symbolRows.forEach((row) => {
        const rowId = row.getAttribute('row-id');
        const symbolEl = row.querySelector('.wpfe-qss-symbol-cell-primary-text');
        if (symbolEl && rowId) {
          const symbol = symbolEl.textContent.trim().split(/\s+/)[0];
          const settleRow = document.querySelector(`.ag-center-cols-container [row-id="${rowId}"]`);
          if (settleRow) {
            const priceEl = settleRow.querySelector('[col-id="settle"] .wpfe-price, [col-id="settle"]');
            if (priceEl) {
              results[symbol] = priceEl.textContent.trim();
            }
          }
        }
      });
      return results;
    });

    metrics.scrapePricesMs = Math.round(performance.now() - scrapeStart);
    metrics.pricesCount = Object.keys(parsedPrices).length;
    console.log(` Đã bóc tách được ${metrics.pricesCount} giá hợp đồng:`, parsedPrices);

    // Đóng tab Quote Spreadsheet để dọn dẹp
    try {
      const closeBtn = page.locator('//div[contains(@class, "wpfe-tab-header-active")]//button[contains(@class, "wpfe-widget-tab-header-close-button")]').first();
      if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await closeBtn.click({ force: true });
        console.log(' Đã đóng tab Quote Spreadsheet.');
      }
    } catch {}

  } finally {
    metrics.totalDurationMs = Math.round(performance.now() - totalStart);
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  return metrics;
}

// ── 6. Main Orchestrator ───────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');
  const isCompare = args.includes('--compare');
  const isLegacyOnly = args.includes('--legacy');

  console.log('========================================================================');
  console.log('  TEST ĐÁNH GIÁ THỰC TẾ HIỆU NĂNG LUỒNG GTT CQG (STANDALONE BENCHMARK)');
  console.log('========================================================================');

  console.log('1. Đang lấy cấu hình CQG từ MongoDB...');
  const credentials = await getCqgCredentials();
  console.log(`- CQG URL   : ${credentials.cqgUrl}`);
  console.log(`- Tài khoản : ${credentials.cqgUser}`);

  if (isCompare) {
    console.log('\n⚡ CHẾ ĐỘ SO SÁNH (COMPARE): Sẽ lần lượt chạy cả 2 chế độ để đo lường chính xác.');
    
    // Lần 1: Chế độ cũ (Legacy)
    const legacyMetrics = await runGttBenchmark({
      mode: 'LEGACY',
      isHeaded,
      credentials,
      symbols: DEFAULT_TEST_SYMBOLS,
    });

    console.log('\nNghỉ 3 giây trước khi chạy chế độ Tối ưu...');
    await new Promise((r) => setTimeout(r, 3000));

    // Lần 2: Chế độ mới (Optimized)
    const optMetrics = await runGttBenchmark({
      mode: 'OPTIMIZED',
      isHeaded,
      credentials,
      symbols: DEFAULT_TEST_SYMBOLS,
    });

    // BẢNG TỔNG KẾT BENCHMARK
    console.log('\n========================================================================');
    console.log('               BẢNG SO SÁNH HIỆU NĂNG THỰC TẾ (BENCHMARK RESULTS)');
    console.log('========================================================================');
    
    const comparisonTable = [
      {
        'Giai đoạn thực thi': '1. Nạp HTML & Bundle ban đầu',
        'Bản Cũ (Legacy)': `${legacyMetrics.pageLoadMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.pageLoadMs} ms`,
        'Chênh lệch': `${legacyMetrics.pageLoadMs - optMetrics.pageLoadMs > 0 ? '-' : '+'}${Math.abs(legacyMetrics.pageLoadMs - optMetrics.pageLoadMs)} ms`,
      },
      {
        'Giai đoạn thực thi': '2. Chờ Spinner kết thúc (Form đăng nhập)',
        'Bản Cũ (Legacy)': `${legacyMetrics.spinnerDurationMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.spinnerDurationMs} ms`,
        'Chênh lệch': `${legacyMetrics.spinnerDurationMs - optMetrics.spinnerDurationMs > 0 ? 'Nhanh hơn ' : 'Chậm hơn '}${Math.abs(legacyMetrics.spinnerDurationMs - optMetrics.spinnerDurationMs)} ms`,
      },
      {
        'Giai đoạn thực thi': '3. Đăng nhập & Nạp Dashboard',
        'Bản Cũ (Legacy)': `${legacyMetrics.loginMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.loginMs} ms`,
        'Chênh lệch': `${legacyMetrics.loginMs - optMetrics.loginMs > 0 ? 'Nhanh hơn ' : 'Chậm hơn '}${Math.abs(legacyMetrics.loginMs - optMetrics.loginMs)} ms`,
      },
      {
        'Giai đoạn thực thi': '4. Mở tab Quote Spreadsheet',
        'Bản Cũ (Legacy)': `${legacyMetrics.openWidgetMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.openWidgetMs} ms`,
        'Chênh lệch': `Tiết kiệm ${legacyMetrics.openWidgetMs - optMetrics.openWidgetMs} ms`,
      },
      {
        'Giai đoạn thực thi': '5. Tải danh sách mã hàng',
        'Bản Cũ (Legacy)': `${legacyMetrics.loadSymbolsMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.loadSymbolsMs} ms`,
        'Chênh lệch': `Tiết kiệm ${legacyMetrics.loadSymbolsMs - optMetrics.loadSymbolsMs} ms`,
      },
      {
        'Giai đoạn thực thi': '6. Cào giá hợp đồng (ag-grid)',
        'Bản Cũ (Legacy)': `${legacyMetrics.scrapePricesMs} ms`,
        'Bản Mới (Tối ưu)': `${optMetrics.scrapePricesMs} ms`,
        'Chênh lệch': `${optMetrics.scrapePricesMs} ms (${optMetrics.pricesCount} mã)`,
      },
      {
        'Giai đoạn thực thi': '★ TỔNG THỜI GIAN HOÀN TẤT',
        'Bản Cũ (Legacy)': `${(legacyMetrics.totalDurationMs / 1000).toFixed(1)} giây`,
        'Bản Mới (Tối ưu)': `${(optMetrics.totalDurationMs / 1000).toFixed(1)} giây`,
        'Chênh lệch': `Rút ngắn ${( (legacyMetrics.totalDurationMs - optMetrics.totalDurationMs) / 1000 ).toFixed(1)} giây (${Math.round((1 - optMetrics.totalDurationMs / legacyMetrics.totalDurationMs) * 100)}%)`,
      },
    ];

    console.table(comparisonTable);

  } else {
    const mode = isLegacyOnly ? 'LEGACY' : 'OPTIMIZED';
    const result = await runGttBenchmark({
      mode,
      isHeaded,
      credentials,
      symbols: DEFAULT_TEST_SYMBOLS,
    });

    console.log('\n========================================================================');
    console.log(`                     KẾT QUẢ ĐO LƯỜNG: [${mode}]`);
    console.log('========================================================================');
    console.log(`- Thời gian nạp trang          : ${result.pageLoadMs} ms`);
    console.log(`- Thời gian quay spinner       : ${result.spinnerDurationMs} ms`);
    console.log(`- Thời gian đăng nhập          : ${result.loginMs} ms`);
    console.log(`- Thời gian mở Quote Widget    : ${result.openWidgetMs} ms`);
    console.log(`- Thời gian tải danh sách mã   : ${result.loadSymbolsMs} ms`);
    console.log(`- Thời gian cào giá            : ${result.scrapePricesMs} ms (Đọc được: ${result.pricesCount} mã)`);
    console.log(`- TỔNG THỜI GIAN THỰC THI      : ${(result.totalDurationMs / 1000).toFixed(1)} giây`);
    console.log('========================================================================\n');
  }
}

main().catch((err) => {
  console.error('\n❌ Lỗi thực thi kiểm thử:', err.message);
  process.exit(1);
});
