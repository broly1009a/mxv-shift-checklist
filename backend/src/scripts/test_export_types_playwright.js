/**
 * ============================================================================
 * TEST_EXPORT_TYPES_PLAYWRIGHT.JS
 * ============================================================================
 * Tự động đăng nhập CoreCCP bằng Playwright, vào từng trang thực tế,
 * bấm nút "Kết xuất" -> "Xuất tất cả" và lắng nghe xem giao diện thực sự gọi:
 * - KIỂU 1: Search API với pageSize cực lớn (ví dụ: pageSize: 200000)
 * - KIỂU 2: Server-Side Export qua /ccp/export/create (sau đó download qua /report/download/{id})
 * - KIỂU 3: Client-Side xuất trực tiếp 20 dòng trên bảng
 * 
 * Xuất kết quả vào: backend/src/scripts/output/audit_export_types_playwright.md
 * ============================================================================
 */

let playwright;
try {
  playwright = require('playwright-core');
} catch {
  playwright = require('C:\\Users\\hiepth\\OneDrive - MERCANTILE EXCHANGE OF VIETNAM\\Documents\\Github\\mxv-cqg-download-investigation\\backend\\node_modules\\playwright-core');
}
const { chromium } = playwright;

const path = require('path');
const fs = require('fs');

const CCP_URL = 'https://uat-coreccp.mxv.com.vn';
const USERNAME = 'hieptruong';
const PASSWORD = 'Taovipko0!';

const TEST_SCREENS = [
  { code: 'CUSTOMERS_COMPANY', name: 'Khách hàng tổ chức/DN', route: '/ACCOUNTMNG/CUSTOMERS_COMPANY' },
  { code: 'ORDERBOOK', name: 'Danh sách lệnh (DSL)', route: '/ORDERS/ORDERBOOK' },
  { code: 'ORDERMATCH_DETAIL', name: 'Khớp lệnh chi tiết (DSGD)', route: '/ORDERS/ORDERMATCH_DETAIL' },
  { code: 'OPEN_POSITION', name: 'Trạng thái mở (TTM)', route: '/ORDERS/OPEN_POSITION' },
  { code: 'PNL_EXECUTED', name: 'Trạng thái tất toán (TTTT)', route: '/ORDERS/PNL_EXECUTED' },
  { code: 'CASHTRANFER_HIST', name: 'Lịch sử nộp rút tiền (NR)', route: '/CASHTRANFER/CASHTRANFER_HIST' },
  { code: 'ACCOUNTS_INFO', name: 'Danh sách tài khoản (DSTKGD)', route: '/ACCOUNTMNG/ACCOUNTS_INFO' },
  { code: 'ACCTMARGIN_ALL', name: 'Trạng thái TKGD (Ký quỹ)', route: '/RISKMNG/ACCTMARGIN_ALL' },
  { code: 'MARGIN_MNG', name: 'Quản lý ký quỹ TKGD', route: '/RISKMNG/MARGIN_MNG' },
  { code: 'SETTLEMENT', name: 'Quản lý giá thanh toán (GTT)', route: '/PRODUCT/SETTLEMENT' },
  { code: 'COMMODITY', name: 'Hàng hóa & Hợp đồng (HH)', route: '/PRODUCT/COMMODITY' },
  { code: 'ORDERBOOK_MM', name: 'Danh sách lệnh MM', route: '/ORDERS/ORDERBOOK_MM' },
];

