/**
 * Utility: Xử lý ngày giao dịch
 * Tương đương logic ngày trong VBA (Sheet2!A15, A28, A32, X2, X4, Y1)
 */

/**
 * Lấy ngày giao dịch hiện tại (T ngày làm việc)
 * Xử lý cuối tuần: nếu Thứ 7 → lấy Thứ 6, Chủ nhật → lấy Thứ 6
 */
export function getTradingDate(baseDate: Date = new Date()): Date {
  const d = new Date(baseDate);
  d.setHours(0, 0, 0, 0);

  const dow = d.getDay(); // 0 = Sun, 6 = Sat
  if (dow === 0) {
    d.setDate(d.getDate() - 2); // Sunday → Friday
  } else if (dow === 6) {
    d.setDate(d.getDate() - 1); // Saturday → Friday
  }
  return d;
}

/**
 * Lấy T-1 (ngày giao dịch trước)
 * Tương đương logic ngày đặc biệt trong Sub baocao()
 */
export function getPreviousTradingDate(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);

  // Bỏ qua cuối tuần
  const dow = d.getDay();
  if (dow === 0) d.setDate(d.getDate() - 2);
  else if (dow === 6) d.setDate(d.getDate() - 1);

  return d;
}

/**
 * Chuẩn hóa giá trị ngày từ FR sheet
 * VBA: IF(VALUE(B2)<1, VALUE(B2)+TODAY(), IF(VALUE(B2)>1, VALUE(B2), VALUE(B2)+ngayGD))
 *
 * Logic: FR lưu thời gian theo dạng decimal:
 * - < 1: chỉ là time fraction → cộng với ngày hôm nay
 * - > 1: là full Excel date serial
 * - = giữa: cộng với ngày GD
 */
export function normalizeFrDate(
  rawValue: number | string | Date,
  ngayGD: Date,
  today: Date = new Date(),
): Date {
  if (rawValue instanceof Date) return rawValue;

  const numVal = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
  if (isNaN(numVal)) return ngayGD;

  if (numVal < 1) {
    // Chỉ là time fraction (0.25 = 6am, 0.5 = noon...)
    const timeFraction = numVal * 24 * 3600 * 1000; // ms
    const base = new Date(today);
    base.setHours(0, 0, 0, 0);
    return new Date(base.getTime() + timeFraction);
  } else if (numVal > 1) {
    // Full Excel date serial (days since 1900-01-01)
    return excelSerialToDate(numVal);
  } else {
    // numVal = 1: cộng với ngayGD
    const base = new Date(ngayGD);
    base.setHours(0, 0, 0, 0);
    return base;
  }
}

/**
 * Chuẩn hóa ngày giao dịch từ FR sheet (cột K trong VBA)
 * VBA: IF(VALUE(B2)<1, VALUE(ngayGD), IF(AND(VALUE(B2)>specialStart, VALUE(B2)<specialEnd), specialDate, DATE(YEAR,MONTH,DAY)))
 */
export function normalizeFrTradingDate(
  rawValue: number | string | Date,
  ngayGD: Date,
  specialStart?: number,
  specialEnd?: number,
  specialDate?: Date,
): Date {
  if (rawValue instanceof Date) {
    const d = new Date(rawValue);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  const numVal = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
  if (isNaN(numVal)) return ngayGD;

  if (numVal < 1) {
    // Ngày giao dịch hiện tại
    const d = new Date(ngayGD);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Kiểm tra khoảng thời gian đặc biệt (phiên overnight, ...)
  if (
    specialStart !== undefined &&
    specialEnd !== undefined &&
    specialDate !== undefined &&
    numVal > specialStart &&
    numVal < specialEnd
  ) {
    const d = new Date(specialDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Là Excel date serial thông thường
  return excelSerialToDate(numVal);
}

/**
 * Chuyển Excel serial date number thành Date object
 */
export function excelSerialToDate(serial: number): Date {
  // Excel date serial: days since Jan 0, 1900 (with leap year bug)
  const epoch = new Date(1899, 11, 30); // Dec 30, 1899
  const ms = serial * 24 * 60 * 60 * 1000;
  return new Date(epoch.getTime() + ms);
}

/**
 * So sánh hai Date chỉ theo ngày (không theo giờ)
 */
export function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format date → dd/mm/yyyy
 */
export function formatDateDDMMYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/**
 * Format date → mm/dd/yyyy (Excel US format)
 */
export function formatDateMMDDYYYY(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}/${d}/${y}`;
}

/**
 * Lấy các ngày đặc biệt cho filter FR
 * VBA dùng Sheet2!A15, A28, A32, A34 là các ngày TRU
 */
export function getTruDates(ngayGD: Date): Date[] {
  // Theo pattern VBA: k (A15), k1 (A28), k2 (A32), k3 (A34)
  // Đây thường là 4 ngày giao dịch liên tiếp gần nhất cho TRU
  // Cần xác nhận thực tế từ cấu hình Sheet2
  // Hiện tại return ngayGD và 3 ngày trước
  const dates: Date[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(ngayGD);
    d.setDate(d.getDate() - i);
    // Bỏ cuối tuần
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      dates.push(d);
    }
  }
  return dates;
}
