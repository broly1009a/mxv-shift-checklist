/**
 * trade-classifier.helper.ts
 * Phân loại giao dịch theo logic AutoFilter của VBA
 *
 * Mapping VBA → TypeScript:
 *   AutoFilter field:=4, Criteria1:="*-S"  →  row.col4?.endsWith('-S')
 *   AutoFilter field:=6, Criteria1:="C.*"  →  /^[CP]\./.test(row.col6)
 */

import { ParsedRow, toStr } from './excel-parser.helper';

// ─── Helper patterns ──────────────────────────────────────────────────────────

/** Mã TKGD có phải ACM không: kết thúc -A hoặc chứa -A */
export function isAcm(maTKGD: string): boolean {
  return /-A[^-]*$/i.test(maTKGD) || /-A$/i.test(maTKGD);
}

/** ACM test account: mã bắt đầu 999 */
export function isTestAcm(maTKGD: string): boolean {
  return /^999/i.test(maTKGD);
}

/** Spread: kết thúc -S */
export function isSpread(maTKGD: string): boolean {
  return /-S$/i.test(maTKGD);
}

/** LME: kết thúc -L */
/** LME: kết thúc bằng ký tự L (ví dụ "-L" hoặc "L") */
export function isLme(maTKGD: string): boolean {
  if (!maTKGD) return false;
  const s = maTKGD.toString().trim().toUpperCase();
  return s.endsWith('L');
}

/** Options: loại hợp đồng bắt đầu C. hoặc P. */
export function isOptions(loaiHD: string): boolean {
  return /^[CP]\./i.test(loaiHD);
}

// ─── DSGD Classifier ─────────────────────────────────────────────────────────
// VBA: Sheet2!A5, col4 = maTKGD (field:=4 = cột D), col6 = loaiHD, col17 = lot

export interface DsgdClassified {
  dsgd: ParsedRow[];         // Tất cả Futures (kể cả Spread/LME/Options, trừ ACM)
  dsgdSpread: ParsedRow[];
  dsgdLme: ParsedRow[];
  dsgdOptions: ParsedRow[];
  acm: ParsedRow[];          // Tất cả ACM
  dsgdAcm: ParsedRow[];      // ACM thường (không phải test)
  testAcm: ParsedRow[];      // ACM test (999*)
}

/**
 * Phân loại DSGD từ file CQG
 * VBA col index: col4=maTKGD, col6=loaiHD, col17=lot (cột Q)
 * Nếu file có header tên "Mã TKGD" thì dùng header, fallback sang col4
 */
export function classifyDsgd(rows: ParsedRow[]): DsgdClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Mã TKGD'] ?? r['MA_TKGD'] ?? r['col4']);
  const getLoaiHD = (r: ParsedRow) =>
    toStr(r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['Loại HĐ'] ?? r['LOAI_HD'] ?? r['col6']);

  const acm = rows.filter((r) => isAcm(getMaTKGD(r)));
  const dsgd = rows.filter((r) => !isAcm(getMaTKGD(r)));

  const dsgdAcm = acm.filter((r) => !isTestAcm(getMaTKGD(r)));
  const testAcm = acm.filter((r) => isTestAcm(getMaTKGD(r)));

  const dsgdSpread = dsgd.filter((r) => isSpread(getMaTKGD(r)));
  const dsgdLme = dsgd.filter((r) => isLme(getMaTKGD(r)));
  const dsgdOptions = dsgd.filter((r) => isOptions(getLoaiHD(r)));

  return { dsgd, dsgdSpread, dsgdLme, dsgdOptions, acm, dsgdAcm, testAcm };
}

// ─── FR Classifier ────────────────────────────────────────────────────────────
// VBA: Sheet2!A13, col1=maTKGD, col3=maSP, col6=lot(string)
// Filter: col1 *S → Spread, col1 *L → LME, col3 C.|P. → Options

export interface FrClassified {
  fr: ParsedRow[];
  frSpread: ParsedRow[];
  frLme: ParsedRow[];
  frOptions: ParsedRow[];
}

export function classifyFr(rows: ParsedRow[]): FrClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Account'] ?? r['Mã TKGD'] ?? r['col1']);
  const getMaSP = (r: ParsedRow) =>
    toStr(r['Symbol'] ?? r['Mã SP'] ?? r['col3']);

  const frSpread = rows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('S'));
  const frLme = rows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('L'));
  const frOptions = rows.filter((r) => isOptions(getMaSP(r)));

  return { fr: rows, frSpread, frLme, frOptions };
}

// ─── TTM Classifier ───────────────────────────────────────────────────────────
// VBA: Sheet2!A10, col8=maTKGD (field:=8), col10=loaiHD (field:=10)
// Filter: col8 <>*-A* → ttm, *-A* → ttmRaw
//   ttm: col8 *-S/*-L, col10 C.|P. → Options

export interface TtmClassified {
  ttm: ParsedRow[];
  ttmSpread: ParsedRow[];
  ttmLme: ParsedRow[];
  ttmOptions: ParsedRow[];
  ttmAcm: ParsedRow[];
}

