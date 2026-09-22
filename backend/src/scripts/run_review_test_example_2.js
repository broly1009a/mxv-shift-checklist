const fs = require('fs');
const path = require('path');
const { CcpLotStatisticsService } = require('../../dist/modules/ccp-statistics/ccp-lot-statistics.service');

async function runReviewTest2() {
  const baseDir = path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull_2');
  const reviewOutputDir = path.join(baseDir, 'review_output');
  const templateDir = path.join(__dirname, '..', '..', '..', 'Thong ke ccp', 'output');

  console.log('================================================================');
  console.log('CHẠY THỐNG KÊ CCP VỚI DỮ LIỆU MỚI: inputExampleCppFull_2');
  console.log('================================================================');

  // 1. Tạo thư mục review_output trong inputExampleCppFull_2
  if (!fs.existsSync(reviewOutputDir)) {
    fs.mkdirSync(reviewOutputDir, { recursive: true });
  }

  // 2. Copy tất cả template files gốc sang review_output
  const templateFiles = fs.readdirSync(templateDir).filter(f => f.endsWith('.xlsx'));
  for (const file of templateFiles) {
    fs.copyFileSync(path.join(templateDir, file), path.join(reviewOutputDir, file));
    console.log(`[COPY TEMPLATE] ${file} -> review_output/`);
  }

  // 3. Đọc dữ liệu đầu vào Input_2
  const dsgdBuf = fs.readFileSync(path.join(baseDir, 'Input_DSGD_2.xlsx'));
  const ttmBuf = fs.readFileSync(path.join(baseDir, 'Input_TTM_2.xlsx'));
  const ttttBuf = fs.readFileSync(path.join(baseDir, 'Input_TTTT_2.xlsx'));

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

  console.log('\n--- KẾT QUẢ TỔNG HỢP (INPUT EXAMPLE 2) ---');
  console.log(`Tổng số Lot: ${result.totalSoLot}`);
  console.log(`Tổng GTGD: ${result.totalGiaTri.toLocaleString('vi-VN')} VND`);
  console.log(`ACM Lot (-A): ${result.acmLot}`);
  console.log(`Spread Lot (-S): ${result.spreadLot}`);
  console.log(`LME Lot (-L): ${result.lmeLot}`);
  console.log(`Normal Lot (-F): ${result.normalLot}`);

  console.log('\n--- CHI TIẾT THEO COMMODITY (HÀNG HÓA) ---');
  if (result.byCommodity) {
    const commKeys = Object.keys(result.byCommodity);
    console.log(`Số lượng mã hàng hóa phát sinh: ${commKeys.length}`);
    for (const k of commKeys) {
      const c = result.byCommodity[k];
      console.log(`  - ${k.padEnd(8)}: Lot=${String(c.soLot).padStart(4)} | GTGD=${c.giaTri.toLocaleString('vi-VN').padStart(18)} VND | TVKD=${Object.keys(c.byTv || {}).length} TV`);
    }
  }

  console.log('\n--- CHI TIẾT THEO TVKD (THÀNH VIÊN KINH DOANH) ---');
  if (result.byTv) {
    const tvKeys = Object.keys(result.byTv).sort();
    console.log(`Số lượng TVKD giao dịch: ${tvKeys.length}`);
    for (const tv of tvKeys) {
      const t = result.byTv[tv];
      console.log(`  - TV ${String(tv).padStart(4)}: Lot=${String(t.soLot).padStart(4)} | GTGD=${t.giaTri.toLocaleString('vi-VN').padStart(18)} VND`);
    }
  }

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
    pathOptionsLot: path.join(reviewOutputDir, 'Thong ke so lot giao dich Options 2026.xlsx'),
    pathOptionsGtgd: path.join(reviewOutputDir, 'Thong ke gia tri giao dich Options 2026.xlsx'),
    pathDsgdCumulative: path.join(reviewOutputDir, 'DSGD T09.2026 CCP.xlsx'),
  };

  console.log('\n=== TIẾN HÀNH GHI VÀO CÁC FILE LŨY KẾ TRONG inputExampleCppFull_2/review_output/ ===');
  const writeRes = await service.writeToAccumulator(result, paths, dsgdBuf, jobLogs);

  console.log('\n--- KẾT QUẢ GHI ACCUMULATOR ---');
  console.log(`Lot Updated: ${writeRes.lotUpdated}`);
  console.log(`GTGD Updated: ${writeRes.gtgdUpdated}`);
  console.log(`Errors count: ${writeRes.errors.length}`);
  if (writeRes.errors.length > 0) {
    console.log('Errors:', writeRes.errors);
  }

  console.log('\n--- SO SÁNH NHANH GIỮA INPUT 1 (CŨ) VÀ INPUT 2 (MỚI) ---');
  // Đọc kết quả input 1 nếu có
  try {
    const dsgd1Buf = fs.readFileSync(path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'Input_DSGD_1.xlsx'));
    const ttm1Buf = fs.readFileSync(path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'Input_TTM_1.xlsx'));
    const tttt1Buf = fs.readFileSync(path.join(__dirname, '..', 'modules', 'ccp-statistics', 'inputExampleCppFull', 'Input_TTTT_1.xlsx'));
    const res1 = await service.processCcpLotStatistics(
      { dsgdCcp: dsgd1Buf, ttm: ttm1Buf, tttt: tttt1Buf },
      { ngayGD: testDate },
      [],
    );
    console.log(`- INPUT 1 (Cũ): Tổng Lot = ${res1.totalSoLot}, Tổng GTGD = ${res1.totalGiaTri.toLocaleString('vi-VN')} VND (ACM Lot: ${res1.acmLot})`);
    console.log(`- INPUT 2 (Mới): Tổng Lot = ${result.totalSoLot}, Tổng GTGD = ${result.totalGiaTri.toLocaleString('vi-VN')} VND (ACM Lot: ${result.acmLot})`);
    console.log(`=> Chênh lệch: Delta Lot = ${result.totalSoLot - res1.totalSoLot}, Delta GTGD = ${(result.totalGiaTri - res1.totalGiaTri).toLocaleString('vi-VN')} VND`);
  } catch (e) {
    console.log('Không thể so sánh với Input 1:', e.message);
  }

  console.log('\n--- DANH SÁCH FILE KẾT XUẤT ĐÃ CẬP NHẬT TRONG inputExampleCppFull_2/review_output ---');
  const outFiles = fs.readdirSync(reviewOutputDir).filter(f => f.endsWith('.xlsx'));
  for (const f of outFiles) {
    const st = fs.statSync(path.join(reviewOutputDir, f));
    console.log(`  - ${f} (${st.size} bytes)`);
  }
}

runReviewTest2().catch(err => {
  console.error('Fatal Error:', err);
});
