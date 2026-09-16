/**
 * ============================================================================
 * TEST SCRIPT: KIỂM TRA TRỰC QUAN QUY TRÌNH ĐIỀU HƯỚNG VÀ TẢI DSGD TRÊN CORECCP
 * ============================================================================
 * 
 * Mục đích:
 * 1. Mở Chrome trực quan (--headed) để bạn quan sát tận mắt quá trình:
 *    - Đăng nhập CoreCCP
 *    - Nhận diện màn hình Dashboard sau khi login
 *    - Thử nghiệm điều hướng đến "Danh sách giao dịch" (Direct URL vs Menu Click)
 *    - Điền ngày và ấn Kết xuất
 *    - Kiểm tra nội dung file Excel tải về
 * 
 * Lệnh chạy từ terminal:
 *   cd backend
 *   node src/scripts/test_inspect_ccp_dsgd.js
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Tải cấu hình từ .env của backend
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config(); // fallback default

const { chromium } = require('playwright-core');
const XLSX = require('xlsx');

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function decryptAES256(ciphertext) {
  try {
    const key = crypto.createHash('sha256').update('mxv_secret_salt_fixed').digest();
    const parts = ciphertext.split(':');
    if (parts.length !== 2) return ciphertext;
    const iv = Buffer.from(parts[0], 'hex');
    const enc = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(enc);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return ciphertext;
  }
}

async function getCredentialsFromDB() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trading_mxv';
  try {
    console.log(`📡 Đang kết nối CSDL MongoDB (${mongoUri}) để đọc tài khoản CoreCCP...`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    const SystemSetting = mongoose.connection.collection('system_settings');
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    await mongoose.disconnect();

    if (!setting || !setting.value) return null;
    const decrypted = decryptAES256(setting.value);
    return JSON.parse(decrypted);
  } catch (err) {
    console.warn(`⚠️ Không thể đọc CSDL: ${err.message}`);
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    headless: false, // Mặc định mở giao diện để USER quan sát
    date: '',
    url: '',
    user: '',
    pass: '',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--headless') result.headless = true;
    if (args[i] === '--date' && args[i + 1]) result.date = args[++i];
    if (args[i] === '--url' && args[i + 1]) result.url = args[++i];
    if (args[i] === '--user' && args[i + 1]) result.user = args[++i];
    if (args[i] === '--pass' && args[i + 1]) result.pass = args[++i];
  }

  if (!result.date) {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    result.date = `${d}/${m}/${y}`;
  }

  return result;
}

async function main() {
  const cliArgs = parseArgs();
  console.log(`\n=============================================================`);
  console.log(`🔍 PLAYWRIGHT LIVE TEST: KIỂM TRA ĐIỀU HƯỚNG & TẢI DSGD CORECCP`);
  console.log(`=============================================================`);
  console.log(`📅 Ngày kiểm tra: ${cliArgs.date}`);

  let creds = null;
  if (cliArgs.url && cliArgs.user && cliArgs.pass) {
    creds = { url: cliArgs.url, username: cliArgs.user, password: cliArgs.pass };
  } else {
    creds = await getCredentialsFromDB();
  }

  if (!creds || !creds.username) {
    console.error(`❌ LỖI: Không tìm thấy thông tin tài khoản CoreCCP! Vui lòng truyền:`);
    console.error(`   node src/scripts/test_inspect_ccp_dsgd.js --url <URL> --user <USER> --pass <PASS>`);
    process.exit(1);
  }

  console.log(`🔗 URL hệ thống: ${creds.url}`);
  console.log(`👤 Tài khoản:    ${creds.username}`);

  const chromePath = getChromeExecutablePath();
  const browser = await chromium.launch({
    headless: cliArgs.headless,
    executablePath: chromePath || undefined,
    slowMo: 300, // Làm chậm 300ms mỗi thao tác để mắt người kịp quan sát
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--start-maximized'],
  });

  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    // ── BƯỚC 1: ĐĂNG NHẬP ────────────────────────────────────────────────────
    console.log(`\n[Bước 1] 🔑 Đang mở trang và đăng nhập...`);
    await page.goto(creds.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const usernameInput = page.locator('input[name="username"], input[id*="user"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[id*="pass"], input[type="password"]').first();
    await usernameInput.fill(creds.username);
    await passwordInput.fill(creds.password);
    await page.keyboard.press('Enter');

    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 25000 });
    console.log(`✅ Đăng nhập thành công!`);
    console.log(`📌 URL hiện tại ngay sau login: ${page.url()}`);

    await page.waitForTimeout(2000);

    // ── BƯỚC 2: THỬ THỬ NGHIỆM ĐIỀU HƯỚNG BẰNG DIRECT URL ───────────────────
    const origin = new URL(page.url()).origin;
    const directUrl = `${origin}/ORDERS/ORDERMATCH_DETAIL`;
    console.log(`\n[Bước 2] 🌐 Thử nghiệm 1: Gõ trực tiếp URL ${directUrl}...`);
    try {
      await page.goto(directUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(2000);
      console.log(`   -> URL sau khi navigate direct: ${page.url()}`);
      if (page.url().includes('ORDERMATCH_DETAIL')) {
        console.log(`   🎉 HỆ THỐNG CHO PHÉP TRUY CẬP TRỰC TIẾP QUA URL!`);
      } else {
        console.log(`   ⚠️ Hệ thống redirect về: ${page.url()} (Không hỗ trợ direct URL)`);
      }
    } catch (err) {
      console.log(`   ❌ Lỗi khi navigate direct URL: ${err.message}`);
    }

    // ── BƯỚC 3: THỬ NGHIỆM ĐIỀU HƯỚNG QUA MENU SIDEBAR ───────────────────────
    console.log(`\n[Bước 3] 📑 Thử nghiệm 2: Điều hướng qua Menu Sidebar...`);

    // Kiểm tra xem mục 'Danh sách giao dịch' đã hiển thị trên DOM chưa
    const dsgdSpan = page.locator("xpath=//span[text()='Danh sách giao dịch']").first();
    let isDsgdVisible = await dsgdSpan.isVisible({ timeout: 1500 }).catch(() => false);

    if (isDsgdVisible) {
      console.log(`   -> Menu 'Danh sách giao dịch' ĐÃ ĐANG HIỂN THỊ SẴN (Lệnh và vị thế đã mở). Không cần click mở cha!`);
    } else {
      console.log(`   -> Menu 'Danh sách giao dịch' CHƯA HIỂN THỊ. Tìm click menu cha 'Lệnh và vị thế'...`);
      const parentMenu = page.locator("xpath=//span[text()='Lệnh và vị thế'] | //div[contains(@class, 'MuiListItemButton-root')][.//span[text()='Lệnh và vị thế']]").first();
      await parentMenu.click({ force: true });
      await page.waitForTimeout(1000);

      isDsgdVisible = await dsgdSpan.isVisible({ timeout: 2000 }).catch(() => false);
      console.log(`   -> Sau khi click cha, 'Danh sách giao dịch' hiển thị: ${isDsgdVisible ? 'CÓ (THÀNH CÔNG)' : 'KHÔNG'}`);
    }

    if (!isDsgdVisible) {
      throw new Error(`Không thể tìm thấy mục 'Danh sách giao dịch' trên Menu sidebar!`);
    }

    // Click vào 'Danh sách giao dịch' (Click vào chính thẻ nút MuiListItemButton bao bọc)
    console.log(`   👉 Đang click vào 'Danh sách giao dịch'...`);
    const dsgdBtn = page.locator("xpath=//div[contains(@class, 'MuiListItemButton-root')][.//span[text()='Danh sách giao dịch']] | //span[text()='Danh sách giao dịch']").first();
    await dsgdBtn.click({ force: true });
    await page.waitForTimeout(2500);

    console.log(`\n[Bước 4] 🔎 Kiểm tra URL và Màn hình sau khi click Menu:`);
    console.log(`   📌 URL hiện tại: ${page.url()}`);

    if (page.url().includes('DASHBOARD') || page.url().endsWith('/')) {
      console.error(`   ❌ FAIL-FAST BẬT CỜ: URL vẫn đang ở Dashboard (${page.url()})! Click menu chưa chuyển trang!`);
    } else {
      console.log(`   ✅ THÀNH CÔNG: Đã rời khỏi Dashboard! URL chuẩn: ${page.url()}`);
    }

    // ── BƯỚC 5: TÌM KIẾM VÀ KẾT XUẤT ─────────────────────────────────────────
    console.log(`\n[Bước 5] 📥 Thử nghiệm điền ngày ${cliArgs.date} và bấm Kết xuất...`);

    // Điền ngày vào input datepicker
    const dateInputs = page.locator('input[type="text"]');
    const inputCount = await dateInputs.count();
    console.log(`   -> Số lượng ô text input tìm thấy trên màn hình: ${inputCount}`);

    if (inputCount >= 2) {
      const idx1 = inputCount >= 3 ? 1 : 0;
      const idx2 = inputCount >= 3 ? 2 : 1;
      console.log(`   -> Đang điền ngày ${cliArgs.date} vào các ô ngày...`);
      await dateInputs.nth(idx1).click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await dateInputs.nth(idx1).pressSequentially(cliArgs.date, { delay: 40 });

      await dateInputs.nth(idx2).click();
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await dateInputs.nth(idx2).pressSequentially(cliArgs.date, { delay: 40 });
    }

    // Bấm Tìm kiếm
    const searchBtn = page.locator('xpath=//button[contains(text(), "Tìm kiếm") or contains(text(), "Tra cứu")]').first();
    if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`   -> Bấm nút 'Tìm kiếm'...`);
      await searchBtn.click().catch(() => { });
      await page.waitForTimeout(2000);
    }

    // Bấm Kết xuất
    const exportBtn = page.locator('xpath=//button[contains(., "Kết xuất") or contains(., "Xuất Excel")]').first();
    if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log(`   -> Bấm nút 'Kết xuất'...`);
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await exportBtn.click().catch(() => { });

      // Nếu có menu popup con "Xuất tất cả"
      const subExport = page.locator('xpath=//li[contains(text(), "Xuất tất cả") or contains(text(), "Tất cả") or contains(text(), "Toàn bộ")]').first();
      if (await subExport.isVisible({ timeout: 1500 }).catch(() => false)) {
        await subExport.click().catch(() => { });
      }

      try {
        const download = await downloadPromise;
        const savePath = path.join(__dirname, 'test_output_DSGD.xlsx');
        await download.saveAs(savePath);
        console.log(`   ✅ Tải thành công file: ${savePath}`);

        // Đọc thử file
        const wb = XLSX.readFile(savePath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n📊 KẾT QUẢ PHÂN TÍCH FILE EXCEL VỪA TẢI VỀ:`);
        console.log(`   - Tên Sheet:    ${wb.SheetNames[0]}`);
        console.log(`   - Tổng số dòng: ${data.length}`);
        if (data.length > 0) {
          console.log(`   - Cột Header:   ${data[0].slice(0, 6).join(' | ')} ...`);
          if (data.length > 1) {
            console.log(`   - Dữ liệu dòng 1: ${data[1].slice(0, 6).join(' | ')} ...`);
            console.log(`   🎉 CHÍNH XÁC LÀ FILE BÁO CÁO CÓ DỮ LIỆU KHỚP LỆNH!`);
          } else {
            console.log(`   ⚠️ File chỉ có dòng header, 0 dòng dữ liệu.`);
          }
        }
      } catch (err) {
        console.log(`   ⚠️ Không bắt được sự kiện tải file: ${err.message}`);
      }
    } else {
      console.log(`   ⚠️ Không tìm thấy nút 'Kết xuất' trên màn hình hiện tại.`);
    }

    console.log(`\n⏳ Giữ trình duyệt thêm 10 giây để bạn quan sát trực tiếp màn hình...`);
    await page.waitForTimeout(10000);

  } catch (err) {
    console.error(`\n❌ LỖI TRONG QUÁ TRÌNH TEST: ${err.message}`);
    console.log(`⏳ Giữ trình duyệt 10 giây trước khi đóng...`);
    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
    console.log(`\n🏁 Kết thúc phiên test.`);
  }
}

main();
