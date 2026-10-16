/**
 * straits-csv.parser.ts
 *
 * Lớp bóc tách dữ liệu thô từ file CSV / Excel đối tác Straits Financial (ACM / Nano).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import * as XLSX from 'xlsx';
import { getNormalizedAccount, normalizeContractCode } from './symbol-normalizer.helper';

/**
 * Đọc file giao dịch ACM Nano (hỗ trợ cả định dạng CSV Straits và Excel Nano).
 */
export function parseNano(buffer: Buffer): any[] {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/);
  if (lines.length > 0) {
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('buy') && firstLine.includes('sell')) {
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const buyColIndex = headers.indexOf('buy');
      const sellColIndex = headers.indexOf('sell');
      const priceColIndex = headers.indexOf('price');
      const tradeDateColIndex = headers.indexOf('trade date');
      const executionTimeColIndex = headers.indexOf('execution date-time');
      const brokerTradeIdColIndex = headers.indexOf('broker trade id');
      const subAccColIndex = headers.indexOf('sub-a/c');
      const productCodeColIndex = headers.indexOf('product code');

      if (buyColIndex === -1 || sellColIndex === -1) {
        throw new Error("Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits");
      }

      const result: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = line.split(',');

        const buyVal = buyColIndex !== -1 && buyColIndex < values.length ? parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0 : 0;
        const sellVal = sellColIndex !== -1 && sellColIndex < values.length ? parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0 : 0;
        const volume = buyVal + sellVal;
        if (volume === 0) continue;

        const maLenh = brokerTradeIdColIndex !== -1 && brokerTradeIdColIndex < values.length ? values[brokerTradeIdColIndex].replace(/"/g, '').trim() : 'STRAITS';
        const maTKGD = subAccColIndex !== -1 && subAccColIndex < values.length ? getNormalizedAccount(values[subAccColIndex].replace(/"/g, '').trim()) : 'Straits';
        const rawMaHD = productCodeColIndex !== -1 && productCodeColIndex < values.length ? values[productCodeColIndex].replace(/"/g, '').trim() : 'Straits';
        const maHD = normalizeContractCode(rawMaHD, 'MS');
        const giaKhop = priceColIndex !== -1 && priceColIndex < values.length ? parseFloat(values[priceColIndex].replace(/"/g, '').trim()) || 0 : 0;
        let ngayGio = executionTimeColIndex !== -1 && executionTimeColIndex < values.length ? values[executionTimeColIndex].replace(/"/g, '').trim() : '';
        if (!ngayGio && tradeDateColIndex !== -1 && tradeDateColIndex < values.length) {
          ngayGio = values[tradeDateColIndex].replace(/"/g, '').trim();
        }

        result.push({
          maLenh,
          maTKGD,
          maHD,
          klGiaoDich: volume,
          giaKhop,
          ngayGio,
          maGD: maLenh,
          combinedKey: `${maTKGD}${maLenh}${volume}`,
        });
      }
      return result;
    }
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim().toLowerCase());
  const maLenhIdx = header.indexOf('order sysid');
  const maTKGDIdx = header.indexOf('trader id');
  const maHDIdx = header.indexOf('instrument id');
  const klGiaoDichIdx = header.indexOf('volume');
  const giaKhopIdx = header.indexOf('price');
  const ngayIdx = header.indexOf('trading day');
  const tradeDateIdx = header.indexOf('trade date');
  const gioIdx = header.indexOf('trade time');
  const maGDIdx = header.indexOf('trade id');

  if (maLenhIdx === -1 || maTKGDIdx === -1 || maHDIdx === -1 || klGiaoDichIdx === -1 || giaKhopIdx === -1 || maGDIdx === -1) {
    throw new Error('Thiếu cột bắt buộc trong file Nano');
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
    const ngay = ngayIdx !== -1 ? String(row[ngayIdx] || '').trim() : '';
    const tradeDateVal = tradeDateIdx !== -1 ? String(row[tradeDateIdx] || '').trim() : '';
    const gio = gioIdx !== -1 ? String(row[gioIdx] || '').trim() : '';
    const maGD = String(row[maGDIdx] || '').trim();

    if (!maLenh || !maTKGD || !maHD) continue;

    result.push({
      maLenh,
      maTKGD,
      maHD,
      klGiaoDich,
      giaKhop,
      ngayGio: `${ngay} ${gio}`,
      tradeDateStr: tradeDateVal ? `${tradeDateVal} ${gio}` : undefined,
      maGD,
      combinedKey: `${maTKGD}${maGD}${klGiaoDich}`,
    });
  }
  return result;
}

/**
 * Đọc tổng khối lượng giao dịch từ file Straits Financial (Hỗ trợ cả CSV dạng Buy/Sell và Excel BIFF8/XLSX dạng Volume).
 */
export function parseStraitsCsv(buffer: Buffer): { totalVolume: number } {
  if (!buffer || buffer.length === 0) throw new Error('File Straits rỗng');

  // 1. Kiểm tra nếu file là Excel nhị phân (BIFF8 .xls bắt đầu bằng D0 CF 11 E0 hoặc OOXML .xlsx bắt đầu bằng PK)
  const isBinaryExcel =
    (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) ||
    (buffer[0] === 0x50 && buffer[1] === 0x4b);

  if (!isBinaryExcel) {
    const text = buffer.toString('utf-8');
    const lines = text.split(/\r?\n/);
    if (lines.length > 0) {
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const buyColIndex = headers.indexOf('buy');
      const sellColIndex = headers.indexOf('sell');

      if (buyColIndex !== -1 && sellColIndex !== -1) {
        let totalVolume = 0;
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const values = line.split(',');
          if (buyColIndex < values.length) {
            totalVolume += parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0;
          }
          if (sellColIndex < values.length) {
            totalVolume += parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0;
          }
        }
        return { totalVolume };
      }
    }
  }

  // 2. Fallback sang parseNano (hỗ trợ file Straits dạng Excel có cột 'volume')
  try {
    const nanoTrades = parseNano(buffer);
    let totalVolume = 0;
    for (const trade of nanoTrades) {
      totalVolume += Number(trade.klGiaoDich) || 0;
    }
    return { totalVolume };
  } catch (err: any) {
    throw new Error(
      `Không thể đọc dữ liệu từ file Straits: ${err.message}. Đã thử cả CSV (cột Buy/Sell) và Excel Nano (cột Volume).`,
    );
  }
}
