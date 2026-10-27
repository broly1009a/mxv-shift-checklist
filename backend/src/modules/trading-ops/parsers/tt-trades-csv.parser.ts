/**
 * tt-trades-csv.parser.ts
 *
 * Lớp bóc tách dữ liệu giao dịch (Trades/Fills) xuất từ hệ thống Trading Technologies (TT).
 * Đạt chuẩn Clean Architecture & Domain-Driven Design (DDD).
 * Sẵn sàng kết nối trực tiếp với CoreCCP (VNCLEAR) và M-System phục vụ đối soát Trading Ops.
 */

import {
  normalizeContractCode,
} from './symbol-normalizer.helper';
import {
  normalizeTtToCcpAccount,
  parseTkgd,
  ParsedTkgdInfo,
} from './tkgd-normalizer.helper';

export interface TtTradeRecord {
  dateUtc: string;
  timeUtc: string;
  exchange: string;
  rawContract: string;
  contract: string;         // Mã hợp đồng chuẩn CoreCCP/MXV (Ví dụ: CLEF27, KWEZ26)
  side: 'BUY' | 'SELL';     // B -> BUY, S -> SELL
  fillQty: number;          // Khối lượng khớp
  price: number;            // Giá khớp
  pf: string;               // P = Partial Fill, F = Full Fill
  route: string;
  rawAccount: string;
  account: string;          // Mã tiểu khoản chuẩn CoreCCP 13 ký tự (Ví dụ: 004C0011778-F)
  parsedAccount?: ParsedTkgdInfo; // Thông tin bóc tách chi tiết TKGD (TVKD, mã thêm, tiền tố TT...)
  originator: string;
  currentUser: string;
  ttOrderId: string;        // TT Order ID (UUID)
  parentOrderId?: string;
  exchOrderId: string;      // Mã khớp lệnh quốc tế
  tradeDate: string;        // Ngày hạch toán (YYYY-MM-DD)
  manualFill?: string;
  combinedKey: string;      // Khóa đối soát duy nhất: `${account}${contract}${price}`
}

export interface TtTradesSummary {
  totalTrades: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  uniqueAccountsCount: number;
  uniqueAccounts: string[];
  commodityBreakdown: Record<string, { buyQty: number; sellQty: number; totalQty: number }>;
}

/**
 * Đọc và chuẩn hóa file CSV Trades xuất từ hệ thống Trading Technologies (TT)
 */
