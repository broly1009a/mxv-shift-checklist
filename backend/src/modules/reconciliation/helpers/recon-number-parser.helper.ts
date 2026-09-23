import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { resolveStoragePathCrossPlatform } from '../../bot-engine/helpers/bot-path.helper';
import { decrypt } from '../../bot-engine/utils/crypto';

// Mappings for LME symbols (from statics.json)
export const LME_CODE_MAP: Record<string, string> = {
  LALZ: 'AHD',
  LDKZ: 'CAD',
  LEDZ: 'PBD',
  LNIZ: 'NID',
  LTIZ: 'SND',
  LZHZ: 'ZDS',
};

export const REVERSE_MONTH_CODE: Record<string, string> = {
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

export function parseCqgNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;

  let normalized = str;
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastDot < lastComma) {
      // Vietnamese/European format: -26.960,00 -> remove dots, replace comma with dot
      normalized = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // US format: -26,960.00 -> remove commas
      normalized = str.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    // Only comma: replace with dot
    normalized = str.replace(/,/g, '.');
  }

  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function parseCqgDateTime(timeStr: string, defaultDate: Date): Date | null {
  if (!timeStr) return null;
  timeStr = timeStr.trim();

  // Check if it has a date part (contains '/' or '-')
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
      // YYYY-MM-DD
      year = dateBits[0];
      month = dateBits[1];
      day = dateBits[2];
    } else {
      // Dynamic detection of MM/DD/YY vs DD/MM/YY based on defaultDate (tradingDate) month
      const targetMonth = defaultDate.getMonth() + 1;
      const bit0 = dateBits[0];
      const bit1 = dateBits[1];

      if (
        bit1 === targetMonth ||
        bit1 === targetMonth - 1 ||
        (targetMonth === 1 && bit1 === 12)
      ) {
        // Assume bit1 is Month and bit0 is Day (DD/MM/YY)
        day = bit0;
        month = bit1;
      } else if (
        bit0 === targetMonth ||
        bit0 === targetMonth - 1 ||
        (targetMonth === 1 && bit0 === 12)
      ) {
        // Assume bit0 is Month and bit1 is Day (MM/DD/YY)
        month = bit0;
        day = bit1;
      } else {
        // Fallback to MM/DD/YY (standard CQG US export format)
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
    // Time only: combine with defaultDate (keeping defaultDate's year, month, day)
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

export function parseTradeDateTime(
  dateTimeStr: string,
  defaultDate?: Date,
): Date | null {
  if (!dateTimeStr) return null;
  const str = String(dateTimeStr).trim();
  if (!str) return null;

  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }

  const parts = str.split(/\s+/);
  const datePart = parts[0];
  const timePart = parts[1] || '00:00:00';

  let year = 0;
  let month = 0;
  let day = 0;

  if (/^\d{8}$/.test(datePart)) {
    year = Number(datePart.substring(0, 4));
    month = Number(datePart.substring(4, 6));
    day = Number(datePart.substring(6, 8));
  } else if (datePart.includes('/') || datePart.includes('-')) {
    const sep = datePart.includes('/') ? '/' : '-';
    const bits = datePart.split(sep).map(Number);
    if (bits.length >= 3) {
      if (bits[0] > 31) {
        // YYYY-MM-DD or YYYY/MM/DD
        year = bits[0];
        month = bits[1];
        day = bits[2];
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        day = bits[0];
        month = bits[1];
        year = bits[2];
      }
      if (year < 100) year += 2000;
    } else if (defaultDate) {
      year = defaultDate.getFullYear();
      month = defaultDate.getMonth() + 1;
      day = defaultDate.getDate();
    } else {
      return null;
    }
  } else if (parts.length === 1 && str.includes(':')) {
    // Time only: HH:mm:ss
    if (defaultDate) {
      year = defaultDate.getFullYear();
      month = defaultDate.getMonth() + 1;
      day = defaultDate.getDate();
    } else {
      return null;
    }
  } else {
    return null;
  }

  const timeBits = (
    parts.length === 1 && str.includes(':') ? str : timePart
  ).split(':');
  const hr = Number(timeBits[0]) || 0;
  const min = Number(timeBits[1]) || 0;
  const secVal = parseFloat(timeBits[2] || '0') || 0;
  const sec = Math.floor(secVal);
  const ms = Math.round((secVal - sec) * 1000);

  const result = new Date(year, month - 1, day, hr, min, sec, ms);
  return isNaN(result.getTime()) ? null : result;
}

export function findHeaderIndex(
  headers: string[],
  target: string,
  aliases: string[] = [],
): number {
  const normalize = (str: string): string => {
    if (!str) return '';
    return String(str)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents/diacritics
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

export function isIgnoredCommodity(symbol: string): boolean {
  if (!symbol) return false;
  const upper = symbol.toUpperCase();
  return ['TRU', 'ZFT', 'FEF', 'MPO'].some((ignored) =>
    upper.startsWith(ignored),
  );
}

export function convertLMESymbol(
  symbol: string,
  date: Date,
  holidays: string[] = [],
): string {
  if (!LME_CODE_MAP[symbol]) {
    return symbol;
  }

  const adjustedDate = new Date(date);
  adjustedDate.setMonth(adjustedDate.getMonth() + 3);

  const dayOfWeek = adjustedDate.getDay(); // 0 = Sunday, 6 = Saturday
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

  const mapped = LME_CODE_MAP[symbol];
  const monthCode = REVERSE_MONTH_CODE[newMonth];
  if (!monthCode) {
    throw new Error(`Convert month failed for: ${newMonth}`);
  }
  const yearShort = newYear.substring(2);

  return `${mapped}D${newDay}${monthCode}${yearShort}`;
}

export function getNormalizedAccount(account: string): string {
  if (!account) return '';
  let acc = account.trim();
  acc = acc.replace(/F$/i, '');
  acc = acc.replace(/L$/i, '-L');
  acc = acc.replace(/S$/i, '-S');
  acc = acc.replace(/--/g, '-');
  return acc.toUpperCase();
}

export function findLatestFile(dirPath: string, pattern: RegExp): string | null {
  try {
    if (!fs.existsSync(dirPath)) return null;

    let files: string[] = [];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      return null;
    }

    const matches: Array<{ name: string; fullPath: string; mtime: number }> = [];

    for (const f of files) {
      const fullPath = path.join(dirPath, f);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const subFiles = fs.readdirSync(fullPath);
          for (const sf of subFiles) {
            if (pattern.test(sf)) {
              const subFullPath = path.join(fullPath, sf);
              const subStat = fs.statSync(subFullPath);
              matches.push({ name: sf, fullPath: subFullPath, mtime: subStat.mtimeMs });
            }
          }
        } else if (pattern.test(f)) {
          matches.push({ name: f, fullPath, mtime: stat.mtimeMs });
        }
      } catch {}
    }

    if (matches.length === 0) return null;
    matches.sort((a: any, b: any) => b.mtime - a.mtime);
    return matches[0].fullPath;
  } catch {
    return null;
  }
}

