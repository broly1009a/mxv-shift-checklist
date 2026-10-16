/**
 * test_working_calendar_t_minus_one_guard.ts
 *
 * Kiểm thử tính năng Chuẩn Hóa Tính Ngày T-1 Với Lịch Giao Dịch & Lễ/Tết (Phase 3 - Lỗ hổng 6)
 *
 * Các kịch bản kiểm thử:
 * 1. Ngày thường (Wednesday -> Tuesday): Tính chuẩn T-1 lùi 1 ngày làm việc.
 * 2. Cuối tuần (Monday -> Friday): Bỏ qua Thứ Bảy (10) và Chủ Nhật (11).
 * 3. Ngày Lễ Quốc Khánh (Thursday 03/09/2026): Bỏ qua ngày nghỉ 02/09 và 01/09, lùi về 31/08/2026.
 * 4. Kỳ nghỉ Tết Nguyên Đán kéo dài: Thứ Hai sau Tết lùi qua toàn bộ 5 ngày nghỉ Tết + cuối tuần về phiên giao dịch cuối cùng trước Tết.
 * 5. PreEodReconService: Tích hợp chuẩn xác cùng logic getPreviousTradingSession.
 *
 * Lệnh chạy:
 * cmd.exe /c "npx ts-node -r tsconfig-paths/register src/scripts/test_working_calendar_t_minus_one_guard.ts"
 */

import { DsgdBeforeEodService } from '../modules/trading-ops/services/dsgd-before-eod.service';
import { PreEodReconService } from '../modules/trading-ops/services/pre-eod-recon.service';

// Mock WorkingCalendarService có khả năng nhận diện ngày lễ/tết
class MockWorkingCalendarService {
  private holidays: Set<string> = new Set();

  constructor(holidayList: string[]) {
    this.holidays = new Set(holidayList);
  }

  async validateDate(dateStr: string) {
    const isHoliday = this.holidays.has(dateStr);
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    return {
      date: dateStr,
      isTradingDay: !isHoliday && !isWeekend,
      isHoliday,
      isWeekend,
      note: isHoliday ? 'Nghỉ Lễ/Tết' : isWeekend ? 'Cuối tuần' : 'Ngày làm việc',
      isCustomRecord: true,
    };
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 KIỂM THỬ TÍNH NGÀY T-1 VỚI WORKING CALENDAR (PHASE 3 GUARD)');
  console.log('================================================================\n');

  // Danh sách ngày lễ mẫu:
  // - 01/09/2026 & 02/09/2026: Nghỉ Lễ Quốc Khánh
  // - 16/02/2026 đến 20/02/2026: Nghỉ Tết Nguyên Đán (Thứ Hai đến Thứ Sáu)
  const holidayList = [
    '2026-09-01',
    '2026-09-02',
    '2026-02-16',
    '2026-02-17',
    '2026-02-18',
    '2026-02-19',
    '2026-02-20',
  ];

  const mockCalendar: any = new MockWorkingCalendarService(holidayList);
  const mockSettings: any = { getSetting: async (k: string, def: string) => def };

  const dsgdService = new DsgdBeforeEodService(mockSettings, mockCalendar);
  const preEodService = new PreEodReconService(mockSettings, mockCalendar);

  let passedCount = 0;
  let failedCount = 0;

  // --- TEST CASE 1: Ngày thường trong tuần ---
  console.log('Test Case 1: Thứ Tư (2026-10-14) -> Thứ Ba (2026-10-13)...');
  const res1 = await dsgdService.getPreviousTradingSession('2026-10-14');
  if (res1.dateFormatted === '13/10/2026') {
    console.log(`   PASSED: Kết quả đúng ${res1.dateFormatted}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: Kỳ vọng 13/10/2026 nhưng nhận ${res1.dateFormatted}`);
    failedCount++;
  }

  // --- TEST CASE 2: Đầu tuần qua cuối tuần ---
  console.log('\nTest Case 2: Thứ Hai (2026-10-12) -> Thứ Sáu (2026-10-09)...');
  const res2 = await dsgdService.getPreviousTradingSession('2026-10-12');
  if (res2.dateFormatted === '09/10/2026') {
    console.log(`   PASSED: Đã bỏ qua T7 (10) và CN (11), kết quả đúng ${res2.dateFormatted}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: Kỳ vọng 09/10/2026 nhưng nhận ${res2.dateFormatted}`);
    failedCount++;
  }

  // --- TEST CASE 3: Lùi qua ngày Lễ Quốc Khánh 2/9 ---
  console.log('\nTest Case 3: Thứ Năm (2026-09-03) sau kỳ nghỉ Quốc Khánh (01/09 & 02/09)...');
  const res3 = await dsgdService.getPreviousTradingSession('2026-09-03');
  // 03/09 lùi 1 ngày -> 02/09 (nghỉ) -> 01/09 (nghỉ) -> 31/08/2026 (Thứ Hai làm việc)
  if (res3.dateFormatted === '31/08/2026') {
    console.log(`   PASSED: Đã bỏ qua cả 01/09 và 02/09, kết quả đúng ${res3.dateFormatted}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: Kỳ vọng 31/08/2026 nhưng nhận ${res3.dateFormatted}`);
    failedCount++;
  }

  // --- TEST CASE 4: Lùi qua kỳ nghỉ Tết Nguyên Đán 7 ngày liên tục ---
  console.log('\nTest Case 4: Thứ Hai mở cửa sau Tết (2026-02-23) lùi về phiên trước Tết...');
  // 23/02 (Thứ Hai)
  // Lùi: 22/02 (CN), 21/02 (T7), 20/02 (Tết), 19/02 (Tết), 18/02 (Tết), 17/02 (Tết), 16/02 (Tết), 15/02 (CN), 14/02 (T7) -> 13/02/2026 (Thứ Sáu trước Tết)!
  const res4 = await dsgdService.getPreviousTradingSession('2026-02-23');
  if (res4.dateFormatted === '13/02/2026') {
    console.log(`   PASSED: Đã vượt qua thành công toàn bộ kỳ nghỉ Tết! Kết quả đúng ${res4.dateFormatted}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: Kỳ vọng 13/02/2026 nhưng nhận ${res4.dateFormatted} (Code cũ bị kẹt vào ngày Tết!)`);
    failedCount++;
  }

  // --- TEST CASE 5: PreEodReconService cũng áp dụng chuẩn Working Calendar ---
  console.log('\nTest Case 5: PreEodReconService vượt kỳ nghỉ Tết tương tự...');
  const res5 = await preEodService.getPreviousTradingSession(new Date('2026-02-23'));
  const day5 = String(res5.getDate()).padStart(2, '0');
  const m5 = String(res5.getMonth() + 1).padStart(2, '0');
  const y5 = res5.getFullYear();
  const dateFormatted5 = `${day5}/${m5}/${y5}`;

  if (dateFormatted5 === '13/02/2026') {
    console.log(`   PASSED: PreEodReconService trả về đúng ngày phiên trước Tết: ${dateFormatted5}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAILED: PreEodReconService kỳ vọng 13/02/2026 nhưng nhận ${dateFormatted5}`);
    failedCount++;
  }

  console.log('\n================================================================');
  console.log(`📊 TỔNG KẾT KIỂM THỬ: ${passedCount}/5 PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy test:', err);
  process.exit(1);
});
