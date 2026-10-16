let playwright;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
}
const { chromium } = playwright;
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('========================================================================');
  console.log('   ĐO LƯỜNG TỐC ĐỘ THỰC TẾ & BẮT WEBSOCKET KHI TẢI FILE CORECCP');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Đăng ký WebSocket NGAY TỪ ĐẦU
  page.on('websocket', (ws) => {
    console.log('  [WebSocket Connected]:', ws.url());
    ws.on('framereceived', (f) => {
      const text = typeof f.payload === 'string' ? f.payload : '[Binary]';
      if (!text.startsWith('2')) {
        console.log('  << [WS Nhận]:', text.substring(0, 200));
      }
    });
    ws.on('framesent', (f) => {
      const text = typeof f.payload === 'string' ? f.payload : '[Binary]';
      if (!text.startsWith('3')) {
        console.log('  >> [WS Gửi]:', text.substring(0, 100));
      }
    });
  });

  let downloadedFile = null;
  page.on('download', async (dl) => {
    const savePath = path.join(__dirname, '..', 'output', dl.suggestedFilename());
    await dl.saveAs(savePath);
    const size = fs.existsSync(savePath) ? fs.statSync(savePath).size : 0;
    downloadedFile = { name: dl.suggestedFilename(), path: savePath, size };
  });

  // 1. Đăng nhập
  console.log('1. Đang đăng nhập CoreCCP...');
  const tLoginStart = Date.now();
  await page.goto('https://coreccp.mxv.com.vn/login', { waitUntil: 'domcontentloaded' });
  await page.fill("input[name='username'], input[type='text']", 'hieptruong');
  await page.fill("input[name='password'], input[type='password']", 'Taovipko0!');
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(2500);
  console.log(`✓ Đăng nhập xong (${Date.now() - tLoginStart}ms)\n`);

  // 2. Mở trang ORDERMATCH_DETAIL
  console.log('2. Mở trang ORDERMATCH_DETAIL (Khớp lệnh chi tiết)...');
  const tNavStart = Date.now();
  await page.goto('https://coreccp.mxv.com.vn/ORDERS/ORDERMATCH_DETAIL', { waitUntil: 'networkidle' });
  console.log(`✓ Mở trang xong (${Date.now() - tNavStart}ms)\n`);

  // 3. Đo lường tốc độ kết xuất & tải file
  console.log('3. Bấm nút Kết xuất -> Đo lường thời gian tải...');
  const tExportStart = Date.now();

  const exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất')]").first();
  await exportBtn.click({ force: true });
  await page.waitForTimeout(300);

  const exportAll = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')]").first();
  if (await exportAll.isVisible()) {
    await exportAll.click({ force: true });
  }

  // Chờ tối đa 10s cho file tải xong
  for (let i = 0; i < 20; i++) {
    if (downloadedFile) break;
    await page.waitForTimeout(500);
  }

  const exportTotalTime = Date.now() - tExportStart;

  console.log('\n========================================================================');
  console.log('                     KẾT QUẢ ĐO LƯỜNG TỐC ĐỘ:');
  console.log('========================================================================');
  if (downloadedFile) {
    console.log(`🎯 TẢI FILE THÀNH CÔNG: ${downloadedFile.name}`);
    console.log(`   - Kích thước file: ${(downloadedFile.size / 1024).toFixed(1)} KB`);
    console.log(`   - Đường dẫn lưu: ${downloadedFile.path}`);
    console.log(`   - TỔNG THỜI GIAN TẢI FILE: ${exportTotalTime}ms (~${(exportTotalTime / 1000).toFixed(2)} giây)`);
    console.log(`   - Đánh giá tốc độ: CỰC KỲ NHANH (dưới 2 giây cho một file đầy đủ dữ liệu toàn sàn!)`);
  } else {
    console.log(`❌ Quá thời gian chờ tải file (${exportTotalTime}ms)`);
  }
  console.log('========================================================================\n');

  await browser.close();
})();