export function mergeCqgRawFiles(
  dirPath: string,
  prefix: 'FR' | 'PS' | 'OP' | 'OD',
  logger?: { log: (msg: string) => void; error: (msg: string) => void },
): string | null {
  if (!fs.existsSync(dirPath)) return null;
  try {
    const files = fs.readdirSync(dirPath);
    const regex1 = new RegExp(`^${prefix}\\s*1.*\\.xlsx$`, 'i');
    const regex2 = new RegExp(`^${prefix}\\s*2.*\\.xlsx$`, 'i');

    const f1 = files.find((f) => regex1.test(f) && !f.startsWith('~$'));
    const f2 = files.find((f) => regex2.test(f) && !f.startsWith('~$'));

    if (!f1 && !f2) return null;

    const p1 = f1 ? path.join(dirPath, f1) : null;
    const p2 = f2 ? path.join(dirPath, f2) : null;
    const destPath = path.join(dirPath, `${prefix}.xlsx`);

    let rows1: any[][] = [];
    if (p1 && fs.existsSync(p1)) {
      try {
        const wb1 = XLSX.readFile(p1);
        rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });
      } catch {}
    }

    let rows2: any[][] = [];
    if (p2 && fs.existsSync(p2)) {
      try {
        const wb2 = XLSX.readFile(p2);
        rows2 = XLSX.utils.sheet_to_json(wb2.Sheets[wb2.SheetNames[0]], { header: 1 });
      } catch {}
    }

    const headerRow = rows1[1] || rows1[0] || rows2[1] || rows2[0] || [];
    const data1 =
      rows1.length > 4
        ? rows1.slice(2, rows1.length - (prefix === 'FR' ? 2 : 0))
        : rows1.length > 2
          ? rows1.slice(2)
          : [];
    const data2 =
      rows2.length > 4
        ? rows2.slice(2, rows2.length - (prefix === 'FR' ? 2 : 0))
        : rows2.length > 2
          ? rows2.slice(2)
          : [];

    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...data2);

    const nwb = XLSX.utils.book_new();
    const ns = XLSX.utils.aoa_to_sheet(mergedData);
    XLSX.utils.book_append_sheet(nwb, ns, 'Sheet1');
    XLSX.writeFile(nwb, destPath, { compression: true });
    logger?.log(`Tự động ghép ${f1 || ''} + ${f2 || ''} -> ${destPath} (${mergedData.length} dòng)`);
    return destPath;
  } catch (err: any) {
    logger?.error(`Lỗi ghép file ${prefix}: ${err.message}`);
    return null;
  }
}

