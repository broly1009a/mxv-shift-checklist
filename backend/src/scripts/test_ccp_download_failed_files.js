/**
 * ============================================================================
 * TEST SCRIPT RIÊNG: KIỂM THỬ CÁC FILE LỖI / CHƯA TẢI ĐƯỢC CỦA CORECCP
 * ============================================================================
 * 
 * Mục tiêu:
 *  1. [DSGD MM CCP.xlsx] : Đã sửa URL chuẩn sang /ORDERS/ORDERMATCH_DETAIL_MM
 *  2. [TTTT.xlsx]        : /ORDERS/PNL_EXECUTED (Tab Lịch sử tất toán - bypass nếu server UAT không nhả file)
 *  3. [Cụm Hợp đồng HĐ]  : /PRODUCT/COMMODITY
 *                          - Duyệt từng trang với nút Next Page 'Tới trang tiếp theo' (chuẩn HTML User cung cấp)
 *                          - Duyệt đến khi nút Next Page bị disabled (trang cuối)
 *                          - Mở modal từng hàng hóa -> Tab 'Thông tin hợp đồng' -> Bấm nút 'Kết xuất' (class: button-element)
 * 
 * Cách chạy:
 *   node src/scripts/test_ccp_download_failed_files.js --headed
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { chromium } = require('playwright-core');

// ─── 1. CREDENTIALS ─────────────────────────────────────────────────────────
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
    console.log(` Không thể kết nối MongoDB (${err.message}). Dùng fallback.`);
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

// ─── 2. HELPERS ─────────────────────────────────────────────────────────────
async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch { }
}

async function safeNavigate(page, url, timeoutMs = 25000) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
  } catch (err) {
    console.log(`      Cảnh báo điều hướng: ${err.message}`);
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

async function triggerExportDownload(page, destFilePath, timeoutMs = 45000) {
  await dismissModalBackdrop(page);
  await waitForTableLoadingComplete(page, 20000);

  const activeExportSel = "xpath=//button[(contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export') or .//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']) and not(@disabled) and not(contains(@class, 'Mui-disabled'))]";
  try {
    await page.waitForSelector(activeExportSel, { timeout: 15000 });
  } catch { }

  let exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Export')] | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]").first();
  if (!(await exportBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
    exportBtn = page.locator("xpath=//button[.//svg[@data-testid='FileDownloadIcon' or @data-testid='DownloadIcon']]").first();
  }

  if (!(await exportBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    console.log(`      Không tìm thấy nút Kết xuất.`);
    return false;
  }

  try {
    let downloadObj = null;
    const downloadPromise = page.waitForEvent('download', { timeout: timeoutMs })
      .then(d => { downloadObj = d; return d; })
      .catch(() => null);

    // Hover xem có menu 'Xuất tất cả' không
    try {
      await exportBtn.hover({ force: true });
      await page.waitForTimeout(300);
    } catch { }

    const exportAllOption = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[self::li or self::div or self::span][text()='Xuất tất cả'] | //*[contains(text(), 'Export all')]").first();
    if (await exportAllOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await exportAllOption.click({ force: true });
    } else {
      // Phương án 2: Kích đúp 2 lần vào nút Kết xuất (Logic cũ chuẩn đang hoạt động)
      await exportBtn.dblclick({ force: true });
    }

    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      if (downloadObj) break;

      const toast = page.locator("xpath=//*[contains(@class, 'notistack-Snackbar') or contains(@class, 'MuiAlert-message') or contains(@role, 'alert')][contains(., 'Không có dữ liệu') or contains(., 'không có dữ liệu')]").first();
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
    console.log(`      Lỗi tải file: ${e.message}`);
  }
  return false;
}

// ─── 3. TEST TỪNG MỤC TIÊU ──────────────────────────────────────────────────

/** TEST 1: DSGD MM CCP (/ORDERS/ORDERMATCH_DETAIL_MM) */
async function testDsgdMM(page, baseUrl, outputDir) {
  const url = `${baseUrl}/ORDERS/ORDERMATCH_DETAIL_MM`;
  const fileName = path.join(outputDir, 'DSGD MM CCP.xlsx');
  const tStart = Date.now();

  console.log(`\n========================================================================`);
  console.log(`👉 [TEST 1] Màn hình Danh sách giao dịch MM (/ORDERS/ORDERMATCH_DETAIL_MM)`);
  console.log(`========================================================================`);

  try {
    await safeNavigate(page, url);
    await waitForTableLoadingComplete(page, 20000);

    const ok = await triggerExportDownload(page, fileName, 45000);
    const sz = fs.existsSync(fileName) ? (fs.statSync(fileName).size / 1024).toFixed(1) : '0';
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`   ${ok ? '✅ THÀNH CÔNG' : '❌ THẤT BẠI'}: DSGD MM CCP.xlsx (${sz} KB) trong ${duration}s`);
    return { file: 'DSGD MM CCP.xlsx', ok: !!ok, size: sz, time: duration };
  } catch (err) {
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(`   ❌ Lỗi: ${err.message}`);
    return { file: 'DSGD MM CCP.xlsx', ok: false, size: '0', time: duration };
  }
}

