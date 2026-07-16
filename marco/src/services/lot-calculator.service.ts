/**
 * Lot Calculator Service
 * Thay thế Sub baocao(), tonghoplme(), tonghop_options() trong VBA
 *
 * Tính tổng số lot theo từng nhóm sản phẩm, validate cross-check
 * và tạo PivotTable aggregate bằng code thuần JS.
 */

import { ClassifiedTrades, DsgdRow, FrRow, TtmRow, OpRow, PsRow, TtttRow } from '../types/trade-data.types';
import {
  DailyLotReport,
  LotSummaryByProduct,
  LotSummaryByTvkd,
  ValidationResult,
  PivotResult,
} from '../types/report.types';
import { toNumber } from '../utils/excel-reader';
import { isSameDate, normalizeFrDate } from '../utils/date-utils';

// ─── Helpers sum ──────────────────────────────────────────────────────────────

/** Sum cột Q (khoiLuong) trong DSGD rows */
function sumDsgdQ(rows: DsgdRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.khoiLuong), 0);
}

/** Sum cột N+O (klm + klb) trong TTM rows */
function sumTtmNO(rows: TtmRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.klm) + toNumber(r.klb), 0);
}

/** Sum cột I (khoiLuongNum) trong OP rows */
function sumOpI(rows: OpRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.totalLots), 0);
}

/** Sum cột I trong PS rows */
function sumPsI(rows: PsRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.khoiLuongNum), 0);
}

/** Sum cột P (khoiLuong) trong TTTT rows */
function sumTtttP(rows: TtttRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.khoiLuong), 0);
}

/** Sum cột I (khoiLuongNum) trong FR rows */
function sumFrI(rows: FrRow[]): number {
  return rows.reduce((s, r) => s + toNumber(r.khoiLuongNum ?? r.khoiLuong), 0);
}

// ─── Tính lot FR loại trừ các loại đặc biệt ─────────────────────────────────

export interface FrExclusionConfig {
  ngayGD: Date;
  /** Các ngày TRU cần trừ (thường 4 ngày, từ Sheet2!A15, A28, A32, A34) */
  truDates: Date[];
  /** Các ngày FEF cần trừ (Sheet2!A15, A28) */
  fefDates: Date[];
  /** Các ngày ZFT cần trừ (Sheet2!A15, A28) */
  zftDates: Date[];
  /** Deadline: những lệnh QO/QP/BM/MPO có thời điểm < deadline sẽ bị trừ */
  deadline?: number; // Excel date serial (Sheet2!Y1)
  today?: Date;
}

/**
 * Tính lot FR Product (sau khi trừ các loại đặc biệt)
 * VBA: ws.Cells(i, 17) = Sum(FR.I) - TRU(4 phiên) - FEF(2 phiên) - ZFT(2 phiên)
 *                       - QO/QP/BM/MPO (< deadline)
 *                       - FR Spread - FR LME - FR Options
 */
