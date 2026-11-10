/**
 * ms-excel.parser.ts
 *
 * Lớp bóc tách dữ liệu thô từ file Excel xuất từ hệ thống lõi M-System (MS).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import * as XLSX from 'xlsx';
import { getNormalizedAccount, normalizeContractCode } from './symbol-normalizer.helper';

/**
 * Đọc file DSGD (Danh sách giao dịch khớp lệnh M-System).
 * Bám sát 100% chuẩn đối chiếu C# FileUtils.cs#L769-L792:
 * Header cố định ở dòng 1 (rows[0]), bắt buộc đủ 7 cột chuẩn hóa tiếng Việt:
 * "Mã lệnh", "Mã TKGD", "Mã HĐ", "KL giao dịch", "Giá khớp", "Ngày giờ thực hiện", "Mã giao dịch".
 */
export function parseDSGD(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  // Header luôn cố định ở dòng 1 theo chuẩn C# FileUtils.cs#L777-L788
  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const maLenhIdx = findCol('Mã lệnh');
  const maTKGDIdx = findCol('Mã TKGD');
  const maHDIdx = findCol('Mã HĐ');
  const klGiaoDichIdx = findCol('KL giao dịch');
  const giaKhopIdx = findCol('Giá khớp');
  const ngayGioIdx = findCol('Ngày giờ thực hiện');
  const maGDIdx = findCol('Mã giao dịch');

  // Chuẩn Fail-Fast C# FileUtils.cs#L790-L791: Thiếu dù chỉ 1 cột lập tức ném lỗi
  if (
    maLenhIdx === -1 ||
    maTKGDIdx === -1 ||
    maHDIdx === -1 ||
    klGiaoDichIdx === -1 ||
    giaKhopIdx === -1 ||
    ngayGioIdx === -1 ||
    maGDIdx === -1
  ) {
    throw new Error('Không tìm thấy đủ các cột cần thiết trong file DSGD.xlsx');
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
    const ngayGio = String(row[ngayGioIdx] || '').trim();
    const maGD = String(row[maGDIdx] || '').trim();

    // Chuẩn C# FileUtils.cs#L803-L804
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
 * Bám sát chuẩn C# FileUtils.cs#L558-L585:
 * Bắt buộc 5 cột: "Mã TKGD", "Mã HĐ", "KL Mua", "KL Bán", "Giá TB".
 */
export function parseTTM(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const maTKGDIdx = findCol('Mã TKGD');
  const maHDIdx = findCol('Mã HĐ');
  const tongMuaIdx = findCol('KL Mua');
  const tongBanIdx = findCol('KL Bán');
  const giaKhopIdx = findCol('Giá TB');

  if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1 || giaKhopIdx === -1) {
    throw new Error('Không tìm thấy đủ các cột cần thiết trong file TTM.xlsx');
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
    const giaKhop = parseFloat(row[giaKhopIdx]) || 0;

    if (!maTKGD || !maHD) continue;

    result.push({ maTKGD, maHD, tongMua, tongBan, giaKhop });
  }
  return result;
}

/**
 * Đọc file TTTT để lấy khối lượng phục vụ đối soát trong phiên.
 * Bám sát chuẩn C# FileUtils.cs#L664-L692:
 * Bắt buộc các cột: "Mã TKGD", "Mã HĐ", "KL Mua", "KL Bán".
 */
export function parseTTTTForVolume(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const maTKGDIdx = findCol('Mã TKGD');
  const maHDIdx = findCol('Mã HĐ');
  const tongMuaIdx = findCol('KL Mua');
  const tongBanIdx = findCol('KL Bán');

  if (maTKGDIdx === -1 || maHDIdx === -1 || tongMuaIdx === -1 || tongBanIdx === -1) {
    throw new Error('Không tìm thấy đủ các cột cần thiết trong file TTTT.xlsx');
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

    if (!maTKGD || !maHD) continue;
    result.push({ maTKGD, maHD, tongMua, tongBan });
  }
  return result;
}

/**
 * Đọc file TTTT để lấy vị thế ròng phục vụ đối chiếu Dsgd-Before-EOD chốt 3 bên.
 * Chuẩn C# FileUtils.cs: Header cố định tại dòng 1 (rows[0]).
 */
export function parseTTTTForRecon(buffer: Buffer): { account: string; symbol: string; position: number }[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const accountIdx = findCol('Mã TKGD');
  const symbolIdx = findCol('Mã HĐ');
  const positionIdx = findCol('KL ròng');
  const muaIdx = findCol('KL Mua');
  const banIdx = findCol('KL Bán');

  if (accountIdx === -1 || symbolIdx === -1) {
    throw new Error('Không tìm thấy đủ các cột bắt buộc (Mã TKGD, Mã HĐ) trong file TTTT.xlsx');
  }

  const result: { account: string; symbol: string; position: number }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const accountRaw = String(row[accountIdx] || '').trim();
    const rawSymbol = String(row[symbolIdx] || '').trim();
    let position = 0;
    if (positionIdx !== -1) {
      position = parseFloat(row[positionIdx]) || 0;
    } else if (muaIdx !== -1 && banIdx !== -1) {
      const mua = parseFloat(row[muaIdx]) || 0;
      const ban = parseFloat(row[banIdx]) || 0;
      position = mua - ban;
    }

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
 * Header cố định ở dòng 1 (rows[0]) theo chuẩn file M-System.
 */
export function parseTTMForExecutive(buffer: Buffer): ExecutiveTtmRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const maTKGDIdx = findCol('Mã TKGD');
  const maHDIdx = findCol('Mã HĐ');
  const tongMuaIdx = findCol('KL Mua');
  const tongBanIdx = findCol('KL Bán');
  const pnlVndIdx = findCol('Lãi lỗ dự kiến (VND)');

  if (maTKGDIdx === -1 || maHDIdx === -1) return [];

  const result: ExecutiveTtmRow[] = [];
  for (let i = 1; i < rows.length; i++) {
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
 * Header cố định ở dòng 1 (rows[0]) theo chuẩn file M-System.
 */
export function parseTTTTForExecutive(buffer: Buffer): ExecutiveTtttRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());
  const findCol = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const maTKGDIdx = findCol('Mã TKGD');
  const maHDIdx = findCol('Mã HĐ');
  const muaTatToanIdx = findCol('KL Mua');
  const banTatToanIdx = findCol('KL Bán');
  const pnlThucTeIdx = findCol('Lãi lỗ thực tế (VND)');

  if (maTKGDIdx === -1 || maHDIdx === -1) return [];

  const result: ExecutiveTtttRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const account = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const rawMaHD = String(row[maHDIdx] || '').trim();
    const symbol = normalizeContractCode(rawMaHD, 'MS');

    const klMua = muaTatToanIdx !== -1 ? parseAccountingNumber(row[muaTatToanIdx]) : 0;
    const klBan = banTatToanIdx !== -1 ? parseAccountingNumber(row[banTatToanIdx]) : 0;
    // Chuẩn 100% C# TransactionCheckingService.cs#L347 (totalTTTT += tongBan):
    // Khối lượng tất toán vị thế lấy đơn vế, không cộng dồn mua + bán làm double số liệu.
    const liquidatedLots = banTatToanIdx !== -1 ? klBan : klMua;
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

