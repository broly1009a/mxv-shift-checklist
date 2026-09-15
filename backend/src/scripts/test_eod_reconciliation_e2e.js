/**
 * TEST SCRIPT E2E ĐỐI CHIẾU SỐ DƯ EOD SONG SONG M-SYSTEM & CORECCP
 * Công thức: Số dư EOD = Đầu ngày + Nộp rút - Phí GD + Lãi lỗ thực tế - Phí DVTT
 *
 * Cách chạy:
 *   node backend/src/scripts/test_eod_reconciliation_e2e.js
 */

const XLSX = require('xlsx');

// Mock helper function tương tự ReconciliationService.findHeaderIndex
function findHeaderIndex(headers, target, aliases = []) {
  const normalize = (str) => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  const normTarget = normalize(target);
  const normAliases = aliases.map((a) => normalize(a));
  return headers.findIndex((h) => {
    const normH = normalize(h);
    return normH === normTarget || normAliases.includes(normH);
  });
}

// 1. Tạo buffer Excel giả lập cho M-System
function createMockMsFiles() {
  // QLTKGD MS
  const qltkgdData = [
    ['STT', 'Mã TKGD', 'Số dư TKKQ đầu ngày', 'Nộp rút trong phiên', 'Phí giao dịch', 'Phí quyền chọn', 'Lãi lỗ thực tế Futures (VND)', 'Số dư TKKQ hiện tại'],
    [1, '001C0120001', 10000000, 5000000, 200000, 0, 1500000, 16250000], // Khớp (Tính ra 16,250,000 trừ phí TTTT 50k)
    [2, '001C0120002', 20000000, 2000000, 300000, 0, -1000000, 20620000], // Sẽ lệch với EOD
    [3, '001C0120005', 1000000, 0, 500000, 0, -6000000, -5500000], // Tài khoản âm số dư
  ];
  const qSheet = XLSX.utils.aoa_to_sheet(qltkgdData);
  const qWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(qWb, qSheet, 'QLTKGD');
  const qltkgdBuffer = XLSX.write(qWb, { type: 'buffer', bookType: 'xlsx' });

  // TTTT MS (Phí DVTT: 001C0120001 có 2 dòng ghép lệnh: 30k + 20k = 50k)
  const ttttData = [
    ['STT', 'Mã TKGD', 'Mã HĐ', 'KL Mua', 'KL Bán', 'Phí dịch vụ thanh toán (VND)'],
    [1, '001C0120001', 'LRCU26', 1, 1, 30000],
    [2, '001C0120001', 'LRCU26', 1, 1, 20000],
    [3, '001C0120002', 'LRCU26', 2, 2, 80000],
  ];
  const tSheet = XLSX.utils.aoa_to_sheet(ttttData);
  const tWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(tWb, tSheet, 'TTTT');
  const ttttBuffer = XLSX.write(tWb, { type: 'buffer', bookType: 'xlsx' });

  // EOD CSV MS
  const eodData = [
    ['InvestorCode', 'eodBalance', 'InitialRequiredMargin', 'AvailableMargin', 'AdditionalMargin', 'NetMargin'],
    ['001C0120001', 16250000, 5000000, 10000000, 0, 10000000], // Khớp hoàn toàn với (10tr + 5tr - 200k + 1.5tr - 50k)
    ['001C0120002', 25000000, 5000000, 10000000, 0, 10000000], // Cố tình lệch: EOD 25tr vs Tính toán 20.62tr (Lệch 4.38tr)
    ['001C0120005', -5500000, 0, -2000000, 2000000, -2000000], // Âm ký quỹ IMR
  ];
  const eSheet = XLSX.utils.aoa_to_sheet(eodData);
  const eWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(eWb, eSheet, 'EOD');
  const eodBuffer = XLSX.write(eWb, { type: 'buffer', bookType: 'csv' });

  return { qltkgdBuffer, ttttBuffer, eodBuffer };
}

