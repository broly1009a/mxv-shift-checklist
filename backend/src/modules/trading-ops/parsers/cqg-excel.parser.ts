/**
 * cqg-excel.parser.ts
 *
 * Lớp bóc tách dữ liệu thô từ file Excel xuất từ Gateway CQG (FR, OP, PS).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import * as XLSX from 'xlsx';
import { getNormalizedAccount, normalizeContractCode } from './symbol-normalizer.helper';
import {
  parseCqgNumber,
  parseCqgDateTime,
  findHeaderIndex,
} from '../helpers/trading-math.helper';

/**
 * Đọc file CQG FR (Fill Report - Khớp lệnh trong phiên).
 */
export function parseFR(buffer: Buffer, date: Date, holidays: string[] = []): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 1;
  let ordIdx = -1;
  let accountIdx = -1;
  let symbolIdx = -1;
  let qtyIdx = -1;
  let fillPIdx = -1;
  let timeIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const rowHeaders = rows[r].map((h) => String(h || '').trim());

    const tempOrdIdx = findHeaderIndex(rowHeaders, 'Ord #', ['ord', 'ord #', 'order', 'order #']);
    const tempAccountIdx = findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'acc']);
    const tempSymbolIdx = findHeaderIndex(rowHeaders, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'contract']);
    const tempQtyIdx = findHeaderIndex(rowHeaders, 'Qty', ['qty', 'quantity', 'kl', 'khối lượng', 'volume']);
    const tempFillPIdx = findHeaderIndex(rowHeaders, 'Fill P', ['fill p', 'fill price', 'gia khop', 'giá khớp']);
    const tempTimeIdx = findHeaderIndex(rowHeaders, 'Time', ['time', 'thoi gian', 'ngày giờ', 'ngay gio']);

    if (tempOrdIdx !== -1 && tempAccountIdx !== -1 && tempSymbolIdx !== -1 && tempQtyIdx !== -1 && tempFillPIdx !== -1) {
      headerRowIdx = r;
      ordIdx = tempOrdIdx;
      accountIdx = tempAccountIdx;
      symbolIdx = tempSymbolIdx;
      qtyIdx = tempQtyIdx;
      fillPIdx = tempFillPIdx;
      timeIdx = tempTimeIdx;
      break;
    }
  }

  if (ordIdx === -1 || accountIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || fillPIdx === -1) {
    throw new Error('Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)');
  }

  const result: any[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const ord = String(row[ordIdx] || '').trim();
    const account = String(row[accountIdx] || '').trim();
    const symbol = String(row[symbolIdx] || '').trim();
    const qty = parseCqgNumber(row[qtyIdx]);
    const fillPVal = parseCqgNumber(row[fillPIdx]);
    const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';

    if (!ord || !account || !symbol) continue;

    const accountRaw = getNormalizedAccount(account);
    let tradeDate = date;
    if (time) {
      const parsedTime = parseCqgDateTime(time, date);
      if (parsedTime) tradeDate = parsedTime;
    }

    const symbolRaw = normalizeContractCode(symbol, 'CQG', { date: tradeDate, holidays });

    result.push({
      ord,
      account,
      symbol,
      qty,
      fillP: fillPVal,
      time,
      accountRaw,
      combinedKey: `${accountRaw}${symbolRaw}${fillPVal}`,
    });
  }
  return result;
}

/**
 * Đọc file CQG OP (Open Position - Trạng thái mở).
 */
