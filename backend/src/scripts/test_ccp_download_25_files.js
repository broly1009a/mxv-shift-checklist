/**
 * ============================================================================
 * TEST SCRIPT: TẢI TRỌN BỘ 25 FILE BÁO CÁO CORECCP (VNCLEAR PLAYWRIGHT BOT)
 * ============================================================================
 * 
 * Mục đích:
 * Tải chính xác 25 file Excel hàng ngày của Maker từ VNCLEAR (CoreCCP):
 *  - [1] DSL CCP.xlsx         : Danh sách lệnh (Tất cả)
 *  - [2] DSLDK CCP.xlsx       : Lệnh đã khớp
 *  - [3] DSLCK CCP.xlsx       : Lệnh chờ khớp
 *  - [4] DSLDH CCP.xlsx       : Lệnh đã hủy
 *  - [5] DSGD CCP.xlsx        : Danh sách giao dịch
 *  - [6] DSL MM CCP.xlsx      : Lệnh MM (Tất cả)
 *  - [7] DSLDK MM CCP.xlsx    : Lệnh MM đã khớp
 *  - [8] DSLCK MM CCP.xlsx    : Lệnh MM chờ khớp
 *  - [9] DSLDH MM CCP.xlsx    : Lệnh MM đã hủy
 *  - [10] DSGD MM CCP.xlsx    : Giao dịch MM
 *  - [11] TTM truoc 4h20.xlsx : Trạng thái mở phiên chiều (16h15)
 *  - [12] TTM CCP.xlsx        : Trạng thái mở cuối ngày EOD
 *  - [13] TTTT.xlsx           : Trạng thái tất toán vị thế (Tab: Lịch sử tất toán)
 *  - [14] QL TT TKGD truoc 4h20.xlsx: Trạng thái TKGD trước 16h20
 *  - [15] QL TT TKGD.xlsx     : Trạng thái TKGD cuối ngày EOD
 *  - [16] QL TT TVKD.xlsx     : Trạng thái TVKD cuối ngày EOD
 *  - [17] DSQLKQ TKGD.xlsx    : Quản lý ký quỹ TKGD
 *  - [18] DSQLKQ TVKD.xlsx    : Quản lý ký quỹ TVKD
 *  - [19] NR.xlsx             : Lịch sử nộp rút tiền
 *  - [20] DSTKGD ACM.xlsx     : Danh sách tài khoản giao dịch (xuất tất cả)
 *  - [21] GTT CCP.xlsx        : Giá thanh toán cuối ngày
 *  - [22] HH.xlsx             : Danh mục hàng hóa (Nano ACM: PL1NY, CP2CO, SI5CO)
 *  - [23] HĐ CP2CO.xlsx       : Hợp đồng Đồng Nano ACM
 *  - [24] HĐ PL1NY.xlsx       : Hợp đồng Bạch kim Nano ACM
 *  - [25] HĐ SI5CO.xlsx       : Hợp đồng Bạc Nano ACM
 * 
 * Cách chạy:
 *   # 1. Tải ĐỦ 25 FILE (Có giao diện trực quan - Khuyến nghị):
 *   node src/scripts/test_ccp_download_25_files.js --headed
 * 
 *   # 2. Tải riêng Đợt 1 (Trước 16h20 - 2 file):
 *   node src/scripts/test_ccp_download_25_files.js --headed --phase pre1620
 * 
 *   # 3. Tải riêng Đợt 2 (Cuối ngày EOD - 23 file):
 *   node src/scripts/test_ccp_download_25_files.js --headed --phase eod
 * 
 *   # 4. Tải riêng Cụm Hàng hóa & Hợp đồng (HH + HĐ):
 *   node src/scripts/test_ccp_download_25_files.js --headed --report commodity
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { chromium } = require('playwright-core');

// ─── 1. GIẢI MÃ CREDENTIALS TỪ CSDL ─────────────────────────────────────────
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

async function getCredentialsFromDB() {
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
    console.log(`⚠️ Không thể kết nối MongoDB để lấy credentials (${err.message}). Dùng fallback mặc định.`);
  }
  return null;
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

// ─── 2. HELPER PLAYWRIGHT CHUẨN ─────────────────────────────────────────────
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch {}
}

/** Điều hướng an toàn không bị treo bởi Realtime Socket hay API nền UAT */
async function safeNavigate(page, url, timeoutMs = 25000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (err) {
    console.log(`     ⚠️ Cảnh báo điều hướng: ${err.message} (tiếp tục thao tác...)`);
  }
  await page.waitForTimeout(800);
  await dismissModalBackdrop(page);
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
    } catch {}

    const spinners = await page.locator(spinnerSel).all();
    let visible = 0;
    for (const s of spinners) {
      try { if (await s.isVisible()) visible++; } catch {}
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

async function triggerExportDownload(page, destFilePath, timeoutMs = 45000) {
  await dismissModalBackdrop(page);
  await waitForTableLoadingComplete(page, 20000);

  // Đợi cho nút Kết xuất thoát khỏi trạng thái disabled (nếu đang load bảng)
  const activeExportSel = "xpath=//button[(contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export') or .//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']) and not(@disabled) and not(contains(@class, 'Mui-disabled'))]";
  try {
    await page.waitForSelector(activeExportSel, { timeout: 15000 });
  } catch {}

  let exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export')] | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]").first();
  if (!(await exportBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
  }

  if (!(await exportBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log(`     ⚠️ Không tìm thấy nút Kết xuất.`);
    return false;
  }

  try {
    let downloadObj = null;
    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs })
      .then(d => { downloadObj = d; return d; })
      .catch(() => null);

    // Hover để kiểm tra menu popup 'Xuất tất cả'
    try {
      await exportBtn.hover({ force: true });
      await page.waitForTimeout(300);
    } catch {}

    const exportAllOption = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả'] | //*[contains(text(), 'Export all')]").first();
    if (await exportAllOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await exportAllOption.click({ force: true });
    } else {
      // Phương án 2: Kích đúp 2 lần vào nút Kết xuất (Logic cũ chuẩn đang hoạt động)
      await exportBtn.dblclick({ force: true });
    }

    // Chờ Toast báo không có dữ liệu hoặc file tải về
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (downloadObj) break;

      const toast = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@role, 'alert')][contains(., 'Không có dữ liệu') or contains(., 'không có dữ liệu') or contains(., 'No data') or contains(., 'No records')]").first();
      if (await toast.isVisible({ timeout: 150 }).catch(() => false)) {
        console.log(`     ℹ️ Hệ thống báo: "Không có dữ liệu"`);
        return 'NO_DATA';
      }
      await page.waitForTimeout(200);
    }

    const download = await downloadPromise;
    if (download) {
      await download.saveAs(destFilePath);
      if (fs.existsSync(destFilePath) && fs.statSync(destFilePath).size > 0) {
        return true;
      }
    }
  } catch (e) {
    console.log(`     ⚠️ Lỗi tải file: ${e.message}`);
  }
  return false;
}

