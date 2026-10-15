/**
 * ============================================================================
 * TEST SCRIPT: KIỂM CHỨNG TIÊU ĐỀ CỘT TRÊN GIAO DIỆN CORECCP VS FILE EXCEL XUẤT RA
 * ============================================================================
 * 
 * Mục đích:
 * 1. Truy cập trực tiếp các màn hình nghiệp vụ trọng điểm của CoreCCP.
 * 2. Đọc chính xác toàn bộ Tiêu đề cột (Headers) đang hiển thị trên giao diện (UI Grid).
 * 3. Bấm nút "Kết xuất" để tải file Excel (.xlsx) thực tế về máy.
 * 4. Đọc Header Row từ file Excel vừa tải về.
 * 5. So sánh, đối chiếu 1-1 từng cột giữa Giao diện và File Excel:
 *    - Số lượng cột có khớp không?
 *    - Tên cột tiếng Việt trên giao diện có tương ứng 100% với file Excel không?
 *    - Có cột nào bị ẩn/thêm/bớt khi xuất ra Excel không?
 * 6. Xuất báo cáo đối chiếu chi tiết ra Console và file Markdown:
 *    backend/src/scripts/output/ccp_ui_vs_excel_headers_audit.md
 * 
 * Lệnh chạy từ terminal:
 *   cd backend
 *   node src/scripts/test_verify_ccp_ui_vs_excel_headers.js --headed
 * 
 * Tùy chọn chạy cho 1 màn hình cụ thể:
 *   node src/scripts/test_verify_ccp_ui_vs_excel_headers.js --headed --screen acctmargin
 *   node src/scripts/test_verify_ccp_ui_vs_excel_headers.js --headed --screen ttm
 *   node src/scripts/test_verify_ccp_ui_vs_excel_headers.js --headed --screen tttt
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');

// Tải cấu hình môi trường
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// ─── 1. GIẢI MÃ CREDENTIALS & LẤY TÀI KHOẢN ────────────────────────────────
function decryptAES256(ciphertext) {
  if (!ciphertext) return '';
  try {
    const key = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
    const parts = ciphertext.split(':');
    if (parts.length !== 2) return ciphertext;
    const iv = Buffer.from(parts[0], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return ciphertext;
  }
}

async function getCredentials() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv_shift_checklist';
  try {
    const conn = await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
    const row = await conn.connection.db.collection('bot_credentials').findOne({ botType: 'CCP' });
    if (row && row.credentialsEncrypted) {
      const dec = decryptAES256(row.credentialsEncrypted);
      const parsed = JSON.parse(dec);
      await mongoose.disconnect();
      return parsed;
    }
    await mongoose.disconnect();
  } catch (err) {
    console.log(`[AUTH] Không thể kết nối MongoDB (${err.message}). Dùng fallback env/mặc định.`);
  }

  return {
    url: process.env.CORECCP_URL || 'https://uat-coreccp.mxv.com.vn',
    username: process.env.CORECCP_USERNAME || 'hieptruong',
    password: process.env.CORECCP_PASSWORD || 'Taovipko0!',
  };
}

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

// ─── 2. DANH SÁCH MÀN HÌNH KIỂM CHỨNG ──────────────────────────────────────
const TEST_SCREENS = [
  {
    id: 'acctmargin_tkgd',
    name: 'Quản lý trạng thái TKGD (Tab: Danh sách trạng thái TKGD)',
    url: '/RISKMNG/ACCTMARGIN_ALL',
    tabSelector: "xpath=//button[@role='tab' and (contains(., 'trạng thái TKGD') or contains(., 'TKGD'))]",
    expectedFileName: 'QL TT TKGD.xlsx',
  },
  {
    id: 'acctmargin_tvkd',
    name: 'Quản lý trạng thái TKGD (Tab: Danh sách trạng thái TKTVKD)',
    url: '/RISKMNG/ACCTMARGIN_ALL',
    tabSelector: "xpath=//button[@role='tab' and (contains(., 'trạng thái TKTVKD') or contains(., 'TVKD'))]",
    expectedFileName: 'QL TT TVKD.xlsx',
  },
  {
    id: 'ttm',
    name: 'Trạng thái mở (TTM)',
    url: '/ORDERS/OPEN_POSITION',
    expectedFileName: 'TTM CCP.xlsx',
  },
  {
    id: 'tttt',
    name: 'Trạng thái tất toán (TTTT - Tab: Lịch sử tất toán)',
    url: '/ORDERS/PNL_EXECUTED',
    tabSelector: "xpath=//button[@role='tab' and (contains(., 'Lịch sử tất toán') or contains(., 'tất toán'))]",
    expectedFileName: 'TTTT.xlsx',
  },
  {
    id: 'orderbook',
    name: 'Danh sách lệnh (DSL - Tab: Tất cả)',
    url: '/ORDERS/ORDERBOOK',
    tabSelector: "xpath=//button[@role='tab' and contains(., 'Tất cả')]",
    expectedFileName: 'DSL CCP.xlsx',
  },
  {
    id: 'ordermatch',
    name: 'Danh sách giao dịch chi tiết (DSGD)',
    url: '/ORDERS/ORDERMATCH_DETAIL',
    expectedFileName: 'DSGD CCP.xlsx',
  },
  {
    id: 'cashtranfer',
    name: 'Lịch sử Nộp/ Rút tiền (NR)',
    url: '/CASHTRANFER/CASHTRANFER_HIST',
    expectedFileName: 'NR.xlsx',
  },
  {
    id: 'accounts_info',
    name: 'Danh sách tài khoản giao dịch (DSTKGD ACM)',
    url: '/ACCOUNTMNG/ACCOUNTS_INFO',
    expectedFileName: 'DSTKGD ACM.xlsx',
  },
  {
    id: 'settlement',
    name: 'Quản lý giá thanh toán (GTT)',
    url: '/PRODUCT/SETTLEMENT',
    expectedFileName: 'GTT CCP.xlsx',
  },
];

// ─── 3. TIỆN ÍCH PLAYWRIGHT & TRÍCH XUẤT ───────────────────────────────────
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch { }
}

async function waitForTableLoadingComplete(page, maxTimeoutMs = 30000) {
  const startTime = Date.now();
  await page.waitForTimeout(500);

  const spinnerSel = "xpath=//*[contains(@class, 'MuiCircularProgress-root') or contains(@class, 'MuiLinearProgress-root') or contains(@class, 'MuiBackdrop-root') or @role='progressbar' or contains(@id, 'mrt-progress') or contains(@class, 'MuiSkeleton-root')]";
  let stableCount = 0;

  while ((Date.now() - startTime) < maxTimeoutMs) {
    try {
      const noData = page.locator("xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data') or contains(text(), 'No records')] | //*[text()='Không có dữ liệu']").first();
      if (await noData.isVisible({ timeout: 150 }).catch(() => false)) return true;
    } catch { }

    const spinners = await page.locator(spinnerSel).all();
    let visible = 0;
    for (const s of spinners) {
      try { if (await s.isVisible()) visible++; } catch { }
    }

    if (visible === 0) {
      stableCount++;
      if (stableCount >= 2) return true;
    } else {
      stableCount = 0;
    }
    await page.waitForTimeout(250);
  }
  return false;
}

/**
 * Trích xuất toàn bộ Tiêu đề cột từ giao diện trình duyệt (UI DOM)
 */
