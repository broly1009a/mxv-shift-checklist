/**
 * ============================================================================
 * RUN_DOWNLOAD_ALL_25.JS
 * ============================================================================
 * Tự động tải trọn gói toàn bộ 25 Báo cáo Maker CoreCCP vào thư mục output/.
 * Chạy trực tiếp:
 *   node scripts/run_download_all_25.js
 * ============================================================================
 */

const path = require('path');
const fs = require('fs');

// Import class CoreCcpClient từ dist hoặc trực tiếp require module
let CoreCcpClient;
try {
  ({ CoreCcpClient } = require('../dist/index'));
} catch {
  // Fallback nếu chưa compile typescript: dùng script test
  console.log('ℹ️ Bạn chưa compile typescript (`npm run build`). Chạy test nhanh qua scripts/test_quick_api.js');
}

const OUTPUT_DIR = path.resolve(__dirname, '..', 'output', 'daily_25_maker_reports');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function main() {
  if (!CoreCcpClient) {
    console.log('Vui lòng chạy `npm run build` trước khi chạy tải trọn gói 25 file qua Client Service.');
    return;
  }

  const client = new CoreCcpClient();
  console.log('Bắt đầu tải trọn gói 25 Báo cáo Maker...');

  const progress = await client.downloadAll25MakerReports({
    outputDirectory: OUTPUT_DIR,
    concurrency: 3,
    onProgress: (p) => {
      console.log(`Tiến độ: ${p.completed + p.failed}/${p.total} (Thành công: ${p.completed}, Thất bại: ${p.failed})`);
    }
  });

  console.log('\nTổng kết:');
  console.log(`- Thành công: ${progress.completed}/${progress.total}`);
  console.log(`- Thư mục lưu: ${OUTPUT_DIR}`);
}

if (CoreCcpClient) main().catch(console.error);
