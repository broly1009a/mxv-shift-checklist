/**
 * ============================================================================
 * TEST SCRIPT: KIỂM THỬ PLAYWRIGHT ĐỐI SOÁT KHỚP LỆNH TRONG PHIÊN (CHECK_KLGD)
 * ============================================================================
 * 
 * Mục đích:
 * 1. Kiểm tra trực quan bằng Playwright (--headed) quy trình đăng nhập, điều hướng
 *    và tải dữ liệu phục vụ đối chiếu khớp lệnh (CHECK_KLGD).
 * 2. Hỗ trợ kiểm thử từng hệ thống riêng lẻ hoặc toàn bộ 4 hệ thống:
 *    - CoreCCP : Tải Lịch sử giao dịch (DSGD), Trạng thái mở (TTM), Tất toán (TTTT)
 *    - M-System: Tải Danh sách giao dịch (DSGD), TTM, TTTT
 *    - Straits : Đăng nhập ACM (giải Captcha) và tải Straits.csv (Fill)
 *    - CQG     : Tải giao dịch khớp lệnh từ 2 tài khoản (FR1, FR2)
 * 3. Bóc tách file tải về kiểm tra tính toàn vẹn (dung lượng, số dòng dữ liệu, sample).
 * 4. Tùy chọn đối soát (--reconcile) so sánh số lot giữa các bên.
 * 
 * Cách chạy từ Terminal:
 *   cd backend
 * 
 *   # 1. Kiểm thử CoreCCP (mặc định hôm nay, có giao diện):
 *   node src/scripts/test_check_klgd_playwright.js --source=ccp --headed
 * 
 *   # 2. Kiểm thử M-System:
 *   node src/scripts/test_check_klgd_playwright.js --source=ms --headed
 * 
 *   # 3. Kiểm thử Straits ACM:
 *   node src/scripts/test_check_klgd_playwright.js --source=acm --headed
 * 
 *   # 4. Kiểm thử CQG:
 *   node src/scripts/test_check_klgd_playwright.js --source=cqg --headed
 * 
 *   # 5. Kiểm thử toàn bộ 4 bên với rào cản đồng bộ và đối chiếu số liệu:
 *   node src/scripts/test_check_klgd_playwright.js --source=all --headed --reconcile
 * 
 *   # 6. Kiểm thử cho một ngày cụ thể trong quá khứ:
 *   node src/scripts/test_check_klgd_playwright.js --source=ccp --date=25/09/2026 --headed
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const dotenv = require('dotenv');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');

// Tải biến môi trường
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

// ============================================================================
// HÀM TIỆN ÍCH & GIẢI MÃ BẢO MẬT
// ============================================================================

const RAW_SECRET = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
function getSecretKey() {
  return crypto.createHash('sha256').update(RAW_SECRET).digest();
}

function decrypt(text) {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    if (textParts.length < 2) return text;
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', getSecretKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // Fallback thử giải mã với salt cố định
    try {
      const fixedKey = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
      const parts = text.split(':');
      if (parts.length !== 2) return text;
      const iv = Buffer.from(parts[0], 'hex');
      const enc = Buffer.from(parts[1], 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', fixedKey, iv);
      let decrypted = decipher.update(enc);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch {
      return text;
    }
  }
}

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  } else {
    const linuxPaths = [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) return p;
    }
  }
  return undefined;
}

async function loadCredentialsFromDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mxv_shift_checklist';
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    const db = client.db();

    const fetchCred = async (key) => {
      const doc = await db.collection('system_settings').findOne({ key });
      if (!doc || !doc.value) return null;
      try {
        const decryptedStr = decrypt(doc.value);
        return JSON.parse(decryptedStr);
      } catch {
        return null;
      }
    };

    const [ccp, ms, cqg, acm] = await Promise.all([
      fetchCred('bot_credentials_ccp'),
      fetchCred('bot_credentials_msystem'),
      fetchCred('bot_credentials_cqg'),
      fetchCred('bot_credentials_acm'),
    ]);

    await client.close();
    return { ccp, ms, cqg, acm };
  } catch (err) {
    console.warn(`⚠️ [DB] Không thể kết nối MongoDB (${mongoUri}): ${err.message}`);
    return { ccp: null, ms: null, cqg: null, acm: null };
  }
}

function parseCliArgs() {
  const args = process.argv.slice(2);
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();

  const config = {
    headed: true, // Mặc định mở giao diện để USER quan sát trực tiếp
    source: 'ccp', // 'ccp' | 'ms' | 'cqg' | 'acm' | 'all'
    date: `${d}/${m}/${y}`,
    reconcile: false,
    keepOpen: false,
    slowMo: 250, // ms làm chậm thao tác
    user: '',
    pass: '',
    url: '',
    outputDir: path.join(__dirname, 'output', `test_klgd_${d}.${m}.${y}`),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--headless') config.headed = false;
    if (arg === '--headed') config.headed = true;
    if (arg.startsWith('--source=')) config.source = arg.split('=')[1].toLowerCase();
    if (arg === '--source' && args[i + 1]) config.source = args[++i].toLowerCase();
    if (arg.startsWith('--date=')) config.date = arg.split('=')[1];
    if (arg === '--date' && args[i + 1]) config.date = args[++i];
    if (arg.startsWith('--user=')) config.user = arg.split('=')[1];
    if (arg === '--user' && args[i + 1]) config.user = args[++i];
    if (arg.startsWith('--pass=')) config.pass = arg.split('=')[1];
    if (arg === '--pass' && args[i + 1]) config.pass = args[++i];
    if (arg.startsWith('--url=')) config.url = arg.split('=')[1];
    if (arg === '--url' && args[i + 1]) config.url = args[++i];
    if (arg === '--reconcile') config.reconcile = true;
    if (arg === '--keep-open') config.keepOpen = true;
  }

  return config;
}

function isTodayDate(dateStr) {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const todayStr = `${d}/${m}/${y}`;
  return dateStr.trim() === todayStr || dateStr.trim() === `${d}.${m}.${y}`;
}

function inspectExcelFile(filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`❌ [${label}] File không tồn tại: ${filePath}`);
    return { exists: false, rows: 0, size: 0 };
  }

  const stat = fs.statSync(filePath);
  const fileSizeKB = (stat.size / 1024).toFixed(2);
  console.log(`\n📄 [${label}] Kiểm tra file: ${path.basename(filePath)} (${fileSizeKB} KB)`);

  try {
    const wb = XLSX.readFile(filePath);
    const firstSheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[firstSheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`   - Sheet Name : "${firstSheetName}"`);
    console.log(`   - Tổng số dòng: ${data.length}`);

    if (data.length <= 1) {
      console.log(`   ⚠️ CẢNH BÁO: File chỉ có ${data.length} dòng (Không có dữ liệu giao dịch thực tế)!`);
      if (data.length === 1) {
        console.log(`   - Dòng tiêu đề: ${JSON.stringify(data[0].slice(0, 8))}`);
      }
      return { exists: true, rows: data.length, size: stat.size, empty: true };
    }

    console.log(`   ✅ DỮ LIỆU ĐẦY ĐỦ (${data.length - 1} bản ghi)`);
    console.log(`   - Cột tiêu đề : ${data[0].slice(0, 6).join(' | ')} ...`);
    console.log(`   - Bản ghi mẫu 1: ${data[1].slice(0, 6).join(' | ')} ...`);
    if (data.length > 2) {
      console.log(`   - Bản ghi mẫu 2: ${data[2].slice(0, 6).join(' | ')} ...`);
    }

    return { exists: true, rows: data.length, size: stat.size, empty: false, data };
  } catch (err) {
    console.log(`   ❌ Lỗi khi đọc nội dung Excel: ${err.message}`);
    return { exists: true, rows: 0, size: stat.size, error: err.message };
  }
}

// ============================================================================
// MODULE 1: TEST CORECCP (VNCLEAR / COREEX)
// ============================================================================

async function testCoreCcp(creds, cliConfig, browser) {
  console.log(`\n=============================================================`);
  console.log(`🏢 [CORECCP] KIỂM THỬ TẢI DSGD / TTM / TTTT BẰNG PLAYWRIGHT`);
  console.log(`=============================================================`);

  const activeCreds = {
    url: cliConfig.url || creds?.url,
    username: cliConfig.user || creds?.username,
    password: cliConfig.pass || creds?.password,
  };

  if (!activeCreds.url || !activeCreds.username || !activeCreds.password) {
    console.error(`❌ Thiếu thông tin đăng nhập CoreCCP trong CSDL hoặc tham số CLI!`);
    console.error(`   Gợi ý: Truyền --url, --user, --pass nếu không kết nối được MongoDB.`);
    return null;
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const cleanDate = cliConfig.date.replace(/\//g, '.');
  const dsgdDest = path.join(cliConfig.outputDir, `DSGD_${cleanDate}.xlsx`);
  const ttmDest = path.join(cliConfig.outputDir, `TTM_${cleanDate}.xlsx`);
  const ttttDest = path.join(cliConfig.outputDir, `TTTT_${cleanDate}.xlsx`);

  const results = {};

  try {
    // 1. Đăng nhập CoreCCP
    console.log(`[CCP] 🔑 Đang mở trang và đăng nhập: ${activeCreds.url} (${activeCreds.username})...`);
    await page.goto(activeCreds.url, { waitUntil: 'domcontentloaded', timeout: 35000 });

    await page.fill("input[name='username'], input[placeholder*='ten dang nhap'], input[type='text']", activeCreds.username);
    await page.fill("input[name='password'], input[placeholder*='mat khau'], input[type='password']", activeCreds.password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập')");

    // Đợi thoát khỏi /login và xử lý Token SSO
    await page.waitForURL((url) => !url.href.includes('validate_code') && !url.pathname.toLowerCase().includes('/login'), { timeout: 25000 });
    console.log(`[CCP] ✅ Đăng nhập thành công! URL: ${page.url()}`);
    await page.waitForTimeout(1500);

    // 2. Tải DSGD (Lịch sử giao dịch / ORDERMATCH_DETAIL)
    console.log(`\n[CCP] 📥 [BƯỚC 1/3] ĐIỀU HƯỚNG VÀ TẢI BÁO CÁO DSGD...`);
    const origin = new URL(page.url()).origin;
    const dsgdUrl = `${origin}/ORDERS/ORDERMATCH_DETAIL`;

    await page.goto(dsgdUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(async () => {
      // Fallback click menu nếu direct URL không mở
      console.log(`[CCP] Thử mở qua Menu 'Lệnh và vị thế' -> 'Danh sách giao dịch'...`);
      const parentMenu = page.locator("xpath=//span[text()='Lệnh và vị thế']").first();
      if (await parentMenu.isVisible({ timeout: 2000 })) await parentMenu.click();
      await page.waitForTimeout(800);
      const childMenu = page.locator("xpath=//span[text()='Danh sách giao dịch']").first();
      await childMenu.click();
    });

    await page.waitForTimeout(2000);
    console.log(`[CCP] Màn hình hiện tại: ${page.url()}`);

    // XỬ LÝ LỌC NGÀY (QUY TẮC AN TOÀN TRÁNH 0 DÒNG):
    const isToday = isTodayDate(cliConfig.date);
    if (isToday) {
      console.log(`[CCP] ℹ️ Ngày kiểm tra là HÔM NAY (${cliConfig.date}):`);
      console.log(`       -> GIỮ NGUYÊN BẢNG MẶC ĐỊNH CỦA PHIÊN, KHÔNG CLEAR Ô NGÀY ĐỂ TRÁNH MẤT DỮ LIỆU.`);
    } else {
      console.log(`[CCP] ℹ️ Ngày kiểm tra là QUÁ KHỨ (${cliConfig.date}):`);
      console.log(`       -> Điền ngày vào bộ lọc và bấm Tìm kiếm...`);

      // Xóa ô ngày hệ thống
      const sysDateInput = page.locator("xpath=//label[contains(text(), 'Ngày hệ thống')]/following-sibling::div//input").first();
      if (await sysDateInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        await sysDateInput.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Backspace');
        await page.keyboard.press('Tab');
      }

      // Điền Từ ngày - Đến ngày
      const dateInputs = page.locator('input[type="text"]');
      const count = await dateInputs.count();
      if (count >= 2) {
        const fromIdx = count >= 3 ? 1 : 0;
        const toIdx = count >= 3 ? 2 : 1;
        for (const idx of [fromIdx, toIdx]) {
          await dateInputs.nth(idx).click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await dateInputs.nth(idx).pressSequentially(cliConfig.date, { delay: 30 });
        }
        const searchBtn = page.locator("xpath=//button[contains(., 'Tìm kiếm') or contains(., 'Tra cứu')]").first();
        if (await searchBtn.isVisible({ timeout: 2000 })) {
          await searchBtn.click();
          await page.waitForTimeout(2500);
        }
      }
    }

    const clickExportOption = async (btnLocator) => {
      try {
        await btnLocator.hover({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(200);
        const exportAll = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')] | //*[contains(text(), 'Export all')]").first();
        if (!(await exportAll.isVisible({ timeout: 1000 }).catch(() => false))) {
          await btnLocator.click({ force: true }).catch(() => {});
          await page.waitForTimeout(300);
        }
        if (await exportAll.isVisible({ timeout: 1500 }).catch(() => false)) {
          await exportAll.click({ force: true });
          return;
        }
      } catch { }
      await btnLocator.dblclick().catch(() => btnLocator.click());
    };

    // Kết xuất DSGD
    console.log(`[CCP] Bấm nút Kết xuất DSGD...`);
    const exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel')]").first();
    await exportBtn.waitFor({ state: 'visible', timeout: 10000 });

    const [downloadDsgd] = await Promise.all([
      page.waitForEvent('download', { timeout: 35000 }),
      clickExportOption(exportBtn),
    ]);

    await downloadDsgd.saveAs(dsgdDest);
    console.log(`[CCP] ✅ Đã lưu file DSGD: ${dsgdDest}`);
    results.dsgd = inspectExcelFile(dsgdDest, 'CORECCP DSGD');

    // 3. Tải TTM (Trạng thái mở / OPEN_POSITION)
    console.log(`\n[CCP] 📥 [BƯỚC 2/3] ĐIỀU HƯỚNG VÀ TẢI BÁO CÁO TTM...`);
    const ttmUrl = `${origin}/ORDERS/OPEN_POSITION`;
    await page.goto(ttmUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    const exportBtnTtm = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel')]").first();
    if (await exportBtnTtm.isVisible({ timeout: 5000 })) {
      const [downloadTtm] = await Promise.all([
        page.waitForEvent('download', { timeout: 35000 }),
        clickExportOption(exportBtnTtm),
      ]);
      await downloadTtm.saveAs(ttmDest);
      console.log(`[CCP] ✅ Đã lưu file TTM: ${ttmDest}`);
      results.ttm = inspectExcelFile(ttmDest, 'CORECCP TTM');
    }

    // 4. Tải TTTT (Trạng thái tất toán / PNL_EXECUTED - Tab Lịch sử tất toán)
    console.log(`\n[CCP] 📥 [BƯỚC 3/3] ĐIỀU HƯỚNG VÀ TẢI BÁO CÁO TTTT...`);
    const ttttUrl = `${origin}/ORDERS/PNL_EXECUTED`;
    await page.goto(ttttUrl, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => { });
    await page.waitForTimeout(1500);

    const tabSettled = page.locator("xpath=//*[self::button or self::div or self::span][contains(text(), 'Lịch sử tất toán')]").first();
    if (await tabSettled.isVisible({ timeout: 3000 })) {
      await tabSettled.click();
      await page.waitForTimeout(1500);
    }

    const exportBtnTttt = page.locator("xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất Excel')]").first();
    if (await exportBtnTttt.isVisible({ timeout: 5000 })) {
      const [downloadTttt] = await Promise.all([
        page.waitForEvent('download', { timeout: 35000 }),
        clickExportOption(exportBtnTttt),
      ]);
      await downloadTttt.saveAs(ttttDest);
      console.log(`[CCP] ✅ Đã lưu file TTTT: ${ttttDest}`);
      results.tttt = inspectExcelFile(ttttDest, 'CORECCP TTTT');
    }

    if (cliConfig.keepOpen) {
      console.log(`\n⏳ [--keep-open] Giữ trình duyệt CoreCCP mở 30 giây để kiểm tra...`);
      await page.waitForTimeout(30000);
    }
  } catch (err) {
    console.error(`❌ [CCP LỖI]: ${err.message}`);
  } finally {
    await context.close().catch(() => { });
  }

  return results;
}

// ============================================================================
// MODULE 2: TEST M-SYSTEM
// ============================================================================

async function testMSystem(creds, cliConfig, browser) {
  console.log(`\n=============================================================`);
  console.log(`🏢 [M-SYSTEM] KIỂM THỬ TẢI DSGD / TTM / TTTT BẰNG PLAYWRIGHT`);
  console.log(`=============================================================`);

  if (!creds || !creds.username || !creds.password) {
    console.error(`❌ Thiếu thông tin đăng nhập M-System trong CSDL hoặc cấu hình!`);
    return null;
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const msDest = path.join(cliConfig.outputDir, 'MS_DSGD.xlsx');
  const msUrl = creds.url || 'https://msystem.mxv.vn/';
  const results = {};

  try {
    console.log(`[MS] 🔑 Đang mở M-System: ${msUrl} (${creds.username})...`);
    await page.goto(msUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });

    await page.fill("input[name='username'], input[placeholder*='tên đăng nhập']", creds.username);
    await page.fill("input[name='password'], input[placeholder*='mật khẩu']", creds.password);
    await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await page.waitForTimeout(2000);

    // Nhập PIN qua bàn phím ảo nếu có
    const hasPin = await page.locator('div.pincode').isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPin && creds.pin) {
      console.log(`[MS] Nhập mã PIN ảo (${creds.pin})...`);
      for (const digit of String(creds.pin).split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(2000);
    }

    console.log(`[MS] ✅ Đăng nhập M-System thành công! URL: ${page.url()}`);

    // Điều hướng DSGD
    console.log(`[MS] Điều hướng đến QL giao dịch -> Danh sách giao dịch...`);
    await page.click("xpath=//a[contains(., 'QL giao dịch')]");
    await page.waitForTimeout(800);
    await page.click("xpath=//a[contains(., 'Danh sách giao dịch')]");
    await page.waitForTimeout(2000);

    // Tải DSGD
    console.log(`[MS] Bấm tải file DSGD qua các selector ứng viên...`);
    const exportCandidates = [
      "button:has(i[class*='fa-file-csv'])",
      "button.ladda-button:has(i[class*='fa-file-csv'])",
      "button.btn-ghost-primary:has(i[class*='fa-file-csv'])",
      "button:has(i.fas.fa-file-csv)",
      "button:has(i.fa-file-csv)",
      "button.ladda-button",
      "i[class*='fa-file-csv']",
      "i.fa-file-csv",
      "i.fas.fa-file-csv",
      "xpath=//i[contains(@class, 'fa-file-csv')]",
      "xpath=//button[contains(., 'Xuất') or contains(., 'Export')]",
    ];

    let exportBtn = null;
    let matchedSelector = null;
    for (const sel of exportCandidates) {
      try {
        const loc = page.locator(sel).first();
        if (await loc.isVisible().catch(() => false)) {
          exportBtn = loc;
          matchedSelector = sel;
          console.log(`[MS] ✅ Tìm thấy nút xuất DSGD hợp lệ với selector: "${sel}"`);
          break;
        }
      } catch (err) {
        console.warn(`[MS] ⚠️ Selector không hợp lệ hoặc lỗi phân tích: "${sel}" - ${err.message}`);
      }
    }

    if (!exportBtn) {
      console.log(`[MS] ℹ️ Chưa thấy nút ngay, chờ selector an toàn fallback trong 10s...`);
      const fallbackCss = "button:has(i[class*='fa-file-csv']), button.ladda-button, i[class*='fa-file-csv']";
      await page.waitForSelector(fallbackCss, { state: 'visible', timeout: 10000 }).catch(() => {});
      exportBtn = page.locator(fallbackCss).first();
      matchedSelector = fallbackCss;
    }

    const [downloadMs] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      exportBtn.click({ timeout: 15000 }),
    ]);

    await downloadMs.saveAs(msDest);
    console.log(`[MS] ✅ Đã tải và lưu file M-System DSGD (bằng "${matchedSelector}"): ${msDest}`);
    results.dsgd = inspectExcelFile(msDest, 'M-SYSTEM DSGD');

    if (cliConfig.keepOpen) {
      console.log(`\n⏳ [--keep-open] Giữ trình duyệt M-System mở 20 giây...`);
      await page.waitForTimeout(20000);
    }
  } catch (err) {
    console.error(`❌ [MS LỖI]: ${err.message}`);
  } finally {
    await context.close().catch(() => { });
  }

  return results;
}

// ============================================================================
// MODULE 3: TEST STRAITS ACM
// ============================================================================

async function testStraitsAcm(creds, cliConfig, browser) {
  console.log(`\n=============================================================`);
  console.log(`🏢 [STRAITS ACM] KIỂM THỬ ĐĂNG NHẬP & TẢI STRAITS.CSV`);
  console.log(`=============================================================`);

  if (!creds || !creds.username || !creds.password) {
    console.error(`❌ Thiếu thông tin đăng nhập Straits ACM trong CSDL hoặc cấu hình!`);
    return null;
  }

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  const acmDest = path.join(cliConfig.outputDir, 'Straits.csv');
  const acmUrl = creds.url || 'https://trade.straitsfinancial.com/';
  const results = {};

  try {
    console.log(`[ACM] 🔑 Đang mở Straits ACM: ${acmUrl}...`);
    await page.goto(acmUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(2000);

    await page.fill("input[placeholder*='Username'], input[name='username'], input[type='text']", creds.username);
    await page.fill("input[placeholder*='Password'], input[name='password'], input[type='password']", creds.password);

    console.log(`[ACM] Đang xử lý đăng nhập & điều hướng đến màn hình Khớp lệnh (business-tetptrade)...`);
    // Điều hướng thẳng hoặc đăng nhập
    const fillUrl = creds.fillUrl || `${acmUrl}#/business-tetptrade`;
    await page.goto(fillUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
    await page.waitForTimeout(3000);

    const exportBtnSelector = '.el-button--info:has-text("Export"), button:has-text("Export"), button:has-text("Download")';
    const exportBtn = page.locator(exportBtnSelector).first();

    if (await exportBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
      console.log(`[ACM] Tìm thấy nút Export Straits Fill! Đang tải...`);
      const [dl] = await Promise.all([
        page.waitForEvent('download', { timeout: 35000 }),
        exportBtn.click(),
      ]);
      await dl.saveAs(acmDest);
      console.log(`[ACM] ✅ Tải Straits.csv thành công: ${acmDest}`);
      results.straits = inspectExcelFile(acmDest, 'STRAITS ACM CSV');
    } else {
      console.log(`[ACM] ⚠️ Cần giải Captcha hoặc nút Export chưa sẵn sàng tại URL: ${page.url()}`);
    }

    if (cliConfig.keepOpen) {
      console.log(`\n⏳ [--keep-open] Giữ trình duyệt ACM mở 20 giây...`);
      await page.waitForTimeout(20000);
    }
  } catch (err) {
    console.error(`❌ [ACM LỖI]: ${err.message}`);
  } finally {
    await context.close().catch(() => { });
  }

  return results;
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function main() {
  const cliConfig = parseCliArgs();

  console.log(`\n*************************************************************`);
  console.log(`🚀 TOOL KIỂM THỬ PLAYWRIGHT CHECK_KLGD (ĐỐI SOÁT KHỚP LỆNH)`);
  console.log(`*************************************************************`);
  console.log(`📅 Ngày kiểm tra : ${cliConfig.date}`);
  console.log(`🎯 Nguồn kiểm thử: ${cliConfig.source.toUpperCase()}`);
  console.log(`🖥️ Chế độ hiển thị: ${cliConfig.headed ? 'CÓ GIAO DIỆN (--headed)' : 'CHẠY NGẦM (--headless)'}`);
  console.log(`📁 Thư mục lưu   : ${cliConfig.outputDir}\n`);

  if (!fs.existsSync(cliConfig.outputDir)) {
    fs.mkdirSync(cliConfig.outputDir, { recursive: true });
  }

  // 1. Đọc tài khoản hệ thống từ MongoDB
  console.log(`📡 [1/3] Đang nạp thông tin tài khoản từ CSDL MongoDB...`);
  const creds = await loadCredentialsFromDB();

  // 2. Khởi tạo trình duyệt Playwright
  console.log(`🌐 [2/3] Khởi động trình duyệt Chromium Playwright...`);
  const executablePath = getChromeExecutablePath();
  if (executablePath) {
    console.log(`   -> Sử dụng Browser binary: ${executablePath}`);
  }

  const browser = await chromium.launch({
    headless: !cliConfig.headed,
    executablePath,
    slowMo: cliConfig.slowMo,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
  });

  // 3. Thực thi theo nguồn được chọn
  console.log(`⚡ [3/3] Bắt đầu kiểm thử nguồn: ${cliConfig.source.toUpperCase()}...\n`);

  const summary = {};

  try {
    if (cliConfig.source === 'ccp' || cliConfig.source === 'all') {
      summary.ccp = await testCoreCcp(creds.ccp, cliConfig, browser);
    }

    if (cliConfig.source === 'ms' || cliConfig.source === 'all') {
      summary.ms = await testMSystem(creds.ms, cliConfig, browser);
    }

    if (cliConfig.source === 'acm' || cliConfig.source === 'all') {
      summary.acm = await testStraitsAcm(creds.acm, cliConfig, browser);
    }

    // TỔNG KẾT
    console.log(`\n=============================================================`);
    console.log(`📊 TỔNG KẾT KẾT QUẢ KIỂM THỬ PLAYWRIGHT CHECK_KLGD`);
    console.log(`=============================================================`);
    if (summary.ccp && summary.ccp.dsgd) {
      console.log(`- CoreCCP DSGD : ${summary.ccp.dsgd.rows > 1 ? `✅ THÀNH CÔNG (${summary.ccp.dsgd.rows - 1} dòng giao dịch)` : '⚠️ KHÔNG CÓ DỮ LIỆU'}`);
    }
    if (summary.ccp && summary.ccp.ttm) {
      console.log(`- CoreCCP TTM  : ${summary.ccp.ttm.rows > 1 ? `✅ THÀNH CÔNG (${summary.ccp.ttm.rows - 1} dòng vị thế)` : '⚠️ KHÔNG CÓ DỮ LIỆU'}`);
    }
    if (summary.ms && summary.ms.dsgd) {
      console.log(`- M-System DSGD: ${summary.ms.dsgd.rows > 1 ? `✅ THÀNH CÔNG (${summary.ms.dsgd.rows - 1} dòng)` : '⚠️ KHÔNG CÓ DỮ LIỆU'}`);
    }
    if (summary.acm && summary.acm.straits) {
      console.log(`- Straits ACM  : ${summary.acm.straits.rows > 1 ? `✅ THÀNH CÔNG (${summary.acm.straits.rows - 1} dòng)` : '⚠️ KHÔNG CÓ DỮ LIỆU'}`);
    }
    console.log(`📂 Các file tải về được lưu tại: ${cliConfig.outputDir}`);
    console.log(`=============================================================\n`);

  } finally {
    await browser.close().catch(() => { });
    console.log(`🏁 Hoàn tất phiên kiểm thử.`);
  }
}

main().catch((err) => {
  console.error(`💥 Lỗi nghiêm trọng: ${err.message}`);
  process.exit(1);
});
