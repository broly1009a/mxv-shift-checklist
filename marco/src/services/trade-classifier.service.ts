/**
 * Trade Classifier Service
 * Thay thế các bước AutoFilter + Copy trong VBA Sub tong_hop()
 *
 * Logic phân loại từ VBA:
 * - DSGD: Futures (trừ ACM)  → field 4 (maTKGD) <> **-A*
 * - ACM:  ACM trades          → field 4 (maTKGD) *-A*
 *   - DSGD ACM:  maTKGD không bắt đầu bằng 999
 *   - Test ACM:  maTKGD bắt đầu bằng 999
 * - DSGD Spread:  maTKGD kết thúc -S
 * - DSGD LME:     maTKGD kết thúc -L
 * - DSGD Options: loaiHD bắt đầu C. hoặc P.
 */

import { DsgdRow, FrRow, TtmRow, OpRow, PsRow, TtttRow, ClassifiedTrades } from '../types/trade-data.types';
import { toNumber } from '../utils/excel-reader';

// ─── Helpers phân loại ───────────────────────────────────────────────────────

/** Kiểm tra mã TKGD có phải ACM không (kết thúc -A hoặc -A*) */
function isAcm(maTKGD?: string): boolean {
  if (!maTKGD) return false;
  return /-A[^-]*$/i.test(maTKGD) || maTKGD.toUpperCase().includes('-A');
}

/** Kiểm tra có phải ACM test (bắt đầu bằng 999) */
function isTestAcm(maTKGD?: string): boolean {
  if (!maTKGD) return false;
  return /^999/.test(maTKGD);
}

/** Kiểm tra Spread (maTKGD kết thúc -S) */
function isSpread(maTKGD?: string): boolean {
  if (!maTKGD) return false;
  return /-S$/i.test(maTKGD);
}

/** Kiểm tra LME (maTKGD kết thúc -L) */
function isLme(maTKGD?: string): boolean {
  if (!maTKGD) return false;
  return /-L$/i.test(maTKGD);
}

/** Kiểm tra Options (loaiHD bắt đầu C. hoặc P.) */
function isOptions(loaiHD?: string): boolean {
  if (!loaiHD) return false;
  return /^[CP]\./i.test(loaiHD);
}

// ─── Phân loại DSGD ──────────────────────────────────────────────────────────

export function classifyDsgd(rows: DsgdRow[]): {
  dsgd: DsgdRow[];
  dsgdSpread: DsgdRow[];
  dsgdLme: DsgdRow[];
  dsgdOptions: DsgdRow[];
  acm: DsgdRow[];
  dsgdAcm: DsgdRow[];
  testAcm: DsgdRow[];
} {
  // Bước 1: Tách ACM vs non-ACM
  // VBA: AutoFilter field:=4, Criteria1:="<>**-A*"   → non-ACM
  //      AutoFilter field:=4, Criteria1:="*-A*"       → ACM
  const acm = rows.filter((r) => isAcm(r.maTKGD));
  const dsgdAll = rows.filter((r) => !isAcm(r.maTKGD));

  // Bước 2: Trong ACM, tách Test ACM (999*) vs thường
  // VBA: AutoFilter field:=4, Criteria1:="<>999**"  → DSGD ACM
  //      AutoFilter field:=4, Criteria1:="999*"      → Test ACM
  const dsgdAcm = acm.filter((r) => !isTestAcm(r.maTKGD));
  const testAcm = acm.filter((r) => isTestAcm(r.maTKGD));

  // Bước 3: Từ DSGD thường, tách Spread / LME / Options
  // VBA: field:=4, Criteria1:="*-S"
  const dsgdSpread = dsgdAll.filter((r) => isSpread(r.maTKGD));
  const dsgdLme = dsgdAll.filter((r) => isLme(r.maTKGD));
  // VBA: field:=6, Criteria1:="C.*", Operator:=xlOr, Criteria2:="P.*"
  const dsgdOptions = dsgdAll.filter((r) => isOptions(r.loaiHD));
  // DSGD chính (tất cả, giữ nguyên không lọc bỏ để SUM column Q đúng)
  const dsgd = dsgdAll;

  return { dsgd, dsgdSpread, dsgdLme, dsgdOptions, acm, dsgdAcm, testAcm };
}

// ─── Phân loại FR ────────────────────────────────────────────────────────────

