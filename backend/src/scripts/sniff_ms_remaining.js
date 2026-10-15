const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TARGETS = [
  { key: 'TTTT', name: 'Trạng thái tất toán', hash: '#/positionManagement/finalPositionInfo' },
  { key: 'TTCDH', name: 'Trạng thái tất toán chờ đáo hạn LME', hash: '#/positionManagement/finalPositionInfo', subTab: 'LME' },
  { key: 'DSLDK', name: 'Danh sách lệnh đã khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã khớp' },
  { key: 'DSLCK', name: 'Danh sách lệnh chờ khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh chờ khớp' },
  { key: 'DSLH', name: 'Danh sách lệnh hủy', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã hủy' },
  { key: 'DSQLKQ', name: 'Danh sách quản lý ký quỹ', hash: '#/positionManagement/marginList' },
  { key: 'NR', name: 'Danh sách nộp rút tiền', hash: '#/clientManagement/marginMoneyTransHistory' },
  { key: 'QLTKGD', name: 'Quản lý TT TKGD', hash: '#/clientManagement/marginStatusManagement' },
  { key: 'QLTKGD âm KQ', name: 'Quản lý TKGD âm ký quỹ', hash: '#/clientManagement/negativeMarginManagement' },
  { key: 'DSTrader', name: 'Danh sách Trader', hash: '#/clientManagement/traderManagement' },
  { key: 'TLQHSKQ', name: 'Thiết lập quan hệ số ký quỹ', hash: '#/clientManagement/marginRatioMultiplier' },
  { key: 'market truoc 6h', name: 'Bảng giá Market', hash: '#/orderManagement/orderCreating' },
];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(20000);

  // Đăng nhập
  await page.goto('https://admin-dev.msystem.newgen.dev/#/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await (await page.waitForSelector('input[name="username"], input[type="text"]')).fill('mxvhieptruong');
  await (await page.waitForSelector('input[name="password"], input[type="password"]')).fill('Taovipko0!');
  await page.click('button.btn-primary, button[type="submit"], button:has-text("Đăng nhập")');

  const pinModal = await page.waitForSelector('div.pincode', { timeout: 8000 }).catch(() => null);
  if (pinModal) {
    for (const d of '269696'.split('')) {
      await page.click(`div.pincode >> xpath=.//div[text()='${d}']`);
      await page.waitForTimeout(150);
    }
  }
  await page.waitForTimeout(3500);

  const results = [];
  let currentKey = '';

  page.on('request', (req) => {
    const url = req.url();
    if ((url.includes('/excel') || url.includes('/csv') || url.includes('/export')) && currentKey) {
      console.log(`\n🎯 [BẮT ĐƯỢC API] [${currentKey}] ${req.method()} ${url}`);
      results.push({
        key: currentKey,
        method: req.method(),
        url: url,
        postData: req.postData() || null,
      });
    }
  });

  page.on('response', (res) => {
    const disp = res.headers()['content-disposition'] || '';
    if (disp) {
      console.log(`   📦 [RESPONSE] ${disp}`);
      const found = results.find(r => r.key === currentKey);
      if (found) found.filename = disp;
    }
  });

  for (const t of TARGETS) {
    currentKey = t.key;
    console.log(`\n-------------------------------------------------------------`);
    console.log(`🔍 Đang quét màn hình [${t.key}]: ${t.name} (${t.hash})...`);

    try {
      await page.goto(`https://admin-dev.msystem.newgen.dev/${t.hash}`, { waitUntil: 'domcontentloaded' });
      // Chờ các API khởi tạo dữ liệu của trang đó load xong
      await page.waitForTimeout(3500);

      if (t.subTab) {
        console.log(`   👉 Chuyển tab: "${t.subTab}"...`);
        const tabEl = await page.$(`xpath=//*[self::a or self::button or self::li or self::span][normalize-space(text())='${t.subTab}' or contains(text(), '${t.subTab}')]`);
        if (tabEl) {
          await tabEl.click();
          await page.waitForTimeout(2500);
        }
      }

      // Xử lý Bảng giá (bấm plus nếu cần)
      if (t.key === 'market truoc 6h') {
        const plusBtn = await page.$("xpath=//i[contains(@class, 'fa-plus')]");
        if (plusBtn) {
          await plusBtn.click();
          await page.waitForTimeout(1500);
        }
      }

      // Chờ nút CSV xuất hiện
      const csvBtn = await page.waitForSelector('i.fa-file-csv, i.fas.fa-file-csv, button:has(i[class*="fa-file-csv"]), button:has-text("Xuất file")', { timeout: 8000 }).catch(() => null);
      if (csvBtn) {
        console.log('   👉 Tìm thấy nút xuất file! Đang click...');
        await csvBtn.click();
        await page.waitForTimeout(3000);
      } else {
        console.log('   ⚠️ Không thấy nút xuất file sau 8s');
      }
    } catch (err) {
      console.log(`   ❌ Lỗi: ${err.message}`);
    }
  }

  await browser.close();

  console.log('\n=============================================================');
  console.log('📊 TỔNG HỢP CÁC ENDPOINT BẮT ĐƯỢC:');
  console.log(JSON.stringify(results, null, 2));

  // Lưu ra file registry cập nhật
  const outPath = path.resolve(__dirname, 'output', 'ms_all_sniffed_apis.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8');
})();
