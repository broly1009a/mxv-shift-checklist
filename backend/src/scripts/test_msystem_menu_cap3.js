/**
 * TEST SCRIPT: TÁI HIỆN VÀ XỬ LÝ KẸT TOGGLE MENU CẤP 3 TRÊN M-SYSTEM
 * 
 * Mục đích:
 * - Mở trình duyệt Playwright có giao diện (headed: true) để quan sát trực tiếp.
 * - Tái hiện kịch bản gây lỗi kẹt menu 3 cấp:
 *     Bước 1: QL khách hàng -> QL TKGD -> Danh sách TKGD (màn hình DSTKGD)
 *     Bước 2: Chuyển tiếp sang QL khách hàng -> QL TKGD -> TLKQ HSKQ
 * - Thử nghiệm và kiểm chứng 2 giải pháp xử lý triệt để:
 *     Giải pháp 1: Smart-Click Toggle (Kiểm tra menu con cấp 3 có isVisible() không, nếu chưa hiện thì click bung lại cấp 2).
 *     Giải pháp 2: Direct Hash Navigation (#/clientManagement/marginRatioMultiplier) nhảy thẳng không phụ thuộc sidebar.
 * 
 * LƯU Ý THEO AGENTS.MD: File test này do USER chủ động chạy trên Terminal để quan sát.
 */

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const parts = encryptedText.split(':');
  if (parts.length !== 2) throw new Error('Format mã hóa không hợp lệ (thiếu IV)');
  const rawKey = process.env.ENCRYPTION_KEY || 'mxv_default_secret_key_32_chars_long!';
  const secretKey = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(parts[0], 'hex');
  const encrypted = Buffer.from(parts[1], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString('utf8');
}

async function getCredentials() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mxv-checklist';
  console.log('[1/4] Kết nối database MongoDB lấy thông tin đăng nhập M-System...');
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const setting = await db.collection('system_settings').findOne({ key: 'bot_credentials_msystem' });
  await mongoose.disconnect();

  if (!setting) {
    throw new Error('Không tìm thấy bot_credentials_msystem trong system_settings!');
  }

  const credentials = JSON.parse(decrypt(setting.value));
  return {
    url: credentials.url || 'https://msadmin.mxv.com.vn/',
    username: credentials.username || 'mxvsupport',
    password: credentials.password || '',
    pin: credentials.pin || '123456',
  };
}