export function classifyFr(rows: FrRow[]): {
  fr: FrRow[];
  frSpread: FrRow[];
  frLme: FrRow[];
  frOptions: FrRow[];
} {
  // VBA: AutoFilter field:=1, Criteria1:="*S"  → FR Spread
  //      AutoFilter field:=1, Criteria1:="*L"  → FR LME
  //      AutoFilter field:=3, Criteria1:="C.*", Operator:=xlOr, Criteria2:="P.*"  → FR Options
  const frSpread = rows.filter((r) => r.maTKGD?.toUpperCase().endsWith('S'));
  const frLme = rows.filter((r) => r.maTKGD?.toUpperCase().endsWith('L'));
  const frOptions = rows.filter((r) => isOptions(r.col3 as string));

  return { fr: rows, frSpread, frLme, frOptions };
}

// ─── Phân loại TTM ───────────────────────────────────────────────────────────

export function classifyTtm(rows: TtmRow[]): {
  ttm: TtmRow[];
  ttmSpread: TtmRow[];
  ttmLme: TtmRow[];
  ttmOptions: TtmRow[];
  ttmRaw: TtmRow[];  // bao gồm cả ACM
  ttmAcm: TtmRow[];
} {
  // VBA: field:=8 (maTKGD) <> **-A*  → TTM (non-ACM)
  //      field:=8 *-A*                → TTM-ACM
  //      TTM-ACM field:=8 <> 999*     → TTM ACM (cleaned)
  const ttmRaw = rows; // TTM-ACM raw
  const ttmAcm = rows.filter((r) => isAcm(r.maTKGD) && !isTestAcm(r.maTKGD));
  const ttm = rows.filter((r) => !isAcm(r.maTKGD));

  // VBA: field:=8, Criteria1:="*-S"  → TTM Spread
  //      field:=8, Criteria1:="*-L"  → TTM LME
  //      field:=10 (loaiHD) C.*/P.*  → TTM Options
  const ttmSpread = ttm.filter((r) => isSpread(r.maTKGD));
  const ttmLme = ttm.filter((r) => isLme(r.maTKGD));
  const ttmOptions = ttm.filter((r) => isOptions(r.loaiHD));

  return { ttm, ttmSpread, ttmLme, ttmOptions, ttmRaw, ttmAcm };
}

// ─── Phân loại OP ────────────────────────────────────────────────────────────

export function classifyOp(rows: OpRow[]): {
  op: OpRow[];
  opSpread: OpRow[];
  opLme: OpRow[];
  opOptions: OpRow[];
} {
  // VBA: I2 = IF(D2="", 0, VALUE(D2)) + IF(E2="", 0, VALUE(E2))
  const processed = rows.map((r) => ({
    ...r,
    totalLots: toNumber(r.longLots) + toNumber(r.shortLots),
  }));

  // VBA: field:=1, Criteria1:="*S"  → OP Spread
  //      field:=1, Criteria1:="*L"  → OP LME
  //      field:=3 C.*/P.*           → OP Options
  const opSpread = processed.filter((r) => r.maTKGD?.toUpperCase().endsWith('S'));
  const opLme = processed.filter((r) => r.maTKGD?.toUpperCase().endsWith('L'));
  const opOptions = processed.filter((r) => isOptions(r.loaiHD));

  return { op: processed, opSpread, opLme, opOptions };
}

// ─── Phân loại PS ────────────────────────────────────────────────────────────

export function classifyPs(rows: PsRow[]): {
  ps: PsRow[];
  psSpread: PsRow[];
  psLme: PsRow[];
  psOptions: PsRow[];
} {
  // VBA: I2 = IF(E2="", 0, VALUE(E2))
  const processed = rows.map((r) => ({
    ...r,
    khoiLuongNum: toNumber(r.khoiLuong),
  }));

  const psSpread = processed.filter((r) => r.maTKGD?.toUpperCase().endsWith('S'));
  const psLme = processed.filter((r) => r.maTKGD?.toUpperCase().endsWith('L'));
  // VBA: field:=4 (loaiHD) C.*/P.*
  const psOptions = processed.filter((r) => isOptions(r.loaiHD));

  return { ps: processed, psSpread, psLme, psOptions };
}

// ─── Phân loại TTTT ──────────────────────────────────────────────────────────

