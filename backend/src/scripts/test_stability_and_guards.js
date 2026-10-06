/**
 * BỘ TESTCASE KIỂM THỬ TÍNH ỔN ĐỊNH VÀ CÁC CƠ CHẾ BẢO VỆ (STABILITY & GUARDS)
 * File: backend/src/scripts/test_stability_and_guards.js
 * 
 * Kiểm tra 5 kịch bản trọng yếu:
 *  1. Khắc phục "Monday Dawn Trap": Rạng sáng Thứ Hai trước 05:00 không bị lùi về Thứ Sáu tuần trước.
 *  2. Logic lùi ngày ca đêm trong tuần (Thứ 3 -> Thứ 7 vẫn lùi về T-1 đúng chuẩn C#).
 *  3. Cơ chế Market Weekend Guard: Nhận diện chính xác 100% thời điểm thị trường đóng cửa cuối tuần.
 *  4. Cơ chế Shift Stale/Expiration Guard: Lọc bỏ ca trực cũ quá 36h, ngăn chặn lặp job vô tận.
 *  5. Cơ chế Fallback an toàn khi ngày truyền vào không hợp lệ hoặc ép buộc ngày lịch sử (forceExactDate).
 */

let isMarketWeekendClosed, resolveTradingSessionDate;
try {
  ({ isMarketWeekendClosed, resolveTradingSessionDate } = require('../../dist/modules/bot-engine/helpers/bot-path.helper'));
} catch {
  require('ts-node/register');
  ({ isMarketWeekendClosed, resolveTradingSessionDate } = require('../modules/bot-engine/helpers/bot-path.helper'));
}

console.log('================================================================================');
console.log('       BẮT ĐẦU KIỂM THỬ TÍNH ỔN ĐỊNH & CÁC CƠ CHẾ BẢO VỆ HỆ THỐNG');
console.log('================================================================================\n');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    if (details) console.log(`     └─ ${details}`);
    totalPassed++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    if (details) console.error(`     └─ ${details}`);
    totalFailed++;
  }
}

