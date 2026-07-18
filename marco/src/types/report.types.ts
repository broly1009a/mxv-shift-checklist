/**
 * Types cho output báo cáo tổng hợp
 * Tương đương với các cột trong file báo cáo lịch sử (ws.Cells(i, x))
 */

// ─── Kết quả tổng hợp số lot theo sản phẩm ──────────────────────────────────
export interface LotSummaryByProduct {
  /** Mã sản phẩm (SP) */
  maSP: string;
  /** KLM: Khối lượng mua (BUY lots) */
  klm: number;
  /** KLB: Khối lượng bán (SELL lots) */
  klb: number;
  /** Tổng KL */
  total: number;
}

export interface LotSummaryByTvkd {
  /** Mã TVKD (3 ký tự đầu mã TKGD) */
  tvkd: string;
  klm: number;
  klb: number;
  total: number;
}

// ─── Kết quả tổng hợp số lot theo nhóm ─────────────────────────────────────
export interface LotGroupSummary {
  /** Futures Product (không phải Spread/LME/Options) */
  product: number;
  /** Spread */
  spread: number;
  /** LME */
  lme: number;
  /** Options */
  options: number;
}

// ─── Báo cáo tổng hợp 1 ngày – mapping với các cột trong file lịch sử ───────
export interface DailyLotReport {
  ngayGD: Date;

  // ─ DSGD (CQG) ─
  /** Cột 3: Lot giao dịch Futures = DSGD.Q - Spread - LME - Options */
  dsgdProduct: number;
  /** Cột 6: Lot Spread Futures */
  dsgdSpread: number;
  /** Cột 9: Lot LME Futures */
  dsgdLme: number;
  /** Cột 12: Lot Options Futures */
  dsgdOptions: number;
  /** Tổng DSGD */
  dsgdTotal: number;

  // ─ FR (MXV System) ─
  /** Cột 17: Lot FR Product (trừ TRU, FEF, ZFT, QO/QP/BM/MPO) */
  frProduct: number;
  /** Cột 20: Lot FR Spread */
  frSpread: number;
  /** Cột 23: Lot FR LME */
  frLme: number;
  /** Cột 26: Lot FR Options */
  frOptions: number;

  // ─ Tất toán (TTTT) ─
  /** Cột 4: Lot tất toán Product */
  ttttProduct: number;
  /** Cột 7: Lot tất toán Spread */
  ttttSpread: number;
  /** Cột 10: Lot tất toán LME (trừ Expired) */
  ttttLme: number;
  /** Cột 13: Lot tất toán Options */
  ttttOptions: number;

  // ─ Trạng thái mở (TTM) ─
  /** Cột 5: Lot trạng thái mở Product */
  ttmProduct: number;
  /** Cột 8: Lot trạng thái mở Spread */
  ttmSpread: number;
  /** Cột 11: Lot trạng thái mở LME */
  ttmLme: number;
  /** Cột 14: Lot trạng thái mở Options */
  ttmOptions: number;

  // ─ OP (Open Position) ─
  /** Cột 19: Lot OP Product / 2 */
  opProduct: number;
  /** Cột 22: Lot OP Spread / 2 */
  opSpread: number;
  /** Cột 25: Lot OP LME / 2 */
  opLme: number;
  /** Cột 28: Lot OP Options */
  opOptions: number;

  // ─ PS (Pending Settlement) ─
  /** Cột 18: Lot PS Product / 2 */
  psProduct: number;
  /** Cột 21: Lot PS Spread */
  psSpread: number;
  /** Cột 24: Lot PS LME (trừ LME Expired) */
  psLme: number;
  /** Cột 27: Lot PS Options */
  psOptions: number;

  // ─ ACM ─
  /** ACM lot DSGD */
  acmDsgdLot: number;
  /** ACM lot TTTT */
  acmTtttLot: number;
  /** ACM lot TTM */
  acmTtmLot: number;

  // ─ Validation flags ─
  validations: ValidationResult[];
}

export interface ValidationResult {
  field: string;
  expected: number;
  actual: number;
  passed: boolean;
  message?: string;
}

// ─── Tổng hợp GTGD (Giá trị giao dịch) ─────────────────────────────────────
export interface GtgdSummary {
  /** Tên hàng hóa */
  maHH: string;
  /** GTGD = lot × giá × hệ số × tỷ giá */
  gtgd: number;
}

// ─── Bảng tra cứu hàng hóa (sheet HH, Hhoa Vlookup) ────────────────────────
export interface HangHoaLookup {
  /** Mã hàng hóa (ví dụ: TRU, MPO, LCOZ, ...) */
  maHH: string;
  /** Tên hàng hóa */
  tenHH: string;
  /** Hệ số quy đổi (cột 2 trong Hhoa Vlookup) */
  heSo: number;
  /** Đơn vị (cột 3 trong Hhoa Vlookup) */
  donVi: number;
}

// TyGiaConfig đã được định nghĩa trong trade-data.types.ts
// import { TyGiaConfig } from './trade-data.types';

// ─── Kết quả pivot aggregate ─────────────────────────────────────────────────
export interface PivotResult<T = Record<string, unknown>> {
  rows: T[];
  totalKlm: number;
  totalKlb: number;
  total: number;
}
