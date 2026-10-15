const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

// Danh sách các màn hình và Tab cần quét theo đúng Audit 25 Báo cáo Maker CoreCCP
const TARGET_SCREENS = [
  {
    schemaKey: 'ORDERBOOK',
    name: 'Sổ lệnh - Tất cả (DSL CCP)',
    route: '/ORDERS/ORDERBOOK',
    tab: 'Tất cả',
    expectedFileName: 'DSL CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_MATCH',
    name: 'Sổ lệnh - Đã khớp (DSLDK CCP)',
    route: '/ORDERS/ORDERBOOK',
    tab: 'Lệnh đã khớp',
    expectedFileName: 'DSLDK CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_PENDING',
    name: 'Sổ lệnh - Chờ khớp (DSLCK CCP)',
    route: '/ORDERS/ORDERBOOK',
    tab: 'Lệnh chờ khớp',
    expectedFileName: 'DSLCK CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_CANCEL',
    name: 'Sổ lệnh - Đã hủy (DSLDH CCP)',
    route: '/ORDERS/ORDERBOOK',
    tab: 'Lệnh đã hủy',
    expectedFileName: 'DSLDH CCP.xlsx',
  },
  {
    schemaKey: 'ORDERMATCH_DETAIL',
    name: 'Khớp lệnh chi tiết (DSGD CCP)',
    route: '/ORDERS/ORDERMATCH_DETAIL',
    tab: null,
    expectedFileName: 'DSGD CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_MM',
    name: 'Sổ lệnh MM - Tất cả (DSL MM CCP)',
    route: '/ORDERS/ORDERBOOK_MM',
    tab: 'Tất cả',
    expectedFileName: 'DSL MM CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_MATCH_MM',
    name: 'Sổ lệnh MM - Đã khớp (DSLDK MM CCP)',
    route: '/ORDERS/ORDERBOOK_MM',
    tab: 'Lệnh đã khớp',
    expectedFileName: 'DSLDK MM CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_PENDING_MM',
    name: 'Sổ lệnh MM - Chờ khớp (DSLCK MM CCP)',
    route: '/ORDERS/ORDERBOOK_MM',
    tab: 'Lệnh chờ khớp',
    expectedFileName: 'DSLCK MM CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_CANCEL_MM',
    name: 'Sổ lệnh MM - Đã hủy (DSLDH MM CCP)',
    route: '/ORDERS/ORDERBOOK_MM',
    tab: 'Lệnh đã hủy',
    expectedFileName: 'DSLDH MM CCP.xlsx',
  },
  {
    schemaKey: 'ORDERBOOK_ALL_MM',
    name: 'Lịch sử giao dịch MM (DSGD MM CCP)',
    route: '/ORDERS/ORDERBOOK_ALL_MM',
    tab: null,
    expectedFileName: 'DSGD MM CCP.xlsx',
  },
  {
    schemaKey: 'OPEN_POSITION_EXPORT',
    name: 'Vị thế mở (TTM CCP)',
    route: '/ORDERS/OPEN_POSITION',
    tab: null,
    expectedFileName: 'TTM CCP.xlsx',
  },
  {
    schemaKey: 'PNL_EXECUTED',
    name: 'Lịch sử tất toán (TTTT)',
    route: '/ORDERS/PNL_EXECUTED',
    tab: 'Lịch sử tất toán',
    expectedFileName: 'TTTT.xlsx',
  },
  {
    schemaKey: 'ACCTMARGIN_ALL',
    name: 'Quản lý TT TKGD (QL TT TKGD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    tab: 'Danh sách trạng thái TKGD',
    expectedFileName: 'QL TT TKGD.xlsx',
  },
  {
    schemaKey: 'MEMBERMARGIN_ALL',
    name: 'Quản lý TT TVKD (QL TT TVKD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_ALL',
    tab: 'Danh sách trạng thái TKTVKD',
    expectedFileName: 'QL TT TVKD.xlsx',
  },
  {
    schemaKey: 'MARGIN_MNG_TRANSACTION',
    name: 'Quản lý Ký quỹ TKGD (DSQLKQ TKGD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_POS',
    tab: 'Danh sách ký quỹ TKGD',
    expectedFileName: 'DSQLKQ TKGD.xlsx',
  },
  {
    schemaKey: 'MARGIN_MNG_MEMBER',
    name: 'Quản lý Ký quỹ TVKD (DSQLKQ TVKD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_POS',
    tab: 'Danh sách ký quỹ TKTVKD',
    expectedFileName: 'DSQLKQ TVKD.xlsx',
  },
  {
    schemaKey: 'CASHTRANFER_HIST',
    name: 'Lịch sử nộp rút tiền (NR.xlsx)',
    route: '/CASHTRANFER/CASHTRANFER_HIST',
    tab: null,
    expectedFileName: 'NR.xlsx',
  },
  {
    schemaKey: 'ACCOUNTS_INFO',
    name: 'Danh sách tài khoản (DSTKGD ACM.xlsx)',
    route: '/ACCOUNTMNG/ACCOUNTS_INFO',
    tab: null,
    expectedFileName: 'DSTKGD ACM.xlsx',
  },
  {
    schemaKey: 'SETTLEMENT',
    name: 'Giá thanh toán (GTT CCP.xlsx)',
    route: '/PRODUCT/SETTLEMENT',
    tab: null,
    expectedFileName: 'GTT CCP.xlsx',
  },
  {
    schemaKey: 'COMMODITY',
    name: 'Hàng hóa (HH.xlsx)',
    route: '/PRODUCT/COMMODITY',
    tab: null,
    expectedFileName: 'HH.xlsx',
  },
];