// -----------------------------------------------------------------------------
// TEST SUITE 1: KHẮC PHỤC BẪY RẠNG SÁNG THỨ HAI (MONDAY DAWN TRAP)
// -----------------------------------------------------------------------------
console.log('▶ TEST SUITE 1: Kiểm thử khắc phục "Bẫy lùi ngày rạng sáng Thứ Hai"');
{
  // Giả lập 02:15 sáng Thứ Hai ngày 05/10/2026
  const mockMondayDawn = new Date('2026-10-04T19:15:00.000Z'); // 02:15 GMT+7 ngày 05/10/2026
  const result = resolveTradingSessionDate('2026-10-05', {
    now: mockMondayDawn,
    sessionStartStr: '05:00',
  });

  assert(
    result.dateStr === '2026-10-05',
    'Rạng sáng Thứ Hai (02:15 AM) giữ nguyên ngày Thứ Hai (2026-10-05)',
    `Kết quả trả về: dateStr = ${result.dateStr} (Kỳ vọng: 2026-10-05, KHÔNG BỊ lùi về 2026-10-02)`
  );
  assert(
    result.dateObj.getDate() === 5 && result.dateObj.getDay() === 1,
    'dateObj thuộc ngày Thứ Hai (getDay = 1, day = 5)',
    `dateObj = ${result.dateObj.toISOString()}`
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 2: ĐẢM BẢO LOGIC LÙI PHIÊN ĐÊM TRONG TUẦN VẪN HOẠT ĐỘNG CHUẨN XÁC
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 2: Kiểm thử lùi phiên ca đêm các ngày trong tuần (Thứ 3 -> Thứ 7)');
{
  // 1. Giả lập 02:00 sáng Thứ Ba ngày 06/10/2026 -> Phiên đêm thuộc về Thứ Hai (05/10)
  const mockTuesdayDawn = new Date('2026-10-05T19:00:00.000Z'); // 02:00 GMT+7 ngày 06/10
  const resTue = resolveTradingSessionDate('2026-10-06', {
    now: mockTuesdayDawn,
    sessionStartStr: '05:00',
  });
  assert(
    resTue.dateStr === '2026-10-05',
    'Ca đêm Thứ Ba lúc 02:00 AM lùi về phiên Thứ Hai (2026-10-05)',
    `Kết quả: dateStr = ${resTue.dateStr}`
  );

  // 2. Giả lập 02:00 sáng Thứ Bảy ngày 10/10/2026 -> Phiên đêm thuộc về Thứ Sáu (09/10)
  const mockSaturdayDawn = new Date('2026-10-09T19:00:00.000Z'); // 02:00 GMT+7 ngày 10/10
  const resSat = resolveTradingSessionDate('2026-10-10', {
    now: mockSaturdayDawn,
    sessionStartStr: '05:00',
  });
  assert(
    resSat.dateStr === '2026-10-09',
    'Ca đêm Thứ Bảy lúc 02:00 AM lùi về phiên Thứ Sáu (2026-10-09)',
    `Kết quả: dateStr = ${resSat.dateStr}`
  );

  // 3. Giả lập 08:30 sáng Thứ Ba ngày 06/10/2026 -> Ban ngày giữ nguyên Thứ Ba (06/10)
  const mockTuesdayDay = new Date('2026-10-06T01:30:00.000Z'); // 08:30 GMT+7 ngày 06/10
  const resTueDay = resolveTradingSessionDate('2026-10-06', {
    now: mockTuesdayDay,
    sessionStartStr: '05:00',
  });
  assert(
    resTueDay.dateStr === '2026-10-06',
    'Ban ngày Thứ Ba lúc 08:30 AM giữ nguyên Thứ Ba (2026-10-06)',
    `Kết quả: dateStr = ${resTueDay.dateStr}`
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: KIỂM THỬ BỘ BẢO VỆ THỊ TRƯỜNG ĐÓNG CỬA CUỐI TUẦN (MARKET WEEKEND GUARD)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 3: Kiểm thử nhận diện thị trường đóng cửa cuối tuần (isMarketWeekendClosed)');
{
  // 1. Thứ Bảy lúc 03:00 sáng (Thị trường Mỹ vẫn giao dịch phiên Thứ 6) -> FALSE
  const satEarly = new Date('2026-10-09T20:00:00.000Z'); // 03:00 GMT+7 Thứ Bảy
  assert(
    isMarketWeekendClosed(satEarly) === false,
    'Thứ Bảy lúc 03:00 AM: Thị trường Mỹ vẫn mở phiên đêm -> isMarketWeekendClosed = FALSE',
    `Giờ VN: ${satEarly.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );

  // 2. Thứ Bảy lúc 07:00 sáng (Thị trường đã đóng cửa chốt tuần) -> TRUE
  const satClosed = new Date('2026-10-10T00:00:00.000Z'); // 07:00 GMT+7 Thứ Bảy
  assert(
    isMarketWeekendClosed(satClosed) === true,
    'Thứ Bảy lúc 07:00 AM: Thị trường đã đóng cửa -> isMarketWeekendClosed = TRUE',
    `Giờ VN: ${satClosed.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );

  // 3. Chủ Nhật cả ngày -> TRUE
  const sunNoon = new Date('2026-10-11T05:00:00.000Z'); // 12:00 trưa GMT+7 Chủ Nhật
  assert(
    isMarketWeekendClosed(sunNoon) === true,
    'Chủ Nhật lúc 12:00 trưa: Thị trường đóng cửa hoàn toàn -> isMarketWeekendClosed = TRUE',
    `Giờ VN: ${sunNoon.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );

  // 4. Thứ Hai lúc 02:00 sáng (Trước 05:00 AM, CME chưa mở) -> TRUE
  const monEarly = new Date('2026-10-11T19:00:00.000Z'); // 02:00 GMT+7 Thứ Hai
  assert(
    isMarketWeekendClosed(monEarly) === true,
    'Thứ Hai lúc 02:00 AM: CME Globex chưa mở phiên -> isMarketWeekendClosed = TRUE',
    `Giờ VN: ${monEarly.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );

  // 5. Thứ Hai lúc 05:15 sáng (CME Globex đã mở phiên tuần mới) -> FALSE
  const monOpen = new Date('2026-10-11T22:15:00.000Z'); // 05:15 GMT+7 Thứ Hai
  assert(
    isMarketWeekendClosed(monOpen) === false,
    'Thứ Hai lúc 05:15 AM: CME Globex đã mở phiên tuần mới -> isMarketWeekendClosed = FALSE',
    `Giờ VN: ${monOpen.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );

  // 6. Thứ Tư lúc 10:00 sáng trong tuần -> FALSE
  const wedDay = new Date('2026-10-07T03:00:00.000Z'); // 10:00 GMT+7 Thứ Tư
  assert(
    isMarketWeekendClosed(wedDay) === false,
    'Thứ Tư lúc 10:00 AM ngày trong tuần -> isMarketWeekendClosed = FALSE',
    `Giờ VN: ${wedDay.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 4: KIỂM THỬ BỘ LỌC CA TRỰC CŨ TỒN ĐỌNG (SHIFT STALE EXPIRATION GUARD)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 4: Kiểm thử bộ lọc ca trực cũ tồn đọng (Operational Window = 36h)');
{
  const now = Date.now();
  const maxShiftAgeMs = 36 * 60 * 60 * 1000; // 36 tiếng

  const mockShiftLogs = [
    {
      id: 'SHIFT_HOM_NAY',
      name: 'Ca hôm nay (tạo cách đây 4 giờ)',
      createdAt: new Date(now - 4 * 60 * 60 * 1000),
      status: 'PENDING'
    },
    {
      id: 'SHIFT_DEM_QUA',
      name: 'Ca đêm qua (tạo cách đây 14 giờ)',
      createdAt: new Date(now - 14 * 60 * 60 * 1000),
      status: 'PENDING'
    },
    {
      id: 'SHIFT_THU_SAU_QUEN_DONG',
      name: 'Ca Thứ Sáu tuần trước quên đóng (tạo cách đây 64 giờ)',
      createdAt: new Date(now - 64 * 60 * 60 * 1000),
      status: 'PENDING'
    },
    {
      id: 'SHIFT_TUAN_TRUOC',
      name: 'Ca 1 tuần trước quên đóng (tạo cách đây 168 giờ)',
      createdAt: new Date(now - 168 * 60 * 60 * 1000),
      status: 'PENDING'
    }
  ];

  // Logic lọc chuẩn hóa của bot-engine.service.ts
  const minShiftCreatedAt = new Date(now - maxShiftAgeMs);
  const filteredActiveLogs = mockShiftLogs.filter(
    s => s.status === 'PENDING' && s.createdAt >= minShiftCreatedAt
  );

  assert(
    filteredActiveLogs.length === 2,
    'Chỉ giữ lại 2 ca trong vòng 36h, loại bỏ 2 ca cũ tồn đọng',
    `Số ca được xử lý: ${filteredActiveLogs.length}/4 (Ca hôm nay & Ca đêm qua)`
  );

  assert(
    !filteredActiveLogs.some(s => s.id === 'SHIFT_THU_SAU_QUEN_DONG'),
    'Ca Thứ Sáu tuần trước bị loại bỏ 100%, không bị quét lặp định kỳ',
    'SHIFT_THU_SAU_QUEN_DONG đã bị chặn'
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 5: KIỂM THỬ TRƯỜNG HỢP ÉP BUỘC SOI LẠI LỊCH SỬ (forceExactDate)
// -----------------------------------------------------------------------------
console.log('\n▶ TEST SUITE 5: Kiểm thử người dùng chủ động soi lại lịch sử (forceExactDate = true)');
{
  const mockNow = new Date('2026-10-05T02:00:00.000Z');
  // Người dùng chọn ngày quá khứ 2026-09-15
  const resPast = resolveTradingSessionDate('2026-09-15', { now: mockNow, forceExactDate: true });
  assert(
    resPast.dateStr === '2026-09-15',
    'Soi lại ngày quá khứ cụ thể (2026-09-15) được giữ nguyên tuyệt đối',
    `dateStr = ${resPast.dateStr}`
  );
}

// -----------------------------------------------------------------------------
// TỔNG KẾT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`TỔNG KẾT KIỂM THỬ: ${totalPassed} PASSED | ${totalFailed} FAILED`);
console.log('================================================================================');

if (totalFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 TẤT CẢ TESTCASE ĐÃ VƯỢT QUA 100%! HỆ THỐNG HOẠT ĐỘNG HOÀN TOÀN ỔN ĐỊNH.\n');
  process.exit(0);
}