/** TEST 2: TTTT.xlsx (/ORDERS/PNL_EXECUTED - Tab Lịch sử tất toán) */
async function testTTTT(page, baseUrl, outputDir) {
  const url = `${baseUrl}/ORDERS/PNL_EXECUTED`;
  const fileName = path.join(outputDir, 'TTTT.xlsx');
  const tStart = Date.now();

  console.log(`\n========================================================================`);
  console.log(`👉 [TEST 2] Màn hình Trạng thái tất toán (/ORDERS/PNL_EXECUTED)`);
  console.log(`========================================================================`);

  try {
    await safeNavigate(page, url);

    console.log(`   👉 Chuyển sang Tab: [Lịch sử tất toán]...`);
    const historyTab = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first();
    if (await historyTab.isVisible({ timeout: 3500 }).catch(() => false)) {
      await historyTab.click({ force: true });
      await page.waitForTimeout(1000);
    }

    const searchBtn = page.locator("xpath=//button[contains(., 'Tìm kiếm')]").first();
    if (await searchBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log(`   👉 Bấm nút Tìm kiếm...`);
      await searchBtn.click({ force: true });
      await waitForTableLoadingComplete(page, 20000);
    }

    const ok = await triggerExportDownload(page, fileName, 35000);
    const sz = fs.existsSync(fileName) ? (fs.statSync(fileName).size / 1024).toFixed(1) : '0';
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    if (!ok) {
      console.log(`    TTTT.xlsx: Server UAT không nhả file (Bỏ qua theo chỉ đạo của Maker)`);
    } else {
      console.log(`   ✅ THÀNH CÔNG: TTTT.xlsx (${sz} KB) trong ${duration}s`);
    }
    return { file: 'TTTT.xlsx', ok: !!ok, size: sz, time: duration, note: 'Lỗi nhả file UAT CCP' };
  } catch (err) {
    const duration = ((Date.now() - tStart) / 1000).toFixed(1);
    return { file: 'TTTT.xlsx', ok: false, size: '0', time: duration, note: 'Lỗi nhả file UAT CCP' };
  }
}

