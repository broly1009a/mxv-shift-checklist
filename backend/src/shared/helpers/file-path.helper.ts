import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { decrypt } from '../../modules/bot-engine/utils/crypto';

/**
 * Chuyển đổi đường dẫn lưu trữ đa nền tảng (Windows UNC / Drive Letter <-> Linux Mount /mnt/qlgd-it)
 * Đồng bộ chuẩn 100% với bot-path.helper.ts để đảm bảo nhận diện chính xác cấu trúc thư mục Quanlygiaodich
 */
export function resolveStoragePathCrossPlatform(rawPath: string): string {
  if (!rawPath) return rawPath;

  const linuxMountBase = (process.env.STORAGE_MOUNT_LINUX || '/mnt/qlgd-it')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const windowsShareBase = (process.env.STORAGE_SHARE_WINDOWS || 'M:\\Tailieuchung\\QLGD-IT')
    .replace(/[/\\]+$/, '');

  const normalized = rawPath.replace(/\\/g, '/');

  if (process.platform !== 'win32') {
    // UNC path like //10.0.0.26/Tailieuchung/QLGD-IT/...
    const uncMatch = normalized.match(/^\/\/[^/]+\/(?:tailieuchung\/qlgd-it\/|tailieuchung\/)?(.*)$/i);
    if (uncMatch) {
      return `${linuxMountBase}/${uncMatch[1]}`.replace(/\/+/g, '/');
    }

    const qlgdMatch = normalized.match(/(?:^|\/)(quanlygiaodich\/.*)$/i);
    if (qlgdMatch) {
      return `${linuxMountBase}/${qlgdMatch[1]}`.replace(/\/+/g, '/');
    }
    if (/^[a-zA-Z]:\/tailieuchung\/qlgd-it\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^[a-zA-Z]:\/tailieuchung\/qlgd-it\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^[a-zA-Z]:\/qlgd-it\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^[a-zA-Z]:\/qlgd-it\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^\/mnt\/oc-uat\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^\/mnt\/oc-uat\//i, '')}`.replace(/\/+/g, '/');
    }
    if (/^m:\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^m:\//i, '')}`.replace(/\/+/g, '/');
    }
    return normalized;
  } else {
    // Windows
    const linuxBaseSlash = linuxMountBase.toLowerCase();
    if (normalized.toLowerCase().startsWith(linuxBaseSlash)) {
      const remainder = normalized.slice(linuxBaseSlash.length).replace(/^\/+/, '');
      return path.join(windowsShareBase, remainder);
    }
    if (normalized.toLowerCase().startsWith('/mnt/oc-uat')) {
      const remainder = normalized.slice('/mnt/oc-uat'.length).replace(/^\/+/, '');
      return path.join(windowsShareBase, remainder);
    }
    return path.normalize(rawPath);
  }
}

/**
 * Chuyển đổi ngược từ đường dẫn nội bộ máy chủ (Linux mount /mnt/qlgd-it/...) sang đường dẫn Windows mount dùng chung (M:\Tailieuchung\QLGD-IT\...)
 * để hiển thị chuẩn xác trên giao diện người dùng Windows và payload kết quả API.
 */
