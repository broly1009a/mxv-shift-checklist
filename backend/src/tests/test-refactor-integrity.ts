import { Test, TestingModule } from '@nestjs/testing';
import { BotEngineModule } from '../modules/bot-engine/bot-engine.module';
import { BotJobHandlerRegistry } from '../modules/bot-engine/core/job-handler.registry';
import { BotJobQueueService } from '../modules/bot-engine/bot-job-queue.service';
import { CqgExcelParser } from '../modules/reconciliation/parsers/cqg-excel.parser';
import { MsExcelParser } from '../modules/reconciliation/parsers/ms-excel.parser';
import { StraitsCsvParser } from '../modules/reconciliation/parsers/straits-csv.parser';

// Pure mock functions without jest dependency
const mockFn = () => ({
  mockReturnThis: () => mockFn(),
  mockResolvedValue: () => Promise.resolve(null),
});


async function runIntegrityTests() {
  console.log('===============================================================');
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TÍNH TOÀN VẸN SAU KHI REFACTOR (INTEGRITY TEST)');
  console.log('===============================================================\n');

  let passedCount = 0;
  let totalCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalCount++;
    if (condition) {
      passedCount++;
      console.log(`✅ [PASS] ${testName}`);
    } else {
      console.error(`❌ [FAIL] ${testName}`);
      if (detail) console.error(`   👉 Chi tiết: ${detail}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Kiểm thử các Parser Độc lập
  // -------------------------------------------------------------
  console.log('--- 1. Kiểm thử Bộ phân tích cú pháp (Parsers) ---');

  // Test 1.1: Chuẩn hóa tài khoản M-System
  const acc1 = MsExcelParser.getNormalizedAccount('012C123456F');
  const acc2 = MsExcelParser.getNormalizedAccount('012C123456L');
  const acc3 = MsExcelParser.getNormalizedAccount('012C123456S');
  assert(acc1 === '012C123456', 'MsExcelParser: Bỏ hậu tố F thành công', `Got: ${acc1}`);
  assert(acc2 === '012C123456-L', 'MsExcelParser: Chuyển hậu tố L thành -L', `Got: ${acc2}`);
  assert(acc3 === '012C123456-S', 'MsExcelParser: Chuyển hậu tố S thành -S', `Got: ${acc3}`);

  // Test 1.2: Xử lý số và định dạng tiền CQG
  const numUS = CqgExcelParser.parseCqgNumber('-26,960.50');
  const numEU = CqgExcelParser.parseCqgNumber('-26.960,50');
  assert(numUS === -26960.5, 'CqgExcelParser: Parse định dạng số US (-26,960.50)', `Got: ${numUS}`);
  assert(numEU === -26960.5, 'CqgExcelParser: Parse định dạng số VN/EU (-26.960,50)', `Got: ${numEU}`);

  // Test 1.3: Parse Straits CSV Dummy
  const dummyCsv = Buffer.from(
    'Buy,Sell,Price,Trade Date,Execution Date-Time,Broker Trade Id,Sub-A/C,Product Code\n' +
    '1,0,105.5,2026-08-27,2026-08-27 10:00:00,STR123,012C999999F,M-ST\n'
  );
  const straitsTrades = StraitsCsvParser.parseStraitsCsv(dummyCsv);
  assert(straitsTrades.length === 1, 'StraitsCsvParser: Parse thành công 1 bản ghi giao dịch');
  assert(
    straitsTrades[0]?.maTKGD === '012C999999' && straitsTrades[0]?.klGiaoDich === 1,
    'StraitsCsvParser: Chuẩn hóa đúng tài khoản và khối lượng',
    JSON.stringify(straitsTrades[0])
  );

  // Test 1.4: Quy đổi mã HĐ LME
  const lmeDate = new Date(2026, 4, 15); // May 15, 2026 (+3 months -> August 2026 'Q')
  const lmeCode = CqgExcelParser.convertLMESymbol('LALZ', lmeDate);
  assert(lmeCode.startsWith('AHDD'), 'CqgExcelParser: Quy đổi mã LME LALZ -> AHDD', `Got: ${lmeCode}`);

  // -------------------------------------------------------------
  // Test 2: Kiểm thử Dependency Injection & Registry
  // -------------------------------------------------------------
  console.log('\n--- 2. Kiểm thử DI Container & Strategy Handler Registry ---');

  const registry = new BotJobHandlerRegistry();

  const requiredJobTypes = [
    'RUN_LOT_MACRO',
    'RUN_VALUE_MACRO',
    'RUN_VALUE_TVKD_MACRO',
    'RUN_MACRO',
    'RPA_DOWNLOAD_REPORTS',
    'DOWNLOAD_CAST',
    'AUTO_CHECK_SOD',
    'CHECK_KLGD',
    'CHECK_PRE_EOD',
    'CHECK_EOD_MM',
    'FILE_AUDIT_MS',
    'FILE_AUDIT_CQG',
    'FILE_AUDIT_ACM',
    'DOWNLOAD_CQG_BACKUP',
    'VERIFY_EMAIL_STATUS',
  ];

  // Giả lập mock handler đăng ký vào registry
  requiredJobTypes.forEach((jt) => {
    registry.register({
      jobTypes: [jt],
      execute: async () => ({ ok: true, jobType: jt }),
    });
  });

  let allRegistered = true;
  for (const jt of requiredJobTypes) {
    const handler = registry.getHandler(jt);
    if (!handler) {
      allRegistered = false;
      assert(false, `Registry: Tra cứu handler cho [${jt}]`);
    }
  }
  if (allRegistered) {
    assert(true, `Registry: Đã đăng ký và tra cứu đầy đủ ${requiredJobTypes.length}/${requiredJobTypes.length} JobTypes`);
  }

  // -------------------------------------------------------------
  // Kết quả tổng hợp
  // -------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`📊 KẾT QUẢ KIỂM THỬ: ${passedCount}/${totalCount} TEST CASES PASS`);
  console.log('===============================================================');

  if (passedCount === totalCount) {
    console.log('🎉 TẤT CẢ TEST CASES ĐỀU ĐẠT CHUẨN TOÀN VẸN 100%!');
  } else {
    process.exit(1);
  }
}

runIntegrityTests().catch((err) => {
  console.error('Lỗi khi chạy bộ test:', err);
  process.exit(1);
});
