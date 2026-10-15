let playwright;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
}
const { chromium } = playwright;
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // Đăng nhập
  console.log('1. Đang đăng nhập...');
  await page.goto('https://uat-coreccp.mxv.com.vn/login', { waitUntil: 'domcontentloaded' });
  await page.fill("input[name='username'], input[type='text']", 'hieptruong');
  await page.fill("input[name='password'], input[type='password']", 'Taovipko0!');
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(3000);

  // Mở trang ORDERMATCH_DETAIL
  console.log('2. Đang mở trang ORDERMATCH_DETAIL...');
  await page.goto('https://uat-coreccp.mxv.com.vn/ORDERS/ORDERMATCH_DETAIL', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  console.log('3. Lắng nghe toàn bộ network & websocket...');
  const allEvents = [];

  // Lắng nghe WebSocket
  page.on('websocket', ws => {
    console.log('  [WebSocket Connected]:', ws.url());
    ws.on('framereceived', frame => {
      allEvents.push({ type: 'WS_RECEIVE', payload: frame.payload });
    });
    ws.on('framesent', frame => {
      allEvents.push({ type: 'WS_SENT', payload: frame.payload });
    });
  });

  page.on('request', req => {
    allEvents.push({
      type: 'REQUEST',
      url: req.url(),
      method: req.method(),
      postData: req.postData(),
    });
  });

  page.on('response', async res => {
    let body = '';
    try {
      const ct = res.headers()['content-type'] || '';
      if (ct.includes('application/json') || ct.includes('text')) {
        body = await res.text();
      }
    } catch {}
    allEvents.push({
      type: 'RESPONSE',
      url: res.url(),
      status: res.status(),
      body: body.substring(0, 300),
    });
  });

  // Bắt sự kiện download
  page.on('download', download => {
    console.log('  🎯 [Download Triggered]:', download.suggestedFilename(), 'URL:', download.url());
  });

  // Bấm Kết xuất -> Xuất tất cả
  console.log('4. Bấm nút Kết xuất -> Xuất tất cả...');
  const exportBtn = page.locator("xpath=//button[contains(., 'Kết xuất')]").first();
  await exportBtn.click({ force: true });
  await page.waitForTimeout(400);

  const exportAll = page.locator("xpath=//li[contains(text(), 'Xuất tất cả')]").first();
  if (await exportAll.isVisible()) {
    await exportAll.click({ force: true });
  }

  // Chờ 8 giây để toàn bộ luồng hoàn tất
  await page.waitForTimeout(8000);

  console.log('\n========================================================================');
  console.log('   CHI TIẾT LUỒNG TRUYỀN TẢI TỪ KHI CREATE ĐẾN KHI CÓ DOWNLOAD ID:');
  console.log('========================================================================');

  allEvents.forEach((ev, idx) => {
    if (ev.type.startsWith('WS')) {
      console.log(`[${idx + 1}] [${ev.type}]: ${typeof ev.payload === 'string' ? ev.payload.substring(0, 200) : '[Binary]'}`);
    } else if (ev.url && (ev.url.includes('/ccp/') || ev.url.includes('report') || ev.url.includes('export') || ev.url.includes('download') || ev.url.includes('noti'))) {
      console.log(`[${idx + 1}] [${ev.type}] ${ev.method || ev.status} -> ${ev.url}`);
      if (ev.postData) console.log('    PostData:', ev.postData.substring(0, 150));
      if (ev.body) console.log('    ResponseBody:', ev.body.substring(0, 200));
    }
  });

  await browser.close();
})().catch(console.error);
