const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🔍 BẮT ĐẦU ĐIỀU TRA CHI TIẾT TẠI SAO CHƯA THẤY NÚT XUẤT FILE TRÊN M-SYSTEM...');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  // 1. ĐĂNG NHẬP
  console.log('1. Đang đăng nhập...');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const userInput = await page.waitForSelector('input[name="username"], input[type="text"]');
  await userInput.fill('mxvhieptruong');
  const passInput = await page.waitForSelector('input[name="password"], input[type="password"]');
  await passInput.fill('Taovipko0!');
  await page.click('button[type="submit"], button.btn-primary');

  const pinModal = await page.waitForSelector('div.pincode', { state: 'visible', timeout: 10000 }).catch(() => null);
  if (pinModal) {
    console.log('   - Nhập PIN 269696...');
    for (const d of '269696'.split('')) {
      await page.click(`div.pincode >> xpath=.//div[text()='${d}']`);
      await page.waitForTimeout(200);
    }
  }

  await page.waitForTimeout(4000);
  console.log('   -> Đăng nhập xong. URL hiện tại:', page.url());

  const debugDir = path.resolve(__dirname, 'output', 'ms_debug');
  fs.mkdirSync(debugDir, { recursive: true });

  // 2. TEST MÀN HÌNH 1: DSTKGD (tab LME & ACM)
  console.log('\n2. Kiểm tra màn hình Quản lý TKGD: #/clientManagement/investorManagement...');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/clientManagement/investorManagement');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(debugDir, 'investor_management.png'), fullPage: true });

  const investorTabs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a, button, li, .nav-link')).map(el => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      className: el.className,
    })).filter(e => ['Futures', 'Spreads', 'LME', 'ACM'].some(t => e.text.includes(t)));
  });
  console.log('   Tabs tìm thấy trong Investor Management:', investorTabs);

  // Thử click tab LME
  const lmeTab = await page.$("xpath=//*[self::a or self::button or self::li or self::span][normalize-space(text())='LME' or contains(text(), 'LME')]");
  if (lmeTab) {
    console.log('   👉 Click được vào tab LME!');
    await lmeTab.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(debugDir, 'investor_LME.png') });
  } else {
    console.log('   ❌ Không tìm thấy tab LME theo xpath!');
  }

  const exportButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, i')).map(el => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      className: el.className,
      title: el.getAttribute('title'),
      onclick: el.getAttribute('onclick'),
    })).filter(e => e.className.includes('fa-') || e.text.toLowerCase().includes('xuất') || e.text.toLowerCase().includes('excel') || e.text.toLowerCase().includes('export') || (e.title && e.title.toLowerCase().includes('export')));
  });
  console.log('   Các nút Export/Icon tìm thấy trên trang:', exportButtons);

  // 3. TEST MÀN HÌNH 2: TTM (Trạng thái mở)
  console.log('\n3. Kiểm tra màn hình TTM: #/positionManagement/openPositionInfo...');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/positionManagement/openPositionInfo');
  await page.waitForTimeout(3000);
  console.log('   URL sau khi goto TTM:', page.url());
  await page.screenshot({ path: path.join(debugDir, 'ttm_page.png'), fullPage: true });

  const ttmButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, i')).map(el => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      className: el.className,
      title: el.getAttribute('title'),
    })).filter(e => e.className.includes('fa-') || e.text.toLowerCase().includes('xuất') || e.text.toLowerCase().includes('tìm'));
  });
  console.log('   Nút trên trang TTM:', ttmButtons);

  // 4. TEST MÀN HÌNH 3: DSGD (Danh sách giao dịch)
  console.log('\n4. Kiểm tra màn hình DSGD: #/orderManagement/transactionList...');
  await page.goto('https://admin-dev.msystem.newgen.dev/#/orderManagement/transactionList');
  await page.waitForTimeout(3000);
  console.log('   URL sau khi goto DSGD:', page.url());
  await page.screenshot({ path: path.join(debugDir, 'dsgd_page.png'), fullPage: true });

  const dsgdButtons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, i')).map(el => ({
      tag: el.tagName,
      text: el.innerText.trim(),
      className: el.className,
      title: el.getAttribute('title'),
    })).filter(e => e.className.includes('fa-') || e.text.toLowerCase().includes('xuất') || e.text.toLowerCase().includes('tìm'));
  });
  console.log('   Nút trên trang DSGD:', dsgdButtons);

  // 5. Kiểm tra Sidebar Menu thực tế của hệ thống
  console.log('\n5. Kiểm tra toàn bộ cây Sidebar Menu...');
  const sidebarLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.sidebar a, .sidebar-nav a, nav a')).map(a => ({
      href: a.getAttribute('href'),
      text: a.innerText.trim().replace(/\n+/g, ' '),
    })).filter(a => a.href && a.text);
  });
  console.log(`   Tổng số link trong Sidebar: ${sidebarLinks.length}`);
  sidebarLinks.forEach((l, i) => console.log(`   ${i + 1}. [${l.href}] -> ${l.text}`));

  await browser.close();
  console.log('\n✅ HOÀN TẤT ĐIỀU TRA!');
})();