async function extractUiHeaders(page) {
  return await page.evaluate(() => {
    const clean = (str) => {
      if (!str) return '';
      return String(str).replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
    };

    // 1. Thử quét ag-Grid header cells
    const agCells = Array.from(document.querySelectorAll('.ag-header-cell:not(.ag-header-cell-moving)'));
    if (agCells.length > 0) {
      const headers = [];
      for (const cell of agCells) {
        const colId = cell.getAttribute('col-id') || '';
        // Bỏ qua cột checkbox chọn dòng hoặc menu thao tác
        if (colId === 'selection' || colId === 'actions' || colId === 'ag-Grid-AutoColumn') continue;

        const textElem = cell.querySelector('.ag-header-cell-text') ||
          cell.querySelector('.ag-header-cell-label') ||
          cell;
        const title = clean(textElem.innerText || textElem.textContent || '');
        if (title || colId) {
          headers.push({ colId, title: title || `[${colId}]` });
        }
      }
      if (headers.length > 0) return headers;
    }

    // 2. Thử Material-UI DataGrid / MRT Headers [role='columnheader']
    const roleHeaders = Array.from(document.querySelectorAll('[role="columnheader"]'));
    if (roleHeaders.length > 0) {
      const headers = [];
      for (const cell of roleHeaders) {
        const colId = cell.getAttribute('data-field') || cell.getAttribute('col-id') || '';
        if (colId === '__check__' || colId === 'actions') continue;

        const titleElem = cell.querySelector('.MuiDataGrid-columnHeaderTitle') || cell;
        const title = clean(titleElem.innerText || titleElem.textContent || '');
        if (title || colId) {
          headers.push({ colId, title: title || `[${colId}]` });
        }
      }
      if (headers.length > 0) return headers;
    }

    // 3. Fallback table thead th
    const ths = Array.from(document.querySelectorAll('table thead th'));
    if (ths.length > 0) {
      return ths.map((th, idx) => ({
        colId: `col_${idx}`,
        title: clean(th.innerText || th.textContent || ''),
      })).filter((h) => h.title && h.title !== ' ' && !h.title.includes('Chọn tất cả'));
    }

    return [];
  });
}

