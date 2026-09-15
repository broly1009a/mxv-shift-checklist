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
    // Parse YYYY-MM-DD or ISO string safely without timezone offset issues
    const str = String(targetDateStr).split('T')[0];
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      dateObj = new Date(year, month, day);
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

  const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
  const fullPath = path.join(baseDir, subFolder);

  return { subFolder, fullPath };
}

export async function getMsBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  return settingsService.getSetting(
    'bot_backup_path_ms',
    process.env.DEFAULT_BACKUP_PATH_MS ||
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
  );
}

export async function getCqgBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  return settingsService.getSetting(
    'bot_backup_path_cqg',
    process.env.DEFAULT_BACKUP_PATH_CQG ||
    'C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
  );
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
  return acmBackupBase;
}

export async function getCcpBackupBase(settingsService: { getSetting: (key: string, def: string) => Promise<string> }): Promise<string> {
  return settingsService.getSetting(
    'bot_backup_path_ccp',
    process.env.DEFAULT_BACKUP_PATH_CCP ||
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
  );
}

/**
 * Chuẩn hóa đường dẫn lưu trữ chéo hệ điều hành (Windows vs Ubuntu):
 * - Nếu chạy trên Linux: tự động ánh xạ M:\Tailieuchung\QLGD-IT (hoặc Quanlygiaodich/...) sang /mnt/qlgd-it/
 * - Nếu chạy trên Windows: nếu nhận được /mnt/qlgd-it/..., tự động ánh xạ về M:\Tailieuchung\QLGD-IT\...
 */
export function resolveStoragePathCrossPlatform(rawPath: string): string {
  if (!rawPath) return rawPath;

  const linuxMountBase = (process.env.STORAGE_MOUNT_LINUX || '/mnt/qlgd-it')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '');
  const windowsShareBase = (process.env.STORAGE_SHARE_WINDOWS || 'M:\\Tailieuchung\\QLGD-IT')
    .replace(/[/\\]+$/, '');

  if (process.platform === 'linux') {
    const normalized = rawPath.replace(/\\/g, '/');
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
    if (/^m:\/(.*)$/i.test(normalized)) {
      return `${linuxMountBase}/${normalized.replace(/^m:\//i, '')}`.replace(/\/+/g, '/');
    }
    return rawPath.replace(/\\/g, '/');
  } else {
    // Windows
    const normalizedSlash = rawPath.replace(/\\/g, '/');
    const linuxBaseSlash = linuxMountBase.toLowerCase();
    if (normalizedSlash.toLowerCase().startsWith(linuxBaseSlash)) {
      const remainder = normalizedSlash.slice(linuxBaseSlash.length).replace(/^\/+/, '');
      return path.join(windowsShareBase, remainder);
    }
    return path.normalize(rawPath);
  }
}


