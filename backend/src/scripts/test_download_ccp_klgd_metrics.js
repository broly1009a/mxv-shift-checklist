/**
 * ============================================================================
 * TEST SCRIPT: TẢI RIÊNG 3 BÁO CÁO CORECCP (DSGD, TTM, TTTT) & BÓC TÁCH SỐ LIỆU
 * ============================================================================
 * 
 * Mục đích:
 * 1. Đăng nhập CoreCCP và chỉ tải ĐÚNG 3 BÁO CÁO phục vụ đối soát KLGD trong phiên:
 *    [1] DSGD : Lịch sử giao dịch -> Tính tổng Khối lượng khớp (KLGD)
 *    [2] TTM  : Trạng thái mở (/ORDERS/OPEN_POSITION) -> Tính tổng Vị thế mở (TTM)
 *    [3] TTTT : Trạng thái tất toán -> Tính tổng Khối lượng tất toán (TTTT)
 * 2. Độc lập hoàn toàn với M-System, CQG và ACM.
 * 3. Bóc tách file Excel và in bảng tổng kết số lot ngay trên màn hình Console.
 * 
 * Cách chạy:
 *   # 1. Chạy có giao diện trực quan (Mặc định hôm nay):
 *   node src/scripts/test_download_ccp_klgd_metrics.js --headed
 * 
 *   # 2. Chạy cho một ngày giao dịch cụ thể:
 *   node src/scripts/test_download_ccp_klgd_metrics.js --headed --date 14/09/2026
 * 
 *   # 3. Chạy chế độ ngầm (headless):
 *   node src/scripts/test_download_ccp_klgd_metrics.js
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { chromium } = require('playwright-core');
const XLSX = require('xlsx');

const TARGET_REPORTS = [
  {
    code: 'DSGD',
    name: 'Lịch sử giao dịch (Khớp lệnh)',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Lịch sử giao dịch',
    cachedUrl: '',
    fileNamePrefix: 'DSGD',
  },
  {
    code: 'TTM',
    name: 'Trạng thái mở (Open Position)',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái mở',
    cachedUrl: '/ORDERS/OPEN_POSITION',
    fileNamePrefix: 'TTM',
  },
  {
    code: 'TTTT',
    name: 'Trạng thái tất toán (Settled)',
    parentMenu: 'Lệnh và vị thế',
    childMenu: 'Trạng thái tất toán',
    tabName: 'Lịch sử tất toán',
    cachedUrl: '',
    fileNamePrefix: 'TTTT',
  },
];

function getChromeExecutablePath() {
  if (process.platform === 'win32') {
    const candidates = [
      path.join(process.cwd(), '..', 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      path.join(process.cwd(), 'it-tool-src', 'operate-transaction-app', 'Chrome', 'chrome-win', 'chrome.exe'),
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
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
    console.log(`📡 Đang kết nối CSDL để đọc tài khoản CoreCCP...`);
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 3000 });
    const SystemSetting = mongoose.connection.collection('system_settings');
    const setting = await SystemSetting.findOne({ key: 'bot_credentials_ccp' });
    await mongoose.disconnect();

    if (!setting || !setting.value) return null;
    const decrypted = decryptAES256(setting.value);
    return JSON.parse(decrypted);
  } catch (err) {
    console.warn(` Không thể kết nối MongoDB: ${err.message}.`);
    return null;
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    headless: true,
    date: '',
    url: '',
    user: '',
    pass: '',
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--headed') result.headless = false;
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

// ─── PARSER HELPER CHO EXCEL ────────────────────────────────────────────────
function parseCcpNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseDSGD(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'export') || wb.SheetNames[0]];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return 0;

  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const klIdx = header.findIndex(h => h.includes('kl khớp') || h.includes('matched vol') || h.includes('kl khop'));
  if (klIdx === -1) return 0;

  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    total += parseCcpNumber(rows[i]?.[klIdx]);
  }
  return total;
}

function parseTTM(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'export') || wb.SheetNames[0]];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return 0;

  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const muaIdx = header.findIndex(h => h.includes('khối lượng mua') || h.includes('kl mua'));
  const banIdx = header.findIndex(h => h.includes('khối lượng bán') || h.includes('kl bán'));

  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    const mua = muaIdx !== -1 ? parseCcpNumber(rows[i]?.[muaIdx]) : 0;
    const ban = banIdx !== -1 ? parseCcpNumber(rows[i]?.[banIdx]) : 0;
    total += (mua + ban);
  }
  return total;
}

function parseTTTT(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === 'export') || wb.SheetNames[0]];
  if (!sheet) return 0;
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (rows.length < 2) return 0;

  const header = rows[0].map(h => String(h || '').trim().toLowerCase());
  const banIdx = header.findIndex(h => h.includes('khối lượng bán') || h.includes('kl bán'));
  if (banIdx === -1) return 0;

  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    total += parseCcpNumber(rows[i]?.[banIdx]);
  }
  return total;
}

// ─── MAIN EXECUTION ─────────────────────────────────────────────────────────
async function main() {
  const cliArgs = parseArgs();

  console.log(`\n======================================================================`);
  console.log(` TEST TẢI & BÓC TÁCH RIÊNG 3 BÁO CÁO CORECCP (CHECK_KLGD)`);
  console.log(`======================================================================`);
  console.log(`• Ngày giao dịch: ${cliArgs.date}`);
  console.log(`• Giao diện trực quan: ${cliArgs.headless ? 'TẮT (Headless)' : 'BẬT (--headed)'}`);

  let creds = null;
  if (cliArgs.url && cliArgs.user && cliArgs.pass) {
    creds = { url: cliArgs.url, username: cliArgs.user, password: cliArgs.pass };
  } else {
    creds = await getCredentialsFromDB();
  }

  if (!creds || !creds.username) {
    console.error(` Chưa có thông tin tài khoản CoreCCP. Vui lòng truyền --user và --pass hoặc cấu hình trong DB.`);
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), 'downloads_ccp_klgd');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const cleanDate = cliArgs.date.replace(/\//g, '.');
  const dsgdPath = path.join(outputDir, `DSGD_${cleanDate}.xlsx`);
  const ttmPath = path.join(outputDir, `TTM_${cleanDate}.xlsx`);
  const ttttPath = path.join(outputDir, `TTTT_${cleanDate}.xlsx`);

  const chromePath = getChromeExecutablePath();
  const launchOptions = {
    headless: cliArgs.headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };
  if (chromePath) launchOptions.executablePath = chromePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  try {
    console.log(`\n[1/4] 🔑 Đang đăng nhập VNCLEAR CoreCCP (${creds.url})...`);
    await page.goto(creds.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const usernameInput = page.locator('input[name="username"], input[id*="user"], input[type="text"]').first();
    const passwordInput = page.locator('input[name="password"], input[id*="pass"], input[type="password"]').first();
    await usernameInput.fill(creds.username);
    await passwordInput.fill(creds.password);
    await page.keyboard.press('Enter');

    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 20000 });
    console.log(` Đăng nhập CoreCCP thành công!`);

    for (let i = 0; i < TARGET_REPORTS.length; i++) {
      const rep = TARGET_REPORTS[i];
      console.log(`\n[${i + 2}/4] 📑 Đang tải báo cáo: [${rep.code}] ${rep.name}...`);

      const origin = new URL(page.url()).origin;
      if (rep.cachedUrl) {
        await page.goto(`${origin}${rep.cachedUrl}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      } else {
        const parentBtn = page.locator(`xpath=//li[contains(@class, 'MuiListItem')]//span[contains(text(), '${rep.parentMenu}')]`).first();
        if (await parentBtn.isVisible().catch(() => false)) await parentBtn.click().catch(() => { });
        await page.waitForTimeout(500);

        const childBtn = page.locator(`xpath=//div[contains(@class, 'MuiCollapse-root')]//span[contains(text(), '${rep.childMenu}')]`).first();
        if (await childBtn.isVisible().catch(() => false)) await childBtn.click().catch(() => { });
      }

      await page.waitForTimeout(1000);
      if (rep.tabName) {
        const tabBtn = page.locator(`xpath=//button[contains(@class, 'MuiTab-root') and contains(text(), '${rep.tabName}')]`).first();
        if (await tabBtn.isVisible().catch(() => false)) await tabBtn.click().catch(() => { });
      }

      // Điền khoảng ngày
      const dateInputs = page.locator('input[type="text"]');
      const count = await dateInputs.count();
      if (count >= 2) {
        const idx1 = count >= 3 ? 1 : 0;
        const idx2 = count >= 3 ? 2 : 1;
        await dateInputs.nth(idx1).click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await page.keyboard.press('Backspace');
        await dateInputs.nth(idx1).pressSequentially(cliArgs.date, { delay: 40 });

        await dateInputs.nth(idx2).click();
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await page.keyboard.press('Backspace');
        await dateInputs.nth(idx2).pressSequentially(cliArgs.date, { delay: 40 });
      }

      // Bấm Tìm kiếm
      const searchBtn = page.locator('xpath=//button[contains(text(), "Tìm kiếm") or contains(text(), "Tra cứu")]').first();
      if (await searchBtn.isVisible().catch(() => false)) await searchBtn.click().catch(() => { });
      await page.waitForTimeout(1500);

      // Kiểm tra bảng trống
      const emptyIndicator = page.locator('xpath=//*[contains(text(), "Không có dữ liệu") or contains(text(), "0-0 trên 0")]').first();
      const isEmpty = await emptyIndicator.isVisible().catch(() => false);

      // Bấm Kết xuất -> Xuất tất cả
      const exportBtn = page.locator('xpath=//button[contains(., "Kết xuất") or contains(., "Xuất Excel")]').first();
      if (await exportBtn.isVisible().catch(() => false)) {
        let dest = dsgdPath;
        if (rep.code === 'TTM') dest = ttmPath;
        if (rep.code === 'TTTT') dest = ttttPath;

        try {
          await exportBtn.hover();
          await page.waitForTimeout(300);

          const exportAll = page.locator('xpath=//li[contains(., "Xuất tất cả")] | //span[contains(., "Xuất tất cả")]').first();
          const downloadPromise = page.waitForEvent('download', { timeout: isEmpty ? 6000 : 25000 });

          if (await exportAll.isVisible({ timeout: 1500 }).catch(() => false)) {
            await exportAll.click({ force: true });
          } else {
            await exportBtn.dblclick();
          }

          const dl = await downloadPromise;
          await dl.saveAs(dest);
          console.log(`    Tải thành công [${rep.code}] -> ${path.basename(dest)}`);
        } catch (dlErr) {
          console.log(`    Báo cáo [${rep.code}] bảng rỗng hoặc không có dữ liệu để xuất.`);
        }
      }
    }
  } catch (err) {
    console.error(` Lỗi trong phiên duyệt web: ${err.message}`);
  } finally {
    await context.close();
    await browser.close();
  }

  // ─── BÓC TÁCH KẾT QUẢ VÀ HIỂN THỊ ──────────────────────────────────────────
  const klgdVal = parseDSGD(dsgdPath);
  const ttmVal = parseTTM(ttmPath);
  const ttttVal = parseTTTT(ttttPath);

  console.log(`\n======================================================================`);
  console.log(`📊 BẢNG TỔNG KẾT ĐỐI SOÁT CORECCP (CHECK_KLGD) - NGÀY ${cliArgs.date}`);
  console.log(`======================================================================`);
  console.log(` 1. KLGD (Khối lượng khớp lệnh - DSGD)    : ${klgdVal.toLocaleString('vi-VN')} lot`);
  console.log(` 2. TTM  (Trạng thái mở - Open Position)   : ${ttmVal.toLocaleString('vi-VN')} lot`);
  console.log(` 3. TTTT (Tất toán vị thế - Settled)       : ${ttttVal.toLocaleString('vi-VN')} lot`);
  console.log(`======================================================================`);
  console.log(`📁 File lưu tại thư mục: ${outputDir}\n`);
}

main().catch(console.error);