// ─── 3. CÁC HÀM XỬ LÝ TỪNG CỤM MÀN HÌNH ────────────────────────────────────

/** Cụm 1: Màn hình /ORDERS/ORDERBOOK (DSL thường 4 Tab) */
async function processOrderBook(page, baseUrl, outputDir) {
  console.log(`\n📂 [CỤM 1] Màn hình Danh sách lệnh (/ORDERS/ORDERBOOK) -> 4 File`);
  await safeNavigate(page, `${baseUrl}/ORDERS/ORDERBOOK`);

  const tabs = [
    { name: 'Tất cả', fileName: 'DSL CCP.xlsx' },
    { name: 'Lệnh đã khớp', fileName: 'DSLDK CCP.xlsx' },
    { name: 'Lệnh chờ khớp', fileName: 'DSLCK CCP.xlsx' },
    { name: 'Lệnh đã hủy', fileName: 'DSLDH CCP.xlsx' },
  ];

  const results = [];
  for (const t of tabs) {
    const tStart = Date.now();
    try {
      console.log(`  👉 Chuyển Tab: [${t.name}] -> File: ${t.fileName}...`);
      const tabElem = page.locator(`xpath=//button[@role='tab' and contains(., '${t.name}')] | //div[contains(@class, 'MuiTab-root') and contains(., '${t.name}')]`).first();
      if (await tabElem.isVisible({ timeout: 2500 }).catch(() => false)) {
        await tabElem.click({ force: true });
        await page.waitForTimeout(600);
      }
      const dest = path.join(outputDir, t.fileName);
      const ok = await triggerExportDownload(page, dest, 30000);
      const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`     ${ok ? '✅' : '❌'} ${t.fileName} (${sz} KB) trong ${duration}s`);
      results.push({ file: t.fileName, ok: !!ok, size: sz, time: duration });
    } catch (e) {
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`     ❌ Lỗi Tab [${t.name}]: ${e.message}`);
      results.push({ file: t.fileName, ok: false, size: '0', time: duration });
    }
  }
  return results;
}