export function toWindowsDisplayPath(rawPath?: string): string {
  if (!rawPath) return '';

  const linuxMountBase = (process.env.STORAGE_MOUNT_LINUX || '/mnt/qlgd-it')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const windowsShareBase = (process.env.STORAGE_SHARE_WINDOWS || 'M:\\Tailieuchung\\QLGD-IT')
    .replace(/[/\\]+$/, '');

  const normalized = rawPath.replace(/\\/g, '/');

  // Nhận diện qua tiền tố mount Linux /mnt/qlgd-it
  const linuxBaseSlash = linuxMountBase.toLowerCase();
  if (normalized.toLowerCase().startsWith(linuxBaseSlash)) {
    const remainder = normalized.slice(linuxBaseSlash.length).replace(/^\/+/, '');
    return `${windowsShareBase}\\${remainder.replace(/\//g, '\\')}`;
  }

  // Nhận diện qua tiền tố /mnt/oc-uat
  if (normalized.toLowerCase().startsWith('/mnt/oc-uat')) {
    const remainder = normalized.slice('/mnt/oc-uat'.length).replace(/^\/+/, '');
    return `${windowsShareBase}\\${remainder.replace(/\//g, '\\')}`;
  }

  // Nhận diện trực tiếp qua thư mục gốc Quanlygiaodich
  const qlgdMatch = normalized.match(/(?:^|\/)(quanlygiaodich\/.*)$/i);
  if (qlgdMatch) {
    return `${windowsShareBase}\\${qlgdMatch[1].replace(/\//g, '\\')}`;
  }

  // Nếu đã là đường dẫn Windows, chuẩn hóa dấu gạch chéo ngược
  if (/^[a-zA-Z]:/.test(rawPath) || rawPath.startsWith('\\\\')) {
    return rawPath.replace(/\//g, '\\');
  }

  return rawPath;
}

/**
 * Helper to strictly extract and parse targetDate / sessionDay from job payload.
 * Throws an error if targetDate is missing or invalid, preventing implicit fallback to real-time Date.
 */
export function resolveBotTargetDate(payload: any): { dateObj: Date; dateStr: string } {
  const targetDateStr = payload?.targetDate || payload?.sessionDay;
  if (!targetDateStr) {
    throw new Error(
      'Bot Job thiếu tham số ngày ca trực bắt buộc (targetDate / sessionDay). Không thể xác định ngày lưu file.',
    );
  }

  let dateObj: Date;
  if (targetDateStr instanceof Date) {
    dateObj = targetDateStr;
  } else {
    // Parse YYYY-MM-DD, DD/MM/YYYY, or DD.MM.YYYY safely without timezone offset issues
    const str = String(targetDateStr).split('T')[0].trim();
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          dateObj = new Date(year, month, day);
        } else {
          // DD-MM-YYYY
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          dateObj = new Date(year, month, day);
        }
      } else {
        dateObj = new Date(targetDateStr);
      }
    } else if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY/MM/DD
          dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
          // DD/MM/YYYY
          dateObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        }
      } else {
        dateObj = new Date(targetDateStr);
      }
    } else if (str.includes('.')) {
      const parts = str.split('.');
      if (parts.length === 3) {
        // DD.MM.YYYY
        dateObj = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
      } else {
        dateObj = new Date(targetDateStr);
      }
    } else {
      dateObj = new Date(targetDateStr);
    }
  }

  if (isNaN(dateObj.getTime())) {
    throw new Error(`Định dạng ngày ca trực không hợp lệ: ${targetDateStr}`);
  }

  const year = dateObj.getFullYear().toString();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const formattedDateStr = `${year}-${month}-${day}`;

  return { dateObj, dateStr: formattedDateStr };
}

/**
 * Mốc giờ bắt đầu phiên giao dịch mặc định của hệ thống MXV (đồng bộ với setting session_start_time trong CSDL)
 */
/**
 * Interface cho tham số cấu hình thời gian phiên giao dịch linh hoạt từ CSDL.
 * Tuân thủ quy tắc Fail-Fast: Bắt buộc cung cấp sessionStartStr, không dùng fallback ngầm.
 */
export interface TradingSessionTimeOptions {
  sessionStartStr: string; // Giờ bắt đầu phiên giao dịch từ CSDL (Bắt buộc, ví dụ: '05:00', '06:00')
}

/**
 * Chuyển đổi chuỗi thời gian HH:mm sang số phút trong ngày (0 - 1439).
 * Không ném lỗi, trả về defaultMinutes nếu chuỗi không hợp lệ.
 */
export function parseTimeToMinutes(timeStr?: string | null, defaultMinutes = 0): number {
  if (!timeStr || typeof timeStr !== 'string') return defaultMinutes;
  const parts = timeStr.trim().split(':').map((v) => parseInt(v, 10));
  if (parts.length >= 1 && !isNaN(parts[0])) {
    const hours = Math.max(0, Math.min(23, parts[0]));
    const minutes = parts.length >= 2 && !isNaN(parts[1]) ? Math.max(0, Math.min(59, parts[1])) : 0;
    return hours * 60 + minutes;
  }
  return defaultMinutes;
}

/**
 * Định dạng Date thành chuỗi ISO Date (YYYY-MM-DD).
 */
