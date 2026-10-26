import * as path from 'path';

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
 * Helper to safely extract job payload from Mongoose Map or Object.
 * Calls .toObject() if available to automatically convert nested Mongoose Maps.
 */
export function parseJobPayload<T = Record<string, any>>(job: { payload?: any } | any): T {
  if (!job) return {} as T;
  const rawObj = typeof job?.toObject === 'function' ? job.toObject() : job;
  const payload = rawObj?.payload;
  if (!payload) return {} as T;
  if (payload instanceof Map) {
    return Object.fromEntries(payload) as T;
  }
  return payload as T;
}

/**
 * Trích xuất và parse ngày ca trực (targetDate / sessionDay) từ payload.
 * Hỗ trợ các định dạng ngày phổ biến: YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY.
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
    dateObj = new Date(targetDateStr);
  } else {
    const str = String(targetDateStr).split('T')[0].trim();
    const match = str.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})$/);
    if (match) {
      const [, p1, p2, p3] = match;
      if (p1.length === 4) {
        // YYYY-MM-DD hoặc YYYY/MM/DD
        dateObj = new Date(parseInt(p1, 10), parseInt(p2, 10) - 1, parseInt(p3, 10));
      } else {
        // DD-MM-YYYY hoặc DD/MM/YYYY hoặc DD.MM.YYYY
        dateObj = new Date(parseInt(p3, 10), parseInt(p2, 10) - 1, parseInt(p1, 10));
      }
    } else {
      dateObj = new Date(targetDateStr);
    }
  }

  if (isNaN(dateObj.getTime())) {
    throw new Error(`Định dạng ngày ca trực không hợp lệ: ${targetDateStr}`);
  }

  return { dateObj, dateStr: formatDateToIso(dateObj) };
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
 * Helper to compute daily backup subfolder (YYYY\\TMM.YYYY\\DD.MM) and full path.
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
 * Hàm lấy thư mục backup gốc từ cấu hình CSDL và biến môi trường
 */
export async function getBackupBasePath(
  settingsService: { getSetting: (key: string, def: string) => Promise<string> },
  settingKey: string,
  envDefault = '',
): Promise<string> {
  const raw = await settingsService.getSetting(settingKey, envDefault);
  return resolveStoragePathCrossPlatform(raw);
}

export const getMsBackupBase = (s: { getSetting: (k: string, d: string) => Promise<string> }) =>
  getBackupBasePath(s, 'bot_backup_path_ms', process.env.DEFAULT_BACKUP_PATH_MS || '');

export const getCqgBackupBase = (s: { getSetting: (k: string, d: string) => Promise<string> }) =>
  getBackupBasePath(s, 'bot_backup_path_cqg', process.env.DEFAULT_BACKUP_PATH_CQG || '');

export const getAcmBackupBase = (s: { getSetting: (k: string, d: string) => Promise<string> }) =>
  getBackupBasePath(s, 'bot_backup_path_acm', process.env.DEFAULT_BACKUP_PATH_ACM || '');

export const getCcpBackupBase = (s: { getSetting: (k: string, d: string) => Promise<string> }) =>
  getBackupBasePath(s, 'bot_backup_path_ccp', process.env.DEFAULT_BACKUP_PATH_CCP || '');

export const getCeBackupBase = (s: { getSetting: (k: string, d: string) => Promise<string> }) =>
  getBackupBasePath(s, 'bot_backup_path_ce', process.env.DEFAULT_BACKUP_PATH_CE || '');

/**
 * Thay thế biến động ngày/tháng/năm (${YYYY}, ${MM}, ${DD}) vào chuỗi đường dẫn.
 * Nếu không truyền dateInput, mặc định lấy theo thời gian thực tế hiện tại (GMT+7).
 */
export function resolveDynamicPath(
  templatePath: string,
  dateInput?: Date | string,
): string {
  if (!templatePath || !templatePath.includes('${')) return templatePath;

  let d: Date;
  if (dateInput) {
    if (dateInput instanceof Date) {
      d = isNaN(dateInput.getTime()) ? new Date() : dateInput;
    } else {
      try {
        d = resolveBotTargetDate({ targetDate: dateInput }).dateObj;
      } catch {
        d = new Date();
      }
    }
  } else {
    d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  }

  const yyyy = d.getFullYear().toString();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return templatePath.replace(/\${(yyyy|mm|dd)}/gi, (_, key) => {
    const k = String(key).toUpperCase();
    if (k === 'YYYY') return yyyy;
    if (k === 'MM') return mm;
    if (k === 'DD') return dd;
    return _;
  });
}

/**
 * Chuẩn hóa đường dẫn lưu trữ chéo hệ điều hành (Windows vs Ubuntu):
 * - Nếu chạy trên Linux: tự động ánh xạ M:\Tailieuchung\QLGD-IT (hoặc Quanlygiaodich/..., UNC \\10.0.0.26\...) sang /mnt/qlgd-it/
 * - Nếu chạy trên Windows: nếu nhận được /mnt/qlgd-it/..., tự động ánh xạ về M:\Tailieuchung\QLGD-IT\...
 */
export function resolveStoragePathCrossPlatform(rawPath: string): string {
  if (!rawPath) return rawPath;

  const linuxMountBase = (process.env.STORAGE_MOUNT_LINUX || '/mnt/qlgd-it')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const windowsShareBase = (process.env.STORAGE_SHARE_WINDOWS || 'M:\\Tailieuchung\\QLGD-IT')
    .replace(/[/\\]+$/, '');

  const normalized = rawPath.replace(/\\/g, '/');

  if (process.platform === 'linux') {
    // UNC path like //10.0.0.26/Tailieuchung/QLGD-IT/...
    const uncMatch = normalized.match(/^\/\/[^/]+\/(?:tailieuchung\/qlgd-it\/|tailieuchung\/)?(.*)$/i);
    if (uncMatch) {
      return `${linuxMountBase}/${uncMatch[1]}`.replace(/\/+/g, '/');
    }

    const qlgdMatch = normalized.match(/(?:^|\/)(quanlygiaodich\/.*)$/i);
    if (qlgdMatch) {
      return `${linuxMountBase}/${qlgdMatch[1]}`.replace(/\/+/g, '/');
    }
    if (/^[a-zA-Z]:\/(?:tailieuchung\/)?qlgd-it\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^[a-zA-Z]:\/(?:tailieuchung\/)?qlgd-it\//i, '')}`.replace(/\/+/g, '/');
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
    return path.normalize(rawPath);
  }
}