// 2. Tạo buffer Excel giả lập cho CoreCCP
function createMockCcpFiles() {
  // QLTTTKGD CCP
  const qltkgdCcpData = [
    ['STT', 'Mã TKGD', 'Số dư TKKQ đầu ngày', 'Nộp rút trong phiên', 'Phí giao dịch', 'Lãi lỗ thực tế (VND)', 'Số dư TKKQ hiện tại'],
    [1, '003C1570001', 50000000, 10000000, 500000, -2000000, 57400000], // Khớp (50tr + 10tr - 500k - 2tr - 100k phí TTTT = 57.4tr)
    [2, '003C1570002', 30000000, 5000000, 400000, 1000000, 35500000], // Sẽ lệch với EOD CCP
  ];
  const qSheet = XLSX.utils.aoa_to_sheet(qltkgdCcpData);
  const qWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(qWb, qSheet, 'QLTTTKGD_CCP');
  const qltkgdCcpBuffer = XLSX.write(qWb, { type: 'buffer', bookType: 'xlsx' });

  // TTTT CCP (Phí DVTT: 003C1570001 có phí 100,000 VND)
  const ttttCcpData = [
    ['STT', 'Mã TKGD', 'Mã HĐ', 'Phí dịch vụ thanh toán (VND)'],
    [1, '003C1570001', 'ZCE_CF', 100000],
    [2, '003C1570002', 'ZCE_CF', 100000],
  ];
  const tSheet = XLSX.utils.aoa_to_sheet(ttttCcpData);
  const tWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(tWb, tSheet, 'TTTT_CCP');
  const ttttCcpBuffer = XLSX.write(tWb, { type: 'buffer', bookType: 'xlsx' });

  // EOD CSV CCP
  const eodCcpData = [
    ['InvestorCode', 'eodBalance', 'InitialRequiredMargin', 'AvailableMargin', 'AdditionalMargin'],
    ['003C1570001', 57400000, 10000000, 47400000, 0], // Khớp tuyệt đối: 57,400,000
    ['003C1570002', 38000000, 10000000, 25500000, 0], // Cố tình lệch: EOD 38tr vs Tính toán 35.5tr (Lệch 2.5tr)
  ];
  const eSheet = XLSX.utils.aoa_to_sheet(eodCcpData);
  const eWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(eWb, eSheet, 'EOD_CCP');
  const eodCcpBuffer = XLSX.write(eWb, { type: 'buffer', bookType: 'csv' });

  return { qltkgdCcpBuffer, ttttCcpBuffer, eodCcpBuffer };
}