export function classifyTttt(
  rows: TtttRow[],
  lkRows: TtttRow[] = [],
  filterMaKyHan?: string,
): {
  tttt: TtttRow[];
  ttttSpread: TtttRow[];
  ttttLme: TtttRow[];
  ttttOptions: TtttRow[];
  ttttAcm: TtttRow[];
  lmeExpired: TtttRow[];
} {
  // VBA: field:=8 (maTKGD) <> **-A*  → TTTT
  //      field:=8 *-A*                → TTTT-ACM
  //      TTTT-ACM field:=8 <> 999*   → TTTT ACM
  const ttttAcm = rows.filter((r) => isAcm(r.maTKGD) && !isTestAcm(r.maTKGD));
  let tttt = rows.filter((r) => !isAcm(r.maTKGD));

  // Append LK rows (lệnh LME bổ sung)
  // VBA: Append từ nwb filter by field:=25, Criteria1:=twb.Sheets("sheet2").Range("A77")
  if (lkRows.length > 0) {
    const filteredLk = filterMaKyHan
      ? lkRows.filter((r) => {
          const col25 = r[`col25`] as string | undefined;
          return col25 === filterMaKyHan;
        })
      : lkRows;
    tttt = [...tttt, ...filteredLk];
  }

  // Tính G column: RIGHT(J, 3) → 3 ký tự cuối của maKyHan
  const ttttWithG = tttt.map((r) => {
    const j = r[`col10`] as string | undefined;
    return {
      ...r,
      maKyHanNgan: j ? j.slice(-3) : '',
    };
  });

  // Phân loại theo field:=8 (maTKGD)
  const ttttSpread = ttttWithG.filter((r) => isSpread(r.maTKGD));
  const ttttLme = ttttWithG.filter((r) => isLme(r.maTKGD));
  // VBA: field:=10 C.*/P.*
  const ttttOptions = ttttWithG.filter((r) => isOptions(r.loaiHD));

  // LME Expired: TTTT LME filter thêm theo field:=7 (maKyHanNgan) = filterMaKyHan
  // VBA: .UsedRange.AutoFilter field:=8, Criteria1:="*-L"
  //      .UsedRange.AutoFilter field:=7, Criteria1:=dk (ngày đáo hạn)
  const lmeExpired = filterMaKyHan
    ? ttttLme.filter((r) => r.maKyHanNgan === filterMaKyHan)
    : [];

  return {
    tttt: ttttWithG,
    ttttSpread,
    ttttLme,
    ttttOptions,
    ttttAcm,
    lmeExpired,
  };
}

// ─── Main: Tổng hợp classify all ────────────────────────────────────────────

export function classifyAllTrades(params: {
  dsgdRows: DsgdRow[];
  frRows: FrRow[];
  ttmRows: TtmRow[];
  opRows: OpRow[];
  psRows: PsRow[];
  ttttRows: TtttRow[];
  lkRows?: TtttRow[];
  filterMaKyHan?: string;
}): ClassifiedTrades {
  const { dsgd, dsgdSpread, dsgdLme, dsgdOptions, dsgdAcm, testAcm } =
    classifyDsgd(params.dsgdRows);

  const { fr, frSpread, frLme, frOptions } = classifyFr(params.frRows);

  const { ttm, ttmSpread, ttmLme, ttmOptions, ttmAcm } = classifyTtm(
    params.ttmRows,
  );

  const { op, opSpread, opLme, opOptions } = classifyOp(params.opRows);
  const { ps, psSpread, psLme, psOptions } = classifyPs(params.psRows);

  const { tttt, ttttSpread, ttttLme, ttttOptions, ttttAcm, lmeExpired } =
    classifyTttt(params.ttttRows, params.lkRows, params.filterMaKyHan);

  return {
    dsgd,
    dsgdSpread,
    dsgdLme,
    dsgdOptions,
    dsgdAcm,
    testAcm,
    fr,
    frSpread,
    frLme,
    frOptions,
    ttm,
    ttmSpread,
    ttmLme,
    ttmOptions,
    ttmAcm,
    op,
    opSpread,
    opLme,
    opOptions,
    ps,
    psSpread,
    psLme,
    psOptions,
    tttt,
    ttttSpread,
    ttttLme,
    ttttOptions,
    ttttAcm,
    lmeExpired,
  };
}
