/**
 * TEST ĐỐI CHIẾU THỰC TẾ TỪ CÁC FILE ĐÃ TẢI VỀ CÓ SẴN (ZERO-DOWNLOAD)
 * Sử dụng trực tiếp:
 *   - CCP EOD:      backend/test_output_ccp/EOD/EOD0926.csv (2.14 MB - 2,295 dòng)
 *   - CCP QLTTTKGD: backend/test_output_ccp/QLTTTKGD/QLTTTKGD0926.csv (3.96 MB - 2,317 dòng)
 *   - MS Files:     backend/data/Backup MS/Futures/2026/T07.2026/08.07/ (QLTKGD, TTTT, eod.csv)
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('\n========================================================================');
  console.log('   KIỂM THỬ ĐỐI CHIẾU SỐ DƯ EOD VỚI CÁC FILE THỰC TẾ CÓ SẴN TRÊN MÁY');
  console.log('========================================================================\n');

  const repoRoot = path.resolve(__dirname, '../../..');

  // 1. Đường dẫn các file thực tế
  const ccpEodPath = path.join(repoRoot, 'backend/test_output_ccp/EOD/EOD0926.csv');
  const ccpQltkgdPath = path.join(repoRoot, 'backend/test_output_ccp/QLTTTKGD/QLTTTKGD0926.csv');

  const msDir = path.join(repoRoot, 'backend/data/Backup MS/Futures/2026/T07.2026/08.07');
  const msQltkgdPath = path.join(msDir, 'QLTKGD.xlsx');
  const msTtttPath = path.join(msDir, 'TTTT.xlsx');
  const msEodPath = path.join(msDir, 'eod.2026-07-06.csv');

  console.log('[1/3] Kiểm tra các file thực tế có sẵn:');
  console.log(`  • CCP EOD:      ${fs.existsSync(ccpEodPath) ? '✅ Có sẵn (' + (fs.statSync(ccpEodPath).size / 1024 / 1024).toFixed(2) + ' MB)' : '❌ Chưa có'}`);
  console.log(`  • CCP QLTTTKGD: ${fs.existsSync(ccpQltkgdPath) ? '✅ Có sẵn (' + (fs.statSync(ccpQltkgdPath).size / 1024 / 1024).toFixed(2) + ' MB)' : '❌ Chưa có'}`);
  console.log(`  • MS QLTKGD:    ${fs.existsSync(msQltkgdPath) ? '✅ Có sẵn' : '❌ Chưa có'}`);
  console.log(`  • MS TTTT:      ${fs.existsSync(msTtttPath) ? '✅ Có sẵn' : '❌ Chưa có'}`);
  console.log(`  • MS EOD:       ${fs.existsSync(msEodPath) ? '✅ Có sẵn' : '❌ Chưa có'}\n`);

  // 2. Đọc file vào Buffer
  console.log('[2/3] Nạp Service ReconciliationService từ Backend...');
  const { ReconciliationService } = require('../../dist/modules/reconciliation/reconciliation.service');

  const service = new ReconciliationService(
    {}, // shiftLogModel
    {}, // botJobModel
    {}, // settingsService
    { sendMessage: () => Promise.resolve() }, // telegramService
    { loadConfig: () => Promise.resolve({}), sendEmailNotification: () => Promise.resolve({ success: true }) },
    {}, // teamsNotifierService
    { getLatestEmail: () => Promise.resolve(null) },
    {}, // botJobQueueService
    {}  // shiftsService
  );

  service.getCurrentExchangeRates = async () => ({
    usdLoss: 25920, usdGain: 25920,
    jpyLoss: 170, jpyGain: 170,
    myrLoss: 6383, myrGain: 6383,
  });

  // 3. Thực hiện đối chiếu song song
  console.log('[3/3] Kích hoạt hàm checkEOD() chạy đối chiếu dữ liệu thực tế...\n');

  const inputFiles = {
    // CCP thực tế
    qltkgdCcp: fs.existsSync(ccpQltkgdPath) ? fs.readFileSync(ccpQltkgdPath) : undefined,
    eodCcp: fs.existsSync(ccpEodPath) ? fs.readFileSync(ccpEodPath) : undefined,
    qltkgdCcpName: 'QLTTTKGD0926.csv',
    eodCcpName: 'EOD0926.csv',

    // MS thực tế
    qltkgd: fs.existsSync(msQltkgdPath) ? fs.readFileSync(msQltkgdPath) : undefined,
    tttt: fs.existsSync(msTtttPath) ? fs.readFileSync(msTtttPath) : undefined,
    eod: fs.existsSync(msEodPath) ? fs.readFileSync(msEodPath) : undefined,
  };

  const startTime = Date.now();
  const result = await service.checkEOD(inputFiles);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('------------------------------------------------------------------------');
  console.log(`          KẾT QUẢ ĐỐI CHIẾU DỮ LIỆU THỰC TẾ (Thời gian: ${duration}s)         `);
  console.log('------------------------------------------------------------------------');
  console.log(`• Tổng số tài khoản lệch công thức EOD: ${result.mismatchedEOD.length}`);
  console.log(`• Số tài khoản âm số dư hiện tại:      ${result.negativeBalanceAccs.length}`);
  console.log(`• Số tài khoản âm ký quỹ IMR:          ${result.negativeIMRAcc.length}\n`);

  const msMismatches = result.mismatchedEOD.filter((m) => m.system === 'MS');
  const ccpMismatches = result.mismatchedEOD.filter((m) => m.system === 'CCP');

  console.log(`Phân loại chênh lệch:`);
  console.log(`  - M-System (MS):  ${msMismatches.length} tài khoản lệch`);
  console.log(`  - CoreCCP (CCP):  ${ccpMismatches.length} tài khoản lệch\n`);

  if (result.mismatchedEOD.length > 0) {
    console.log('Chi tiết các tài khoản lệch (tối đa 10 dòng đầu):');
    console.table(
      result.mismatchedEOD.slice(0, 10).map((m) => ({
        'Hệ thống': m.system ? `[${m.system}]` : '[MS]',
        'Mã TKGD': m.maTKGD,
        'Số dư Tính toán': Math.round(m.calculatedBalance).toLocaleString() + ' đ',
        'Số dư EOD': Math.round(m.eodBalance).toLocaleString() + ' đ',
        'Độ lệch': Math.round(m.differ).toLocaleString() + ' đ',
      }))
    );
  } else {
    console.log('🎉 XUẤT SẮC: TẤT CẢ CÁC TÀI KHOẢN ĐỀU KHỚP TUYỆT ĐỐI THEO CÔNG THỨC EOD (0 đ chênh lệch)!');
  }

  if (result.negativeIMRAcc.length > 0) {
    console.log('\nDanh sách tài khoản âm ký quỹ IMR phát hiện được:');
    console.log('  ' + result.negativeIMRAcc.slice(0, 10).join(', ') + (result.negativeIMRAcc.length > 10 ? ` ... (+${result.negativeIMRAcc.length - 10} TK khác)` : ''));
  }

  console.log('\n========================================================================\n');
}

main().catch(console.error);
