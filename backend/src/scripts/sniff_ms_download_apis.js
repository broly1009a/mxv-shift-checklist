/**
 * sniff_ms_download_apis.js
 * Tự động đăng nhập M-System qua Playwright và bắt (sniff) toàn bộ Endpoint API
 * khi xuất file của 20 màn hình báo cáo M-System
 */

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  adminUrl: process.env.MS_ADMIN_URL || 'https://admin-dev.msystem.newgen.dev',
  baseUrl: process.env.MS_BASE_URL || 'https://api-dev.newgen.dev',
  username: process.env.MS_USERNAME || 'mxvhieptruong',
  password: process.env.MS_PASSWORD || 'Taovipko0!',
  pin: process.env.MS_PIN || '269696',
};

const EXPORT_SELECTORS = [
  'button:has(i[class*="fa-file-csv"])',
  'button:has(i[class*="fa-file-excel"])',
  'button.ladda-button:has(i[class*="fa-file-csv"])',
  'button.ladda-button:has(i[class*="fa-file-excel"])',
  'button.btn-ghost-primary:has(i[class*="fa-file-csv"])',
  'button.ladda-button:has(i.fas.fa-file-csv)',
  'button.ladda-button:has(i.fa-file-csv)',
  'button.ladda-button:has(i.fas.fa-file-excel)',
  'button.ladda-button:has(i.fa-file-excel)',
  'button:has(i.fas.fa-file-csv)',
  'button:has(i.fa-file-csv)',
  'button:has(i.fas.fa-file-excel)',
  'button:has(i.fa-file-excel)',
  'i[class*="fa-file-csv"]',
  'i[class*="fa-file-excel"]',
  'i.fas.fa-file-csv',
  'i.fa-file-csv',
  'i.fas.fa-file-excel',
  'i.fa-file-excel',
  "button:has-text('Xuất file')",
  "button:has-text('Xuất Excel')",
  "button[title*='Export' i]",
].join(', ');

