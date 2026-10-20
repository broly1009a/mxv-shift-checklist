/**
 * ms-excel.parser.ts
 *
 * Lớp bóc tách dữ liệu thô từ file Excel xuất từ hệ thống lõi M-System (MS).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import * as XLSX from 'xlsx';
import { getNormalizedAccount, normalizeContractCode } from './symbol-normalizer.helper';
import { findHeaderIndex } from '../helpers/trading-math.helper';

/**
 * Đọc file DSGD (Danh sách giao dịch khớp lệnh M-System).
 */
export function parseDSGD(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const maLenhIdx = header.indexOf('Mã lệnh');
  const maTKGDIdx = header.indexOf('Mã TKGD');
  const maHDIdx = header.indexOf('Mã HĐ');
  const klGiaoDichIdx = header.indexOf('KL giao dịch');
  const giaKhopIdx = header.indexOf('Giá khớp');
  const ngayGioIdx = header.indexOf('Ngày giờ thực hiện');
  const maGDIdx = header.indexOf('Mã giao dịch');

  if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1) {
    throw new Error('Thiếu cột bắt buộc trong file DSGD.xlsx');
  }

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maLenh = String(row[maLenhIdx] || '').trim();
    const maTKGD = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const rawMaHD = String(row[maHDIdx] || '').trim();
    const maHD = normalizeContractCode(rawMaHD, 'MS');
    const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
    const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
    const ngayGio = ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';
    const maGD = maGDIdx !== -1 ? String(row[maGDIdx] || '').trim() : '';

    if (!maLenh || !maTKGD || !maHD) continue;

    result.push({
      maLenh,
      maTKGD,
      maHD,
      klGiaoDich,
      giaKhop,
      ngayGio,
      maGD,
      combinedKey: `${maTKGD}${maHD}${giaKhop}`,
    });
  }
  return result;
}

/**
 * Đọc file TTM (Trạng thái mở M-System).
 */
export function parseTTM(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const maTKGDIdx = header.findIndex((h) => h === 'Mã TKGD' || h === 'Mã tài khoản');
  const maHDIdx = header.findIndex((h) => h === 'Mã HĐ' || h === 'Mã hợp đồng');
  const tongMuaIdx = header.findIndex((h) => h.toLowerCase() === 'kl mua');
  const tongBanIdx = header.findIndex((h) => h.toLowerCase() === 'kl bán');
  const giaKhopIdx = header.findIndex((h) => h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình');

  if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1) {
    throw new Error('Thiếu cột bắt buộc trong file TTM.xlsx');
  }

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maTKGD = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const rawMaHD = String(row[maHDIdx] || '').trim();
    const maHD = normalizeContractCode(rawMaHD, 'MS');
    const tongMua = parseFloat(row[tongMuaIdx]) || 0;
    const tongBan = parseFloat(row[tongBanIdx]) || 0;
    const giaKhop = giaKhopIdx !== -1 ? parseFloat(row[giaKhopIdx]) || 0 : 0;

    if (!maTKGD || !maHD) continue;

    result.push({ maTKGD, maHD, tongMua, tongBan, giaKhop });
  }
  return result;
}

/**
 * Đọc file TTTT để lấy khối lượng phục vụ đối soát trong phiên.
 */
export function parseTTTTForVolume(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const maTKGDIdx = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account']);
  const maHDIdx = findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol']);
  const tongMuaIdx = findHeaderIndex(header, 'KL Mua', ['KL mua']);
  const tongBanIdx = findHeaderIndex(header, 'KL Bán', ['KL bán']);

  const finalAccIdx = maTKGDIdx !== -1 ? maTKGDIdx : 7;
  const finalSymIdx = maHDIdx !== -1 ? maHDIdx : 9;
  const finalMuaIdx = tongMuaIdx !== -1 ? tongMuaIdx : 15;
  const finalBanIdx = tongBanIdx !== -1 ? tongBanIdx : 16;

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maTKGD = getNormalizedAccount(String(row[finalAccIdx] || ''));
    const rawMaHD = String(row[finalSymIdx] || '').trim();
    const maHD = normalizeContractCode(rawMaHD, 'MS');
    const tongMua = parseFloat(row[finalMuaIdx]) || 0;
    const tongBan = parseFloat(row[finalBanIdx]) || 0;

    if (!maTKGD || !maHD) continue;
    result.push({ maTKGD, maHD, tongMua, tongBan });
  }
  return result;
}

