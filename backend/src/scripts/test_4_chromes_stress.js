/**
 * TEST BENCHMARK: Stress-test mở 4 Chromium riêng biệt trên Ubuntu
 * Kiểm tra xem khi mở 4 Browser riêng biệt (MS, CQG, ACM, CCP) đồng thời có bị tràn RAM hay crash không.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const { execSync } = require('child_process');

function getMemInfo() {
  try {
    const lines = fs.readFileSync('/proc/meminfo', 'utf8').split('\n');
    const info = {};
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim();
        const val = parseInt(parts[1].trim().split(' ')[0], 10);
        info[key] = Math.round(val / 1024); // MB
      }
    }
    return {
      total: info.MemTotal || 0,
      free: info.MemFree || 0,
      available: info.MemAvailable || 0,
      swapTotal: info.SwapTotal || 0,
      swapFree: info.SwapFree || 0,
      swapUsed: (info.SwapTotal || 0) - (info.SwapFree || 0),
    };
  } catch {
    return { total: 0, free: 0, available: 0, swapTotal: 0, swapFree: 0, swapUsed: 0 };
  }
}

async function runTest() {
  console.log('===============================================================');
  console.log('  KIỂM THỬ THỰC TẾ: MỞ 4 TRÌNH DUYỆT CHROMIUM RIÊNG BIỆT TRÊN UBUNTU');
  console.log('===============================================================');

  const initialMem = getMemInfo();
  console.log(`\n[1. BỘ NHỚ BAN ĐẦU]`);
  console.log(`- RAM Tổng        : ${initialMem.total} MB`);
  console.log(`- RAM Khả dụng   : ${initialMem.available} MB`);
  console.log(`- Swap Đang dùng : ${initialMem.swapUsed} MB / ${initialMem.swapTotal} MB\n`);

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-extensions',
    '--window-size=1280,800',
  ];

  const browsers = [];
  const pages = [];
  const errors = [];

  const targets = [
    { name: 'M-System', url: 'https://msadmin.mxv.com.vn/#/login' },
    { name: 'CQG Portal', url: 'https://m.cqg.com/cqg/desktop/logon?ref=forced' },
    { name: 'ACM ETP', url: 'https://acm-etp.acmmex.com/exchange/index.html#/login' },
    { name: 'CoreCCP', url: 'https://coreccp.vnclear.vn/login' },
  ];

  console.log('[2. BẮT ĐẦU MỞ ĐỒNG THỜI 4 CHROMIUM RIÊNG BIỆT...]');
  const startTime = Date.now();

  await Promise.all(
    targets.map(async (t, idx) => {
      try {
        console.log(` -> [${idx + 1}/4] Đang khởi chạy Chromium riêng cho: ${t.name}...`);
        const browser = await chromium.launch({
          headless: true,
          args: launchArgs,
        });
        browsers.push(browser);
        const page = await browser.newPage();
        pages.push(page);
        console.log(` -> [${idx + 1}/4] ${t.name}: Đang tải URL ${t.url}...`);
        await page.goto(t.url, { waitUntil: 'commit', timeout: 45000 });
        console.log(` -> [${idx + 1}/4] ✅ ${t.name}: Đã tải trang thành công!`);
      } catch (err) {
        console.error(` -> [${idx + 1}/4] ❌ ${t.name} lỗi: ${err.message}`);
        errors.push({ name: t.name, error: err.message });
      }
    })
  );

  const loadDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\nHoàn tất tải 4 trang trong: ${loadDuration}s`);

  // Đọc bộ nhớ khi cả 4 đang chạy
  const peakMem = getMemInfo();
  console.log(`\n[3. ĐO ĐẠC BỘ NHỚ KHI CẢ 4 CHROMIUM ĐANG CHẠY ĐỒNG THỜI]`);
  console.log(`- RAM Khả dụng còn lại : ${peakMem.available} MB (Giảm: ${initialMem.available - peakMem.available} MB)`);
  console.log(`- Swap Đang dùng       : ${peakMem.swapUsed} MB (Tăng: ${peakMem.swapUsed - initialMem.swapUsed} MB)`);

  // Liệt kê chi tiết RAM của từng tiến trình Chromium
  try {
    const psOutput = execSync(
      'ps aux | grep -E "chrome-headless|chromium" | grep -v grep | awk \'{print $2, $4, $6, $11}\''
    ).toString().trim();
    const chromeProcs = psOutput.split('\n').filter(Boolean);
    let totalChromeRssKb = 0;
    chromeProcs.forEach((line) => {
      const parts = line.trim().split(/\s+/);
      const rssKb = parseInt(parts[2], 10) || 0;
      totalChromeRssKb += rssKb;
    });
    console.log(`- Tổng số tiến trình Chromium sinh ra: ${chromeProcs.length} tiến trình`);
    console.log(`- Tổng RAM thực tế 4 Chromium chiếm   : ${Math.round(totalChromeRssKb / 1024)} MB`);
  } catch (e) {
    console.log('Không thể lấy chi tiết ps aux:', e.message);
  }

  console.log('\n[4. GIỮ TẢI TRONG 10 GIÂY ĐỂ KIỂM TRA ĐỘ ỔN ĐỊNH VÀ KHÔNG SẬP SERVER...]');
  await new Promise((r) => setTimeout(r, 10000));

  const afterHoldMem = getMemInfo();
  console.log(`- Sau 10 giây giữ tải: RAM khả dụng = ${afterHoldMem.available} MB, Swap = ${afterHoldMem.swapUsed} MB`);

  console.log('\n[5. ĐÓNG TẤT CẢ TRÌNH DUYỆT VÀ GIẢI PHÓNG BỘ NHỚ...]');
  for (const b of browsers) {
    try {
      await b.close();
    } catch {}
  }

  await new Promise((r) => setTimeout(r, 2000));
  const finalMem = getMemInfo();
  console.log(`- RAM sau khi đóng 4 Chromium: ${finalMem.available} MB (Giải phóng lại: ${finalMem.available - peakMem.available} MB)`);

  console.log('\n===============================================================');
  console.log('  KẾT LUẬN KIỂM THỬ:');
  if (errors.length === 0) {
    console.log('  ✅ THÀNH CÔNG: Server KHÔNG BỊ SẬP khi mở 4 Chromium riêng biệt!');
    console.log(`  📊 Mức RAM tiêu hao thêm: ~${initialMem.available - peakMem.available} MB.`);
    if (peakMem.available < 300) {
      console.log('  ⚠️ CẢNH BÁO: RAM khả dụng xuống dưới 300MB, chạm ngưỡng Swap Disk.');
    } else {
      console.log('  🟢 AN TOÀN: RAM khả dụng vẫn còn dư dả.');
    }
  } else {
    console.log(`  ❌ THẤT BẠI: Có ${errors.length} nguồn bị lỗi/crash do thiếu tài nguyên.`);
  }
  console.log('===============================================================\n');
}

runTest().catch((err) => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
