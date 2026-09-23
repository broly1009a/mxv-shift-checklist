/**
 * TEST SCRIPT CHUYÊN BIỆT: KIỂM THỬ NHANH CHUYỂN TRANG BẰNG CÁCH CHỈ TẢI HÀNG CUỐI CÙNG CỦA MỖI TRANG
 * 
 * Mục đích:
 * - Thay vì chạy lần lượt 20 hàng từ đầu tốn thời gian, script sẽ:
 *   1. Trang 1: Nhảy thẳng tới hàng cuối cùng (#20) -> Mở modal -> Tải Hợp đồng (Cách 2).
 *   2. Đóng modal -> Bấm nút 'Tới trang tiếp theo' (Kiểm chứng chuyển từ '1-20 trên 60' sang '21-40 trên 60').
 *   3. Trang 2: Tiếp tục nhảy tới hàng cuối cùng (#40) -> Tải hợp đồng -> Bấm Next sang Trang 3 ('41-60 trên 60').
 *   4. Trang 3: Kiểm tra đã tới trang cuối cùng và nút Next bị vô hiệu hóa (disabled).
 * 
 * Chạy lệnh:
 *   cd backend
 *   node src/scripts/test_ccp_download_contracts_next_page.js --headed
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
  await page.waitForTimeout(400);

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

// ─── 3. LOGIC XỬ LÝ 1 DÒNG HÀNG HÓA VÀ TẢI HỢP ĐỒNG ─────────────────────────
async function processRowAndDownloadContract(page, row, outputDir) {
  const codeCell = row.locator("xpath=.//td[@data-column-id='UACODE']").first();
  const uacode = (await codeCell.textContent())?.trim();
  if (!uacode) return null;

  const contractFileName = `HĐ ${uacode}.xlsx`;
  const tStart = Date.now();
  console.log(`\n  👉 [Xử lý dòng cuối] Mã: [${uacode}] -> Mở modal tải ${contractFileName}...`);

  const closeModal = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const hasModal = await page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa'), h2:has-text('Xem Thông tin hợp đồng')").first().isVisible({ timeout: 500 }).catch(() => false);
      if (!hasModal) break;

      const closeX = page.locator("xpath=//*[name()='svg'][path[starts-with(@d, 'M19 6.41')]]").last();
      if (await closeX.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeX.click({ force: true });
        await page.waitForTimeout(400);
      }

      const closeBtn = page.locator("button.button-element:has-text('Đóng'), button:has-text('Đóng')").last();
      if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeBtn.scrollIntoViewIfNeeded().catch(() => { });
        await closeBtn.click({ force: true });
        await page.waitForTimeout(400);
      }

      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const allTitles = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa'), h2:has-text('Xem Thông tin hợp đồng')");
    await allTitles.first().waitFor({ state: 'hidden', timeout: 4000 }).catch(() => { });
    await page.waitForTimeout(400);
  };

  try {
    // Đóng modal sót nếu có
    const lingering = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
    if (await lingering.isVisible({ timeout: 300 }).catch(() => false)) await closeModal();

    // 1. Click icon Thao tác trên dòng
    const actionBtn = row.locator("xpath=.//button[contains(@class, 'MuiIconButton-root')]").first();
    await actionBtn.scrollIntoViewIfNeeded().catch(() => { });
    await actionBtn.click({ force: true });

    // 2. Chờ modal và chuyển sang Tab #tab-1
    const modalTitle = page.locator("#modal-modal-title, h2:has-text('Xem Thông tin hàng hóa')").first();
    await modalTitle.waitFor({ state: 'visible', timeout: 5000 });

    const contractTab = page.locator("#tab-1");
    if (await contractTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contractTab.click({ force: true });
      await waitForTableLoadingComplete(page, 10000);
    }

    // 3. Kiểm tra bảng rỗng
    const tabpanel = page.locator("#tabpanel-1");
    const noData = tabpanel.locator("xpath=.//*[text()='Không có dữ liệu' or contains(text(), '0-0 trên 0')]").first();
    if (await noData.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log(`     ℹ️ Hàng hóa [${uacode}] không có hợp đồng (0-0 trên 0) -> Bỏ qua`);
      await closeModal();
      return { file: contractFileName, ok: false, note: '0-0 trên 0' };
    }

    // 4. Bấm Kết xuất (Cách 2: Mở menu -> Bấm Xuất tất cả ngay tức thì)
    const modalExportBtn = tabpanel.locator("button.button-element:has-text('Kết xuất')").first();
    if (await modalExportBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const dest = path.join(outputDir, contractFileName);
      const dlPromise = page.waitForEvent('download', { timeout: 25000 }).catch(() => null);

      console.log(`     👉 Mở menu & Bấm chọn 'Xuất tất cả'...`);
      await modalExportBtn.scrollIntoViewIfNeeded().catch(() => { });
      await modalExportBtn.click({ force: true });

      // Định vị option 'Xuất tất cả' và kích hoạt click ngay lập tức qua native DOM (không hover/sleep chờ đợi)
      const exportAllItem = page.locator("li:visible:has-text('Xuất tất cả'), [role='menuitem']:visible:has-text('Xuất tất cả'), li:visible:has-text('Export all')").last();
      await exportAllItem.waitFor({ state: 'visible', timeout: 2500 }).catch(() => { });

      // Click ngay tức thì
      await exportAllItem.evaluate((el) => el.click()).catch(() => { });
      await exportAllItem.click({ force: true, timeout: 500 }).catch(() => { });

      const dl = await dlPromise;
      let ok = false;
      if (dl) {
        await dl.saveAs(dest);
        ok = fs.existsSync(dest) && fs.statSync(dest).size > 0;
      }
      const sz = fs.existsSync(dest) ? (fs.statSync(dest).size / 1024).toFixed(1) : '0';
      const dur = ((Date.now() - tStart) / 1000).toFixed(1);

      if (ok) {
        console.log(`     ✅ THÀNH CÔNG: ${contractFileName} (${sz} KB) trong ${dur}s`);
      } else {
        console.log(`     ❌ THẤT BẠI: Không nhận được file tải về trong ${dur}s`);
      }
    }

    await closeModal();
    return { file: contractFileName, ok: true };
  } catch (err) {
    console.log(`     ❌ Lỗi: ${err.message}`);
    await closeModal();
    return { file: contractFileName, ok: false, error: err.message };
  }
}

// ─── 4. MAIN ORCHESTRATOR: TẢI HÀNG CUỐI RỒI NEXT TRANG ─────────────────────
async function main() {
  console.log('\n========================================================================');
  console.log('   CORECCP FAST TEST: CHỈ TẢI HÀNG CUỐI CÙNG & KIỂM THỬ CHUYỂN TRANG');
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
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    // 1. Đăng nhập
    console.log(`🔑 Đang đăng nhập '${username}' vào ${systemUrl}...`);
    await page.goto(systemUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.fill("input[name='username'], input[type='text']", username);
    await page.fill("input[name='password'], input[type='password']", password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
    await page.waitForTimeout(1000);

    // 2. Mở màn hình Quản lý hàng hóa, hợp đồng
    const targetUrl = `${baseUrl}/PRODUCT/COMMODITY`;
    console.log(`\n📂 Mở màn hình Quản lý hàng hóa: ${targetUrl}...`);
    await safeNavigate(page, targetUrl);
    await waitForTableLoadingComplete(page, 20000);

    let pageNum = 1;

    while (pageNum <= 3) {
      console.log(`\n========================================================================`);
      console.log(`📄 ─── ĐANG Ở TRANG ${pageNum} ───`);
      console.log(`========================================================================`);
      await waitForTableLoadingComplete(page, 15000);

      // Đọc trạng thái phân trang hiện tại
      const paginationContainer = page.locator("xpath=//div[contains(@class, 'MuiTablePagination-root') and not(ancestor::div[@id='tabpanel-1'])]").first();
      const displayedRangeEl = paginationContainer.locator("xpath=.//span[contains(text(), 'trên') or contains(@class, 'MuiTablePagination-displayedRows')]").first();
      const currentRange = (await displayedRangeEl.textContent().catch(() => ''))?.trim() || '';
      console.log(`   📊 Vị trí thanh phân trang: "${currentRange}"`);

      // Lấy danh sách dòng hàng hóa trên trang hiện tại
      const rows = page.locator("xpath=//div[contains(@class, 'crud-grid-container') and not(ancestor::div[@id='tabpanel-1'])]//tbody[contains(@class, 'MuiTableBody-root')]//tr[@data-index]");
      const rowCount = await rows.count();
      console.log(`   ℹ️ Tìm thấy ${rowCount} dòng hàng hóa trên Trang ${pageNum}`);

      if (rowCount === 0) {
        console.log(`    Bảng không có dòng nào, kết thúc.`);
        break;
      }

      // 3. CHỈ LẤY VÀ XỬ LÝ DUY NHẤT DÒNG CUỐI CÙNG (rows.last())
      const lastIndex = rowCount - 1;
      const lastRow = rows.nth(lastIndex);
      console.log(`   🎯 Nhảy thẳng tới dòng cuối cùng (#${lastIndex + 1}/${rowCount}) của Trang ${pageNum}...`);
      await processRowAndDownloadContract(page, lastRow, outputDir);

      // 4. KIỂM TRA NÚT NEXT VÀ THỰC HIỆN CHUYỂN TRANG
      console.log(`\n── KIỂM THỬ NÚT CHUYỂN TRANG 'Tới trang tiếp theo' ──`);
      const nextBtn = paginationContainer.locator("xpath=.//button[@aria-label='Tới trang tiếp theo']").first();
      const isNextAvailable = await nextBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (!isNextAvailable) {
        console.log(`🏁 Không tìm thấy nút Next hoặc bảng chỉ có 1 trang.`);
        break;
      }

      const isNextDisabled = await nextBtn.evaluate((b) => b.disabled || b.classList.contains('Mui-disabled') || b.getAttribute('aria-disabled') === 'true').catch(() => true);

      if (isNextDisabled) {
        console.log(`🏁 Nút 'Tới trang tiếp theo' ĐÃ BỊ DISABLE tại "${currentRange}" -> ĐÃ DUYỆT ĐẾN TRANG CUỐI CÙNG THÀNH CÔNG!`);
        break;
      }

      console.log(`➡️ Đang bấm nút 'Tới trang tiếp theo' từ "${currentRange}"...`);
      // Cuộn để nút nằm chắc chắn trong viewport
      await paginationContainer.scrollIntoViewIfNeeded().catch(() => { });
      await page.waitForTimeout(300);

      // Kích hoạt click trực tiếp qua native DOM để chuyển trang tức thì
      await nextBtn.evaluate((b) => b.click()).catch(() => { });
      await nextBtn.click({ timeout: 800 }).catch(() => { });

      // Chờ text phân trang THAY ĐỔI
      let pageTurned = false;
      const tWaitStart = Date.now();
      while (Date.now() - tWaitStart < 8000) {
        const newRange = (await displayedRangeEl.textContent().catch(() => ''))?.trim() || '';
        if (newRange && newRange !== currentRange) {
          console.log(`🎉 CHUYỂN TRANG THÀNH CÔNG: "${currentRange}" ➡️ "${newRange}"`);
          pageTurned = true;
          break;
        }

        if (Date.now() - tWaitStart > 2000 && !pageTurned) {
          console.log(`   👉 Thử kích hoạt lại click trên nút và span...`);
          await nextBtn.evaluate((b) => b.click()).catch(() => { });
          const nextSpan = paginationContainer.locator("xpath=.//span[@aria-label='Tới trang tiếp theo']").first();
          if (await nextSpan.isVisible().catch(() => false)) await nextSpan.click().catch(() => { });
        }
        await page.waitForTimeout(400);
      }

      if (pageTurned) {
        await waitForTableLoadingComplete(page, 15000);
        await page.waitForTimeout(800);
        pageNum++;
      } else {
        console.log(`❌ LỖI: Sau 8s vị trí vẫn giữ nguyên "${currentRange}". Nút Next chưa kích hoạt thành công.`);
        break;
      }
    }

    console.log('\n========================================================================');
    console.log('🏁 HOÀN TẤT KIỂM THỬ CHUYỂN TRANG NHANH');
    console.log('========================================================================\n');

  } catch (err) {
    console.error('❌ Lỗi ngoại lệ trong main:', err);
  } finally {
    await page.waitForTimeout(3000);
    await context.close();
    await browser.close();
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

main();