export function parseTtTradesCsv(bufferOrContent: Buffer | string): TtTradeRecord[] {
  if (!bufferOrContent || bufferOrContent.length === 0) {
    return [];
  }

  const content = typeof bufferOrContent === 'string'
    ? bufferOrContent
    : bufferOrContent.toString('utf-8');

  // Chuẩn hóa dòng và ngắt dòng
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2) {
    return [];
  }

  // Phân tích header (dòng đầu tiên)
  const headerLine = lines[0];
  const rawHeaders = headerLine.split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());

  const findCol = (name: string, aliases: string[] = []): number => {
    const targets = [name.toLowerCase(), ...aliases.map((a) => a.toLowerCase())];
    return rawHeaders.findIndex((h) => targets.includes(h));
  };

  const dateUtcIdx = findCol('date (utc)', ['date', 'date(utc)', 'trade date utc']);
  const timeUtcIdx = findCol('time (utc)', ['time', 'time(utc)', 'fill time']);
  const exchangeIdx = findCol('exchange', ['exch', 'market']);
  const contractIdx = findCol('contract', ['symbol', 'instrument', 'product']);
  const bsIdx = findCol('b/s', ['side', 'buy/sell', 'bs']);
  const fillQtyIdx = findCol('fillqty', ['qty', 'fill qty', 'quantity', 'volume']);
  const priceIdx = findCol('price', ['fill price', 'fillp', 'exec price']);
  const pfIdx = findCol('p/f', ['pf', 'partial/full']);
  const routeIdx = findCol('route', ['order route']);
  const accountIdx = findCol('account', ['acc', 'sub-account', 'account no']);
  const originatorIdx = findCol('originator', ['user', 'trader']);
  const currentUserIdx = findCol('currentuser', ['current user']);
  const ttOrderIdIdx = findCol('ttorderid', ['order id', 'tt order id']);
  const parentIdIdx = findCol('parentid', ['parent id']);
  const exchOrderIdIdx = findCol('exchorderid', ['exchange order id', 'exch order id']);
  const tradeDateIdx = findCol('trade date', ['trade_date', 'session date']);
  const manualFillIdx = findCol('manualfill', ['manual fill']);

  if (contractIdx === -1 || fillQtyIdx === -1 || priceIdx === -1 || accountIdx === -1) {
    throw new Error('File CSV không đúng định dạng chuẩn của TT Trades (thiếu cột Contract, FillQty, Price hoặc Account)');
  }

  const records: TtTradeRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Tách cột bằng dấu phẩy nhưng giữ nguyên các trường có dấu ngoặc kép
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());

    const getVal = (idx: number): string => {
      if (idx === -1 || idx >= cols.length) return '';
      return cols[idx].replace(/^["']|["']$/g, '').trim();
    };

    const rawContract = getVal(contractIdx);
    const rawAccount = getVal(accountIdx);
    const rawQty = getVal(fillQtyIdx);
    const rawPrice = getVal(priceIdx);

    if (!rawContract || !rawAccount || !rawQty) {
      continue;
    }

    const fillQty = parseFloat(rawQty.replace(/,/g, '')) || 0;
    const price = parseFloat(rawPrice.replace(/,/g, '')) || 0;
    if (fillQty <= 0) continue;

    const rawBs = getVal(bsIdx).toUpperCase();
    const side: 'BUY' | 'SELL' = rawBs === 'B' || rawBs === 'BUY' ? 'BUY' : 'SELL';

    // Chuẩn hóa mã hợp đồng TT sang CoreCCP/MXV
    const contract = normalizeContractCode(rawContract, 'TT');

    // Bóc tách & chuẩn hóa số tài khoản TT sang chuẩn CoreCCP 13 ký tự kèm hậu tố -F
    const parsedAccount = parseTkgd(rawAccount);
    const account = parsedAccount.normalizedAccount || normalizeTtToCcpAccount(rawAccount);

    const dateUtc = getVal(dateUtcIdx);
    const timeUtc = getVal(timeUtcIdx);
    const exchange = getVal(exchangeIdx);
    const pf = getVal(pfIdx);
    const route = getVal(routeIdx);
    const originator = getVal(originatorIdx);
    const currentUser = getVal(currentUserIdx);
    const ttOrderId = getVal(ttOrderIdIdx);
    const parentOrderId = getVal(parentIdIdx) || undefined;
    const exchOrderId = getVal(exchOrderIdIdx);
    const tradeDate = getVal(tradeDateIdx);
    const manualFill = getVal(manualFillIdx) || undefined;

    // Sinh khóa đối soát: Account + Contract + Price
    const combinedKey = `${account}${contract}${price}`;

    records.push({
      dateUtc,
      timeUtc,
      exchange,
      rawContract,
      contract,
      side,
      fillQty,
      price,
      pf,
      route,
      rawAccount,
      account,
      parsedAccount,
      originator,
      currentUser,
      ttOrderId,
      parentOrderId,
      exchOrderId,
      tradeDate,
      manualFill,
      combinedKey,
    });
  }

  return records;
}

/**
 * Tính toán thống kê tổng quan từ danh sách bản ghi TT Trades
 */
export function summarizeTtTrades(records: TtTradeRecord[]): TtTradesSummary {
  let totalVolume = 0;
  let totalBuyVolume = 0;
  let totalSellVolume = 0;
  const uniqueAccountsSet = new Set<string>();
  const breakdown: Record<string, { buyQty: number; sellQty: number; totalQty: number }> = {};

  for (const r of records) {
    totalVolume += r.fillQty;
    if (r.side === 'BUY') {
      totalBuyVolume += r.fillQty;
    } else {
      totalSellVolume += r.fillQty;
    }

    if (r.account) {
      uniqueAccountsSet.add(r.account);
    }

    const commodityKey = r.contract || r.rawContract;
    if (!breakdown[commodityKey]) {
      breakdown[commodityKey] = { buyQty: 0, sellQty: 0, totalQty: 0 };
    }
    if (r.side === 'BUY') {
      breakdown[commodityKey].buyQty += r.fillQty;
    } else {
      breakdown[commodityKey].sellQty += r.fillQty;
    }
    breakdown[commodityKey].totalQty += r.fillQty;
  }

  return {
    totalTrades: records.length,
    totalVolume,
    totalBuyVolume,
    totalSellVolume,
    uniqueAccountsCount: uniqueAccountsSet.size,
    uniqueAccounts: Array.from(uniqueAccountsSet).sort(),
    commodityBreakdown: breakdown,
  };
}