export function formatDateToIso(date: Date): string {
  const year = date.getFullYear().toString();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Kiểm tra xem thị trường tài chính / hàng hóa có đang trong khoảng đóng cửa cuối tuần hay không:
 * - Sau giờ kết thúc phiên Thứ Sáu vào sáng Thứ Bảy (được xác định theo mốc session_start_time từ CSDL)
 * - Cả ngày Chủ Nhật
 * - Trước giờ mở phiên sáng Thứ Hai (được xác định theo mốc session_start_time từ CSDL)
 * 
 * Toàn bộ chu kỳ đóng/mở phiên cuối tuần được điều khiển 100% động bởi mốc phiên session_start_time:
 * - options.sessionStartStr: Bắt buộc truyền giờ bắt đầu phiên từ CSDL. Fail-Fast nếu rỗng/thiếu.
 */
export function isMarketWeekendClosed(
  dateInput?: Date,
  options?: TradingSessionTimeOptions,
): boolean {
  if (
    !options?.sessionStartStr ||
    typeof options.sessionStartStr !== 'string' ||
    options.sessionStartStr.trim() === ''
  ) {
    throw new Error(
      '[Market Weekend Guard] options.sessionStartStr là bắt buộc để xác định chính xác thời điểm đóng/mở phiên giao dịch từ CSDL. Tuyệt đối không phỏng đoán giờ mặc định.',
    );
  }

  const sessionMinutes = parseTimeToMinutes(options.sessionStartStr, -1);
  if (sessionMinutes < 0) {
    throw new Error(
      `[Market Weekend Guard] Định dạng giờ phiên không hợp lệ: "${options.sessionStartStr}". Kỳ vọng định dạng "HH:mm".`,
    );
  }

  const d = dateInput
    ? new Date(dateInput.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }))
    : new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));

  const day = d.getDay(); // 0 = Chủ Nhật, 1 = Thứ Hai, ..., 6 = Thứ Bảy
  const timeNum = d.getHours() * 60 + d.getMinutes();

  // 1. Cả ngày Chủ Nhật luôn đóng cửa
  if (day === 0) return true;

  // 2. Sáng Thứ Bảy sau khi phiên Thứ Sáu kết thúc (sau mốc session_start_time)
  if (day === 6 && timeNum >= sessionMinutes) return true;

  // 3. Sáng Thứ Hai trước khi phiên tuần mới mở (trước mốc session_start_time)
  if (day === 1 && timeNum < sessionMinutes) return true;

  return false;
}

/**
 * Hàm nội bộ: Lùi ngày làm việc cho phiên giao dịch (bỏ qua Thứ 7, Chủ Nhật)
 */
function rollBackTradingDay(baseDate: Date, isOvernight: boolean, isMonday: boolean): Date {
  const target = new Date(baseDate);
  target.setHours(0, 0, 0, 0);

  if (isOvernight) {
    // Ca đêm: lùi về phiên trước (trừ rạng sáng Thứ Hai để tránh bẫy lùi vượt cuối tuần về Thứ Sáu)
    if (!isMonday) {
      target.setDate(target.getDate() - 1);
      while (target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() - 1);
      }
    }
  } else {
    // Ban ngày: nếu rơi vào Thứ 7 hoặc Chủ Nhật thì lùi về Thứ 6 làm việc gần nhất
    while (target.getDay() === 0 || target.getDay() === 6) {
      target.setDate(target.getDate() - 1);
    }
  }
  return target;
}

/**
 * Xác định Ngày Phiên Giao Dịch thực tế (Trading Session Date) chuẩn theo Tool C# (operate-transaction-app):
 * - Một phiên giao dịch mở lúc sessionStartStr và kéo dài xuyên đêm tới trước giờ mở phiên hôm sau.
 * - Nếu thời điểm hiện tại < giờ mở phiên (ca đêm), phiên giao dịch thực tế là ngày T-1 (bỏ qua T7, CN).
 * - Nếu dateInput là ngày hôm nay theo dương lịch, hàm tự động lùi về T-1 khi đang trong ca đêm.
 * - Nếu dateInput là một ngày quá khứ cụ thể khác hôm nay (người dùng cố ý soi lại lịch sử), hàm giữ nguyên ngày đó.
 * 
 * Áp dụng nguyên tắc Fail-Fast: options.sessionStartStr là bắt buộc để tránh tính sai ngày phiên.
 */
export function resolveTradingSessionDate(
  dateInput?: string | Date | null,
  options?: {
    now?: Date;
    sessionStartStr: string;
    forceExactDate?: boolean;
  },
): { dateObj: Date; dateStr: string; isOvernight: boolean } {
  if (
    !options?.sessionStartStr ||
    typeof options.sessionStartStr !== 'string' ||
    options.sessionStartStr.trim() === ''
  ) {
    throw new Error(
      '[resolveTradingSessionDate] options.sessionStartStr là bắt buộc để xác định chính xác ngày phiên giao dịch từ CSDL. Tuyệt đối không phỏng đoán giờ mặc định.',
    );
  }

  const sessionStartMinutes = parseTimeToMinutes(options.sessionStartStr, -1);
  if (sessionStartMinutes < 0) {
    throw new Error(
      `[resolveTradingSessionDate] Định dạng giờ phiên không hợp lệ: "${options.sessionStartStr}". Kỳ vọng định dạng "HH:mm".`,
    );
  }

  const nowVN =
    options?.now ||
    new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    );
  const todayVnStr = formatDateToIso(nowVN);

  const currentMinutes = nowVN.getHours() * 60 + nowVN.getMinutes();
  const isOvernight = currentMinutes < sessionStartMinutes;
  const isMonday = nowVN.getDay() === 1;

  let targetDateObj: Date;

  if (!dateInput) {
    targetDateObj = rollBackTradingDay(nowVN, isOvernight, isMonday);
  } else {
    const parsed =
      dateInput instanceof Date
        ? new Date(dateInput)
        : resolveBotTargetDate({ targetDate: dateInput }).dateObj;
    parsed.setHours(0, 0, 0, 0);

    const parsedStr = formatDateToIso(parsed);
    if (!options?.forceExactDate && parsedStr === todayVnStr) {
      targetDateObj = rollBackTradingDay(parsed, isOvernight, isMonday);
    } else {
      targetDateObj = parsed;
    }
  }

  return {
    dateObj: targetDateObj,
    dateStr: formatDateToIso(targetDateObj),
    isOvernight,
  };
}

