/**
 * TEST ĐO ĐẠC CHÍNH XÁC TỐC ĐỘ TẢI TRANG CQG DESKTOP
 * So sánh trực tiếp: Cờ Hiện Tại vs Cờ Tối Ưu (Tắt GPU, V8 512MB)
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

function getChromeExecutablePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  if (process.platform === 'win32') {
    const paths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    ];
    for (const p of paths) if (fs.existsSync(p)) return p;
  }
  return undefined;
}

const cqgUrl = 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
const executablePath = getChromeExecutablePath();
const baseTemp = path.join(process.cwd(), 'temp', 'speed_test');

async function measureCqgSpeed(name, flags, profileDir) {
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const startLaunch = Date.now();
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    executablePath,
    args: flags,
  });
  const launchDuration = Date.now() - startLaunch;

  const page = context.pages()[0] || await context.newPage();
  
  const startNav = Date.now();
  let commitTime = 0;
  let domTime = 0;
  let formReadyTime = 0;

  try {
    await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 45000 });
    commitTime = Date.now() - startNav;

    // Chờ DOMContentLoaded
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});
    domTime = Date.now() - startNav;

    // Chờ form đăng nhập hoặc dashboard hiển thị (chính là logic detectState trong rpa-scraper.service.ts)
    const formInput = page.locator('input[name="userName"], input[name="username"], input[type="password"], div.wpfe-logo-image').first();
    await formInput.waitFor({ state: 'visible', timeout: 30000 });
    formReadyTime = Date.now() - startNav;
  } catch (err) {
    console.log(`[${name}] Gặp lỗi khi chờ: ${err.message}`);
  } finally {
    await context.close().catch(() => {});
  }

  return {
    launchDuration,
    commitTime,
    domTime,
    formReadyTime,
  };
}

async function main() {
  console.log('================================================================================');
  console.log(' ⏱️ ĐO ĐẠC THỰC TẾ: TỐC ĐỘ TẢI TRANG CQG (CỜ HIỆN TẠI VS CỜ TỐI ƯU)');
  console.log('================================================================================\n');

  const currentFlags = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--start-maximized',
    '--ignore-gpu-blocklist',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--disk-cache-size=209715200',
    '--enable-features=V8CodeCache,WebAssembly',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  const optimizedFlags = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--start-maximized',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--renderer-process-limit=1',
    '--js-flags=--max-old-space-size=512',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-session-crashed-bubble',
    '--hide-crash-restore-bubble',
  ];

  console.log('1. Đang đo đạc với BỘ CỜ HIỆN TẠI (Ép GPU, không giới hạn V8)...');
  const resCurrent = await measureCqgSpeed('CURRENT', currentFlags, path.join(baseTemp, 'p_current'));
  console.log(`   - Khởi động Browser: ${resCurrent.launchDuration} ms`);
  console.log(`   - HTTP Commit      : ${resCurrent.commitTime} ms`);
  console.log(`   - DOM Content Loaded: ${resCurrent.domTime} ms`);
  console.log(`   - Form/Dashboard Ready: ${resCurrent.formReadyTime} ms\n`);

  console.log('2. Đang đo đạc với BỘ CỜ TỐI ƯU (Tắt GPU ảo, V8 512MB, 1 renderer)...');
  const resOptimized = await measureCqgSpeed('OPTIMIZED', optimizedFlags, path.join(baseTemp, 'p_optimized'));
  console.log(`   - Khởi động Browser: ${resOptimized.launchDuration} ms`);
  console.log(`   - HTTP Commit      : ${resOptimized.commitTime} ms`);
  console.log(`   - DOM Content Loaded: ${resOptimized.domTime} ms`);
  console.log(`   - Form/Dashboard Ready: ${resOptimized.formReadyTime} ms\n`);

  console.log('================================================================================');
  console.log(' 📊 BẢNG SO SÁNH TỐC ĐỘ THỰC TẾ (ĐƠN VỊ: MILIGIÂY)');
  console.log('================================================================================');
  console.table([
    {
      'Tiêu chí đo lường': 'Khởi động Browser',
      'Cờ Hiện Tại (ms)': `${resCurrent.launchDuration} ms`,
      'Cờ Tối Ưu (ms)': `${resOptimized.launchDuration} ms`,
      'Chênh lệch': `${resOptimized.launchDuration - resCurrent.launchDuration > 0 ? '+' : ''}${resOptimized.launchDuration - resCurrent.launchDuration} ms`,
    },
    {
      'Tiêu chí đo lường': 'Thời gian phản hồi Commit',
      'Cờ Hiện Tại (ms)': `${resCurrent.commitTime} ms`,
      'Cờ Tối Ưu (ms)': `${resOptimized.commitTime} ms`,
      'Chênh lệch': `${resOptimized.commitTime - resCurrent.commitTime > 0 ? '+' : ''}${resOptimized.commitTime - resCurrent.commitTime} ms`,
    },
    {
      'Tiêu chí đo lường': 'DOMContentLoaded (Nạp khung Web)',
      'Cờ Hiện Tại (ms)': `${resCurrent.domTime} ms`,
      'Cờ Tối Ưu (ms)': `${resOptimized.domTime} ms`,
      'Chênh lệch': `${resOptimized.domTime - resCurrent.domTime > 0 ? '+' : ''}${resOptimized.domTime - resCurrent.domTime} ms`,
    },
    {
      'Tiêu chí đo lường': 'Form/Dashboard Ready (Sẵn sàng thao tác)',
      'Cờ Hiện Tại (ms)': `${resCurrent.formReadyTime} ms`,
      'Cờ Tối Ưu (ms)': `${resOptimized.formReadyTime} ms`,
      'Chênh lệch': `${resOptimized.formReadyTime - resCurrent.formReadyTime > 0 ? '+' : ''}${resOptimized.formReadyTime - resCurrent.formReadyTime} ms`,
    },
  ]);

  try {
    fs.rmSync(baseTemp, { recursive: true, force: true });
  } catch {}
  console.log('================================================================================\n');
}

main().catch(err => {
  console.error('Lỗi đo đạc:', err.message);
  process.exit(1);
});
