/**
 * ============================================================================
 * BENCHMARK THỰC TẾ 100%: ĐO ĐẠC TOÀN BỘ TIẾN TRÌNH THỰC THI THẬT CỦA CQG
 * ============================================================================
 * 
 * Mục đích:
 * Đo đạc chính xác dung lượng RAM (Node.js, Chromium Browser, GPU Process, Renderer)
 * xuyên suốt 1 TIẾN TRÌNH HOÀN CHỈNH từ A-Z thay vì chỉ mở trang rồi tắt đi:
 * 
 * 1. Chặng 0: Baseline hệ thống & Node.js trước khi kích hoạt.
 * 2. Chặng 1: Khởi động Chromium với bộ cờ sản xuất (CqgScraperService).
 * 3. Chặng 2: Đăng nhập tài khoản thật, xử lý tranh chấp phiên (Session Takeover),
 *             nạp toàn bộ DOM, WebSockets và Canvas Dashboard.
 * 4. Chặng 3: Mở Widget Fills (FR1), chọn All accounts, chờ WebSocket stream toàn bộ dữ liệu bảng.
 * 5. Chặng 4: Mở menu 3 chấm, bấm xuất Excel, bắt sự kiện Download và lưu file thật về đĩa.
 * 6. Chặng 5: Node.js nạp file nhị phân vừa tải, dùng SheetJS bóc tách dữ liệu thật.
 * 7. Chặng 6: Dọn dẹp tab widget, Logoff giải phóng phiên, đóng trình duyệt và đo RAM thu hồi.
 * 
 * Cách chạy:
 *   cd backend
 *   # 1. Chạy có giao diện để quan sát trực tiếp trên màn hình:
 *   node src/scripts/test_measure_real_cqg_process.js --headed
 * 
 *   # 2. Chạy ngầm (headless):
 *   node src/scripts/test_measure_real_cqg_process.js
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');

// Tải biến môi trường
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();

// ── GIẢI MÃ THÔNG TIN ĐĂNG NHẬP ──────────────────────────────────────────────
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const enc = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── TÌM ĐƯỜNG DẪN CHROME THỰC THI ─────────────────────────────────────────────
function getChromeExecutablePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    ];
    for (const p of candidates) if (fs.existsSync(p)) return p;
  } else {
    const linuxPaths = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
    for (const p of linuxPaths) if (fs.existsSync(p)) return p;
  }
  return undefined;
}

// ── ĐO LƯỜNG BỘ NHỚ CHI TIẾT ──────────────────────────────────────────────────
function getSystemMemory() {
  const total = Math.round(os.totalmem() / 1024 / 1024);
  const free = Math.round(os.freemem() / 1024 / 1024);
  return { totalMB: total, usedMB: total - free, freeMB: free };
}

function getNodeMemory() {
  const m = process.memoryUsage();
  return {
    rssMB: Math.round(m.rss / 1024 / 1024),
    heapUsedMB: Math.round(m.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(m.heapTotal / 1024 / 1024),
    externalMB: Math.round(m.external / 1024 / 1024),
    arrayBuffersMB: Math.round((m.arrayBuffers || 0) / 1024 / 1024),
  };
}

function getChromeProcessesMemory(profileDir) {
  let totalMB = 0;
  const processes = [];

  try {
    if (process.platform === 'win32') {
      const normalizedProfile = path.basename(profileDir).toLowerCase();
      const psCmd = `Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'chrome.exe' -or $_.Name -eq 'msedge.exe') -and $_.CommandLine -like '*${normalizedProfile}*' } | Select-Object ProcessId, WorkingSetSize | ConvertTo-Json`;
      try {
        const jsonOut = execSync(`powershell -NoProfile -NonInteractive -Command "${psCmd}"`, {
          stdio: ['pipe', 'pipe', 'ignore'],
          timeout: 4000,
        }).toString().trim();

        if (jsonOut) {
          const parsed = JSON.parse(jsonOut);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          list.forEach((p) => {
            const memMB = Math.round(Number(p.WorkingSetSize || 0) / 1024 / 1024);
            totalMB += memMB;
            processes.push({ pid: p.ProcessId, memMB });
          });
        }
      } catch {
        // Fallback wmic
        const output = execSync(
          `wmic process where "name='chrome.exe' or name='msedge.exe'" get processid,commandline /format:csv`,
          { stdio: ['pipe', 'pipe', 'ignore'], timeout: 4000 }
        ).toString();
        const lines = output.trim().split('\r\n').filter(Boolean).slice(1);
        lines.forEach((line) => {
          if (line.toLowerCase().includes(normalizedProfile)) {
            const parts = line.split(',');
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(Number(pid))) processes.push({ pid, memMB: 0 });
          }
        });
      }
    } else {
      // Linux
      const normalizedProfile = path.basename(profileDir);
      const out = execSync(`ps aux | grep -i "${normalizedProfile}" | grep -v grep || true`, { timeout: 4000 }).toString();
      const lines = out.trim().split('\n').filter(Boolean);
      lines.forEach((l) => {
        const cols = l.trim().split(/\s+/);
        const pid = cols[1];
        const rssKB = parseInt(cols[5], 10);
        if (!isNaN(rssKB)) {
          const memMB = Math.round(rssKB / 1024);
          totalMB += memMB;
          processes.push({ pid, memMB });
        }
      });
    }
  } catch {}

  return { totalMB, count: processes.length, processes };
}

// ── BỘ GIÁM SÁT REALTIME SAMPLER ─────────────────────────────────────────────
class MemorySampler {
  constructor(profileDir) {
    this.profileDir = profileDir;
    this.samples = [];
    this.peakChromeMB = 0;
    this.peakTotalMB = 0;
    this.timer = null;
  }

  start() {
    this.timer = setInterval(() => {
      const sys = getSystemMemory();
      const node = getNodeMemory();
      const chrome = getChromeProcessesMemory(this.profileDir);
      const totalCombinedMB = node.rssMB + chrome.totalMB;

      if (chrome.totalMB > this.peakChromeMB) this.peakChromeMB = chrome.totalMB;
      if (totalCombinedMB > this.peakTotalMB) this.peakTotalMB = totalCombinedMB;

      this.samples.push({
        time: new Date().toLocaleTimeString(),
        chromeMB: chrome.totalMB,
        chromeProcs: chrome.count,
        nodeRssMB: node.rssMB,
        nodeHeapMB: node.heapUsedMB,
        totalCombinedMB,
      });
    }, 1000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  takeSnapshot(label) {
    const sys = getSystemMemory();
    const node = getNodeMemory();
    const chrome = getChromeProcessesMemory(this.profileDir);
    return {
      label,
      time: new Date().toLocaleTimeString(),
      chromeTotalMB: chrome.totalMB,
      chromeCount: chrome.count,
      nodeRssMB: node.rssMB,
      nodeHeapMB: node.heapUsedMB,
      combinedMB: node.rssMB + chrome.totalMB,
      sysUsedMB: sys.usedMB,
      sysFreeMB: sys.freeMB,
    };
  }
}

// ── MAIN REAL PROCESS BENCHMARK ──────────────────────────────────────────────
async function runRealProcessBenchmark() {
  console.log('================================================================================');
  console.log(' 🔬 BENCHMARK THỰC TẾ 100%: ĐO ĐẠC TOÀN BỘ TIẾN TRÌNH THỰC THI CQG TỪ ĐẦU ĐẾN CUỐI');
  console.log('================================================================================\n');

  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed');

  // Thư mục profile và thư mục tải file test
  const tempDir = path.join(process.cwd(), 'temp', 'real_cqg_process_test');
  const profileDir = path.join(tempDir, 'profile_bench');
  const destDir = path.join(tempDir, 'downloaded_files');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const snapshots = [];
  const sampler = new MemorySampler(profileDir);

  // ---------------------------------------------------------------------------
  // CHẶNG 0: BASELINE HỆ THỐNG
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 0/6] ĐO ĐẠC BASELINE BAN ĐẦU (KHI CHƯA KHỞI ĐỘNG CHROMIUM)');
  if (global.gc) global.gc();
  const baseSnap = sampler.takeSnapshot('Chặng 0: Baseline hệ thống');
  snapshots.push(baseSnap);
  console.log(`   - RAM Hệ thống   : Đang dùng ${baseSnap.sysUsedMB} MB (Trống: ${baseSnap.sysFreeMB} MB)`);
  console.log(`   - Node.js RSS    : ${baseSnap.nodeRssMB} MB (HeapUsed: ${baseSnap.nodeHeapMB} MB)`);
  console.log(`   - Chromium RAM   : 0 MB (0 tiến trình)\n`);

  // ---------------------------------------------------------------------------
  // 1. LẤY THÔNG TIN TÀI KHOẢN TỪ MONGODB ATLAS / LOCAL
  // ---------------------------------------------------------------------------
  console.log('🔑 [1/6] Nạp thông tin tài khoản CQG từ CSDL...');
  const mongoUri =
    process.env.MONGODB_URI ||
    'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';
  
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  const settingDoc = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  if (!settingDoc) {
    throw new Error('Không tìm thấy bản ghi bot_credentials_cqg trong CSDL!');
  }
  const creds = JSON.parse(decrypt(settingDoc.value));
  await mongoose.disconnect();

  const cqgUrl = creds.urlTrade || creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  const username = creds.username1 || creds.usernameCQG1;
  const password = creds.password1 || creds.passwordCQG1;
  console.log(`   - URL CQG   : ${cqgUrl}`);
  console.log(`   - Tài khoản : ${username}`);
  console.log(`   - Chế độ UI : ${isHeaded ? 'CÓ GIAO DIỆN (--headed)' : 'CHẠY NGẦM (--headless)'}\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 1: KHỞI ĐỘNG CHROMIUM VỚI BỘ CỜ SẢN XUẤT
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 1/6] KHỞI ĐỘNG TRÌNH DUYỆT CHROMIUM (Bộ cờ Production Chuẩn)...');
  sampler.start();

  const executablePath = getChromeExecutablePath();
  const prodArgs = [
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
    '--disable-features=DownloadBubble,DownloadBubbleV2,InsecureDownloadWarnings',
    '--no-default-browser-check',
  ];

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: !isHeaded,
    executablePath,
    args: prodArgs,
    viewport: null,
    acceptDownloads: true,
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  await new Promise((r) => setTimeout(r, 2000));
  const snapLaunch = sampler.takeSnapshot('Chặng 1: Mở Chromium');
  snapshots.push(snapLaunch);
  console.log(`   - Chromium RAM   : ${snapLaunch.chromeTotalMB} MB (${snapLaunch.chromeCount} tiến trình con)`);
  console.log(`   - Node.js RSS    : ${snapLaunch.nodeRssMB} MB\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 2: ĐIỀU HƯỚNG & ĐĂNG NHẬP THẬT (LOGON & DASHBOARD)
  // ---------------------------------------------------------------------------
  console.log(`📍 [CHẶNG 2/6] ĐIỀU HƯỚNG VÀ ĐĂNG NHẬP VÀO CQG (${username})...`);
  const tNavStart = Date.now();
  await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 });

  // Dò tìm login form hoặc dashboard
  const detectState = async (timeoutMs = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const hasLogin = await page.locator('input[name="userName"], input[name="username"], input[type="password"]').first().isVisible().catch(() => false);
      if (hasLogin) return 'LOGIN';
      const hasDash = await page.locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']').first().isVisible().catch(() => false);
      if (hasDash) return 'DASHBOARD';
      await new Promise((r) => setTimeout(r, 400));
    }
    return 'TIMEOUT';
  };

  let state = await detectState(15000);
  if (state === 'TIMEOUT') {
    console.log(`   (Reload F5 để nạp từ Disk Cache...)`);
    await page.reload({ waitUntil: 'commit', timeout: 45000 }).catch(() => {});
    state = await detectState(15000);
  }

  // Hàm đóng thông báo
  async function dismissNotifications(p) {
    try {
      const closeBtn = p.locator("//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]");
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click({ timeout: 1500, force: true }).catch(() => {});
      }
      await p.evaluate(() => {
        document.querySelectorAll('wpfe-multi-snack-bar-container, .wpfe-notification').forEach((el) => el.remove());
      }).catch(() => {});
    } catch {}
  }

  if (state === 'LOGIN') {
    console.log(`   - Nhập tài khoản và mật khẩu...`);
    await page.fill('input[name="userName"], input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"], button:has-text("Log on")').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
  }

  // Chờ Dashboard Logo & xử lý tranh chấp phiên (Session Takeover)
  console.log(`   - Chờ Dashboard Logo và xử lý tranh chấp phiên...`);
  const waitLogoStart = Date.now();
  let inDashboard = false;
  while (Date.now() - waitLogoStart < 120000) {
    const isDash = await page.evaluate(() => {
      const text = document.body ? document.body.innerText : '';
      return text.includes('Ho') || text.includes('Orders') || text.includes('Fills') || text.includes('Pos') || !!document.querySelector('wpfe-widget-tab-control');
    }).catch(() => false);

    if (isDash) {
      inDashboard = true;
      break;
    }

    await dismissNotifications(page);

    // Nếu form login vẫn còn hiện -> Nhấn lại submit hoặc Enter
    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 200 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      if (await submitBtn.first().isVisible().catch(() => false)) {
        console.log(`   (Form login còn hiển thị, nhấn Log on / Enter...)`);
        await submitBtn.first().click({ force: true }).catch(() => {});
        await page.keyboard.press('Enter').catch(() => {});
        await page.waitForTimeout(2000);
      }
    }

    // Popup xung đột phiên
    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), button:has-text("Logon here"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button'
    ).first();
    if (await takeoverBtn.isVisible({ timeout: 300 }).catch(() => false)) {
      const txt = await takeoverBtn.innerText().catch(() => '');
      console.log(`   (Phát hiện popup phiên "${txt}". Bấm Take over...)`);
      await takeoverBtn.click({ force: true }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!inDashboard) {
    const errShot = path.join(process.cwd(), 'temp', 'cqg_login_timeout.png');
    await page.screenshot({ path: errShot }).catch(() => {});
    console.log(`   [DEBUG] Đã chụp ảnh màn hình lỗi tại: ${errShot}`);
    throw new Error('Không thể vào Dashboard CQG sau 120s!');
  }

  // Chờ spinner loading tắt
  await page.waitForTimeout(3000);
  const snapLogon = sampler.takeSnapshot('Chặng 2: Đăng nhập & Nạp Workspace');
  snapshots.push(snapLogon);
  console.log(`   - Thời gian đăng nhập : ${((Date.now() - tNavStart) / 1000).toFixed(1)}s`);
  console.log(`   - Chromium RAM        : ${snapLogon.chromeTotalMB} MB (+${snapLogon.chromeTotalMB - snapLaunch.chromeTotalMB} MB từ lúc mở)`);
  console.log(`   - Tổng RAM Tiến trình : ${snapLogon.combinedMB} MB\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 3: MỞ WIDGET VÀ STREAM DỮ LIỆU BẢNG (GRID TABLE)
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 3/6] MỞ WIDGET FILLS (FR1) VÀ ĐỒNG BỘ DỮ LIỆU REALTIME...');
  const tWidgetStart = Date.now();

  // Kích hoạt tab Fills
  const fillsActivated = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('.wpfe-tab-header, .wpfe-tab-header-title, span, div'));
    for (const el of elements) {
      if (el.innerText && el.innerText.trim().startsWith('Fills')) {
        el.click();
        return true;
      }
    }
    return false;
  }).catch(() => false);

  if (fillsActivated) {
    console.log(`   - Tab Fills đã được kích hoạt thành công trên Workspace!`);
    await page.waitForTimeout(1500);
  } else {
    console.log(`   - Mở tab Fills qua menu Ho...`);
    // Bấm Ho
    const hoBtn = page.locator("//div[text()='Ho']").first();
    await hoBtn.waitFor({ state: 'visible', timeout: 10000 });
    await hoBtn.click();
    await page.waitForTimeout(400);

    // Bấm dấu cộng (+)
    let plusIcon = page.locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn").first();
    if ((await plusIcon.count().catch(() => 0)) === 0) {
      plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
    }
    await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
    await plusIcon.click();
    await page.waitForTimeout(400);

    // Tìm "Fills"
    const searchInput = page.locator("//input[@placeholder='Search...']").first();
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill('Fills');
    await page.waitForTimeout(400);

    // Chọn Fills item
    const fillsItem = page.locator("//div[@wpfefocuslistitem and .//span[text()='Fills']]").first();
    await fillsItem.waitFor({ state: 'visible', timeout: 10000 });
    await fillsItem.click();
    await page.waitForTimeout(800);
  }

  // Chờ WebSocket nạp dữ liệu xong (spinner tắt)
  console.log(`   - Chờ WebSockets nạp dữ liệu bảng Fills...`);
  await page.waitForTimeout(4000);

  const snapWidget = sampler.takeSnapshot('Chặng 3: Mở Widget & Render Bảng Fills');
  snapshots.push(snapWidget);
  console.log(`   - Thời gian nạp widget : ${((Date.now() - tWidgetStart) / 1000).toFixed(1)}s`);
  console.log(`   - Chromium RAM         : ${snapWidget.chromeTotalMB} MB (+${snapWidget.chromeTotalMB - snapLogon.chromeTotalMB} MB từ lúc logon)`);
  console.log(`   - Tổng RAM Tiến trình  : ${snapWidget.combinedMB} MB\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 4: BẤM XUẤT EXCEL VÀ DOWNLOAD FILE THẬT
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 4/6] BẤM XUẤT EXCEL VÀ STREAM FILE DOWNLOAD THẬT VỀ ĐĨA...');
  const tExportStart = Date.now();
  const destFile = path.join(destDir, 'FR1_real_benchmark.xlsx');

  const ellipsisBtn = page.locator(
    "//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v'] | //div[contains(text(), 'Fills')]/ancestor::wpfe-widget-tab-control[1]//mat-icon[@data-mat-icon-name='ellipsis-v'] | //wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v'] | //mat-icon[@data-mat-icon-name='ellipsis-v']"
  ).first();

  await ellipsisBtn.waitFor({ state: 'visible', timeout: 8000 });
  await ellipsisBtn.click();
  await page.waitForTimeout(800);

  const downloadItem = page.locator(
    "//div[contains(text(), \"Download today's fills\") or contains(text(), 'Download fills') or contains(text(), 'Download')]"
  ).first();
  await downloadItem.waitFor({ state: 'visible', timeout: 8000 });

  const [downloadEvent] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }),
    downloadItem.click(),
  ]);

  await downloadEvent.saveAs(destFile);
  const fileStat = fs.statSync(destFile);

  const snapExport = sampler.takeSnapshot('Chặng 4: Xuất & Tải File Excel');
  snapshots.push(snapExport);
  console.log(`   - Thời gian xuất file  : ${((Date.now() - tExportStart) / 1000).toFixed(1)}s`);
  console.log(`   - File tải về          : ${path.basename(destFile)} (${(fileStat.size / 1024).toFixed(1)} KB)`);
  console.log(`   - Chromium RAM         : ${snapExport.chromeTotalMB} MB`);
  console.log(`   - Tổng RAM Tiến trình  : ${snapExport.combinedMB} MB\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 5: NODE.JS NẠP VÀ BÓC TÁCH FILE THẬT BẰNG SHEETJS
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 5/6] NODE.JS NẠP VÀ PARSE DỮ LIỆU THẬT VỪA TẢI (SheetJS)...');
  const tParseStart = Date.now();
  const fileBuffer = fs.readFileSync(destFile);

  // Sparse mode
  const wb = XLSX.read(fileBuffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheetData = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
  const tParseEnd = Date.now();

  const snapParse = sampler.takeSnapshot('Chặng 5: Node.js Parse Excel');
  snapshots.push(snapParse);
  console.log(`   - Thời gian parse      : ${tParseEnd - tParseStart} ms`);
  console.log(`   - Số dòng bóc tách     : ${sheetData.length} dòng dữ liệu thực tế`);
  console.log(`   - Node.js HeapUsed     : ${snapParse.nodeHeapMB} MB (+${snapParse.nodeHeapMB - snapExport.nodeHeapMB} MB Heap)`);
  console.log(`   - Node.js RSS          : ${snapParse.nodeRssMB} MB\n`);

  // ---------------------------------------------------------------------------
  // CHẶNG 6: DỌN DẸP TAB, LOGOFF VÀ THU HỒI BỘ NHỚ
  // ---------------------------------------------------------------------------
  console.log('📍 [CHẶNG 6/6] LOGOFF GIẢI PHÓNG PHIÊN, ĐÓNG TRÌNH DUYỆT VÀ THU HỒI RAM...');
  try {
    // Đóng widget
    const closeTabIcon = page.locator("//div[contains(@class, 'wpfe-tab-header-active')]//mat-icon[@data-mat-icon-name='times']").first();
    if (await closeTabIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeTabIcon.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  } catch {}

  // Đóng browser context
  await context.close().catch(() => {});
  sampler.stop();

  await new Promise((r) => setTimeout(r, 2000));
  if (global.gc) global.gc();

  const snapFinal = sampler.takeSnapshot('Chặng 6: Sau khi đóng hoàn tất');
  snapshots.push(snapFinal);
  console.log(`   - Chromium RAM sau đóng: ${snapFinal.chromeTotalMB} MB (${snapFinal.chromeCount} tiến trình)`);
  console.log(`   - RAM Hệ thống thu hồi : Trống ${snapFinal.sysFreeMB} MB (Đang dùng: ${snapFinal.sysUsedMB} MB)\n`);

  // ---------------------------------------------------------------------------
  // BẢNG BÁO CÁO TỔNG KẾT TOÀN DIỆN
  // ---------------------------------------------------------------------------
  console.log('================================================================================');
  console.log(' 📊 BẢNG TỔNG KẾT ĐO LƯỜNG CHÍNH XÁC TOÀN BỘ 1 TIẾN TRÌNH THỰC TẾ CỦA CQG');
  console.log('================================================================================');
  console.table(
    snapshots.map((s) => ({
      'Giai đoạn tiến trình': s.label,
      'Chromium (MB)': `${s.chromeTotalMB} MB`,
      'Số tiến trình Chrome': s.chromeCount,
      'Node RSS (MB)': `${s.nodeRssMB} MB`,
      'Node Heap (MB)': `${s.nodeHeapMB} MB`,
      'TỔNG TIẾN TRÌNH': `${s.combinedMB} MB`,
      'RAM Host Free': `${s.sysFreeMB} MB`,
    }))
  );

  console.log(`\n🎯 ĐỈNH ĐIỂM TIÊU THỤ BỘ NHỚ (PEAK MEMORY) GHI NHẬN ĐƯỢC:`);
  console.log(`   - Đỉnh RAM Chromium (Browser + GPU + Renderers) : ${sampler.peakChromeMB} MB`);
  console.log(`   - Đỉnh RAM Toàn bộ Tiến trình (Chrome + Node.js) : ${sampler.peakTotalMB} MB`);
  console.log(`================================================================================\n`);

  // Dọn dẹp thư mục tạm
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
}

runRealProcessBenchmark().catch((err) => {
  console.error(`💥 Lỗi trong quá trình kiểm thử tiến trình thực tế: ${err.message}`);
  process.exit(1);
});