/**
 * Helper to compute daily backup subfolder (YYYY\TMM.YYYY\DD.MM) and full path.
 */
export function resolveDailySubfolder(
  baseDir: string,
  dateInput: Date | string,
): { subFolder: string; fullPath: string } {
  const dateObj =
    typeof dateInput === 'string' || !(dateInput instanceof Date)
      ? resolveBotTargetDate({ targetDate: dateInput }).dateObj
      : dateInput;

  const year = dateObj.getFullYear().toString();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');

  const resolvedBase = resolveStoragePathCrossPlatform(baseDir);
  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
  const fullPath = path.join(resolvedBase, subFolder);

  return { subFolder, fullPath };
}

/**
 * Tìm file mới nhất theo regex trong thư mục
 */
export function findLatestFile(dirPath: string, pattern: RegExp): string | null {
  if (!fs.existsSync(dirPath)) return null;
  try {
    const files = fs.readdirSync(dirPath);
    let latestFile: string | null = null;
    let latestMtime = 0;

    for (const f of files) {
      if (pattern.test(f) && !f.startsWith('~$')) {
        const full = path.join(dirPath, f);
        try {
          const stat = fs.statSync(full);
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            latestFile = full;
          }
        } catch {}
      }
    }
    return latestFile;
  } catch {
    return null;
  }
}

/**
 * Ghép các cặp file thô CQG (FR1+FR2, PS1+PS2, OP1+OP2, OD1+OD2)
 */
export function mergeCqgRawFiles(
  dirPath: string,
  prefix: 'FR' | 'PS' | 'OP' | 'OD',
  logger?: { log: (msg: string) => void; warn?: (msg: string) => void; error: (msg: string) => void },
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

    let finalData2 = data2;
    if (prefix === 'FR' && headerRow.length > 0) {
      const normHeaders = headerRow.map((h: any) => String(h || '').trim().toLowerCase().replace(/\s+/g, ' '));
      const ordIdx = normHeaders.findIndex(
        (h: string) => h === 'ord #' || h === 'ord' || h === 'order #' || h === 'order',
      );
      const accIdx = normHeaders.findIndex((h: string) => h === 'account' || h === 'acc');
      const symIdx = normHeaders.findIndex((h: string) => h === 'symbol' || h === 'sym');
      const qtyIdx = normHeaders.findIndex((h: string) => h === 'qty' || h === 'quantity');
      const fillPIdx = normHeaders.findIndex((h: string) => h === 'fill p' || h === 'fill price' || h === 'price');
      const timeIdx = normHeaders.findIndex((h: string) => h === 'time');

      const seenKeys = new Set<string>();
      for (const r of data1) {
        const key = `${r[ordIdx] || ''}|${r[accIdx] || ''}|${r[symIdx] || ''}|${r[qtyIdx] || ''}|${r[fillPIdx] || ''}|${r[timeIdx] || ''}`;
        seenKeys.add(key);
      }
      let dupCount = 0;
      finalData2 = [];
      for (const r of data2) {
        const key = `${r[ordIdx] || ''}|${r[accIdx] || ''}|${r[symIdx] || ''}|${r[qtyIdx] || ''}|${r[fillPIdx] || ''}|${r[timeIdx] || ''}`;
        if (seenKeys.has(key)) {
          dupCount++;
          continue;
        }
        finalData2.push(r);
      }
      if (dupCount > 0) {
        logger?.log(`[CQG Merge] Đã khử trùng ${dupCount} bản ghi khớp lệnh trùng lặp giữa FR1 và FR2 theo composite key.`);
      }
    }

    const mergedData: any[] = [];
    if (headerRow && headerRow.length > 0) {
      mergedData.push(headerRow);
    }
    mergedData.push(...data1, ...finalData2);

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

/**
 * Tìm và giải quyết file CQG hợp lệ (ưu tiên file gộp hoặc tự động ghép nếu file thô mới hơn)
 */
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

/**
 * Lấy thư mục gốc backup của CoreCCP từ SystemSettings
 */
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
    '',
  );
}

