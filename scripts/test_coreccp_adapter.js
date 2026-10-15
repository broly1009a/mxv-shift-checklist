/**
 * test_ingress_coreccp.js
 * Script kiểm tra độc lập phân hệ CoreCcpApiAdapter tải báo cáo CoreCCP qua Direct Search REST API
 * Chạy lệnh: node src/scripts/test_ingress_coreccp.js
 */

const fs = require('fs');
const path = require('path');

async function testCoreCcpDownload() {
  console.log('========================================================');
  console.log('KIỂM TRA INGRESS ADAPTER: CORECCP (DIRECT REST API)');
  console.log('========================================================\n');

  const outDir = path.resolve(process.cwd(), 'temp', 'test_ingress', 'ccp');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const sessionPath = path.resolve(process.cwd(), 'temp', 'coreccp_session.json');
  console.log(`[1] Thư mục lưu file: ${outDir}`);
  console.log(`[2] Cache session: ${sessionPath}`);
  console.log(`[3] Danh sách báo cáo kiểm tra: GTT_CCP, DSGD_CCP, TTM_CCP, QL_TT_TKGD, HH\n`);

  console.log('👉 Hướng dẫn kiểm thử:');
  console.log('1. Khởi động backend: npm run start:dev');
  console.log('2. Bật cờ thử nghiệm trong MongoDB hoặc biến môi trường: INGRESS_MODE_CCP=REST_API');
  console.log('3. Trigger thử tải nguồn CCP qua API hoặc Job Ca trực.');
}

testCoreCcpDownload();