/** Cụm 2: Màn hình /ORDERS/ORDERBOOK_MM (DSL MM 4 Tab - Tăng timeout cho dữ liệu lớn) */
async function processOrderBookMM(page, baseUrl, outputDir) {
  console.log(`\n📂 [CỤM 2] Màn hình Danh sách lệnh MM (/ORDERS/ORDERBOOK_MM) -> 4 File`);
  await safeNavigate(page, `${baseUrl}/ORDERS/ORDERBOOK_MM`);

  const tabs = [
    { name: 'Tất cả', fileName: 'DSL MM CCP.xlsx', timeout: 50000 },
    { name: 'Lệnh đã khớp', fileName: 'DSLDK MM CCP.xlsx', timeout: 50000 },
    { name: 'Lệnh chờ khớp', fileName: 'DSLCK MM CCP.xlsx', timeout: 40000 },
    { name: 'Lệnh đã hủy', fileName: 'DSLDH MM CCP.xlsx', timeout: 40000 },
  ];

  const results = [];
  for (const t of tabs) {
    const tStart = Date.now();
    try {
      console.log(`  👉 Chuyển Tab MM: [${t.name}] -> File: ${t.fileName}...`);
      const tabElem = page.locator(`xpath=//button[@role='tab' and contains(., '${t.name}')] | //div[contains(@class, 'MuiTab-root') and contains(., '${t.name}')]`).first();
      if (await tabElem.isVisible({ timeout: 2500 }).catch(() => false)) {
        await tabElem.click({ force: true });
        await page.waitForTimeout(800);
      }
      const dest = path.join(outputDir, t.fileName);
      const ok = await triggerExportDownload(page, dest, t.timeout);
      const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`     ${ok ? '✅' : '❌'} ${t.fileName} (${sz} KB) trong ${duration}s`);
      results.push({ file: t.fileName, ok: !!ok, size: sz, time: duration });
    } catch (e) {
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`     ❌ Lỗi Tab MM [${t.name}]: ${e.message}`);
      results.push({ file: t.fileName, ok: false, size: '0', time: duration });
    }
  }
  return results;
}