const REPORTS = [
  { key: 'NKTTHT', name: 'Nhật ký thao tác hệ thống', hash: '#/systemManagement/activityHistory', menuSteps: ['QL hệ thống', 'Thông tin chung', 'Nhật ký thao tác hệ thống'], ext: 'xlsx' },
  { key: 'DSTKGD-Futures', name: 'Danh sách TKGD Futures', hash: '#/clientManagement/investorManagement', menuSteps: ['QL khách hàng', 'QL TKGD', 'Danh sách TKGD'], ext: 'xlsx' },
  { key: 'DSTKGD-Spread', name: 'Danh sách TKGD Spread', hash: '#/clientManagement/investorManagement', subTab: 'Spreads', ext: 'xlsx' },
  { key: 'DSTKGD-LME', name: 'Danh sách TKGD LME', hash: '#/clientManagement/investorManagement', subTab: 'LME', ext: 'xlsx' },
  { key: 'DSTKGD-ACM', name: 'Danh sách TKGD ACM', hash: '#/clientManagement/investorManagement', subTab: 'ACM', ext: 'xlsx' },
  { key: 'TLQHSKQ', name: 'Thiết lập quan hệ số ký quỹ', hash: '#/clientManagement/marginRatioMultiplier', menuSteps: ['QL khách hàng', 'QL TKGD', 'TLKQ HSKQ'], ext: 'xlsx' },
  { key: 'NR', name: 'Danh sách nộp rút tiền', hash: '#/clientManagement/marginMoneyTransHistory', menuSteps: ['QL khách hàng', 'QL TKGD', 'Lịch sử giao dịch tiền TKGD'], ext: 'xlsx' },
  { key: 'DSTrader', name: 'Danh sách Trader', hash: '#/clientManagement/traderManagement', menuSteps: ['QL khách hàng', 'QL Trader', 'Danh sách Trader'], ext: 'xlsx' },
  { key: 'market truoc 6h', name: 'Market trước 6h', hash: '#/orderManagement/orderCreating', isMarketBefore6h: true, ext: 'csv' },
  { key: 'DSLDK', name: 'Danh sách lệnh dự kiến (đã khớp)', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã khớp', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã khớp'], ext: 'xlsx' },
  { key: 'DSLCK', name: 'Danh sách lệnh chờ khớp', hash: '#/orderManagement/orderList', subTab: 'Lệnh chờ khớp', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh chờ khớp'], ext: 'xlsx' },
  { key: 'DSLH', name: 'Danh sách lệnh hủy', hash: '#/orderManagement/orderList', subTab: 'Lệnh đã hủy', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh đã hủy'], ext: 'xlsx' },
  { key: 'DSLK', name: 'Danh sách lệnh khác', hash: '#/orderManagement/orderList', subTab: 'Lệnh khác', menuSteps: ['QL giao dịch', 'Danh sách lệnh', 'Lệnh khác'], ext: 'xlsx' },
  { key: 'DSGD', name: 'Danh sách giao dịch', hash: '#/orderManagement/transactionList', menuSteps: ['QL giao dịch', 'Danh sách giao dịch'], ext: 'xlsx' },
  { key: 'TTM', name: 'Trạng thái mở (Vị thế mở)', hash: '#/positionManagement/openPositionInfo', menuSteps: ['QL trạng thái', 'Trạng thái mở'], ext: 'xlsx' },
  { key: 'TTTT', name: 'Trạng thái tất toán', hash: '#/positionManagement/finalPositionInfo', menuSteps: ['QL trạng thái', 'Trạng thái tất toán'], ext: 'xlsx' },
  { key: 'TTCDH', name: 'Trạng thái tất toán chờ đáo hạn LME', hash: '#/positionManagement/finalPositionInfo', subTab: 'Trạng thái tất toán chờ đáo hạn LME', ext: 'xlsx' },
  { key: 'DSQLKQ', name: 'Danh sách quản lý ký quỹ', hash: '#/positionManagement/marginList', ext: 'xlsx' },
  { key: 'QLTKGD', name: 'Quản lý tài khoản giao dịch', hash: '#/clientManagement/marginStatusManagement', ext: 'xlsx' },
  { key: 'QLTKGD âm KQ', name: 'Quản lý TKGD âm ký quỹ', hash: '#/clientManagement/negativeMarginManagement', menuSteps: ['QL khách hàng', 'QL TKGD', 'QL TKGD âm ký quỹ'], ext: 'xlsx' },
];

(async () => {
  console.log('========================================================================');
  console.log('   🚀 BẮT ĐẦU CÀO (SNIFF) TOÀN BỘ ENDPOINT API XUẤT FILE CỦA M-SYSTEM  ');
  console.log(`   Admin Host: ${CONFIG.adminUrl}`);
  console.log(`   API Host:   ${CONFIG.baseUrl}`);
  console.log(`   User:       ${CONFIG.username}`);
  console.log('========================================================================\n');

  const isHeaded = process.argv.includes('--headed');
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  // 1. ĐĂNG NHẬP M-SYSTEM
  console.log('🔑 [1/3] Đang đăng nhập M-System giao diện Web...');
  const loginUrl = `${CONFIG.adminUrl}/#/login`;
  await page.goto(loginUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const userInput = await page.waitForSelector('input[name="username"], input[type="text"]', { timeout: 15000 });
  await userInput.fill(CONFIG.username);
  const passInput = await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });
  await passInput.fill(CONFIG.password);
  await page.click('button[type="submit"], button.btn-primary');

  // Nhập PIN trên bàn phím ảo nếu có
  console.log('   - Chờ bàn phím số ảo PIN...');
  const pinModal = await page.waitForSelector('div.pincode', { state: 'visible', timeout: 10000 }).catch(() => null);
  if (pinModal && CONFIG.pin) {
    console.log(`   - Tự động nhập PIN [${CONFIG.pin}] trên bàn phím ảo...`);
    for (const digit of String(CONFIG.pin).split('')) {
      const digitSelector = `div.pincode >> xpath=.//div[text()='${digit}']`;
      await page.waitForSelector(digitSelector, { state: 'visible', timeout: 5000 });
      await page.click(digitSelector);
      await page.waitForTimeout(250);
    }
  }

  // Chờ dashboard tải xong
  await page.waitForSelector("xpath=//*[contains(text(), 'QL hệ thống') or contains(text(), 'QL trạng thái') or contains(text(), 'Dashboard') or contains(text(), 'QL khách hàng')]", { timeout: 25000 });
  console.log('✅ Đăng nhập M-System thành công!\n');

  const capturedApis = [];
  let currentReportKey = '';
  let currentReportCaptured = null;

  // Lắng nghe tất cả request mạng phát sinh
  page.on('request', (req) => {
    const url = req.url();
    // Bắt các request liên quan đến xuất file: có chữ excel, export, download, csv, print
    const isExport = url.includes('/excel') || url.includes('/export') || url.includes('/download') || url.includes('/csv');
    if (isExport && currentReportKey && !currentReportCaptured) {
      currentReportCaptured = {
        reportKey: currentReportKey,
        url: url,
        method: req.method(),
        headers: req.headers(),
        postData: req.postData() || null,
        capturedAt: new Date().toISOString(),
      };
      console.log(`\n   🎯 [BẮT ĐƯỢC API] ${req.method()} ${url}`);
    }
  });

  page.on('response', async (res) => {
    const url = res.url();
    const headers = res.headers();
    const disposition = headers['content-disposition'] || '';
    const contentType = headers['content-type'] || '';

    if (disposition.includes('attachment') || contentType.includes('excel') || contentType.includes('csv') || url.includes('/excel')) {
      if (currentReportCaptured && currentReportCaptured.url === url) {
        currentReportCaptured.responseStatus = res.status();
        currentReportCaptured.contentType = contentType;
        currentReportCaptured.contentDisposition = disposition;
        console.log(`   📦 [RESPONSE] Status ${res.status()} | Content-Type: ${contentType} | Disposition: ${disposition}`);
      }
    }
  });

  // 2. DUYỆT TỪNG MÀN HÌNH ĐỂ BẮT API
  console.log('========================================================================');
  console.log('🔍 [2/3] BẮT ĐẦU DUYỆT CÁC MÀN HÌNH VÀ BẮT API XUẤT FILE:');
  console.log('========================================================================\n');

  for (let i = 0; i < REPORTS.length; i++) {
    const rep = REPORTS[i];
    currentReportKey = rep.key;
    currentReportCaptured = null;

    console.log(`------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${REPORTS.length}] Đang kiểm tra: ${rep.name} (${rep.key})`);
    console.log(`      Hash URL: ${rep.hash} | SubTab: ${rep.subTab || '(Mặc định)'}`);

    try {
      const targetUrl = `${CONFIG.adminUrl}/${rep.hash}`;
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);

      // Xử lý riêng cho Bảng giá Market trước 6h
      if (rep.isMarketBefore6h) {
        const csvBtn = page.locator("xpath=//i[contains(@class, 'fa-file-csv')]");
        const isVis = await csvBtn.isVisible().catch(() => false);
        if (!isVis) {
          await page.click("xpath=//i[contains(@class, 'fas fa-plus')]").catch(() => {});
          await page.waitForTimeout(1500);
        }
      }

      // Nếu có SubTab, click tab
      if (rep.subTab) {
        console.log(`      👉 Chuyển sang subTab: "${rep.subTab}"...`);
        const tabSelector = `xpath=//*[self::a or self::button or self::li or self::span or self::div][normalize-space(text())='${rep.subTab}' or contains(text(), '${rep.subTab}')]`;
        const tabEl = await page.waitForSelector(tabSelector, { timeout: 8000 }).catch(() => null);
        if (tabEl) {
          await tabEl.click();
          await page.waitForTimeout(2000);
        }
      }

      // Kích hoạt tìm kiếm nếu có
      const searchBtn = await page.$("button:has-text('Tìm kiếm'), button:has(i.fa-search)");
      if (searchBtn && (await searchBtn.isVisible().catch(() => false))) {
        await searchBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
      }

      // Tìm nút xuất file
      let exportBtn = await page.$(EXPORT_SELECTORS);
      if (!exportBtn && rep.menuSteps && rep.menuSteps.length > 0) {
        console.log(`      🔄 Thử fallback điều hướng qua Sidebar...`);
        for (const step of rep.menuSteps) {
          const stepSel = `xpath=//*[self::a or self::span or self::li][normalize-space(text())='${step}' or contains(text(), '${step}')]`;
          const sEl = await page.waitForSelector(stepSel, { timeout: 6000 }).catch(() => null);
          if (sEl) {
            await sEl.click();
            await page.waitForTimeout(800);
          }
        }
        await page.waitForTimeout(1500);
        if (rep.subTab) {
          const tabSelector = `xpath=//*[self::a or self::button or self::li or self::span or self::div][normalize-space(text())='${rep.subTab}' or contains(text(), '${rep.subTab}')]`;
          const tabEl = await page.waitForSelector(tabSelector, { timeout: 6000 }).catch(() => null);
          if (tabEl) await tabEl.click();
          await page.waitForTimeout(1500);
        }
        exportBtn = await page.$(EXPORT_SELECTORS);
      }

      if (!exportBtn) {
        console.warn(`      ⚠️ Không tìm thấy nút Xuất file trên giao diện!`);
        capturedApis.push({
          key: rep.key,
          name: rep.name,
          hash: rep.hash,
          subTab: rep.subTab || null,
          success: false,
          note: 'Không thấy nút xuất file trên UI',
        });
        continue;
      }

      // Kích hoạt click nút Xuất file và chờ bắt request
      console.log(`      🖱️ Đang bấm nút Xuất file...`);
      await exportBtn.click();
      await page.waitForTimeout(3500);

      if (currentReportCaptured) {
        capturedApis.push({
          key: rep.key,
          name: rep.name,
          hash: rep.hash,
          subTab: rep.subTab || null,
          success: true,
          api: currentReportCaptured,
        });
      } else {
        console.warn(`      ⚠️ Đã bấm nút nhưng không thấy request API xuất file phát sinh!`);
        capturedApis.push({
          key: rep.key,
          name: rep.name,
          hash: rep.hash,
          subTab: rep.subTab || null,
          success: false,
          note: 'Bấm nút nhưng không bắt được API request dạng /excel hoặc download',
        });
      }

    } catch (err) {
      console.error(`      ❌ Lỗi khi xử lý ${rep.key}:`, err.message);
      capturedApis.push({
        key: rep.key,
        name: rep.name,
        hash: rep.hash,
        subTab: rep.subTab || null,
        success: false,
        error: err.message,
      });
    }
  }

  await browser.close();

  // 3. TỔNG HỢP VÀ XUẤT BÁO CÁO AUDIT
  console.log('\n========================================================================');
  console.log('💾 [3/3] TỔNG HỢP BÁO CÁO VÀ LƯU REGISTRY API...');
  console.log('========================================================================');

  const outDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const jsonPath = path.join(outDir, 'ms_download_apis_registry.json');
  fs.writeFileSync(jsonPath, JSON.stringify(capturedApis, null, 2), 'utf8');
  console.log(`✅ Đã lưu JSON Registry: ${jsonPath}`);

  // Xuất Markdown
  const mdPath = path.join(outDir, 'ms_download_apis_report.md');
  let md = `# BÁO CÁO ĐẶC TẢ API TẢI BÁO CÁO M-SYSTEM (GROUND TRUTH AUDIT)\n\n`;
  md += `> Thời gian cào: ${new Date().toLocaleString('vi-VN')}\n`;
  md += `> M-System Admin: \`${CONFIG.adminUrl}\`\n`;
  md += `> M-System API Host: \`${CONFIG.baseUrl}\`\n\n`;
  md += `## 1. TỔNG HỢP CÁC ENDPOINT TẢI FILE ĐÃ BẮT ĐƯỢC\n\n`;
  md += `| STT | Mã Báo Cáo | Tên Báo Cáo | Hash URL | HTTP Method | Endpoint API Bắt Được | Trạng Thái |\n`;
  md += `| :---: | :--- | :--- | :--- | :---: | :--- | :---: |\n`;

  capturedApis.forEach((item, idx) => {
    const status = item.success ? '✅ Thành công' : `⚠️ Chưa bắt được (${item.note || item.error || ''})`;
    const method = item.api ? `\`${item.api.method}\`` : '-';
    const endpoint = item.api ? `\`${item.api.url.replace(CONFIG.baseUrl, '')}\`` : '-';
    md += `| ${idx + 1} | \`${item.key}\` | ${item.name} | \`${item.hash}\` | ${method} | ${endpoint} | ${status} |\n`;
  });

  md += `\n## 2. CHI TIẾT ENDPOINT & CURL MẪU GỌI TRỰC TIẾP TỪNG BÁO CÁO\n\n`;

  capturedApis.filter(a => a.success && a.api).forEach((item) => {
    const api = item.api;
    md += `### • Báo cáo: ${item.name} (\`${item.key}\`)\n\n`;
    md += `- **URL Đầy Đủ:** \`${api.url}\`\n`;
    md += `- **Phương Thức:** \`${api.method}\`\n`;
    if (api.contentDisposition) md += `- **File Mặc Định:** \`${api.contentDisposition}\`\n`;
    if (api.postData) {
      md += `- **Request Body:**\n\`\`\`json\n${api.postData}\n\`\`\`\n`;
    }
    md += `- **cURL Mẫu Gọi Trực Tiếp:**\n\`\`\`bash\ncurl -X ${api.method} "${api.url}" \\\n  -H "authorization: Bearer <MS_TOKEN>" \\\n  -H "origin: ${CONFIG.adminUrl}" \\\n  -H "referer: ${CONFIG.adminUrl}/" \\\n  -o "${item.key}.${item.ext || 'xlsx'}"\n\`\`\`\n\n---\n\n`;
  });

  fs.writeFileSync(mdPath, md, 'utf8');
  console.log(`📊 Đã xuất Báo cáo Markdown chi tiết: ${mdPath}`);
  console.log('\n🎉 HOÀN TẤT THÀNH CÔNG QUY TRÌNH SNIFF API M-SYSTEM!');
})();
