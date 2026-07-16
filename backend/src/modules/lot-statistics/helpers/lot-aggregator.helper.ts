/**
 * lot-aggregator.helper.ts
 * Tổng hợp KLM/KLB theo mã SP và TVKD
 * Thay thế PivotTable trong VBA (PivotTable7, 8, 9, 10, 11, 13)
 */

import { ParsedRow, toNum, toStr } from './excel-parser.helper';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LotByProduct {
  maSP: string;
  klm: number; // Khối lượng mua (BUY)
  klb: number; // Khối lượng bán (SELL)
  total: number;
}

export interface LotByTvkd {
  tvkd: string; // 3 ký tự đầu maTKGD
  klm: number;
  klb: number;
  total: number;
}

// ─── Sum helpers ──────────────────────────────────────────────────────────────

export function sumDsgdLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const lot = toNum(r['KL giao dịch'] ?? r['KL'] ?? r['Khối lượng'] ?? r['col13'] ?? r['col17']);
    return s + lot;
  }, 0);
}

/**
 * Sum cột lot trong TTM rows (VBA: Sum(TTM.N+O) = KLM + KLB)
 * VBA: Columns("N:O").Insert → cột N=KLM, O=KLB sau insert
 */
export function sumTtmLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    // TTM: KLM và KLB được tính từ cột Số lô (col14) theo chiều BUY/SELL
    // Tổng = col14 + col15 (sau khi VBA insert cột N, O)
    const klm = toNum(r['KLM'] ?? r['col14']);
    const klb = toNum(r['KLB'] ?? r['col15']);
    return s + klm + klb;
  }, 0);
}

/**
 * Sum cột lot trong TTTT rows (VBA: Sum(TTTT.P) = cột 16)
 */
export function sumTtttLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    return s + toNum(r['KL Mua'] ?? r['KL'] ?? r['Số lô'] ?? r['col16']);
  }, 0);
}

/**
 * Sum cột I trong FR rows (VBA: I = VALUE(F) = col6 → số)
 */
export function sumFrLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    return s + toNum(r['Qty'] ?? r['KL'] ?? r['col6'] ?? r['col9']);
  }, 0);
}

/**
 * Sum cột I trong OP rows (VBA: I = VALUE(D) + VALUE(E) = col4 + col5)
 */
export function sumOpLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    const long = toNum(r['Long'] ?? r['col4']);
    const short = toNum(r['Short'] ?? r['col5']);
    return s + long + short;
  }, 0);
}

/**
 * Sum cột I trong PS rows (VBA: I = VALUE(E) = col5)
 */
export function sumPsLot(rows: ParsedRow[]): number {
  return rows.reduce((s, r) => {
    return s + toNum(r['L (3844)'] ?? r['KL'] ?? r['col5']);
  }, 0);
}

// ─── Aggregate by product ─────────────────────────────────────────────────────

/**
 * Lấy mã SP từ DSGD row
 * VBA DSGD: G2 = VLOOKUP(IF(RIGHT(E,1)="L", LEFT(H,3), LEFT(H, FIND("2",H)-2)), HH!A:C, 2)
 * Simplified: lấy phần tên hàng hóa từ mã kỳ hạn
 */
export function getSPFromDsgd(row: ParsedRow): string {
  const maTKGD = toStr(row['Mã TKGD'] ?? row['col4']);
  const maKyHan = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['col6'] ?? row['Kỳ hạn'] ?? row['col8'] ?? row['col9']);

  if (maTKGD.toUpperCase().endsWith('L')) {
    // LME: LEFT(maKyHan, 3)
    return maKyHan.substring(0, 3).toUpperCase();
  } else {
    // Futures: LEFT(maKyHan, FIND("2", maKyHan) - 2)
    const idx = maKyHan.indexOf('2');
    if (idx > 1) return maKyHan.substring(0, idx - 1).toUpperCase();
    return maKyHan.substring(0, 3).toUpperCase();
  }
}

/**
 * Lấy mã SP từ DSGD Spread row
 * VBA: G2 = LEFT(F2, LEN(F2)-3) → bỏ 3 ký tự cuối mã kỳ hạn
 */
export function getSPFromSpread(row: ParsedRow): string {
  const maKyHan = toStr(row['Mã HĐ'] ?? row['Mã Hợp Đồng'] ?? row['col6'] ?? row['Kỳ hạn'] ?? row['col8'] ?? row['col9']);
  return maKyHan.length > 3
    ? maKyHan.substring(0, maKyHan.length - 3).toUpperCase()
    : maKyHan.toUpperCase();
}

/**
 * Aggregate KLM/KLB theo mã SP từ DSGD rows
 * VBA: PivotTable với Row=SP, Values=Sum(KLM), Sum(KLB)
 */
export function aggregateByProduct(
  rows: ParsedRow[],
  getSP: (row: ParsedRow) => string = getSPFromDsgd,
): LotByProduct[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const row of rows) {
    const sp = getSP(row);
    if (!sp) continue;

    const side = toStr(row['Chiều mua bán'] ?? row['Chiều'] ?? row['Side'] ?? row['col11'] ?? row['col13']).toUpperCase();
    const lot = toNum(row['KL giao dịch'] ?? row['KL'] ?? row['col13'] ?? row['col17']);

    const curr = map.get(sp) ?? { klm: 0, klb: 0 };
    if (side === 'BUY' || side === 'MUA') curr.klm += lot;
    else if (side === 'SELL' || side === 'BAN') curr.klb += lot;
    map.set(sp, curr);
  }

  return Array.from(map.entries())
    .filter(([sp]) => sp !== '')
    .map(([maSP, { klm, klb }]) => ({ maSP, klm, klb, total: klm + klb }))
    .sort((a, b) => a.maSP.localeCompare(b.maSP));
}

/**
 * Aggregate KLM/KLB theo TVKD (3 ký tự đầu maTKGD)
 * VBA: PivotTable với Row=TVKD, Values=Sum(KLM), Sum(KLB)
 */
export function aggregateByTvkd(rows: ParsedRow[]): LotByTvkd[] {
  const map = new Map<string, { klm: number; klb: number }>();

  for (const row of rows) {
    const maTKGD = toStr(row['Mã TKGD'] ?? row['col4']);
    const tvkd = maTKGD.substring(0, 3).toUpperCase();
    if (!tvkd) continue;

    const side = toStr(row['Chiều mua bán'] ?? row['Chiều'] ?? row['Side'] ?? row['col11'] ?? row['col13']).toUpperCase();
    const lot = toNum(row['KL giao dịch'] ?? row['KL'] ?? row['col13'] ?? row['col17']);

    const curr = map.get(tvkd) ?? { klm: 0, klb: 0 };
    if (side === 'BUY' || side === 'MUA') curr.klm += lot;
    else if (side === 'SELL' || side === 'BAN') curr.klb += lot;
    map.set(tvkd, curr);
  }

  return Array.from(map.entries())
    .filter(([tvkd]) => tvkd !== '')
    .map(([tvkd, { klm, klb }]) => ({ tvkd, klm, klb, total: klm + klb }))
    .sort((a, b) => a.tvkd.localeCompare(b.tvkd));
}