/** Cụm 3: Màn hình /RISKMNG/ACCTMARGIN_ALL (Quản lý trạng thái 2 Tab) */
async function processRiskStatus(page, baseUrl, outputDir, isPre1620 = false) {
  console.log(`\n📂 [CỤM 3] Màn hình Quản lý trạng thái TKGD (/RISKMNG/ACCTMARGIN_ALL)`);
  await safeNavigate(page, `${baseUrl}/RISKMNG/ACCTMARGIN_ALL`);

  const results = [];

  // Tab 1: Danh sách trạng thái TKGD
  const tkgdFileName = isPre1620 ? 'QL TT TKGD truoc 4h20.xlsx' : 'QL TT TKGD.xlsx';
  const tStart1 = Date.now();
  try {
    console.log(`  👉 Tab [Danh sách trạng thái TKGD] -> File: ${tkgdFileName}...`);
    const tab1 = page.locator("xpath=//button[@role='tab' and contains(., 'trạng thái TKGD')]").first();
    if (await tab1.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tab1.click({ force: true });
      await page.waitForTimeout(600);
    }
    const dest1 = path.join(outputDir, tkgdFileName);
    const ok1 = await triggerExportDownload(page, dest1, 30000);
    const sz1 = fs.existsSync(dest1) ? (fs.statSync(dest1).size / 1024).toFixed(1) : '0';
    const duration1 = ((Date.now() - tStart1) / 1000).toFixed(1);
    console.log(`     ${ok1 ? '✅' : '❌'} ${tkgdFileName} (${sz1} KB) trong ${duration1}s`);
    results.push({ file: tkgdFileName, ok: !!ok1, size: sz1, time: duration1 });
  } catch (e) {
    const duration1 = ((Date.now() - tStart1) / 1000).toFixed(1);
    results.push({ file: tkgdFileName, ok: false, size: '0', time: duration1 });
  }

  if (!isPre1620) {
    // Tab 2: Danh sách trạng thái TKTVKD
    const tStart2 = Date.now();
    try {
      console.log(`  👉 Tab [Danh sách trạng thái TKTVKD] -> File: QL TT TVKD.xlsx...`);
      const tab2 = page.locator("xpath=//button[@role='tab' and contains(., 'trạng thái TKTVKD')]").first();
      if (await tab2.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab2.click({ force: true });
        await page.waitForTimeout(600);
      }
      const dest2 = path.join(outputDir, 'QL TT TVKD.xlsx');
      const ok2 = await triggerExportDownload(page, dest2, 30000);
      const sz2 = fs.existsSync(dest2) ? (fs.statSync(dest2).size / 1024).toFixed(1) : '0';
      const duration2 = ((Date.now() - tStart2) / 1000).toFixed(1);
      console.log(`     ${ok2 ? '✅' : '❌'} QL TT TVKD.xlsx (${sz2} KB) trong ${duration2}s`);
      results.push({ file: 'QL TT TVKD.xlsx', ok: !!ok2, size: sz2, time: duration2 });
    } catch (e) {
      const duration2 = ((Date.now() - tStart2) / 1000).toFixed(1);
      results.push({ file: 'QL TT TVKD.xlsx', ok: false, size: '0', time: duration2 });
    }
  }

  return results;
}

/** Cụm 4: Màn hình /RISKMNG/ACCTMARGIN_ALL (Hoặc Danh sách Vi phạm Ký Quỹ) -> DSQLKQ */
async function processMarginManagement(page, baseUrl, outputDir) {
  console.log(`\n📂 [CỤM 4] Quản lý ký quỹ (DSQLKQ TKGD & DSQLKQ TVKD)`);
  await safeNavigate(page, `${baseUrl}/RISKMNG/ACCTMARGIN_ALL`);

  const results = [];
  const files = [
    { tabName: 'trạng thái TKGD', fileName: 'DSQLKQ TKGD.xlsx' },
    { tabName: 'trạng thái TKTVKD', fileName: 'DSQLKQ TVKD.xlsx' }
  ];

  for (const f of files) {
    const tStart = Date.now();
    try {
      console.log(`  👉 Tab [${f.tabName}] -> File: ${f.fileName}...`);
      const tab = page.locator(`xpath=//button[@role='tab' and contains(., '${f.tabName}')]`).first();
      if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tab.click({ force: true });
        await page.waitForTimeout(600);
      }
      const dest = path.join(outputDir, f.fileName);
      const ok = await triggerExportDownload(page, dest, 30000);
      const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`     ${ok ? '✅' : '❌'} ${f.fileName} (${sz} KB) trong ${duration}s`);
      results.push({ file: f.fileName, ok: !!ok, size: sz, time: duration });
    } catch (e) {
      const duration = ((Date.now() - tStart) / 1000).toFixed(1);
      results.push({ file: f.fileName, ok: false, size: '0', time: duration });
    }
  }
  return results;
}

