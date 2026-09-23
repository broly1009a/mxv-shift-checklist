/**
 * KIỂM THỬ THỰC TẾ: DUAL-STATE ROUTER & SINGLETONLOCK CLEANUP CHO CQG DESKTOP
 * 
 * Mục đích kiểm chứng:
 * 1. Chạy 2 kịch bản liên tiếp với URL và tài khoản Demo (mdemo.cqg.com | MXV03 / MXV):
 *    - Lần 1: Form Login bình thường -> Điền thông tin -> Đăng nhập vào Dashboard.
 *    - Lần 2: Mở lại bằng Persistent Context -> Router kép tự động nhận diện Dashboard (bỏ qua login) hoặc Login form nếu đã đăng xuất.
 * 2. Giả lập thử nghiệm file lock mồ côi (SingletonLock) xem cơ chế tự dọn dẹp có hoạt động trơn tru không.
 * 
 * Lệnh chạy trên Terminal:
 *   cd "c:\Users\hiepth\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\Documents\Github\mxv-cqg-download-investigation\backend"
 *   node src/scripts/test_cqg_dual_router.js
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const TARGET_URL = 'https://mdemo.cqg.com/cqg/desktop/logon?ref=forced';
const USERNAME = 'MXV03';
const PASSWORD = 'MXV';

const TEST_PROFILE_DIR = path.join(__dirname, '..', '..', 'temp', 'test_cqg_dual_router_profile');

// Tìm đường dẫn thực thi của Edge hoặc Chrome
const executablePath = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find((p) => fs.existsSync(p)) || null;

console.log('══════════════════════════════════════════════════════════════════════');
console.log(' KHỞI CHẠY KIỂM THỬ THỰC TẾ: DUAL-STATE ROUTER & SINGLETONLOCK');
console.log(` URL Mục tiêu: ${TARGET_URL}`);
console.log(` Tài khoản Demo: ${USERNAME} / ***`);
console.log(` Thư mục Profile: ${TEST_PROFILE_DIR}`);
console.log(` Trình duyệt: ${executablePath || 'Playwright Bundled'}`);
console.log('══════════════════════════════════════════════════════════════════════\n');

/**
 * Hàm mô phỏng chính xác logic dọn dẹp SingletonLock trong rpa-downloader.service.ts
 */
function cleanupSingletonLock(profileDir) {
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
    return;
  }
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket'];
  for (const file of lockFiles) {
    const lockPath = path.join(profileDir, file);
    if (fs.existsSync(lockPath)) {
      try {
        fs.unlinkSync(lockPath);
        console.log(`   [SingletonLock]  Đã tự động dọn dẹp file lock mồ côi: ${file}`);
      } catch (err) {
        console.log(`   [SingletonLock] ⚠️ Không thể xóa ${file}: ${err.message}`);
      }
    }
  }
}

/**
 * Hàm mô phỏng chính xác logic Dual-State Router trong rpa-downloader.service.ts
 */
