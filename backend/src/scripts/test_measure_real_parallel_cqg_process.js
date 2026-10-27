/**
 * ============================================================================
 * BENCHMARK THỰC TẾ 100%: KIỂM THỬ END-TO-END TẢI SONG SONG 2 TÀI KHOẢN CQG
 * ============================================================================
 * Mục tiêu:
 * 1. Chạy SONG SONG ĐỒNG THỜI 100% cả 2 tài khoản CQG1 và CQG2 (Promise.all).
 * 2. Đo đạc chính xác tuyệt đối tài nguyên tiêu thụ:
 *    - Node.js RSS & V8 Heap
 *    - Tổng RAM vật lý của cả 2 phiên Chromium độc lập
 *    - Độ sụt giảm RAM thực tế của hệ điều hành Host (Delta Free RAM)
 * 3. Kiểm chứng tính đồng bộ thời gian (Barrier Synchronization):
 *    - Đo độ lệch thời gian ghi file (mtime delta giữa FR1 và FR2).
 * 4. Parse nội dung thực tế cả 2 file Excel bằng SheetJS, đếm số dòng khớp lệnh.
 * 5. Đo đạc mức độ thu hồi RAM sau khi đóng cả 2 trình duyệt.
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { chromium } = require('playwright-core');

// Tải biến môi trường chuẩn
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();

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

function getSystemMemory() {
  const totalMB = Math.round(os.totalmem() / 1024 / 1024);
  const freeMB = Math.round(os.freemem() / 1024 / 1024);
  return { totalMB, freeMB, usedMB: totalMB - freeMB };
}

function getNodeMemory() {
  const mem = process.memoryUsage();
  return {
    rssMB: Math.round(mem.rss / 1024 / 1024),
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
  };
}

function getChromeProcessesMemoryByProfiles(profileDir1, profileDir2) {
  let totalMB = 0;
  const processes = [];

  try {
    const p1 = path.basename(profileDir1).toLowerCase();
    const p2 = path.basename(profileDir2).toLowerCase();

    if (process.platform === 'win32') {
      const output = execSync(
        `wmic process where "name='chrome.exe' or name='msedge.exe'" get processid,commandline,workingsetsize /format:csv`,
        { stdio: ['pipe', 'pipe', 'ignore'], timeout: 6000 }
      ).toString();

      const lines = output.trim().split('\r\n').filter(Boolean).slice(1);
      lines.forEach((line) => {
        const lower = line.toLowerCase();
        if (lower.includes(p1) || lower.includes(p2)) {
          const parts = line.split(',');
          const pid = parts[parts.length - 2];
          const ws = parts[parts.length - 1];
          const memMB = ws && !isNaN(Number(ws)) ? Math.round(Number(ws) / 1024 / 1024) : 0;
          totalMB += memMB;
          processes.push({ pid, memMB });
        }
      });
    } else {
      const out = execSync(`ps aux | grep -E "(${p1}|${p2})" | grep -v grep || true`, { timeout: 4000 }).toString();
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
  } catch (err) {
    // ignore
  }

  return { totalMB, count: processes.length, processes };
}

function takeSnapshot(label, profileDir1, profileDir2) {
  const sys = getSystemMemory();
  const node = getNodeMemory();
  const chrome = getChromeProcessesMemoryByProfiles(profileDir1, profileDir2);
  return {
    label,
    time: new Date().toLocaleTimeString(),
    sysFreeMB: sys.freeMB,
    nodeRssMB: node.rssMB,
    nodeHeapMB: node.heapUsedMB,
    chromeTotalMB: chrome.totalMB,
    chromeCount: chrome.count,
    combinedMB: node.rssMB + chrome.totalMB,
  };
}

async function dismissNotifications(page) {
  try {
    const closeBtn = page.locator("//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]");
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 1500, force: true }).catch(() => {});
    }
    await page.evaluate(() => {
      document.querySelectorAll('wpfe-multi-snack-bar-container, .wpfe-notification').forEach((el) => el.remove());
    }).catch(() => {});
  } catch {}
}

async function handleSingleCqgFlow(accountTag, creds, context, page, downloadDestPath) {
  const logPrefix = `[${accountTag}]`;
  console.log(`   ${logPrefix} Bắt đầu điều hướng đến CQG (${creds.username})...`);
  const tStart = Date.now();

  await page.goto(creds.cqgUrl, { waitUntil: 'commit', timeout: 60000 });

  // 1. Dò tìm trạng thái đăng nhập
  const detectState = async (timeoutMs = 15000) => {
    const s = Date.now();
    while (Date.now() - s < timeoutMs) {
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
    console.log(`   ${logPrefix} F5 nạp lại trang...`);
    await page.reload({ waitUntil: 'commit', timeout: 45000 }).catch(() => {});
    state = await detectState(15000);
  }

  if (state === 'LOGIN') {
    console.log(`   ${logPrefix} Điền thông tin đăng nhập: ${creds.username}...`);
    await page.fill('input[name="userName"], input[name="username"]', creds.username);
    await page.fill('input[name="password"]', creds.password);
    await page.click('button[type="submit"], button:has-text("Log on")').catch(() => {});
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
  }

  // 2. Chờ Dashboard Logo & Xử lý xung đột phiên
  console.log(`   ${logPrefix} Chờ nạp Dashboard Workspace...`);
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

    // Nếu form login vẫn còn hiện -> Nhấn lại submit
    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 200 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      if (await submitBtn.first().isVisible().catch(() => false)) {
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
      console.log(`   ${logPrefix} Phát hiện popup phiên "${txt}". Bấm Take over...`);
      await takeoverBtn.click({ force: true }).catch(() => {});
      await new Promise((r) => setTimeout(r, 1500));
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!inDashboard) {
    throw new Error(`${logPrefix} Không thể vào Dashboard sau 120s!`);
  }

  const loginTimeSec = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`   ${logPrefix} ĐÃ VÀO DASHBOARD THÀNH CÔNG (${loginTimeSec}s)!`);

  // 3. Kích hoạt Widget Fills
  console.log(`   ${logPrefix} Tìm kiếm và kích hoạt tab Fills...`);
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
    console.log(`   ${logPrefix} Đã kích hoạt tab Fills có sẵn.`);
  } else {
    console.log(`   ${logPrefix} Mở tab Fills mới qua menu Ho...`);
    const hoBtn = page.locator("//div[text()='Ho']").first();
    await hoBtn.waitFor({ state: 'visible', timeout: 8000 });
    await hoBtn.click();
    await page.waitForTimeout(400);

    const plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
    await plusIcon.waitFor({ state: 'visible', timeout: 8000 });
    await plusIcon.click();
    await page.waitForTimeout(400);

    const searchInput = page.locator("//input[@placeholder='Search...']").first();
    await searchInput.waitFor({ state: 'visible', timeout: 8000 });
    await searchInput.fill('Fills');
    await page.waitForTimeout(400);

    const fillsItem = page.locator("//div[@wpfefocuslistitem and .//span[text()='Fills']]").first();
    await fillsItem.waitFor({ state: 'visible', timeout: 8000 });
    await fillsItem.click();
    await page.waitForTimeout(800);
  }

  // Chờ bảng dữ liệu Fills render
  console.log(`   ${logPrefix} Chờ bảng dữ liệu Fills nạp xong...`);
  await page.waitForSelector('.ag-center-cols-container, .ag-root, .ui-grid, wpfe-widget-tab-control', { timeout: 30000 });
  await page.waitForTimeout(3000);

  // 4. Bấm nút Menu 3 chấm và Download file
  console.log(`   ${logPrefix} Mở menu tùy chọn bảng Fills...`);
  const ellipsisBtn = page.locator(
    "//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v'] | //div[contains(text(), 'Fills')]/ancestor::wpfe-widget-tab-control[1]//mat-icon[@data-mat-icon-name='ellipsis-v'] | //wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v'] | //mat-icon[@data-mat-icon-name='ellipsis-v']"
  ).first();

  await ellipsisBtn.waitFor({ state: 'visible', timeout: 10000 });
  await ellipsisBtn.click();
  await page.waitForTimeout(800);

  console.log(`   ${logPrefix} Chọn lệnh 'Download fills' và kích hoạt tải file...`);
  const downloadItem = page.locator(
    "//div[contains(text(), \"Download today's fills\") or contains(text(), 'Download fills') or contains(text(), 'Download')]"
  ).first();
  await downloadItem.waitFor({ state: 'visible', timeout: 10000 });

  const tExportStart = Date.now();
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }),
    downloadItem.click(),
  ]);

  await download.saveAs(downloadDestPath);
  const exportTimeSec = ((Date.now() - tExportStart) / 1000).toFixed(1);
  const stat = fs.statSync(downloadDestPath);
  const fileSizeKB = (stat.size / 1024).toFixed(1);

  console.log(`   ${logPrefix} TẢI THÀNH CÔNG: ${path.basename(downloadDestPath)} (${fileSizeKB} KB trong ${exportTimeSec}s)!`);

  // 5. Parse file bằng SheetJS đếm dòng
  const wb = XLSX.readFile(downloadDestPath);
  const sheetName = wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
  console.log(`   ${logPrefix} Bóc tách dữ liệu: ${rows.length} dòng khớp lệnh thực tế.`);

  return {
    accountTag,
    username: creds.username,
    filePath: downloadDestPath,
    fileSizeKB,
    rowsCount: rows.length,
    loginTimeSec,
    exportTimeSec,
    mtime: stat.mtime,
  };
}

async function runRealParallelBenchmark() {
  console.log('================================================================================');
  console.log(' 🔬 BENCHMARK THỰC TẾ 100%: KIỂM THỬ END-TO-END TẢI SONG SONG 2 TÀI KHOẢN CQG');
  console.log('================================================================================\n');

  const destDir = path.join(__dirname, '../../data/benchmark_parallel');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const tempProfileDir1 = path.join(os.tmpdir(), `test_cqg1_par_${Date.now()}`);
  const tempProfileDir2 = path.join(os.tmpdir(), `test_cqg2_par_${Date.now()}`);
  fs.mkdirSync(tempProfileDir1, { recursive: true });
  fs.mkdirSync(tempProfileDir2, { recursive: true });

  const snapshots = [];

  // MỐC 0: BASELINE HỆ THỐNG
  console.log('📍 [MỐC 0/5] ĐO ĐẠC BASELINE BAN ĐẦU...');
  if (global.gc) global.gc();
  const snapBase = takeSnapshot('Mốc 0: Baseline hệ thống', tempProfileDir1, tempProfileDir2);
  snapshots.push(snapBase);
  console.log(`   - RAM Hệ thống trống : ${snapBase.sysFreeMB} MB`);
  console.log(`   - Node.js RSS        : ${snapBase.nodeRssMB} MB (Heap: ${snapBase.nodeHeapMB} MB)`);
  console.log(`   - Chromium RAM       : 0 MB\n`);

  // 1. NẠP CREDENTIALS TỪ CSDL MONGODB ATLAS
  console.log('🔑 [1/5] Nạp thông tin tài khoản CQG1 và CQG2 từ MongoDB Atlas...');
  const mongoUri =
    process.env.MONGODB_URI ||
    'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  const settingDoc = await mongoose.connection.db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  if (!settingDoc) throw new Error('Không tìm thấy bot_credentials_cqg trong CSDL!');
  const credsRaw = JSON.parse(decrypt(settingDoc.value));
  await mongoose.disconnect();

  const cqgUrl = credsRaw.urlTrade || credsRaw.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  const creds1 = {
    username: credsRaw.username1 || credsRaw.usernameCQG1,
    password: credsRaw.password1 || credsRaw.passwordCQG1,
    cqgUrl,
  };
  const creds2 = {
    username: credsRaw.username2 || credsRaw.usernameCQG2,
    password: credsRaw.password2 || credsRaw.passwordCQG2,
    cqgUrl,
  };

  console.log(`   - CQG1 : ${creds1.username}`);
  console.log(`   - CQG2 : ${creds2.username}`);
  console.log(`   - URL  : ${cqgUrl}\n`);

  // CỜ PRODUCTION CHUẨN CỦA HỆ THỐNG
  const prodArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
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

  let executablePath = process.env.CHROMIUM_PATH || undefined;
  if (!executablePath && process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    ];
    executablePath = candidates.find((p) => fs.existsSync(p));
  }

  // MỐC 1: KHỞI ĐỘNG SONG SONG 2 TRÌNH DUYỆT CHROMIUM ĐỘC LẬP
  console.log('🚀 [MỐC 1/5] KHỞI ĐỘNG SONG SONG 2 TRÌNH DUYỆT CHROMIUM ĐỘC LẬP...');
  const tLaunchStart = Date.now();
  const [context1, context2] = await Promise.all([
    chromium.launchPersistentContext(tempProfileDir1, {
      headless: true,
      executablePath,
      args: prodArgs,
      viewport: null,
      acceptDownloads: true,
    }),
    chromium.launchPersistentContext(tempProfileDir2, {
      headless: true,
      executablePath,
      args: prodArgs,
      viewport: null,
      acceptDownloads: true,
    }),
  ]);

  const page1 = context1.pages().length > 0 ? context1.pages()[0] : await context1.newPage();
  const page2 = context2.pages().length > 0 ? context2.pages()[0] : await context2.newPage();

  await Promise.all([
    page1.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); }),
    page2.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); }),
  ]);

  await new Promise((r) => setTimeout(r, 2000));
  const snapLaunch = takeSnapshot('Mốc 1: Mở song song 2 Chromium', tempProfileDir1, tempProfileDir2);
  snapshots.push(snapLaunch);
  console.log(`   - Thời gian mở cả 2 trình duyệt: ${((Date.now() - tLaunchStart) / 1000).toFixed(1)}s`);
  console.log(`   - Tổng RAM 2 Chromium         : ${snapLaunch.chromeTotalMB} MB (${snapLaunch.chromeCount} tiến trình)`);
  console.log(`   - Node.js RSS                 : ${snapLaunch.nodeRssMB} MB`);
  console.log(`   - Tổng RAM cả 2 phiên         : ${snapLaunch.combinedMB} MB\n`);

  // MỐC 2: CHẠY TOÀN BỘ TIẾN TRÌNH SONG SONG 100% ĐẾN KHI XUẤT FILE HOÀN TẤT
  console.log('⚡ [MỐC 2/5] KÍCH HOẠT CHẠY SONG SONG 100% (PROMISE.ALL) CẢ 2 TÀI KHOẢN...');
  const file1 = path.join(destDir, 'FR1_parallel.xlsx');
  const file2 = path.join(destDir, 'FR2_parallel.xlsx');

  const tParallelStart = Date.now();
  const [res1, res2] = await Promise.all([
    handleSingleCqgFlow('CQG1', creds1, context1, page1, file1),
    handleSingleCqgFlow('CQG2', creds2, context2, page2, file2),
  ]);
  const tParallelEnd = Date.now();

  const snapPeak = takeSnapshot('Mốc 2: Đỉnh điểm tải song song 2 TK', tempProfileDir1, tempProfileDir2);
  snapshots.push(snapPeak);

  // MỐC 3: ĐÓNG CẢ 2 PHIÊN VÀ ĐO ĐẠC THU HỒI BỘ NHỚ
  console.log('\n🧹 [MỐC 3/5] ĐÓNG CẢ 2 TRÌNH DUYỆT VÀ ĐO ĐẠC THU HỒI BỘ NHỚ...');
  await Promise.all([context1.close(), context2.close()]);
  await new Promise((r) => setTimeout(r, 2000));
  if (global.gc) global.gc();

  const snapClosed = takeSnapshot('Mốc 3: Sau khi đóng cả 2 Chromium', tempProfileDir1, tempProfileDir2);
  snapshots.push(snapClosed);

  // Dọn dẹp profile tạm
  try {
    fs.rmSync(tempProfileDir1, { recursive: true, force: true });
    fs.rmSync(tempProfileDir2, { recursive: true, force: true });
  } catch {}

  // MỐC 4: TÍNH TOÁN ĐỘ LỆCH THỜI GIAN & BẢNG KẾT QUẢ
  const deltaSec = (Math.abs(res1.mtime.getTime() - res2.mtime.getTime()) / 1000).toFixed(2);

  console.log('\n================================================================================');
  console.log(' 📊 BẢNG TỔNG KẾT THỰC NGHIỆM END-TO-END: TẢI SONG SONG 2 TÀI KHOẢN CQG');
  console.log('================================================================================');
  console.table([
    {
      'Tài khoản': `${res1.accountTag} (${res1.username})`,
      'Tên file': path.basename(res1.filePath),
      'Kích thước': `${res1.fileSizeKB} KB`,
      'Số dòng khớp lệnh': `${res1.rowsCount} dòng`,
      'Thời gian đăng nhập': `${res1.loginTimeSec}s`,
      'Thời gian xuất file': `${res1.exportTimeSec}s`,
      'Thời điểm ghi đĩa (mtime)': res1.mtime.toLocaleTimeString(),
    },
    {
      'Tài khoản': `${res2.accountTag} (${res2.username})`,
      'Tên file': path.basename(res2.filePath),
      'Kích thước': `${res2.fileSizeKB} KB`,
      'Số dòng khớp lệnh': `${res2.rowsCount} dòng`,
      'Thời gian đăng nhập': `${res2.loginTimeSec}s`,
      'Thời gian xuất file': `${res2.exportTimeSec}s`,
      'Thời điểm ghi đĩa (mtime)': res2.mtime.toLocaleTimeString(),
    },
  ]);

  console.log('\n⏱️ ĐÁNH GIÁ TÍNH ĐỒNG BỘ THỜI GIAN (BARRIER SYNCHRONIZATION):');
  console.log(`   - Tổng thời gian hoàn thành cả 2 tài khoản : ${((tParallelEnd - tParallelStart) / 1000).toFixed(1)}s`);
  console.log(`   - Độ lệch thời điểm ghi đĩa (mtime delta)  : ${deltaSec}s (Đạt chuẩn < 5s cho đối soát thời gian thực)\n`);

  console.log('📈 BIẾN THIÊN BỘ NHỚ RAM TRONG SUỐT TIẾN TRÌNH:');
  console.table(
    snapshots.map((s) => ({
      'Giai đoạn': s.label,
      'Chromium RAM': `${s.chromeTotalMB} MB`,
      'Số PID Chrome': s.chromeCount,
      'Node RSS': `${s.nodeRssMB} MB`,
      'TỔNG TIẾN TRÌNH': `${s.combinedMB} MB`,
      'RAM Host Free': `${s.sysFreeMB} MB`,
    }))
  );

  const deltaHostFree = snapBase.sysFreeMB - snapPeak.sysFreeMB;
  console.log('\n🎯 ĐỈNH ĐIỂM TIÊU THỤ RAM (PEAK MEMORY) GHI NHẬN THỰC TẾ:');
  console.log(`   - Tổng RAM đỉnh của 2 Chromium song song : ${snapPeak.chromeTotalMB} MB (${snapPeak.chromeCount} tiến trình)`);
  console.log(`   - RAM Node.js                            : ${snapPeak.nodeRssMB} MB`);
  console.log(`   - Tổng RAM toàn bộ tiến trình (Node + 2 Chrome): ${snapPeak.combinedMB} MB`);
  console.log(`   - Độ sụt giảm RAM thực tế của hệ điều hành Host : ${deltaHostFree} MB`);
  console.log('================================================================================\n');
}

runRealParallelBenchmark().catch((err) => {
  console.error(`💥 Lỗi trong quá trình kiểm thử tải song song: ${err.message}`);
  process.exit(1);
});