/** Cụm 5: Màn hình /PRODUCT/COMMODITY (Hàng hóa & Modal Hợp đồng) */
async function processCommodityAndContracts(page, baseUrl, outputDir) {
  console.log(`\n📂 [CỤM 5] Màn hình Quản lý hàng hóa, hợp đồng (/PRODUCT/COMMODITY)`);
  await safeNavigate(page, `${baseUrl}/PRODUCT/COMMODITY`);
  await waitForTableLoadingComplete(page, 20000);

  const results = [];

  // 1. Xuất file HH.xlsx từ nút Kết xuất trên trang chính
  const tStartHH = Date.now();
  try {
    console.log(`  👉 Xuất danh mục hàng hóa -> File: HH.xlsx...`);
    const hhDest = path.join(outputDir, 'HH.xlsx');
    const okHH = await triggerExportDownload(page, hhDest, 30000);
    const szHH = fs.existsSync(hhDest) ? (fs.statSync(hhDest).size / 1024).toFixed(1) : '0';
    const durHH = ((Date.now() - tStartHH) / 1000).toFixed(1);
    console.log(`     ${okHH ? '✅' : '❌'} HH.xlsx (${szHH} KB) trong ${durHH}s`);
    results.push({ file: 'HH.xlsx', ok: !!okHH, size: szHH, time: durHH });
  } catch (e) {
    const durHH = ((Date.now() - tStartHH) / 1000).toFixed(1);
    results.push({ file: 'HH.xlsx', ok: false, size: '0', time: durHH });
  }

  // 2. Duyệt từng dòng hàng hóa trong bảng để mở Modal -> Tab Thông tin hợp đồng -> Kết xuất
  try {
    const rows = page.locator("xpath=//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
    const rowCount = await rows.count();
    console.log(`  ℹ️ Tìm thấy ${rowCount} dòng hàng hóa trong bảng`);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
      let uacode = (await codeCell.textContent())?.trim();
      if (!uacode) continue;

      const tStartContract = Date.now();
      const contractFileName = `HĐ ${uacode}.xlsx`;
      console.log(`\n  👉 Mở chi tiết hàng hóa [${uacode}] -> File: ${contractFileName}...`);

      const viewBtn = row.locator("xpath=.//td[@data-column-id='actions']//button[@aria-label='Xem']").first();
      if (!(await viewBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        console.log(`     ⚠️ Không tìm thấy nút Xem cho ${uacode}`);
        continue;
      }
      await viewBtn.click({ force: true });
      await page.waitForTimeout(800);

      // Chuyển sang Tab "Thông tin hợp đồng" (#tab-1)
      const contractTab = page.locator("xpath=//button[@id='tab-1' or contains(., 'Thông tin hợp đồng')]").first();
      if (await contractTab.isVisible({ timeout: 3500 }).catch(() => false)) {
        await contractTab.click({ force: true });
        await page.waitForTimeout(800);
        await waitForTableLoadingComplete(page, 15000);

        // Nút Kết xuất bên trong Tabpanel / Modal
        const modalExportBtn = page.locator("xpath=//div[@id='tabpanel-1']//button[contains(@class, 'button-element')] | //button[contains(@class, 'button-element') and contains(., 'Kết xuất')] | //div[@id='tabpanel-1']//button[contains(., 'Kết xuất')] | //button[contains(., 'Kết xuất')]").first();
        if (await modalExportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          const dest = path.join(outputDir, contractFileName);
          const dlPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null);
          await modalExportBtn.click({ force: true });

          // Popup xuất tất cả nếu có
          const exportAll = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div][text()='Xuất tất cả']").first();
          if (await exportAll.isVisible({ timeout: 1500 }).catch(() => false)) {
            await exportAll.click({ force: true });
          }

          const dl = await dlPromise;
          let ok = false;
          if (dl) {
            await dl.saveAs(dest);
            ok = fs.existsSync(dest) && fs.statSync(dest).size > 0;
          }
          const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
          const durContract = ((Date.now() - tStartContract) / 1000).toFixed(1);
          console.log(`     ${ok ? '✅' : '❌'} ${contractFileName} (${sz} KB) trong ${durContract}s`);
          results.push({ file: contractFileName, ok, size: sz, time: durContract });
        }
      }

      // Đóng modal / quay lại chi tiết
      const closeBtn = page.locator("xpath=//button[contains(., 'Quay lại') or contains(., 'Trở về') or contains(., 'Đóng') or @aria-label='close' or contains(., 'Hủy')]").first();
      if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtn.click({ force: true });
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(500);
    }
  } catch (err) {
    console.log(`  ⚠️ Lỗi khi xuất hợp đồng trong modal: ${err.message}`);
  }

  return results;
}

