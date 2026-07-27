/**
 * fr-calculator.helper.ts
 * Tính FR Product sau khi trừ các loại giao dịch đặc biệt
 * Thay thế logic Sub baocao() trong VBA - phần tính frProduct
 */

import { ParsedRow, toNum, toStr, toDate } from './excel-parser.helper';
import { sumFrLot } from './lot-aggregator.helper';

export interface FrExclusionConfig {
  /** Ngày giao dịch hiện tại */
  ngayGD: Date;
  /** 4 ngày TRU cần trừ (Sheet2!A15, A28, A32, A34 trong VBA) */
  truDates: Date[];
  /** 2 ngày FEF cần trừ (Sheet2!A15, A28) */
  fefDates: Date[];
  /** 2 ngày ZFT cần trừ */
  zftDates: Date[];
  /**
   * Deadline cho QO/QP/BM/MPO (Sheet2!Y1, Excel serial number)
   * Giao dịch có thời điểm < deadline sẽ bị trừ
   */
  deadline?: number;
}

export interface FrProductResult {
  frProduct: number;
  breakdown: {
    totalFr: number;
    truExcluded: number;
    fefExcluded: number;
    zftExcluded: number;
    specialExcluded: number; // QO+QP+BM+MPO
    lExcluded: number;
    frSpread: number;
    frLme: number;
    frOptions: number;
    autoExcluded?: number;
  };
  autoNotes?: string[];
}

/** Lấy ngày làm việc trước của một ngày (trừ Thứ 7, Chủ nhật) */
function getPreviousWorkday(date: Date): Date {
  const d = new Date(date);
  do {
    d.setDate(d.getDate() - 1);
  } while (d.getDay() === 0 || d.getDay() === 6); // 0 = Chủ nhật, 6 = Thứ bảy
  return d;
}

/**
 * Chuẩn hóa ngày GD từ FR row (cột K trong VBA)
 * VBA: IF(VALUE(B)<1, ngayGD, IF(AND(B>X4,B<X2), A15, DATE(Y,M,D)))
 *
 * X4 = ngayGD 00:00:00
 * X2 = ngayGD 05:00:00
 * A15 = prevWorkday of ngayGD
 */
function normalizeFrTradingDate(row: ParsedRow, ngayGD: Date): Date {
  const val = row['Time'] ?? row['Thời gian'] ?? row['col2'];
  if (val === null || val === undefined) return ngayGD;

  let d: Date;
  if (typeof val === 'number') {
    if (val < 1) {
      d = new Date(ngayGD);
    } else {
      const epoch = new Date(1899, 11, 30);
      d = new Date(epoch.getTime() + val * 86400000);
    }
  } else if (val instanceof Date) {
    d = new Date(val);
  } else {
    const parsed = toDate(val);
    if (!parsed) return ngayGD;
    d = parsed;
  }

  if (typeof val === 'number' && val < 1) {
    const res = new Date(ngayGD);
    res.setHours(0, 0, 0, 0);
    return res;
  }

  const prevWorkday = getPreviousWorkday(ngayGD);
  const ngayGDStart = new Date(ngayGD);
  ngayGDStart.setHours(0, 0, 0, 0);
  const ngayGDCutoff = new Date(ngayGD);
  ngayGDCutoff.setHours(5, 0, 0, 0);

  if (d >= ngayGDStart && d < ngayGDCutoff) {
    const res = new Date(prevWorkday);
    res.setHours(0, 0, 0, 0);
    return res;
  }

  const res = new Date(d);
  res.setHours(0, 0, 0, 0);
  return res;
}

/** Lấy mã SP rút gọn từ FR row (VBA: J = LEFT(C, LEN(C)-3)) */
function getFrMaSP(row: ParsedRow): string {
  const maSP = toStr(row['Symbol'] ?? row['Mã SP'] ?? row['col3']);
  return maSP.length > 3
    ? maSP.substring(0, maSP.length - 3).toUpperCase()
    : maSP.toUpperCase();
}