/**
 * Kích hoạt nút Kết xuất và lưu file Excel
 */
async function triggerExportDownload(page, destFilePath, timeoutMs = 40000) {
  await dismissModalBackdrop(page);
  await waitForTableLoadingComplete(page, 20000);

  const activeExportSel = "xpath=//button[(contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export') or .//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']) and not(@disabled) and not(contains(@class, 'Mui-disabled'))]";
  try {
    await page.waitForSelector(activeExportSel, { timeout: 10000 });
  } catch { }

  let exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export')] | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]").first();
  if (!(await exportBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
    exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
  }

  if (!(await exportBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    return { success: false, reason: 'Không tìm thấy nút Kết xuất' };
  }

  try {
    let downloadObj = null;
    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs })
      .then((d) => { downloadObj = d; return d; })
      .catch((e) => null);

    try {
      await exportBtn.hover({ force: true });
      await page.waitForTimeout(300);
    } catch { }

    const exportAllOption = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả'] | //*[contains(text(), 'Export all')]").first();
    if (await exportAllOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await exportAllOption.click({ force: true });
    } else {
      await exportBtn.dblclick({ force: true });
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (downloadObj) break;
      const toast = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@role, 'alert')][contains(., 'Không có dữ liệu') or contains(., 'No data')]").first();
      if (await toast.isVisible({ timeout: 150 }).catch(() => false)) {
        return { success: false, reason: 'Hệ thống báo: Không có dữ liệu' };
      }
      await page.waitForTimeout(200);
    }

    const download = await downloadPromise;
    if (download) {
      await download.saveAs(destFilePath);
      if (fs.existsSync(destFilePath) && fs.statSync(destFilePath).size > 0) {
        return { success: true, filePath: destFilePath, sizeBytes: fs.statSync(destFilePath).size };
      }
    }
  } catch (err) {
    return { success: false, reason: err.message };
  }

  return { success: false, reason: 'Timeout khi tải file' };
}

/**
 * Đọc tiêu đề các cột từ file Excel đã tải về
 */
function extractExcelHeaders(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (!rows || rows.length === 0) return [];

  // Tìm row header tốt nhất (Row có nhiều ô text không rỗng nhất trong 3 row đầu)
  let bestRow = rows[0] || [];
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cur = rows[i] || [];
    const nonEmpty = cur.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
    const bestNonEmpty = bestRow.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (nonEmpty > bestNonEmpty) {
      bestRow = cur;
    }
  }

  return bestRow.map((c) => (c !== null && c !== undefined ? String(c).trim() : '')).filter(Boolean);
}

