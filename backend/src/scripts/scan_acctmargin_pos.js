const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('🚀 Đang quét chính xác 2 tab trên route /RISKMNG/ACCTMARGIN_POS...');
  const baseUrl = process.env.CORECCP_URL || 'https://uat-coreccp.mxv.com.vn';
  const username = process.env.CORECCP_USERNAME || 'hieptruong';
  const password = process.env.CORECCP_PASSWORD || 'Taovipko0!';

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  });

  const page = await browser.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
  await page.fill("input[name='username']", username);
  await page.fill("input[name='password']", password);
  await page.click("button[type='submit']");
  await page.waitForTimeout(3000);

  await page.goto(`${baseUrl}/RISKMNG/ACCTMARGIN_POS`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  async function getHeaders() {
    return await page.evaluate(() => {
      const clean = (s) => String(s || '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      const ths = Array.from(document.querySelectorAll('table thead th, thead th, th.MuiTableCell-head'));
      const cols = [];
      const seen = new Set();
      for (const th of ths) {
        const clone = th.cloneNode(true);
        clone.querySelectorAll('svg, .MuiTableSortLabel-icon, [class*="icon"], button, input').forEach((el) => el.remove());
        clone.querySelectorAll('*').forEach((el) => {
          if (el.children.length === 0 && (el.innerText === '0' || el.textContent === '0')) el.remove();
        });
        let text = clean(clone.innerText || clone.textContent).replace(/0$/, '').trim();
        const id = clean(th.id || th.getAttribute('data-column-id') || th.getAttribute('col-id') || '');
        if (!text || id === 'actions' || id === 'action' || id === 'mrt-row-spacer' || id === 'selection') continue;
        if (seen.has(id)) continue;
        seen.add(id);
        cols.push({ key: id, header: text });
      }
      return cols;
    });
  }

  // 1. Tab 1: Danh sách ký quỹ TKGD
  console.log('📌 Đang quét Tab 1: Danh sách ký quỹ TKGD...');
  const tkgdTab = await page.$("xpath=//*[contains(text(), 'Danh sách ký quỹ TKGD')]");
  if (tkgdTab) await tkgdTab.click();
  await page.waitForTimeout(2000);
  const tkgdCols = await getHeaders();
  console.log(`✅ TKGD: ${tkgdCols.length} cột:`, tkgdCols.map(c => `[${c.key}] ${c.header}`).join(', '));

  // 2. Tab 2: Danh sách ký quỹ TKTVKD
  console.log('\n📌 Đang quét Tab 2: Danh sách ký quỹ TKTVKD...');
  const tvkdTab = await page.$("xpath=//*[contains(text(), 'Danh sách ký quỹ TKTVKD')]");
  if (tvkdTab) await tvkdTab.click();
  await page.waitForTimeout(2000);
  const tvkdCols = await getHeaders();
  console.log(`✅ TVKD: ${tvkdCols.length} cột:`, tvkdCols.map(c => `[${c.key}] ${c.header}`).join(', '));

  await browser.close();

  // Cập nhật schema
  const schemaPath = path.resolve(__dirname, '../modules/ingress/coreccp/schemas/ag_grid_column_schemas.json');
  const clientSchemaPath = path.resolve(__dirname, '../../../coreccp-api-client/src/schemas/ag_grid_column_schemas.json');
  
  const schemas = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  schemas['MARGIN_MNG_TRANSACTION'] = {
    screenId: 'acctmargin_pos_tkgd',
    screenName: 'Quản lý ký quỹ TKGD (DSQLKQ TKGD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_POS',
    tab: 'Danh sách ký quỹ TKGD',
    expectedFileName: 'DSQLKQ TKGD.xlsx',
    totalColumns: tkgdCols.length,
    columns: tkgdCols,
  };
  schemas['MARGIN_MNG_MEMBER'] = {
    screenId: 'acctmargin_pos_tvkd',
    screenName: 'Quản lý ký quỹ TVKD (DSQLKQ TVKD.xlsx)',
    route: '/RISKMNG/ACCTMARGIN_POS',
    tab: 'Danh sách ký quỹ TKTVKD',
    expectedFileName: 'DSQLKQ TVKD.xlsx',
    totalColumns: tvkdCols.length,
    columns: tvkdCols,
  };

  // Bổ sung schema Modal Hợp đồng từ chính HTML Ground Truth mà USER cung cấp
  const contractCols = [
    { key: 'UACODE_EX', header: 'Mã hàng hóa tại sở' },
    { key: 'UACODE', header: 'Mã hàng hóa tại MXV' },
    { key: 'SYMBOL_EX', header: 'Mã hợp đồng tại sở' },
    { key: 'SYMBOL', header: 'Mã hợp đồng tại MXV' },
    { key: 'FULLNAME', header: 'Tên hợp đồng' },
    { key: 'EXPIRY_MONTH', header: 'Tháng đáo hạn' },
    { key: 'EXPIRY_YEAR', header: 'Năm đáo hạn' },
    { key: 'PRICE_RF', header: 'Giá thanh toán' },
    { key: 'PRICE_CE', header: 'Giá trần' },
    { key: 'PRICE_FL', header: 'Giá sàn' },
    { key: 'LISTEDDT', header: 'Ngày giao dịch đầu tiên' },
    { key: 'DELISTEDDT', header: 'Ngày giao dịch cuối cùng' },
    { key: 'F_NOTIDT', header: 'Ngày thông báo đầu tiên' },
    { key: 'L_NOTIDT', header: 'Ngày thông báo cuối cùng' },
    { key: 'HALT_DESC', header: 'Ngừng giao dịch' },
    { key: 'FINAL_SETTLEDT', header: 'Ngày thanh toán' },
    { key: 'F_DELIVERYDT', header: 'Ngày giao nhận đầu tiên' },
    { key: 'L_DELIVERYDT', header: 'Ngày giao nhận cuối cùng' },
    { key: 'L_REGDT', header: 'Ngày đăng ký giao nhận cuối cùng' },
    { key: 'F_REGDT', header: 'Ngày đăng ký giao nhận đầu tiên' },
    { key: 'FND_PREDT', header: 'Ngày phải thực hiện tất toán trước FND' },
    { key: 'LTD_PREDT', header: 'Ngày phải thực hiện tất toán trước LTD' },
    { key: 'BUY_NOTIDT', header: 'Ngày gửi thông báo vị thế mua' },
    { key: 'SELL_NOTIDT', header: 'Ngày gửi thông báo vị thế bán' },
    { key: 'LTD_PRELIMITDT', header: 'Ngày giới hạn trước LTD' },
    { key: 'STATUS_DESC', header: 'Trạng thái' },
    { key: 'APPRV_STS', header: 'Trạng thái duyệt' },
    { key: 'LOGTIME_DESC', header: 'Ngày tạo' },
    { key: 'LASTCHANGE_DESC', header: 'Ngày duyệt' },
  ];

  schemas['COMMODITY_CONTRACT'] = {
    screenId: 'commodity_contract_modal',
    screenName: 'Thông tin hợp đồng (Modal Hàng hóa - HĐ Nano)',
    route: '/PRODUCT/COMMODITY',
    tab: 'Thông tin hợp đồng',
    expectedFileName: 'HĐ CP2CO.xlsx',
    totalColumns: contractCols.length,
    columns: contractCols,
  };

  fs.writeFileSync(schemaPath, JSON.stringify(schemas, null, 2), 'utf8');
  if (fs.existsSync(path.dirname(clientSchemaPath))) {
    fs.writeFileSync(clientSchemaPath, JSON.stringify(schemas, null, 2), 'utf8');
  }
  console.log('🎉 ĐÃ CẬP NHẬT HOÀN TẤT SCHEMA 100% CHO CẢ 2 PHÂN HỆ!');
})();
