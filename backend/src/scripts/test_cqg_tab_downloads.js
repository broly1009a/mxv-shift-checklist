/**
 * SCRIPT KIỂM THỬ TỰ ĐỘNG TẢI BÁO CÁO CQG (CQG PLAYWRIGHT SPEED & INTEGRITY TEST)
 * 
 * Mục đích:
 * - Kiểm tra tính ổn định, tốc độ và độ chính xác của cơ chế tải báo cáo CQG Desktop Web.
 * - Chạy ĐỘC LẬP 100% (Standalone), KHÔNG khởi động NestJS background crons, không gây xung đột.
 * - MẶC ĐỊNH: Chỉ mở và tải 1 TAB DUY NHẤT (Khớp lệnh FR1) để kiểm tra nhanh và tránh mở tràn 4 tab.
 * - Hỗ trợ chọn từng tab riêng biệt: --key=FR, --key=PS, --key=OP, --key=OD.
 * - Tự động dọn dẹp tab widget sau khi xuất file, bảo toàn panel bên dưới.
 * 
 * Cách chạy trên Terminal:
 *   cd backend
 *   node src/scripts/test_cqg_tab_downloads.js --headed                # Mặc định: Chỉ test 1 tab FR1 (Khớp lệnh)
 *   node src/scripts/test_cqg_tab_downloads.js --headed --key=PS      # Chỉ test 1 tab PS1 (Tất toán vị thế)
 *   node src/scripts/test_cqg_tab_downloads.js --headed --key=OP      # Chỉ test 1 tab OP1 (Trạng thái mở)
 *   node src/scripts/test_cqg_tab_downloads.js --headed --key=OD      # Chỉ test 1 tab OD1 (Sổ lệnh)
 *   node src/scripts/test_cqg_tab_downloads.js --headed --all         # Tải cả 4 tab FR1, PS1, OP1, OD1
 *   node src/scripts/test_cqg_tab_downloads.js --headed --clean-only  # Chỉ mở dọn dẹp các tab widget rác
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
const XLSX = require('xlsx');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// ── Hàm giải mã AES-256-CBC ──────────────────────────────────────────────────
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) {
    throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  }
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();

  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

function calculateMD5(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
}

function analyzeExcelFile(filePath, fileName, expectedType) {
  if (!fs.existsSync(filePath)) {
    return {
      fileName,
      expectedType,
      fileSize: 0,
      md5: '',
      rowCount: 0,
      reportHeader: 'FILE KHÔNG TỒN TẠI',
      detectedType: 'UNKNOWN',
      isMatch: false,
    };
  }

  const stat = fs.statSync(filePath);
  const md5 = calculateMD5(filePath);

  try {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0] || 'Unknown';
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const rowCount = rows.length;
    const reportHeader = rows[0] && rows[0][0] ? String(rows[0][0]).trim() : '';

    let detectedType = 'UNKNOWN';
    const lowerHeader = reportHeader.toLowerCase();
    if (lowerHeader.includes('fills')) {
      detectedType = 'FILLS (FR)';
    } else if (lowerHeader.includes('purchase and sales') || lowerHeader.includes('p&s') || lowerHeader.includes('purchase')) {
      detectedType = 'PURCHASE & SALES (PS)';
    } else if (lowerHeader.includes('positions') || lowerHeader.includes('open positions')) {
      detectedType = 'OPEN POSITIONS (OP)';
    } else if (lowerHeader.includes('orders') || lowerHeader.includes('order')) {
      detectedType = 'ORDERS (OD)';
    } else if (sheetName.toLowerCase().includes('fills')) {
      detectedType = 'FILLS (FR)';
    } else if (sheetName.toLowerCase().includes('position')) {
      detectedType = 'OPEN POSITIONS (OP)';
    }

    const isMatch = detectedType.includes(expectedType);

    return {
      fileName,
      expectedType,
      fileSize: stat.size,
      md5,
      sheetName,
      rowCount,
      reportHeader,
      detectedType,
      isMatch,
    };
  } catch (err) {
    return {
      fileName,
      expectedType,
      fileSize: stat.size,
      md5,
      sheetName: 'ERROR',
      rowCount: 0,
      reportHeader: `Lỗi đọc Excel: ${err.message}`,
      detectedType: 'CORRUPTED',
      isMatch: false,
    };
  }
}

// ── Tự động đóng popup thông báo của CQG ────────────────────────────────────
async function dismissCqgNotifications(page) {
  try {
    const closeBtn = page.locator(
      "//wpfe-multi-snack-bar-container//wpfe-dialog-close-button//button | //button[contains(@class,'wpfe-dialog-close-button-button')]"
    );
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ timeout: 1500, force: true }).catch(() => { });
    }
    await page.evaluate(() => {
      document.querySelectorAll('wpfe-multi-snack-bar-container').forEach((el) => el.remove());
    }).catch(() => { });
  } catch { }
}

// ── Chờ loading spinner của CQG biến mất ────────────────────────────────────
async function waitForCqgNotLoading(page, timeoutMs = 30000) {
  try {
    const spinnerSelectors = [
      '.wpfe-pre-bootstrap-loading-spinner-container',
      '.wpfe-app-loading-image',
    ];
    for (const sel of spinnerSelectors) {
      const els = page.locator(sel);
      const count = await els.count().catch(() => 0);
      for (let i = 0; i < count; i++) {
        await els.nth(i).waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => { });
      }
    }
  } catch { }
}

// ── Chờ Dashboard Logo và giải tỏa xung đột phiên ───────────────────────────
async function waitForCqgDashboardLogo(page, username, timeoutMs = 120000) {
  const waitLogoStart = Date.now();
  while (Date.now() - waitLogoStart < timeoutMs) {
    const logoVisible = await page.locator('div.wpfe-logo-image').isVisible().catch(() => false);
    const homeVisible = await page.locator("//div[text()='Ho']").isVisible().catch(() => false);
    if (logoVisible || homeVisible) {
      return true;
    }

    await dismissCqgNotifications(page);

    const isLoginStillVisible = await page.locator('input[name="password"]').isVisible({ timeout: 150 }).catch(() => false);
    if (isLoginStillVisible) {
      const submitBtn = page.locator('button[type="submit"], button:has-text("Log on")');
      const submitText = await submitBtn.first().innerText().catch(() => '');
      if (submitText.includes('Log on')) {
        await submitBtn.first().click({ force: true }).catch(() => { });
        await page.keyboard.press('Enter').catch(() => { });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    const takeoverBtn = page.locator(
      'button:has-text("Logoff"), button:has-text("Log off"), button:has-text("Disconnect"), button:has-text("Continue"), button:has-text("Yes"), button:has-text("OK"), button:has-text("Force"), button:has-text("Take over"), div[role="dialog"] button.btn-primary, .modal-dialog button.btn-primary, .wpfe-dialog button.btn-primary, .wpfe-message-box button'
    );
    if (await takeoverBtn.first().isVisible({ timeout: 250 }).catch(() => false)) {
      const btnText = await takeoverBtn.first().innerText().catch(() => '');
      console.log(`[CQG] Phát hiện popup xung đột phiên ("${btnText}"). Bấm chiếm quyền phiên...`);
      await takeoverBtn.first().click().catch(() => { });
      await new Promise((r) => setTimeout(r, 1000));
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error(`Timeout ${timeoutMs}ms chờ logo dashboard sau khi đăng nhập CQG (${username}).`);
}

// ── Tải một widget cụ thể và lưu file ───────────────────────────────────────
async function downloadSingleCqgWidget(page, searchTerm, tabLabel, downloadText, destFile) {
  const widgetStart = Date.now();
  await waitForCqgNotLoading(page, 15000);
  await dismissCqgNotifications(page);
  await page.keyboard.press('Escape').catch(() => { });
  await page.keyboard.press('Escape').catch(() => { });

  console.log(`[CQG] Mở widget "${searchTerm}"...`);

  // Bước 1: Bấm menu Ho
  const homeMenu = page.locator("//div[text()='Ho']").first();
  await homeMenu.waitFor({ state: 'visible', timeout: 10000 });
  await homeMenu.click();
  await page.waitForTimeout(1000);

  // Bước 2: Bấm nút dấu cộng add widget trong panel thao tác (g1.w431)
  let plusIcon = page.locator("wpfe-widget-tab-control[data-help-id='g1.w431'] .wpfe-add-widget-btn").first();
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("div.wpfe-page-layout-tab-panel[style*='top: 0px'] .wpfe-add-widget-btn").first();
  }
  if ((await plusIcon.count().catch(() => 0)) === 0) {
    plusIcon = page.locator("//div[contains(@class, 'wpfe-add-widget-btn')]").first();
  }
  await plusIcon.waitFor({ state: 'visible', timeout: 10000 });
  await plusIcon.click();
  await page.waitForTimeout(1000);

  // Bước 3: Tìm kiếm widget
  const searchField = page.locator("//input[@placeholder='Search...']").first();
  await searchField.waitFor({ state: 'visible', timeout: 10000 });
  await searchField.fill(searchTerm);
  await page.waitForTimeout(1000);

  // Bước 4: Chọn widget từ danh sách
  const itemText =
    searchTerm === 'P&S'
      ? 'Purchase & Sales'
      : searchTerm === 'Pos'
        ? 'Positions'
        : searchTerm === 'Orders'
          ? 'Orders'
          : 'Fills';
  const widgetItem = page.locator(`//div[@wpfefocuslistitem and .//span[text()='${itemText}']]`).first();
  await widgetItem.waitFor({ state: 'visible', timeout: 10000 });
  await widgetItem.click();
  await page.waitForTimeout(1000);

  // Bước 5: Account selector -> All accounts -> OK
  const selectAccountBtn = page.locator("//button[contains(@class, 'wpfe-widget-account-selector-button')]").first();
  await selectAccountBtn.waitFor({ state: 'visible', timeout: 10000 });
  await selectAccountBtn.click();
  await page.waitForTimeout(1000);

  const allAccountsItem = page.locator(
    "//div[contains(@class, 'wpfe-account-selector-item-list-item') and .//span[text()='All accounts']]"
  ).first();
  await allAccountsItem.waitFor({ state: 'visible', timeout: 10000 });
  await allAccountsItem.click();
  await page.waitForTimeout(1000);

  const okBtn = page.locator("//div[text()='OK']").first();
  await okBtn.waitFor({ state: 'visible', timeout: 10000 });
  await okBtn.click();

  // Bước 6: Chờ dữ liệu bảng đồng bộ xong (Dynamic Wait)
  // Chờ tối thiểu 4s, tối đa 16s hoặc cho đến khi con quay loading của widget biến mất
  console.log(`[CQG] Chờ dữ liệu bảng "${tabLabel}" đồng bộ từ máy chủ CQG Gateway...`);
  await waitForCqgNotLoading(page, 16000);

  const widgetSpinnerSelector =
    "wpfe-widget-tab-control:has(.wpfe-tab-header-active) mat-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .mat-mdc-progress-spinner, wpfe-widget-tab-control:has(.wpfe-tab-header-active) .wpfe-loading-spinner";
  const startWait = Date.now();
  while (Date.now() - startWait < 16000) {
    await page.waitForTimeout(500);
    const hasSpinner = await page.locator(widgetSpinnerSelector).first().isVisible().catch(() => false);
    if (!hasSpinner && Date.now() - startWait >= 4000) {
      break;
    }
  }
  console.log(`[CQG] Bảng "${tabLabel}" đã sẵn sàng sau ${((Date.now() - startWait) / 1000).toFixed(1)}s.`);

  const ellipsisXPath =
    `//wpfe-widget-tab-control[@data-help-id='g1.w431']//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//span[contains(text(), '${tabLabel}: All')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']` +
    ' | ' +
    `//div[contains(@class, 'wpfe-tab-header-active')]/ancestor::wpfe-widget-tab-control[not(@data-help-id='g3.w0')][1]//mat-icon[@data-mat-icon-name='ellipsis-v']`;
  const downloadBtnXPath = `//div[contains(text(), "${downloadText}")]`;

  // Bước 7: Mở menu 3 chấm và bấm Download
  let downloaded = false;
  for (let attempt = 1; attempt <= 10; attempt++) {
    console.log(`[CQG] Mở menu 3 chấm (lần ${attempt}/10)...`);
    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(500);

    const ellipsisButton = page.locator(ellipsisXPath).first();
    await ellipsisButton.waitFor({ state: 'visible', timeout: 5000 });
    await ellipsisButton.click();
    await page.waitForTimeout(1500);

    const downloadBtn = page.locator(downloadBtnXPath).first();
    const isVisible = await downloadBtn.isVisible().catch(() => false);

    let isClickable = false;
    if (isVisible) {
      isClickable = await downloadBtn.evaluate((el) => {
        const item = el.closest('button, [role="menuitem"], .gpc-button, .mat-mdc-menu-item') || el;
        const hasDisabledAttr = item.hasAttribute('disabled') || item.getAttribute('aria-disabled') === 'true';
        const hasDisabledClass = item.classList.contains('disabled') ||
          item.classList.contains('mat-mdc-menu-item-disabled') ||
          item.classList.contains('gpc-button-disabled');
        const style = window.getComputedStyle(item);
        const isOpaque = parseFloat(style.opacity || '1') >= 0.7;
        const hasPointerEvents = style.pointerEvents !== 'none';
        return !hasDisabledAttr && !hasDisabledClass && isOpaque && hasPointerEvents;
      }).catch(() => false);
    }

    if (isClickable) {
      console.log(`[CQG] Nút "${downloadText}" đã sẵn sàng! Bấm tải...`);
      try {
        const destFolder = path.dirname(destFile);
        if (!fs.existsSync(destFolder)) fs.mkdirSync(destFolder, { recursive: true });

        const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
        await downloadBtn.click();
        const download = await downloadPromise;
        await download.saveAs(destFile);
        console.log(`[CQG] ✅ Đã lưu file thành công: ${destFile}`);
        downloaded = true;
        break;
      } catch (dlErr) {
        console.log(`[CQG] Bấm nút nhưng chưa tải được (${dlErr.message}). Đóng menu thử lại...`);
        await page.keyboard.press('Escape').catch(() => { });
        await page.waitForTimeout(3000);
      }
    } else {
      console.log(`[CQG] Bảng vẫn đang loading. Đóng menu chờ 3s...`);
      await page.keyboard.press('Escape').catch(() => { });
      await page.waitForTimeout(3000);
    }
  }

  // Đóng tab widget vừa mở để tránh kẹt tab
  try {
    await page.keyboard.press('Escape').catch(() => { });
    const closeButtonXPath =
      `//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//span[contains(text(), '${tabLabel}: All')]/ancestor::div[contains(@class, 'wpfe-widget-tab-header-content')][1]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]` +
      ' | ' +
      `//wpfe-widget-tab-control[not(@data-help-id='g3.w0')]//div[contains(@class, 'wpfe-tab-header-active')]//button[contains(@class, 'wpfe-widget-tab-header-close-button')]`;
    const closeBtn = page.locator(closeButtonXPath).first();
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => { });
      console.log(`[CQG] Đã đóng tab widget: ${tabLabel}: All`);
    }
  } catch { }

  if (!downloaded) {
    throw new Error(`Tải ${path.basename(destFile)} thất bại.`);
  }

  const widgetDurationSec = ((Date.now() - widgetStart) / 1000).toFixed(1);
  console.log(`⏱️ [CQG] Hoàn tất mở widget và xuất file ${path.basename(destFile)} trong: ${widgetDurationSec}s\n`);
  return { durationSec: widgetDurationSec };
}

// ── Đăng xuất an toàn khỏi CQG ──────────────────────────────────────────────
async function logoutCqg(page) {
  try {
    console.log('[CQG] Đang thực hiện Log off để giải phóng phiên làm việc...');
    await page.keyboard.press('Escape').catch(() => { });
    await page.keyboard.press('Escape').catch(() => { });
    await page.waitForTimeout(500);

    const logoutIconSelectors = [
      "//mat-icon[@data-mat-icon-name='sign-out']",
      "//mat-icon[contains(@class, 'sign-out')]",
      "//div[contains(@class, 'wpfe-desktop-sidebar-toolbar-item')]//mat-icon[@data-mat-icon-name='sign-out']",
      "//button[contains(@aria-label, 'Sign out') or contains(@aria-label, 'Log off')]",
    ];
    const logoutIcon = page.locator(logoutIconSelectors.join(' | ')).first();
    let isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      const collapseIcon = page.locator(
        "//*[contains(@class, 'gpc-icon wpfe-desktop-sidebar-toolbar-item-header-icon gpc-icon-size-big gpc-icon-name-wpfe-chevron-up')]"
      ).first();
      if (await collapseIcon.isVisible({ timeout: 1500 }).catch(() => false)) {
        await collapseIcon.click().catch(() => { });
        await page.waitForTimeout(500);
      }
      isVisible = await logoutIcon.isVisible({ timeout: 2000 }).catch(() => false);
    }

    if (isVisible) {
      await logoutIcon.click({ timeout: 3000 });
      await page.waitForTimeout(500);

      const logoffMenuItem = page.locator(
        "//div[contains(@class, 'wpfe-dropdown-menu-item-text-content') and (text()='Log off' or text()='Log out' or text()='Đăng xuất')] | //span[text()='Log off' or text()='Log out']"
      ).first();
      if (await logoffMenuItem.isVisible({ timeout: 3000 }).catch(() => false)) {
        await logoffMenuItem.click({ timeout: 3000 });
        await page.waitForTimeout(500);
      }

      const dialogConfirmBtn = page.locator(
        "wpfe-confirmation-dialog button.wpfe-confirm, wpfe-confirmation-dialog button:has-text('Log off'), //wpfe-confirmation-dialog//button[contains(@class, 'wpfe-confirm')]"
      ).first();

      if (await dialogConfirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await dialogConfirmBtn.click({ force: true, timeout: 3000 }).catch(() => { });
      }
      console.log('[CQG] Đã hoàn tất Log off thành công.');
    }
  } catch (err) {
    console.log(`[CQG] Bỏ qua lỗi logoff: ${err.message}`);
  }
}

// ── MAIN RUNNER ─────────────────────────────────────────────────────────────
async function run() {
  console.log('========================================================================');
  console.log('  TEST TỰ ĐỘNG TẢI BÁO CÁO CQG (PLAYWRIGHT STANDALONE TEST)              ');
  console.log('========================================================================\n');

  // Phân tích tham số dòng lệnh
  const args = process.argv.slice(2);
  const isHeadless = !args.includes('--headed') && process.env.HEADED !== 'true';
  const isAll = args.includes('--all') || args.includes('--all-accounts') || args.includes('--4tabs');
  const isCleanOnly = args.includes('--clean-only');
  const keyArg = args.find((a) => a.startsWith('--key='));
  const targetKey = keyArg ? keyArg.split('=')[1].toUpperCase().trim() : null;

  const destArg = args.find((a) => a.startsWith('--dest='));
  const defaultDestDir = destArg
    ? path.resolve(destArg.split('=')[1].trim())
    : path.join(__dirname, '..', '..', 'data', 'backup', 'cqg_test');

  if (!fs.existsSync(defaultDestDir)) {
    fs.mkdirSync(defaultDestDir, { recursive: true });
  }

  // 1. Kết nối MongoDB lấy cấu hình CQG
  const uri =
    process.env.MONGODB_URI ||
    'mongodb+srv://broly1009a_db_user:C1m2altuPaseoDOx@devs.bqtaxow.mongodb.net/mxv_shift_checklist?retryWrites=true&w=majority';

  console.log('1. Lấy thông tin tài khoản CQG từ cơ sở dữ liệu...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_cqg' });
  if (!setting) {
    console.error('❌ Không tìm thấy cấu hình bot_credentials_cqg trong CSDL!');
    await mongoose.disconnect();
    return;
  }

  let creds = {};
  try {
    creds = JSON.parse(decrypt(setting.value));
  } catch (err) {
    console.error('❌ Lỗi giải mã credentials CQG:', err.message);
    await mongoose.disconnect();
    return;
  }
  await mongoose.disconnect();

  const cqgUrl = creds.urlTrade || creds.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced';
  const username = creds.username1 || creds.usernameCQG1;
  const password = creds.password1 || creds.passwordCQG1;

  if (!username || !password) {
    console.error('❌ Thiếu username/password cho tài khoản CQG1!');
    return;
  }

  console.log(`- CQG URL   : ${cqgUrl}`);
  console.log(`- Tài khoản : ${username}`);
  console.log(`- Thư mục   : ${defaultDestDir}`);

  // Định nghĩa danh mục báo cáo cần test
  const WIDGET_MAP = {
    FR: {
      searchTerm: 'Fills',
      tabLabel: 'Fills',
      downloadText: "Download today's fills in view",
      fileName: 'FR1.xlsx',
      expectedType: 'FR',
      name: 'Khớp lệnh (Fills)',
    },
    PS: {
      searchTerm: 'P&S',
      tabLabel: 'P&S',
      downloadText: 'Download Purchase and sales in view',
      fileName: 'PS1.xlsx',
      expectedType: 'PS',
      name: 'Tất toán & Vị thế ròng (P&S)',
    },
    OP: {
      searchTerm: 'Pos',
      tabLabel: 'Pos',
      downloadText: 'Download open positions in view',
      fileName: 'OP1.xlsx',
      expectedType: 'OP',
      name: 'Trạng thái mở (Positions)',
    },
    OD: {
      searchTerm: 'Orders',
      tabLabel: 'Orders',
      downloadText: 'Download orders in view',
      fileName: 'OD1.xlsx',
      expectedType: 'OD',
      name: 'Sổ lệnh (Orders)',
    },
  };

  let reportsToRun = [];
  if (isCleanOnly) {
    console.log('\n🧹 Chế độ: Chỉ mở trình duyệt dọn sạch tab widget rác.');
  } else if (targetKey && WIDGET_MAP[targetKey]) {
    reportsToRun.push(WIDGET_MAP[targetKey]);
    console.log(`\n🎯 Chế độ: Chỉ test DUY NHẤT 1 tab: ${WIDGET_MAP[targetKey].name} (${WIDGET_MAP[targetKey].fileName})`);
  } else if (isAll) {
    reportsToRun = [WIDGET_MAP.FR, WIDGET_MAP.PS, WIDGET_MAP.OP, WIDGET_MAP.OD];
    console.log('\n🚀 Chế độ --all: Tải toàn bộ 4 tab (FR1, PS1, OP1, OD1)');
  } else {
    // MẶC ĐỊNH DUY NHẤT 1 TAB ĐỂ TRÁNH MỞ TRÀN 4 TAB
    reportsToRun.push(WIDGET_MAP.FR);
    console.log('\n🚀 Chế độ MẶC ĐỊNH: Chỉ test DUY NHẤT 1 tab: Khớp lệnh FR1 (Fills)');
    console.log('   (Để test tab khác, dùng: --key=PS | --key=OP | --key=OD | --all)\n');
  }

  // 2. Tìm trình duyệt Edge / Chrome
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const executablePath = edgePaths.find((p) => fs.existsSync(p)) || null;
  console.log(`- Trình duyệt: ${executablePath || 'Playwright Chromium default'} (${isHeadless ? 'Headless' : 'Headed'})`);

  // Sử dụng profile sản xuất cqg_profile_1 để tái sử dụng toàn bộ cache WebAssembly/Angular
  // giúp trang vượt qua màn hình spinner trong 3-5 giây thay vì tải lại từ đầu gây treo spinner.
  const profileDir = path.join(process.cwd(), 'temp', 'cqg_profile_1');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  // Xóa lock file mồ côi (SingletonLock) phòng ngừa PM2 hoặc phiên trước crash đột ngột
  ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach((file) => {
    const p = path.join(profileDir, file);
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p);
      } catch {}
    }
  });

  const launchOptions = {
    headless: isHeadless,
    slowMo: isHeadless ? 0 : 50,
    args: [
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
    ],
    viewport: null,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    acceptDownloads: true,
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  console.log('\n2. Khởi chạy trình duyệt và đăng nhập CQG...');
  const context = await chromium.launchPersistentContext(profileDir, launchOptions);
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  // Ẩn cờ navigator.webdriver để tránh cơ chế bảo mật của CQG chặn tải WebAssembly
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });
  page.setDefaultTimeout(60000);

  const startTime = Date.now();
  const errors = [];

  const timings = {
    spinnerWaitSec: '0.0',
    f5WaitSec: '0.0',
    preF5Sec: '0.0',
    f5Triggered: false,
    loginSec: '0.0',
    widgetDownloads: [],
  };

  try {
    const pageOpenStart = Date.now();
    let f5StartTime = 0;

    // Sử dụng URL chuẩn có ref=forced của CQG để tránh bị kẹt Angular Router
    console.log(`[CQG] Mở trang đăng nhập: ${cqgUrl}...`);
    try {
      await page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 });
    } catch (navErr) {
      console.log(`[CQG] Tải trang lần 1 bị chậm (${navErr.message}), tự động reload trang...`);
      await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() =>
        page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 })
      );
    }

    // Dò tìm form đăng nhập hoặc dashboard (thông thường chỉ mất 3-4s với cache)
    const detectState = async (timeoutMs = 12000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const hasLogin = await page
          .locator('input[name="userName"], input[name="username"], input[type="password"]')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasLogin) return 'LOGIN';

        const hasDashboard = await page
          .locator('div.wpfe-logo-image, .wpfe-main-toolbar, //div[text()=\'Ho\']')
          .first()
          .isVisible()
          .catch(() => false);
        if (hasDashboard) return 'DASHBOARD';

        await new Promise((r) => setTimeout(r, 300));
      }
      return 'TIMEOUT';
    };

    let state = await detectState(12000);
    if (state === 'TIMEOUT') {
      timings.f5Triggered = true;
      timings.preF5Sec = ((Date.now() - pageOpenStart) / 1000).toFixed(1);
      console.log(`[CQG] Trang quay spinner vượt quá ${timings.preF5Sec}s. Tự động Reload (F5) sớm để nạp từ Disk Cache...`);
      f5StartTime = Date.now();
      await page.reload({ waitUntil: 'commit', timeout: 60000 }).catch(() =>
        page.goto(cqgUrl, { waitUntil: 'commit', timeout: 60000 })
      );
      state = await detectState(20000);
      if (state === 'TIMEOUT') {
        throw new Error(`[CQG] Không tìm thấy Form đăng nhập hoặc Dashboard sau 60s chờ tải trang (${username}).`);
      }
    }

    const spinnerDoneTime = Date.now();
    timings.spinnerWaitSec = ((spinnerDoneTime - pageOpenStart) / 1000).toFixed(1);
    if (timings.f5Triggered) {
      timings.f5WaitSec = ((spinnerDoneTime - f5StartTime) / 1000).toFixed(1);
      console.log(`\n⏱️ [CQG] VÒNG QUAY SPINNER ĐÃ XONG SAU: ${timings.spinnerWaitSec}s! (Lần 1 chờ: ${timings.preF5Sec}s | Sau khi F5 nạp tức thì: ${timings.f5WaitSec}s)`);
    } else {
      console.log(`\n⏱️ [CQG] VÒNG QUAY SPINNER ĐÃ XONG SAU: ${timings.spinnerWaitSec}s! (Nạp trực tiếp từ Disk Cache, không cần F5)`);
    }
    console.log(`🎯 Trạng thái nhận diện: ${state === 'LOGIN' ? 'Form Đăng Nhập (Cần điền User/Pass)' : 'Dashboard (Phiên làm việc sẵn sàng)'}`);

    const loginStart = Date.now();
    if (state === 'LOGIN') {
      console.log(`[CQG] Điền tài khoản đăng nhập: ${username}...`);
      await page.fill('input[name="userName"]', username);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await waitForCqgDashboardLogo(page, username, 120000);
    } else {
      console.log(`[CQG] Đã sẵn sàng tại Dashboard (phiên trước còn hiệu lực)!`);
      await waitForCqgDashboardLogo(page, username, 10000);
    }

    await waitForCqgNotLoading(page, 30000);
    timings.loginSec = ((Date.now() - loginStart) / 1000).toFixed(1);
    console.log(`[CQG] ✅ Đăng nhập thành công và vào Dashboard trong: ${timings.loginSec}s!\n`);

    // 3. Thực hiện tải báo cáo
    for (const report of reportsToRun) {
      const destFile = path.join(defaultDestDir, report.fileName);
      try {
        const widgetResult = await downloadSingleCqgWidget(
          page,
          report.searchTerm,
          report.tabLabel,
          report.downloadText,
          destFile
        );
        timings.widgetDownloads.push({
          fileName: report.fileName,
          durationSec: widgetResult ? widgetResult.durationSec : 'N/A',
        });
      } catch (err) {
        errors.push(`${report.fileName}: ${err.message}`);
      }
    }

    // Đăng xuất
    await logoutCqg(page);
  } catch (err) {
    console.error(`❌ Lỗi phiên CQG: ${err.message}`);
    errors.push(err.message);
  } finally {
    await context.close().catch(() => { });
  }

  // 4. Bảng tổng kết kết quả
  const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========================================================================');
  console.log(`3. BẢNG TỔNG KẾT KẾT QUẢ KIỂM THỬ BÁO CÁO CQG (HOÀN THÀNH TRONG ${elapsedSeconds}s)`);
  console.log('========================================================================');

  console.log('\n⏱️ BẢNG ĐO LƯỜNG THỜI GIAN CHI TIẾT (BENCHMARK TIMELINE):');
  console.log(`  1. Thời gian nạp trang & kết thúc spinner : ${timings.spinnerWaitSec}s ${timings.f5Triggered ? `(Chờ ban đầu: ${timings.preF5Sec}s | Nạp sau F5: ${timings.f5WaitSec}s)` : '(Nạp thẳng từ Disk Cache)'}`);
  console.log(`  2. Thời gian xác thực & vào Dashboard      : ${timings.loginSec}s`);
  timings.widgetDownloads.forEach((w) => {
    console.log(`  3. Mở widget & xuất file [${w.fileName}]       : ${w.durationSec}s`);
  });
  console.log('  -------------------------------------------------------------');
  console.log(`  👉 TỔNG THỜI GIAN HOÀN THÀNH TOÀN BỘ       : ${elapsedSeconds}s\n`);

  if (reportsToRun.length > 0) {
    const analyses = reportsToRun.map((r) => {
      const fullPath = path.join(defaultDestDir, r.fileName);
      return analyzeExcelFile(fullPath, r.fileName, r.expectedType);
    });

    const tableData = analyses.map((a) => ({
      'Tên file': a.fileName,
      'Kích thước': `${(a.fileSize / 1024).toFixed(1)} KB`,
      'Loại mong đợi': a.expectedType,
      'Nhận diện nội dung': a.detectedType,
      'Trạng thái': a.isMatch ? 'PASS ✅' : 'FAIL ❌',
      'Số dòng': a.rowCount,
      'Mã MD5': a.md5 ? a.md5.slice(0, 10) : 'N/A',
    }));

    console.table(tableData);

    const allPassed = analyses.every((a) => a.isMatch);
    if (allPassed) {
      console.log(`\n🎉 TẤT CẢ ${analyses.length} BÁO CÁO CQG ĐỀU TẢI VỀ THÀNH CÔNG VÀ CHUẨN XÁC 100%!`);
      console.log(`📂 File lưu tại: ${defaultDestDir}`);
    } else {
      console.log('\n⚠️ Có báo cáo chưa tải được hoặc không đúng nội dung. Xem chi tiết lỗi ở trên.');
    }
  }
}

run().catch((err) => {
  console.error('Fatal Error:', err);
  process.exit(1);
});