/** Tải màn hình độc lập (Fail-safe, ưu tiên chuyển tab tức thì) */
async function processSingleScreen(page, url, fileName, tabName = null, parentMenu = null, childMenu = null) {
  const tStart = Date.now();
  const baseName = path.basename(fileName);
  console.log(`\n📂 Mở ${url} -> File: ${baseName}...`);

  try {
    await safeNavigate(page, url);

    // ƯU TIÊN 1: Chuyển Tab ngay lập tức (nếu có) để thoát khỏi tab mặc định đang lag
    if (tabName) {
      console.log(`   👉 Chuyển ngay sang Tab: [${tabName}]...`);
      const tab = page.locator(`xpath=//*[self::button or self::div or self::span][contains(text(), '${tabName}')]`).first();
      if (await tab.isVisible({ timeout: 3500 }).catch(() => false)) {
        await tab.click({ force: true });
        await page.waitForTimeout(1000);
      }
    }

    // Kiểm tra nếu trang không có nút Kết xuất và có cấu hình Menu -> Click menu dự phòng
    if (parentMenu && childMenu) {
      const hasBtn = await page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export')] | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]").first().isVisible({ timeout: 2000 }).catch(() => false);
      if (!hasBtn) {
        console.log(`   ℹ️ Không thấy nút Kết xuất trên URL trực tiếp, điều hướng qua Menu [${parentMenu} > ${childMenu}]...`);
        const parentElem = page.locator(`xpath=//span[text()='${parentMenu}'] | //span[contains(text(), '${parentMenu}')]`).first();
        if (await parentElem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await parentElem.click({ force: true });
          await page.waitForTimeout(600);
        }
        const childElem = page.locator(`xpath=//span[text()='${childMenu}'] | //span[contains(text(), '${childMenu}')]`).first();
        if (await childElem.isVisible({ timeout: 2500 }).catch(() => false)) {
          await childElem.click({ force: true });
          await page.waitForTimeout(1200);
        }
      }
    }

    const ok = await triggerExportDownload(page, fileName, 35000);
    const sz = fs.existsSync(fileName) ? (fs.statSync(fileName).size / 1024).toFixed(1) : '0';
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`   ${ok ? '✅' : '❌'} ${baseName} (${sz} KB) trong ${duration}s`);
    return { file: baseName, ok: !!ok, size: sz, time: duration };
  } catch (err) {
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`   ❌ Lỗi khi tải ${baseName}: ${err.message}`);
    return { file: baseName, ok: false, size: '0', time: duration };
  }
}