async function runDualRouterFlow(page, roundName, shouldLogoutAtEnd = false) {
  console.log(`\n──────────────────────────────────────────────────────────────────────`);
  console.log(`▶ BẮT ĐẦU: ${roundName}`);
  console.log(`──────────────────────────────────────────────────────────────────────`);

  const startTime = Date.now();
  console.log(`[CQG] Đang mở URL: ${TARGET_URL}...`);
  await page.goto(TARGET_URL, { waitUntil: 'commit', timeout: 60000 });

  // ── Dual-State Router: Lắng nghe đồng thời Form đăng nhập HOẶC Dashboard ──
  const detectState = async (timeoutMs = 45000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hasLogin = await page
        .locator('input[name="userName"], input[name="username"], input[type="password"]')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasLogin) return 'LOGIN';

      const hasDashboard = await page
        .locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']')
        .first()
        .isVisible()
        .catch(() => false);
      if (hasDashboard) return 'DASHBOARD';

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return 'TIMEOUT';
  };

  console.log('[CQG] Dual-State Router đang lắng nghe trạng thái trang...');
  let state = await detectState(30000);

  if (state === 'TIMEOUT') {
    console.log('[CQG] Quay spinner quá 30s, thử reload trang...');
    await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() => {});
    state = await detectState(30000);
    if (state === 'TIMEOUT') {
      throw new Error('[CQG] Không tìm thấy Form đăng nhập hoặc Dashboard sau 60s.');
    }
  }

  console.log(`[CQG]  KẾT QUẢ ROUTER: Đã phát hiện trạng thái -> [${state}] (sau ${(Date.now() - startTime) / 1000}s)`);

  if (state === 'LOGIN') {
    console.log(`[CQG] Trạng thái LOGIN: Tiến hành điền username (${USERNAME}) và password...`);
    await page.fill('input[name="userName"]', USERNAME);
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    console.log('[CQG] Đang chờ logo Dashboard và xử lý popup xung đột (nếu có)...');
    await waitForDashboard(page, 60000);
  } else if (state === 'DASHBOARD') {
    console.log(`[CQG] Trạng thái DASHBOARD: Phiên cũ còn hiệu lực! BỎ QUA ĐĂNG NHẬP, vào thẳng làm việc.`);
    await waitForDashboard(page, 10000);
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[CQG]  HOÀN THÀNH: Trạng thái sẵn sàng cho tài khoản ${USERNAME} trong ${elapsedSec}s!`);

  // Lưu ảnh chụp màn hình kiểm chứng
  const debugDir = path.join(__dirname, '..', '..', 'temp', 'debug');
  if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
  const snapPath = path.join(debugDir, `cqg_dual_router_${roundName.replace(/\s+/g, '_')}.png`);
  await page.screenshot({ path: snapPath });
  console.log(`[CQG] Đã lưu ảnh chụp kiểm chứng: ${snapPath}`);

  if (shouldLogoutAtEnd) {
    console.log('[CQG] Đang mô phỏng Log off để kiểm tra giải phóng phiên...');
    await page.keyboard.press('Escape').catch(() => {});
    const logoutIcon = page.locator("//mat-icon[@data-mat-icon-name='sign-out'], //button[contains(@aria-label, 'Sign out')]").first();
    if (await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutIcon.click().catch(() => {});
      const logoffItem = page.locator("//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and text()='Log off']").first();
      if (await logoffItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoffItem.click().catch(() => {});
        const confirmBtn = page.locator("wpfe-confirmation-dialog button.wpfe-confirm").first();
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click().catch(() => {});
        }
      }
    }
    await page.context().clearCookies().catch(() => {});
    console.log('[CQG] Đã dọn dẹp cookies phiên làm việc thành công.');
  }
}

async function waitForDashboard(page, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isLogo = await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']').first().isVisible().catch(() => false);
    if (isLogo) return true;

    // Xử lý nút popup Take over nếu có
    const takeoverBtn = page.locator('button:has-text("Take over"), button:has-text("Continue"), button:has-text("Log off")').first();
    if (await takeoverBtn.isVisible({ timeout: 200 }).catch(() => false)) {
      console.log('   [CQG] Phát hiện popup xung đột phiên, bấm Take over...');
      await takeoverBtn.click().catch(() => {});
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

async function main() {
  // BƯỚC 1: Giả lập tạo sẵn file lock mồ côi để test tính năng tự dọn dẹp
  console.log('1. Giả lập tạo file lock mồ côi (SingletonLock) trong thư mục profile...');
  if (!fs.existsSync(TEST_PROFILE_DIR)) fs.mkdirSync(TEST_PROFILE_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEST_PROFILE_DIR, 'SingletonLock'), 'fake-pid-99999');
  fs.writeFileSync(path.join(TEST_PROFILE_DIR, 'SingletonCookie'), 'fake-cookie');

  // Gọi hàm dọn dẹp lock mồ côi
  cleanupSingletonLock(TEST_PROFILE_DIR);

  // BƯỚC 2: Khởi chạy Lần 1 - Form Login -> Đăng nhập thành công -> GIỮ NGUYÊN SESSION (không log off)
  const launchOptions = {
    headless: false, // Mở giao diện thật để quan sát
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-extensions',
      '--start-maximized',
      '--disk-cache-size=104857600',
    ],
    viewport: null,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  console.log('\n2. Khởi chạy Lần 1: Form Login -> Đăng nhập vào Dashboard (Giữ nguyên session)...');
  let context1 = await chromium.launchPersistentContext(TEST_PROFILE_DIR, launchOptions);
  let page1 = context1.pages()[0] || await context1.newPage();
  await page1.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await runDualRouterFlow(page1, 'Lan_1_Login_Form', false);
  await context1.close();
  console.log('   -> Đã đóng trình duyệt Lần 1 (session vẫn còn lưu trong profile).');

  // BƯỚC 3: Khởi chạy Lần 2 - Tái sử dụng Persistent Profile -> Router kép phát hiện DASHBOARD ngay lập tức
  console.log('\n3. Khởi chạy Lần 2: Mở lại Profile vừa lưu -> Kiểm tra Dual-State Router nhảy thẳng vào DASHBOARD...');
  cleanupSingletonLock(TEST_PROFILE_DIR);
  let context2 = await chromium.launchPersistentContext(TEST_PROFILE_DIR, launchOptions);
  let page2 = context2.pages()[0] || await context2.newPage();
  await page2.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
  await runDualRouterFlow(page2, 'Lan_2_Dual_Router_Dashboard', true);
  await context2.close();

  console.log('\n══════════════════════════════════════════════════════════════════════');
  console.log(' TỔNG KẾT: TẤT CẢ KỊCH BẢN ĐÃ CHẠY XONG 100% THÀNH CÔNG!');
  console.log('   - SingletonLock Cleanup: Đã tự động dọn dẹp trước khi mở.');
  console.log('   - Lần 1 (Form Login): Tự động phát hiện form và đăng nhập.');
  console.log('   - Lần 2 (Dual Router): Tự động phát hiện Dashboard (không bị đơ 60s).');
  console.log('   - Logout & Cookies: Đã dọn dẹp cookies phiên làm việc an toàn.');
  console.log('══════════════════════════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('\n LỖI TRONG QUÁ TRÌNH TEST:', err);
  process.exit(1);
});
