import * as XLSX from 'xlsx';

export interface CqgTradeRecord {
  ord: string;
  account: string;
  symbol: string;
  origSymbol: string;
  qty: number;
  fillP: number;
  time: string;
  timeObj?: Date | null;
  combinedKey: string;
}

export interface CqgPositionRecord {
  account: string;
  symbol: string;
  origSymbol: string;
  netPos: number;
  pos: number;
  totOTQty: number;
}

export interface CqgOpenPositionRecord {
  account: string;
  symbol: string;
  origSymbol: string;
  opValue: number;
}

export class CqgExcelParser {
  private static readonly LME_CODE_MAP: Record<string, string> = {
    LALZ: 'AHD',
    LDKZ: 'CAD',
    LEDZ: 'PBD',
    LNIZ: 'NID',
    LTIZ: 'SND',
    LZHZ: 'ZDS',
  };

  private static readonly REVERSE_MONTH_CODE: Record<string, string> = {
    '01': 'F',
    '02': 'G',
    '03': 'H',
    '04': 'J',
    '05': 'K',
    '06': 'M',
    '07': 'N',
    '08': 'Q',
    '09': 'U',
    '10': 'V',
    '11': 'X',
    '12': 'Z',
  };

  public static parseCqgNumber(val: any): number {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const str = String(val).trim();
    if (!str) return 0;

    let normalized = str;
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');

    if (lastComma !== -1 && lastDot !== -1) {
      if (lastDot < lastComma) {
        normalized = str.replace(/\./g, '').replace(/,/g, '.');
      } else {
        normalized = str.replace(/,/g, '');
      }
    } else if (lastComma !== -1) {
      normalized = str.replace(/,/g, '.');
    }

    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  public static parseCqgDateTime(timeStr: string, defaultDate: Date): Date | null {
    if (!timeStr) return null;
    timeStr = timeStr.trim();

    if (timeStr.includes('/') || timeStr.includes('-')) {
      const parts = timeStr.split(/\s+/);
      const datePart = parts[0];
      const timePart = parts[1] || '00:00:00';

      const dateSep = datePart.includes('/') ? '/' : '-';
      const dateBits = datePart.split(dateSep).map(Number);
      if (dateBits.length < 3) return null;

      let year = 0;
      let month = 0;
      let day = 0;

      if (dateBits[0] > 31) {
        year = dateBits[0];
        month = dateBits[1];
        day = dateBits[2];
      } else {
        const targetMonth = defaultDate.getMonth() + 1;
        const bit0 = dateBits[0];
        const bit1 = dateBits[1];

        if (
          bit1 === targetMonth ||
          bit1 === targetMonth - 1 ||
          (targetMonth === 1 && bit1 === 12)
        ) {
          day = bit0;
          month = bit1;
        } else if (
          bit0 === targetMonth ||
          bit0 === targetMonth - 1 ||
          (targetMonth === 1 && bit0 === 12)
        ) {
          month = bit0;
          day = bit1;
        } else {
          month = bit0;
          day = bit1;
        }
        year = dateBits[2];
      }

      if (year < 100) {
        year += 2000;
      }

      const timeBits = timePart.split(':');
      const hours = Number(timeBits[0]) || 0;
      const minutes = Number(timeBits[1]) || 0;
      const secondsVal = parseFloat(timeBits[2] || '0') || 0;
      const seconds = Math.floor(secondsVal);
      const ms = Math.round((secondsVal - seconds) * 1000);

      return new Date(year, month - 1, day, hours, minutes, seconds, ms);
    } else {
      const timeBits = timeStr.split(':');
      if (timeBits.length < 2) return null;
      const hours = Number(timeBits[0]) || 0;
      const minutes = Number(timeBits[1]) || 0;
      const secondsVal = parseFloat(timeBits[2] || '0') || 0;
      const seconds = Math.floor(secondsVal);
      const ms = Math.round((secondsVal - seconds) * 1000);

      const result = new Date(defaultDate);
      result.setHours(hours, minutes, seconds, ms);
      return result;
    }
  }

  public static findHeaderIndex(
    headers: string[],
    target: string,
    aliases: string[] = [],
  ): number {
    const normalize = (str: string): string => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normTarget = normalize(target);
    const normAliases = aliases.map((a) => normalize(a));

    return headers.findIndex((h) => {
      const normH = normalize(h);
      return normH === normTarget || normAliases.includes(normH);
    });
  }

  public static isIgnoredCommodity(symbol: string): boolean {
    if (!symbol) return false;
    const upper = symbol.toUpperCase();
    return ['TRU', 'ZFT', 'FEF', 'MPO'].some((ignored) =>
      upper.startsWith(ignored),
    );
  }

  public static convertLMESymbol(
    symbol: string,
    date: Date,
    holidays: string[] = [],
  ): string {
    if (!this.LME_CODE_MAP[symbol]) {
      return symbol;
    }

    const adjustedDate = new Date(date);
    adjustedDate.setMonth(adjustedDate.getMonth() + 3);

    const dayOfWeek = adjustedDate.getDay();
    if (dayOfWeek === 6) {
      adjustedDate.setDate(adjustedDate.getDate() - 1);
    } else if (dayOfWeek === 0) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }

    const formatDDMMYYYY = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    let adjustedDateStr = formatDDMMYYYY(adjustedDate);
    const dayoffMap = new Map<string, string>();
    holidays.forEach((h) => {
      const parts = h.split(',');
      if (parts.length >= 2) {
        dayoffMap.set(parts[0].trim(), parts[1].trim());
      }
    });

    while (dayoffMap.has(adjustedDateStr)) {
      const nextDateStr = dayoffMap.get(adjustedDateStr);
      if (!nextDateStr) break;
      adjustedDateStr = nextDateStr;
      const [d, m, y] = adjustedDateStr.split('/').map(Number);
      adjustedDate.setFullYear(y, m - 1, d);
    }

    const newDay = String(adjustedDate.getDate()).padStart(2, '0');
    const newMonth = String(adjustedDate.getMonth() + 1).padStart(2, '0');
    const newYear = String(adjustedDate.getFullYear());

    const mapped = this.LME_CODE_MAP[symbol];
    const monthCode = this.REVERSE_MONTH_CODE[newMonth];
    if (!monthCode) {
      throw new Error(`Convert month failed for: ${newMonth}`);
    }
    const yearShort = newYear.substring(2);

    return `${mapped}D${newDay}${monthCode}${yearShort}`;
  }

