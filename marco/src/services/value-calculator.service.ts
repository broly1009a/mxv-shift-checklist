/**
 * Value Calculator Service
 * Thay thế Sub test() và copy_filethongkegtgd() trong VBA File 1
 *
 * Tính GTGD = lot × giá × hệ số HH × tỷ giá
 * và tổng hợp theo hàng hóa
 */

import { DsgdRow, HangHoaLookup, TyGiaConfig } from '../types/trade-data.types';
import { GtgdSummary } from '../types/report.types';
import { toNumber } from '../utils/excel-reader';

// ─── Bảng tra cứu hàng hóa ───────────────────────────────────────────────────

/**
 * Load bảng HH lookup (từ sheet HH và Hhoa Vlookup trong VBA)
 * Cần cung cấp data này từ file Excel hoặc hardcode
 */
export interface HHLookupEntry {
  maHH: string;      // Mã hàng hóa
  tenHH: string;     // Tên hàng hóa (cột 2 của HH sheet)
  heSo: number;      // Hệ số nhân (cột 2 của Hhoa Vlookup)
  donViQuyDoi: number; // Đơn vị quy đổi (cột 3 của Hhoa Vlookup)
}

// ─── Tính GTGD cho từng row ───────────────────────────────────────────────────

/**
 * Tính GTGD cho một giao dịch
 * VBA Formula:
 *   IF(HH="TRU",  lot * gia * vlookup(HH, heSo) * vlookup(HH, donVi) * tyGiaTRU,
 *   IF(HH="MPO",  lot * gia * vlookup(HH, heSo) * vlookup(HH, donVi) * tyGiaMPO,
 *                 lot * gia * vlookup(HH, heSo) * vlookup(HH, donVi) * tyGiaDefault))
 */
export function calcGtgdForRow(
  row: DsgdRow,
  maHH: string,
  hhMap: Map<string, HHLookupEntry>,
  tyGia: TyGiaConfig,
): number {
  const lot = toNumber(row.khoiLuong);
  const gia = toNumber(row.gia);

  const entry = hhMap.get(maHH);
  if (!entry) return 0;

  const heSo = entry.heSo;
  const donVi = entry.donViQuyDoi;

  let tyGiaValue: number;
  if (maHH === 'TRU') {
    tyGiaValue = tyGia.tyGiaTru;
  } else if (maHH === 'MPO') {
    tyGiaValue = tyGia.tyGiaMpo;
  } else {
    tyGiaValue = tyGia.tyGiaDefault;
  }

  return lot * gia * heSo * donVi * tyGiaValue;
}

// ─── Lấy mã HH từ DSGD row ────────────────────────────────────────────────────

/**
 * Lấy mã hàng hóa từ DSGD row
 * VBA DSGD: D2 = VLOOKUP(IF(RIGHT(G2,1)="L", LEFT(I2,3), LEFT(I2,FIND("2",I2)-2)), HH!A:C, 2, 0)
 *
 * Chú ý: trong VBA File 1, cột G là maTKGD (sau khi insert cột), cột I là maSanPham
 */
export function getMaHHFromDsgd(row: DsgdRow): string {
  const maTKGD = row.maTKGD || '';
  const maSanPham = row.maSanPham || row.maKyHan || '';

  if (maTKGD.toUpperCase().endsWith('L')) {
    // LME: LEFT(maSanPham, 3)
    return maSanPham.substring(0, 3);
  } else {
    // Futures: LEFT(maSanPham, FIND("2", maSanPham) - 2)
    const idx2 = maSanPham.indexOf('2');
    if (idx2 > 1) {
      return maSanPham.substring(0, idx2 - 1);
    }
    return maSanPham.substring(0, 3);
  }
}

/**
 * Lấy mã HH từ DSGD Spread row
 * VBA DSGD Spread: D2 = IFERROR(LEFT(I2, LEN(I2)-3), "")
 */
export function getMaHHFromSpread(row: DsgdRow): string {
  const maSanPham = row.maSanPham || row.maKyHan || '';
  return maSanPham.length > 3 ? maSanPham.substring(0, maSanPham.length - 3) : maSanPham;
}

// ─── Tính tổng GTGD theo hàng hóa ────────────────────────────────────────────

/**
 * Tổng hợp GTGD theo mã hàng hóa (thay PivotTable trong VBA)
 * Output: array sorted by maHH
 */
export function aggregateGtgd(
  rows: DsgdRow[],
  getMaHH: (row: DsgdRow) => string,
  hhMap: Map<string, HHLookupEntry>,
  tyGia: TyGiaConfig,
): GtgdSummary[] {
  const map = new Map<string, number>();

  for (const row of rows) {
    const maHH = getMaHH(row);
    if (!maHH) continue;

    const gtgd = calcGtgdForRow(row, maHH, hhMap, tyGia);
    const existing = map.get(maHH) ?? 0;
    map.set(maHH, existing + gtgd);
  }

  return Array.from(map.entries())
    .map(([maHH, gtgd]) => ({ maHH, gtgd }))
    .sort((a, b) => a.maHH.localeCompare(b.maHH));
}

// ─── Tổng hợp toàn bộ (Sub test() trong VBA File 1) ─────────────────────────

export interface GtgdReport {
  /** GTGD theo hàng hóa - tất cả DSGD (Futures) */
  dsgdByHH: GtgdSummary[];
  /** GTGD theo hàng hóa - chỉ Spread */
  spreadByHH: GtgdSummary[];
  /** Tổng GTGD toàn bộ */
  totalGtgd: number;
  /** Tổng GTGD Spread */
  totalSpreadGtgd: number;
}

export function calculateGtgdReport(params: {
  dsgdRows: DsgdRow[];
  spreadRows: DsgdRow[];
  hhMap: Map<string, HHLookupEntry>;
  tyGia: TyGiaConfig;
}): GtgdReport {
  const { dsgdRows, spreadRows, hhMap, tyGia } = params;

  const dsgdByHH = aggregateGtgd(dsgdRows, getMaHHFromDsgd, hhMap, tyGia);
  const spreadByHH = aggregateGtgd(spreadRows, getMaHHFromSpread, hhMap, tyGia);

  const totalGtgd = dsgdByHH.reduce((s, r) => s + r.gtgd, 0);
  const totalSpreadGtgd = spreadByHH.reduce((s, r) => s + r.gtgd, 0);

  return { dsgdByHH, spreadByHH, totalGtgd, totalSpreadGtgd };
}

// ─── Format số GTGD ───────────────────────────────────────────────────────────

/**
 * Format số theo định dạng VND (VBA: "#,##0 ")
 */
export function formatGtgd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

// ─── Default HH lookup (hardcode cho các HH phổ biến) ───────────────────────
// NOTE: Cần load từ sheet "HH" và "Hhoa Vlookup" trong file Excel thực tế

export const DEFAULT_HH_LOOKUP: HHLookupEntry[] = [
  // Ví dụ mẫu - cần xác nhận với file Excel thực
  { maHH: 'TRU', tenHH: 'Cao su', heSo: 1000, donViQuyDoi: 1, },
  { maHH: 'MPO', tenHH: 'Dầu cọ', heSo: 10, donViQuyDoi: 1, },
  { maHH: 'LCO', tenHH: 'Dầu thô Brent', heSo: 1, donViQuyDoi: 1, },
];

export function buildHHMap(entries: HHLookupEntry[]): Map<string, HHLookupEntry> {
  const map = new Map<string, HHLookupEntry>();
  for (const entry of entries) {
    map.set(entry.maHH, entry);
  }
  return map;
}
