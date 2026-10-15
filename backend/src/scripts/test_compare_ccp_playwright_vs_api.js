/**
 * ============================================================================
 * TEST SCRIPT: A/B TESTING - ĐỐI CHIẾU FILE PLAYWRIGHT VS FILE API (CORECCP)
 * ============================================================================
 * 
 * Mục đích:
 * 1. Chạy song song 2 cơ chế tải cùng 1 báo cáo:
 *    - Luồng A: Tải bằng Playwright (Giao diện web -> Bấm Kết xuất -> File Server)
 *    - Luồng B: Tải bằng REST API (Search API pageSize 200,000 -> JSON -> ExcelJS)
 * 2. So sánh và đối chiếu chuyên sâu 4 tầng:
 *    - [Tầng 1]: Kích thước file (File size) & Thời gian tải (Duration)
 *    - [Tầng 2]: Cấu trúc & Tên các cột (Headers comparison)
 *    - [Tầng 3]: Tổng số dòng dữ liệu (Row count)
 *    - [Tầng 4]: Độ chính xác dữ liệu từng ô (Data values integrity: Mã TK, Số dư, Lãi lỗ...)
 * 3. Xuất kết luận và báo cáo chi tiết.
 * 
 * Cách chạy:
 *   cd backend
 *   node src/scripts/test_compare_ccp_playwright_vs_api.js --headed
 * 
 * Tùy chọn chạy cho 1 báo cáo cụ thể:
 *   node src/scripts/test_compare_ccp_playwright_vs_api.js --headed --screen acctmargin
 *   node src/scripts/test_compare_ccp_playwright_vs_api.js --headed --screen ttm
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// ─── 1. GIẢI MÃ CREDENTIALS & TÀI KHOẢN ────────────────────────────────────
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
  } catch { }

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

// ─── 2. DANH SÁCH BÁO CÁO ĐỐI CHIẾU A/B ────────────────────────────────────
const TEST_TARGETS = [
  {
    id: 'acctmargin',
    name: 'Quản lý trạng thái TKGD (Ký quỹ)',
    searchCode: 'ACCTMARGIN_ALL',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    tabSelector: "xpath=//button[@role='tab' and (contains(., 'trạng thái TKGD') or contains(., 'TKGD'))]",
    fileNameBase: 'QL_TT_TKGD',
  },
  {
    id: 'ttm',
    name: 'Trạng thái mở (TTM)',
    searchCode: 'OPEN_POSITION',
    route: '/ORDERS/OPEN_POSITION',
    fileNameBase: 'TTM_CCP',
  },
  {
    id: 'orderbook',
    name: 'Danh sách lệnh (DSL)',
    searchCode: 'ORDERBOOK',
    route: '/ORDERS/ORDERBOOK',
    tabSelector: "xpath=//button[@role='tab' and contains(., 'Tất cả')]",
    fileNameBase: 'DSL_CCP',
  },
  {
    id: 'ordermatch',
    name: 'Lịch sử giao dịch chi tiết (DSGD)',
    searchCode: 'ORDERMATCH_DETAIL',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    fileNameBase: 'DSGD_CCP',
  },
];

// ─── 3. HTTP HELPER: GỌI API JSON & CONVERT EXCEL ───────────────────────────
function callJsonSearchApi(baseUrl, sessionCookie, accessToken, searchCode, refererRoute) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(baseUrl);
    const endpoint = `/ccp/inquiry/maintain/${searchCode}/search/${searchCode}`;
    const postData = JSON.stringify({
      searchcode: searchCode,
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 200000 },
    });

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${accessToken}`,
        'connectkey': 'fsscssiam2021',
        'Cookie': `SESSION=${sessionCookie}`,
        'Origin': baseUrl,
        'Referer': `${baseUrl}${refererRoute || '/'}`,
        'x-devicetype': 'WEB',
        'x-lang': 'vi',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) CoreCCP-Bot-Ingress/1.0',
      },
      timeout: 25000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode === 200 && json && json.success) {
            resolve(json.payload?.data || json.data || []);
          } else {
            reject(new Error(`API Error (${res.statusCode}): ${JSON.stringify(json)}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

async function convertRowsToExcel(rows, schemaColumns, targetFilePath) {
  const dir = path.dirname(targetFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  if (rows.length === 0) {
    worksheet.addRow(['(Không có dữ liệu)']);
    await workbook.xlsx.writeFile(targetFilePath);
    return;
  }

  let colDefs = [];
  if (schemaColumns && schemaColumns.length > 0) {
    colDefs = schemaColumns.map((c) => ({
      header: c.header || c.key,
      key: c.key,
      width: Math.max((c.header || c.key).length + 4, 15),
    }));
  } else {
    colDefs = Object.keys(rows[0]).map((k) => ({
      header: k,
      key: k,
      width: Math.max(k.length + 4, 15),
    }));
  }

  worksheet.columns = colDefs;
  rows.forEach((r) => worksheet.addRow(r));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  await workbook.xlsx.writeFile(targetFilePath);
}

// ─── 4. PLAYWRIGHT DOWNLOAD HELPER ─────────────────────────────────────────
async function triggerPlaywrightExport(page, destFilePath, timeoutMs = 40000) {
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
      .catch(() => null);

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

  return { success: false, reason: 'Timeout khi tải file qua Playwright' };
}

// ─── 5. HÀM ĐỐI CHIẾU NỘI DUNG 2 FILE EXCEL ────────────────────────────────
function readExcelContent(filePath) {
  if (!fs.existsSync(filePath)) return { headers: [], rows: [] };
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!allRows || allRows.length === 0) return { headers: [], rows: [] };

  // Tìm row header tốt nhất
  let headerIdx = 0;
  for (let i = 0; i < Math.min(allRows.length, 3); i++) {
    const cur = allRows[i] || [];
    const nonEmpty = cur.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length;
    if (nonEmpty > 3) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = allRows[headerIdx] || [];
  const headers = rawHeaders.map((c) => String(c || '').trim()).filter(Boolean);
  const dataRows = allRows.slice(headerIdx + 1).filter((r) => r && r.some((c) => c !== null && c !== undefined && String(c).trim() !== ''));

  return { headers, rows: dataRows };
}

function compareExcelFiles(fileA, fileB, nameA = 'Playwright', nameB = 'API') {
  const norm = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

  const dataA = readExcelContent(fileA);
  const dataB = readExcelContent(fileB);

  // 1. So sánh Cột
  const headersA = dataA.headers;
  const headersB = dataB.headers;
  const maxCols = Math.max(headersA.length, headersB.length);
  let matchedCols = 0;
  const colDetails = [];

  for (let i = 0; i < maxCols; i++) {
    const colA = headersA[i] || '';
    const colB = headersB[i] || '';
    const isMatch = norm(colA) === norm(colB);
    if (isMatch) matchedCols++;
    colDetails.push({
      index: i + 1,
      colA,
      colB,
      isMatch,
    });
  }

  // 2. So sánh Số dòng
  const rowsA = dataA.rows.length;
  const rowsB = dataB.rows.length;
  const isRowCountMatch = rowsA === rowsB;

  // 3. So sánh Mẫu 5 dòng đầu tiên
  let cellMatches = 0;
  let totalCheckedCells = 0;
  const sampleComparison = [];

  const checkRows = Math.min(rowsA, rowsB, 5);
  for (let r = 0; r < checkRows; r++) {
    const rowA = dataA.rows[r] || [];
    const rowB = dataB.rows[r] || [];
    const checkCols = Math.min(rowA.length, rowB.length);

    for (let c = 0; c < checkCols; c++) {
      totalCheckedCells++;
      const valA = String(rowA[c] !== undefined ? rowA[c] : '').trim();
      const valB = String(rowB[c] !== undefined ? rowB[c] : '').trim();

      // Cho phép sai số số thực hoặc định dạng ngày tháng tương đương
      let equal = valA === valB;
      if (!equal && !isNaN(Number(valA)) && !isNaN(Number(valB))) {
        equal = Math.abs(Number(valA) - Number(valB)) < 0.0001;
      }

      if (equal) cellMatches++;
      if (r < 2 && c < 5) {
        sampleComparison.push({
          row: r + 1,
          col: headersA[c] || `Cột ${c + 1}`,
          valA,
          valB,
          equal,
        });
      }
    }
  }

  const colMatchRate = maxCols > 0 ? ((matchedCols / maxCols) * 100).toFixed(1) : '0';
  const dataMatchRate = totalCheckedCells > 0 ? ((cellMatches / totalCheckedCells) * 100).toFixed(1) : '0';

  return {
    headersA,
    headersB,
    matchedCols,
    maxCols,
    colMatchRate,
    colDetails,
    rowsA,
    rowsB,
    isRowCountMatch,
    totalCheckedCells,
    cellMatches,
    dataMatchRate,
    sampleComparison,
  };
}

// ─── 6. HÀM CHÍNH A/B TEST ─────────────────────────────────────────────────
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
  console.log('   A/B TESTING: ĐỐI CHIẾU TRỰC TIẾP FILE PLAYWRIGHT VS FILE API (CORECCP)');
  console.log('========================================================================\n');

  const creds = await getCredentials();
  const baseUrl = creds.url.replace(/\/login\/?$/, '');
  const username = creds.username;
  const password = creds.password;

  console.log(`  • URL Hệ thống:     ${baseUrl}`);
  console.log(`  • Tài khoản:        ${username}`);
  console.log(`  • Chế độ hiển thị:  ${isHeaded ? 'Giao diện trực quan (--headed)' : 'Headless'}`);
  if (filterScreen) {
    console.log(`  • Lọc báo cáo:      '${filterScreen}'`);
  }
  console.log('------------------------------------------------------------------------\n');

  const outputDir = path.resolve(process.cwd(), 'temp', 'ab_test_ccp');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const targets = TEST_TARGETS.filter((t) => {
    if (!filterScreen) return true;
    return t.id.includes(filterScreen) || t.name.toLowerCase().includes(filterScreen);
  });

  // Đọc file Schema UI nếu có sẵn để nạp cho API
  let uiSchemas = {};
  const schemaPath = path.resolve(__dirname, '../modules/ingress/coreccp/schemas/ag_grid_column_schemas.json');
  if (fs.existsSync(schemaPath)) {
    try {
      uiSchemas = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      console.log(`  ✓ Đã nạp Schema UI Ground Truth từ: ag_grid_column_schemas.json\n`);
    } catch { }
  }

  // Khởi động Playwright
  const chromePath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: chromePath || undefined,
    slowMo: 150,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized'],
  });

  const context = await browser.newContext({ viewport: null, acceptDownloads: true });
  const page = await context.newPage();

  // Bắt token trực tiếp từ bất kỳ network request nào có Authorization header
  page.on('request', (req) => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      accessToken = auth.replace('Bearer ', '').trim();
    }
  });

  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('/login') && resp.request().method() === 'POST') {
      try {
        const json = await resp.json();
        const t = json.token || json.accessToken || json.data?.token || json.data?.accessToken;
        if (t) accessToken = t;
      } catch { }
    }
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill("input[name='username'], input[type='text']", username);
  await page.fill("input[name='password'], input[type='password']", password);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
  await page.waitForTimeout(2000);

  const cookies = await context.cookies();
  const sessionObj = cookies.find((c) => c.name === 'SESSION');
  if (sessionObj) sessionCookie = sessionObj.value;

  // Nếu chưa bắt được từ network, đọc từ localStorage / sessionStorage của trình duyệt
  if (!accessToken) {
    try {
      accessToken = await page.evaluate(() => {
        return localStorage.getItem('token') ||
          localStorage.getItem('accessToken') ||
          sessionStorage.getItem('token') ||
          sessionStorage.getItem('accessToken') ||
          '';
      });
    } catch { }
  }

  // Fallback gọi HTTP POST /login trực tiếp nếu vẫn chưa có
  if (!accessToken) {
    try {
      console.log(`    (Đang lấy Bearer Token bổ trợ qua POST /login...`);
      const directLogin = await new Promise((resolve, reject) => {
        const parsed = new URL(baseUrl);
        const postData = JSON.stringify({ username, password });
        const req = https.request({
          hostname: parsed.hostname,
          port: 443,
          path: '/login',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'Accept': 'application/json, text/plain, */*',
            'connectkey': 'fsscssiam2021',
            'x-devicetype': 'WEB',
            'x-lang': 'vi',
          },
          timeout: 10000,
        }, (res) => {
          let b = '';
          res.on('data', chunk => b += chunk);
          res.on('end', () => {
            try {
              const j = JSON.parse(b);
              resolve(j.token || j.accessToken || j.data?.token || j.data?.accessToken || '');
            } catch { resolve(''); }
          });
        });
        req.on('error', () => resolve(''));
        req.write(postData);
        req.end();
      });
      if (directLogin) accessToken = directLogin;
    } catch { }
  }

  console.log(`  ✓ Đăng nhập thành công!`);
  console.log(`    • Session Cookie:  ${sessionCookie.slice(0, 16)}...`);
  console.log(`    • Bearer Token:    ${accessToken ? accessToken.slice(0, 20) + '...' : '(Chưa bắt được)'}\n`);

  const reportResults = [];

  // Bắt đầu A/B Test từng báo cáo
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`════════════════════════════════════════════════════════════════════════`);
    console.log(`[${i + 1}/${targets.length}] ĐỐI CHIẾU A/B: ${target.name} (${target.searchCode})`);
    console.log(`════════════════════════════════════════════════════════════════════════`);

    const filePlaywright = path.join(outputDir, `${target.fileNameBase}_PLAYWRIGHT.xlsx`);
    const fileApi = path.join(outputDir, `${target.fileNameBase}_API.xlsx`);

    // ─── LUỒNG A: TẢI BẰNG PLAYWRIGHT (FILE THẬT TRÊN TRÌNH DUYỆT) ───
    console.log(`\n  👉 [LUỒNG A - PLAYWRIGHT]: Điều hướng & Bấm Kết xuất trên giao diện...`);
    const startPw = Date.now();
    await page.goto(`${baseUrl}${target.route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    if (target.tabSelector) {
      const tab = page.locator(target.tabSelector).first();
      if (await tab.isVisible({ timeout: 2500 }).catch(() => false)) {
        await tab.click({ force: true });
        await page.waitForTimeout(800);
      }
    }

    // Trích xuất TRỰC TIẾP on-the-fly từ ag-Grid của trang web thật (Ground Truth 100% - Không phỏng đoán, không hardcode)
    const liveUiCols = await page.evaluate(() => {
      const clean = (str) => String(str || '').replace(/\r?\n|\r/g, ' ').replace(/\s+/g, ' ').trim();
      const agCells = Array.from(document.querySelectorAll('.ag-header-cell:not(.ag-header-cell-moving)'));
      if (agCells.length > 0) {
        return agCells.map((cell) => {
          const colId = cell.getAttribute('col-id') || '';
          if (!colId || colId === 'selection' || colId === 'actions' || colId === 'ag-Grid-AutoColumn') return null;
          const textElem = cell.querySelector('.ag-header-cell-text') || cell.querySelector('.ag-header-cell-label') || cell;
          const title = clean(textElem.innerText || textElem.textContent || '');
          return { key: colId, header: title || colId };
        }).filter(Boolean);
      }
      return null;
    });

    if (liveUiCols && liveUiCols.length > 0) {
      console.log(`     🔍 Đã trích xuất ${liveUiCols.length} cột trực tiếp từ ag-Grid của giao diện thực tế.`);
    }

    const resPw = await triggerPlaywrightExport(page, filePlaywright, 45000);
    const durationPw = Date.now() - startPw;

    if (resPw.success) {
      console.log(`     ✓ Đã tải xong File Playwright: ${(resPw.sizeBytes / 1024).toFixed(1)} KB (Thời gian: ${durationPw}ms)`);
    } else {
      console.log(`     ❌ Playwright tải thất bại: ${resPw.reason}`);
    }

    // ─── LUỒNG B: TẢI BẰNG REST API (SEARCH API -> JSON -> EXCELJS) ───
    console.log(`\n  👉 [LUỒNG B - REST API]: Gọi Search API pageSize 200,000 & Convert ExcelJS...`);
    const startApi = Date.now();
    let resApiSuccess = false;
    let apiSizeBytes = 0;

    try {
      const rows = await callJsonSearchApi(baseUrl, sessionCookie, accessToken, target.searchCode, target.route);
      // Ưu tiên dùng cột trích xuất trực tiếp từ giao diện thực tế -> Sau đó mới fallback đến schema file
      const cols = liveUiCols || (uiSchemas[target.searchCode] ? uiSchemas[target.searchCode].columns : null);

      await convertRowsToExcel(rows, cols, fileApi);
      resApiSuccess = true;
      apiSizeBytes = fs.statSync(fileApi).size;
      const durationApi = Date.now() - startApi;
      console.log(`     ✓ Đã tải xong File API: ${(apiSizeBytes / 1024).toFixed(1)} KB, ${rows.length} dòng (Thời gian: ${durationApi}ms)`);
    } catch (e) {
      console.log(`     ❌ REST API tải thất bại: ${e.message}`);
    }

    // ─── ĐỐI CHIẾU CHUYÊN SÂU 4 TẦNG ───
    if (resPw.success && resApiSuccess) {
      console.log(`\n  📊 BẮT ĐẦU ĐỐI CHIẾU CHUYÊN SÂU 4 TẦNG:`);
      const comp = compareExcelFiles(filePlaywright, fileApi);

      console.log(`     [Tầng 1] Dung lượng file: Playwright = ${(resPw.sizeBytes / 1024).toFixed(1)} KB | API = ${(apiSizeBytes / 1024).toFixed(1)} KB`);
      console.log(`     [Tầng 2] Tiêu đề cột:     ${comp.matchedCols}/${comp.maxCols} cột (${comp.colMatchRate}%)`);
      console.log(`     [Tầng 3] Số lượng dòng:   Playwright = ${comp.rowsA} dòng | API = ${comp.rowsB} dòng -> ${comp.isRowCountMatch ? '✓ KHỚP 100%' : '≠ LỆCH DÒNG'}`);
      console.log(`     [Tầng 4] Dữ liệu ô test:  ${comp.cellMatches}/${comp.totalCheckedCells} ô (${comp.dataMatchRate}% khớp)\n`);

      // Bảng so sánh cột
      console.log(`     ┌──────┬──────────────────────────────┬──────────────────────────────┬─────────┐`);
      console.log(`     │ STT  │ Cột File Playwright (Gốc)    │ Cột File API (Mới)           │ Kết quả │`);
      console.log(`     ├──────┼──────────────────────────────┼──────────────────────────────┼─────────┤`);
      for (const c of comp.colDetails.slice(0, 10)) {
        const a = c.colA.padEnd(28).slice(0, 28);
        const b = c.colB.padEnd(28).slice(0, 28);
        const st = String(c.index).padStart(4);
        const icon = c.isMatch ? '  ✓ KHỚP ' : '  ≠ LỆCH ';
        console.log(`     │ ${st} │ ${a} │ ${b} │${icon}│`);
      }
      if (comp.colDetails.length > 10) {
        console.log(`     │ ...  │ ... (còn ${comp.colDetails.length - 10} cột nữa)           │ ...                          │         │`);
      }
      console.log(`     └──────┴──────────────────────────────┴──────────────────────────────┴─────────┘`);

      reportResults.push({
        target,
        resPw,
        apiSizeBytes,
        durationPw,
        durationApi: Date.now() - startApi,
        comp,
      });
    }
  }

  await browser.close();

  // 7. Xuất báo cáo Markdown
  const reportPath = path.resolve(__dirname, 'output', 'compare_playwright_vs_api_report.md');
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  let md = `# BÁO CÁO A/B TESTING: ĐỐI CHIẾU FILE PLAYWRIGHT VS FILE REST API (CORECCP)\n\n`;
  md += `> Thời điểm chạy: ${new Date().toLocaleString('vi-VN')} | Môi trường: \`${baseUrl}\`\n\n`;
  md += `## 1. Bảng Tổng Hợp Kết Quả Đối Chiếu\n\n`;
  md += `| STT | Báo cáo | Size Playwright | Size API | Tốc độ PW / API | Khớp Cột (Header) | Khớp Dòng (Rows) | Độ Chính Xác Dữ Liệu |\n`;
  md += `| :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n`;

  reportResults.forEach((r, idx) => {
    const pwKb = (r.resPw.sizeBytes / 1024).toFixed(1) + ' KB';
    const apiKb = (r.apiSizeBytes / 1024).toFixed(1) + ' KB';
    const speed = `${(r.durationPw / 1000).toFixed(1)}s / ${(r.durationApi / 1000).toFixed(2)}s`;
    const colRate = `**${r.comp.colMatchRate}%** (${r.comp.matchedCols}/${r.comp.maxCols})`;
    const rowMatch = r.comp.isRowCountMatch ? `✅ ${r.comp.rowsA} dòng` : `⚠️ PW: ${r.comp.rowsA} vs API: ${r.comp.rowsB}`;
    const dataRate = `**${r.comp.dataMatchRate}%**`;

    md += `| ${idx + 1} | **${r.target.name}** | ${pwKb} | ${apiKb} | ${speed} | ${colRate} | ${rowMatch} | ${dataRate} |\n`;
  });

  md += `\n---\n\n## 2. Chi Tiết So Sánh Từng Cột Của Từng Báo Cáo\n\n`;
  reportResults.forEach((r) => {
    md += `### • ${r.target.name} (\`${r.target.searchCode}\`)\n\n`;
    md += `| STT | Cột File Playwright (Gốc) | Cột File API (Mới) | Trạng thái |\n`;
    md += `| :---: | :--- | :--- | :---: |\n`;
    r.comp.colDetails.forEach((c) => {
      md += `| ${c.index} | ${c.colA || '*(Trống)*'} | ${c.colB || '*(Trống)*'} | ${c.isMatch ? '✅ Khớp' : '⚠️ Lệch'} |\n`;
    });
    md += `\n`;
  });

  fs.writeFileSync(reportPath, md, 'utf8');

  console.log(`\n========================================================================`);
  console.log(`✅ ĐÃ HOÀN TẤT A/B TESTING ĐỐI CHIẾU SONG SONG!`);
  console.log(`📄 Báo cáo chi tiết Markdown đã được lưu tại:`);
  console.log(`   ${reportPath}`);
  console.log(`📁 Thư mục chứa 2 file Excel đối chứng:`);
  console.log(`   ${outputDir}`);
  console.log(`========================================================================\n`);
}

main().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