/** So sánh 2 Date chỉ theo ngày */
function isSameDate(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * SumIfs: sum FR.lot WHERE maSP = targetSP AND ngayGD IN dates
 */
function sumFrBySpAndDates(
  frRows: ParsedRow[],
  targetSP: string,
  dates: Date[],
  ngayGD: Date,
): number {
  if (dates.length === 0) return 0;
  return frRows
    .filter((r) => {
      const sp = getFrMaSP(r);
      if (sp !== targetSP) return false;
      const rowDate = normalizeFrTradingDate(r, ngayGD);
      return dates.some((d) => isSameDate(rowDate, d));
    })
    .reduce(
      (s, r) => s + toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']),
      0,
    );
}

/** Lấy số serial Excel của thời gian giao dịch */
function getFrSerial(thoiGian: any, ngayGD: Date): number {
  if (thoiGian === null || thoiGian === undefined) return 0;
  const epoch = new Date(1899, 11, 30);
  if (typeof thoiGian === 'number') {
    if (thoiGian < 1) {
      const ngayGDSerial = (ngayGD.getTime() - epoch.getTime()) / 86400000;
      return ngayGDSerial + thoiGian;
    }
    return thoiGian;
  }
  let d: Date | null = null;
  if (thoiGian instanceof Date) {
    d = thoiGian;
  } else {
    d = toDate(thoiGian);
  }
  if (!d) return 0;
  return (d.getTime() - epoch.getTime()) / 86400000;
}

/**
 * Tính FR Product (sau khi trừ các loại đặc biệt)
 */
export function calcFrProduct(
  frRows: ParsedRow[],
  frSpread: ParsedRow[],
  frLme: ParsedRow[],
  frOptions: ParsedRow[],
  config: FrExclusionConfig,
): FrProductResult {
  const totalFr = sumFrLot(frRows);
  const frSpreadTotal = sumFrLot(frSpread);
  const frLmeTotal = sumFrLot(frLme);
  const frOptionsTotal = sumFrLot(frOptions);

  // TRU: 4 ngày (k, k1, k2, k3)
  const truExcluded = sumFrBySpAndDates(
    frRows,
    'TRU',
    config.truDates,
    config.ngayGD,
  );

  // FEF: 2 ngày (r, r1)
  const fefExcluded = sumFrBySpAndDates(
    frRows,
    'FEF',
    config.fefDates,
    config.ngayGD,
  );

  // ZFT: 2 ngày (s, s1)
  const zftExcluded = sumFrBySpAndDates(
    frRows,
    'ZFT',
    config.zftDates,
    config.ngayGD,
  );

  // QO/QP/BM/MPO: < deadline (Sheet2!Y1)
  const specialProducts = ['QO', 'QP', 'BM', 'MPO'];
  let specialExcluded = 0;

  if (config.deadline !== undefined) {
    for (const sp of specialProducts) {
      const excluded = frRows
        .filter((r) => {
          if (getFrMaSP(r) !== sp) return false;
          const thoiGian = r['Time'] ?? r['Thời gian'] ?? r['col2'];
          const serial = getFrSerial(thoiGian, config.ngayGD);
          return serial < (config.deadline ?? Infinity);
        })
        .reduce(
          (s, r) => s + toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']),
          0,
        );
      specialExcluded += excluded;
    }
  }

  // L = SumIf(FR.A, A18, FR.I)
  const lExcluded = frRows
    .filter((r) => {
      const acc = toStr(r['Account'] ?? r['Mã TKGD'] ?? r['col1']);
      return acc === 'MX1111111111';
    })
    .reduce(
      (s, r) => s + toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']),
      0,
    );

  // --- Rule tự động loại trừ & tạo ghi chú cho các ngày khác lọt vào ---
  // Các sản phẩm đặc biệt cần check: TRU, ZFT, FEF, QO, QP, BM, MPO
  const checkedProducts = ['TRU', 'ZFT', 'FEF', 'QO', 'QP', 'BM', 'MPO'];
  const autoNotes: string[] = [];
  let autoExcludedSum = 0;
  const autoExclusionsMap = new Map<string, { [dateStr: string]: number }>();

  for (const r of frRows) {
    const sp = getFrMaSP(r);
    if (!checkedProducts.includes(sp)) continue;

    // Tính ngày giao dịch chuẩn hóa
    const rowDate = normalizeFrTradingDate(r, config.ngayGD);
    // Nếu ngày chuẩn hóa < ngayGD, tức là thuộc phiên ngày hôm trước
    const localNgayGD = new Date(config.ngayGD);
    localNgayGD.setHours(0, 0, 0, 0);
    if (rowDate < localNgayGD) {
      // Kiểm tra xem đã bị loại trừ ở trên chưa
      let alreadyExcluded = false;
      if (sp === 'TRU' && config.truDates.some((d) => isSameDate(rowDate, d)))
        alreadyExcluded = true;
      if (sp === 'FEF' && config.fefDates.some((d) => isSameDate(rowDate, d)))
        alreadyExcluded = true;
      if (sp === 'ZFT' && config.zftDates.some((d) => isSameDate(rowDate, d)))
        alreadyExcluded = true;

      if (
        ['QO', 'QP', 'BM', 'MPO'].includes(sp) &&
        config.deadline !== undefined
      ) {
        const thoiGian = r['Time'] ?? r['Thời gian'] ?? r['col2'];
        const serial = getFrSerial(thoiGian, config.ngayGD);
        if (serial < config.deadline) {
          alreadyExcluded = true;
        }
      }

      if (!alreadyExcluded) {
        const qty = toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']);
        autoExcludedSum += qty;

        if (!autoExclusionsMap.has(sp)) {
          autoExclusionsMap.set(sp, {});
        }
        const spMap = autoExclusionsMap.get(sp)!;
        // Format ngày theo DD/MM/YYYY
        const d = rowDate.getDate().toString().padStart(2, '0');
        const m = (rowDate.getMonth() + 1).toString().padStart(2, '0');
        const y = rowDate.getFullYear();
        const dateKey = `${d}/${m}/${y}`;
        spMap[dateKey] = (spMap[dateKey] || 0) + qty;
      }
    }
  }

  // Tạo ghi chú từ map gom nhóm
  for (const [sp, datesMap] of autoExclusionsMap.entries()) {
    for (const [dateStr, qty] of Object.entries(datesMap)) {
      autoNotes.push(`${qty} lot ${sp} phiên ngày ${dateStr} `);
    }
  }

  const frProduct =
    totalFr -
    truExcluded -
    fefExcluded -
    zftExcluded -
    specialExcluded -
    lExcluded -
    frSpreadTotal -
    frLmeTotal -
    frOptionsTotal -
    autoExcludedSum;

  return {
    frProduct,
    breakdown: {
      totalFr,
      truExcluded,
      fefExcluded,
      zftExcluded,
      specialExcluded,
      lExcluded,
      frSpread: frSpreadTotal,
      frLme: frLmeTotal,
      frOptions: frOptionsTotal,
      autoExcluded: autoExcludedSum,
    },
    autoNotes,
  };
}