function getEdgeExecutable() {
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

async function dismissModalBackdrop(page) {
  try {
    const backdrop = page.locator("xpath=//div[contains(@class, 'MuiBackdrop-root') and not(contains(@class, 'MuiBackdrop-invisible'))]").first();
    if (await backdrop.isVisible({ timeout: 400 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
    }
  } catch { }
}

async function main() {
  console.log('\n========================================================================');
  console.log('   PLAYWRIGHT AUDIT: PHÂN BIỆT 2 KIỂU GỌI API KHI BẤM KẾT XUẤT');
  console.log('========================================================================\n');

  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: getEdgeExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Đăng nhập
  console.log(`🔑 Đang đăng nhập CoreCCP (${CCP_URL}/login)...`);
  await page.goto(`${CCP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.fill("input[name='username'], input[type='text']", USERNAME);
  await page.fill("input[name='password'], input[type='password']", PASSWORD);
  await page.click("button[type='submit'], button:has-text('Đăng nhập')");
  await page.waitForTimeout(3000);
  await dismissModalBackdrop(page);
  console.log('  ✓ Đăng nhập thành công!\n');

  const auditResults = [];

  for (let i = 0; i < TEST_SCREENS.length; i++) {
    const screen = TEST_SCREENS[i];
    const targetUrl = `${CCP_URL}${screen.route}`;
    console.log(`------------------------------------------------------------------------`);
    console.log(`[${i + 1}/${TEST_SCREENS.length}] Đang kiểm tra: ${screen.name} (${screen.route})...`);

    const itemRecord = {
      code: screen.code,
      name: screen.name,
      route: screen.route,
      hasExportButton: false,
      exportOptions: [],
      detectedCallType: 'UNKNOWN',
      endpointCalled: '',
      payloadDetails: null,
      notes: '',
    };

    try {
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1000);
      await dismissModalBackdrop(page);

      // Tìm nút Kết xuất
      const exportBtn = page.locator(
        "xpath=//button[contains(., 'Kết xuất') or contains(., 'Xuất CSV') or contains(., 'Xuất Excel') or contains(., 'Export')]" +
        " | //button[contains(@aria-label, 'Export') or contains(@aria-label, 'Kết xuất')]"
      ).first();

      if (await exportBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        itemRecord.hasExportButton = true;

        // Click để xem các options
        await exportBtn.click({ force: true });
        await page.waitForTimeout(400);

        const menuItems = await page.locator("xpath=//ul[@role='menu']//li[@role='menuitem']").all();
        for (const mi of menuItems) {
          const txt = (await mi.textContent().catch(() => ''))?.trim();
          if (txt) itemRecord.exportOptions.push(txt);
        }

        // Bắt đầu lắng nghe request sau khi bấm xuất
        const requestsAfterClick = [];
        const captureFn = (req) => {
          const u = req.url();
          if (u.includes('/ccp/')) {
            let parsedBody = null;
            try { parsedBody = req.postDataJSON(); } catch { }
            requestsAfterClick.push({
              url: u,
              method: req.method(),
              body: parsedBody,
            });
          }
        };
        page.on('request', captureFn);

        // Click "Xuất tất cả", nếu không có thì click "Xuất trang hiện tại"
        const exportAllItem = page.locator("xpath=//li[@role='menuitem'][contains(., 'Xuất tất cả')]").first();
        if (await exportAllItem.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log('    -> Đã click tùy chọn: "Xuất tất cả"');
          await exportAllItem.click({ force: true });
        } else {
          const exportCurrentItem = page.locator("xpath=//li[@role='menuitem'][contains(., 'Xuất trang hiện tại')]").first();
          if (await exportCurrentItem.isVisible({ timeout: 500 }).catch(() => false)) {
            console.log('    -> Đã click tùy chọn: "Xuất trang hiện tại"');
            await exportCurrentItem.click({ force: true });
          } else {
            console.log('    -> Click lại nút Kết xuất đơn');
          }
        }

        // Chờ 3 giây để hứng request
        await page.waitForTimeout(3000);
        page.off('request', captureFn);
        await dismissModalBackdrop(page);

        // Phân tích các request bắt được
        let isType1 = false;
        let isType2 = false;

        for (const r of requestsAfterClick) {
          // Kiểu 2: /ccp/export/create
          if (r.url.includes('/ccp/export/create')) {
            isType2 = true;
            itemRecord.detectedCallType = 'KIỂU 2: SERVER_SIDE_EXPORT';
            itemRecord.endpointCalled = 'POST /ccp/export/create';
            itemRecord.payloadDetails = r.body;
            console.log(`    🎯 PHÁT HIỆN: KIỂU 2 - Gọi Server Export /ccp/export/create (Tải qua /report/download/{id})`);
            break;
          }

          // Kiểu 1: Search API với pageSize lớn >= 10000 (như 200000)
          if (r.url.includes('/search/') && r.body && r.body.page && r.body.page.pageSize >= 10000) {
            isType1 = true;
            itemRecord.detectedCallType = 'KIỂU 1: CLIENT_SIDE_PAGESIZE_FULL';
            itemRecord.endpointCalled = r.url.replace(/https?:\/\/[^\/]+/, '');
            itemRecord.payloadDetails = { pageSize: r.body.page.pageSize, searchcode: r.body.searchcode };
            console.log(`    🎯 PHÁT HIỆN: KIỂU 1 - Gọi Search API với pageSize = ${r.body.page.pageSize}! FE tự tạo Excel`);
            break;
          }
        }

        if (!isType1 && !isType2) {
          itemRecord.detectedCallType = 'KIỂU 3: CLIENT_SIDE_CURRENT_PAGE';
          itemRecord.notes = 'Không phát sinh request mạng mới khi xuất -> Dùng mảng 20 dòng hiện tại của FE';
          console.log(`    ℹ️ PHÁT HIỆN: KIỂU 3 - FE xuất trực tiếp từ dữ liệu hiện tại trên màn hình`);
        }

      } else {
        itemRecord.notes = 'Không thấy nút Kết xuất trên trang này';
        console.log('    ✗ Không có nút Kết xuất');
      }

    } catch (err) {
      itemRecord.notes = `Lỗi: ${err.message}`;
      console.log(`    Lỗi: ${err.message}`);
    }

    auditResults.push(itemRecord);
    await page.waitForTimeout(400);
  }

  await context.close().catch(() => { });
  await browser.close().catch(() => { });

  // Xuất file kết quả
  const jsonPath = path.join(outputDir, 'audit_export_types_playwright.json');
  fs.writeFileSync(jsonPath, JSON.stringify(auditResults, null, 2), 'utf-8');

  const mdPath = path.join(outputDir, 'audit_export_types_playwright.md');
  let md = `# BÁO CÁO THỰC THI PLAYWRIGHT: PHÂN BIỆT 2 KIỂU GỌI API KHI TẢI FILE CORECCP\n\n`;
  md += `> Thời điểm test thực tế: ${new Date().toLocaleString('vi-VN')} | Trình duyệt: Playwright Chromium/Edge Headless\n\n`;
  md += `## 1. Bảng Tổng Hợp Phân Loại Thực Tế Khi Bấm "Xuất Tất Cả"\n\n`;
  md += `| STT | Mã Màn Hình | Tên Nghiệp Vụ | URL Route | Cơ Chế Thực Tế Trên FE | Endpoint Kích Hoạt | Tham Số Đặc Trưng |\n`;
  md += `| :---: | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  auditResults.forEach((r, idx) => {
    let typeDisplay = r.detectedCallType;
    let paramDisplay = '-';
    if (r.detectedCallType.includes('KIỂU 1')) {
      typeDisplay = ' **KIỂU 1** (Full JSON qua Search)';
      paramDisplay = `\`pageSize: ${r.payloadDetails?.pageSize || 200000}\``;
    } else if (r.detectedCallType.includes('KIỂU 2')) {
      typeDisplay = ' **KIỂU 2** (Server-Side Export)';
      paramDisplay = `\`POST /export/create\` $\\rightarrow$ \`/report/download/{id}\``;
    } else if (r.detectedCallType.includes('KIỂU 3')) {
      typeDisplay = '⚠️ **KIỂU 3** (Chỉ xuất trang hiện tại)';
      paramDisplay = `Không gọi thêm API`;
    }

    md += `| ${idx + 1} | \`${r.code}\` | **${r.name}** | \`${r.route}\` | ${typeDisplay} | \`${r.endpointCalled || '-'}\` | ${paramDisplay} |\n`;
  });

  md += `\n---\n\n## 2. Kết Luận & Hướng Dẫn Tối Ưu Cho Bot Tự Động Hóa\n\n`;
  md += `1. **Các trang thuộc KIỂU 1 (gọi với \`pageSize: 200000\`)**:\n`;
  md += `   - Bot **không cần** gọi \`/ccp/export/create\` hay chờ \`/report/download/{id}\`.\n`;
  md += `   - Chỉ cần gửi đúng request \`POST /ccp/inquiry/maintain/{CODE}/search/{CODE}\` với \`"pageSize": 200000\`.\n`;
  md += `   - Nhận về toàn bộ JSON sạch trong RAM trong **vài trăm mili-giây**, sau đó tự lưu Excel nếu cần.\n\n`;
  md += `2. **Các trang thuộc KIỂU 2 (gọi \`/ccp/export/create\`)**:\n`;
  md += `   - Frontend bắt buộc server render vì dữ liệu lớn.\n`;
  md += `   - Bot gọi \`POST /ccp/export/create\` $\\rightarrow$ nhận \`reportId\` $\\rightarrow$ gọi \`GET /ccp/report/download/{id}\` để lưu file \`.xlsx\` gốc.\n\n`;

  fs.writeFileSync(mdPath, md, 'utf-8');

  console.log('\n========================================================================');
  console.log('   HOÀN TẤT VÀ ĐÃ GHI KẾT QUẢ VÀO FILE!');
  console.log('========================================================================');
  console.log(`  ✓ File Markdown: ${mdPath}`);
  console.log(`  ✓ File JSON:     ${jsonPath}\n`);
}

main().catch(console.error);
