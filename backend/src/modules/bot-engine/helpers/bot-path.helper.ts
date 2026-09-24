import * as path from 'path';

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
 * Xác định Ngày Phiên Giao Dịch thực tế (Trading Session Date) chuẩn theo Tool C# (operate-transaction-app):
 * - Một phiên giao dịch mở lúc sessionStart (mặc định 05:00 / 06:30) và kéo dài xuyên đêm tới phiên hôm sau.
 * - Nếu thời điểm hiện tại < giờ mở phiên (ví dụ 01:42 sáng), phiên giao dịch thực tế là ngày T-1 (bỏ qua T7, CN).
 * - Nếu dateInput là ngày hôm nay theo dương lịch, hàm tự động lùi về T-1 khi đang trong ca đêm.
 * - Nếu dateInput là một ngày quá khứ cụ thể khác hôm nay (người dùng cố ý soi lại lịch sử), hàm giữ nguyên ngày đó.
 */
export function resolveTradingSessionDate(
  dateInput?: string | Date | null,
  options?: {
    now?: Date;
    sessionStartStr?: string;
    forceExactDate?: boolean;
  },
): { dateObj: Date; dateStr: string; isOvernight: boolean } {
  const nowVN =
    options?.now ||
    new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }),
    );
  const nowYear = nowVN.getFullYear();
  const nowMonth = String(nowVN.getMonth() + 1).padStart(2, '0');
  const nowDay = String(nowVN.getDate()).padStart(2, '0');
  const todayVnStr = `${nowYear}-${nowMonth}-${nowDay}`;

  // Kiểm tra khung giờ ca đêm
  let sessionHour = 6;
  let sessionMin = 30;
  if (options?.sessionStartStr) {
    const parts = options.sessionStartStr.split(':').map(Number);
    if (parts.length >= 1 && !isNaN(parts[0])) sessionHour = parts[0];
    if (parts.length >= 2 && !isNaN(parts[1])) sessionMin = parts[1];
  }

  const currentHour = nowVN.getHours();
  const currentMin = nowVN.getMinutes();
  const isOvernight =
    currentHour < sessionHour ||
    (currentHour === sessionHour && currentMin < sessionMin);

  let targetDateObj: Date;

  if (!dateInput) {
    targetDateObj = new Date(nowVN);
    targetDateObj.setHours(0, 0, 0, 0);
    if (isOvernight) {
      targetDateObj.setDate(targetDateObj.getDate() - 1);
      while (targetDateObj.getDay() === 0 || targetDateObj.getDay() === 6) {
        targetDateObj.setDate(targetDateObj.getDate() - 1);
      }
    }
  } else {
    let parsed: Date;
    if (dateInput instanceof Date) {
      parsed = new Date(dateInput);
    } else {
      parsed = resolveBotTargetDate({ targetDate: dateInput }).dateObj;
    }
    parsed.setHours(0, 0, 0, 0);

    const pY = parsed.getFullYear().toString();
    const pM = String(parsed.getMonth() + 1).padStart(2, '0');
    const pD = String(parsed.getDate()).padStart(2, '0');
    const parsedStr = `${pY}-${pM}-${pD}`;

    if (!options?.forceExactDate && parsedStr === todayVnStr && isOvernight) {
      // Người dùng hoặc giao diện gửi ngày hôm nay theo lịch dương lúc nửa đêm -> lùi về T-1 đúng chuẩn C#
      targetDateObj = new Date(parsed);
      targetDateObj.setDate(targetDateObj.getDate() - 1);
      while (targetDateObj.getDay() === 0 || targetDateObj.getDay() === 6) {
        targetDateObj.setDate(targetDateObj.getDate() - 1);
      }
    } else {
      targetDateObj = parsed;
    }
  }

  const y = targetDateObj.getFullYear().toString();
  const m = String(targetDateObj.getMonth() + 1).padStart(2, '0');
  const d = String(targetDateObj.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  return { dateObj: targetDateObj, dateStr, isOvernight };
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

export async function getMsBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_ms',
    process.env.DEFAULT_BACKUP_PATH_MS ||
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
  );
  return resolveStoragePathCrossPlatform(raw);
}

export async function getCqgBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_cqg',
    process.env.DEFAULT_BACKUP_PATH_CQG ||
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
  );
  return resolveStoragePathCrossPlatform(raw);
}

export async function getAcmBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  let acmBackupBase = await settingsService.getSetting(
    'bot_backup_path_acm',
    process.env.DEFAULT_BACKUP_PATH_ACM ||
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\ACM',
  );
  if (acmBackupBase.endsWith('\\ACM') || acmBackupBase.endsWith('/ACM')) {
    // Already ends with ACM
  } else {
    acmBackupBase = path.join(acmBackupBase, 'ACM');
  }
  return resolveStoragePathCrossPlatform(acmBackupBase);
}

export async function getCcpBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  const raw = await settingsService.getSetting(
    'bot_backup_path_ccp',
    process.env.DEFAULT_BACKUP_PATH_CCP ||
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
  );
  return resolveStoragePathCrossPlatform(raw);
}

/**
 * Thay thế biến động ngày/tháng/năm (${YYYY}, ${MM}, ${DD}) vào chuỗi đường dẫn.
 * Nếu không truyền dateInput, mặc định lấy theo thời gian thực tế hiện tại (GMT+7).
 */
export function resolveDynamicPath(
  templatePath: string,
  dateInput?: Date | string,
): string {
  if (!templatePath) return templatePath;
  if (!templatePath.includes('${')) return templatePath;

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
    // Mặc định GMT+7
    d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  }

  const yyyy = d.getFullYear ? d.getFullYear().toString() : new Date().getFullYear().toString();
  const mm = String((d.getMonth ? d.getMonth() : new Date().getMonth()) + 1).padStart(2, '0');
  const dd = String(d.getDate ? d.getDate() : new Date().getDate()).padStart(2, '0');

  return templatePath
    .replace(/\${YYYY}/g, yyyy)
    .replace(/\${yyyy}/g, yyyy)
    .replace(/\${MM}/g, mm)
    .replace(/\${mm}/g, mm)
    .replace(/\${DD}/g, dd)
    .replace(/\${dd}/g, dd);
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