export function parseOP(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 1;
  let accountIdx = -1;
  let symbolIdx = -1;
  let lIdx = -1;
  let sIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const rowHeaders = rows[r].map((h) => String(h || '').trim());
    const tempAccountIdx = findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'acc']);
    const tempSymbolIdx = findHeaderIndex(rowHeaders, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'contract']);
    const tempLIdx = rowHeaders.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
    });
    const tempSIdx = rowHeaders.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
    });

    if (tempAccountIdx !== -1 && tempSymbolIdx !== -1 && tempLIdx !== -1 && tempSIdx !== -1) {
      headerRowIdx = r;
      accountIdx = tempAccountIdx;
      symbolIdx = tempSymbolIdx;
      lIdx = tempLIdx;
      sIdx = tempSIdx;
      break;
    }
  }

  if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
    throw new Error('Thiếu cột bắt buộc trong file OP (Account, Symbol, L, S)');
  }

  const result: any[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const account = String(row[accountIdx] || '').trim();
    const rawSymbol = String(row[symbolIdx] || '').trim();
    const lValue = parseCqgNumber(row[lIdx]);
    const sValue = parseCqgNumber(row[sIdx]);

    if (!rawSymbol) continue;

    result.push({
      account: getNormalizedAccount(account),
      symbol: normalizeContractCode(rawSymbol, 'CQG'),
      lValue,
      sValue,
    });
  }
  return result;
}

/**
 * Đọc file CQG PS để lấy khối lượng phục vụ kiểm tra volume.
 */
export function parsePSForVolume(buffer: Buffer): any[] {
  return parseOP(buffer);
}

/**
 * Đọc file CQG PS để lấy vị thế phục vụ đối chiếu Dsgd-Before-EOD.
 */
export function parsePSForRecon(
  buffer: Buffer,
  tradingDate: Date,
  holidays: string[] = [],
): { account: string; symbol: string; position: number }[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  let headerRowIdx = 1;
  let accountIdx = -1;
  let symbolIdx = -1;
  let positionIdx = -1;

  const scanLimit = Math.min(rows.length, 5);
  for (let r = 0; r < scanLimit; r++) {
    if (!rows[r]) continue;
    const rowHeaders = rows[r].map((h) => String(h || '').trim());
    const tempAccIdx = findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'tài khoản', 'ma tkgd', 'acc']);
    const tempSymIdx = findHeaderIndex(rowHeaders, 'Symbol', ['symbol', 'ma hd', 'mã hợp đồng', 'contract']);
    const tempPosIdx = findHeaderIndex(rowHeaders, 'Position', ['net', 'kl ròng', 'vị thế', 'trạng thái ròng']);

    if (tempAccIdx !== -1 && tempSymIdx !== -1) {
      headerRowIdx = r;
      accountIdx = tempAccIdx;
      symbolIdx = tempSymIdx;
      if (tempPosIdx !== -1) positionIdx = tempPosIdx;
      break;
    }
  }

  if (accountIdx === -1 || symbolIdx === -1) {
    accountIdx = 0;
    symbolIdx = 3;
  }
  const finalPosIdx = positionIdx !== -1 ? positionIdx : 8;

  const result: { account: string; symbol: string; position: number }[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const accountRaw = String(row[accountIdx] || '').trim();
    let symbol = String(row[symbolIdx] || '').trim();
    const position = parseCqgNumber(row[finalPosIdx]);
    if (!accountRaw || !symbol) continue;

    const account = getNormalizedAccount(accountRaw);
    symbol = normalizeContractCode(symbol, 'CQG', { date: tradingDate, holidays });

    result.push({ account, symbol, position });
  }
  return result;
}

/**
 * Trích xuất mốc thời gian chốt dữ liệu (Snapshot Time) từ dòng đầu tiên của file CQG (FR1, FR2, OP, PS, OD).
 * Chuẩn ground truth từ Header: "Fills reported as of 10/16/26 8:29:46 AM for the following accounts: All"
 */
export function extractCqgSnapshotTime(filePathOrBuffer: string | Buffer): Date | null {
  try {
    let buf: Buffer;
    if (typeof filePathOrBuffer === 'string') {
      const fs = require('fs');
      if (!fs.existsSync(filePathOrBuffer)) return null;
      buf = fs.readFileSync(filePathOrBuffer);
    } else {
      buf = filePathOrBuffer;
    }
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return null;
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    if (!rows || rows.length === 0 || !rows[0]) return null;
    const headerText = String(rows[0][0] || '').trim();
    const match = headerText.match(
      /reported as of\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s*(?:\u202f|\s)*(?:AM|PM)?)/i,
    );
    if (!match) return null;
    const cleanStr = match[1].replace(/\u202f|\s+/g, ' ');
    const parsed = new Date(cleanStr);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}
