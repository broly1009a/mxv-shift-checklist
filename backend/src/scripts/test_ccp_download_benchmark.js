/**
 * ============================================================================
 * TEST SCRIPT: TẢI ĐỦ BỘ TẤT CẢ CÁC BÁO CÁO TỪ CORECCP (PLAYWRIGHT BENCHMARK)
 * ============================================================================
 * 
 * Mục đích:
 * 1. Đăng nhập 1 lần duy nhất và tải ĐỦ TOÀN BỘ CÁC FILE BÁO CÁO CỦA CORECCP:
 *    [1] DSGD      : Lịch sử giao dịch (Khớp lệnh CoreCCP)
 *    [2] TTTT      : Trạng thái tất toán (Lịch sử tất toán)
 *    [3] NR        : Lịch sử nộp rút tiền
 *    [4] DSL       : Lịch sử lệnh
 *    [5] EOD       : Báo cáo kết quả EOD
 *    [6] QLTTTKGD  : Quản lý trạng thái tài khoản giao dịch (Ký quỹ, Số dư)
 *    [7] LSGTT     : Quản lý lịch sử giá thanh toán (GTT)
 * 2. Đo lường chính xác thời gian tải từng file và tổng thời gian hoàn tất.
 * 3. Chạy có giao diện trực quan (--headed) để bạn quan sát trực tiếp thao tác.
 * 
 * Cách chạy:
 *   # 1. Tải ĐỦ TẤT CẢ CÁC FILE (Có giao diện trực quan - Mặc định):
 *   node backend/src/scripts/test_ccp_download_benchmark.js --headed
 * 
 *   # 2. Tải đủ tất cả các file cho 1 ngày cụ thể:
 *   node backend/src/scripts/test_ccp_download_benchmark.js --headed --date 12/09/2026
 * 
 *   # 3. Tùy chọn tải riêng 1 file duy nhất nếu muốn:
 *   node backend/src/scripts/test_ccp_download_benchmark.js --headed --report DSGD
 *   node backend/src/scripts/test_ccp_download_benchmark.js --headed --report TTTT
 * 
 *   # 4. Tùy chọn truyền tài khoản qua dòng lệnh (nếu không dùng DB):
 *   node backend/src/scripts/test_ccp_download_benchmark.js --headed --url "https://uat-coreccp.mxv.com.vn/login" --user "hieptruong" --pass "Taovipko0!"
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { chromium } = require('playwright-core');

// ─── 1. BẢNG DANH MỤC TẤT CẢ BÁO CÁO CORECCP ────────────────────────────────
const ALL_CCP_REPORTS = [
  {
    code: 'DSGD',
    name: 'Danh sách giao dịch',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Danh sách giao dịch',
    cachedUrl: '/ORDERS/ORDERMATCH_DETAIL',
    enabled: true,
  },
  {
    code: 'TTTT',
    name: 'Trạng thái tất toán',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái tất toán',
    tabName: 'Lịch sử tất toán',
    cachedUrl: '/ORDERS/PNL_EXECUTED',
    fileNamePrefix: 'TTTT',
  },
  {
    code: 'TTM',
    name: 'Trạng thái mở',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái mở',
    cachedUrl: '/ORDERS/OPEN_POSITION',
    fileNamePrefix: 'TTM',
  },
  {
    code: 'NR',
    name: 'Lịch sử nộp rút tiền',
    parentMenu: 'Quản lý tiền',
    childMenu: 'Lịch sử nộp rút tiền',
    cachedUrl: '/CASHTRANFER/CASHTRANFER_HIST',
    fileNamePrefix: 'NR',
  },
  {
    code: 'DSL',
    name: 'Lịch sử lệnh',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử lệnh',
    cachedUrl: '', // Trên CoreCCP không có /ORDERS/ORDERBOOK_ALL (URL đó của CoreEX), bắt buộc click qua Menu
    fileNamePrefix: 'DSL',
  },
  {
    code: 'EOD',
    name: 'Kết quả EOD',
    parentMenu: 'Vận hành',
    childMenu: 'Kết quả EOD',
    cachedUrl: '/EOD/ACCTMARGIN_HIST',
    fileNamePrefix: 'EOD',
  },
  {
    code: 'QLTTTKGD',
    name: 'Quản lý trạng thái TKGD',
    parentMenu: 'Quản lý rủi ro',
    childMenu: 'Quản lý trạng thái TKGD',
    tabName: 'Danh sách trạng thái TKGD',
    cachedUrl: '/RISKMNG/ACCTMARGIN_ALL',
    fileNamePrefix: 'QLTTTKGD',
  },
  {
    code: 'LSGTT',
    name: 'Quản lý lịch sử giá thanh toán',
    parentMenu: 'Quản lý sản phẩm',
    childMenu: 'Quản lý lịch sử giá thanh toán',
    cachedUrl: '/PRODUCT/SETTLEMENT_HIST',
    fileNamePrefix: 'LSGTT',
  },
];

// ─── 2. GIẢI MÃ CONFIG MONGODB (AES-256) ────────────────────────────────────
function decrypt(ciphertext) {
  if (!ciphertext) return '';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf-8');
  const iv = Buffer.from(process.env.ENCRYPTION_IV || '1234567890123456', 'utf-8');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(ciphertext, 'base64', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

async function getCredentialsFromDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv-shift-checklist';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const SystemSetting = mongoose.model(
      'SystemSettingBenchmarkAll',
      new mongoose.Schema({ key: String, value: String }, { collection: 'system_settings' }),
    );
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    if (setting && setting.value) {
      return JSON.parse(decrypt(setting.value));
    }
  } catch {
    // MongoDB offline hoặc chưa cấu hình
  } finally {
    try { await mongoose.disconnect(); } catch { }
  }
  return null;
}

// ─── 3. TÌM EXECUTABLE CHROME / EDGE ────────────────────────────────────────
function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxCandidates = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const p of linuxCandidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ============================================================================
// CÁC HÀM PORT 1:1 TỪ BASE_PAGE.PY & BASE_REPORT_PAGE.PY & CORE_CCP_PAGE.PY
// ============================================================================

// 1. dismiss_modal_backdrop (Python base_page.py:L13-21)
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 500 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  } catch { }
}

// 2. ensure_sidebar_expanded (Python base_page.py:L23-43)
async function ensureSidebarExpanded(page) {
  await dismissModalBackdrop(page);
  try {
    const sidebarText = page.locator("xpath=//span[text()='Trang chủ'] | //input[contains(@placeholder, 'Tìm kiếm')]").first();
    if (await sidebarText.isVisible({ timeout: 1000 })) return;

    const toggleBtn = page.locator(
      "xpath=//div[contains(@class, 'mui-1rihtzt')] | //div[contains(@class, 'mui-12t1bub')] | //svg[@data-testid='ChevronRightIcon'] | //button[contains(@aria-label, 'open drawer') or contains(@aria-label, 'Mở rộng')]"
    ).first();
    if (await toggleBtn.isVisible({ timeout: 1500 })) {
      await toggleBtn.click({ force: true });
      await page.waitForTimeout(1000);
    }
  } catch { }
}

// 3. wait_for_table_loading_complete (Python base_report_page.py:L10-58)
async function waitForTableLoadingComplete(page, maxTimeoutMs = 60000) {
  console.log('   Đang kiểm tra & chờ bảng hoàn tất nạp dữ liệu từ Server...');
  const startTime = Date.now();
  const maxSec = maxTimeoutMs / 1000.0;

  // Cho 800ms ban đầu để React update state và kích hoạt spinner
  await page.waitForTimeout(800);

  const spinnerSelector =
    "xpath=//*[contains(@class, 'MuiCircularProgress-root') " +
    "or contains(@class, 'MuiLinearProgress-root') " +
    "or contains(@class, 'MuiBackdrop-root') " +
    "or @role='progressbar' " +
    "or contains(@id, 'mrt-progress') " +
    "or contains(@class, 'MuiSkeleton-root')]";

  let stableCount = 0;
  while ((Date.now() - startTime) / 1000.0 < maxSec) {
    const spinners = await page.locator(spinnerSelector).all();
    const visibleSpinners = [];
    for (const s of spinners) {
      try {
        if (await s.isVisible()) visibleSpinners.push(s);
      } catch { }
    }

    if (visibleSpinners.length === 0) {
      stableCount++;
      if (stableCount >= 2) {
        console.log('  ✓ [SUCCESS] Bảng đã hoàn tất nạp dữ liệu (0 loading spinner, 0 backdrop)!');
        await page.waitForTimeout(200);
        return true;
      }
    } else {
      stableCount = 0;
      console.log(`   Phát hiện ${visibleSpinners.length} loading spinner đang hoạt động... Đang chờ...`);
    }

    await page.waitForTimeout(300);
  }

  console.log('   Quá thời gian chờ loading bảng, tiếp tục tiến trình...');
  return false;
}

// 4. navigate_to_report (Python core_ccp_page.py:L35-128)
async function navigateToReport(page, reportCfg, systemUrl) {
  const cachedUrl = reportCfg.cachedUrl || '';
  if (cachedUrl) {
    try {
      const origin = new URL(systemUrl).origin;
      const targetUrl = `${origin}${cachedUrl}`;
      console.log(`  [Direct Nav] Mở thẳng trang báo cáo: ${targetUrl}`);
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      await dismissModalBackdrop(page);

      const checkElem = page.locator("xpath=//button[contains(., 'Tìm kiếm')] | //button[contains(., 'Kết xuất')] | //input[contains(@class, 'MuiPickersInputBase-input')]").first();
      if (await checkElem.isVisible({ timeout: 3000 })) {
        return targetUrl;
      } else {
        console.log('   Mở URL trực tiếp chưa tải xong bảng báo cáo, chuyển sang click Menu...');
      }
    } catch (e) {
      console.log(`   URL cached không phản hồi (${e.message}), chuyển sang điều hướng Menu...`);
    }
  }

  await ensureSidebarExpanded(page);

  const parentMenu = reportCfg.parentMenu || '';
  const subMenu = reportCfg.subMenu || '';
  const childMenu = reportCfg.childMenu || '';

  const parentCandidates = [parentMenu];
  if (parentMenu === 'Quản lý tiền' || parentMenu === 'Nộp rút tiền') {
    parentCandidates.push('Quản lý tiền', 'Nộp rút tiền');
  }

  try {
    let parentElem = null;
    for (const pCand of parentCandidates) {
      if (!pCand) continue;
      const elem = page.locator(`xpath=//span[text()='${pCand}'] | //span[contains(text(), '${pCand}')]`).first();
      if (await elem.isVisible({ timeout: 1500 })) {
        parentElem = elem;
        break;
      }
    }

    if (parentElem) {
      await parentElem.click({ force: true });
      await page.waitForTimeout(800);
    }

    if (subMenu) {
      const subElem = page.locator(`xpath=//span[text()='${subMenu}'] | //span[contains(text(), '${subMenu}')]`).first();
      if (await subElem.isVisible({ timeout: 3000 })) {
        await subElem.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    const childCandidates = [childMenu];
    if (childMenu === 'Lịch sử nộp rút tiền' || childMenu === 'Lịch sử Nộp/ Rút tiền') {
      childCandidates.push('Lịch sử nộp rút tiền', 'Lịch sử Nộp/ Rút tiền');
    } else if (childMenu === 'Lịch sử lệnh' || childMenu === 'Danh sách lệnh') {
      childCandidates.push('Lịch sử lệnh', 'Danh sách lệnh');
    } else if (childMenu === 'Lịch sử giao dịch' || childMenu === 'Danh sách giao dịch') {
      childCandidates.push('Lịch sử giao dịch', 'Danh sách giao dịch');
    } else if (childMenu === 'Trạng thái mở' || childMenu === 'Vị thế mở') {
      childCandidates.push('Trạng thái mở', 'Vị thế mở', 'Danh sách trạng thái mở');
    }

    let childElem = null;
    for (const cand of childCandidates) {
      if (!cand) continue;
      const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
      if (await elem.isVisible({ timeout: 1500 })) {
        childElem = elem;
        break;
      }
    }

    if (childElem) {
      await childElem.click({ force: true });
      await page.waitForTimeout(2000);
    } else if (parentElem) {
      await parentElem.click({ force: true });
      await page.waitForTimeout(800);
      for (const cand of childCandidates) {
        if (!cand) continue;
        const elem = page.locator(`xpath=//span[text()='${cand}'] | //span[contains(text(), '${cand}')]`).first();
        if (await elem.isVisible({ timeout: 1500 })) {
          await elem.click({ force: true });
          await page.waitForTimeout(2000);
          break;
        }
      }
    }
  } catch (ex) {
    console.log(`   Lỗi click menu: ${ex.message}`);
  }

  const learnedUrl = page.url();
  console.log(`  ✓ URL hiện tại: ${learnedUrl}`);
  return learnedUrl;
}

// 5. set_date_range_and_search (Python base_report_page.py:L59-231)
async function setDateRangeAndSearch(page, startDate, endDate, reportCode) {
  await dismissModalBackdrop(page);

  // Chuyển tab 'Lịch sử tất toán' nếu đang ở màn hình Trạng thái tất toán
  const url = page.url();
  if (url.includes('PNL_EXECUTED') || await page.locator("xpath=//*[contains(text(), 'Lịch sử tất toán')]").first().isVisible({ timeout: 1000 }).catch(() => false)) {
    const historyTab = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first();
    if (await historyTab.isVisible({ timeout: 2000 })) {
      console.log("  [Tab] Click chọn tab 'Lịch sử tất toán'...");
      await historyTab.click({ force: true });
      await page.waitForTimeout(1500);
    }
  }

  // 1. Nếu có ô 'Ngày hệ thống' (trên màn hình Lịch sử giao dịch DSGD), XÓA SẠCH
  const sysDateInp = page.locator(
    "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Ngày hệ thống')]]//input" +
    " | //label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input"
  ).first();
  if (await sysDateInp.isVisible({ timeout: 800 }).catch(() => false)) {
    console.log("  [Filter] Xóa trắng 'Ngày hệ thống' để lọc chính xác theo '(Từ) Ngày phiên -> (Đến) Ngày phiên'...");
    await sysDateInp.click({ force: true });
    await page.waitForTimeout(150);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(150);
    await page.keyboard.press('Tab');
  }

  // 2. Định vị chính xác 2 ô '(Từ) Ngày phiên' và '(Đến) Ngày phiên' (hoặc Từ ngày / Đến ngày)
  if (reportCode !== 'QLTTTKGD') {
    const pickerInputs = page.locator(
      "xpath=//div[contains(@class, 'MuiPickersInputBase-root') or contains(@class, 'MuiPickersOutlinedInput-root') or @role='group']//input" +
      " | //input[contains(@class, 'MuiPickersInputBase-input')]"
    );
    const count = await pickerInputs.count();

    let fromInp = null;
    let toInp = null;

    const fromByLabel = page.locator(
      "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Từ') or contains(text(), '(Từ)')]]//input" +
      " | //label[contains(text(), 'Từ') or contains(text(), '(Từ)')]/following-sibling::div//input"
    ).first();
    const toByLabel = page.locator(
      "xpath=//div[contains(@class, 'MuiFormControl-root') or contains(@class, 'MuiPickersInputBase-root')][.//label[contains(text(), 'Đến') or contains(text(), '(Đến)')]]//input" +
      " | //label[contains(text(), 'Đến') or contains(text(), '(Đến)')]/following-sibling::div//input"
    ).first();

    if (await fromByLabel.isVisible({ timeout: 800 }).catch(() => false)) fromInp = fromByLabel;
    if (await toByLabel.isVisible({ timeout: 800 }).catch(() => false)) toInp = toByLabel;

    if (count >= 3) {
      if (!fromInp) fromInp = pickerInputs.nth(1);
      if (!toInp) toInp = pickerInputs.nth(2);
    } else if (count === 2) {
      if (!fromInp) fromInp = pickerInputs.nth(0);
      if (!toInp) toInp = pickerInputs.nth(1);
    }

    if (fromInp && toInp) {
      console.log(`  [Filter] Điền (Từ) Ngày phiên ${startDate} và (Đến) Ngày phiên ${endDate}...`);
      await fromInp.click({ force: true });
      await page.waitForTimeout(200);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(150);
      await page.keyboard.type(startDate, { delay: 40 });
      await page.waitForTimeout(200);
      await page.keyboard.press('Tab');

      await toInp.click({ force: true });
      await page.waitForTimeout(200);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(150);
      await page.keyboard.type(endDate, { delay: 40 });
      await page.waitForTimeout(200);
      await page.keyboard.press('Tab');
    }
  }

  // Click Nút Tìm kiếm
  const searchBtn = page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first();
  if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchBtn.click({ force: true });
    console.log('   Đã bấm Tìm kiếm. Đang chờ API & bảng nạp xong dữ liệu...');
    await waitForTableLoadingComplete(page, 60000);
    await dismissModalBackdrop(page);
  }

  // Kiểm tra nhanh xem bảng có 0 bản ghi không
  let isTableEmpty = false;
  const noDataInTable = page.locator(
    "xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')]"
  ).first();
  if (await noDataInTable.isVisible({ timeout: 600 }).catch(() => false)) {
    console.log("  ℹ️ [Search Result] Bảng hiển thị 0 bản ghi -> Bỏ qua lọc cột, tiến hành kết xuất...");
    isTableEmpty = true;
  }

  return isTableEmpty ? 'EMPTY_TABLE' : 'OK';
}

// 6. trigger_export_download (Python base_report_page.py:L324-429)
async function triggerExportDownload(page, timeoutMs = 120000, isTableEmpty = false) {
  await dismissModalBackdrop(page);
  await waitForTableLoadingComplete(page, 30000);

  // Nếu bảng 0 bản ghi: Nếu sàn cho xuất thì file mẫu (4KB) chỉ mất 2-3s; nếu sàn chặn, chỉ chờ tối đa 6s thay vì 60s!
  const effectiveTimeoutMs = isTableEmpty ? 6000 : timeoutMs;

  // Tìm nút 'Kết xuất'
  let exportBtn = page.locator(
    "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
    " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]"
  ).first();

  if (!(await exportBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
  }

  if (!(await exportBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
    console.log("   Không tìm thấy nút 'Kết xuất'");
    return null;
  }

  let downloadObj = null;

  async function triggerExportWithToastCheck(actionFn) {
    const downloadPromise = page.waitForEvent('download', { timeout: effectiveTimeoutMs })
      .then((d) => { downloadObj = d; return d; })
      .catch(() => null);

    await actionFn();

    // Quét Toast song song bằng page.locator() XPath contains(., ...)
    const startTime = Date.now();
    while (Date.now() - startTime < effectiveTimeoutMs) {
      if (downloadObj) return downloadObj;

      try {
        const toastLocator = page.locator(
          "xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@class, 'Toastify') or contains(@role, 'alert') or contains(@class, 'MuiSnackbar-root')]" +
          "[contains(., 'Không có dữ liệu') or contains(., 'không có dữ liệu') or contains(., 'No data') or contains(., 'No records')]"
        ).first();

        if (await toastLocator.isVisible({ timeout: 150 })) {
          const text = (await toastLocator.textContent()) || '';
          console.log(`  ℹ️ [Toast Thông Báo] "${text.trim()}" -> Hệ thống từ chối xuất file!`);
          return 'NO_DATA';
        }
      } catch { }

      await page.waitForTimeout(200);
    }

    const res = await downloadPromise;
    if (res) return res;
    if (isTableEmpty) {
      console.log('  ℹ️ Không có file tải về sau 6s trên bảng rỗng -> Coi như Không có dữ liệu.');
      return 'NO_DATA';
    }
    return null;
  }

  // PHƯƠNG ÁN 1: Di chuột (Hover) không click vào nút Kết xuất (Python base_report_page.py:L376-406)
  try {
    await exportBtn.hover({ force: true });
    await page.waitForTimeout(400);
  } catch { }

  const exportAllOption = page.locator(
    "xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả']" +
    " | //*[self::li or self::div or self::span or self::p][contains(text(), 'Export all')]"
  ).first();

  if (await exportAllOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log(`  [Xuất Báo Cáo] Chọn 'Xuất tất cả' (Đang tạo file, chờ tối đa ${(effectiveTimeoutMs / 1000).toFixed(0)}s)...`);
    downloadObj = await triggerExportWithToastCheck(() => exportAllOption.click({ force: true }));
  } else {
    // PHƯƠNG ÁN 2 (FALLBACK): Kích đúp 2 lần vào nút Kết xuất (Python base_report_page.py:L407-425)
    console.log(`  [Export Mode: Fallback Double-click] Kích đúp nút 'Kết xuất' (Chờ download tối đa ${(effectiveTimeoutMs / 1000).toFixed(0)}s)...`);
    downloadObj = await triggerExportWithToastCheck(() => exportBtn.dblclick({ force: true }));
  }

  await dismissModalBackdrop(page);
  return downloadObj;
}

// 7. downloadSingleReport (Python report_engine.py:L85-115 + L212-260)
async function downloadSingleReport(page, report, startDateStr, endDateStr, outputDir, systemUrl) {
  const itemStart = Date.now();
  console.log(`\n────────────────────────────────────────────────────────────────────────`);
  console.log(`>>> BẮT ĐẦU TẢI: [${report.code}] ${report.name.toUpperCase()} <<<`);
  console.log(`────────────────────────────────────────────────────────────────────────`);

  // 1. Điều hướng trang báo cáo (Python: page_obj.navigate_to_report)
  const learnedUrl = await navigateToReport(page, report, systemUrl);
  report.cachedUrl = learnedUrl;

  // 2. Lọc thời gian và bấm Tìm kiếm (Python: page_obj.set_date_range_and_search)
  const searchResult = await setDateRangeAndSearch(page, startDateStr, endDateStr, report.code);
  const isTableEmpty = searchResult === 'EMPTY_TABLE';

  const cleanStart = startDateStr.replace(/\//g, '');
  const cleanEnd = endDateStr.replace(/\//g, '');
  const targetFileName = `${report.fileNamePrefix}_${cleanStart}_${cleanEnd}.xlsx`;
  const destFilePath = path.join(outputDir, targetFileName);

  // 3. Kích hoạt tải file (Truyền isTableEmpty vào để dùng adaptive timeout 6s thay vì 60s)
  const downloadResult = await triggerExportDownload(page, 60000, isTableEmpty);
  const durationSec = ((Date.now() - itemStart) / 1000).toFixed(1);

  if (downloadResult === 'NO_DATA') {
    console.log(`  ℹ️ Bỏ qua tạo file do hệ thống xác nhận không có dữ liệu (${durationSec}s).`);
    return {
      code: report.code,
      name: report.name,
      fileName: `${report.fileNamePrefix}_NODATA.xlsx`,
      sizeKb: '0',
      durationSec,
      status: 'KHÔNG CÓ DỮ LIỆU',
      path: null,
    };
  } else if (downloadResult) {
    await downloadResult.saveAs(destFilePath);
    if (fs.existsSync(destFilePath) && fs.statSync(destFilePath).size > 0) {
      const sz = (fs.statSync(destFilePath).size / 1024).toFixed(1);
      console.log(`   ĐÃ TẢI XONG: ${targetFileName} (${sz} KB) trong ${durationSec}s`);
      return {
        code: report.code,
        name: report.name,
        fileName: targetFileName,
        sizeKb: sz,
        durationSec,
        status: 'THÀNH CÔNG',
        path: destFilePath,
      };
    }
  }

  console.log(`   Không sinh file hoặc quá thời gian (${durationSec}s)`);
  return {
    code: report.code,
    name: report.name,
    fileName: targetFileName,
    sizeKb: '0',
    durationSec,
    status: 'THẤT BẠI',
    path: null,
  };
}

// ─── 5. HÀM CHÍNH (ORCHESTRATOR) ───────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || !args.includes('--headless');
  const reportArg = args.find((a, i) => args[i - 1] === '--report');
  const dateArg = args.find((a, i) => args[i - 1] === '--date');
  const startArg = args.find((a, i) => args[i - 1] === '--start');
  const endArg = args.find((a, i) => args[i - 1] === '--end');

  function getArgValue(flag) {
    const idx = args.indexOf(flag);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
  }

  console.log('\n========================================================================');
  console.log('   CORECCP BATCH DOWNLOADER: TẢI ĐỦ BỘ TẤT CẢ FILE BÁO CÁO CA TRỰC');
  console.log('========================================================================\n');

  // Xác định danh sách báo cáo cần tải:
  // Nếu có --report: chỉ tải 1 báo cáo đó.
  // Mặc định (không có --report): TẢI TOÀN BỘ TẤT CẢ BÁO CÁO!
  let reportsToRun = ALL_CCP_REPORTS;
  if (reportArg) {
    const single = ALL_CCP_REPORTS.find((r) => r.code.toUpperCase() === reportArg.toUpperCase());
    if (single) {
      reportsToRun = [single];
    }
  }

  // Xác định thông tin đăng nhập
  const dbCreds = await getCredentialsFromDB();
  const systemUrl = getArgValue('--url') || dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = getArgValue('--user') || dbCreds?.username || 'hieptruong';
  const password = getArgValue('--pass') || dbCreds?.password || 'Taovipko0!';

  const outputDir = path.resolve(process.cwd(), 'temp', 'test_ccp_downloads');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Xác định ngày tải
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const todayStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
  const startDateStr = dateArg || startArg || todayStr;
  const endDateStr = dateArg || endArg || todayStr;

  console.log(`  • URL Hệ thống:      ${systemUrl}`);
  console.log(`  • Tài khoản:         ${username}`);
  console.log(`  • Chế độ hiển thị:   ${isHeaded ? 'Giao diện trực quan (--headed)' : 'Chạy ngầm (headless)'}`);
  console.log(`  • Khoảng ngày tải:   ${startDateStr} → ${endDateStr}`);
  console.log(`  • Thư mục lưu file:  ${outputDir}`);
  console.log(`  • Số lượng báo cáo:  ${reportsToRun.length} file:`);
  reportsToRun.forEach((r, i) => {
    console.log(`      ${i + 1}. [${r.code}] ${r.name}`);
  });
  console.log('');

  const totalStartTime = Date.now();

  // Khởi động trình duyệt 1 lần duy nhất
  console.log(' Đang khởi động trình duyệt...');
  const execPath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: execPath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
    ],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: null,
  });
  const page = await context.newPage();

  const results = [];

  try {
    // Đăng nhập 1 lần duy nhất (Single Sign-On)
    console.log(`🔑 Đang đăng nhập vào CoreCCP (${systemUrl})...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const userInput = page.locator(
      "input[name='username'], input[placeholder*='ten dang nhap'], input[placeholder*='đăng nhập'], input[type='text']",
    ).first();
    await userInput.waitFor({ state: 'visible', timeout: 15000 });
    await userInput.fill(username);

    await page.fill(
      "input[name='password'], input[placeholder*='mat khau'], input[placeholder*='mật khẩu'], input[type='password']",
      password,
    );
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch { }
    await page.waitForTimeout(1000);

    if (page.url().toLowerCase().includes('/login')) {
      const errMsg = page.locator("xpath=//*[contains(@class, 'MuiAlert-message') or contains(text(), 'không chính xác') or contains(text(), 'khóa') or contains(text(), 'Lỗi')]").first();
      let msg = '';
      try {
        if (await errMsg.isVisible({ timeout: 1500 })) {
          msg = (await errMsg.textContent()) || '';
        }
      } catch { }
      throw new Error(`Đăng nhập thất bại: ${msg.trim() || 'Tên đăng nhập hoặc mật khẩu không đúng (vẫn ở trang /login).'}`);
    }
    console.log('  ✓ Đăng nhập thành công!\n');

    // Chạy vòng lặp tải từng file báo cáo
    for (let i = 0; i < reportsToRun.length; i++) {
      const report = reportsToRun[i];
      console.log(`[Tiến trình ${i + 1}/${reportsToRun.length}] Đang xử lý báo cáo: ${report.code}...`);
      try {
        const res = await downloadSingleReport(page, report, startDateStr, endDateStr, outputDir, systemUrl);
        results.push(res);
      } catch (err) {
        console.log(`   Lỗi khi tải ${report.code}: ${err.message}`);
        results.push({
          code: report.code,
          name: report.name,
          fileName: `${report.fileNamePrefix}.xlsx`,
          sizeKb: '0',
          durationSec: '0',
          status: 'THẤT BẠI',
          path: null,
        });
      }
      await page.waitForTimeout(1000);
    }

  } catch (globalErr) {
    console.error(`\n LỖI TRONG QUÁ TRÌNH THỰC THI: ${globalErr.message}`);
  } finally {
    if (isHeaded) {
      console.log('\n[INFO] Giữ màn hình trong 3 giây trước khi đóng trình duyệt...');
      await page.waitForTimeout(3000);
    }
    await context.close().catch(() => { });
    await browser.close().catch(() => { });
  }

  // ─── BẢNG TỔNG KẾT KẾT QUẢ TẢI ĐỦ CÁC FILE ───────────────────────────────
  const totalElapsed = ((Date.now() - totalStartTime) / 1000).toFixed(1);

  console.log('\n========================================================================================');
  console.log('                   BẢNG TỔNG KẾT TẢI BỘ FILE BÁO CÁO CORECCP');
  console.log('========================================================================================');
  console.log('┌────┬──────────┬─────────────────────────────────────┬──────────────┬───────────┬──────────────┐');
  console.log('│ STT│ MÃ FILE  │ TÊN BÁO CÁO                         │ DUNG LƯỢNG   │ THỜI GIAN │ TRẠNG THÁI   │');
  console.log('├────┼──────────┼─────────────────────────────────────┼──────────────┼───────────┼──────────────┤');

  results.forEach((r, idx) => {
    const stt = String(idx + 1).padStart(2, ' ');
    const code = r.code.padEnd(8, ' ');
    const name = r.name.slice(0, 35).padEnd(35, ' ');
    const sz = (r.sizeKb + ' KB').padStart(12, ' ');
    const dur = (r.durationSec + 's').padStart(9, ' ');
    const status = r.status.padEnd(12, ' ');
    console.log(`│ ${stt} │ ${code} │ ${name} │ ${sz} │ ${dur} │ ${status} │`);
  });

  console.log('├────┴──────────┴─────────────────────────────────────┴──────────────┴───────────┴──────────────┤');
  const successCount = results.filter((r) => r.status === 'THÀNH CÔNG').length;
  const summaryLine = `TỔNG CỘNG: ĐÃ TẢI ${successCount}/${results.length} FILE THÀNH CÔNG TRONG ${totalElapsed} GIÂY`.padEnd(92, ' ');
  console.log(`│ ${summaryLine} │`);
  console.log('└──────────────────────────────────────────────────────────────────────────────────────────────┘\n');

  console.log(`📁 Thư mục lưu trữ toàn bộ các file: ${outputDir}`);
  const downloadedFiles = fs.readdirSync(outputDir);
  console.log(`   Số lượng file hiện có trong thư mục: ${downloadedFiles.length} tệp tin.\n`);
}

main().catch(console.error);
