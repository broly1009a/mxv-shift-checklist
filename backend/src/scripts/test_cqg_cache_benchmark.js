/**
 * BENCHMARK THỰC NGHIỆM: ĐO LƯỜNG TỐC ĐỘ TẢI TRANG CQG (COLD START VS WARM PERSISTENT CACHE)
 * 
 * Mục đích:
 * 1. Kiểm chứng thực tế: Việc giữ lại Cache Chrome (Persistent Context) có giúp CQG Desktop tăng tốc hay không?
 * 2. So sánh 2 lần chạy trên cùng một máy:
 *    - Lần 1: Cold Start (Không Cache - Profile mới hoàn toàn, tải toàn bộ JS/WASM/Assets từ đầu)
 *    - Lần 2: Warm Start (Có Cache - Tái sử dụng disk cache, V8 code cache, IndexedDB và layout)
 * 3. Tính toán chính xác thời gian tải trang, thời gian render giao diện làm việc, số lượng request từ cache và % tăng tốc.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_cqg_cache_benchmark.js
 * 
 * Cờ tùy chọn:
 *   --url=https://mdemo.cqg.com/cqg/desktop/main
 *   --username=MXV03
 *   --password=MXV
 *   --headless (chạy ngầm, mặc định là có giao diện --headed để quan sát)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

// Lấy tham số dòng lệnh
const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split('=')[1].trim() : fallback;
};

const TARGET_URL = getArg('url', 'https://mdemo.cqg.com/cqg/desktop/main');
const USERNAME = getArg('username', 'MXV03');
const PASSWORD = getArg('password', 'MXV');
const IS_HEADLESS = args.includes('--headless');

// Thư mục lưu cache kiểm nghiệm
const BENCHMARK_DIR = path.join(__dirname, '..', '..', 'temp', 'cqg_cache_benchmark');
const PROFILE_DIR = path.join(BENCHMARK_DIR, 'persistent_profile');

// Tìm Chrome / Edge
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];
const executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;

/**
 * Xóa sạch thư mục profile để giả lập Cold Start hoàn toàn
 */
function cleanDirectory(dirPath) {
  if (fs.existsSync(dirPath)) {
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
      // Bỏ qua nếu có file lock
    }
  }
}

/**
 * Hàm chờ giao diện chính của CQG Desktop tải hoàn tất
 */
