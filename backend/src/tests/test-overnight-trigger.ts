import { BotEngineService } from '../modules/bot-engine/bot-engine.service';

// Mock minimal class to test public helper methods directly
const service = Object.create(BotEngineService.prototype) as BotEngineService;

console.log('====================================================');
console.log('🧪 BẮT ĐẦU KIỂM THỬ LOGIC OVERNIGHT SHIFT TRIGGER');
console.log('====================================================');

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: any) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error('   Details:', details);
  }
}

// 1. Test Day Shift (isOvernight = false)
{
  const shiftDate = '2026-08-25';
  const triggerTime = '07:30';
  const target = service.getTargetTriggerDateTime(shiftDate, triggerTime, false);
  
  // Target should be 2026-08-25 07:30:00 GMT+7 = 2026-08-25 00:30:00 UTC
  const expectedUTC = '2026-08-25T00:30:00.000Z';
  assert(
    target.toISOString() === expectedUTC,
    'Ca 1 ban ngày (07:30 ngày 25/08) phải có target UTC là 2026-08-25T00:30:00.000Z',
    { got: target.toISOString(), expected: expectedUTC },
  );

  // At 06:00 VN (2026-08-24T23:00:00.000Z), should NOT trigger
  const mockNowEarly = new Date('2026-08-24T23:00:00.000Z').getTime();
  assert(
    mockNowEarly < target.getTime(),
    'Lúc 06:00 sáng ngày 25/08 (chưa đến 07:30) -> Không kích hoạt',
  );

  // At 07:30 VN (2026-08-25T00:30:00.000Z), SHOULD trigger
  const mockNowOnTime = new Date('2026-08-25T00:30:00.000Z').getTime();
  assert(
    mockNowOnTime >= target.getTime(),
    'Lúc 07:30 sáng ngày 25/08 -> Kích hoạt thành công',
  );
}

// 2. Test Overnight Shift Evening Task (22:30, isOvernight = true)
{
  const shiftDate = '2026-08-25';
  const triggerTime = '22:30';
  const target = service.getTargetTriggerDateTime(shiftDate, triggerTime, true);

  // Target should be 2026-08-25 22:30:00 GMT+7 = 2026-08-25 15:30:00 UTC
  const expectedUTC = '2026-08-25T15:30:00.000Z';
  assert(
    target.toISOString() === expectedUTC,
    'Ca 3 ban đêm (22:30 ngày 25/08) phải có target UTC là 2026-08-25T15:30:00.000Z',
    { got: target.toISOString(), expected: expectedUTC },
  );

  // At 21:00 VN (2026-08-25T14:00:00.000Z), should NOT trigger
  const mockNowEarly = new Date('2026-08-25T14:00:00.000Z').getTime();
  assert(
    mockNowEarly < target.getTime(),
    'Lúc 21:00 tối ngày 25/08 -> Không kích hoạt task 22:30',
  );

  // At 22:30 VN (2026-08-25T15:30:00.000Z), SHOULD trigger
  const mockNowOnTime = new Date('2026-08-25T15:30:00.000Z').getTime();
  assert(
    mockNowOnTime >= target.getTime(),
    'Lúc 22:30 tối ngày 25/08 -> Kích hoạt task 22:30 thành công',
  );
}

// 3. Test Overnight Shift Closing Task (05:05, isOvernight = true) -> CRITICAL CASE
{
  const shiftDate = '2026-08-25';
  const triggerTime = '05:05';
  const target = service.getTargetTriggerDateTime(shiftDate, triggerTime, true);

  // Target MUST BE 2026-08-26 05:05:00 GMT+7 (NEXT DAY) = 2026-08-25 22:05:00 UTC
  const expectedUTC = '2026-08-25T22:05:00.000Z';
  assert(
    target.toISOString() === expectedUTC,
    'Ca 3 Đóng ca (05:05 ngày 25/08) phải tự động chuyển sang sáng hôm sau: 2026-08-25T22:05:00.000Z (05:05 sáng 26/08 GMT+7)',
    { got: target.toISOString(), expected: expectedUTC },
  );

  // Scenario A: Lúc 05:05 SÁNG NGÀY 25/08 (đầu ngày khi vừa sinh 3 ca)
  const mockNowMorningD = new Date('2026-08-24T22:05:00.000Z').getTime(); // 05:05 VN on 25/08
  assert(
    mockNowMorningD < target.getTime(),
    'Lúc 05:05 sáng ngày 25/08 (Đầu ngày) -> PHẢI BỎ QUA KHÔNG CHẠY',
  );

  // Scenario B: Lúc 01:23 SÁNG NGÀY 26/08 (Nửa đêm ca 3)
  const mockNowMidnightDPlus1 = new Date('2026-08-25T18:23:00.000Z').getTime(); // 01:23 VN on 26/08
  assert(
    mockNowMidnightDPlus1 < target.getTime(),
    'Lúc 01:23 sáng ngày 26/08 (Nửa đêm ca 3 chưa đến 05:05) -> PHẢI BỎ QUA KHÔNG CHẠY',
  );

  // Scenario C: Lúc 05:05 SÁNG NGÀY 26/08 (Đúng giờ chốt ca)
  const mockNowOnTimeDPlus1 = new Date('2026-08-25T22:05:00.000Z').getTime(); // 05:05 VN on 26/08
  assert(
    mockNowOnTimeDPlus1 >= target.getTime(),
    'Lúc 05:05 sáng ngày 26/08 (Đúng giờ chốt ca 3) -> KÍCH HOẠT CHẠY CHÍNH XÁC',
  );
}

// 4. Test isOvernightShift Helper
{
  assert(
    service.isOvernightShift({ shiftSlotId: { isOvernight: true } }) === true,
    'Nhận diện slot.isOvernight = true',
  );
  assert(
    service.isOvernightShift({ shiftSlotId: { startTime: '22:00', endTime: '06:00' } }) === true,
    'Nhận diện startTime > endTime (22:00 > 06:00)',
  );
  assert(
    service.isOvernightShift({ templateId: { title: 'Checklist Vận Hành Ca 3 Đêm' } }) === true,
    'Nhận diện templateTitle chứa từ khóa "Ca 3" / "Đêm"',
  );
  assert(
    service.isOvernightShift({ shiftSlotId: { isOvernight: false, startTime: '06:00', endTime: '14:00' } }) === false,
    'Nhận diện Ca 1 ngày là isOvernight = false',
  );
}

console.log('====================================================');
console.log(`🎉 KẾT QUẢ: ${passedTests}/${totalTests} TESTS PASSED`);
console.log('====================================================');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}
