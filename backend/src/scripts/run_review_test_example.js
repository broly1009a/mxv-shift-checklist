const fs = require('fs');
const path = require('path');
const { CcpLotStatisticsService } = require('../../dist/modules/ccp-statistics/ccp-lot-statistics.service');

async function runReviewTest() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull');
  const reviewOutputDir = path.join(baseDir, 'review_output');
  const templateDir = path.join(__dirname, '..', '..', '..', 'Thong ke ccp', 'output');

  // 1. Tạo thư mục review_output
  if (!fs.existsSync(reviewOutputDir)) {
    fs.mkdirSync(reviewOutputDir, { recursive: true });
  }

  // 2. Copy tất cả template files sang review_output
  const templateFiles = fs.readdirSync(templateDir).filter(f => f.endsWith('.xlsx'));
  for (const file of templateFiles) {
    fs.copyFileSync(path.join(templateDir, file), path.join(reviewOutputDir, file));
    console.log(`[COPY TEMPLATE] ${file} -> review_output/`);
  }

  // 3. Đọc dữ liệu đầu vào
  const dsgdBuf = fs.readFileSync(path.join(baseDir, 'Input_DSGD_1.xlsx'));
  const ttmBuf = fs.readFileSync(path.join(baseDir, 'Input_TTM_1.xlsx'));
  const ttttBuf = fs.readFileSync(path.join(baseDir, 'Input_TTTT_1.xlsx'));

  // 4. Khởi tạo service
  const service = new CcpLotStatisticsService(null, null);

  const testDate = new Date('2026-09-17');
  console.log(`\n=== BẮT ĐẦU CHẠY THỐNG KÊ CCP CHO NGÀY: ${testDate.toISOString().slice(0, 10)} ===`);

  const jobLogs = [];
  const result = await service.processCcpLotStatistics(
    { dsgdCcp: dsgdBuf, ttm: ttmBuf, tttt: ttttBuf },
    { ngayGD: testDate },
    jobLogs,
  );

  console.log('\n--- KẾT QUẢ TỔNG HỢP ---');
  console.log(`Tổng số Lot: ${result.totalSoLot}`);
  console.log(`Tổng GTGD: ${result.totalGiaTri.toLocaleString('vi-VN')} VND`);
  console.log(`ACM Lot (-A): ${result.acmLot}`);
  console.log(`Spread Lot (-S): ${result.spreadLot}`);
  console.log(`LME Lot (-L): ${result.lmeLot}`);
  console.log(`Normal Lot (-F): ${result.normalLot}`);

  // 5. Cấu hình đường dẫn ghi lũy kế trong review_output
  const paths = {
    pathAcmLot: path.join(reviewOutputDir, 'Thong ke so lot giao dich ACM 2026.xlsx'),
    pathAcmGtgd: path.join(reviewOutputDir, 'Thong ke gia tri giao dich ACM 2026.xlsx'),
    pathNormalLot: path.join(reviewOutputDir, 'Thong ke so lot giao dich 2026.xlsx'),
    pathGtgdNormal: path.join(reviewOutputDir, 'Thong ke gia tri giao dich 2026.xlsx'),
    pathSpreadLot: path.join(reviewOutputDir, 'Thong ke so lot giao dich Spread 2026.xlsx'),
    pathGtgdSpread: path.join(reviewOutputDir, 'Thong ke gia tri giao dich Spread 2026.xlsx'),
    pathLmeLot: path.join(reviewOutputDir, 'Thong ke so lot giao dich LME 2026.xlsx'),
    pathGtgdLme: path.join(reviewOutputDir, 'Thong ke gia tri giao dich LME 2026.xlsx'),
    pathDsgdCumulative: path.join(reviewOutputDir, 'DSGD T09.2026 CCP.xlsx'),
  };

  console.log('\n=== TIẾN HÀNH GHI VÀO CÁC FILE LŨY KẾ TRONG review_output/ ===');
  const writeRes = await service.writeToAccumulator(result, paths, dsgdBuf, jobLogs);

  console.log('\n--- KẾT QUẢ GHI ACCUMULATOR ---');
  console.log(`Lot Updated: ${writeRes.lotUpdated}`);
  console.log(`GTGD Updated: ${writeRes.gtgdUpdated}`);
  console.log(`Errors count: ${writeRes.errors.length}`);
  if (writeRes.errors.length > 0) {
    console.log('Errors:', writeRes.errors);
  }

  console.log('\n--- JOB LOGS ---');
  jobLogs.forEach(l => console.log(l));
}

runReviewTest().catch(err => {
  console.error('Fatal Error:', err);
});