/**
 * Đọc file TTTT để lấy vị thế ròng phục vụ đối chiếu Pre-EOD chốt 3 bên.
 */
export function parseTTTTForRecon(buffer: Buffer): { account: string; symbol: string; position: number }[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 0;
  let accountIdx = -1;
  let symbolIdx = -1;
  let positionIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const rowHeaders = rows[r].map((h) => String(h || '').trim());
    const tempAccIdx = findHeaderIndex(rowHeaders, 'Mã TKGD', ['mã tài khoản', 'account', 'tk']);
    const tempSymIdx = findHeaderIndex(rowHeaders, 'Mã HĐ', ['mã hợp đồng', 'symbol']);
    const tempPosIdx = findHeaderIndex(rowHeaders, 'KL ròng', ['khối lượng ròng', 'net position', 'vị thế ròng']);

    if (tempAccIdx !== -1 && tempSymIdx !== -1) {
      headerRowIdx = r;
      accountIdx = tempAccIdx;
      symbolIdx = tempSymIdx;
      if (tempPosIdx !== -1) positionIdx = tempPosIdx;
      break;
    }
  }

  if (accountIdx === -1 || symbolIdx === -1) {
    accountIdx = 7;
    symbolIdx = 9;
  }
  const finalPosIdx = positionIdx !== -1 ? positionIdx : 19;

  const result: { account: string; symbol: string; position: number }[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const accountRaw = String(row[accountIdx] || '').trim();
    const rawSymbol = String(row[symbolIdx] || '').trim();
    const position = parseFloat(row[finalPosIdx]) || 0;
    if (!accountRaw || !rawSymbol) continue;

    result.push({
      account: getNormalizedAccount(accountRaw),
      symbol: normalizeContractCode(rawSymbol, 'MS'),
      position,
    });
  }
  return result;
}

export interface ExecutiveTtmRow {
  account: string;
  symbol: string;
  tongMua: number;
  tongBan: number;
  expectedPnLVnd: number;
}

export interface ExecutiveTtttRow {
  account: string;
  symbol: string;
  liquidatedLots: number;
  realizedPnLVnd: number;
}

function parseAccountingNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.substring(1, str.length - 1);
  }
  str = str.replace(/,/g, '').trim();
  const n = parseFloat(str);
  if (isNaN(n)) return 0;
  return isNegative ? -Math.abs(n) : n;
}

/**
 * Đọc chi tiết file TTM phục vụ Dashboard QLGD:
 * Bóc tách Mã TKGD, Mã HĐ, KL Mua, KL Bán, và Lãi lỗ dự kiến (VND).
 */
