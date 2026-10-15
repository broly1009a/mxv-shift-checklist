const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  await page.goto('https://admin-dev.msystem.newgen.dev/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 15000 });
  await userInput.fill('mxvhieptruong');
  const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });
  await passInput.fill('Taovipko0!');
  await page.click('button.btn-primary, button[type="submit"], button:has-text("Đăng nhập")');

  const pinModal = await page.waitForSelector('div.pincode', { timeout: 8000 }).catch(() => null);
  if (pinModal) {
    for (const d of '269696'.split('')) {
      await page.click(`div.pincode >> xpath=.//div[text()='${d}']`);
      await page.waitForTimeout(200);
    }
  }
  await page.waitForTimeout(4000);

  // 1. Đến màn hình DSGD
  console.log('\n--- Đang mở màn hình DSGD: #/orderManagement/transactionList ---');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/orderManagement/transactionList');
  await page.waitForTimeout(3000);

  const btnHtml = await page.evaluate(() => {
    const icon = document.querySelector('i.fa-file-csv, i.fa-file-excel, i[class*="csv"]');
    return icon
      ? {
          iconClass: icon.className,
          parentTag: icon.parentElement.tagName,
          parentClass: icon.parentElement.className,
          parentHtml: icon.parentElement.outerHTML,
        }
      : null;
  });
  console.log('CSV BUTTON INFO:', JSON.stringify(btnHtml, null, 2));

  // Lắng nghe API khi click
  page.on('request', (req) => {
    console.log(`🎯 [REQ] ${req.method()} ${req.url()}`);
    if (req.method() === 'POST') console.log(`   Body:`, req.postData());
  });

  page.on('response', (res) => {
    if (res.url().includes('excel') || res.url().includes('csv') || res.url().includes('transaction') || res.headers()['content-disposition']) {
      console.log(`📦 [RES] Status: ${res.status()} | Content-Type: ${res.headers()['content-type']} | Disposition: ${res.headers()['content-disposition']}`);
    }
  });

  const btn = await page.$('i.fa-file-csv, i[class*="csv"], button:has(i[class*="csv"]), a:has(i[class*="csv"])');
  if (btn) {
    console.log('👉 Tìm thấy nút CSV! Đang click...');
    await btn.click();
    await page.waitForTimeout(5000);
  } else {
    console.log('❌ Không tìm thấy selector!');
  }

  // 2. Đến màn hình TTM (Trạng thái mở)
  console.log('\n--- Đang mở màn hình TTM: #/positionManagement/openPositionInfo ---');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/positionManagement/openPositionInfo');
  await page.waitForTimeout(3000);

  const btnTtm = await page.$('i.fa-file-csv, i[class*="csv"], button:has(i[class*="csv"]), a:has(i[class*="csv"])');
  if (btnTtm) {
    console.log('👉 Tìm thấy nút CSV trên TTM! Đang click...');
    await btnTtm.click();
    await page.waitForTimeout(5000);
  }

  await browser.close();
})();