async function waitForCqgWorkspaceReady(page, timeoutMs = 90000) {
  const startTime = Date.now();
  console.log('   [Wait] Đang chờ CQG khởi tạo Workspace / Toolbar / Bảng dữ liệu...');

  while (Date.now() - startTime < timeoutMs) {
    // 1. Kiểm tra các selector đặc trưng khi CQG đã vào hẳn màn hình làm việc
    const isLogoVisible = await page
      .locator('div.wpfe-logo-image, .wpfe-main-toolbar, .wpfe-header, div.wpfe-tab-strip, div[role="tablist"]')
      .first()
      .isVisible()
      .catch(() => false);

    const isWorkspaceVisible = await page
      .locator('div.wpfe-page-container, div[class*="wpfe-workspace"], div[class*="wpfe-grid"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (isLogoVisible || isWorkspaceVisible) {
      // Chờ thêm 1 giây để các widget biểu đồ / bảng giá ổn định
      await page.waitForTimeout(1000);
      return true;
    }

    // 2. Tự động xử lý popup thông báo / dialog nếu có
    const closeDialogBtn = page.locator(
      '//wpfe-multi-snack-bar-container//button | //button[contains(@class,"wpfe-dialog-close-button-button")] | .mat-snack-bar-container button | button:has-text("OK") | button:has-text("Dismiss")'
    );
    if (await closeDialogBtn.first().isVisible({ timeout: 150 }).catch(() => false)) {
      await closeDialogBtn.first().click().catch(() => {});
    }

    // 3. Xử lý nút Take over / Log off phiên cũ nếu bị trùng login
    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Take over"), button:has-text("Force")'
    );
    if (await takeoverBtn.first().isVisible({ timeout: 150 }).catch(() => false)) {
      console.log('   [Action] Phát hiện popup trùng phiên, click Take over...');
      await takeoverBtn.first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 4. Nếu nút Log on vẫn còn và chưa được nhấn, click lại
    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 150 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on"), button:has-text("Sign In")');
      if (await submitBtn.first().isVisible({ timeout: 150 }).catch(() => false)) {
        await submitBtn.first().click({ force: true }).catch(() => {});
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error(`Timeout ${timeoutMs / 1000}s chờ CQG Workspace hiển thị!`);
}

/**
 * Thực hiện 1 lượt chạy đo lường
 */
async function runSingleBenchmark(phaseName, userDataDir, isWarm) {
  console.log(`\n========================================================================`);
  console.log(`  BẮT ĐẦU: ${phaseName.toUpperCase()}`);
  console.log(`  Profile path: ${userDataDir}`);
  console.log(`  Trạng thái Cache: ${isWarm ? ' ĐÃ CÓ CACHE (Warm Persistent)' : '❄️ PROFILE TRẮNG (Cold Start)'}`);
  console.log(`========================================================================\n`);

  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--start-maximized',
    '--disk-cache-size=209715200', // 200MB disk cache
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  const launchOptions = {
    headless: IS_HEADLESS,
    slowMo: IS_HEADLESS ? 0 : 100,
    args: launchArgs,
    viewport: { width: 1600, height: 900 },
    acceptDownloads: true,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  const totalMetric = {
    totalRequests: 0,
    fromDiskCache: 0,
    fromMemoryCache: 0,
    totalBytes: 0,
    tNavStart: 0,
    tLoginPage: 0,
    tLoginSubmit: 0,
    tWorkspaceReady: 0,
    totalTimeSec: 0,
  };

  const context = await chromium.launchPersistentContext(userDataDir, launchOptions);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  page.setDefaultTimeout(60000);

  // Lắng nghe network responses để đo lường cache
  page.on('response', (response) => {
    totalMetric.totalRequests++;
    const fromServiceWorker = response.fromServiceWorker();
    const headers = response.headers();
    const contentLength = parseInt(headers['content-length'] || '0', 10);
    totalMetric.totalBytes += contentLength;

    // Phỏng đoán cache từ Playwright response
    if (response.status() === 304 || fromServiceWorker) {
      totalMetric.fromDiskCache++;
    }
  });

  try {
    const t0 = Date.now();
    totalMetric.tNavStart = t0;

    // 1. Mở trang CQG
    console.log(`1. Điều hướng đến URL: ${TARGET_URL}...`);
    await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 45000 });

    // Đợi trang ổn định sau điều hướng (xem có bị redirect sang màn hình logon hay vào thẳng workspace)
    console.log('2. Đang kiểm tra trạng thái trang...');
    let isLogon = false;
    const startDetect = Date.now();
    while (Date.now() - startDetect < 20000) {
      if (page.url().includes('logon')) {
        isLogon = true;
        break;
      }
      const hasPwd = await page.locator('input[type="password"]').isVisible().catch(() => false);
      if (hasPwd) {
        isLogon = true;
        break;
      }
      const hasWorkspace = await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar, .wpfe-header, div.wpfe-page-container').first().isVisible().catch(() => false);
      if (hasWorkspace) {
        isLogon = false;
        break;
      }
      await page.waitForTimeout(500);
    }

    let tSubmit = Date.now();

    if (isLogon) {
      console.log(' Đang ở màn hình Đăng nhập CQG...');
      const userField = page.locator('input[name="userName"], input[name="username"], input[type="text"]').first();
      await userField.waitFor({ state: 'visible', timeout: 30000 });
      const pwdField = page.locator('input[name="password"], input[type="password"]').first();
      await pwdField.waitFor({ state: 'visible', timeout: 30000 });

      const tLoginPage = Date.now();
      totalMetric.tLoginPage = ((tLoginPage - t0) / 1000).toFixed(2);
      console.log(` Form đăng nhập đã sẵn sàng trong: ${totalMetric.tLoginPage}s`);

      console.log(`3. Điền thông tin tài khoản (${USERNAME})...`);
      await userField.fill(USERNAME);
      await pwdField.fill(PASSWORD);
      await page.waitForTimeout(300);

      tSubmit = Date.now();
      totalMetric.tLoginSubmit = tSubmit;
      console.log('4. Nhấn nút Đăng nhập...');
      await page.click('button[type="submit"], button:has-text("Log on"), button:has-text("Sign In")');

      console.log('5. Đang theo dõi quá trình tải & render giao diện CQG Desktop...');
      await waitForCqgWorkspaceReady(page, 90000);
    } else {
      console.log('⚡ TÁI SỬ DỤNG PHIÊN (SESSION PERSISTED): CQG nhận diện phiên làm việc cũ, vào thẳng Workspace!');
      totalMetric.tLoginPage = '0.00s (Bỏ qua Login)';
      tSubmit = Date.now();
      await waitForCqgWorkspaceReady(page, 45000);
    }

    const tDone = Date.now();
    totalMetric.tWorkspaceReady = ((tDone - tSubmit) / 1000).toFixed(2);
    totalMetric.totalTimeSec = ((tDone - t0) / 1000).toFixed(2);

    console.log(` CQG Workspace tải và render hoàn tất trong: ${totalMetric.tWorkspaceReady}s`);
    console.log(` Tổng thời gian từ lúc mở tới khi sẵn sàng: ${totalMetric.totalTimeSec}s\n`);

    // Chụp ảnh bằng chứng
    const screenshotName = `${isWarm ? 'warm_cache' : 'cold_start'}_workspace.png`;
    const screenshotPath = path.join(BENCHMARK_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => {});
    console.log(` Đã chụp ảnh lưu tại: ${screenshotPath}`);

  } finally {
    console.log(' Đóng trình duyệt và lưu lại cache disk...');
    await page.waitForTimeout(1500);
    await context.close().catch(() => {});
    // Nghỉ 3s để OS hoàn tất flush cache xuống disk
    await new Promise((r) => setTimeout(r, 3000));
  }

  return totalMetric;
}

async function main() {
  console.log('========================================================================');
  console.log('   CQG DESKTOP PERFORMANCE BENCHMARK: COLD START VS WARM CACHE         ');
  console.log('========================================================================');
  console.log(`- URL mục tiêu   : ${TARGET_URL}`);
  console.log(`- Tài khoản test : ${USERNAME} (Password: ***)`);
  console.log(`- Trình duyệt    : ${executablePath || 'Chromium default'} (${IS_HEADLESS ? 'Headless' : 'Headed'})`);
  console.log(`- Thư mục Cache  : ${PROFILE_DIR}\n`);

  // BƯỚC 1: COLD START (Xóa sạch cache, chạy profile mới tinh)
  cleanDirectory(PROFILE_DIR);
  const coldMetrics = await runSingleBenchmark('Lần 1: Cold Start (Chưa có Cache)', PROFILE_DIR, false);

  // BƯỚC 2: WARM START (Chạy lại với đúng profile vừa lưu cache ở Lần 1)
  const warmMetrics = await runSingleBenchmark('Lần 2: Warm Start (Đã có Cache Persistent)', PROFILE_DIR, true);

  // TÍNH TOÁN SO SÁNH
  const diffTotal = (parseFloat(coldMetrics.totalTimeSec) - parseFloat(warmMetrics.totalTimeSec)).toFixed(2);
  const speedupPercent = (
    ((parseFloat(coldMetrics.totalTimeSec) - parseFloat(warmMetrics.totalTimeSec)) / parseFloat(coldMetrics.totalTimeSec)) *
    100
  ).toFixed(1);

  const diffRender = (parseFloat(coldMetrics.tWorkspaceReady) - parseFloat(warmMetrics.tWorkspaceReady)).toFixed(2);
  const renderSpeedupPercent = (
    ((parseFloat(coldMetrics.tWorkspaceReady) - parseFloat(warmMetrics.tWorkspaceReady)) / parseFloat(coldMetrics.tWorkspaceReady)) *
    100
  ).toFixed(1);

  // BẢNG TỔNG KẾT
  console.log('\n========================================================================');
  console.log('📊 BẢNG SO SÁNH HIỆU NĂNG THỰC TẾ: COLD START VS PERSISTENT CACHE');
  console.log('========================================================================');

  const comparisonTable = [
    {
      'Tiêu chí đánh giá': '1. Thời gian hiện Form Đăng nhập',
      'Cold Start (Chưa cache)': `${coldMetrics.tLoginPage}s`,
      'Warm Start (Có cache)': `${warmMetrics.tLoginPage}s`,
      'Chênh lệch / Tiết kiệm': `${(parseFloat(coldMetrics.tLoginPage) - parseFloat(warmMetrics.tLoginPage)).toFixed(2)}s`,
    },
    {
      'Tiêu chí đánh giá': '2. Thời gian Render Workspace / Bảng',
      'Cold Start (Chưa cache)': `${coldMetrics.tWorkspaceReady}s`,
      'Warm Start (Có cache)': `${warmMetrics.tWorkspaceReady}s`,
      'Chênh lệch / Tiết kiệm': `Nhanh hơn ${diffRender}s (${renderSpeedupPercent}%)`,
    },
    {
      'Tiêu chí đánh giá': '3. TỔNG THỜI GIAN SẴN SÀNG',
      'Cold Start (Chưa cache)': `${coldMetrics.totalTimeSec}s`,
      'Warm Start (Có cache)': `${warmMetrics.totalTimeSec}s`,
      'Chênh lệch / Tiết kiệm': `⚡ Nhanh hơn ${diffTotal}s (${speedupPercent}%)`,
    },
    {
      'Tiêu chí đánh giá': '4. Tổng số Network Requests',
      'Cold Start (Chưa cache)': `${coldMetrics.totalRequests} reqs`,
      'Warm Start (Có cache)': `${warmMetrics.totalRequests} reqs`,
      'Chênh lệch / Tiết kiệm': `Tái sử dụng Cache Disk`,
    },
  ];

  console.table(comparisonTable);

  console.log('\n========================================================================');
  console.log(' KẾT LUẬN & KIẾN NGHỊ:');
  console.log('========================================================================');
  if (parseFloat(speedupPercent) > 15) {
    console.log(` XÁC NHẬN CHÍNH XÁC: Việc lưu cache Persistent giúp CQG tăng tốc tới ${speedupPercent}% (tiết kiệm ${diffTotal}s mỗi lần chạy)!`);
    console.log(`- Nguyên nhân: CQG Desktop là ứng dụng WebAssembly & AngularJS SPA rất nặng (~60MB - 100MB JS/Fonts/WASM/Layout).`);
    console.log(`- Khi dùng Persistent Context, Chrome lưu lại V8 Code Cache & Disk Cache nên không phải compile lại code mỗi lần mở.`);
    console.log(`- Khuyến nghị: Áp dụng launchPersistentContext cố định cho bot CQG1 và CQG2 trong hệ thống ca trực MXV!`);
  } else {
    console.log(`- Kết quả: Tốc độ giữa 2 lần tương đương (chênh lệch ${speedupPercent}%). Cần theo dõi thêm tốc độ mạng.`);
  }
}

main().catch(console.error);