// ─── 4. HÀM SO SÁNH ĐỐI CHIẾU ──────────────────────────────────────────────
function compareHeaders(uiHeaders, excelHeaders) {
  const normalize = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const uiTitles = uiHeaders.map((h) => h.title);
  const comparison = [];

  const maxLen = Math.max(uiTitles.length, excelHeaders.length);
  let perfectMatches = 0;

  for (let i = 0; i < maxLen; i++) {
    const uiTitle = uiTitles[i] || '';
    const excelTitle = excelHeaders[i] || '';
    const colId = uiHeaders[i]?.colId || '';

    const isMatch = normalize(uiTitle) === normalize(excelTitle);
    if (isMatch) perfectMatches++;

    comparison.push({
      index: i + 1,
      colId,
      uiTitle,
      excelTitle,
      isMatch,
    });
  }

  const matchPercent = maxLen > 0 ? ((perfectMatches / maxLen) * 100).toFixed(1) : '0';

  return {
    totalUiColumns: uiTitles.length,
    totalExcelColumns: excelHeaders.length,
    perfectMatches,
    matchPercent,
    comparison,
  };
}

// ─── 5. HÀM CHÍNH ──────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || !args.includes('--headless');

  let filterScreen = '';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--screen' && args[i + 1]) {
      filterScreen = args[++i].toLowerCase();
    }
  }

  console.log('\n========================================================================');
  console.log('   CORECCP: KIỂM CHỨNG TIÊU ĐỀ CỘT GIAO DIỆN (UI) VS FILE EXCEL XUẤT RA');
  console.log('========================================================================\n');

  const creds = await getCredentials();
  const baseUrl = creds.url.replace(/\/login\/?$/, '');
  const username = creds.username;
  const password = creds.password;

  console.log(`  • URL Hệ thống:     ${baseUrl}`);
  console.log(`  • Tài khoản:        ${username}`);
  console.log(`  • Chế độ hiển thị:  ${isHeaded ? 'Giao diện trực quan (--headed)' : 'Chạy ngầm (headless)'}`);
  if (filterScreen) {
    console.log(`  • Bộ lọc màn hình:  '${filterScreen}'`);
  }
  console.log('------------------------------------------------------------------------\n');

  const outputDir = path.resolve(process.cwd(), 'temp', 'test_ccp_header_verification');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const chromePath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: chromePath || undefined,
    slowMo: 200,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null, acceptDownloads: true });
  const page = await context.newPage();

  // 1. Đăng nhập
  console.log(`🔑 [1/2] Đang đăng nhập vào CoreCCP (${baseUrl}/login)...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill("input[name='username'], input[type='text']", username);
  await page.fill("input[name='password'], input[type='password']", password);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
  await page.waitForTimeout(1500);
  await dismissModalBackdrop(page);
  console.log('  ✓ Đăng nhập thành công!\n');

  // 2. Lọc danh sách màn hình
  const screensToTest = TEST_SCREENS.filter((s) => {
    if (!filterScreen) return true;
    return s.id.includes(filterScreen) || s.name.toLowerCase().includes(filterScreen) || s.url.toLowerCase().includes(filterScreen);
  });

  console.log(`📋 [2/2] Bắt đầu kiểm chứng ${screensToTest.length} màn hình...\n`);

  const auditReport = [];

  for (let i = 0; i < screensToTest.length; i++) {
    const screen = screensToTest[i];
    console.log(`════════════════════════════════════════════════════════════════════════`);
    console.log(`[${i + 1}/${screensToTest.length}] ${screen.name}`);
    console.log(`   Route: ${screen.url} | File kỳ vọng: ${screen.expectedFileName}`);

    try {
      // Điều hướng đến URL
      await page.goto(`${baseUrl}${screen.url}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1000);
      await dismissModalBackdrop(page);

      // Nếu có tab thì click chuyển tab
      if (screen.tabSelector) {
        console.log(`   👉 Đang kích hoạt Tab đặc thù...`);
        const tab = page.locator(screen.tabSelector).first();
        if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await tab.click({ force: true });
          await page.waitForTimeout(800);
        }
      }

      // Đợi bảng tải xong
      await waitForTableLoadingComplete(page, 20000);
      await page.waitForTimeout(500);

      // BƯỚC A: Trích xuất tiêu đề cột trên giao diện UI
      console.log(`   🔍 Đang đọc tiêu đề cột trên giao diện (UI Grid)...`);
      const uiHeaders = await extractUiHeaders(page);
      console.log(`   ✓ UI Grid có: ${uiHeaders.length} cột.`);

      // BƯỚC B: Bấm Kết xuất để tải file Excel
      console.log(`   📥 Đang ấn nút 'Kết xuất' để tải file Excel thực tế...`);
      const destFilePath = path.join(outputDir, screen.expectedFileName);
      const dlRes = await triggerExportDownload(page, destFilePath, 40000);

      let excelHeaders = [];
      if (dlRes.success) {
        console.log(`   ✓ Đã tải file Excel: ${(dlRes.sizeBytes / 1024).toFixed(1)} KB`);
        excelHeaders = extractExcelHeaders(destFilePath);
        console.log(`   ✓ File Excel có: ${excelHeaders.length} cột.`);
      } else {
        console.log(`   ⚠️ Không tải được file Excel: ${dlRes.reason}`);
      }

      // BƯỚC C: So sánh đối chiếu
      const comp = compareHeaders(uiHeaders, excelHeaders);

      console.log(`\n   📊 KẾT QUẢ ĐỐI CHIẾU:`);
      console.log(`      • Cột trên UI:     ${comp.totalUiColumns}`);
      console.log(`      • Cột trong Excel: ${comp.totalExcelColumns}`);
      console.log(`      • Khớp hoàn toàn:  ${comp.perfectMatches}/${Math.max(comp.totalUiColumns, comp.totalExcelColumns)} (${comp.matchPercent}%)\n`);

      // In chi tiết 10 cột đầu mẫu
      console.log(`   ┌──────┬──────────────────────────────┬──────────────────────────────┬─────────┐`);
      console.log(`   │ STT  │ Tiêu đề trên UI (Giao diện)  │ Tiêu đề trong File Excel     │ Kết quả │`);
      console.log(`   ├──────┼──────────────────────────────┼──────────────────────────────┼─────────┤`);
      for (const row of comp.comparison.slice(0, 15)) {
        const u = row.uiTitle.padEnd(28).slice(0, 28);
        const e = row.excelTitle.padEnd(28).slice(0, 28);
        const st = String(row.index).padStart(4);
        const icon = row.isMatch ? '  ✓ KHỚP ' : '  ≠ LỆCH ';
        console.log(`   │ ${st} │ ${u} │ ${e} │${icon}│`);
      }
      if (comp.comparison.length > 15) {
        console.log(`   │ ...  │ ... (còn ${comp.comparison.length - 15} cột nữa)           │ ...                          │         │`);
      }
      console.log(`   └──────┴──────────────────────────────┴──────────────────────────────┴─────────┘\n`);

      auditReport.push({
        screen,
        dlRes,
        comp,
      });
    } catch (err) {
      console.error(`   ❌ Lỗi khi xử lý màn hình ${screen.name}: ${err.message}`);
    }
  }

  await browser.close();

  // 3. Tự động trích xuất và lưu Schema Cột UI vào file JSON chuẩn
  const schemaOutputDir = path.resolve(__dirname, '../modules/ingress/coreccp/schemas');
  const standaloneSchemaDir = path.resolve(__dirname, '../../../coreccp-api-client/src/schemas');
  if (!fs.existsSync(schemaOutputDir)) fs.mkdirSync(schemaOutputDir, { recursive: true });
  if (!fs.existsSync(standaloneSchemaDir)) fs.mkdirSync(standaloneSchemaDir, { recursive: true });

  const generatedSchemas = {};
  auditReport.forEach((item) => {
    const { screen, comp } = item;
    const columns = comp.comparison
      .filter((r) => r.uiTitle || r.colId)
      .map((r) => ({
        key: r.colId || `col_${r.index}`,
        header: r.uiTitle || r.excelTitle || r.colId,
      }));

    generatedSchemas[screen.id.toUpperCase()] = {
      screenId: screen.id,
      screenName: screen.name,
      route: screen.url,
      expectedFileName: screen.expectedFileName,
      totalColumns: columns.length,
      columns,
    };
  });

  const schemaJsonPath = path.join(schemaOutputDir, 'ag_grid_column_schemas.json');
  const standaloneJsonPath = path.join(standaloneSchemaDir, 'ag_grid_column_schemas.json');
  fs.writeFileSync(schemaJsonPath, JSON.stringify(generatedSchemas, null, 2), 'utf8');
  fs.writeFileSync(standaloneJsonPath, JSON.stringify(generatedSchemas, null, 2), 'utf8');

  // 4. Xuất báo cáo Markdown
  const reportPath = path.resolve(__dirname, 'output', 'ccp_ui_vs_excel_headers_audit.md');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  let mdContent = `# BÁO CÁO KIỂM CHỨNG: TIÊU ĐỀ CỘT GIAO DIỆN CORECCP (UI) VS FILE EXCEL XUẤT RA\n\n`;
  mdContent += `> Thời điểm chạy: ${new Date().toLocaleString('vi-VN')} | Môi trường: \`${baseUrl}\`\n\n`;
  mdContent += `## 1. Bảng Tổng Hợp Độ Tương Thích Từng Màn Hình\n\n`;
  mdContent += `| STT | Màn hình nghiệp vụ | File Excel | Số cột UI | Số cột Excel | Tỷ lệ khớp 1-1 | Đánh giá |\n`;
  mdContent += `| :---: | :--- | :--- | :---: | :---: | :---: | :--- |\n`;

  auditReport.forEach((item, idx) => {
    const { screen, comp, dlRes } = item;
    const status = !dlRes.success ? '❌ Không tải được file' : comp.matchPercent >= 90 ? '🟢 Khớp chuẩn (≥90%)' : '🟡 Cần bổ sung alias';
    mdContent += `| ${idx + 1} | **${screen.name}** | \`${screen.expectedFileName}\` | ${comp.totalUiColumns} | ${comp.totalExcelColumns} | **${comp.matchPercent}%** (${comp.perfectMatches}/${Math.max(comp.totalUiColumns, comp.totalExcelColumns)}) | ${status} |\n`;
  });

  mdContent += `\n---\n\n## 2. Chi Tiết Đối Chiếu Từng Cột Cho Từng Màn Hình\n\n`;

  auditReport.forEach((item) => {
    const { screen, comp } = item;
    mdContent += `### • [${screen.id.toUpperCase()}] ${screen.name} (File: \`${screen.expectedFileName}\`)\n\n`;
    mdContent += `| STT | Mã cột (col-id / JSON key) | Tiêu đề Giao diện (UI) | Tiêu đề trong File Excel | Trạng thái |\n`;
    mdContent += `| :---: | :--- | :--- | :--- | :---: |\n`;
    comp.comparison.forEach((r) => {
      mdContent += `| ${r.index} | \`${r.colId || '-'}\` | ${r.uiTitle || '*(Trống)*'} | ${r.excelTitle || '*(Trống)*'} | ${r.isMatch ? '✅ Khớp' : '⚠️ Lệch'} |\n`;
    });
    mdContent += `\n`;
  });

  fs.writeFileSync(reportPath, mdContent, 'utf8');
  console.log(`========================================================================`);
  console.log(`✅ ĐÃ HOÀN THÀNH KIỂM CHỨNG TOÀN DIỆN!`);
  console.log(`🎯 ĐÃ TỰ ĐỘNG LƯU SCHEMA CỘT CHUẨN TỪ UI RA:`);
  console.log(`   ${schemaJsonPath}`);
  console.log(`   ${standaloneJsonPath}`);
  console.log(`📄 Báo cáo chi tiết Markdown đã được lưu tại:`);
  console.log(`   ${reportPath}`);
  console.log(`📁 Các file Excel tải về nằm tại:`);
  console.log(`   ${outputDir}`);
  console.log(`========================================================================\n`);
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
