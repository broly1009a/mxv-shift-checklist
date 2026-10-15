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