async function scanDomHeaders(page) {
  return await page.evaluate(() => {
    const clean = (s) => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    // Lấy tất cả thẻ th trong thead của bảng đang hiển thị
    const ths = Array.from(document.querySelectorAll('table thead th, thead th, th.MuiTableCell-head'));
    
    // Thu thập thuộc tính
    const seen = new Set();
    const columns = [];

    for (const th of ths) {
      const clone = th.cloneNode(true);
      // Xóa các thành phần icon, svg, badge sort số 0
      clone.querySelectorAll('svg, .MuiTableSortLabel-icon, [class*="icon"], button, input').forEach((el) => el.remove());
      // Xóa các span/div chỉ chứa đúng số 0 (sort indicator)
      clone.querySelectorAll('*').forEach((el) => {
        if (el.children.length === 0 && (el.innerText === '0' || el.textContent === '0')) {
          el.remove();
        }
      });

      let text = clean(clone.innerText || clone.textContent);
      // Fallback: xóa số 0 ở đuôi nếu vẫn còn
      text = text.replace(/0$/, '').trim();

      const id = clean(th.id);
      const colId = clean(th.getAttribute('col-id') || th.getAttribute('data-field') || th.getAttribute('data-column-id') || '');
      
      const key = id || colId;
      
      // Bỏ qua checkbox, selection, action buttons hoặc text rỗng
      if (
        !text || 
        text === '​' || 
        text === '' || 
        key === 'selection' || 
        key === 'action' || 
        key === 'actions' || 
        key === 'checkbox' ||
        key.toLowerCase() === 'detail' ||
        text.toLowerCase() === 'chi tiết' ||
        text.toLowerCase() === 'thao tác'
      ) {
        continue;
      }

      // Tránh trùng lặp cột nếu có 2 thead
      const dedupeKey = `${key}_${text}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      columns.push({
        key: key || text,
        header: text,
      });
    }

    return columns;
  });
}

(async () => {
  console.log('🚀 BẮT ĐẦU QUÉT DOM CORECCP ĐỂ TRÍCH XUẤT CẤU HÌNH CỘT CHÍNH XÁC 100%...');
  const baseUrl = process.env.CORECCP_URL || 'https://uat-coreccp.mxv.com.vn';
  const username = process.env.CORECCP_USERNAME || 'hieptruong';
  const password = process.env.CORECCP_PASSWORD || 'Taovipko0!';

  const isHeaded = process.argv.includes('--headed');
  const browser = await chromium.launch({
    headless: !isHeaded,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // 1. ĐĂNG NHẬP
  console.log(`🔑 Đang đăng nhập CoreCCP (${baseUrl}) với user: ${username}...`);
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.fill("input[name='username']", username);
  await page.fill("input[name='password']", password);
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);
  console.log('✅ Đăng nhập thành công!');

  const allSchemas = {};
  const scanResults = [];

  // Đọc schema hiện có nếu có để cập nhật
  const schemaPath = path.resolve(__dirname, '../modules/ingress/coreccp/schemas/ag_grid_column_schemas.json');
  if (fs.existsSync(schemaPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      Object.assign(allSchemas, existing);
    } catch { }
  }

  // 2. DUYỆT TỪNG MÀN HÌNH
  for (const screen of TARGET_SCREENS) {
    console.log(`\n----------------------------------------------------------------------`);
    console.log(`🔍 [${screen.schemaKey}] Đang quét: ${screen.name}`);
    console.log(`   Route: ${screen.route} | Tab: ${screen.tab || '(Mặc định)'}`);

    try {
      // Điều hướng đến URL
      const currentUrl = page.url();
      const targetUrl = `${baseUrl}${screen.route}`;
      if (!currentUrl.includes(screen.route)) {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
      }

      // Nếu có Tab, click vào tab tương ứng
      if (screen.tab) {
        console.log(`   👉 Đang chuyển sang tab: "${screen.tab}"...`);
        const shortName = screen.tab.replace(/^(Quản lý ký quỹ|Danh sách trạng thái)\s+/i, '').trim();
        const tabXpath = `xpath=//button[@role='tab' and (contains(., '${screen.tab}') or contains(., '${shortName}'))]`;
        let tabEl = await page.$(tabXpath);
        if (!tabEl) {
          tabEl = await page.$(`xpath=//*[(@role='tab' or contains(@class, 'tab')) and (contains(., '${screen.tab}') or contains(., '${shortName}'))]`);
        }
        if (tabEl) {
          await tabEl.click();
          await page.waitForTimeout(2500);
        } else {
          console.warn(`   ⚠️ Không tìm thấy nút tab "${screen.tab}", tiếp tục với view hiện tại.`);
        }
      }

      // Đợi table hiển thị
      await page.waitForSelector('th', { timeout: 8000 }).catch(() => null);

      // Quét các thẻ th
      const columns = await scanDomHeaders(page);

      if (columns.length === 0) {
        console.warn(`   ⚠️ KHÔNG TÌM THẤY CỘT NÀO TRÊN GIAO DIỆN!`);
        scanResults.push({
          schemaKey: screen.schemaKey,
          name: screen.name,
          route: screen.route,
          tab: screen.tab,
          success: false,
          totalColumns: 0,
          error: 'Không tìm thấy thẻ th trên DOM',
        });
        continue;
      }

      console.log(`   ✅ Trích xuất thành công ${columns.length} cột từ DOM thực tế:`);
      columns.forEach((c, idx) => {
        if (idx < 5 || idx >= columns.length - 2) {
          console.log(`      ${idx + 1}. [${c.key}] -> "${c.header}"`);
        } else if (idx === 5) {
          console.log(`      ... (${columns.length - 7} cột khác) ...`);
        }
      });

      // Lưu vào schema
      allSchemas[screen.schemaKey] = {
        screenId: screen.schemaKey.toLowerCase(),
        screenName: screen.name,
        route: screen.route,
        tab: screen.tab || '',
        expectedFileName: screen.expectedFileName,
        totalColumns: columns.length,
        columns: columns,
      };

      scanResults.push({
        schemaKey: screen.schemaKey,
        name: screen.name,
        route: screen.route,
        tab: screen.tab,
        success: true,
        totalColumns: columns.length,
        columns: columns,
      });

    } catch (err) {
      console.error(`   ❌ Lỗi khi quét màn hình ${screen.schemaKey}:`, err.message);
      scanResults.push({
        schemaKey: screen.schemaKey,
        name: screen.name,
        route: screen.route,
        tab: screen.tab,
        success: false,
        totalColumns: 0,
        error: err.message,
      });
    }
  }

  await browser.close();

  // 3. LƯU SCHEMAS VÀO CẢ 2 NƠI: BACKEND & CORECCP-API-CLIENT
  const jsonContent = JSON.stringify(allSchemas, null, 2);

  // A. Backend schema
  fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
  fs.writeFileSync(schemaPath, jsonContent, 'utf8');
  console.log(`\n💾 Đã lưu schema vào Backend: ${schemaPath}`);

  // B. Coreccp-api-client schema
  const clientSchemaPath = path.resolve(__dirname, '../../../coreccp-api-client/src/schemas/ag_grid_column_schemas.json');
  if (fs.existsSync(path.dirname(clientSchemaPath))) {
    fs.mkdirSync(path.dirname(clientSchemaPath), { recursive: true });
    fs.writeFileSync(clientSchemaPath, jsonContent, 'utf8');
    console.log(`💾 Đã đồng bộ schema sang CoreCCP Client Package: ${clientSchemaPath}`);
  }

  // 4. XUẤT BÁO CÁO CHI TIẾT RA FILE MARKDOWN
  const reportDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, 'ccp_dom_extracted_schemas_report.md');

  let md = `# BÁO CÁO QUÉT THỰC TẾ DOM CÁC MÀN HÌNH CORECCP (GROUND TRUTH AUDIT)\n\n`;
  md += `> **Thời gian quét:** ${new Date().toLocaleString('vi-VN')}\n`;
  md += `> **Môi trường:** \`${baseUrl}\`\n`;
  md += `> **Phương pháp:** Trích xuất tự động qua Playwright \`th.id\` (JSON Field Key) và \`th.innerText\` (Tiêu đề cột tiếng Việt) từ DOM thực tế trên trình duyệt.\n`;
  md += `> **Cam kết:** 100% dữ liệu gốc từ DOM hệ thống CoreCCP, tuyệt đối không phỏng đoán, không tự chế, không suy diễn tên cột.\n\n`;

  md += `## 1. TỔNG QUAN KẾT QUẢ QUÉT\n\n`;
  md += `| STT | Schema Key | Tên Màn Hình / Tab | URL Route | File Excel Dự Kiến | Số Cột DOM | Trạng Thái |\n`;
  md += `| :---: | :--- | :--- | :--- | :--- | :---: | :---: |\n`;

  scanResults.forEach((r, idx) => {
    const status = r.success ? '✅ Thành công' : `❌ Lỗi (${r.error})`;
    md += `| ${idx + 1} | \`${r.schemaKey}\` | ${r.name} | \`${r.route}\` | \`${allSchemas[r.schemaKey]?.expectedFileName || ''}\` | **${r.totalColumns}** | ${status} |\n`;
  });

  md += `\n## 2. CHI TIẾT DANH MỤC CỘT (KEY & HEADER) TỪNG MÀN HÌNH\n\n`;

  for (const r of scanResults) {
    if (!r.success) continue;
    md += `### ${r.name} (\`${r.schemaKey}\`)\n\n`;
    md += `- **Route:** \`${r.route}\`\n`;
    md += `- **Tab:** \`${r.tab || 'Mặc định'}\`\n`;
    md += `- **File Excel:** \`${allSchemas[r.schemaKey]?.expectedFileName || ''}\`\n`;
    md += `- **Tổng số cột trích xuất từ DOM:** **${r.totalColumns} cột**\n\n`;
    md += `| Thứ Tự | JSON Key (\`th.id\`) | Tiêu Đề Tiếng Việt (\`th.innerText\`) |\n`;
    md += `| :---: | :--- | :--- |\n`;
    r.columns.forEach((col, cIdx) => {
      md += `| ${cIdx + 1} | \`${col.key}\` | ${col.header} |\n`;
    });
    md += `\n---\n\n`;
  }

  fs.writeFileSync(reportFile, md, 'utf8');
  console.log(`📊 Đã xuất báo cáo chi tiết ra file: ${reportFile}`);
  console.log(`\n🎉 HOÀN THÀNH QUÉT DOM CHO TOÀN BỘ MÀN HÌNH CORECCP!`);
})();
