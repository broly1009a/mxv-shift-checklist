import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { FAST_XLSX_READ_OPTIONS as FAST_XLSX_OPTS } from '../../../shared';

export interface GttParsedItem {
  symbol: string;
  commodity: string;
  price: number | null;
  date: string | null;
  currency: string;
}

export interface GttParsedFileResult {
  map: Map<string, GttParsedItem>;
  date: string | null;
  rows: GttParsedItem[];
  filePath: string | null;
}

/**
 * Bộ phân tích dữ liệu Excel chuyên biệt cho nghiệp vụ Giá Thanh Toán (GTT),
 * Danh mục Hàng hóa (Bước giá / Tick Size), và Trạng thái mở (TTM / Open Positions).
 * Được tách riêng vào parsers/ để tái sử dụng xuyên suốt toàn bộ phân hệ trading-ops.
 */
export class GttExcelParser {
  /**
   * Phân tích file Giá Thanh Toán (GTT) từ CoreEX (CE) hoặc CoreCCP (VNCLEAR)
   */
  public static parseGttFile(filePath: string, label: string = 'GTT'): GttParsedFileResult {
    if (!filePath || !fs.existsSync(filePath)) {
      return { map: new Map<string, GttParsedItem>(), date: null, rows: [], filePath: null };
    }

    const wb = XLSX.readFile(filePath, FAST_XLSX_OPTS);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
    if (!rawRows || rawRows.length < 2) {
      return { map: new Map<string, GttParsedItem>(), date: null, rows: [], filePath };
    }

    const header = rawRows[0].map((h) => String(h || '').trim());
    const symbolIdx = header.findIndex((h) => /mã hợp đồng|symbol|contract|mã hđ/i.test(h));
    const priceIdx = header.findIndex((h) => /giá thanh toán|settle|gtt|settlement/i.test(h));
    const commIdx = header.findIndex((h) => /mã hàng hóa|commodity/i.test(h));
    const dateIdx = header.findIndex((h) => /ngày phiên|ngày giao dịch|trading date|date/i.test(h));
    const currIdx = header.findIndex((h) => /tiền tệ|currency/i.test(h));

    if (symbolIdx === -1 || priceIdx === -1) {
      throw new Error(
        `File ${label} (${path.basename(filePath)}) thiếu cột bắt buộc: 'Mã hợp đồng' hoặc 'Giá thanh toán'. Các cột hiện có: [${header.slice(0, 8).join(', ')}]`,
      );
    }

    const map = new Map<string, GttParsedItem>();
    const parsedRows: GttParsedItem[] = [];
    let detectedDate: string | null = null;

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;
      const symbol = String(row[symbolIdx] || '').trim().toUpperCase();
      if (!symbol) continue;

      const rawPrice = row[priceIdx];
      const price =
        rawPrice !== undefined && rawPrice !== null && !isNaN(Number(rawPrice))
          ? Number(rawPrice)
          : null;
      const commodity =
        commIdx !== -1 && row[commIdx]
          ? String(row[commIdx]).trim().toUpperCase()
          : symbol.slice(0, 5);
      const dateStr = dateIdx !== -1 && row[dateIdx] ? String(row[dateIdx]).trim() : null;
      const currency = currIdx !== -1 && row[currIdx] ? String(row[currIdx]).trim() : '';

      if (!detectedDate && dateStr) detectedDate = dateStr;

      const item: GttParsedItem = { symbol, commodity, price, date: dateStr, currency };
      map.set(symbol, item);
      parsedRows.push(item);
    }