// ─── 4. HÀM ĐIỀU PHỐI CHÍNH (ORCHESTRATOR) ──────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isHeaded = args.includes('--headed') || !args.includes('--headless');
  const phaseArg = args.find((a, i) => args[i - 1] === '--phase')?.toLowerCase() || 'all';
  const reportArg = args.find((a, i) => args[i - 1] === '--report')?.toLowerCase();

  console.log('\n========================================================================');
  console.log('   CORECCP 25-FILE BATCH DOWNLOADER (PLAYWRIGHT ENTERPRISE)');
  console.log('========================================================================');
  console.log(`- Chế độ hiển thị: ${isHeaded ? 'CÓ GIAO DIỆN (--headed)' : 'HEADLESS'}`);
  console.log(`- Giai đoạn chạy:  ${phaseArg.toUpperCase()}`);

  const dbCreds = await getCredentialsFromDB();
  const systemUrl = dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = dbCreds?.username || 'hieptruong';
  const password = dbCreds?.password || 'Taovipko0!';
  const baseUrl = new URL(systemUrl).origin;

  const outputDir = path.resolve(process.cwd(), 'temp', 'test_ccp_25_downloads');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  console.log(`- Thư mục lưu:    ${outputDir}\n`);

  const chromePath = getChromeExecutablePath();
  const launchOptions = {
    headless: !isHeaded,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const allSummary = [];
  const batchStart = Date.now();

  try {
    // ── BƯỚC 1: ĐĂNG NHẬP ──
    console.log(`🔑 Đang đăng nhập '${username}' vào ${systemUrl}...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill("input[name='username'], input[type='text']", username);
    await page.fill("input[name='password'], input[type='password']", password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);
    console.log(`✅ Đăng nhập thành công!\n`);

    // ── BƯỚC 2: THỰC THI THEO PHASE ──
    if (phaseArg === 'pre1620') {
      // Đợt 1: Trước 16h20 (2 file)
      console.log(`>>> CHẠY ĐỢT 1: GIÁM SÁT TRƯỚC 16H20 (2 FILE) <<<`);
      try {
        const r1 = await processRiskStatus(page, baseUrl, outputDir, true);
        allSummary.push(...r1);
      } catch (e) { console.log(`⚠️ Lỗi cụm Risk: ${e.message}`); }

      try {
        const r2 = await processSingleScreen(page, `${baseUrl}/ORDERS/OPEN_POSITION`, path.join(outputDir, 'TTM truoc 4h20.xlsx'));
        allSummary.push(r2);
      } catch (e) { console.log(`⚠️ Lỗi TTM truoc 4h20: ${e.message}`); }

    } else if (reportArg === 'commodity') {
      // Chỉ chạy riêng cụm Hàng hóa & Hợp đồng
      try {
        const r = await processCommodityAndContracts(page, baseUrl, outputDir);
        allSummary.push(...r);
      } catch (e) { console.log(`⚠️ Lỗi cụm Commodity: ${e.message}`); }

    } else {
      // Mặc định hoặc phase=eod: TẢI ĐẦY ĐỦ BỘ 25 FILE (Từng cụm độc lập)
      console.log(`>>> TIẾN TRÌNH TẢI BỘ FILE TOÀN DIỆN (FAIL-SAFE ISOLATION) <<<`);

      // 1. Cụm Lệnh thường (4 file)
      try {
        const rOrder = await processOrderBook(page, baseUrl, outputDir);
        allSummary.push(...rOrder);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 1: ${e.message}`); }

      // 2. Cụm Lệnh MM (4 file)
      try {
        const rOrderMM = await processOrderBookMM(page, baseUrl, outputDir);
        allSummary.push(...rOrderMM);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 2: ${e.message}`); }

      // 3. Khớp lệnh thường (1 file)
      try {
        const rDsgd = await processSingleScreen(page, `${baseUrl}/ORDERS/ORDERMATCH_DETAIL`, path.join(outputDir, 'DSGD CCP.xlsx'), null, 'Lệnh và vị thế', 'Danh sách giao dịch');
        allSummary.push(rDsgd);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 3: ${e.message}`); }

      // 4. Khớp lệnh MM (1 file)
      try {
        const rDsgdMM = await processSingleScreen(page, `${baseUrl}/ORDERS/ORDERMATCH_DETAIL_MM`, path.join(outputDir, 'DSGD MM CCP.xlsx'), null, 'Lệnh và vị thế', 'Danh sách giao dịch MM');
        allSummary.push(rDsgdMM);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 4: ${e.message}`); }

      // 5. Trạng thái mở cuối ngày (1 file)
      try {
        const rTtm = await processSingleScreen(page, `${baseUrl}/ORDERS/OPEN_POSITION`, path.join(outputDir, 'TTM CCP.xlsx'), null, 'Lệnh và vị thế', 'Trạng thái mở');
        allSummary.push(rTtm);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 5: ${e.message}`); }

      // 6. Trạng thái tất toán (1 file - Chuyển ngay sang tab 'Lịch sử tất toán')
      try {
        const rTttt = await processSingleScreen(page, `${baseUrl}/ORDERS/PNL_EXECUTED`, path.join(outputDir, 'TTTT.xlsx'), 'Lịch sử tất toán', 'Lệnh và vị thế', 'Trạng thái tất toán');
        allSummary.push(rTttt);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 6: ${e.message}`); }

      // 7. Cụm Trạng thái rủi ro (2 file)
      try {
        const rRisk = await processRiskStatus(page, baseUrl, outputDir, false);
        allSummary.push(...rRisk);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 7: ${e.message}`); }

      // 8. Cụm Quản lý ký quỹ (2 file)
      try {
        const rMargin = await processMarginManagement(page, baseUrl, outputDir);
        allSummary.push(...rMargin);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 8: ${e.message}`); }

      // 9. Nộp rút tiền (1 file)
      try {
        const rNr = await processSingleScreen(page, `${baseUrl}/CASHTRANFER/CASHTRANFER_HIST`, path.join(outputDir, 'NR.xlsx'), null, 'Quản lý tiền', 'Lịch sử nộp rút tiền');
        allSummary.push(rNr);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 9: ${e.message}`); }

      // 10. Danh sách TKGD (1 file - xuất tất cả không filter)
      try {
        const rDstkgd = await processSingleScreen(page, `${baseUrl}/ACCOUNTMNG/ACCOUNTS_INFO`, path.join(outputDir, 'DSTKGD ACM.xlsx'), null, 'Quản lý tài khoản', 'Danh sách tài khoản giao dịch');
        allSummary.push(rDstkgd);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 10: ${e.message}`); }

      // 11. Giá thanh toán (1 file)
      try {
        const rGtt = await processSingleScreen(page, `${baseUrl}/PRODUCT/SETTLEMENT`, path.join(outputDir, 'GTT CCP.xlsx'), null, 'Quản lý sản phẩm', 'Giá thanh toán');
        allSummary.push(rGtt);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 11: ${e.message}`); }

      // 12. Cụm Hàng hóa & Hợp đồng modal (HH + HĐ CP2CO, PL1NY, SI5CO...)
      try {
        const rComm = await processCommodityAndContracts(page, baseUrl, outputDir);
        allSummary.push(...rComm);
      } catch (e) { console.log(`⚠️ Lỗi Cụm 12: ${e.message}`); }
    }

  } catch (err) {
    console.error(`\n❌ LỖI TRONG QUÁ TRÌNH THỰC THI: ${err.message}`);
  } finally {
    const totalSec = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log('\n========================================================================');
    console.log(`   KẾT QUẢ TẢI BÁO CÁO CORECCP (HOÀN TẤT TRONG ${totalSec} GIÂY)`);
    console.log('========================================================================');
    console.table(allSummary.map((s, i) => ({
      STT: i + 1,
      'Tên Tệp': s.file,
      'Trạng Thái': s.ok ? '✅ Thành công' : '❌ Thất bại',
      'Kích Thước (KB)': s.size,
      'Thời Gian (s)': s.time,
    })));

    console.log(`\n📂 Thư mục chứa file: ${outputDir}`);
    console.log('⏳ Giữ trình duyệt thêm 5 giây trước khi đóng...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

main().catch(console.error);
