import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { decrypt } from '../../modules/bot-engine/utils/crypto';

/**
 * Chuyển đổi đường dẫn lưu trữ đa nền tảng (Windows UNC / Drive Letter <-> Linux Mount /mnt/qlgd-it)
 */
export function resolveStoragePathCrossPlatform(rawPath: string): string {
  if (!rawPath) return rawPath;
  let p = rawPath.trim();

  // If running on Linux/macOS and path starts with a Windows drive letter or UNC path
  if (process.platform !== 'win32') {
    // Replace backslashes with forward slashes
    p = p.replace(/\\/g, '/');

    // Handle M:\ or M:/ (Mercantile Exchange shared drive) -> /mnt/qlgd-it/
    if (/^[a-zA-Z]:\//i.test(p)) {
      p = p.replace(/^[a-zA-Z]:\//i, '/mnt/qlgd-it/');
    } else if (p.startsWith('//')) {
      // Handle UNC path: //10.0.0.x/... or //server/...
      const uncMatch = p.match(/^\/\/[^/]+\/[^/]+\/(.*)$/);
      if (uncMatch) {
        p = '/mnt/qlgd-it/' + uncMatch[1];
      }
    }
  } else {
    // If running on Windows and path starts with /mnt/qlgd-it/
    if (p.startsWith('/mnt/qlgd-it/')) {
      p = p.replace(/^\/mnt\/qlgd-it\//, 'M:/').replace(/\//g, '\\');
    }
  }

  return p;
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
    'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
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