export function parseTTMForExecutive(buffer: Buffer): ExecutiveTtmRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 0;
  let maTKGDIdx = -1;
  let maHDIdx = -1;
  let tongMuaIdx = -1;
  let tongBanIdx = -1;
  let pnlVndIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const header = rows[r].map((h) => String(h || '').trim());
    const tempAcc = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account', 'TKGD']);
    const tempSym = findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol', 'Hợp đồng']);
    const tempMua = findHeaderIndex(header, 'Khối lượng mua', ['KL Mua', 'KLM', 'Mua']);
    const tempBan = findHeaderIndex(header, 'Khối lượng bán', ['KL Bán', 'KLB', 'Bán']);
    const tempPnl = findHeaderIndex(header, 'Lãi lỗ dự kiến (VND)', [
      'Lãi lỗ dự kiến(VND)',
      'Lãi lỗ dự kiến VND',
      'PnL (VND)',
      'Lai lo du kien (VND)',
      'Lai lo du kien(VND)',
    ]);

    if (tempAcc !== -1 && tempSym !== -1) {
      headerRowIdx = r;
      maTKGDIdx = tempAcc;
      maHDIdx = tempSym;
      tongMuaIdx = tempMua;
      tongBanIdx = tempBan;
      pnlVndIdx = tempPnl;
      break;
    }
  }

  if (maTKGDIdx === -1 || maHDIdx === -1) return [];

  const result: ExecutiveTtmRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const account = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const rawMaHD = String(row[maHDIdx] || '').trim();
    const symbol = normalizeContractCode(rawMaHD, 'MS');
    const tongMua = tongMuaIdx !== -1 ? parseAccountingNumber(row[tongMuaIdx]) : 0;
    const tongBan = tongBanIdx !== -1 ? parseAccountingNumber(row[tongBanIdx]) : 0;
    const expectedPnLVnd = pnlVndIdx !== -1 ? parseAccountingNumber(row[pnlVndIdx]) : 0;

    if (!account || !symbol) continue;

    result.push({
      account,
      symbol,
      tongMua,
      tongBan,
      expectedPnLVnd,
    });
  }
  return result;
}

/**
 * Đọc chi tiết file TTTT phục vụ Dashboard QLGD:
 * Bóc tách Mã TKGD, Mã HĐ, Khối lượng tất toán, và Lãi lỗ thực tế (VND).
 */
export function parseTTTTForExecutive(buffer: Buffer): ExecutiveTtttRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 0;
  let maTKGDIdx = -1;
  let maHDIdx = -1;
  let muaTatToanIdx = -1;
  let banTatToanIdx = -1;
  let pnlThucTeIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const header = rows[r].map((h) => String(h || '').trim());
    const tempAcc = findHeaderIndex(header, 'Mã TKGD', ['Mã tài khoản', 'Account', 'TKGD']);
    const tempSym = findHeaderIndex(header, 'Mã HĐ', ['Mã hợp đồng', 'Symbol', 'Hợp đồng']);
    const tempMua = findHeaderIndex(header, 'KL Mua tất toán', ['KL Mua', 'Số lô', 'KL tất toán']);
    const tempBan = findHeaderIndex(header, 'KL Bán tất toán', ['KL Bán', 'KL bán tất toán']);
    const tempPnl = findHeaderIndex(header, 'Lãi lỗ thực tế (VND)', [
      'Lãi lỗ thực tế(VND)',
      'Lãi lỗ thực tế VND',
      'Realized PnL (VND)',
      'Realized PnL(VND)',
      'Lai lo thuc te (VND)',
      'Lai lo thuc te(VND)',
    ]);

    if (tempAcc !== -1 && tempSym !== -1) {
      headerRowIdx = r;
      maTKGDIdx = tempAcc;
      maHDIdx = tempSym;
      muaTatToanIdx = tempMua;
      banTatToanIdx = tempBan;
      pnlThucTeIdx = tempPnl;
      break;
    }
  }

  if (maTKGDIdx === -1 || maHDIdx === -1) return [];

  const result: ExecutiveTtttRow[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const account = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const rawMaHD = String(row[maHDIdx] || '').trim();
    const symbol = normalizeContractCode(rawMaHD, 'MS');

    const klMua = muaTatToanIdx !== -1 ? parseAccountingNumber(row[muaTatToanIdx]) : 0;
    const klBan = banTatToanIdx !== -1 ? parseAccountingNumber(row[banTatToanIdx]) : 0;
    const liquidatedLots = klMua + klBan;
    const realizedPnLVnd = pnlThucTeIdx !== -1 ? parseAccountingNumber(row[pnlThucTeIdx]) : 0;

    if (!account || !symbol) continue;

    result.push({
      account,
      symbol,
      liquidatedLots,
      realizedPnLVnd,
    });
  }
  return result;
}