/**
 * Phân giải đường dẫn thư mục phiên CCP hàng ngày
 */
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

/**
 * Phân giải đường dẫn thư mục TradingCheck CCP
 */
export function resolveTradingCheckCcpDailyPath(subFolder: string, rawCcpBase?: string): string {
  const defaultDataPath = path.join(process.cwd(), 'data', 'trading-check', 'ccp', 'futures');
  const checkBase = rawCcpBase
    ? resolveStoragePathCrossPlatform(rawCcpBase).replace(/Backup CCP/i, 'TradingCheck/CCP')
    : defaultDataPath;
  const target = path.join(checkBase, subFolder);
  if (fs.existsSync(target)) return target;

  const candidates = [
    path.join(defaultDataPath, subFolder),
    path.join(process.cwd(), 'TradingCheck', 'CCP', subFolder),
    path.join(process.cwd(), 'data', 'trading-check', 'ccp', subFolder),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return target;
}

/**
 * Lấy thư mục gốc backup của MS từ SystemSettings
 */
export async function getMsBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_ms',
    process.env.DEFAULT_BACKUP_PATH_MS ||
    '',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Lấy thư mục gốc backup của CQG từ SystemSettings
 */
export async function getCqgBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_cqg',
    process.env.DEFAULT_BACKUP_PATH_CQG ||
    '',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Lấy thư mục gốc backup của ACM từ SystemSettings
 */
export async function getAcmBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_acm',
    process.env.DEFAULT_BACKUP_PATH_ACM ||
    '',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Lấy thư mục gốc backup của CoreCCP từ SystemSettings
 */
export async function getCcpBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_ccp',
    process.env.DEFAULT_BACKUP_PATH_CCP ||
    '',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Lấy thư mục gốc backup của CoreEX từ SystemSettings
 */
export async function getCeBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_ce',
    process.env.DEFAULT_BACKUP_PATH_CE ||
    '',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Tìm vị trí index của tiêu đề cột Excel theo tên hoặc alias
 */
export function findHeaderIndex(headers: string[], target: string, aliases: string[] = []): number {
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

/**
 * Tìm file EOD khớp chính xác ngày phiên giao dịch dateStr (YYYY-MM-DD)
 */
export function findExactSessionEodFile(dirPath: string, dateStr: string): string | null {
  try {
    if (!fs.existsSync(dirPath)) return null;

    // 1. Khớp chính xác tên file: eod.{YYYY-MM-DD}.csv hoặc eod.{YYYY-MM-DD}.xlsx
    const exactCsv = path.join(dirPath, `eod.${dateStr}.csv`);
    if (fs.existsSync(exactCsv)) return exactCsv;

    const exactXlsx = path.join(dirPath, `eod.${dateStr}.xlsx`);
    if (fs.existsSync(exactXlsx)) return exactXlsx;

    // 2. Quét các file eod khác trong thư mục
    let files: string[] = [];
    try {
      files = fs.readdirSync(dirPath);
    } catch {
      return null;
    }

    for (const f of files) {
      if (!/eod/i.test(f)) continue;

      const fullPath = path.join(dirPath, f);
      const m = f.match(/(\d{4}[-_]\d{2}[-_]\d{2})/);
      if (m) {
        const fileDate = m[1].replace(/_/g, '-');
        if (fileDate === dateStr) {
          return fullPath;
        }
        continue;
      }

      // Nếu tên file không có ngày (như eod.csv), kiểm tra cột sessionDate bên trong
      if (f.toLowerCase().endsWith('.csv')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n').slice(0, 5);
          if (lines.length >= 2) {
            const header = lines[0].split(',').map((h) => h.replace(/["\r]/g, '').trim());
            const sessionDateIdx = header.findIndex((h) => /^sessionDate$/i.test(h));
            if (sessionDateIdx !== -1) {
              const row1 = lines[1].split(',').map((v) => v.replace(/["\r]/g, '').trim());
              const fileSessionDate = row1[sessionDateIdx];
              if (fileSessionDate && fileSessionDate.startsWith(dateStr)) {
                return fullPath;
              }
            }
          }
        } catch {}
      }
    }

    return null;
  } catch {
    return null;
  }
}