  /**
   * Parse CQG FR.xlsx (Khớp lệnh)
   */
  public static parseFR(buffer: Buffer, date: Date, holidays: string[] = []): CqgTradeRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
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

      const tempOrdIdx = this.findHeaderIndex(rowHeaders, 'Ord #', [
        'ord',
        'ord #',
        'order',
        'order #',
        'order number',
      ]);
      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      const tempQtyIdx = this.findHeaderIndex(rowHeaders, 'Qty', [
        'qty',
        'quantity',
        'kl',
        'khối lượng',
        'volume',
        'qty.',
      ]);
      const tempFillPIdx = this.findHeaderIndex(rowHeaders, 'Fill P', [
        'fill p',
        'fill price',
        'gia khop',
        'giá khớp',
        'fill_p',
        'fillpx',
        'fill px',
      ]);
      const tempTimeIdx = this.findHeaderIndex(rowHeaders, 'Time', [
        'time',
        'thoi gian',
        'ngày giờ',
        'ngay gio',
      ]);

      if (
        tempOrdIdx !== -1 &&
        tempAccountIdx !== -1 &&
        tempSymbolIdx !== -1 &&
        tempQtyIdx !== -1 &&
        tempFillPIdx !== -1
      ) {
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

    if (
      ordIdx === -1 ||
      accountIdx === -1 ||
      symbolIdx === -1 ||
      qtyIdx === -1 ||
      fillPIdx === -1
    ) {
      const fallbackHeader = rows[1]
        ? rows[1].map((h) => String(h || '').trim())
        : [];
      ordIdx = this.findHeaderIndex(fallbackHeader, 'Ord #', [
        'ord',
        'ord #',
        'order',
        'order #',
        'order number',
      ]);
      accountIdx = this.findHeaderIndex(fallbackHeader, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
        'account number',
        'acc',
      ]);
      symbolIdx = this.findHeaderIndex(fallbackHeader, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
        'ma hop dong',
        'contract',
      ]);
      qtyIdx = this.findHeaderIndex(fallbackHeader, 'Qty', [
        'qty',
        'quantity',
        'kl',
        'khối lượng',
        'volume',
        'qty.',
      ]);
      fillPIdx = this.findHeaderIndex(fallbackHeader, 'Fill P', [
        'fill p',
        'fill price',
        'gia khop',
        'giá khớp',
        'fill_p',
        'fillpx',
        'fill px',
      ]);
      timeIdx = this.findHeaderIndex(fallbackHeader, 'Time', [
        'time',
        'thoi gian',
        'ngày giờ',
        'ngay gio',
      ]);
    }

    if (
      ordIdx === -1 ||
      accountIdx === -1 ||
      symbolIdx === -1 ||
      qtyIdx === -1 ||
      fillPIdx === -1
    ) {
      return [];
    }

    const result: CqgTradeRecord[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const ord = String(row[ordIdx] || '').trim();
      const account = String(row[accountIdx] || '').trim();
      let symbol = String(row[symbolIdx] || '').trim();
      const qty = this.parseCqgNumber(row[qtyIdx]);
      const fillP = this.parseCqgNumber(row[fillPIdx]);
      const time = timeIdx !== -1 ? String(row[timeIdx] || '').trim() : '';

      if (!ord || !account || !symbol) continue;
      if (this.isIgnoredCommodity(symbol)) continue;

      const origSymbol = symbol;
      symbol = this.convertLMESymbol(symbol, date, holidays);

      const parsedDate = time
        ? this.parseCqgDateTime(time, date)
        : null;

      result.push({
        ord,
        account,
        symbol,
        origSymbol,
        qty,
        fillP,
        time,
        timeObj: parsedDate,
        combinedKey: `${account}${symbol}${fillP}`,
      });
    }
    return result;
  }

  /**
   * Parse CQG PS.xlsx (Vị thế ròng & tất toán)
   */
  public static parsePS(buffer: Buffer, date: Date, holidays: string[] = []): CqgPositionRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    let headerRowIdx = 1;
    let accountIdx = -1;
    let symbolIdx = -1;
    let netPosIdx = -1;
    let posIdx = -1;
    let totOTQtyIdx = -1;

    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map((h) => String(h || '').trim());

      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
        'ma tkgd',
      ]);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
        'mã hợp đồng',
      ]);
      const tempNetPosIdx = this.findHeaderIndex(rowHeaders, 'Net Pos', [
        'net pos',
        'netpos',
        'vị thế ròng',
      ]);
      const tempPosIdx = this.findHeaderIndex(rowHeaders, 'Pos', [
        'pos',
        'position',
      ]);
      const tempTotOTQtyIdx = this.findHeaderIndex(rowHeaders, 'Tot O/T Qty', [
        'tot o/t qty',
        'tot ot qty',
        'tổng kl tất toán',
      ]);

      if (tempAccountIdx !== -1 && tempSymbolIdx !== -1) {
        headerRowIdx = r;
        accountIdx = tempAccountIdx;
        symbolIdx = tempSymbolIdx;
        netPosIdx = tempNetPosIdx;
        posIdx = tempPosIdx;
        totOTQtyIdx = tempTotOTQtyIdx;
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1) return [];

    const result: CqgPositionRecord[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const account = String(row[accountIdx] || '').trim();
      let symbol = String(row[symbolIdx] || '').trim();
      const netPos = netPosIdx !== -1 ? this.parseCqgNumber(row[netPosIdx]) : 0;
      const pos = posIdx !== -1 ? this.parseCqgNumber(row[posIdx]) : 0;
      const totOTQty = totOTQtyIdx !== -1 ? this.parseCqgNumber(row[totOTQtyIdx]) : 0;

      if (!account || !symbol) continue;
      if (this.isIgnoredCommodity(symbol)) continue;

      const origSymbol = symbol;
      symbol = this.convertLMESymbol(symbol, date, holidays);

      result.push({
        account,
        symbol,
        origSymbol,
        netPos,
        pos,
        totOTQty,
      });
    }
    return result;
  }

  /**
   * Parse CQG OP.xlsx (Trạng thái mở)
   */
  public static parseOP(buffer: Buffer, date: Date, holidays: string[] = []): CqgOpenPositionRecord[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return [];

    let headerRowIdx = 1;
    let accountIdx = -1;
    let symbolIdx = -1;
    let opValueIdx = -1;

    const scanLimit = Math.min(rows.length, 5);
    for (let r = 0; r < scanLimit; r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map((h) => String(h || '').trim());

      const tempAccountIdx = this.findHeaderIndex(rowHeaders, 'Account', [
        'account',
        'tk',
        'tài khoản',
      ]);
      const tempSymbolIdx = this.findHeaderIndex(rowHeaders, 'Symbol', [
        'symbol',
        'ma hd',
      ]);
      const tempOpValueIdx = this.findHeaderIndex(rowHeaders, 'OP', [
        'op',
        'open position',
        'trạng thái mở',
        'qty',
      ]);

      if (tempAccountIdx !== -1 && tempSymbolIdx !== -1) {
        headerRowIdx = r;
        accountIdx = tempAccountIdx;
        symbolIdx = tempSymbolIdx;
        opValueIdx = tempOpValueIdx;
        break;
      }
    }

    if (accountIdx === -1 || symbolIdx === -1) return [];

    const result: CqgOpenPositionRecord[] = [];
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const account = String(row[accountIdx] || '').trim();
      let symbol = String(row[symbolIdx] || '').trim();
      const opValue = opValueIdx !== -1 ? this.parseCqgNumber(row[opValueIdx]) : 0;

      if (!account || !symbol) continue;
      if (this.isIgnoredCommodity(symbol)) continue;

      const origSymbol = symbol;
      symbol = this.convertLMESymbol(symbol, date, holidays);

      result.push({
        account,
        symbol,
        origSymbol,
        opValue,
      });
    }
    return result;
  }

  /**
   * Parse CQG CAST Accounts_Balances.xlsx
   */
  public static parseCastBalances(buffer: Buffer): Map<string, number> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return new Map();

    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rows.length < 2) return new Map();

    let accountIdx = -1;
    let balanceIdx = -1;

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      if (!rows[r]) continue;
      const rowHeaders = rows[r].map((h) => String(h || '').trim());
      const tempAcc = this.findHeaderIndex(rowHeaders, 'Account', ['account', 'tk', 'account id']);
      const tempBal = this.findHeaderIndex(rowHeaders, 'Balance', ['balance', 'cash balance', 'ending balance']);

      if (tempAcc !== -1 && tempBal !== -1) {
        accountIdx = tempAcc;
        balanceIdx = tempBal;
        break;
      }
    }

    const resultMap = new Map<string, number>();
    if (accountIdx === -1 || balanceIdx === -1) return resultMap;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const account = String(row[accountIdx] || '').trim().toUpperCase();
      const balance = this.parseCqgNumber(row[balanceIdx]);
      if (account) {
        resultMap.set(account, balance);
      }
    }
    return resultMap;
  }
}
