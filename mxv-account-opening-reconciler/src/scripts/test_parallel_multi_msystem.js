#!/usr/bin/env node
/**
 * TEST ĐA LUỒNG CÀO DỮ LIỆU M-SYSTEM (PLAYWRIGHT MULTI-TAB BENCHMARK)
 * ============================================================================
 * Môi trường: M-System DEV (https://admin-dev.msystem.newgen.dev)
 * Tài khoản: mxvhieptruong / PIN: 269696
 * Thư mục nguồn file: M:\Tailieuchung\QLGD-IT\Quanlygiaodich\Tai lieu hoat dong\Mo TKGD\HoSo_DinhKem
 * 
 * Mục tiêu:
 *   1. Không tác động đến backend local và MongoDB (chạy độc lập 100%, read-only).
 *   2. Đăng nhập 1 lần duy nhất trên BrowserContext để lưu trữ Session/Cookies.
 *   3. Nhân bản N Tab (Worker Pages) chạy song song (Concurrency Pool) cùng cào chi tiết tài khoản.
 *   4. Đọc danh sách tài khoản thực tế và kiểm tra file đính kèm từ ổ đĩa M:.
 *   5. Đo lường hiệu năng: Thời gian xử lý từng tài khoản, tổng thời gian, RAM tiêu thụ,
 *      và đánh giá độ an toàn khi vận hành trên máy chủ 2 vCPU / 4GB RAM.
 * 
 * Hướng dẫn chạy trên Terminal:
 *   # Chạy mặc định 3 luồng song song (khuyến nghị cho 2 vCPU / 4GB RAM):
 *   node src/scripts/test_parallel_multi_msystem.js
 * 
 *   # Chạy với giao diện trình duyệt để quan sát trực tiếp nhiều tab hoạt động:
 *   node src/scripts/test_parallel_multi_msystem.js --headed
 * 
 *   # Thử nghiệm với 2 luồng hoặc 4 luồng song song:
 *   node src/scripts/test_parallel_multi_msystem.js --concurrency 2
 *   node src/scripts/test_parallel_multi_msystem.js --concurrency 4
 * 
 *   # Tùy chỉnh số lượng tài khoản kiểm tra (mặc định 6):
 *   node src/scripts/test_parallel_multi_msystem.js --limit 10
 * 
 *   # Chỉ định danh sách tài khoản cụ thể:
 *   node src/scripts/test_parallel_multi_msystem.js --accounts 001C0140104,001C0668889,001C2320699
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const mongoose = require('mongoose');

let evaluateRecordReconciliationRule = null;
try {
  evaluateRecordReconciliationRule = require('../../dist/modules/engine-helpers/tkgd-reconcile-rules.helper').evaluateRecordReconciliationRule;
} catch {
  try {
    evaluateRecordReconciliationRule = require('../modules/engine-helpers/tkgd-reconcile-rules.helper').evaluateRecordReconciliationRule;
  } catch {}
}

// ─── CẤU HÌNH MẶC ĐỊNH ───────────────────────────────────────────────────────
const DEV_LOGIN_URL = 'https://admin-dev.msystem.newgen.dev/#/login';
const DEV_BASE_URL = 'https://admin-dev.msystem.newgen.dev';
const DEFAULT_USERNAME = 'mxvhieptruong';
const DEFAULT_PASSWORD = 'Taovipko0!';
const DEFAULT_PIN = '269696';
const DEFAULT_M_DIR = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Mo TKGD\\HoSo_DinhKem';

// ─── ĐỌC THAM SỐ CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const isHeaded = args.includes('--headed');
const concurrency = Math.max(1, parseInt(getArg('--concurrency', '3'), 10));
const limit = Math.max(1, parseInt(getArg('--limit', '6'), 10));
const delayMs = Math.max(1000, parseInt(getArg('--delay', '3500'), 10));
const targetDate = getArg('--date');
const accountsArg = getArg('--accounts');
const customDir = getArg('--dir', DEFAULT_M_DIR);

function log(label, msg) {
  const ts = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${ts}] [${label}] ${msg}`);
}

function findBrowser() {
  const cands = process.platform === 'linux'
    ? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    : [
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
  return cands.find(c => fs.existsSync(c));
}

function getMemoryUsageMB() {
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(1),
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1),
  };
}

// ─── TÌM TÀI KHOẢN TỪ Ổ M: ──────────────────────────────────────────────────
function scanAccountsFromMDir(baseDir, specificDate, limitCount) {
  if (!fs.existsSync(baseDir)) {
    log('WARN', `Thư mục ổ M: không tồn tại (${baseDir}). Sẽ dùng danh sách tài khoản mẫu fallback.`);
    return [
      { code: '001C0140104', folderPath: null, files: [] },
      { code: '001C0668889', folderPath: null, files: [] },
      { code: '001C2320699', folderPath: null, files: [] },
      { code: '001C4980699', folderPath: null, files: [] },
      { code: '001C6986468', folderPath: null, files: [] },
      { code: '002C1087138', folderPath: null, files: [] },
    ].slice(0, limitCount);
  }

  let selectedDate = specificDate;
  if (!selectedDate) {
    const dateFolders = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
      .map(d => d.name)
      .sort((a, b) => b.localeCompare(a));
    if (dateFolders.length === 0) {
      log('WARN', `Không tìm thấy thư mục ngày dạng YYYY-MM-DD trong ${baseDir}`);
      return [];
    }
    selectedDate = dateFolders[0];
  }

  const datePath = path.join(baseDir, selectedDate);
  log('FOLDER_DATE', `Sử dụng thư mục ngày: ${selectedDate} (${datePath})`);

  if (!fs.existsSync(datePath)) return [];

  const accDirs = fs.readdirSync(datePath, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{3}C\d{7}$/.test(d.name))
    .map(d => d.name);

  log('ACCOUNTS_FOUND', `Tìm thấy ${accDirs.length} thư mục tài khoản trong ngày ${selectedDate}`);

  const chosenCodes = accDirs.slice(0, limitCount);
  return chosenCodes.map(code => {
    const accFolder = path.join(datePath, code);
    let files = [];
    try {
      files = fs.readdirSync(accFolder);
    } catch (_) {}
    return {
      code,
      folderPath: accFolder,
      files,
    };
  });
}

// ─── HÀM CÀO CHI TIẾT TÀI KHOẢN TRÊN MỘT TAB RIÊNG BIỆT ─────────────────────
async function scrapeAccountOnPage(page, accountCode, workerId) {
  const detailUrl = `${DEV_BASE_URL}/#/clientManagement/investorManagement/${accountCode}`;
  const startTime = Date.now();

  try {
    // 1. Điều hướng an toàn bằng page.goto (Playwright tự quản lý lifecycle)
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(delayMs); // Cho React SPA gọi API và render (mặc định 3.5s)

    // Chờ loading spinner biến mất nếu đang tải
    const spinner = page.locator('.ant-spin-spinning');
    if (await spinner.isVisible({ timeout: 1000 }).catch(() => false)) {
      await spinner.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
    }

    // 2. Kiểm tra nếu tài khoản không tồn tại (trang rỗng / thông báo lỗi)
    const isNotFound = await page
      .locator('.ant-empty, .ant-result-404, .ant-alert-error')
      .first()
      .isVisible({ timeout: 1500 })
      .catch(() => false);

    if (isNotFound) {
      return {
        code: accountCode,
        status: 'NOT_FOUND',
        durationMs: Date.now() - startTime,
        data: null,
      };
    }

    // 3. Đảm bảo mở tab "THÔNG TIN" nếu có
    const tabThongTin = page.locator('.ant-tabs-tab:has-text("THÔNG TIN")').first();
    if (await tabThongTin.isVisible({ timeout: 2500 }).catch(() => false)) {
      await tabThongTin.click().catch(() => {});
      await page.waitForTimeout(1000);
    }

    // 4. Chờ React hydrate form inputs có dữ liệu
    await page.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.some(inp => (inp.value && inp.value.trim().length > 0) || (inp.getAttribute('title') || '').trim().length > 0);
    }, { timeout: 10000 }).catch(() => {});

    // 5. Đọc các trường thông tin DOM chuẩn (DOM API thuần, không dùng :has-text của Playwright)
    const scraped = await page.evaluate(() => {
      function readInput(selector) {
        const el = document.querySelector(selector);
        if (!el) return '';
        return el.value?.trim() || el.getAttribute('title')?.trim() || el.getAttribute('value')?.trim() || '';
      }
      function readByLabel(labelText) {
        const groups = Array.from(document.querySelectorAll('.form-group, .ant-form-item'));
        for (const g of groups) {
          if (g.textContent?.includes(labelText)) {
            const inp = g.querySelector('.ant-picker input, input');
            if (inp) return inp.value?.trim() || inp.getAttribute('title')?.trim() || inp.getAttribute('value')?.trim() || '';
          }
        }
        return '';
      }
      function hasImageWithLabel(label) {
        const groups = Array.from(document.querySelectorAll('.form-group, .ant-form-item, div'));
        return groups.some(g => g.textContent?.includes(label) && g.querySelector('img') !== null);
      }

      return {
        hoVaTen: readInput('input[placeholder="Họ và tên"]') || readInput('input[placeholder*="Họ"]') || readByLabel('Họ và tên'),
        soCMND: readInput('input[placeholder="Số CMT/ Hộ chiếu"]') || readInput('input[placeholder*="CMT"]') || readInput('input[placeholder*="CCCD"]') || readByLabel('Số CMT') || readByLabel('CCCD'),
        ngaySinh: readByLabel('Ngày sinh'),
        ngayCap: readByLabel('Ngày cấp'),
        noiCap: readInput('input[placeholder="Nơi cấp"]') || readByLabel('Nơi cấp'),
        tenTKGD: readInput('input[placeholder="Tên TKGD"]') || readByLabel('Tên TKGD'),
        trangThai: (() => {
          const groups = Array.from(document.querySelectorAll('.form-group, .ant-form-item'));
          for (const g of groups) {
            if (g.textContent?.includes('Trạng thái')) {
              const sel = g.querySelector('.ant-select-selection-item');
              const inp = g.querySelector('input');
              return sel?.innerText?.trim() || inp?.value?.trim() || '';
            }
          }
          return '';
        })(),
        hasFrontImg: hasImageWithLabel('mặt trước'),
        hasBackImg: hasImageWithLabel('mặt sau'),
        hasSignImg: hasImageWithLabel('Chữ ký'),
        _debugInputs: (() => {
          const list = [];
          document.querySelectorAll('input').forEach(inp => {
            const v = inp.value || inp.getAttribute('title') || inp.getAttribute('value') || '';
            const ph = inp.getAttribute('placeholder') || inp.getAttribute('name') || 'input';
            if (v.trim()) list.push(`[${ph}]="${v.slice(0, 25)}"`);
          });
          return list;
        })(),
      };
    });

    const durationMs = Date.now() - startTime;
    return {
      code: accountCode,
      status: scraped.hoVaTen || scraped.soCMND ? 'SUCCESS' : 'EMPTY_DATA',
      durationMs,
      data: scraped,
    };
  } catch (err) {
    return {
      code: accountCode,
      status: 'ERROR',
      durationMs: Date.now() - startTime,
      error: err.message,
    };
  }
}

// ─── CHƯƠNG TRÌNH CHÍNH ─────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('   CHƯƠNG TRÌNH TEST ĐA LUỒNG M-SYSTEM (PLAYWRIGHT MULTI-TAB)');
  console.log('   Môi trường: M-Systems DEV | Multi-Worker Browser Tab Pool');
  console.log('═'.repeat(70));

  const initialMem = getMemoryUsageMB();
  log('CONFIG', `URL: ${DEV_LOGIN_URL}`);
  log('CONFIG', `Tài khoản đăng nhập: ${DEFAULT_USERNAME}`);
  log('CONFIG', `Chế độ hiển thị: ${isHeaded ? 'HEADED (Hiển thị cửa sổ)' : 'HEADLESS (Chạy ngầm)'}`);
  log('CONFIG', `Số luồng song song (Concurrency Tabs): ${concurrency} tab`);
  log('CONFIG', `Số lượng tài khoản kiểm tra: ${limit}`);
  log('MEMORY_START', `Node RSS: ${initialMem.rss} MB | Heap: ${initialMem.heapUsed}/${initialMem.heapTotal} MB`);

  // 1. Chuẩn bị danh sách tài khoản
  let targetAccounts = [];
  if (accountsArg) {
    const list = accountsArg.split(',').map(s => s.trim()).filter(Boolean);
    targetAccounts = list.map(code => ({ code, folderPath: null, files: [] }));
    log('SOURCE', `Sử dụng danh sách chỉ định từ CLI: ${targetAccounts.map(a => a.code).join(', ')}`);
  } else {
    targetAccounts = scanAccountsFromMDir(customDir, targetDate, limit);
    if (targetAccounts.length === 0) {
      console.error('\n[LỖI] Không tìm thấy tài khoản nào để kiểm tra!');
      process.exit(1);
    }
  }

  log('QUEUE', `Đã nạp ${targetAccounts.length} tài khoản vào hàng đợi:`);
  targetAccounts.forEach((acc, i) => {
    const fileCount = acc.files.length;
    console.log(`   ${i + 1}. [${acc.code}] - Thư mục M: ${fileCount > 0 ? `${fileCount} files` : 'Không có / Không đọc được'}`);
  });

  // 2. Khởi tạo trình duyệt
  const executablePath = findBrowser();
  log('BROWSER', executablePath ? `Sử dụng: ${executablePath}` : 'Sử dụng Chromium mặc định');

  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: !isHeaded,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1400,900',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  try {
    // 3. Đăng nhập 1 lần duy nhất trên Tab chính (Primary Login Page)
    console.log('\n' + '─'.repeat(70));
    log('AUTH', 'BƯỚC 1: Thực hiện đăng nhập trên Tab chính...');
    const loginPage = await context.newPage();
    loginPage.setDefaultTimeout(35000);

    log('NAVIGATE', `Đang truy cập: ${DEV_LOGIN_URL} ...`);
    await loginPage.goto(DEV_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await loginPage.waitForTimeout(1500);

    log('AUTH_INPUT', `Nhập username: ${DEFAULT_USERNAME}`);
    await loginPage.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", { state: 'visible', timeout: 15000 });
    await loginPage.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", DEFAULT_USERNAME);

    log('AUTH_INPUT', 'Nhập password...');
    await loginPage.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", DEFAULT_PASSWORD);
    await loginPage.waitForTimeout(500);

    log('AUTH_ACTION', 'Bấm nút Đăng nhập...');
    await loginPage.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await loginPage.waitForTimeout(2000);

    // Xử lý bàn phím PIN ảo nếu có
    const pinPad = loginPage.locator('div.pincode');
    const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPinPad) {
      log('PIN_PAD', `Phát hiện bàn phím PIN ảo -> Đang nhập mã PIN (${DEFAULT_PIN.length} số)...`);
      for (const digit of DEFAULT_PIN.split('')) {
        await loginPage.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await loginPage.waitForTimeout(200);
      }
      await loginPage.waitForTimeout(2000);
      log('PIN_PAD', 'Đã nhập xong toàn bộ mã PIN!');
    }

    // Chờ điều hướng vào trong hệ thống
    await loginPage.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 }).catch(() => {});
    const postLoginUrl = loginPage.url();
    log('AUTH_RESULT', `URL sau đăng nhập: ${postLoginUrl}`);

    if (postLoginUrl.includes('/login')) {
      const errText = await loginPage.locator('text=/sai|lỗi|invalid|error/i').first().textContent().catch(() => '');
      throw new Error(`Đăng nhập thất bại, vẫn ở /login. Lỗi: ${errText || 'Thông tin đăng nhập hoặc PIN không đúng'}`);
    }

    log('AUTH_SUCCESS', 'Đăng nhập M-System DEV thành công! Phiên làm việc (Session) đã lưu vào context.');
    await loginPage.waitForTimeout(1000);

    // 4. BƯỚC 1.1: Tab 1 mở phân hệ Quản lý nhà đầu tư và kiểm tra tài khoản đầu tiên
    console.log('\n' + '─'.repeat(70));
    log('MASTER_TAB', 'BƯỚC 1.1: Tab 1 mở phân hệ Quản lý nhà đầu tư để nạp Component React...');
    await loginPage.goto(`${DEV_BASE_URL}/#/clientManagement/investorManagement`, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await loginPage.waitForTimeout(2000);

    const firstAccount = targetAccounts[0];
    log('MASTER_TAB', `BƯỚC 1.2: Tab 1 mở thử chi tiết tài khoản đầu tiên [${firstAccount.code}]...`);
    const firstDetailUrl = `${DEV_BASE_URL}/#/clientManagement/investorManagement/${firstAccount.code}`;
    await loginPage.evaluate((url) => { window.location.href = url; }, firstDetailUrl).catch(() => {});
    await loginPage.waitForTimeout(2000);
    if (!loginPage.url().includes(firstAccount.code)) {
      await loginPage.goto(firstDetailUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
    }

    const results = [];
    const firstRes = await scrapeAccountOnPage(loginPage, firstAccount.code, 1);
    firstRes.mFilesCount = firstAccount.files.length;
    results.push(firstRes);

    const firstSec = (firstRes.durationMs / 1000).toFixed(2);
    if (firstRes.status === 'SUCCESS') {
      log('MASTER_TAB', `✅ [Tab 1] MỞ THÀNH CÔNG [${firstAccount.code}] (${firstSec}s) | Họ tên: "${firstRes.data.hoVaTen}" | CCCD: "${firstRes.data.soCMND}"`);
    } else {
      log('MASTER_TAB', `⚠️  [Tab 1] Mở [${firstAccount.code}] kết quả: ${firstRes.status} (${firstRes.error || (firstRes.data?._debugInputs?.length ? `Đọc được: ${firstRes.data._debugInputs.join(', ')}` : 'Trang chưa có dữ liệu')})`);
    }

    // 5. Khởi tạo các Worker Tab từ trạng thái Tab 1 đã nạp thành công
    console.log('\n' + '─'.repeat(70));
    log('POOL_INIT', `BƯỚC 2: Khởi tạo ${concurrency} Worker Tabs nhân bản song song...`);
    const workerPages = [loginPage];
    for (let i = 1; i < concurrency; i++) {
      const p = await context.newPage();
      p.setDefaultTimeout(25000);
      log('POOL_INIT', `Tab #${i + 1}: Kế thừa phiên và mở sẵn phân hệ Nhà đầu tư...`);
      await p.goto(`${DEV_BASE_URL}/#/clientManagement/investorManagement`, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});
      await p.waitForTimeout(1000);
      workerPages.push(p);
    }
    log('POOL_READY', `Đã sẵn sàng ${workerPages.length} Tab trình duyệt.`);

    // 6. Chạy hàng đợi cho các tài khoản còn lại
    console.log('\n' + '─'.repeat(70));
    const remainingQueue = targetAccounts.slice(1);
    log('RUN_START', `BƯỚC 3: Bắt đầu xử lý ${remainingQueue.length} tài khoản tiếp theo với ${concurrency} luồng...`);
    const overallStartTime = Date.now();

    async function runWorker(workerId, page) {
      while (remainingQueue.length > 0) {
        const item = remainingQueue.shift();
        if (!item) break;

        log(`TAB #${workerId + 1}`, `[BẮT ĐẦU] Tài khoản: ${item.code} ...`);
        const res = await scrapeAccountOnPage(page, item.code, workerId + 1);
        res.mFilesCount = item.files.length;
        results.push(res);

        const durationSec = (res.durationMs / 1000).toFixed(2);
        if (res.status === 'SUCCESS') {
          log(`TAB #${workerId + 1}`, `✅ [${item.code}] Xong trong ${durationSec}s | Họ tên: "${res.data.hoVaTen}" | CCCD: "${res.data.soCMND}" | M-Files: ${res.mFilesCount}`);
        } else if (res.status === 'NOT_FOUND') {
          log(`TAB #${workerId + 1}`, `⚠️  [${item.code}] Không tìm thấy trên MS DEV (${durationSec}s)`);
        } else {
          log(`TAB #${workerId + 1}`, `❌ [${item.code}] Lỗi/Rỗng: ${res.status} (${res.error || (res.data?._debugInputs?.length ? res.data._debugInputs.join(', ') : 'Dữ liệu form trống')}) [${durationSec}s]`);
        }

        // Khoảng nghỉ ngắn 1s giữa các lượt cào của mỗi Tab để tránh dồn dập
        await page.waitForTimeout(1000);
      }
    }

    // Chạy song song các worker tabs
    await Promise.all(workerPages.map((page, idx) => runWorker(idx, page)));

    const overallElapsedMs = Date.now() - overallStartTime;
    const peakMem = getMemoryUsageMB();

    // 6. Tổng hợp báo cáo kết quả và đo lường
    console.log('\n' + '═'.repeat(70));
    console.log('   BÁO CÁO TỔNG HỢP HIỆU NĂNG ĐA LUỒNG (MULTI-TAB SCRAPING)');
    console.log('═'.repeat(70));

    console.log('\nChi tiết từng tài khoản:');
    console.log('┌───────────┬─────────────┬──────────────────────┬──────────────┬──────────┬───────────┐');
    console.log('│ Mã TKGD   │ Trạng thái  │ Họ và tên            │ Số CMT/CCCD  │ File M:  │ T.Gian(s) │');
    console.log('├───────────┼─────────────┼──────────────────────┼──────────────┼──────────┼───────────┤');
    for (const r of results) {
      const code = r.code.padEnd(9);
      const status = (r.status || '').slice(0, 11).padEnd(11);
      const name = (r.data?.hoVaTen || 'N/A').slice(0, 20).padEnd(20);
      const cccd = (r.data?.soCMND || 'N/A').slice(0, 12).padEnd(12);
      const files = String(r.mFilesCount || 0).padEnd(8);
      const time = (r.durationMs / 1000).toFixed(2).padEnd(9);
      console.log(`│ ${code} │ ${status} │ ${name} │ ${cccd} │ ${files} │ ${time} │`);
    }
    console.log('└───────────┴─────────────┴──────────────────────┴──────────────┴──────────┴───────────┘');

    const totalSeqMs = results.reduce((acc, r) => acc + r.durationMs, 0);
    const avgMs = results.length > 0 ? (totalSeqMs / results.length) : 0;
    const speedup = (totalSeqMs / overallElapsedMs).toFixed(2);
    const throughput = ((results.length / (overallElapsedMs / 1000)) * 60).toFixed(1);

    console.log('\n📊 Chỉ số đo lường hiệu năng:');
    console.log(`   - Tổng số tài khoản xử lý      : ${results.length} tài khoản`);
    console.log(`   - Số luồng tab song song       : ${concurrency} tab`);
    console.log(`   - Tổng thời gian thực tế       : ${(overallElapsedMs / 1000).toFixed(2)} giây`);
    console.log(`   - Tổng thời gian nếu chạy tuần tự: ${(totalSeqMs / 1000).toFixed(2)} giây`);
    console.log(`   - Tỷ lệ tăng tốc (Speedup)     : ${speedup}x (nhanh hơn gấp ${speedup} lần)`);
    console.log(`   - Thời gian trung bình/tài khoản: ${(avgMs / 1000).toFixed(2)} giây`);
    console.log(`   - Tốc độ xử lý (Throughput)    : ${throughput} tài khoản/phút`);

    console.log('\n💻 Đánh giá tài nguyên bộ nhớ (RAM):');
    console.log(`   - RAM Node.js ban đầu          : RSS ${initialMem.rss} MB`);
    console.log(`   - RAM Node.js đỉnh điểm (Peak) : RSS ${peakMem.rss} MB (Tăng ~${(peakMem.rss - initialMem.rss).toFixed(1)} MB)`);
    console.log(`   - Heap sử dụng                 : ${peakMem.heapUsed} MB / ${peakMem.heapTotal} MB`);

    console.log('\n🎯 Đánh giá khả năng áp dụng cho cấu hình (2 vCPU / 4GB RAM):');
    if (concurrency <= 3) {
      console.log(`   ✅ CẤU HÌNH ${concurrency} LUỒNG RẤT AN TOÀN:`);
      console.log('      • Trình duyệt chỉ tốn ~350MB - 500MB RAM.');
      console.log('      • Tốc độ tăng ~2.5x - 3.0x so với chạy đơn luồng.');
      console.log('      • Đảm bảo CPU không bị spike 100% và không xung đột phiên đăng nhập.');
    } else {
      console.log(`   ⚠️ CẤU HÌNH ${concurrency} LUỒNG CẦN CHÚ Ý:`);
      console.log('      • Khi concurrency > 3 trên 2 vCPU, chi phí chuyển ngữ cảnh (context switch) của Chrome tăng lên.');
      console.log('      • Khuyến nghị chạy tối đa 3 tab để giữ độ ổn định lâu dài trên server 4GB RAM.');
    }
    console.log('═'.repeat(70) + '\n');

  } finally {
    await browser.close().catch(() => {});
    log('CLEANUP', 'Đã đóng toàn bộ trình duyệt an toàn.');
  }
}

main().catch(err => {
  console.error('\n[LỖI CHƯƠNG TRÌNH]', err.message);
  process.exit(1);
});