export function calcFrProduct(
  frRows: FrRow[],
  frSpread: FrRow[],
  frLme: FrRow[],
  frOptions: FrRow[],
  config: FrExclusionConfig,
): { frProduct: number; breakdown: Record<string, number> } {
  const totalFr = sumFrI(frRows);
  const totalSpread = sumFrI(frSpread);
  const totalLme = sumFrI(frLme);
  const totalOptions = sumFrI(frOptions);

  // VBA: k  = SumIfs(FR.I, FR.J="TRU", FR.K=A15)
  //      k1 = SumIfs(FR.I, FR.J="TRU", FR.K=A28)
  //      k2 = SumIfs(FR.I, FR.J="TRU", FR.K=A32)
  //      k3 = SumIfs(FR.I, FR.J="TRU", FR.K=A34)
  const truTotal = config.truDates.reduce((sum, date) => {
    return (
      sum +
      sumFrI(
        frRows.filter(
          (r) => r.maSPNgan === 'TRU' && r.ngayGD && isSameDate(r.ngayGD, date),
        ),
      )
    );
  }, 0);

  // VBA: r  = SumIfs(FR.I, FR.J="FEF", FR.K=A15)
  //      r1 = SumIfs(FR.I, FR.J="FEF", FR.K=A28)
  const fefTotal = config.fefDates.reduce((sum, date) => {
    return (
      sum +
      sumFrI(
        frRows.filter(
          (r) => r.maSPNgan === 'FEF' && r.ngayGD && isSameDate(r.ngayGD, date),
        ),
      )
    );
  }, 0);

  // VBA: s  = SumIfs(FR.I, FR.J="ZFT", FR.K=A15)
  //      s1 = SumIfs(FR.I, FR.J="ZFT", FR.K=A28)
  const zftTotal = config.zftDates.reduce((sum, date) => {
    return (
      sum +
      sumFrI(
        frRows.filter(
          (r) => r.maSPNgan === 'ZFT' && r.ngayGD && isSameDate(r.ngayGD, date),
        ),
      )
    );
  }, 0);

  // VBA: qo  = SumIfs(FR.I, FR.J="QO",  FR.L < deadline)
  //      qp  = SumIfs(FR.I, FR.J="QP",  FR.L < deadline)
  //      bm  = SumIfs(FR.I, FR.J="BM",  FR.L < deadline)
  //      mpo = SumIfs(FR.I, FR.J="MPO", FR.L < deadline)
  const specialProducts = ['QO', 'QP', 'BM', 'MPO'];
  const specialTotal = config.deadline
    ? specialProducts.reduce((sum, sp) => {
        return (
          sum +
          sumFrI(
            frRows.filter((r) => {
              if (r.maSPNgan !== sp) return false;
              // FR.L = thoiDiem (cột L tính toán)
              if (!r.thoiDiem) return false;
              const serialL =
                r.thoiDiem instanceof Date
                  ? (r.thoiDiem.getTime() - new Date(1899, 11, 30).getTime()) /
                    86400000
                  : toNumber(r.thoiDiem);
              return serialL < (config.deadline ?? Infinity);
            }),
          )
        );
      }, 0)
    : 0;

  // VBA: L = SumIf(FR.A, Sheet2!A18, FR.I)  → không rõ A18, có thể là một mã TKGD cụ thể
  // TODO: Cần xác nhận Sheet2!A18 chứa gì
  const lTotal = 0; // Placeholder

  const frProduct =
    totalFr -
    truTotal -
    fefTotal -
    zftTotal -
    specialTotal -
    lTotal -
    totalSpread -
    totalLme -
    totalOptions;

  return {
    frProduct,
    breakdown: {
      totalFr,
      truTotal,
      fefTotal,
      zftTotal,
      specialTotal,
      lTotal,
      totalSpread,
      totalLme,
      totalOptions,
    },
  };
}

// ─── Tạo PivotTable aggregate (thay PivotTable Excel) ─────────────────────────

/**
 * Tổng hợp KLM/KLB theo mã sản phẩm (SP)
 * VBA: PivotTable với Row=SP, Values=Sum(KLM), Sum(KLB)
 */
export function aggregateByProduct(
  rows: DsgdRow[],
  getSP: (row: DsgdRow) => string,
): LotSummaryByProduct[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const row of rows) {
    const sp = getSP(row) || '(blank)';
    const side = (row.side || '').toUpperCase();
    const lot = toNumber(row.khoiLuong);

    const existing = map.get(sp) ?? { klm: 0, klb: 0 };
    if (side === 'BUY') {
      existing.klm += lot;
    } else if (side === 'SELL') {
      existing.klb += lot;
    }
    map.set(sp, existing);
  }

  return Array.from(map.entries())
    .filter(([sp]) => sp !== '(blank)')
    .map(([maSP, { klm, klb }]) => ({
      maSP,
      klm,
      klb,
      total: klm + klb,
    }))
    .sort((a, b) => a.maSP.localeCompare(b.maSP));
}

/**
 * Tổng hợp KLM/KLB theo TVKD (3 ký tự đầu mã TKGD)
 */
export function aggregateByTvkd(
  rows: DsgdRow[],
): LotSummaryByTvkd[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const row of rows) {
    const tvkd = (row.maTKGD || '').substring(0, 3) || '(blank)';
    const side = (row.side || '').toUpperCase();
    const lot = toNumber(row.khoiLuong);

    const existing = map.get(tvkd) ?? { klm: 0, klb: 0 };
    if (side === 'BUY') existing.klm += lot;
    else if (side === 'SELL') existing.klb += lot;
    map.set(tvkd, existing);
  }

  return Array.from(map.entries())
    .filter(([tvkd]) => tvkd !== '(blank)')
    .map(([tvkd, { klm, klb }]) => ({
      tvkd,
      klm,
      klb,
      total: klm + klb,
    }))
    .sort((a, b) => a.tvkd.localeCompare(b.tvkd));
}

