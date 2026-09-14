/**
 * ccp-classifier.helper.ts
 * Phân loại giao dịch CCP theo Mã TKGD (col[5])
 *
 * Hiện tại CCP chỉ có tài khoản ACM (-A).
 * Thiết kế future-ready để đón nhận Spread (-S), LME (L), Options khi CCP migrate.
 *
 * CCP DSGD Column Mapping (từ file thực tế):
 *   col[0]  = Ngày hệ thống
 *   col[1]  = Ngày phiên
 *   col[5]  = Mã TKGD        ← phân loại ACM/Spread/LME
 *   col[6]  = Mã HĐ          ← mã kỳ hạn (để tách tên HH)
 *   col[7]  = Mua/Bán        ← "Mua" | "Bán"
 *   col[8]  = Loại lệnh      ← MKT | LMT | STP | STL
 *   col[10] = KL khớp        ← số lot
 *   col[13] = Giá khớp TB    ← giá (ngoại tệ)
 *   col[21] = Mã thành viên  ← TVKD 3 ký tự
 */

export interface CcpDsgdRow {
  raw: any[];
  maTKGD: string;
  maTvkd: string;
  maHD: string;
  muaBan: string;    // 'Mua' | 'Bán'
  loaiLenh: string;  // MKT | LMT | STP | STL
  klKhop: number;
  giaKhop: number;   // đơn vị ngoại tệ
}

export interface CcpTtmRow {
  raw: any[];
  maTvkd: string;    // col[0]
  maTKGD: string;    // col[3]
  maHD: string;      // col[5]
  klMua: number;     // col[8]
  klBan: number;     // col[9]
  laiLoDuKien: number;     // col[13] (ngoại tệ)
  laiLoDuKienVnd: number;  // col[14]
}

export interface CcpTtttRow {
  raw: any[];
  maTvkd: string;    // col[0]
  maTKGD: string;    // col[3]
  maHD: string;      // col[7]
  laiLoThucTe: number;    // col[4] (ngoại tệ)
  laiLoThucTeVnd: number; // col[5]
  klMua: number;     // col[9]
  klBan: number;     // col[10]
}

// ─── Account Type Classifiers (future-ready) ─────────────────────────────────

/** ACM: mã TKGD kết thúc -A (ví dụ: 041P0686868-A) */
export function isCcpAcm(maTKGD: string): boolean {
  return /-A$/i.test(maTKGD.trim());
}

/** Spread: mã TKGD kết thúc -S */
export function isCcpSpread(maTKGD: string): boolean {
  return /-S$/i.test(maTKGD.trim());
}

/** LME: mã TKGD kết thúc L (không phải -L) */
export function isCcpLme(maTKGD: string): boolean {
  if (!maTKGD) return false;
  return maTKGD.trim().toUpperCase().endsWith('L');
}

/** Options: mã HĐ bắt đầu C. hoặc P. */
export function isCcpOptions(maHD: string): boolean {
  return /^[CP]\./i.test(maHD.trim());
}

// ─── Row Parsers ─────────────────────────────────────────────────────────────