export function resolveCqgFile(
  dirPath: string,
  prefix: 'FR' | 'PS' | 'OP',
  logger?: { log: (msg: string) => void; warn: (msg: string) => void; error: (msg: string) => void },
): string | null {
  if (!fs.existsSync(dirPath)) return null;

  const mergedFile = findLatestFile(dirPath, new RegExp(`^${prefix}\\.xlsx$`, 'i'));
  const f1 = findLatestFile(dirPath, new RegExp(`^${prefix}\\s*1.*\\.xlsx$`, 'i'));
  const f2 = findLatestFile(dirPath, new RegExp(`^${prefix}\\s*2.*\\.xlsx$`, 'i'));

  if (f1 || f2) {
    if (!mergedFile) {
      return mergeCqgRawFiles(dirPath, prefix, logger);
    }
    try {
      const mergedMtime = fs.statSync(mergedFile).mtimeMs;
      const f1Mtime = f1 ? fs.statSync(f1).mtimeMs : 0;
      const f2Mtime = f2 ? fs.statSync(f2).mtimeMs : 0;
      const mergedSize = fs.statSync(mergedFile).size;

      if (f1Mtime > mergedMtime || f2Mtime > mergedMtime || mergedSize < 2500) {
        logger?.log(
          `[Recon] Raw files cho ${prefix} mới hơn hoặc file gộp quá nhỏ (${mergedSize}B). Tự động ghép lại...`,
        );
        const newMerged = mergeCqgRawFiles(dirPath, prefix, logger);
        if (newMerged) return newMerged;
      }
    } catch (err: any) {
      logger?.warn(`[Recon] Lỗi kiểm tra mtime ${prefix}: ${err.message}`);
    }
  }

  return (
    mergedFile ||
    mergeCqgRawFiles(dirPath, prefix, logger) ||
    findLatestFile(dirPath, new RegExp(`${prefix}`, 'i'))
  );
}

export async function getCcpBackupBasePath(settingsService: any): Promise<string> {
  try {
    const credRaw = await settingsService.getSetting('bot_credentials_ccp', '');
    if (credRaw) {
      try {
        const creds = JSON.parse(decrypt(credRaw));
        if (creds?.outputDir) {
          return String(creds.outputDir).trim();
        }
      } catch {}
    }
  } catch {}
  return settingsService.getSetting(
    'bot_backup_path_ccp',
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
  );
}

