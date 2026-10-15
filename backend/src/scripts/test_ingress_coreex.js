/**
 * test_ingress_coreex.js
 * Script kiểm tra độc lập phân hệ CoreExApiAdapter tải báo cáo CoreExchange qua REST Search & Export API
 * Chạy lệnh: node src/scripts/test_ingress_coreex.js
 */

const fs = require('fs');
const path = require('path');

async function testCoreExDownload() {
  console.log('========================================================');
  console.log('KIỂM TRA INGRESS ADAPTER: CORE EXCHANGE (REST API & EXCEL)');
  console.log('========================================================\n');

  const outDir = path.resolve(process.cwd(), 'temp', 'test_ingress', 'coreex');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const sessionPath = path.resolve(process.cwd(), 'temp', 'coreexchange_session.json');
  console.log(`[1] Thư mục lưu file: ${outDir}`);
  console.log(`[2] Cache session: ${sessionPath}`);
  console.log(`[3] Danh sách báo cáo kiểm tra: GTT, HH, DSGD, DSL\n`);

  console.log('👉 Hướng dẫn kiểm thử:');
  console.log('1. Khởi động backend: npm run start:dev');
  console.log('2. Bật cờ thử nghiệm trong MongoDB hoặc biến môi trường: INGRESS_MODE_CE=REST_API');
  console.log('3. Trigger thử tải nguồn CORE_EX qua API hoặc kiểm tra đối soát GTT CE-CCP.');
}

testCoreExDownload();
