/**
 * ============================================================================
 * FAST_SCAN_CCP_APIS.JS (ZERO DEPENDENCY - NATIVE NODE.JS HTTPS)
 * ============================================================================
 * Tự động gửi request trực tiếp đến CoreCCP Gateway để kiểm tra:
 * 1. Màn hình nào có Search REST API (/ccp/inquiry/maintain/{CODE}/search/{CODE})?
 * 2. Màn hình nào hỗ trợ Server-Side Export (/ccp/export/create)?
 * 3. Màn hình nào chỉ xuất được qua Client-Side (FE)?
 * ============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Token và Session từ cURL của User (có hạn tới cuối ngày)
const TOKEN = 'eyJraWQiOiJhNGJmOTI0YS0yMzY2LTQ3OTctYTFlYy04OWZkZWU4ZGNiNTkiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJoaWVwdHJ1b25nIiwiYXVkIjoid2ViLWNjcC1teHYiLCJuYmYiOjE3OTE4ODAzMjUsInVzZXJfaWQiOjIxMywic2NvcGUiOlsib3BlbmlkIiwicHJvZmlsZSJdLCJpc3MiOiJodHRwczovL3VhdC1jb3JlY2NwLm14di5jb20udm4iLCJleHAiOjE3OTE4OTExMjUsImlhdCI6MTc5MTg4MDMyNSwianRpIjoiZjA3MjMwZWEtOTZhNC00MGY1LTg1ZDUtMzYzYmM5YmQ0NDU4In0.E7zlAqEhTsEGSMX3bvc_FsjtRbpEzvD3qjE_XdRO3ruhpczFlrG8sAOFiqeBjUzCWQy8CfYYjO2ml1dceTunfo-KnXVanRFqway00nUF7NWwFxo_ZPu58LZay-p7q288oY5n8ICtu6t3GTZ2BMQST8RgrVrVGvRWzjtRtGdTFRuDsj06ylq2mMQAovGP-AemClqK9Vvka6vRxggadCCvAT-oSDv1ugiRWYyvr5cYDMj-pF220QjkveswbtQxhln2Cz3NOEFFx8PU0GkJio4IEBauuCO77Ucr1HzTndE6Y25_JW3qxsNTfux5IZ1QWgpGg-509npYLPrpjwJbfIiCYQ';
const SESSION = 'ZmZjMWM1YTItMTFkYS00MTVjLTkyMDUtZmMyNTEwZWY0OTM1';

const MODULES = [
  { code: 'ORDERBOOK', name: 'Danh sách lệnh (DSL)', group: 'Lệnh và vị thế', route: '/ORDERS/ORDERBOOK' },
  { code: 'ORDERMATCH_DETAIL', name: 'Lịch sử giao dịch chi tiết (DSGD)', group: 'Lệnh và vị thế', route: '/ORDERS/ORDERMATCH_DETAIL' },
  { code: 'ORDERMATCH_ALL', name: 'Lịch sử giao dịch gộp', group: 'Lệnh và vị thế', route: '/ORDERS/ORDERMATCH_ALL' },
  { code: 'OPEN_POSITION', name: 'Trạng thái mở (TTM)', group: 'Lệnh và vị thế', route: '/ORDERS/OPEN_POSITION' },
  { code: 'PNL_EXECUTED', name: 'Trạng thái tất toán (TTTT)', group: 'Lệnh và vị thế', route: '/ORDERS/PNL_EXECUTED' },
  { code: 'ORDERBOOK_MM', name: 'Danh sách lệnh MM', group: 'Lệnh và vị thế', route: '/ORDERS/ORDERBOOK_MM' },
  { code: 'ORDERBOOK_ALL_MM', name: 'Lịch sử lệnh MM', group: 'Lệnh và vị thế', route: '/ORDERS/ORDERBOOK_ALL_MM' },
  { code: 'CASHTRANFER_HIST', name: 'Lịch sử Nộp/ Rút tiền (NR)', group: 'Nộp rút tiền', route: '/CASHTRANFER/CASHTRANFER_HIST' },
  { code: 'ACCOUNTS_INFO', name: 'Danh sách tài khoản (DSTKGD)', group: 'Quản lý tài khoản', route: '/ACCOUNTMNG/ACCOUNTS_INFO' },
  { code: 'ACCTMARGIN_ALL', name: 'Quản lý trạng thái TKGD (Ký quỹ)', group: 'Quản lý rủi ro', route: '/RISKMNG/ACCTMARGIN_ALL' },
  { code: 'MARGIN_MNG', name: 'Quản lý ký quỹ TKGD', group: 'Quản lý rủi ro', route: '/RISKMNG/MARGIN_MNG' },
  { code: 'SETTLEMENT', name: 'Quản lý giá thanh toán (GTT)', group: 'Quản lý sản phẩm', route: '/PRODUCT/SETTLEMENT' },
  { code: 'SETTLEMENT_HIST', name: 'Lịch sử giá thanh toán', group: 'Quản lý sản phẩm', route: '/PRODUCT/SETTLEMENT_HIST' },
  { code: 'COMMODITY', name: 'Quản lý hàng hóa, hợp đồng (HH)', group: 'Quản lý sản phẩm', route: '/PRODUCT/COMMODITY' },
  { code: 'FCM_INFORMATION', name: 'Danh sách FCM', group: 'Quản lý FCM', route: '/FCMMNG/FCM_INFORMATION' },
  { code: 'TLPROFILES', name: 'Người sử dụng', group: 'Người dùng và phân quyền', route: '/USERMNG/TLPROFILES' },
  { code: 'CURRENCYEXCHANGERATE', name: 'Tỷ giá nguyên tệ', group: 'Tham số hệ thống', route: '/SYSCONFIGMNG/CURRENCYEXCHANGERATE' },
];

function makeRequest(apiPath, postData, referer) {
  return new Promise((resolve) => {
    const dataStr = postData ? JSON.stringify(postData) : '';
    const options = {
      hostname: 'uat-coreccp.mxv.com.vn',
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        'Accept': 'application/json, text/plain, */*',
        'Authorization': `Bearer ${TOKEN}`,
        'connectkey': 'fsscssiam2021',
        'Cookie': `SESSION=${SESSION}`,
        'Origin': 'https://uat-coreccp.mxv.com.vn',
        'Referer': `https://uat-coreccp.mxv.com.vn${referer}`,
        'x-devicetype': 'WEB',
        'x-lang': 'vi',
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => resolve({ error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'Timeout' }); });
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function main() {
  console.log('\n========================================================================');
  console.log('   QUÉT TOÀN DIỆN CƠ CHẾ API & EXPORT TRÊN TOÀN BỘ MÀN HÌNH CORECCP');
  console.log('========================================================================\n');

  const results = [];

  for (let i = 0; i < MODULES.length; i++) {
    const mod = MODULES[i];
    console.log(`[${i + 1}/${MODULES.length}] Đang kiểm tra module: ${mod.code} (${mod.name})...`);

    const itemResult = {
      code: mod.code,
      name: mod.name,
      group: mod.group,
      route: mod.route,
      searchApi: {
        endpoint: `/ccp/inquiry/maintain/${mod.code}/search/${mod.code}`,
        supported: false,
        totalCount: null,
        sampleKeys: [],
      },
      serverSideExport: {
        endpoint: '/ccp/export/create',
        supported: false,
        code: null,
      },
      clientSideExport: false,
      recommendedMechanism: '',
    };

    // 1. Thử Search API
    const searchPayload = {
      searchcode: mod.code,
      page: { pageIndex: 1, pageSize: 2 },
    };
    const searchRes = await makeRequest(itemResult.searchApi.endpoint, searchPayload, mod.route);

    if (searchRes.status === 200 && searchRes.data) {
      itemResult.searchApi.supported = true;
      const payload = searchRes.data.payload || searchRes.data;
      if (Array.isArray(payload) && payload.length > 0) {
        itemResult.searchApi.sampleKeys = Object.keys(payload[0]).slice(0, 8);
      } else if (payload && Array.isArray(payload.data) && payload.data.length > 0) {
        itemResult.searchApi.sampleKeys = Object.keys(payload.data[0]).slice(0, 8);
      }
      if (searchRes.data.page && searchRes.data.page.totalCount !== undefined) {
        itemResult.searchApi.totalCount = searchRes.data.page.totalCount;
      }
      console.log(`  ✓ Search REST API: HOẠT ĐỘNG (Records: ${itemResult.searchApi.totalCount ?? 'N/A'})`);
    } else {
      console.log(`  ✗ Search REST API: Không khả dụng (Status: ${searchRes.status || searchRes.error})`);
    }

    // 2. Thử Server-Side Export API (/ccp/export/create)
    const exportPayload = {
      searchcode: mod.code,
      search: {},
      filter: {},
      orderBy: {},
      page: { pageIndex: 1, pageSize: 20 },
      exptype: 'XLSX',
      fekey: `${mod.code}_${Date.now()}`,
    };
    const exportRes = await makeRequest('/ccp/export/create', exportPayload, mod.route);

    if (exportRes.status === 200 && exportRes.data && exportRes.data.success) {
      itemResult.serverSideExport.supported = true;
      itemResult.serverSideExport.code = exportRes.data.code;
      console.log(`  ✓ Server-Side Export (/ccp/export/create): ĐƯỢC HỖ TRỢ (Response 200 OK)`);
    } else {
      itemResult.clientSideExport = true;
      console.log(`  ℹ️ Server-Side Export: Không hỗ trợ -> Trang này dùng Client-Side FE hoặc Modal`);
    }

    // Kết luận cơ chế tối ưu
    if (itemResult.serverSideExport.supported && itemResult.searchApi.supported) {
      itemResult.recommendedMechanism = 'HYBRID (API JSON siêu tốc & Server-Side XLSX)';
    } else if (itemResult.serverSideExport.supported) {
      itemResult.recommendedMechanism = 'SERVER_SIDE_EXPORT (Tải .XLSX qua /export/create)';
    } else if (itemResult.searchApi.supported) {
      itemResult.recommendedMechanism = 'DIRECT_REST_API (Lấy JSON qua Search API)';
    } else {
      itemResult.recommendedMechanism = 'CLIENT_SIDE_UI (Cần trình duyệt cào DOM / Modal)';
    }

    results.push(itemResult);
    // Nghỉ nhẹ 100ms
    await new Promise((r) => setTimeout(r, 100));
  }

  // 3. Xuất file báo cáo Markdown & JSON
  const outputDir = path.resolve(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const jsonPath = path.join(outputDir, 'audit_ccp_export_mechanisms.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');

  const mdPath = path.join(outputDir, 'audit_ccp_export_mechanisms.md');
  let md = `# BÁO CÁO TOÀN DIỆN: CƠ CHẾ TẢI FILE & REST API CỦA HỆ THỐNG CORECCP\n\n`;
  md += `> Thời điểm quét thực tế: ${new Date().toLocaleString('vi-VN')} | Môi trường: \`uat-coreccp.mxv.com.vn\`\n\n`;
  md += `## 1. Bảng Tổng Hợp Phân Loại Cơ Chế Từng Trang\n\n`;
  md += `| STT | Mã Module | Tên Màn Hình Nghiệp Vụ | URL Route | Server Export (/export/create)? | Search API (JSON)? | Tổng Bản Ghi Hiện Tại | Cơ Chế Đề Xuất Cho Bot |\n`;
  md += `| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- |\n`;

  results.forEach((r, idx) => {
    const srv = r.serverSideExport.supported ? ' Có (XLSX)' : '❌';
    const api = r.searchApi.supported ? ' Có (REST)' : '❌';
    const cnt = r.searchApi.totalCount !== null ? `**${r.searchApi.totalCount}**` : '-';
    md += `| ${idx + 1} | \`${r.code}\` | **${r.name}** | \`${r.route}\` | ${srv} | ${api} | ${cnt} | \`${r.recommendedMechanism}\` |\n`;
  });

  md += `\n---\n\n## 2. Chi Tiết Cấu Trúc Các Trường Của Search API\n\n`;
  results.filter(r => r.searchApi.supported).forEach((r) => {
    md += `### • [${r.code}] ${r.name}\n`;
    md += `- **Endpoint**: \`${r.searchApi.endpoint}\`\n`;
    md += `- **Route Giao Diện**: \`${r.route}\`\n`;
    if (r.searchApi.sampleKeys.length > 0) {
      md += `- **Các trường dữ liệu mẫu**: \`${r.searchApi.sampleKeys.join(', ')}\`\n`;
    }
    md += `\n`;
  });

  fs.writeFileSync(mdPath, md, 'utf-8');

  console.log('\n========================================================================');
  console.log('   HOÀN THÀNH QUÉT 100% CÁC TRANG CORECCP THÀNH CÔNG');
  console.log('========================================================================');
  console.log(`  ✓ Đã ghi kết quả JSON:     ${jsonPath}`);
  console.log(`  ✓ Đã ghi báo cáo Markdown: ${mdPath}\n`);
}

main().catch(console.error);