// ─── Hàm lấy mã SP từ DSGD row ───────────────────────────────────────────────

/**
 * Lấy mã SP từ mã TKGD và mã hàng hóa
 * VBA DSGD: G2 = VLOOKUP(IF(RIGHT(E2,1)="L", LEFT(H2,3), LEFT(H2,FIND("2",H2)-2)), HH!A:C, 2, 0)
 */
export function getSPFromDsgd(
  row: DsgdRow,
  hhLookup: Map<string, string>,
): string {
  const maTKGD = row.maTKGD || '';
  const maSanPham = row.maSanPham || '';

  let maHHKey: string;
  if (maTKGD.toUpperCase().endsWith('L')) {
    // LME: LEFT(maSanPham, 3)
    maHHKey = maSanPham.substring(0, 3);
  } else {
    // Futures: LEFT(maSanPham, FIND("2", maSanPham) - 2)
    const idx2 = maSanPham.indexOf('2');
    maHHKey = idx2 > 1 ? maSanPham.substring(0, idx2 - 1) : maSanPham.substring(0, 3);
  }

  return hhLookup.get(maHHKey) ?? maHHKey;
}

/**
 * Lấy mã SP từ DSGD Spread row
 * VBA DSGD Spread: G2 = LEFT(F2, LEN(F2)-3)  (bỏ 3 ký tự cuối của tên contract)
 */
export function getSPFromSpread(row: DsgdRow): string {
  const col6 = (row[`col6`] as string) || '';
  return col6.length > 3 ? col6.substring(0, col6.length - 3) : col6;
}

// ─── Main: Tính báo cáo tổng hợp ─────────────────────────────────────────────

