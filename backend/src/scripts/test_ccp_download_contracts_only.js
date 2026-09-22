/**
 * ============================================================================
 * TEST SCRIPT: CHỈ CHẠY RIÊNG TẢI CÁC FILE HỢP ĐỒNG (HĐ *.xlsx) TỪ VNCLEAR
 * ============================================================================
 * 
 * Mục tiêu:
 *  - Mở trực tiếp màn hình Quản lý hàng hóa, hợp đồng (/PRODUCT/COMMODITY)
 *  - Duyệt tuần tự 100% tất cả hàng hóa (không lọc, không bỏ sót mã nào)
 *  - Với mỗi hàng hóa:
 *      + Click nút thao tác đầu tiên trong cột 'Thao tác' để mở Modal
 *      + Chuyển sang Tab 'Thông tin hợp đồng'
 *      + Click nút 'Kết xuất' (chuẩn class: button-element)
 *      + Tải và lưu file 'HĐ <Mã_HH>.xlsx'
 *      + Đóng modal và chuyển sang hàng hóa tiếp theo
 *  - Hết trang hiện tại, tự động bấm nút 'Tới trang tiếp theo' (button[@aria-label='Tới trang tiếp theo'])
 *    để sang trang 2, trang 3... cho đến khi duyệt hết toàn bộ các trang.
 * 
 * Cách chạy:
 *   node src/scripts/test_ccp_download_contracts_only.js --headed
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
    console.log(` Không thể kết nối MongoDB (${err.message}). Dùng fallback mặc định.`);
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
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
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
      const noData = page.locator("xpath=//tbody//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0') or contains(text(), 'No data')]").first();
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

// ─── 3. THUẬT TOÁN TẢI TOÀN BỘ HỢP ĐỒNG ĐA TRANG ────────────────────────────
async function downloadAllContractsAcrossPages(page, baseUrl, outputDir) {
  const targetUrl = `${baseUrl}/PRODUCT/COMMODITY`;
  console.log(`\n📂 Mở màn hình Quản lý hàng hóa, hợp đồng: ${targetUrl}...`);
  await safeNavigate(page, targetUrl);
  await waitForTableLoadingComplete(page, 20000);

  const results = [];
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
    console.log(`\n========================================================================`);
    console.log(`📄 ─── ĐANG QUÉT TRANG ${pageNum} ───`);
    console.log(`========================================================================`);
    await waitForTableLoadingComplete(page, 15000);

    const rows = page.locator("xpath=//div[contains(@class, 'crud-grid-container') and not(ancestor::div[@id='tabpanel-1'])]//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
    const rowCount = await rows.count();
    console.log(`   ℹ️ Tìm thấy ${rowCount} dòng hàng hóa trên Trang ${pageNum}`);

    for (let i = 0; i < rowCount; i++) {
      totalProcessed++;
      const row = rows.nth(i);

      // Lấy Mã hàng hóa (UACODE)
      const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
      let uacode = (await codeCell.textContent())?.trim();
      if (!uacode) continue;

      if (processedCodes.has(uacode)) {
        console.log(`  ℹ️ Mã [${uacode}] (#${totalProcessed}) đã được xử lý ở trang trước -> Bỏ qua`);
        continue;
      }
      processedCodes.add(uacode);

      const tStartContract = Date.now();
      const contractFileName = `HĐ ${uacode}.xlsx`;
      console.log(`\n  👉 [Hàng hóa #${totalProcessed}] Mã: [${uacode}] -> File: ${contractFileName}...`);

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

        // 1. Click icon đầu tiên trong cột Thao tác trên Bảng chính
        const actionBtn = row.locator("xpath=.//button[contains(@class, 'MuiIconButton-root')]").first();
        if (!(await actionBtn.isVisible({ timeout: 2500 }).catch(() => false))) {
          console.log(`      Không tìm thấy nút Thao tác cho ${uacode}`);
          results.push({ file: contractFileName, ok: false, size: '0', time: '0', note: 'Không thấy nút thao tác' });
          continue;
        }
        await actionBtn.click({ force: true });
        await page.waitForTimeout(1000);

        // 2. Chờ tiêu đề Modal "Xem Thông tin hàng hóa" hiển thị chuẩn xác từ HTML
        const modalTitle = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
        await modalTitle.waitFor({ state: 'visible', timeout: 5000 });

        // Chuyển sang Tab "Thông tin hợp đồng" (#tab-1)
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

        // 4. Nút Kết xuất bên trong #tabpanel-1 (chuẩn theo HTML: #tabpanel-1 button.button-element có text 'Kết xuất')
        const modalExportBtn = tabpanel.locator("button.button-element:has-text('Kết xuất')").first();

        if (await modalExportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          const dest = path.join(outputDir, contractFileName);
          const dlPromise = page.waitForEvent('download', { timeout: 20000 }).catch(() => null);

          // 1. Click trực tiếp vào nút 'Kết xuất' để mở Menu Popover
          // 1. Click mở menu & bấm chọn 'Xuất tất cả' ngay tức thì
          console.log(`     👉 Mở menu & Bấm chọn 'Xuất tất cả'...`);
          await page.bringToFront().catch(() => { });
          await modalExportBtn.scrollIntoViewIfNeeded().catch(() => { });
          await modalExportBtn.click({ force: true });

          // 2. Định vị option 'Xuất tất cả' và click ngay lập tức qua native DOM (không hover/sleep chờ đợi)
          const exportAllItem = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả'), li:visible:has-text('Export all')").last();
          await exportAllItem.waitFor({ state: 'visible', timeout: 2500 }).catch(() => { });

          await exportAllItem.evaluate((el) => el.click()).catch(() => { });
          await exportAllItem.click({ force: true, timeout: 500 }).catch(() => { });

          const dl = await dlPromise;
          let ok = false;
          if (dl) {
            await dl.saveAs(dest);
            ok = fs.existsSync(dest) && fs.statSync(dest).size > 0;
          }
          const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
          const elapsed = ((Date.now() - tStartContract) / 1000).toFixed(1);

          if (ok) {
            console.log(`     ✅ THÀNH CÔNG: ${contractFileName} (${sz} KB) trong ${elapsed}s`);
            results.push({ file: contractFileName, ok: true, size: `${sz} KB`, time: `${elapsed}s`, note: 'Thành công' });
          } else {
            console.log(`     ❌ THẤT BẠI: ${contractFileName} (${sz} KB) trong ${elapsed}s`);
            results.push({ file: contractFileName, ok: false, size: `${sz} KB`, time: `${elapsed}s`, note: 'Không có file tải về' });
          }
        } else {
          console.log(`     ℹ️ Không tìm thấy nút Kết xuất bên trong #tabpanel-1 -> Bỏ qua`);
          results.push({ file: contractFileName, ok: false, size: '0', time: '0', note: 'Không có nút kết xuất' });
        }

        // 5. Đóng modal (chuẩn theo HTML: button.button-element với text 'Đóng')
        await closeModal();

      } catch (err) {
        console.log(`     ❌ Lỗi khi tải ${contractFileName}: ${err.message}`);
        await page.keyboard.press('Escape').catch(() => { });
        results.push({ file: contractFileName, ok: false, size: '0', time: '0', note: err.message });
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
    // Cuộn tới thanh phân trang để đảm bảo nút nằm trong viewport
    await paginationContainer.scrollIntoViewIfNeeded().catch(() => { });
    await page.waitForTimeout(300);

    // Kích hoạt click trực tiếp qua native DOM để chuyển trang tức thì
    await nextBtn.evaluate((b) => b.click()).catch(() => { });
    await nextBtn.click({ timeout: 800 }).catch(() => { });

    // Chờ xác nhận vị trí phân trang THAY ĐỔI (ví dụ: '1-20 trên 60' -> '21-40 trên 60')
    let pageTurned = false;
    const tWaitStart = Date.now();
    while (Date.now() - tWaitStart < 8000) {
      const newRange = (await displayedRangeEl.textContent().catch(() => ''))?.trim() || '';
      if (newRange && newRange !== currentRange) {
        console.log(`   ✅ Chuyển trang thành công: "${currentRange}" -> "${newRange}"`);
        pageTurned = true;
        break;
      }

      // Nếu sau 2s chưa đổi, thử dispatch native click trên nút và trên thẻ span bọc ngoài
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

// ─── 4. HÀM MAIN ────────────────────────────────────────────────────────────
async function main() {
  console.log('\n========================================================================');
  console.log('   CORECCP EXCLUSIVE TEST: CHUYÊN BIỆT TẢI CÁC FILE HỢP ĐỒNG (HĐ *.xlsx)');
  console.log('========================================================================');

  const dbCreds = await getCredentialsFromDB();
  const systemUrl = dbCreds?.url || 'https://uat-coreccp.mxv.com.vn/login';
  const username = dbCreds?.username || 'hieptruong';
  const password = dbCreds?.password || 'Taovipko0!';
  const baseUrl = new URL(systemUrl).origin;

  const outputDir = path.resolve(process.cwd(), 'temp', 'test_ccp_25_downloads');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  console.log(`- Tài khoản:   ${username}`);
  console.log(`- Thư mục lưu: ${outputDir}\n`);

  const chromePath = getChromeExecutablePath();
  const launchOptions = {
    headless: false, // Luôn mở cửa sổ để quan sát trực tiếp bot thao tác
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  const batchStart = Date.now();
  let summary = [];

  try {
    // Đăng nhập
    console.log(`🔑 Đang đăng nhập '${username}' vào ${systemUrl}...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill("input[name='username'], input[type='text']", username);
    await page.fill("input[name='password'], input[type='password']", password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
    await page.waitForTimeout(1000);
    console.log(`✅ Đăng nhập thành công!\n`);

    // Chạy tải riêng Hợp đồng
    summary = await downloadAllContractsAcrossPages(page, baseUrl, outputDir);

  } catch (err) {
    console.log(`\n❌ LỖI TRONG TIẾN TRÌNH: ${err.message}`);
  } finally {
    const totalSec = ((Date.now() - batchStart) / 1000).toFixed(1);
    console.log('\n========================================================================');
    console.log(`   KẾT QUẢ TẢI CÁC FILE HỢP ĐỒNG (HOÀN TẤT TRONG ${totalSec} GIÂY)`);
    console.log('========================================================================');
    console.table(summary.map((s, i) => ({
      STT: i + 1,
      'Tên Tệp': s.file,
      'Trạng Thái': s.ok ? '✅ Thành công' : '❌ Thất bại',
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