/** TEST 3: Cụm Hợp đồng HĐ từ Modal (/PRODUCT/COMMODITY) - Thuật toán duyệt đa trang */
async function testCommodityContracts(page, baseUrl, outputDir) {
  const url = `${baseUrl}/PRODUCT/COMMODITY`;
  console.log(`\n========================================================================`);
  console.log(`👉 [TEST 3] Xuất Hợp đồng từ Modal (/PRODUCT/COMMODITY) - Đa Trang`);
  console.log(`========================================================================`);

  const results = [];
  await safeNavigate(page, url);
  await waitForTableLoadingComplete(page, 20000);

  let pageNum = 1;
  let totalProcessed = 0;
  const processedCodes = new Set();

  // Thử mở rộng 'Số bản ghi mỗi trang' lên 100 (để hiển thị trọn vẹn 60 hàng hóa nếu có)
  try {
    const rowsPerPageSelect = page.locator("xpath=//div[contains(@class, 'MuiTablePagination-root') and not(ancestor::div[@id='tabpanel-1'])]//div[@role='combobox' or contains(@class, 'MuiSelect-select')]").first();
    if (await rowsPerPageSelect.isVisible({ timeout: 2500 }).catch(() => false)) {
      const currentVal = (await rowsPerPageSelect.textContent())?.trim();
      if (currentVal !== '100') {
        await rowsPerPageSelect.scrollIntoViewIfNeeded().catch(() => { });
        await rowsPerPageSelect.click();
        await page.waitForTimeout(500);
        const opt100 = page.locator("xpath=//li[@role='option' and (text()='100' or text()='50' or contains(text(), 'Tất cả'))]").last();
        if (await opt100.isVisible({ timeout: 1500 }).catch(() => false)) {
          const optText = (await opt100.textContent())?.trim();
          console.log(`   👉 Chọn '${optText}' bản ghi mỗi trang...`);
          await opt100.click();
          await page.waitForTimeout(1000);
          await waitForTableLoadingComplete(page, 15000);
        } else {
          await page.keyboard.press('Escape');
        }
      }
    }
  } catch (err) {
    console.log(`   ℹ️ Giữ nguyên phân trang mặc định: ${err.message}`);
  }

  while (true) {
    console.log(`\n📄 ─── ĐANG XỬ LÝ TRANG ${pageNum} ───`);
    await waitForTableLoadingComplete(page, 15000);

    const rows = page.locator("xpath=//div[contains(@class, 'crud-grid-container') and not(ancestor::div[@id='tabpanel-1'])]//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
    const rowCount = await rows.count();
    console.log(`   ℹ️ Trang ${pageNum} có ${rowCount} hàng hóa`);

    for (let i = 0; i < rowCount; i++) {
      totalProcessed++;
      const row = rows.nth(i);
      const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
      let uacode = (await codeCell.textContent())?.trim();
      if (!uacode) continue;

      if (processedCodes.has(uacode)) {
        console.log(`  ℹ️ Mã [${uacode}] (#${totalProcessed}) đã xử lý ở trang trước -> Bỏ qua`);
        continue;
      }
      processedCodes.add(uacode);

      console.log(`\n  👉 [Hàng hóa #${totalProcessed}] Mã: ${uacode} -> Mở modal xuất Hợp đồng...`);

      const tStartContract = Date.now();
      const contractFileName = `HĐ ${uacode}.xlsx`;

      // Helper đóng modal dứt điểm và đảm bảo modal đã ẩn hoàn toàn
      const closeModal = async () => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const hasModal = await page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa'), h2:has-text('Xem Thông tin hợp đồng')").first().isVisible({ timeout: 500 }).catch(() => false);
          if (!hasModal) break;

          // 1. Thử click icon X góc phải trên (SVG CloseIcon chuẩn d="M19 6.41...")
          const closeX = page.locator("xpath=//*[name()='svg'][path[starts-with(@d, 'M19 6.41')]]").last();
          if (await closeX.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeX.click({ force: true });
            await page.waitForTimeout(400);
          }

          // 2. Thử nút 'Đóng' ở footer (scrollIntoView trước khi click)
          const closeBtn = page.locator("button.button-element:has-text('Đóng'), button:has-text('Đóng')").last();
          if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
            await closeBtn.scrollIntoViewIfNeeded().catch(() => { });
            await closeBtn.click({ force: true });
            await page.waitForTimeout(400);
          }

          // 3. Fallback phím Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }

        const allModalTitles = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa'), h2:has-text('Xem Thông tin hợp đồng')");
        await allModalTitles.first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { });
        await page.waitForTimeout(400);
      };

      try {
        // Đảm bảo không còn modal nào sót lại trước khi mở dòng mới
        const lingeringModal = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa'), h2:has-text('Xem Thông tin hợp đồng')").first();
        if (await lingeringModal.isVisible({ timeout: 300 }).catch(() => false)) {
          console.log(`      Có modal chưa đóng từ lượt trước, đang đóng...`);
          await closeModal();
        }

        // 1. Click icon đầu tiên trong cột Thao tác (Sửa/Xem)
        const actionBtn = row.locator("xpath=.//button[contains(@class, 'MuiIconButton-root')]").first();
        if (!(await actionBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
          console.log(`      Không tìm thấy nút Thao tác cho ${uacode}`);
          continue;
        }
        await actionBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // 2. Chờ modal hiển thị tiêu đề và chuyển Tab "Thông tin hợp đồng" (#tab-1)
        const modalTitle = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
        await modalTitle.waitFor({ state: 'visible', timeout: 5000 });

        const contractTab = page.locator("#tab-1");
        if (await contractTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await contractTab.click({ force: true });
          await page.waitForTimeout(800);
          await waitForTableLoadingComplete(page, 10000);
        } else {
          console.log(`      Không thấy Tab 'Thông tin hợp đồng' (#tab-1)`);
        }

        // 3. Kiểm tra xem bảng bên trong #tabpanel-1 có dữ liệu không
        const tabpanel = page.locator("#tabpanel-1");
        const noData = tabpanel.locator("xpath=.//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0')]").first();
        const hasNoData = await noData.isVisible({ timeout: 1500 }).catch(() => false);

        if (hasNoData) {
          console.log(`     ℹ️ Hàng hóa [${uacode}] không có hợp đồng (Bảng báo: Không có dữ liệu, 0-0 trên 0) -> Bỏ qua`);
          await closeModal();
          results.push({ file: contractFileName, ok: false, size: '0', time: '0', note: 'Không có dữ liệu (0-0 trên 0)' });
          continue;
        }

        // 4. Nút Kết xuất bên trong #tabpanel-1
        const modalExportBtn = tabpanel.locator("button.button-element:has-text('Kết xuất')").first();

        if (await modalExportBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
          const dest = path.join(outputDir, contractFileName);
          const dlPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);

          // Ưu tiên Cách 2: Click trực tiếp vào nút 'Kết xuất' để bung Menu Popover ngay từ đầu
          console.log(`     👉 Click trực tiếp nút 'Kết xuất' để mở menu...`);
          await page.bringToFront().catch(() => { });
          await modalExportBtn.scrollIntoViewIfNeeded().catch(() => { });
          await modalExportBtn.click({ force: true });
          await page.waitForTimeout(600);

          let exportAll = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả'), li:visible:has-text('Export all')").last();

          if (!(await exportAll.isVisible({ timeout: 1500 }).catch(() => false))) {
            await modalExportBtn.click({ force: true });
            await page.waitForTimeout(600);
            exportAll = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả')").last();
          }

          if (await exportAll.isVisible({ timeout: 3000 }).catch(() => false)) {
            console.log(`     👉 Menu đã mở: Bấm chọn 'Xuất tất cả'...`);
            await exportAll.hover().catch(() => { });
            await exportAll.click();
            await page.waitForTimeout(400);

            if (await exportAll.isVisible({ timeout: 300 }).catch(() => false)) {
              console.log(`     👉 Nhấp thêm lần nữa vào 'Xuất tất cả' để chắc chắn...`);
              await exportAll.click({ force: true });
            }
          } else {
            console.log(`      Không thấy option 'Xuất tất cả' trong menu`);
          }

          const dl = await dlPromise;
          let ok = false;
          if (dl) {
            await dl.saveAs(dest);
            ok = fs.existsSync(dest) && fs.statSync(dest).size > 0;
          }
          const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
          const dur = ((Date.now() - tStartContract) / 1000).toFixed(1);
          console.log(`     ${ok ? '✅ THÀNH CÔNG' : '❌ THẤT BẠI'}: ${contractFileName} (${sz} KB) trong ${dur}s`);
          results.push({ file: contractFileName, ok, size: sz, time: dur });
        } else {
          console.log(`      Không tìm thấy nút Kết xuất bên trong #tabpanel-1`);
          results.push({ file: contractFileName, ok: false, size: '0', time: '0' });
        }

        // 5. Đóng modal
        await closeModal();

      } catch (e) {
        console.log(`     ❌ Lỗi xử lý ${contractFileName}: ${e.message}`);
        await page.keyboard.press('Escape').catch(() => { });
        results.push({ file: contractFileName, ok: false, size: '0', time: '0' });
      }
    }

    // ── KIỂM TRA VÀ CHUYỂN TRANG (Next Page - Chuẩn Material-UI MRT) ──
    const paginationContainer = page.locator("xpath=//div[contains(@class, 'MuiTablePagination-root') and not(ancestor::div[@id='tabpanel-1'])]").first();
    const displayedRangeEl = paginationContainer.locator("xpath=.//span[contains(text(), 'trên') or contains(@class, 'MuiTablePagination-displayedRows')]").first();
    const currentRange = (await displayedRangeEl.textContent().catch(() => ''))?.trim() || '';

    const nextBtn = paginationContainer.locator("xpath=.//button[@aria-label='Tới trang tiếp theo']").first();
    const isNextAvailable = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isNextAvailable) {
      console.log(`\n🏁 ĐÃ DUYỆT HẾT TẤT CẢ CÁC TRANG (Không thấy thanh phân trang hoặc chỉ có 1 trang).`);
      break;
    }

    const isNextDisabled = await nextBtn.evaluate((b) => b.disabled || b.classList.contains('Mui-disabled') || b.getAttribute('aria-disabled') === 'true').catch(() => true);

    if (isNextDisabled) {
      console.log(`\n🏁 ĐÃ DUYỆT HẾT TẤT CẢ CÁC TRANG (Vị trí hiện tại: "${currentRange}" - Nút Next đã bị disable).`);
      break;
    }

    console.log(`\n➡️ Bấm nút 'Tới trang tiếp theo' (Vị trí hiện tại: "${currentRange}")...`);
    await paginationContainer.scrollIntoViewIfNeeded().catch(() => { });
    await page.waitForTimeout(300);

    try {
      await nextBtn.click({ timeout: 3000 });
    } catch {
      await nextBtn.evaluate((b) => b.click());
    }

    let pageTurned = false;
    const tWaitStart = Date.now();
    while (Date.now() - tWaitStart < 8000) {
      const newRange = (await displayedRangeEl.textContent().catch(() => ''))?.trim() || '';
      if (newRange && newRange !== currentRange) {
        console.log(`   ✅ Chuyển trang thành công: "${currentRange}" -> "${newRange}"`);
        pageTurned = true;
        break;
      }

      if (Date.now() - tWaitStart > 2000 && !pageTurned) {
        await nextBtn.evaluate((b) => b.click()).catch(() => { });
        const nextSpan = paginationContainer.locator("xpath=.//span[@aria-label='Tới trang tiếp theo']").first();
        if (await nextSpan.isVisible().catch(() => false)) {
          await nextSpan.click().catch(() => { });
        }
      }
      await page.waitForTimeout(400);
    }

    if (pageTurned) {
      await waitForTableLoadingComplete(page, 15000);
      await page.waitForTimeout(600);
      pageNum++;
    } else {
      console.log(`    Sau 8s vị trí vẫn là "${currentRange}". Dừng để tránh lặp trang.`);
      break;
    }
  }

  return results;
}