// 3. Thực thi kiểm tra E2E
async function runE2ETest() {
  console.log('\n========================================================================');
  console.log('   KIỂM THỬ END-TO-END: ĐỐI CHIẾU EOD SONG SONG M-SYSTEM & CORECCP');
  console.log('========================================================================\n');

  console.log('[1/3] Đang khởi tạo dữ liệu mẫu In-Memory cho cả 2 phân hệ...');
  const ms = createMockMsFiles();
  const ccp = createMockCcpFiles();
  console.log('  ✓ Đã sinh file MS: QLTKGD.xlsx, TTTT.xlsx, eod.csv');
  console.log('  ✓ Đã sinh file CCP: QLTTTKGD_CCP.xlsx, TTTT_CCP.xlsx, eod_CCP.csv\n');

  console.log('[2/3] Nạp Service đối chiếu thực tế từ backend...');
  const { ReconciliationService } = require('../../dist/modules/reconciliation/reconciliation.service');

  // Khởi tạo instance với mock dependencies tối thiểu
  const service = new ReconciliationService(
    {}, // shiftLogModel
    {}, // botJobModel
    {}, // settingsService
    { sendMessage: () => Promise.resolve() }, // telegramService
    { loadConfig: () => Promise.resolve({}), sendEmailNotification: () => Promise.resolve({ success: true }) }, // marginCheckerService
    {}, // teamsNotifierService
    { getLatestEmail: () => Promise.resolve(null) }, // emailWatcherService
    {}, // botJobQueueService
    {}  // shiftsService
  );

  // Mock getCurrentExchangeRates
  service.getCurrentExchangeRates = async () => ({
    usdLoss: 25920, usdGain: 25920,
    jpyLoss: 170, jpyGain: 170,
    myrLoss: 6383, myrGain: 6383,
  });

  console.log('[3/3] Kích hoạt hàm checkEOD() chạy song song MS & CCP...\n');
  const result = await service.checkEOD({
    qltkgd: ms.qltkgdBuffer,
    eod: ms.eodBuffer,
    tttt: ms.ttttBuffer,
    qltkgdCcp: ccp.qltkgdCcpBuffer,
    eodCcp: ccp.eodCcpBuffer,
    ttttCcp: ccp.ttttCcpBuffer,
  });

  console.log('------------------------------------------------------------------------');
  console.log('                       KẾT QUẢ ĐỐI CHIẾU CHI TIẾT                       ');
  console.log('------------------------------------------------------------------------');
  console.log(`• Tài khoản âm số dư hiện tại: ${result.negativeBalanceAccs.length} (${result.negativeBalanceAccs.join(', ') || 'Không có'})`);
  console.log(`• Tài khoản âm ký quỹ IMR:     ${result.negativeIMRAcc.length} (${result.negativeIMRAcc.join(', ') || 'Không có'})`);
  console.log(`• Số tài khoản lệch công thức:  ${result.mismatchedEOD.length}\n`);

  console.log('Bảng Danh Sách Tài Khoản Lệch Công Thức EOD:');
  console.table(
    result.mismatchedEOD.map((m) => ({
      'Hệ thống': m.system ? `[${m.system}]` : '[MS]',
      'Mã TKGD': m.maTKGD,
      'Số dư Tính toán': m.calculatedBalance.toLocaleString() + ' đ',
      'Số dư EOD Thực tế': m.eodBalance.toLocaleString() + ' đ',
      'Độ lệch': m.differ.toLocaleString() + ' đ',
    }))
  );

  console.log('\n------------------------------------------------------------------------');
  console.log('                       ĐÁNH GIÁ KẾT QUẢ KIỂM THỬ                        ');
  console.log('------------------------------------------------------------------------');
  const msMatched = !result.mismatchedEOD.some((m) => m.maTKGD === '001C0120001');
  const msDetectedError = result.mismatchedEOD.some((m) => m.maTKGD === '001C0120002' && m.system === 'MS');
  const ccpMatched = !result.mismatchedEOD.some((m) => m.maTKGD === '003C1570001');
  const ccpDetectedError = result.mismatchedEOD.some((m) => m.maTKGD === '003C1570002' && m.system === 'CCP');
  const negativeDetected = result.negativeBalanceAccs.includes('001C0120005');

  console.log(`1. Tài khoản MS khớp (001C0120001):          ${msMatched ? ' PASS (Khớp 0đ chênh lệch)' : ' FAIL'}`);
  console.log(`2. Bắt đúng tài khoản MS lệch (001C0120002):  ${msDetectedError ? ' PASS (Gắn nhãn [MS] chính xác)' : ' FAIL'}`);
  console.log(`3. Tài khoản CCP khớp (003C1570001):         ${ccpMatched ? ' PASS (Khớp 0đ chênh lệch)' : ' FAIL'}`);
  console.log(`4. Bắt đúng tài khoản CCP lệch (003C1570002): ${ccpDetectedError ? ' PASS (Gắn nhãn [CCP] chính xác)' : ' FAIL'}`);
  console.log(`5. Phát hiện tài khoản âm số dư (001C0120005): ${negativeDetected ? ' PASS' : ' FAIL'}`);

  if (msMatched && msDetectedError && ccpMatched && ccpDetectedError && negativeDetected) {
    console.log('\n🎉 KẾT LUẬN: TẤT CẢ CÁC RULE VÀ CÔNG THỨC ĐỐI CHIẾU EOD ĐÃ PASS 100%!\n');
  } else {
    console.log('\n KẾT LUẬN: Có ca kiểm thử chưa đạt yêu cầu.\n');
  }
}

runE2ETest().catch((err) => {
  console.error('Lỗi khi chạy test E2E:', err);
});
