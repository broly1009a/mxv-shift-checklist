/**
 * ==============================================================================
 * SCRIPT ĐIỀU TRA & SNIFF MẠNG: M-SYSTEM BẢNG GIÁ (orderCreating) & GIÁ THANH TOÁN
 * ==============================================================================
 * 
 * Mục tiêu:
 * 1. Bắt trọn vẹn toàn bộ Request/Response HTTP & WebSocket khi vào màn hình Bảng giá.
 * 2. Xác định nút xuất CSV là Client-side Blob hay gọi API Backend.
 * 3. Nếu là API Backend -> Trích xuất URL, Method, Header, Query Param để đưa vào MsApiAdapter.
 * 4. Nếu là Client-side -> Phân tích nguồn cấp dữ liệu (REST API / WebSocket) và quét màn hình
 *    "Giá thanh toán" (QL giá -> Giá thanh toán) để tìm endpoint thay thế chuẩn xác.
 * 
 * Lệnh chạy khuyến nghị (mở trình duyệt để quan sát trực quan):
 *   cd backend
 *   node src/scripts/sniff_ms_ordercreating.js --headed
 * 
 * Chạy ngầm (headless):
 *   cd backend
 *   node src/scripts/sniff_ms_ordercreating.js
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) return '';
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

function getChromeExecutablePath() {
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
  ];
  for (const p of edgePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function runSniffer() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║       M-SYSTEM NETWORK & LOGIC SNIFFER: orderCreating & Giá thanh toán       ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝\n');

  const isHeadless = !process.argv.includes('--headed');
  const keepOpen = process.argv.includes('--keep-open');

  // 1. Lấy thông tin đăng nhập
  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const passArg = process.argv.find((a) => a.startsWith('--pass='));
  const pinArg = process.argv.find((a) => a.startsWith('--pin='));

  let username = userArg ? userArg.split('=')[1].trim() : (process.env.MS_USERNAME || '');
  let password = passArg ? passArg.split('=')[1].trim() : (process.env.MS_PASSWORD || '');
  let pin = pinArg ? pinArg.split('=')[1].trim() : (process.env.MS_PIN || '123456');
  let msBaseDomain = process.env.MS_ADMIN_URL || 'https://msadmin.mxv.com.vn';

  if (!userArg || !passArg) {
    const uri = process.env.MONGODB_URI;
    if (uri) {
      try {
        console.log('1. Đang truy vấn tài khoản M-System từ MongoDB system_settings...');
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
        const db = mongoose.connection.db;
        const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
        if (setting && setting.value) {
          const parsed = JSON.parse(decrypt(setting.value));
          if (!username && parsed.username) username = parsed.username;
          if (!password && parsed.password) password = parsed.password;
          if (!pinArg && parsed.pin) pin = parsed.pin;
          if (parsed.url) msBaseDomain = parsed.url.split('#')[0].replace(/\/$/, '');
          console.log(`   Đã nạp credentials cho user: ${username}`);
        }
      } catch (err) {
        console.log(`   (Không kết nối được MongoDB: ${err.message})`);
      } finally {
        if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
      }
    }
  }

  // Fallback sang tài khoản production (đang online trên màn hình của user) nếu DB dev không có
  if (!username) username = 'mxvsupport';
  if (!password) password = 'M#x!v@202610';
  if (!pin) pin = '123456';

  if (!username || !password) {
    console.error(' Không tìm thấy tài khoản M-System (username/password) để đăng nhập!');
    process.exit(1);
  }

  const outputDir = path.join(__dirname, '..', '..', 'data', 'temp', 'sniff_ms');
  fs.mkdirSync(outputDir, { recursive: true });

  // 2. Khởi tạo Browser
  console.log(`2. Khởi động trình duyệt (Headless: ${isHeadless ? 'BẬT' : 'TẮT'})...`);
  const executablePath = getChromeExecutablePath();
  const launchOptions = {
    headless: isHeadless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  };
  if (executablePath) launchOptions.executablePath = executablePath;

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // 3. Setup Network Sniffer Buffer
  const networkLogs = [];
  const wsLogs = [];
  let isRecordingClickTraffic = false;
  const clickTraffic = [];

  page.on('request', (req) => {
    const entry = {
      timestamp: new Date().toISOString(),
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      postData: req.postData() || null,
      headers: req.headers(),
    };
    networkLogs.push(entry);
    if (isRecordingClickTraffic) {
      clickTraffic.push(entry);
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    // Bắt các response JSON hoặc Excel/CSV
    const contentType = res.headers()['content-type'] || '';
    if (contentType.includes('json') || contentType.includes('spreadsheet') || contentType.includes('csv') || contentType.includes('octet-stream')) {
      const isImportant = url.includes('/market') || url.includes('/order') || url.includes('/price') || url.includes('/excel') || url.includes('/settle') || url.includes('/contract');
      if (isImportant) {
        console.log(`   [API Response] ${res.status()} ${res.request().method()} ${url} (${contentType})`);
      }
    }
  });

  page.on('websocket', (ws) => {
    const wsUrl = ws.url();
    console.log(`   [WebSocket Connected] ${wsUrl}`);
    wsLogs.push({ url: wsUrl, event: 'open', timestamp: new Date().toISOString() });

    ws.on('framesent', (frame) => {
      wsLogs.push({ url: wsUrl, type: 'sent', payload: frame.payload?.slice(0, 300) });
    });
    ws.on('framereceived', (frame) => {
      wsLogs.push({ url: wsUrl, type: 'received', payload: frame.payload?.slice(0, 300) });
    });
  });

  try {
    // 4. Đăng nhập 2 bước
    console.log(`\n3. Đang điều hướng đến M-System: ${msBaseDomain}...`);
    await page.goto(msBaseDomain, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1000);

    console.log('4. Nhập tài khoản & mật khẩu...');
    await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập']", { state: 'visible', timeout: 15000 });
    await page.fill("input[name='username'], input[placeholder*='tên đăng nhập']", username);
    await page.fill("input[name='password'], input[placeholder*='mật khẩu']", password);
    await page.waitForTimeout(500);

    await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await page.waitForTimeout(2000);

    // Kiểm tra popup cảnh báo đăng nhập đè phiên nếu có
    const conflictBtn = page.locator("button:has-text('Tiếp tục'), button:has-text('Đồng ý'), button:has-text('Xác nhận')");
    if (await conflictBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log('   [Action] Phát hiện popup cảnh báo phiên -> Bấm xác nhận...');
      await conflictBtn.first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    // Nhập PIN
    const pinPad = page.locator('div.pincode');
    const hasPinPad = await pinPad.isVisible({ timeout: 4000 }).catch(() => false);
    if (hasPinPad && pin) {
      console.log('5. Nhập mã PIN...');
      for (const digit of String(pin).split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(2000);
    }

    // Kiểm tra popup xác nhận sau khi nhập PIN nếu có
    if (await conflictBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
      console.log('   [Action] Phát hiện popup sau PIN -> Bấm xác nhận...');
      await conflictBtn.first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }

    console.log(` Đăng nhập M-System thành công! URL hiện tại: ${page.url()}\n`);

    // 5. Điều hướng đến màn hình Bảng giá: #/orderManagement/orderCreating
    const targetUrl = `${msBaseDomain}/#/orderManagement/orderCreating`;
    console.log(`================================================================================`);
    console.log(`BƯỚC 1: ĐIỀU TRA MÀN HÌNH BẢNG GIÁ (${targetUrl})`);
    console.log(`================================================================================`);
    
    // Ghi lại mốc bắt đầu vào trang
    const reqIndexBeforeNav = networkLogs.length;
    await page.goto(targetUrl);
    await page.waitForTimeout(4000);

    // Chụp ảnh màn hình kiểm chứng
    const ss1 = path.join(outputDir, '01_order_creating_page.png');
    await page.screenshot({ path: ss1 });
    console.log(`-> Đã chụp ảnh màn hình lưu tại: ${ss1}`);

    // Phân tích các API gọi lúc load trang
    const pageLoadApis = networkLogs.slice(reqIndexBeforeNav).filter(r => r.resourceType === 'fetch' || r.resourceType === 'xhr');
    console.log(`\n-> Tổng số API Fetch/XHR được gọi khi mở trang Bảng giá: ${pageLoadApis.length}`);
    pageLoadApis.forEach((req, idx) => {
      console.log(`   [API ${idx + 1}] ${req.method} ${req.url}`);
    });

    // 6. Kiểm tra cấu trúc DOM Bảng giá
    const tableInfo = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.nav-tabs li, .nav-item, ul.tabs li')).map(el => el.textContent.trim());
      const table = document.querySelector('table');
      const headers = table ? Array.from(table.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim()) : [];
      const rows = table ? Array.from(table.querySelectorAll('tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim());
      }) : [];
      
      // Tìm icon CSV
      const csvIcons = Array.from(document.querySelectorAll('i.fa-file-csv, i.fa-file-excel, div.edit-icon i')).map(el => {
        return {
          tagName: el.tagName,
          className: el.className,
          parentElementTag: el.parentElement ? el.parentElement.tagName : null,
          parentElementClass: el.parentElement ? el.parentElement.className : null,
          outerHtml: el.outerHTML,
        };
      });

      // Tìm menu "Giá thanh toán" trong sidebar
      const allLinks = Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.textContent.trim(),
        href: a.getAttribute('href'),
      })).filter(l => l.text.toLowerCase().includes('giá thanh toán') || l.text.toLowerCase().includes('ql giá'));

      return { tabs, headers, rowCount: rows.length, sampleRows: rows.slice(0, 3), csvIcons, allLinks };
    });

    console.log('\n--- KẾT QUẢ PHÂN TÍCH DOM BẢNG GIÁ ---');
    console.log(`- Tabs hiện có          : ${JSON.stringify(tableInfo.tabs)}`);
    console.log(`- Cột hiển thị          : ${JSON.stringify(tableInfo.headers)}`);
    console.log(`- Số dòng dữ liệu       : ${tableInfo.rowCount} dòng`);
    if (tableInfo.sampleRows.length > 0) {
      console.log(`- Mẫu dòng 1            : ${JSON.stringify(tableInfo.sampleRows[0])}`);
    }
    console.log(`- Icon CSV phát hiện    : ${tableInfo.csvIcons.length} icon`);
    tableInfo.csvIcons.forEach(ic => console.log(`  + ${ic.outerHtml} (Parent: ${ic.parentElementTag}.${ic.parentElementClass})`));

    console.log(`\n- Links liên quan Giá TT trong Menu:`, tableInfo.allLinks);

    // 7. Bấm nút CSV và xác định cơ chế Tải file
    console.log(`\n================================================================================`);
    console.log(`BƯỚC 2: BẤM NÚT XUẤT CSV VÀ PHÂN TÍCH LUỒNG TẢI (Blob vs REST API)`);
    console.log(`================================================================================`);

    const csvBtnLocator = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]").first();
    const isCsvBtnVisible = await csvBtnLocator.isVisible({ timeout: 3000 }).catch(() => false);

    let downloadResult = null;
    if (!isCsvBtnVisible) {
      console.log('⚠️ Không thấy icon CSV trực tiếp, thử bấm nút "+" tab...');
      await page.click("xpath=//i[contains(@class, 'fas fa-plus') or contains(@class, 'fa-plus')]").catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Bắt đầu ghi vết traffic bấm nút
    isRecordingClickTraffic = true;
    clickTraffic.length = 0;

    try {
      console.log('-> Đang kích hoạt click vào nút CSV...');
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.click("xpath=//i[contains(@class, 'fa-file-csv')]"),
      ]);

      const downloadUrl = download.url();
      const suggestedFilename = download.suggestedFilename();
      const savedPath = path.join(outputDir, suggestedFilename);
      await download.saveAs(savedPath);

      const isBlob = downloadUrl.startsWith('blob:');
      const isDataUri = downloadUrl.startsWith('data:');
      const isHttp = downloadUrl.startsWith('http');

      downloadResult = {
        success: true,
        downloadUrl,
        suggestedFilename,
        isBlob,
        isDataUri,
        isHttp,
        fileSizeBytes: fs.statSync(savedPath).size,
        savedPath,
      };

      console.log('\n KẾT QUẢ BẮT SỰ KIỆN DOWNLOAD THÀNH CÔNG:');
      console.log(`  • URL Download      : ${downloadUrl}`);
      console.log(`  • Tên file gợi ý    : ${suggestedFilename}`);
      console.log(`  • Kích thước file   : ${downloadResult.fileSizeBytes} bytes`);
      console.log(`  • Loại kết xuất     : ${isBlob ? '🔴 CLIENT-SIDE JAVASCRIPT BLOB (Không có API Backend trực tiếp sinh file)' : isHttp ? '🟢 SERVER-SIDE REST API (Có URL Backend!)' : 'DATA URI'}`);

      // Đọc 5 dòng đầu của file tải về
      const fileText = fs.readFileSync(savedPath, 'utf8');
      const firstLines = fileText.split('\n').slice(0, 5);
      console.log('  • 5 dòng đầu file tải về:');
      firstLines.forEach((l, idx) => console.log(`     [${idx + 1}] ${l.trim()}`));

    } catch (clickErr) {
      console.error(' Lỗi khi bấm nút tải CSV:', clickErr.message);
      downloadResult = { success: false, error: clickErr.message };
    } finally {
      isRecordingClickTraffic = false;
    }

    console.log(`\n-> Các Request phát sinh TRONG KHI CLICK nút CSV: ${clickTraffic.length} request`);
    clickTraffic.forEach(ct => {
      console.log(`   ${ct.method} ${ct.url}`);
    });

    // 8. BƯỚC 3: ĐIỀU TRA MÀN HÌNH "GIÁ THANH TOÁN" (QL GIÁ -> GIÁ THANH TOÁN)
    console.log(`\n================================================================================`);
    console.log(`BƯỚC 3: ĐIỀU TRA MÀN HÌNH CHUẨN "GIÁ THANH TOÁN" TRONG MENU (QL GIÁ)`);
    console.log(`================================================================================`);

    // Tìm link của Giá thanh toán
    let settlementUrl = null;
    const gttLink = tableInfo.allLinks.find(l => l.text.toLowerCase().includes('giá thanh toán'));
    if (gttLink && gttLink.href) {
      settlementUrl = gttLink.href.startsWith('#') ? `${msBaseDomain}/${gttLink.href}` : gttLink.href;
      console.log(`-> Tìm thấy URL từ menu: ${settlementUrl}`);
    } else {
      // Thử click vào menu "QL giá" trên giao diện
      console.log('-> Thử mở accordion "QL giá" trên giao diện...');
      const qlGiaMenu = page.locator("xpath=//*[self::a or self::span or self::div][contains(text(), 'QL giá')]").first();
      if (await qlGiaMenu.isVisible().catch(() => false)) {
        await qlGiaMenu.click();
        await page.waitForTimeout(1000);
        const gttSubMenu = page.locator("xpath=//*[self::a or self::span][contains(text(), 'Giá thanh toán')]").first();
        if (await gttSubMenu.isVisible().catch(() => false)) {
          const href = await gttSubMenu.getAttribute('href').catch(() => null);
          console.log(`-> Tìm thấy submenu "Giá thanh toán", href="${href}"`);
          await gttSubMenu.click();
          await page.waitForTimeout(3000);
          settlementUrl = page.url();
        }
      }
    }

    let settlementScreenResult = null;
    if (settlementUrl) {
      console.log(`-> Đang điều hướng đến màn hình Giá thanh toán: ${settlementUrl}...`);
      const gttReqIdx = networkLogs.length;
      await page.goto(settlementUrl);
      await page.waitForTimeout(4000);

      const ss2 = path.join(outputDir, '02_settlement_price_page.png');
      await page.screenshot({ path: ss2 });
      console.log(`-> Đã chụp ảnh màn hình Giá thanh toán lưu tại: ${ss2}`);

      const gttApis = networkLogs.slice(gttReqIdx).filter(r => r.resourceType === 'fetch' || r.resourceType === 'xhr');
      console.log(`-> Các API được gọi tại màn hình Giá thanh toán: ${gttApis.length} API`);
      gttApis.forEach((r, idx) => {
        console.log(`   [GTT API ${idx + 1}] ${r.method} ${r.url}`);
      });

      // Kiểm tra nút xuất file trên màn hình Giá thanh toán
      const gttDom = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, a')).map(b => ({
          text: b.textContent.trim(),
          className: b.className,
          title: b.getAttribute('title') || '',
        })).filter(b => b.text.toLowerCase().includes('xuất') || b.text.toLowerCase().includes('excel') || b.text.toLowerCase().includes('csv') || b.className.includes('fa-file'));

        const table = document.querySelector('table');
        const headers = table ? Array.from(table.querySelectorAll('thead th, thead td')).map(th => th.textContent.trim()) : [];
        const rows = table ? table.querySelectorAll('tbody tr').length : 0;

        return { buttons, headers, rowCount: rows };
      });

      console.log('- Nút xuất file trên màn hình Giá thanh toán:', gttDom.buttons);
      console.log('- Cột bảng Giá thanh toán:', gttDom.headers);
      console.log(`- Số dòng dữ liệu Giá thanh toán: ${gttDom.rowCount}`);

      settlementScreenResult = {
        url: settlementUrl,
        apis: gttApis.map(a => ({ method: a.method, url: a.url })),
        dom: gttDom,
      };
    }

    // 9. TỔNG HỢP VÀ XUẤT BÁO CÁO JSON
    const fullReport = {
      timestamp: new Date().toISOString(),
      orderCreating: {
        url: targetUrl,
        tableInfo,
        downloadResult,
        clickTraffic,
        pageLoadApis: pageLoadApis.map(a => ({ method: a.method, url: a.url })),
      },
      settlementScreen: settlementScreenResult,
      webSocketLogs: wsLogs.slice(0, 20),
    };

    const reportPath = path.join(outputDir, 'sniff_ms_ordercreating_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(fullReport, null, 2), 'utf8');

    console.log(`\n================================================================================`);
    console.log(`TỔNG KẾT KẾT QUẢ ĐIỀU TRA:`);
    console.log(`================================================================================`);
    console.log(`1. Nút CSV tại orderCreating: ${downloadResult?.isBlob ? 'LÀ CLIENT BLOB (Không có API tải sẵn file)' : 'LÀ REST API'}`);
    console.log(`2. Báo cáo chi tiết đã lưu tại: ${reportPath}`);
    console.log(`================================================================================\n`);

  } catch (err) {
    console.error(' Lỗi trong quá trình điều tra:', err);
  } finally {
    if (!keepOpen) {
      await browser.close();
      console.log(' Đã đóng trình duyệt.');
    } else {
      console.log('ℹ️ Giữ trình duyệt theo cờ --keep-open. Bạn có thể tự thao tác.');
    }
  }
}

runSniffer().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