    return { map, date: detectedDate, rows: parsedRows, filePath };
  }

  /**
   * Phân tích file Bước giá (Tick Size) / Danh mục Hàng hóa
   */
  public static readonly FALLBACK_TICK_SIZES: Record<string, number> = {
    ALI: 0.25,
    BM: 0.01,
    CCE: 1.0,
    CLE: 0.01,
    CPE: 0.0005,
    CTE: 0.01,
    FEF: 0.01,
    KCE: 0.05,
    KWE: 0.25,
    LRC: 1.0,
    MCLE: 0.01,
    MHG: 0.0005,
    MPO: 1.0,
    MQC: 0.002,
    MOJ: 0.0125,
    MZC: 0.5,
    MZL: 0.02,
    MZM: 0.2,
    MZS: 0.5,
    MZW: 0.5,
    NGE: 0.001,
    NQG: 0.005,
    NQM: 0.025,
    PLE: 0.1,
    QO: 0.01,
    QP: 0.25,
    QW: 0.1,
    RBE: 0.0001,
    SBE: 0.01,
    SIE: 0.001,
    SIL: 0.005,
    TRU: 0.1,
    XB: 0.125,
    XC: 0.125,
    XW: 0.125,
    ZCE: 0.25,
  };

  /**
   * Phân tích file Bước giá (Tick Size) / Danh mục Hàng hóa (Hang hoa.xlsx)
   * Hỗ trợ tìm kiếm tiêu đề linh hoạt ở dòng đầu hoặc quét 20 dòng đầu nếu bị lệch tiêu đề.
   */
  public static parseTickSizes(filePath: string | null): Map<string, number> {
    const tickMap = new Map<string, number>();
    if (!filePath || !fs.existsSync(filePath)) return tickMap;

    try {
      const wb = XLSX.readFile(filePath, FAST_XLSX_OPTS);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (!data || data.length < 2) return tickMap;

      const normalizeH = (h: any) =>
        String(h || '')
          .trim()
          .toLowerCase();

      // 1. Quét tìm tiêu đề ở hàng đầu tiên hoặc 20 hàng đầu
      let commIdx = -1;
      let tickIdx = -1;
      let startRow = 1;

      for (let r = 0; r < Math.min(20, data.length); r++) {
        const row = (data[r] || []).map(normalizeH);
        const cIdx = row.findIndex(
          (h) =>
            h.includes('mã hàng hóa') ||
            h.includes('commodity code') ||
            h.includes('commodity') ||
            h === 'symbol',
        );
        const tIdx = row.findIndex(
          (h) =>
            h.includes('bước giá tối thiểu') ||
            h.includes('minimum tick size') ||
            h.includes('tick size') ||
            h.includes('tick giá thay đổi') ||
            h.includes('bước giá'),
        );

        if (cIdx !== -1 && tIdx !== -1) {
          commIdx = cIdx;
          tickIdx = tIdx;
          startRow = r + 1;
          break;
        }
      }

      // 2. Fallback nếu không thấy tiêu đề: Cột B (1) và Cột K (10)
      if (commIdx === -1 || tickIdx === -1) {
        commIdx = 1;
        tickIdx = 10;
        startRow = 1;
      }

      for (let i = startRow; i < data.length; i++) {
        const itemRow = data[i];
        if (!itemRow || !itemRow[commIdx]) continue;
        const code = String(itemRow[commIdx]).trim().toUpperCase();
        const tickStr = String(itemRow[tickIdx] ?? '').replace(/,/g, '').trim();
        const tick = parseFloat(tickStr);
        if (code && !isNaN(tick) && tick > 0) {
          tickMap.set(code, tick);
        }
      }
    } catch {
      // Caller can log error or fallback
    }
    return tickMap;
  }

  /**
   * Phân tích danh sách mã hợp đồng có vị thế mở từ file TTM (Trạng thái mở)
   */
  public static parseOpenContracts(filePath: string | null): Set<string> {
    const openSet = new Set<string>();
    if (!filePath || !fs.existsSync(filePath)) return openSet;

    try {
      const wb = XLSX.readFile(filePath, FAST_XLSX_OPTS);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
      if (!rawRows || rawRows.length < 2) return openSet;

      const header = rawRows[0].map((h) => String(h || '').trim());
      const symbolIdx = header.findIndex((h) => /mã hợp đồng|symbol|contract|mã hđ/i.test(h));

      if (symbolIdx !== -1) {
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (row && row[symbolIdx]) {
            openSet.add(String(row[symbolIdx]).trim().toUpperCase());
          }
        }
      }
    } catch {
      // Ignored for graceful fallback
    }
    return openSet;
  }

  /**
   * Trả về danh sách mảng chuỗi mã hợp đồng đã được sắp xếp tăng dần từ file TTM
   */
  public static parseUniqueContracts(filePath: string | null): string[] {
    return Array.from(this.parseOpenContracts(filePath)).sort();
  }
}
