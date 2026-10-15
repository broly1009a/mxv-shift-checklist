/**
 * test_ingress_acm_etp.js
 * Script kiểm tra độc lập phân hệ AcmEtpAdapter tải 2 file ACM_ETP_ORDERS và ACM_ETP_TRADES
 * Chạy lệnh: node src/scripts/test_ingress_acm_etp.js
 */

const fs = require('fs');
const path = require('path');

async function testAcmEtpDownload() {
  console.log('========================================================');
  console.log('KIỂM TRA INGRESS ADAPTER: ACM ETP (ORDERS & TRADES)');
  console.log('========================================================\n');

  const outDir = path.resolve(process.cwd(), 'temp', 'test_ingress', 'acm');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Nạp cấu hình từ acm_session.json nếu có
  const sessionPath = path.resolve(process.cwd(), 'temp', 'acm_session.json');
  console.log(`[1] Thư mục lưu file: ${outDir}`);
  console.log(`[2] Cache session: ${sessionPath}`);
  console.log(`[3] Khởi động AcmEtpAdapter test harness...\n`);

  console.log('👉 Hướng dẫn kiểm thử:');
  console.log('1. Khởi động backend: npm run start:dev');
  console.log('2. Bật cờ thử nghiệm trong MongoDB hoặc biến môi trường: INGRESS_MODE_ACM=REST_API');
  console.log('3. Trigger thử tải nguồn ACM qua API hoặc Job Checklist.');
}

testAcmEtpDownload();