export function calculateDailyLotReport(
  trades: ClassifiedTrades,
  frConfig: FrExclusionConfig,
): DailyLotReport {
  const {
    dsgd, dsgdSpread, dsgdLme, dsgdOptions, dsgdAcm,
    fr, frSpread, frLme, frOptions,
    ttm, ttmSpread, ttmLme, ttmOptions, ttmAcm,
    op, opSpread, opLme, opOptions,
    ps, psSpread, psLme, psOptions,
    tttt, ttttSpread, ttttLme, ttttOptions, ttttAcm,
    lmeExpired,
  } = trades;

  // ─ DSGD ─
  const dsgdTotal = sumDsgdQ(dsgd);
  const dsgdSpreadLot = sumDsgdQ(dsgdSpread);
  const dsgdLmeLot = sumDsgdQ(dsgdLme);
  const dsgdOptionsLot = sumDsgdQ(dsgdOptions);
  // VBA: ws.Cells(i,3) = Sum(DSGD.Q) - Spread - LME - Options
  const dsgdProduct = dsgdTotal - dsgdSpreadLot - dsgdLmeLot - dsgdOptionsLot;

  // ─ FR ─
  const { frProduct } = calcFrProduct(fr, frSpread, frLme, frOptions, frConfig);
  const frSpreadLot = sumFrI(frSpread);
  const frLmeLot = sumFrI(frLme);
  const frOptionsLot = sumFrI(frOptions);

  // ─ TTTT ─
  const ttttTotal = sumTtttP(tttt);
  const ttttSpreadLot = sumTtttP(ttttSpread);
  const ttttLmeLot = sumTtttP(ttttLme) - sumTtttP(lmeExpired); // VBA trừ Expired
  const ttttOptionsLot = sumTtttP(ttttOptions);
  const ttttProduct = ttttTotal - ttttSpreadLot - ttttLmeLot - ttttOptionsLot;

  // ─ TTM ─
  const ttmTotal = sumTtmNO(ttm);
  const ttmSpreadLot = sumTtmNO(ttmSpread);
  const ttmLmeLot = sumTtmNO(ttmLme);
  const ttmOptionsLot = sumTtmNO(ttmOptions);
  const ttmProduct = ttmTotal - ttmSpreadLot - ttmLmeLot - ttmOptionsLot;

  // ─ OP (/2 vì tính cả long và short) ─
  const opTotal = sumOpI(op);
  const opSpreadLot = sumOpI(opSpread) / 2;
  const opLmeLot = sumOpI(opLme) / 2;
  const opOptionsLot = sumOpI(opOptions);
  const opProduct = opTotal / 2 - opSpreadLot - opLmeLot - opOptionsLot;

  // ─ PS (/2) ─
  const psTotal = sumPsI(ps);
  const psSpreadLot = sumPsI(psSpread);
  const psLmeLot = sumPsI(psLme) - sumTtttP(lmeExpired); // VBA trừ LME Expired
  const psOptionsLot = sumPsI(psOptions);
  const psProduct = psTotal / 2 - psOptionsLot - psLmeLot - psSpreadLot;

  // ─ ACM ─
  const acmDsgdLot = sumDsgdQ(dsgdAcm);
  const acmTtttLot = sumTtttP(ttttAcm);
  const acmTtmLot = sumTtmNO(ttmAcm);

  // ─ Validations ─
  const validations: ValidationResult[] = [
    {
      field: 'Product Futures (DSGD vs FR)',
      expected: dsgdProduct,
      actual: frProduct,
      passed: dsgdProduct === frProduct,
      message: dsgdProduct !== frProduct ? 'Sai khoi luong giao dich Product' : undefined,
    },
    {
      field: 'Tat Toan (TTTT vs PS)',
      expected: ttttProduct,
      actual: psProduct,
      passed: Math.abs(ttttProduct - psProduct) < 0.001,
      message: Math.abs(ttttProduct - psProduct) >= 0.001 ? 'Sai tat toan Product' : undefined,
    },
    {
      field: 'Trang Thai Mo (TTM vs OP)',
      expected: ttmProduct,
      actual: opProduct,
      passed: Math.abs(ttmProduct - opProduct) < 0.001,
      message: Math.abs(ttmProduct - opProduct) >= 0.001 ? 'Sai trang thai mo Product' : undefined,
    },
    {
      field: 'Spread (DSGD vs FR)',
      expected: dsgdSpreadLot,
      actual: frSpreadLot,
      passed: dsgdSpreadLot === frSpreadLot,
      message: dsgdSpreadLot !== frSpreadLot ? 'Sai khoi luong giao dich Spread' : undefined,
    },
    {
      field: 'LME (DSGD vs FR)',
      expected: dsgdLmeLot,
      actual: frLmeLot,
      passed: dsgdLmeLot === frLmeLot,
      message: dsgdLmeLot !== frLmeLot ? 'Sai khoi luong giao dich LME' : undefined,
    },
    {
      field: 'Options (DSGD vs FR)',
      expected: dsgdOptionsLot,
      actual: frOptionsLot,
      passed: dsgdOptionsLot === frOptionsLot,
      message: dsgdOptionsLot !== frOptionsLot ? 'Sai khoi luong giao dich Options' : undefined,
    },
  ];

  // Log các validation failed
  validations
    .filter((v) => !v.passed)
    .forEach((v) => {
      console.warn(`⚠️  [VALIDATION FAIL] ${v.field}: expected=${v.expected}, actual=${v.actual}`);
    });

  return {
    ngayGD: frConfig.ngayGD,
    dsgdProduct,
    dsgdSpread: dsgdSpreadLot,
    dsgdLme: dsgdLmeLot,
    dsgdOptions: dsgdOptionsLot,
    dsgdTotal,
    frProduct,
    frSpread: frSpreadLot,
    frLme: frLmeLot,
    frOptions: frOptionsLot,
    ttttProduct,
    ttttSpread: ttttSpreadLot,
    ttttLme: ttttLmeLot,
    ttttOptions: ttttOptionsLot,
    ttmProduct,
    ttmSpread: ttmSpreadLot,
    ttmLme: ttmLmeLot,
    ttmOptions: ttmOptionsLot,
    opProduct,
    opSpread: opSpreadLot,
    opLme: opLmeLot,
    opOptions: opOptionsLot,
    psProduct,
    psSpread: psSpreadLot,
    psLme: psLmeLot,
    psOptions: psOptionsLot,
    acmDsgdLot,
    acmTtttLot,
    acmTtmLot,
    validations,
  };
}