function parseNum(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseStr(val: any): string {
  return val === null || val === undefined ? '' : String(val).trim();
}

/** Parse một row từ file DSGD CCP (array format, 25 cols) */
export function parseCcpDsgdRow(raw: any[]): CcpDsgdRow {
  return {
    raw,
    maTKGD: parseStr(raw[5]),
    maTvkd: parseStr(raw[21]),
    maHD: parseStr(raw[6]),
    muaBan: parseStr(raw[7]),     // "Mua" | "Bán"
    loaiLenh: parseStr(raw[8]),   // MKT | LMT | STP | STL
    klKhop: parseNum(raw[10]),
    giaKhop: parseNum(raw[13]),
  };
}

/** Parse một row từ file TTM CCP (24 cols) */
export function parseCcpTtmRow(raw: any[]): CcpTtmRow {
  return {
    raw,
    maTvkd: parseStr(raw[0]),
    maTKGD: parseStr(raw[3]),
    maHD: parseStr(raw[5]),
    klMua: parseNum(raw[8]),
    klBan: parseNum(raw[9]),
    laiLoDuKien: parseNum(raw[13]),
    laiLoDuKienVnd: parseNum(raw[14]),
  };
}

/** Parse một row từ file TTTT CCP (31 cols) */
export function parseCcpTtttRow(raw: any[]): CcpTtttRow {
  return {
    raw,
    maTvkd: parseStr(raw[0]),
    maTKGD: parseStr(raw[3]),
    maHD: parseStr(raw[7]),
    laiLoThucTe: parseNum(raw[4]),
    laiLoThucTeVnd: parseNum(raw[5]),
    klMua: parseNum(raw[9]),
    klBan: parseNum(raw[10]),
  };
}

// ─── Classified output ───────────────────────────────────────────────────────

export interface CcpDsgdClassified {
  all: CcpDsgdRow[];       // tất cả
  acm: CcpDsgdRow[];       // -A
  spread: CcpDsgdRow[];    // -S (future)
  lme: CcpDsgdRow[];       // L  (future)
  options: CcpDsgdRow[];   // mã HĐ bắt đầu C./P. (future)
  normal: CcpDsgdRow[];    // còn lại (Futures thường, future)
}

/**
 * Phân loại DSGD CCP theo Mã TKGD.
 * Hiện tại chủ yếu ACM; các loại khác được chuẩn bị future-ready.
 */
export function classifyCcpDsgd(rows: CcpDsgdRow[]): CcpDsgdClassified {
  const acm = rows.filter((r) => isCcpAcm(r.maTKGD));
  const spread = rows.filter((r) => !isCcpAcm(r.maTKGD) && isCcpSpread(r.maTKGD));
  const lme = rows.filter(
    (r) => !isCcpAcm(r.maTKGD) && !isCcpSpread(r.maTKGD) && isCcpLme(r.maTKGD),
  );
  const options = rows.filter(
    (r) =>
      !isCcpAcm(r.maTKGD) &&
      !isCcpSpread(r.maTKGD) &&
      !isCcpLme(r.maTKGD) &&
      isCcpOptions(r.maHD),
  );
  const normal = rows.filter(
    (r) =>
      !isCcpAcm(r.maTKGD) &&
      !isCcpSpread(r.maTKGD) &&
      !isCcpLme(r.maTKGD) &&
      !isCcpOptions(r.maHD),
  );

  return { all: rows, acm, spread, lme, options, normal };
}

// ─── HH Code Extraction ───────────────────────────────────────────────────────

/**
 * Tách mã Hàng Hóa (maHH) từ mã hợp đồng CCP.
 *
 * ĐÃ XÁC NHẬN từ file "Mã HĐ CCP_14_06.xlsx":
 *   Mã HH luôn là 5 ký tự đầu của Mã HĐ (prefix cố định trước kỳ hạn).
 *
 * Ví dụ thực tế:
 *   "SI5COZ26" → "SI5CO"  (Bạc Nano ACM, 100 Pound, USD)
 *   "CP2COZ26" → "CP2CO"  (Đồng Nano ACM, 1000 Pound, USD)
 *   "PL1NYZ26" → "PL1NY"  (Bạch Kim Nano ACM, 5 Pound, USD)
 *
 * Future (Phase 2 – Spread/LME/Options): có thể điều chỉnh theo độ dài mã HH.
 */
export function getMaHHFromCcpMaHD(maHD: string, _maTKGD: string): string {
  if (!maHD || maHD.length < 5) return maHD?.toUpperCase() ?? '';
  // Cố định 5 ký tự đầu là mã HH
  return maHD.substring(0, 5).toUpperCase();
}

/**
 * Tra bảng thông số HH từ file Mã HĐ CCP.
 * Mỗi entry có: maHH, doCao (độ lớn HĐ), donVi, tienTe
 * Dùng để tính GTGD = KL × Giá × doCao × tyGia
 */
export interface CcpHhSpec {
  maHH: string;      // PL1NY, CP2CO, SI5CO...
  tenHH: string;     // Bạch kim Nano, Đồng Nano, Bạc Nano...
  doCao: number;     // Độ lớn hợp đồng (5 / 1000 / 100)
  donVi: string;     // Pound
  tienTe: string;    // USD
}

/**
 * Danh sách HH ACM hiện tại (đã xác nhận từ file Mã HĐ CCP_14_06.xlsx).
 * Đây là baseline; các HH mới sẽ được thêm khi CCP migrate Spread/LME.
 */
export const CCP_HH_DEFAULTS: CcpHhSpec[] = [
  { maHH: 'PL1NY', tenHH: 'Bạch kim Nano ACM', doCao: 5,    donVi: 'Pound', tienTe: 'USD' },
  { maHH: 'CP2CO', tenHH: 'Đồng Nano ACM',     doCao: 1000, donVi: 'Pound', tienTe: 'USD' },
  { maHH: 'SI5CO', tenHH: 'Bạc Nano ACM',      doCao: 100,  donVi: 'Pound', tienTe: 'USD' },
];

/** Tra nhanh spec HH theo mã (O(1)) */
export function getCcpHhSpec(maHH: string, overrides?: CcpHhSpec[]): CcpHhSpec | undefined {
  const list = overrides ?? CCP_HH_DEFAULTS;
  return list.find((h) => h.maHH === maHH.toUpperCase());
}
