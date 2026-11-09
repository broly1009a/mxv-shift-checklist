/**
 * session-raw-files-export.service.ts
 *
 * Service chuyên trách thu thập và kết xuất trọn bộ 6 file báo cáo phiên giao dịch:
 * - 3 file M-System: DSGD.xlsx, TTM.xlsx, TTTT.xlsx (chuẩn hóa tên: DSGD_MS.xlsx, TTM_MS.xlsx, TTTT_MS.xlsx)
 * - 3 file CoreCCP: DSGD CCP.xlsx, TTM CCP.xlsx, TTTT.xlsx (chuẩn hóa tên: DSGD_CCP.xlsx, TTM_CCP.xlsx, TTTT_CCP.xlsx)
 *
 * Hỗ trợ:
 * 1. Đọc từ bản snapshot theo lượt chạy (TradingCheck/.../runs/{jobId}) khi người dùng chọn xem lại một lượt cụ thể trong ngày.
 * 2. Đọc từ thư mục kiểm tra trong phiên hiện tại (TradingCheck/...) khi xem lượt mới nhất hoặc không chỉ định lượt.
 * 3. Fallback đọc từ thư mục lưu trữ bất biến cuối ngày (Backup MS & Backup CCP) khi xem các ngày trước đó.
 * 4. Đóng gói binary ZIP chuẩn PKZIP (zero external dependency) và đóng gói JSON Base64 phục vụ File System Access API (showDirectoryPicker).
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import { QlgdDashboardService } from './qlgd-dashboard.service';
import {
  resolveStoragePathCrossPlatform,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
} from '../../../../shared';
import { findLatestFile } from '../../helpers/trading-math.helper';

export interface ISessionRawFile {
  filename: string;
  buffer: Buffer;
  size: number;
}

export interface ISessionRawFilesBundle {
  success: boolean;
  date: string;
  jobId?: string;
  source: 'REALTIME_INGRESS' | 'RUN_SNAPSHOT' | 'TRADING_CHECK' | 'BACKUP_STORAGE';
  files: Array<{
    filename: string;
    base64: string;
    size: number;
  }>;
}

@Injectable()
export class SessionRawFilesExportService {
  private readonly logger = new Logger(SessionRawFilesExportService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    @Optional()
    private readonly qlgdDashboardService?: QlgdDashboardService,
  ) {}

  /**
   * Thu thập trọn bộ 6 file phiên giao dịch thực tế
   * Mặc định forceRefresh=true: Tải trực tiếp realtime qua Ingress API như cơ chế backup
   */
  async resolveSessionRawFiles(
    targetDateStr?: string,
    jobId?: string,
    forceRefresh = true,
  ): Promise<{ files: ISessionRawFile[]; source: 'REALTIME_INGRESS' | 'RUN_SNAPSHOT' | 'TRADING_CHECK' | 'BACKUP_STORAGE' }> {
    let targetDate = targetDateStr;
    if (!targetDate) {
      const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    // 1. Kích hoạt tải dữ liệu tươi realtime trực tiếp từ Direct API của M-System & CoreCCP
    let isRealtimeSynced = false;
    if (forceRefresh && this.qlgdDashboardService) {
      try {
        this.logger.log(`[SessionRawFiles] Kích hoạt tải trực tiếp realtime từ Ingress API (M-System & CoreCCP) phiên ${targetDate}...`);
        await this.qlgdDashboardService.syncFreshDataFromApis(targetDate);
        isRealtimeSynced = true;
      } catch (syncErr: any) {
        this.logger.warn(`Không thể tải realtime từ API, fallback đọc file hiện có: ${syncErr.message}`);
      }
    }

    const [year, month, day] = targetDate.split('-');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting('bot_backup_path_ms', ''),
    );
    const rawCheckBase = await this.settingsService.getSetting(
      'recon_folder_check_path',
      await this.settingsService.getSetting('bot_trading_check_path', ''),
    );
    const tradingCheckBase = rawCheckBase
      ? resolveStoragePathCrossPlatform(
          rawCheckBase.toLowerCase().endsWith('futures')
            ? rawCheckBase
            : path.join(rawCheckBase, 'Futures'),
        )
      : msBackupBase;

    const msTradingDailyPath = tradingCheckBase ? path.join(tradingCheckBase, subFolder) : '';
    const msDailyPath = msBackupBase ? path.join(msBackupBase, subFolder) : '';

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpTradingDailyPath = rawCheckBase
      ? path.join(resolveStoragePathCrossPlatform(rawCheckBase), 'CCP', subFolder)
      : '';
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    // [USER_DIRECTIVE - 2026-11-06]: Không cần lưu/lấy file theo giờ phiên cũ (runs/{jobId}), comment lại để dùng trực tiếp TradingCheck/Backup
    /*
    const msRunDir = jobId ? path.join(msTradingDailyPath, 'runs', jobId) : '';
    const ccpRunDir = jobId ? path.join(ccpTradingDailyPath, 'runs', jobId) : '';
    const hasRunSnapshot = Boolean(msRunDir && fs.existsSync(msRunDir));
    */

    let detectedSource: 'REALTIME_INGRESS' | 'RUN_SNAPSHOT' | 'TRADING_CHECK' | 'BACKUP_STORAGE' = isRealtimeSynced ? 'REALTIME_INGRESS' : 'TRADING_CHECK';
    let msSearchDirs: string[] = [];
    let ccpSearchDirs: string[] = [];

    /*
    if (hasRunSnapshot) {
      detectedSource = 'RUN_SNAPSHOT';
      msSearchDirs = [msRunDir, msTradingDailyPath, msDailyPath].filter(Boolean);
      ccpSearchDirs = [ccpRunDir, ccpTradingDailyPath, ccpDailyPath].filter(Boolean);
      this.logger.log(`[SessionRawFiles] Tìm kiếm 6 file theo snapshot của lượt chạy ${jobId}`);
    } else {
    */
    if (fs.existsSync(msTradingDailyPath) && fs.readdirSync(msTradingDailyPath).length > 0) {
      if (!isRealtimeSynced) detectedSource = 'TRADING_CHECK';
      msSearchDirs = [msTradingDailyPath, msDailyPath].filter(Boolean);
      ccpSearchDirs = [ccpTradingDailyPath, ccpDailyPath].filter(Boolean);
    } else {
      detectedSource = 'BACKUP_STORAGE';
      msSearchDirs = [msDailyPath].filter(Boolean);
      ccpSearchDirs = [ccpDailyPath].filter(Boolean);
    }
    this.logger.log(`[SessionRawFiles] Tìm kiếm 6 file từ nguồn ${detectedSource} phiên ${targetDate}`);
    // }

    const findInDirs = (dirs: string[], pattern: RegExp): string | null => {
      for (const d of dirs) {
        const found = findLatestFile(d, pattern);
        if (found && fs.existsSync(found)) return found;
      }
      return null;
    };

    // 1. Tìm 3 file M-System
    const msDsgdPath = findInDirs(msSearchDirs, /^DSGD.*\.xlsx$/i);
    const msTtmPath = findInDirs(msSearchDirs, /^TTM.*\.xlsx$/i);
    const msTtttPath = findInDirs(msSearchDirs, /^TTTT.*\.xlsx$/i);

    // 2. Tìm 3 file CoreCCP
    const ccpDsgdPath =
      findInDirs(ccpSearchDirs, /dsgd.*ccp.*\.xlsx$/i) ||
      findInDirs(ccpSearchDirs, /^dsgd.*\.xlsx$/i);
    const ccpTtmPath =
      findInDirs(ccpSearchDirs, /ttm.*ccp.*\.xlsx$/i) ||
      findInDirs(ccpSearchDirs, /^ttm.*\.xlsx$/i) ||
      findInDirs(ccpSearchDirs, /ttm.*4h20.*\.xlsx$/i);
    const ccpTtttPath = findInDirs(ccpSearchDirs, /^tttt.*\.xlsx$/i);

    const fileMap: Array<{ label: string; standardizedName: string; resolvedPath: string | null }> = [
      { label: 'DSGD M-System', standardizedName: 'DSGD_MS.xlsx', resolvedPath: msDsgdPath },
      { label: 'TTM M-System', standardizedName: 'TTM_MS.xlsx', resolvedPath: msTtmPath },
      { label: 'TTTT M-System', standardizedName: 'TTTT_MS.xlsx', resolvedPath: msTtttPath },
      { label: 'DSGD CoreCCP', standardizedName: 'DSGD_CCP.xlsx', resolvedPath: ccpDsgdPath },
      { label: 'TTM CoreCCP', standardizedName: 'TTM_CCP.xlsx', resolvedPath: ccpTtmPath },
      { label: 'TTTT CoreCCP', standardizedName: 'TTTT_CCP.xlsx', resolvedPath: ccpTtttPath },
    ];

    const results: ISessionRawFile[] = [];
    for (const item of fileMap) {
      if (item.resolvedPath && fs.existsSync(item.resolvedPath)) {
        try {
          const buf = fs.readFileSync(item.resolvedPath);
          results.push({
            filename: item.standardizedName,
            buffer: buf,
            size: buf.length,
          });
        } catch (readErr: any) {
          this.logger.warn(`Lỗi đọc file ${item.label} (${item.resolvedPath}): ${readErr.message}`);
        }
      } else {
        this.logger.warn(`Không tìm thấy file ${item.label} cho phiên ${targetDate}`);
      }
    }

    return { files: results, source: detectedSource };
  }

  /**
   * Đóng gói mảng file thành gói JSON Base64 cho frontend showDirectoryPicker
   */
  async getSessionRawFilesBundle(
    targetDateStr?: string,
    jobId?: string,
    forceRefresh = true,
  ): Promise<ISessionRawFilesBundle> {
    const { files, source } = await this.resolveSessionRawFiles(targetDateStr, jobId, forceRefresh);
    let targetDate = targetDateStr;
    if (!targetDate) {
      const vnTime = new Date(Date.now() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    return {
      success: true,
      date: targetDate,
      jobId,
      source,
      files: files.map((f) => ({
        filename: f.filename,
        base64: f.buffer.toString('base64'),
        size: f.size,
      })),
    };
  }

  /**
   * Tạo tệp nén ZIP chuẩn PKZIP (zero external npm dependency)
   */
  createZipArchive(files: { filename: string; buffer: Buffer }[]): Buffer {
    const localHeaders: Buffer[] = [];
    const centralHeaders: Buffer[] = [];
    let offset = 0;

    for (const f of files) {
      const nameBuf = Buffer.from(f.filename, 'utf8');
      const dataBuf = f.buffer;
      const crc = (zlib as any).crc32 ? (zlib as any).crc32(dataBuf) : 0;
      const compressed = zlib.deflateRawSync(dataBuf);
      const useDeflate = compressed.length < dataBuf.length;
      const finalData = useDeflate ? compressed : dataBuf;
      const method = useDeflate ? 8 : 0;

      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0); // local file header signature
      lh.writeUInt16LE(20, 4); // version needed
      lh.writeUInt16LE(0, 6); // general purpose bit flag
      lh.writeUInt16LE(method, 8); // compression method
      lh.writeUInt16LE(0, 10); // last mod time
      lh.writeUInt16LE(0, 12); // last mod date
      lh.writeUInt32LE(crc, 14); // crc-32
      lh.writeUInt32LE(finalData.length, 18); // compressed size
      lh.writeUInt32LE(dataBuf.length, 22); // uncompressed size
      lh.writeUInt16LE(nameBuf.length, 26); // file name length
      lh.writeUInt16LE(0, 28); // extra field length

      const ch = Buffer.alloc(46);
      ch.writeUInt32LE(0x02014b50, 0); // central directory file header signature
      ch.writeUInt16LE(20, 4); // version made by
      ch.writeUInt16LE(20, 6); // version needed to extract
      ch.writeUInt16LE(0, 8); // general purpose bit flag
      ch.writeUInt16LE(method, 10); // compression method
      ch.writeUInt16LE(0, 12); // last mod time
      ch.writeUInt16LE(0, 14); // last mod date
      ch.writeUInt32LE(crc, 16); // crc-32
      ch.writeUInt32LE(finalData.length, 20); // compressed size
      ch.writeUInt32LE(dataBuf.length, 24); // uncompressed size
      ch.writeUInt16LE(nameBuf.length, 28); // file name length
      ch.writeUInt16LE(0, 30); // extra field length
      ch.writeUInt16LE(0, 32); // file comment length
      ch.writeUInt16LE(0, 34); // disk number start
      ch.writeUInt16LE(0, 36); // internal file attributes
      ch.writeUInt32LE(0, 38); // external file attributes
      ch.writeUInt32LE(offset, 42); // relative offset of local header

      localHeaders.push(Buffer.concat([lh, nameBuf, finalData]));
      centralHeaders.push(Buffer.concat([ch, nameBuf]));

      offset += 30 + nameBuf.length + finalData.length;
    }

    const centralDir = Buffer.concat(centralHeaders);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); // end of central dir signature
    eocd.writeUInt16LE(0, 4); // number of this disk
    eocd.writeUInt16LE(0, 6); // number of disk with start of central directory
    eocd.writeUInt16LE(files.length, 8); // total number of entries in central dir on this disk
    eocd.writeUInt16LE(files.length, 10); // total number of entries in central dir
    eocd.writeUInt32LE(centralDir.length, 12); // size of central directory
    eocd.writeUInt32LE(offset, 16); // offset of start of central directory
    eocd.writeUInt16LE(0, 20); // zipfile comment length

    return Buffer.concat([...localHeaders, centralDir, eocd]);
  }
}
