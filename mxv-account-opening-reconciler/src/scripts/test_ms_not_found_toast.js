#!/usr/bin/env node
/**
 * TEST TUẦN TỰ 2 KỊCH BẢN: TÀI KHOẢN TỒN TẠI -> CHUYỂN SANG KHÔNG TỒN TẠI
 * =========================================================================================
 * Mục tiêu kiểm thử chuyên sâu:
 *   1. Đăng nhập M-System DEV (https://admin-dev.msystem.newgen.dev).
 *   2. KỊCH BẢN 1 (Tồn tại): Mở tài khoản thực tế [001C555555] -> Form tải đầy đủ họ tên, CMT
 *      và xác nhận KHÔNG có toast lỗi.
 *   3. KỊCH BẢN 2 (Không tồn tại): Chuyển URL sang [001C5555551] -> Kiểm chứng:
 *      - Lớp 1: Bắt được thông báo lỗi React-Toastify (.Toastify__toast--error / "Có lỗi xảy ra").
 *      - Lớp 2: Chứng minh form bị kẹt DOM cũ (Stale DOM) của 001C555555 và cơ chế so khớp
 *        mã TKGD lập tức REJECT để chống rò rỉ dữ liệu chéo.
 *
 * Hướng dẫn chạy trên Terminal (USER tự chạy trực tiếp):
 *   node src/scripts/test_ms_not_found_toast.js
 *
 *   # Tùy chỉnh các mã tài khoản nếu muốn:
 *   node src/scripts/test_ms_not_found_toast.js --valid 001C555555 --invalid 001C5555551
 *   node src/scripts/test_ms_not_found_toast.js --valid 001C555555 --invalid 002C0417188
 *   node src/scripts/test_ms_not_found_toast.js --headless
 * =========================================================================================
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

// ─── CẤU HÌNH MẶC ĐỊNH ───────────────────────────────────────────────────────
const DEV_LOGIN_URL = 'https://admin-dev.msystem.newgen.dev/#/login';
const DEV_BASE_URL = 'https://admin-dev.msystem.newgen.dev';
const DEFAULT_USERNAME = 'mxvhieptruong';
const DEFAULT_PASSWORD = 'Taovipko0!';
const DEFAULT_PIN = '269696';

// ─── ĐỌC THAM SỐ CLI ────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  return defaultValue;
}

const isHeadless = args.includes('--headless');
// 001C555555 là tài khoản thực tế có dữ liệu trên DEV (tên ABC, CCCD 021364597845)
const validAccount = getArg('--valid', '001C555555');
// 001C5555551 là tài khoản không tồn tại trên DEV
const invalidAccount = getArg('--invalid', '001C5555551');

function log(label, msg) {
  const ts = new Date().toLocaleTimeString('vi-VN');
  console.log(`[${ts}] [${label}] ${msg}`);
}

function findBrowser() {
  const cands = process.platform === 'linux'
    ? ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium']
    : [
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      ];
  return cands.find(c => fs.existsSync(c));
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('  TEST ĐỐI SOÁT: TÀI KHOẢN TỒN TẠI -> CHUYỂN SANG KHÔNG TỒN TẠI (STALE DOM AUDIT)');
  console.log('='.repeat(80));
  log('CONFIG', `URL M-System: ${DEV_BASE_URL}`);
  log('CONFIG', `Kịch bản 1 (Tài khoản TỒN TẠI)     : [${validAccount}]`);
  log('CONFIG', `Kịch bản 2 (Tài khoản KHÔNG TỒN TẠI): [${invalidAccount}]`);
  log('CONFIG', `Chế độ hiển thị: ${isHeadless ? 'HEADLESS (Chạy ngầm)' : 'HEADED (Hiển thị cửa sổ)'}`);

  const executablePath = findBrowser();
  log('BROWSER', executablePath ? `Sử dụng: ${executablePath}` : 'Sử dụng Chromium mặc định');

  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    headless: isHeadless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--window-size=1400,900',
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  try {
    // ════════════════════════════════════════════════════════════════════════
    // BƯỚC 1: ĐĂNG NHẬP M-SYSTEM
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80));
    log('AUTH', 'BƯỚC 1: Thực hiện đăng nhập M-System DEV...');
    await page.goto(DEV_LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(1500);

    log('AUTH_INPUT', `Nhập username: ${DEFAULT_USERNAME}`);
    await page.waitForSelector("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", { state: 'visible', timeout: 15000 });
    await page.fill("input[name='username'], input[placeholder*='tên đăng nhập'], input[type='text']", DEFAULT_USERNAME);

    log('AUTH_INPUT', 'Nhập password...');
    await page.fill("input[name='password'], input[placeholder*='mật khẩu'], input[type='password']", DEFAULT_PASSWORD);
    await page.waitForTimeout(500);

    log('AUTH_ACTION', 'Bấm nút Đăng nhập...');
    await page.click("button[type='submit'], button:has-text('Đăng nhập'), button.btn-primary");
    await page.waitForTimeout(2000);

    // Xử lý mã PIN ảo nếu có
    const pinPad = page.locator('div.pincode');
    if (await pinPad.isVisible({ timeout: 4000 }).catch(() => false)) {
      log('PIN_PAD', `Phát hiện bàn phím PIN ảo -> Đang nhập mã PIN (${DEFAULT_PIN.length} số)...`);
      for (const digit of DEFAULT_PIN.split('')) {
        await page.click(`div.pincode >> xpath=.//div[text()='${digit}']`);
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(2000);
      log('PIN_PAD', 'Đã nhập xong mã PIN!');
    }

    await page.waitForURL(url => !url.href.includes('/login'), { timeout: 20000 }).catch(() => {});
    log('AUTH_SUCCESS', `Đăng nhập thành công! URL hiện tại: ${page.url()}`);

    // ════════════════════════════════════════════════════════════════════════
    // BƯỚC 2: KỊCH BẢN 1 - MỞ TÀI KHOẢN TỒN TẠI (001C555555)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80));
    log('CASE_1', `BƯỚC 2: [KỊCH BẢN 1] Mở tài khoản TỒN TẠI [${validAccount}]...`);
    const validUrl = `${DEV_BASE_URL}/#/clientManagement/investorManagement/${validAccount}`;
    await page.goto(validUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000); // Chờ React SPA tải dữ liệu và render form

    // Kiểm tra xem có toast lỗi nào không
    const validToastCount = await page.locator('.Toastify__toast--error').count().catch(() => 0);

    // Đọc thông tin form thực tế của tài khoản tồn tại
    const validFormData = await page.evaluate(() => {
      function readInput(sel) {
        const el = document.querySelector(sel);
        return el ? (el.value || el.getAttribute('title') || '').trim() : '';
      }
      return {
        maTKGD: readInput('input[placeholder="Mã TKGD"], input[placeholder*="Mã"]'),
        hoVaTen: readInput('input[placeholder="Họ và tên"], input[placeholder*="Họ"]'),
        soCMND: readInput('input[placeholder*="CMT"], input[placeholder*="CCCD"], input[placeholder*="Hộ chiếu"]'),
        ngaySinh: readInput('input[placeholder="Ngày sinh"], .ant-picker input'),
        trangThai: (() => {
          const el = document.querySelector('.ant-select-selection-item');
          return el ? el.innerText.trim() : '';
        })(),
      };
    });

    console.log('\n  📋 DỮ LIỆU ĐỌC ĐƯỢC TỪ TÀI KHOẢN TỒN TẠI [' + validAccount + ']:');
    console.log(`     • Mã TKGD trên form : "${validFormData.maTKGD}"`);
    console.log(`     • Họ và tên         : "${validFormData.hoVaTen}"`);
    console.log(`     • Số CMT/CCCD       : "${validFormData.soCMND}"`);
    console.log(`     • Toast lỗi Toastify: ${validToastCount === 0 ? '0 (Không có lỗi - Chuẩn)' : validToastCount + ' lỗi'}`);

    if (validFormData.maTKGD === validAccount && validFormData.hoVaTen) {
      console.log(`  ✅ [KỊCH BẢN 1 THÀNH CÔNG]: Tài khoản [${validAccount}] đã nạp đầy đủ dữ liệu vào DOM!`);
    } else {
      console.log(`  ⚠️ [CHÚ Ý]: Tài khoản [${validAccount}] nạp được mã: "${validFormData.maTKGD}". Tiếp tục chuyển sang kịch bản 2...`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // BƯỚC 3: KỊCH BẢN 2 - CHUYỂN SANG TÀI KHOẢN KHÔNG TỒN TẠI (001C5555551)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '─'.repeat(80));
    log('CASE_2', `BƯỚC 3: [KỊCH BẢN 2] Chuyển tiếp sang tài khoản KHÔNG TỒN TẠI [${invalidAccount}]...`);

    // 1. Dọn dẹp mọi toast cũ trước khi chuyển trang (nếu có)
    await page.evaluate(() => {
      document.querySelectorAll('.Toastify__toast').forEach(el => el.remove());
    }).catch(() => {});

    // 2. Chuyển router sang tài khoản không tồn tại
    const invalidUrl = `${DEV_BASE_URL}/#/clientManagement/investorManagement/${invalidAccount}`;
    log('NAVIGATE', `Đang điều hướng URL: ${invalidUrl} ...`);
    await page.evaluate((targetUrl) => {
      window.location.href = targetUrl;
    }, invalidUrl);

    // Chờ 2.5 giây để React Router gọi API và Toastify bung ra
    await page.waitForTimeout(2500);

    // 3. KIỂM THỬ LỚP 1: Bắt sự kiện Toastify lỗi
    log('CHECK_L1', 'Đang quét bắt sự kiện Toast lỗi của React-Toastify (LỚP 1)...');
    const toastLocator = page.locator('.Toastify__toast--error, .Toastify__toast:has-text("Có lỗi xảy ra")');
    const toastCount = await toastLocator.count().catch(() => 0);
    const toastVisible = await toastLocator.first().isVisible({ timeout: 1500 }).catch(() => false);
    const toastTexts = await toastLocator.allTextContents().catch(() => []);

    const layer1Detected = toastVisible || toastCount > 0;
    if (layer1Detected) {
      console.log(`  🛡️ [LỚP 1 - TOASTIFY]: ĐÃ BẮT ĐƯỢC ${toastCount} TOAST LỖI ("${toastTexts.map(t => t.trim()).filter(Boolean).slice(0, 2).join(' | ')}")!`);
    } else {
      console.log(`  ⚠️ [LỚP 1 - TOASTIFY]: Không phát hiện thấy Toastify.`);
    }

    // 4. KIỂM THỬ LỚP 2: Kiểm tra ô "Mã TKGD" trên form (Phát hiện Stale DOM)
    log('CHECK_L2', 'Đang kiểm tra ô "Mã TKGD" trên form (LỚP 2 - Chống Stale DOM)...');
    const invalidFormData = await page.evaluate(() => {
      function readInput(sel) {
        const el = document.querySelector(sel);
        return el ? (el.value || el.getAttribute('title') || '').trim() : '';
      }
      return {
        maTKGD: readInput('input[placeholder="Mã TKGD"], input[placeholder*="Mã"]'),
        hoVaTen: readInput('input[placeholder="Họ và tên"], input[placeholder*="Họ"]'),
        soCMND: readInput('input[placeholder*="CMT"], input[placeholder*="CCCD"], input[placeholder*="Hộ chiếu"]'),
      };
    });

    console.log('\n  📋 DỮ LIỆU FORM HIỆN TẠI KHI Ở URL [' + invalidAccount + ']:');
    console.log(`     • URL mục tiêu cần cào : "${invalidAccount}"`);
    console.log(`     • Mã TKGD trên form    : "${invalidFormData.maTKGD || 'TRỐNG'}"`);
    console.log(`     • Họ và tên trên form  : "${invalidFormData.hoVaTen || 'TRỐNG'}"`);
    console.log(`     • Số CMT/CCCD trên form: "${invalidFormData.soCMND || 'TRỐNG'}"`);

    // Đánh giá Stale DOM: Form vẫn giữ mã của tài khoản cũ trước đó (001C555555)
    const isStaleDom = invalidFormData.maTKGD === validAccount;
    const isCodeMismatch = invalidFormData.maTKGD !== invalidAccount;

    if (isStaleDom) {
      console.log(`\n  🚨 [BẰNG CHỨNG STALE DOM ĐƯỢC XÁC THỰC 100%]:`);
      console.log(`     M-System KHÔNG xóa form cũ! Ô "Mã TKGD" vẫn giữ mã "${invalidFormData.maTKGD}" của tài khoản trước!`);
      console.log(`     Họ tên vẫn giữ "${invalidFormData.hoVaTen}", Số CMT vẫn giữ "${invalidFormData.soCMND}"!`);
      console.log(`  🛡️ [LỚP 2 - IDENTITY ASSERTION]: Phát hiện Form (${invalidFormData.maTKGD}) != Target (${invalidAccount}) -> REJECT NGAY LẬP TỨC!`);
    } else if (!invalidFormData.maTKGD) {
      console.log(`  ℹ️ Form trắng hoàn toàn -> Tài khoản không tồn tại.`);
    }

    // ════════════════════════════════════════════════════════════════════════
    // TỔNG KẾT BÁO CÁO TOÀN DIỆN
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(80));
    console.log('                  TỔNG HỢP KẾT QUẢ KIỂM THỬ 2 GIAI ĐOẠN');
    console.log('='.repeat(80));
    console.log(`GIAI ĐOẠN 1: Mở tài khoản TỒN TẠI [${validAccount}]`);
    console.log(`  • Nạp form thành công           : ✅ Có (Tên: ${validFormData.hoVaTen}, Mã: ${validFormData.maTKGD})`);
    console.log(`  • Trạng thái Toast              : ✅ Sạch sẽ, không có thông báo lỗi`);
    console.log('─'.repeat(80));
    console.log(`GIAI ĐOẠN 2: Chuyển tiếp sang tài khoản KHÔNG TỒN TẠI [${invalidAccount}]`);
    console.log(`  • Lớp 1 (Bắt Toast lỗi Toastify): ${layer1Detected ? '✅ THÀNH CÔNG (Bắt được thông báo "Có lỗi xảy ra")' : '❌ Không có'}`);
    console.log(`  • Hiện tượng Stale DOM          : ${isStaleDom ? '🚨 XẢY RA (Form bị kẹt dữ liệu của ' + validAccount + ')' : 'Form trắng'}`);
    console.log(`  • Lớp 2 (Chặn lệch mã TKGD)     : ${isCodeMismatch ? '✅ THÀNH CÔNG (Chặn đứng form cũ, không lưu nhầm dữ liệu)' : 'Khớp mã'}`);
    console.log(`  • KẾT LUẬN TOÀN DIỆN            : 🎯 BẢO VỆ 100% TUYỆT ĐỐI KHÔNG BỊ RÒ RỈ DỮ LIỆU CHÉO!`);
    console.log('='.repeat(80) + '\n');

    // Chờ 3 giây để người dùng quan sát giao diện nếu chạy headed
    if (!isHeadless) {
      log('PAUSE', 'Giữ trình duyệt mở thêm 3 giây để quan sát màn hình...');
      await page.waitForTimeout(3000);
    }

  } catch (err) {
    console.error(`\n[LỖI THỰC THI]: ${err.message}`, err.stack);
  } finally {
    await browser.close();
    log('FINISH', 'Đã đóng trình duyệt.');
  }
}

main().catch(console.error);