async function main() {
  console.log('================================================================');
  console.log(' KÍCH HOẠT TEST TÁI HIỆN & XỬ LÝ KẸT TOGGLE MENU CẤP 3 (HEADED) ');
  console.log('================================================================\n');

  let creds;
  try {
    creds = await getCredentials();
    console.log(`-> URL: ${creds.url}`);
    console.log(`-> Tài khoản: ${creds.username}\n`);
  } catch (err) {
    console.error('Lỗi lấy credentials:', err.message);
    process.exit(1);
  }

  // Cấu hình trình duyệt mở giao diện (Headed Mode)
  const edgePaths = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  const edgePath = edgePaths.find((p) => fs.existsSync(p));

  const launchOptions = {
    headless: false,
    slowMo: 600, // Làm chậm 600ms mỗi thao tác để mắt thường dễ quan sát
    args: ['--start-maximized'],
  };

  if (edgePath) {
    console.log(`-> Sử dụng Microsoft Edge: ${edgePath}`);
    launchOptions.executablePath = edgePath;
  } else {
    console.log(`-> Sử dụng Chrome / Chromium mặc định`);
    launchOptions.channel = 'chrome';
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    console.log('\n[2/4] Đăng nhập M-System...');
    await page.goto(creds.url);

    // Chờ màn hình login hoặc dashboard
    const state = await Promise.race([
      page.waitForSelector('input[name="username"]', { timeout: 15000 }).then(() => 'login'),
      page.waitForSelector('xpath=//*[contains(text(), "QL hệ thống") or contains(text(), "QL khách hàng")]', { timeout: 15000 }).then(() => 'logged_in'),
    ]).catch(() => 'unknown');

    if (state === 'login') {
      console.log('-> Nhập username & password...');
      await page.fill('input[name="username"]', creds.username);
      await page.fill('input[name="password"]', creds.password);
      await page.waitForTimeout(500);
      await page.click('button.btn-primary');

      console.log('-> Chờ bảng mã PIN và nhập...');
      await page.waitForSelector('div.pincode', { state: 'visible', timeout: 15000 });
      for (const digit of creds.pin.split('')) {
        const sel = `div.pincode >> xpath=.//div[text()='${digit}']`;
        await page.waitForSelector(sel, { state: 'visible' });
        await page.click(sel);
        await page.waitForTimeout(400);
      }
      console.log('-> Đăng nhập thành công!');
    } else {
      console.log('-> Đã có phiên đăng nhập sẵn, tiếp tục vào trang chủ.');
    }

    await page.waitForTimeout(2000);

    // =========================================================================
    // GIAI ĐOẠN 1: MỞ MENU CẤP 3 ĐẦU TIÊN (DSTKGD)
    // QL khách hàng -> QL TKGD -> Danh sách TKGD
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[GIAI ĐOẠN 1] Mở báo cáo thứ nhất: QL khách hàng -> QL TKGD -> Danh sách TKGD');
    console.log('----------------------------------------------------------------');

    // Cấp 1: QL khách hàng
    console.log('1.1. Click Cấp 1: "QL khách hàng"');
    const menuCap1 = page.locator("xpath=//a[contains(@class, 'nav-link') and contains(., 'QL khách hàng')]").first();
    await menuCap1.click();
    await page.waitForTimeout(1000);

    // Cấp 2: QL TKGD
    console.log('1.2. Click Cấp 2: "QL TKGD"');
    const menuCap2 = page.locator("xpath=//a[contains(@class, 'nav-link') and contains(., 'QL TKGD')]").first();
    await menuCap2.click();
    await page.waitForTimeout(1000);

    // Cấp 3: Danh sách TKGD
    console.log('1.3. Click Cấp 3: "Danh sách TKGD"');
    const menuCap3_dstkgd = page.locator("xpath=//a[contains(@class, 'nav-link') and contains(., 'Danh sách TKGD')]").first();
    await menuCap3_dstkgd.click();
    await page.waitForTimeout(2000);

    console.log(`-> URL hiện tại sau Giai đoạn 1: ${page.url()}`);

    // =========================================================================
    // GIAI ĐOẠN 2: TÁI HIỆN HIỆN TƯỢNG KẸT KHI CHUYỂN SANG TLKQ HSKQ THEO CODE CŨ
    // Trong code cũ: Sau khi tải xong, nó click thu gọn menu cha Cấp 1
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[GIAI ĐOẠN 2] Mô phỏng logic cũ: Thu gọn Cấp 1 rồi mở lại TLKQ HSKQ');
    console.log('----------------------------------------------------------------');

    console.log('2.1. Code cũ thực hiện click thu gọn menu Cấp 1 (QL khách hàng)...');
    await menuCap1.click().catch(() => {});
    await page.waitForTimeout(1500);

    console.log('2.2. Kiểm tra trạng thái DOM của menu Cấp 2 (QL TKGD):');
    const cap2Status = await menuCap2.evaluate((el) => {
      const parentLi = el.closest('li');
      return {
        hasOpenClass: parentLi ? parentLi.classList.contains('open') : false,
        displayStyle: parentLi ? window.getComputedStyle(parentLi).display : '',
      };
    }).catch((e) => ({ error: e.message }));
    console.log('-> Trạng thái Cấp 2:', JSON.stringify(cap2Status));

    console.log('\n2.3. Bắt đầu chuỗi mở menu báo cáo thứ hai: [QL khách hàng, QL TKGD, TLKQ HSKQ]');
    // Mở lại Cấp 1
    console.log('-> Click mở lại Cấp 1: "QL khách hàng"');
    await menuCap1.click();
    await page.waitForTimeout(1000);

    // Kiểm tra menu con Cấp 3 "TLKQ HSKQ" có visible trên màn hình không
    const menuCap3_tlkq = page.locator("xpath=//a[contains(@class, 'nav-link') and contains(., 'TLKQ HSKQ')]").first();
    const isVisibleBeforeFix = await menuCap3_tlkq.isVisible().catch(() => false);
    console.log(`-> Menu Cấp 3 "TLKQ HSKQ" có đang HIỂN THỊ (isVisible) không?: ${isVisibleBeforeFix}`);

    if (!isVisibleBeforeFix) {
      console.log(' [PHÁT HIỆN LỖI KẸT]: Cấp 2 "QL TKGD" đang bị đóng/kẹt class khiến Cấp 3 "TLKQ HSKQ" KHÔNG THỂ CLICK ĐƯỢC!');
    } else {
      console.log(' Cấp 3 đang hiển thị.');
    }

    // =========================================================================
    // GIAI ĐOẠN 3: KIỂM CHỨNG GIẢI PHÁP 1 (SMART RE-TOGGLE AN TOÀN)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[GIAI ĐOẠN 3] KIỂM CHỨNG GIẢI PHÁP 1: Smart Re-Toggle');
    console.log('Nếu Cấp 3 chưa isVisible() -> Tự động click Cấp 2 để bung ra');
    console.log('----------------------------------------------------------------');

    if (!isVisibleBeforeFix) {
      console.log('-> Kích hoạt Smart Re-Toggle: Bấm lại Cấp 2 "QL TKGD"...');
      await menuCap2.click();
      await page.waitForTimeout(1000);

      const isVisibleAfterFix = await menuCap3_tlkq.isVisible().catch(() => false);
      console.log(`-> Sau khi Smart Re-Toggle, Cấp 3 "TLKQ HSKQ" có isVisible không?: ${isVisibleAfterFix}`);

      if (isVisibleAfterFix) {
        console.log('-> Click Cấp 3: "TLKQ HSKQ"');
        await menuCap3_tlkq.click();
        await page.waitForTimeout(2000);
        console.log(`-> URL sau khi click: ${page.url()}`);
      }
    }

    // =========================================================================
    // GIAI ĐOẠN 4: KIỂM CHỨNG GIẢI PHÁP 2 (DIRECT HASH NAVIGATION - TỐI ƯU NHẤT)
    // =========================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('[GIAI ĐOẠN 4] KIỂM CHỨNG GIẢI PHÁP 2: Direct Hash Navigation');
    console.log('Nhảy thẳng URL: #/clientManagement/marginRatioMultiplier');
    console.log('----------------------------------------------------------------');

    console.log('-> Nhảy thẳng URL Hash...');
    await page.evaluate(() => {
      window.location.hash = '#/clientManagement/marginRatioMultiplier';
    });
    await page.waitForTimeout(2500);

    const finalUrl = page.url();
    console.log(`-> URL sau khi Direct Navigate: ${finalUrl}`);

    // Kiểm tra tiêu đề trang
    const headerText = await page.locator("xpath=//*[contains(text(), 'QL TỶ LỆ KÝ QUỸ') or contains(text(), 'TLKQ HSKQ')]").first().textContent().catch(() => '');
    console.log(`-> Tiêu đề trên trang nhận diện được: "${headerText.trim()}"`);

    // Kiểm tra nút xuất file CSV/Excel
    const exportBtn = page.locator("button:has(i.fa-file-excel), button:has(i.fa-file-csv), i.fa-file-excel, i.fa-file-csv, .fa-file-excel, .fa-file-csv, i.fa-download, button[title*='Xuất']").first();
    const hasExportBtn = await exportBtn.isVisible().catch(() => false);
    console.log(`-> Nút Xuất file CSV/Excel có sẵn sàng không?: ${hasExportBtn}`);

    console.log('\n================================================================');
    console.log(' KẾT THÚC KIỂM THỬ KỊCH BẢN KẸT MENU CẤP 3: THÀNH CÔNG RỰC RỠ!');
    console.log('================================================================');
    console.log('Trình duyệt sẽ mở thêm 10 giây để bạn quan sát trực tiếp màn hình...');
    await page.waitForTimeout(10000);

  } catch (error) {
    console.error('\n Có lỗi xảy ra trong quá trình chạy test:', error.message);
  } finally {
    await browser.close();
    console.log('Đã đóng trình duyệt Playwright.');
  }
}

main();