export function classifyTtm(rows: ParsedRow[]): TtmClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Mã TKGD'] ?? r['col8']);
  const getLoaiHD = (r: ParsedRow) =>
    toStr(r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['Loại HĐ'] ?? r['col10']);

  const ttmAcm = rows
    .filter((r) => isAcm(getMaTKGD(r)))
    .filter((r) => !isTestAcm(getMaTKGD(r)));
  const ttm = rows.filter((r) => !isAcm(getMaTKGD(r)));

  const ttmSpread = ttm.filter((r) => isSpread(getMaTKGD(r)));
  const ttmLme = ttm.filter((r) => isLme(getMaTKGD(r)));
  const ttmOptions = ttm.filter((r) => isOptions(getLoaiHD(r)));

  return { ttm, ttmSpread, ttmLme, ttmOptions, ttmAcm };
}

// ─── TTTT Classifier ──────────────────────────────────────────────────────────
// VBA: Sheet2!A11, cùng pattern với TTM (col8=maTKGD, col10=loaiHD)
// Thêm: lmeExpired = ttttLme filter thêm col7 (maKyHanNgan) = filterKyHan

export interface TtttClassified {
  tttt: ParsedRow[];
  ttttSpread: ParsedRow[];
  ttttLme: ParsedRow[];
  ttttOptions: ParsedRow[];
  ttttAcm: ParsedRow[];
  lmeExpired: ParsedRow[];
}

export function classifyTttt(
  rows: ParsedRow[],
  filterLmeKyHan?: string,
): TtttClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Mã TKGD'] ?? r['col8']);
  const getLoaiHD = (r: ParsedRow) =>
    toStr(r['Mã HĐ'] ?? r['Mã Hợp Đồng'] ?? r['Loại HĐ'] ?? r['col10']);
  // VBA: G2 = RIGHT(J2, 3) → 3 ký tự cuối col10 (maKyHan)
  const getMaKyHanNgan = (r: ParsedRow) => {
    const j = toStr(r['Mã HĐ'] ?? r['Kỳ hạn'] ?? r['col10'] ?? '');
    return j.slice(-3);
  };

  const ttttAcm = rows
    .filter((r) => isAcm(getMaTKGD(r)))
    .filter((r) => !isTestAcm(getMaTKGD(r)));
  const tttt = rows.filter((r) => !isAcm(getMaTKGD(r)));

  const ttttSpread = tttt.filter((r) => isSpread(getMaTKGD(r)));
  const ttttLme = tttt.filter((r) => isLme(getMaTKGD(r)));
  const ttttOptions = tttt.filter((r) => isOptions(getLoaiHD(r)));

  // LME Expired: LME + kỳ hạn đã hết hạn
  const lmeExpired =
    filterLmeKyHan
      ? ttttLme.filter((r) => getMaKyHanNgan(r) === filterLmeKyHan)
      : [];

  return { tttt, ttttSpread, ttttLme, ttttOptions, ttttAcm, lmeExpired };
}

// ─── OP Classifier ────────────────────────────────────────────────────────────
// VBA: Sheet2!A14, col1=maTKGD, col3=loaiHD, col4=long, col5=short
// I = VALUE(col4) + VALUE(col5)

export interface OpClassified {
  op: ParsedRow[];
  opSpread: ParsedRow[];
  opLme: ParsedRow[];
  opOptions: ParsedRow[];
}

export function classifyOp(rows: ParsedRow[]): OpClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Account'] ?? r['Mã TKGD'] ?? r['col1']);
  const getLoaiHD = (r: ParsedRow) =>
    toStr(r['Symbol'] ?? r['Mã HĐ'] ?? r['Loại HĐ'] ?? r['col3']);

  const validRows = rows.filter((r) => getMaTKGD(r) !== '');

  const opSpread = validRows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('S'));
  const opLme = validRows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('L'));
  const opOptions = validRows.filter((r) => isOptions(getLoaiHD(r)));

  return { op: validRows, opSpread, opLme, opOptions };
}

// ─── PS Classifier ────────────────────────────────────────────────────────────
// VBA: Sheet2!A158, col1=maTKGD, col4=loaiHD, col5=lot

export interface PsClassified {
  ps: ParsedRow[];
  psSpread: ParsedRow[];
  psLme: ParsedRow[];
  psOptions: ParsedRow[];
}

export function classifyPs(rows: ParsedRow[]): PsClassified {
  const getMaTKGD = (r: ParsedRow) =>
    toStr(r['Account'] ?? r['Mã TKGD'] ?? r['col1']);
  const getLoaiHD = (r: ParsedRow) =>
    toStr(r['Symbol'] ?? r['Mã HĐ'] ?? r['Loại HĐ'] ?? r['col4']);

  const validRows = rows.filter((r) => getMaTKGD(r) !== '');

  const psSpread = validRows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('S'));
  const psLme = validRows.filter((r) => getMaTKGD(r).toUpperCase().endsWith('L'));
  const psOptions = validRows.filter((r) => isOptions(getLoaiHD(r)));

  return { ps: validRows, psSpread, psLme, psOptions };
}