export function resolveCcpDailyPath(subFolder: string, rawCcpBase?: string): string {
  const defaultDataPath = path.join(process.cwd(), 'data', 'backup', 'ccp', 'futures');
  const base = rawCcpBase ? resolveStoragePathCrossPlatform(rawCcpBase) : defaultDataPath;
  const target = path.join(base, subFolder);
  if (fs.existsSync(target)) return target;

  const candidates = [
    path.join(defaultDataPath, subFolder),
    path.join(process.cwd(), 'backupCCP', subFolder),
    path.join(process.cwd(), 'data', 'backup', 'ccp', subFolder),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return target;
}

export function parseDSGD(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet)
    throw new Error('Không tìm thấy sheet nào trong file DSGD.xlsx');

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

  if (
    maLenhIdx === -1 ||
    maTKGDIdx === -1 ||
    maHDIdx === -1 ||
    klGiaoDichIdx === -1 ||
    giaKhopIdx === -1
  ) {
    throw new Error(
      'Thiếu cột bắt buộc trong file DSGD.xlsx (Mã lệnh, Mã TKGD, Mã HĐ, KL giao dịch, Giá khớp)',
    );
  }

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maLenh = String(row[maLenhIdx] || '').trim();
    const maTKGD = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const maHD = String(row[maHDIdx] || '').trim();
    const klGiaoDich = parseFloat(row[klGiaoDichIdx]) || 0;
    const giaKhop = parseFloat(row[giaKhopIdx]) || 0;
    const ngayGio =
      ngayGioIdx !== -1 ? String(row[ngayGioIdx] || '').trim() : '';
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

    const tempOrdIdx = findHeaderIndex(rowHeaders, 'Ord #', [
      'ord',
      'ord #',
      'order',
      'order #',
      'order number',
    ]);
    const tempAccountIdx = findHeaderIndex(rowHeaders, 'Account', [
      'account',
      'tk',
      'tài khoản',
      'ma tkgd',
      'account number',
      'acc',
    ]);
    const tempSymbolIdx = findHeaderIndex(rowHeaders, 'Symbol', [
      'symbol',
      'ma hd',
      'mã hợp đồng',
      'ma hop dong',
      'contract',
    ]);
    const tempQtyIdx = findHeaderIndex(rowHeaders, 'Qty', [
      'qty',
      'quantity',
      'kl',
      'khối lượng',
      'volume',
      'qty.',
    ]);
    const tempFillPIdx = findHeaderIndex(rowHeaders, 'Fill P', [
      'fill p',
      'fill price',
      'gia khop',
      'giá khớp',
      'fill_p',
      'fillpx',
      'fill px',
    ]);
    const tempTimeIdx = findHeaderIndex(rowHeaders, 'Time', [
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
    const fallbackHeaders = rows[1]
      ? rows[1].map((h) => String(h || '').trim())
      : [];
    headerRowIdx = 1;
    ordIdx = findHeaderIndex(fallbackHeaders, 'Ord #', [
      'ord',
      'ord #',
      'order',
      'order #',
    ]);
    accountIdx = findHeaderIndex(fallbackHeaders, 'Account', [
      'account',
      'tk',
      'tài khoản',
      'ma tkgd',
      'account number',
      'acc',
    ]);
    symbolIdx = findHeaderIndex(fallbackHeaders, 'Symbol', [
      'symbol',
      'ma hd',
      'mã hợp đồng',
      'ma hop dong',
      'contract',
    ]);
    qtyIdx = findHeaderIndex(fallbackHeaders, 'Qty', [
      'qty',
      'quantity',
      'kl',
      'khối lượng',
      'volume',
    ]);
    fillPIdx = findHeaderIndex(fallbackHeaders, 'Fill P', [
      'fill p',
      'fill price',
      'gia khop',
      'giá khớp',
      'fill_p',
    ]);
    timeIdx = findHeaderIndex(fallbackHeaders, 'Time', [
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
    throw new Error(
      'Thiếu cột bắt buộc trong file CQG FR (Ord #, Account, Symbol, Qty, Fill P)',
    );
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
      if (parsedTime) {
        tradeDate = parsedTime;
      }
    }

    const symbolRaw = convertLMESymbol(symbol, tradeDate, holidays);

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
        throw new Error(
          "Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits",
        );
      }

      const result: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(',');

        const buyVal =
          buyColIndex !== -1 && buyColIndex < values.length
            ? parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0
            : 0;
        const sellVal =
          sellColIndex !== -1 && sellColIndex < values.length
            ? parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0
            : 0;
        const volume = buyVal + sellVal;
        if (volume === 0) continue;

        const maLenh =
          brokerTradeIdColIndex !== -1 &&
            brokerTradeIdColIndex < values.length
            ? values[brokerTradeIdColIndex].replace(/"/g, '').trim()
            : 'STRAITS';
        const maTKGD =
          subAccColIndex !== -1 && subAccColIndex < values.length
            ? getNormalizedAccount(
              values[subAccColIndex].replace(/"/g, '').trim(),
            )
            : 'Straits';
        const maHD =
          productCodeColIndex !== -1 && productCodeColIndex < values.length
            ? values[productCodeColIndex].replace(/"/g, '').trim()
            : 'Straits';
        const giaKhop =
          priceColIndex !== -1 && priceColIndex < values.length
            ? parseFloat(values[priceColIndex].replace(/"/g, '').trim()) || 0
            : 0;
        let ngayGio =
          executionTimeColIndex !== -1 &&
          executionTimeColIndex < values.length
            ? values[executionTimeColIndex].replace(/"/g, '').trim()
            : '';
        if (
          !ngayGio &&
          tradeDateColIndex !== -1 &&
          tradeDateColIndex < values.length
        ) {
          ngayGio = values[tradeDateColIndex].replace(/"/g, '').trim();
        }
        const maGD = maLenh;

        result.push({
          maLenh,
          maTKGD,
          maHD,
          klGiaoDich: volume,
          giaKhop,
          ngayGio,
          maGD,
          combinedKey: `${maTKGD}${maGD}${volume}`,
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

  const header = rows[0].map((h) =>
    String(h || '')
      .trim()
      .toLowerCase(),
  );
  const maLenhIdx = header.indexOf('order sysid');
  const maTKGDIdx = header.indexOf('trader id');
  const maHDIdx = header.indexOf('instrument id');
  const klGiaoDichIdx = header.indexOf('volume');
  const giaKhopIdx = header.indexOf('price');
  const ngayIdx = header.indexOf('trading day');
  const tradeDateIdx = header.indexOf('trade date');
  const gioIdx = header.indexOf('trade time');
  const maGDIdx = header.indexOf('trade id');

  if (
    maLenhIdx === -1 ||
    maTKGDIdx === -1 ||
    maHDIdx === -1 ||
    klGiaoDichIdx === -1 ||
    giaKhopIdx === -1 ||
    maGDIdx === -1
  ) {
    throw new Error(
      'Thiếu cột bắt buộc trong file Nano (Order Sysid, Trader Id, Instrument Id, Volume, Price, Trade Id)',
    );
  }

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maLenh = String(row[maLenhIdx] || '').trim();
    const maTKGD = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const maHD = String(row[maHDIdx] || '').trim();
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

    const tempAccountIdx = findHeaderIndex(rowHeaders, 'Account', [
      'account',
      'tk',
      'tài khoản',
      'ma tkgd',
      'account number',
      'acc',
    ]);
    const tempSymbolIdx = findHeaderIndex(rowHeaders, 'Symbol', [
      'symbol',
      'ma hd',
      'mã hợp đồng',
      'ma hop dong',
      'contract',
    ]);

    const tempLIdx = rowHeaders.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
    });
    const tempSIdx = rowHeaders.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
    });

    if (
      tempAccountIdx !== -1 &&
      tempSymbolIdx !== -1 &&
      tempLIdx !== -1 &&
      tempSIdx !== -1
    ) {
      headerRowIdx = r;
      accountIdx = tempAccountIdx;
      symbolIdx = tempSymbolIdx;
      lIdx = tempLIdx;
      sIdx = tempSIdx;
      break;
    }
  }

  if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
    const fallbackHeader = rows[1]
      ? rows[1].map((h) => String(h || '').trim())
      : [];
    accountIdx = findHeaderIndex(fallbackHeader, 'Account', [
      'account',
      'tk',
      'tài khoản',
      'ma tkgd',
      'account number',
      'acc',
    ]);
    symbolIdx = findHeaderIndex(fallbackHeader, 'Symbol', [
      'symbol',
      'ma hd',
      'mã hợp đồng',
      'ma hop dong',
      'contract',
    ]);
    lIdx = fallbackHeader.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 'l' || norm.startsWith('l (') || norm.startsWith('(');
    });
    sIdx = fallbackHeader.findIndex((h) => {
      const norm = h.toLowerCase().trim();
      return norm === 's' || norm.startsWith('s (') || norm.startsWith('s(');
    });
  }

  if (accountIdx === -1 || symbolIdx === -1 || lIdx === -1 || sIdx === -1) {
    throw new Error(
      'Thiếu cột bắt buộc trong file OP (Account, Symbol, L, S)',
    );
  }

  const result: any[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const account = String(row[accountIdx] || '').trim();
    const symbol = String(row[symbolIdx] || '').trim();
    const lValue = parseCqgNumber(row[lIdx]);
    const sValue = parseCqgNumber(row[sIdx]);

    if (!symbol) continue;

    const accountRaw = getNormalizedAccount(account);

    result.push({
      account: accountRaw,
      symbol,
      lValue,
      sValue,
    });
  }
  return result;
}

export function parseTTM(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());

  const maTKGDIdx = header.findIndex(
    (h) => h === 'Mã TKGD' || h === 'Mã tài khoản',
  );
  const maHDIdx = header.findIndex(
    (h) => h === 'Mã HĐ' || h === 'Mã hợp đồng',
  );
  const tongMuaIdx = header.findIndex((h) => h.toLowerCase() === 'kl mua');
  const tongBanIdx = header.findIndex((h) => h.toLowerCase() === 'kl bán');
  const giaKhopIdx = header.findIndex(
    (h) => h === 'Giá TB' || h === 'Giá khớp' || h === 'Giá trung bình',
  );

  if (
    maTKGDIdx === -1 ||
    maHDIdx === -1 ||
    tongMuaIdx === -1 ||
    tongBanIdx === -1
  ) {
    throw new Error(
      'Thiếu cột bắt buộc trong file TTM.xlsx (Mã TKGD, Mã HĐ, KL Mua/Tổng mua, KL Bán/Tổng bán)',
    );
  }

  const result: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const maTKGD = getNormalizedAccount(String(row[maTKGDIdx] || ''));
    const maHD = String(row[maHDIdx] || '').trim();
    const tongMua = parseFloat(row[tongMuaIdx]) || 0;
    const tongBan = parseFloat(row[tongBanIdx]) || 0;
    const giaKhop = giaKhopIdx !== -1 ? parseFloat(row[giaKhopIdx]) || 0 : 0;

    if (!maTKGD || !maHD) continue;

    result.push({
      maTKGD,
      maHD,
      tongMua,
      tongBan,
      giaKhop,
    });
  }
  return result;
}

export function parseTTTTForVolume(buffer: Buffer): any[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
  if (rows.length < 2) return [];

  const header = rows[0].map((h) => String(h || '').trim());

  const maTKGDIdx = findHeaderIndex(header, 'Mã TKGD', [
    'Mã tài khoản',
    'Account',
    'Mã khách hàng',
    'Mã KH',
  ]);
  const maHDIdx = findHeaderIndex(header, 'Mã HĐ', [
    'Mã hợp đồng',
    'Symbol',
    'Mã HH',
    'Mã hàng hóa',
  ]);
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
    const maHD = String(row[finalSymIdx] || '').trim();
    const tongMua = parseFloat(row[finalMuaIdx]) || 0;
    const tongBan = parseFloat(row[finalBanIdx]) || 0;

    if (!maTKGD || !maHD) continue;

    result.push({
      maTKGD,
      maHD,
      tongMua,
      tongBan,
    });
  }
  return result;
}