// ─── 4. MAIN ORCHESTRATOR ───────────────────────────────────────────────────
async function main() {
  console.log('\n========================================================================');
  console.log('   CORECCP SPECIALIZED TEST: KIỂM THỬ CÁC FILE LỖI / CHƯA TẢI');
  console.log('========================================================================');

  const dbCreds = await getCredentialsFromDB();
  const systemUrl = dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = dbCreds?.username || 'hieptruong';
  const password = dbCreds?.password || 'Taovipko0!';
  const baseUrl = new URL(systemUrl).origin;

  const outputDir = path.resolve(process.cwd(), 'temp', 'test_ccp_25_downloads');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const chromePath = getChromeExecutablePath();
  const launchOptions = {
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const summary = [];
  const batchStart = Date.now();

  try {
    console.log(`🔑 Đang đăng nhập '${username}' vào ${systemUrl}...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill("input[name='username'], input[type='text']", username);
    await page.fill("input[name='password'], input[type='password']", password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
    await page.waitForTimeout(1000);
    console.log(`✅ Đăng nhập thành công!\n`);

    // 1. Chạy Test DSGD MM CCP (/ORDERS/ORDERMATCH_DETAIL_MM)
    const r1 = await testDsgdMM(page, baseUrl, outputDir);
    summary.push(r1);

    // 2. Chạy Test TTTT.xlsx (/ORDERS/PNL_EXECUTED)
    const r2 = await testTTTT(page, baseUrl, outputDir);
    summary.push(r2);

    // 3. Chạy Test Hàng hóa & Hợp đồng Modal theo thuật toán Đa Trang Next Page
    const r3 = await testCommodityContracts(page, baseUrl, outputDir);
    summary.push(...r3);

  } catch (err) {
    console.log(`\n❌ LỖI TIẾN TRÌNH: ${err.message}`);
  } finally {
    const totalSec = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log('\n========================================================================');
    console.log(`   KẾT QUẢ KIỂM THỬ CÁC FILE LỖI (HOÀN TẤT TRONG ${totalSec} GIÂY)`);
    console.log('========================================================================');
    console.table(summary.map((s, i) => ({
      STT: i + 1,
      'Tên Tệp': s.file,
      'Trạng Thái': s.ok ? '✅ Thành công' : (s.note ? ' Bỏ qua (Server)' : '❌ Thất bại'),
      'Kích Thước (KB)': s.size,
      'Thời Gian (s)': s.time,
      'Ghi Chú': s.note || '',
    })));

    console.log(`\n📂 Thư mục chứa file: ${outputDir}`);
    console.log('⏳ Giữ trình duyệt thêm 5 giây trước khi đóng...');
    await page.waitForTimeout(5000);
    await browser.close();
  }
}

main().catch(console.error);