export function parsePSForVolume(buffer: Buffer): any[] {
  return parseOP(buffer);
}

export function parseStraitsCsv(buffer: Buffer): { totalVolume: number } {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/);
  if (lines.length === 0) {
    throw new Error('File Straits CSV rỗng');
  }
  const headerLine = lines[0];
  const headers = headerLine.split(',').map((h) => h.trim().toLowerCase());
  const buyColIndex = headers.indexOf('buy');
  const sellColIndex = headers.indexOf('sell');

  if (buyColIndex === -1 || sellColIndex === -1) {
    throw new Error(
      "Không tìm thấy cột 'Buy' hoặc 'Sell' trong file CSV Straits",
    );
  }

  let totalVolume = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',');
    if (buyColIndex < values.length) {
      const buyVal =
        parseFloat(values[buyColIndex].replace(/"/g, '').trim()) || 0;
      totalVolume += buyVal;
    }
    if (sellColIndex < values.length) {
      const sellVal =
        parseFloat(values[sellColIndex].replace(/"/g, '').trim()) || 0;
      totalVolume += sellVal;
    }
  }
  return { totalVolume };
}

export function parseTTTTForRecon(
  buffer: Buffer,
): { account: string; symbol: string; position: number }[] {
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
    const tempAccIdx = findHeaderIndex(rowHeaders, 'Mã TKGD', [
      'mã tài khoản',
      'account',
      'mã khách hàng',
      'mã kh',
      'tk',
    ]);
    const tempSymIdx = findHeaderIndex(rowHeaders, 'Mã HĐ', [
      'mã hợp đồng',
      'symbol',
      'mã hh',
      'mã hàng hóa',
    ]);
    const tempPosIdx = findHeaderIndex(rowHeaders, 'KL ròng', [
      'khối lượng ròng',
      'net position',
      'position',
      'vị thế ròng',
      'trạng thái ròng',
      'lãi lỗ thực tế',
      'lãi/lỗ',
    ]);

    if (tempAccIdx !== -1 && tempSymIdx !== -1) {
      headerRowIdx = r;
      accountIdx = tempAccIdx;
      symbolIdx = tempSymIdx;
      if (tempPosIdx !== -1) {
        positionIdx = tempPosIdx;
      }
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
    const symbol = String(row[symbolIdx] || '').trim();
    const position = parseFloat(row[finalPosIdx]) || 0;
    if (!accountRaw || !symbol) continue;

    const account = getNormalizedAccount(accountRaw);
    result.push({ account, symbol, position });
  }
  return result;
}

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
    const tempAccIdx = findHeaderIndex(rowHeaders, 'Account', [
      'account',
      'tk',
      'tài khoản',
      'ma tkgd',
      'account number',
      'acc',
    ]);
    const tempSymIdx = findHeaderIndex(rowHeaders, 'Symbol', [
      'symbol',
      'ma hd',
      'mã hợp đồng',
      'ma hop dong',
      'contract',
    ]);
    const tempPosIdx = findHeaderIndex(rowHeaders, 'Position', [
      'net',
      'kl ròng',
      'vị thế',
      'trạng thái ròng',
      'pl',
      'profit',
      'lỗ',
    ]);

    if (tempAccIdx !== -1 && tempSymIdx !== -1) {
      headerRowIdx = r;
      accountIdx = tempAccIdx;
      symbolIdx = tempSymIdx;
      if (tempPosIdx !== -1) {
        positionIdx = tempPosIdx;
      }
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
    symbol = convertLMESymbol(symbol, tradingDate, holidays);

    result.push({ account, symbol, position });
  }
  return result;
}


