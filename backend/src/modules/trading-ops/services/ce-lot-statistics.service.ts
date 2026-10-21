/**
 * ce-lot-statistics.service.ts
 *
 * Service chuyên biệt Thống kê Số Lot và Giá Trị Giao Dịch (GTGD) từ nguồn Core Exchange (CE).
 *
 * 100% Ground Truth & Tuân thủ C# IT Tool:
 *  - Phân loại tài khoản liên thông ACM (kết thúc bằng 'A') & mã hàng hóa ACM Nano (SI5CO, PL1NY, CP2CO).
 *  - C# Parity: BackupService.cs#L390-L418, BackupService.cs#L1455-L1514, statics.json#L188-L213.
 *  - Công thức GTGD: KL_khớp * Giá_khớp * Độ_lớn_HĐ * Đơn_vị_yết_giá * Tỷ_giá (VND).
 *  - Kiểm tra tuân thủ 4 loại lệnh: MKT, LMT, STP, STL.
 *  - Cập nhật số liệu vào 2 file lũy kế:
 *      + Thong ke so lot giao dich ACM [year].xlsx
 *      + Thong ke gia tri giao dich ACM [year].xlsx
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  resolveBotTargetDate,
} from '../../../shared';
import {
  getMaHHFromCcpMaHD,
  getCcpHhSpec,
  CCP_HH_DEFAULTS,
  CcpHhSpec,
} from '../helpers/ccp-classifier.helper';
import {
  writeCcpLotToAccumulator,
  writeCcpGtgdToAccumulator,
  CcpAccumulatorPaths,
  resolveCcpAccumulatorFilePath,
  checkDateExistsInAccumulator,
  exportDraftAcmStatistics,
} from '../helpers/ccp-accumulator.helper';

export interface CeDsgdRow {
  raw: any[];
  maTKGD: string;
  maTvkd: string;
  tenThanhVien: string;
  maHD: string;
  muaBan: string;
  loaiLenh: string;
  klKhop: number;
  giaKhop: number;
  sessionDate: string;
}

export interface CeTtmRow {
  raw: any[];
  maTvkd: string;
  maTKGD: string;
  maHD: string;
  klMua: number;
  klBan: number;
  laiLoDuKien: number;
  laiLoDuKienVnd: number;
}

export interface CeHhStat {
  maHH: string;
  soLot: number;
  giaTri: number;
}

export interface CeTvkdStat {
  tvkd: string;
  tenThanhVien?: string;
  soLot: number;
  giaTri: number;
  isFull4Types: boolean;
  missingTypes: string[];
  byHH: CeHhStat[];
  ttmMua: number;
  ttmBan: number;
  ttmLaiLoDuKienVnd: number;
}

export interface CeDailyFileInfo {
  present: boolean;
  filename: string;
  size: number;
  path: string;
}

export interface CeDailyScanResult {
  folderPath: string;
  exists: boolean;
  canProcess: boolean;
  files: {
    dsgd?: CeDailyFileInfo;
    ttm?: CeDailyFileInfo;
    gtt?: CeDailyFileInfo;
    hh?: CeDailyFileInfo;
    hd?: CeDailyFileInfo;
  };
  dbExchangeRates?: {
    usd: number;
    detectedRate?: number;
    detectedSource?: string;
  };
}

export interface CeLotResultData {
  ngayGD: string;
  byTvkd: CeTvkdStat[];
  totalSoLot: number;
  totalGiaTri: number;
  totalTtmMua: number;
  totalTtmBan: number;
  totalTtmLot: number;
  acmLot: number;
  byType?: any;
  tyGiaUsed: Record<string, number>;
  warnings: string[];
}

export const REQUIRED_CE_ORDER_TYPES = ['MKT', 'LMT', 'STP', 'STL'];

@Injectable()
export class CeLotStatisticsService {
  private readonly logger = new Logger(CeLotStatisticsService.name);

  constructor(
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) {}

  /**
   * Quét thư mục backup Core Exchange theo ngày phiên
   */
  async scanDailyFiles(dateStr: string): Promise<CeDailyScanResult> {
    const ceBaseRaw = await this.getCeBackupBase();
    let targetFolder = '';
    let dateObj = new Date();

    try {
      const resolved = resolveBotTargetDate({ targetDate: dateStr });
      dateObj = resolved.dateObj;
      const ceSub = resolveDailySubfolder(resolveStoragePathCrossPlatform(ceBaseRaw), dateObj);
      targetFolder = ceSub.fullPath;
    } catch {
      targetFolder = resolveStoragePathCrossPlatform(ceBaseRaw);
    }

    const folderExists = fs.existsSync(targetFolder);
    const result: CeDailyScanResult = {
      folderPath: targetFolder,
      exists: folderExists,
      canProcess: false,
      files: {},
    };

    if (!folderExists) {
      return result;
    }

    try {
      const allFiles = fs.readdirSync(targetFolder);

      const findFile = (patterns: RegExp[]): CeDailyFileInfo | undefined => {
        for (const pattern of patterns) {
          const match = allFiles.find((f) => pattern.test(f));
          if (match) {
            const fullPath = path.join(targetFolder, match);
            try {
              const stat = fs.statSync(fullPath);
              return {
                present: true,
                filename: match,
                size: stat.size,
                path: fullPath,
              };
            } catch {
              // Ignore
            }
          }
        }
        return undefined;
      };

      // 1. DSGD ACM CE
      result.files.dsgd = findFile([
        /^DSGD.*ACM.*CE.*\.xlsx$/i,
        /^DSGD.*CE.*\.xlsx$/i,
        /^DSGD.*\.xlsx$/i,
        /^DSGD.*\.csv$/i,
      ]);

      // 2. TTM CE (Vị thế mở)
      result.files.ttm = findFile([
        /^TTM.*CE.*\.xlsx$/i,
        /^TTM.*\.xlsx$/i,
        /^TTM.*\.csv$/i,
      ]);

      // 3. GTT ACM (Giá thanh toán)
      result.files.gtt = findFile([
        /^GTT.*ACM.*\.xlsx$/i,
        /^GTT.*\.xlsx$/i,
        /^GTT.*\.csv$/i,
      ]);

      // 4. HH ACM (Danh mục hàng hóa)
      result.files.hh = findFile([
        /^HH.*ACM.*\.xlsx$/i,
        /^HH.*\.xlsx$/i,
        /^HH.*\.csv$/i,
      ]);

      // 5. HĐ chi tiết (Tùy chọn)
      result.files.hd = findFile([
        /^HĐ.*\.xlsx$/i,
        /^HD.*\.xlsx$/i,
      ]);

      result.canProcess = !!result.files.dsgd;
    } catch (err: any) {
      this.logger.warn(`Lỗi đọc thư mục ${targetFolder}: ${err.message}`);
    }

    // Đọc tỷ giá quy đổi USD từ DB
    const usdRate = await this.getUsdExchangeRate();
    result.dbExchangeRates = {
      usd: usdRate,
      detectedRate: usdRate,
      detectedSource: 'System Settings',
    };

    return result;
  }

  /**
   * Tính toán thống kê Số Lot và GTGD CE từ thư mục backup ngày
   */
  async processDailyFiles(dateStr: string): Promise<CeLotResultData> {
    const scan = await this.scanDailyFiles(dateStr);
    if (!scan.files.dsgd?.path) {
      throw new Error(`Không tìm thấy file DSGD CE trong thư mục: "${scan.folderPath}"`);
    }

    const dsgdBuffer = fs.readFileSync(scan.files.dsgd.path);
    const ttmBuffer = scan.files.ttm?.path ? fs.readFileSync(scan.files.ttm.path) : undefined;
    const usdRate = scan.dbExchangeRates?.usd || 25920;

    return this.calculateCeStatistics(dsgdBuffer, ttmBuffer, usdRate, dateStr);
  }

  /**
   * Hàm tính toán cốt lõi per TVKD và per Hàng Hóa
   */
  calculateCeStatistics(
    dsgdBuffer: Buffer,
    ttmBuffer?: Buffer,
    usdExchangeRate: number = 25920,
    sessionDateStr?: string,
  ): CeLotResultData {
    const warnings: string[] = [];
    const dsgdRows = this.parseCeDsgd(dsgdBuffer, warnings);
    const ttmRows = ttmBuffer ? this.parseCeTtm(ttmBuffer) : [];

    // Group DSGD theo TVKD
    const dsgdByTvkd = new Map<string, CeDsgdRow[]>();
    const tvkdNames = new Map<string, string>();

    for (const row of dsgdRows) {
      const tvkd = row.maTvkd;
      if (!tvkd) continue;
      if (!dsgdByTvkd.has(tvkd)) dsgdByTvkd.set(tvkd, []);
      dsgdByTvkd.get(tvkd)!.push(row);
      if (row.tenThanhVien && !tvkdNames.has(tvkd)) {
        tvkdNames.set(tvkd, row.tenThanhVien);
      }
    }

    // Group TTM theo TVKD
    const ttmByTvkd = new Map<string, CeTtmRow[]>();
    for (const row of ttmRows) {
      const tvkd = row.maTvkd;
      if (!tvkd) continue;
      if (!ttmByTvkd.has(tvkd)) ttmByTvkd.set(tvkd, []);
      ttmByTvkd.get(tvkd)!.push(row);
    }

    const allTvkds = new Set<string>([...dsgdByTvkd.keys(), ...ttmByTvkd.keys()]);
    const byTvkd: CeTvkdStat[] = [];
    let totalSoLot = 0;
    let totalGiaTri = 0;
    let totalTtmMua = 0;
    let totalTtmBan = 0;

    for (const tvkd of Array.from(allTvkds).sort()) {
      const dsgdGroup = dsgdByTvkd.get(tvkd) || [];
      const ttmGroup = ttmByTvkd.get(tvkd) || [];

      // 1. Tính toán DSGD: Số lot, GTGD, Breakdown theo HH
      let tvkdLot = 0;
      let tvkdGtgd = 0;
      const hhMap = new Map<string, { soLot: number; giaTri: number }>();
      const orderTypes = new Set<string>();

      for (const r of dsgdGroup) {
        tvkdLot += r.klKhop;
        if (r.loaiLenh) orderTypes.add(r.loaiLenh.toUpperCase());

        const maHH = getMaHHFromCcpMaHD(r.maHD, r.maTKGD);
        const spec = getCcpHhSpec(maHH);
        const doCao = spec?.doCao ?? 1;
        const tyGia = spec?.tienTe === 'VND' ? 1 : usdExchangeRate;

        // Công thức C# Ground Truth: klgd * giakhop * DoLonHopDong * DonViYetGia * convertEx
        const gtgdItem = Math.round(r.klKhop * r.giaKhop * doCao * tyGia);
        tvkdGtgd += gtgdItem;

        if (!hhMap.has(maHH)) hhMap.set(maHH, { soLot: 0, giaTri: 0 });
        const hhEntry = hhMap.get(maHH)!;
        hhEntry.soLot += r.klKhop;
        hhEntry.giaTri += gtgdItem;
      }

      totalSoLot += tvkdLot;
      totalGiaTri += tvkdGtgd;

      // 2. Kiểm tra tuân thủ 4 loại lệnh
      const missingTypes = REQUIRED_CE_ORDER_TYPES.filter((t) => !orderTypes.has(t));
      const isFull4Types = missingTypes.length === 0;

      // 3. Tính toán TTM
      const ttmMua = ttmGroup.reduce((s, r) => s + r.klMua, 0);
      const ttmBan = ttmGroup.reduce((s, r) => s + r.klBan, 0);
      const ttmLaiLoDuKienVnd = ttmGroup.reduce((s, r) => s + r.laiLoDuKienVnd, 0);
      totalTtmMua += ttmMua;
      totalTtmBan += ttmBan;

      byTvkd.push({
        tvkd,
        tenThanhVien: tvkdNames.get(tvkd) || tvkd,
        soLot: tvkdLot,
        giaTri: tvkdGtgd,
        isFull4Types,
        missingTypes,
        byHH: Array.from(hhMap.entries()).map(([maHH, val]) => ({ maHH, ...val })),
        ttmMua,
        ttmBan,
        ttmLaiLoDuKienVnd,
      });
    }

    byTvkd.sort((a, b) => b.soLot - a.soLot);

    const targetDate = sessionDateStr || new Date().toISOString().split('T')[0];

    return {
      ngayGD: targetDate,
      byTvkd,
      totalSoLot,
      totalGiaTri,
      totalTtmMua,
      totalTtmBan,
      totalTtmLot: totalTtmMua + totalTtmBan,
      acmLot: totalSoLot,
      byType: {
        acm: {
          totalSoLot,
          totalGiaTri,
          byTvkd,
        },
      },
      tyGiaUsed: { USD: usdExchangeRate },
      warnings,
    };
  }

  /**
   * Ghi trực tiếp kết quả Số Lot CE vào file lũy kế "Thong ke so lot giao dich ACM [year].xlsx"
   */
  async runLotStatisticsDirect(
    dateStr: string,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean },
    user?: any,
  ): Promise<{
    success: boolean;
    logs: string[];
    requiresConfirmation?: boolean;
    hasExistingData?: boolean;
    existingTotal?: number;
    existingRow?: number;
    isDraft?: boolean;
    draftFile?: string;
    draftPath?: string;
    message?: string;
  }> {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      this.logger.log(msg);
    };

    log(`Bắt đầu xử lý ghi file lũy kế Số Lot CE ngày phiên ${dateStr}...`);
    const result = await this.processDailyFiles(dateStr);
    log(`Đã tổng hợp thành công: ${result.totalSoLot} lot, ${result.byTvkd.length} TVKD.`);

    const config = await this.getConfig();
    const acmLotPath = config.ce_path_acm_lot || config.pathAcmLot;

    if (!acmLotPath) {
      throw new Error('Chưa cấu hình đường dẫn file lũy kế Số Lot ACM (ce_path_acm_lot). Vui lòng cấu hình.');
    }

    const resolvedPath = resolveCcpAccumulatorFilePath(acmLotPath, logs);
    log(`Đường dẫn file lũy kế Số Lot ACM: ${resolvedPath}`);

    // 1. Nếu chọn Xuất Draft: không ghi vào file lũy kế chính thức
    if (options?.exportDraft) {
      log(`Người dùng chọn Xuất file Bản Nháp (Draft), không ghi đè vào file Master.`);
      const draftRes = await exportDraftAcmStatistics(result, resolvedPath, 'LOT', logs);
      log(`Đã tạo thành công file bản nháp: ${draftRes.filename}`);
      return {
        success: true,
        isDraft: true,
        draftFile: draftRes.filename,
        draftPath: draftRes.draftPath,
        message: `Đã xuất thành công bản nháp Draft: ${draftRes.filename} vào thư mục _Drafts/`,
        logs,
      };
    }

    // 2. Pre-check: Kiểm tra xem ngày phiên đã có dữ liệu chưa (nếu chưa có cờ forceOverwrite)
    if (!options?.forceOverwrite) {
      log(`Kiểm tra xem ngày phiên ${dateStr} đã được ghi nhận trước đó chưa...`);
      const checkRes = await checkDateExistsInAccumulator(resolvedPath, dateStr, 'LOT', logs);
      if (checkRes.hasExistingData) {
        log(`[CẢNH BÁO GHI ĐÈ] Ngày ${dateStr} đã tồn tại trong file lũy kế Số Lot ACM với ${checkRes.existingTotal?.toLocaleString('vi-VN')} lot.`);
        return {
          success: false,
          requiresConfirmation: true,
          hasExistingData: true,
          existingTotal: checkRes.existingTotal,
          existingRow: checkRes.existingRow,
          message: `Ngày phiên ${dateStr} đã có số liệu trong file lũy kế Số Lot ACM (${checkRes.existingTotal?.toLocaleString('vi-VN')} lot). Bạn có muốn ghi đè không?`,
          logs,
        };
      }
    }

    // 3. Tiến hành ghi đè (hàm writeCcpLotToAccumulator sẽ tự động snapshot vào Backup_Snapshots/)
    if (options?.forceOverwrite) {
      log(`Xác nhận GHI ĐÈ từ người dùng. Tiến hành sao lưu an toàn và ghi dữ liệu mới...`);
    }
    await writeCcpLotToAccumulator(result as any, resolvedPath, logs);
    log(`Hoàn tất ghi file lũy kế Số Lot CE.`);

    return {
      success: true,
      message: `Đã hoàn tất thống kê và ghi file lũy kế Số Lot CE cho ngày ${dateStr}${options?.forceOverwrite ? ' (Ghi đè thành công)' : ''}`,
      logs,
    };
  }

  /**
   * Ghi trực tiếp kết quả GTGD CE vào file lũy kế "Thong ke gia tri giao dich ACM [year].xlsx"
   */
  async runValueStatisticsDirect(
    dateStr: string,
    options?: { forceOverwrite?: boolean; exportDraft?: boolean },
    user?: any,
  ): Promise<{
    success: boolean;
    logs: string[];
    requiresConfirmation?: boolean;
    hasExistingData?: boolean;
    existingTotal?: number;
    existingRow?: number;
    isDraft?: boolean;
    draftFile?: string;
    draftPath?: string;
    message?: string;
  }> {
    const logs: string[] = [];
    const log = (msg: string) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
      this.logger.log(msg);
    };

    log(`Bắt đầu xử lý ghi file lũy kế GTGD CE ngày phiên ${dateStr}...`);
    const result = await this.processDailyFiles(dateStr);
    log(`Đã tổng hợp thành công: ${result.totalGiaTri.toLocaleString('vi-VN')} VND.`);

    const config = await this.getConfig();
    const acmGtgdPath = config.ce_path_acm_gtgd || config.pathAcmGtgd;

    if (!acmGtgdPath) {
      throw new Error('Chưa cấu hình đường dẫn file lũy kế GTGD ACM (ce_path_acm_gtgd). Vui lòng cấu hình.');
    }

    const resolvedPath = resolveCcpAccumulatorFilePath(acmGtgdPath, logs);
    log(`Đường dẫn file lũy kế GTGD ACM: ${resolvedPath}`);

    // 1. Nếu chọn Xuất Draft: không ghi vào file lũy kế chính thức
    if (options?.exportDraft) {
      log(`Người dùng chọn Xuất file Bản Nháp (Draft), không ghi đè vào file Master.`);
      const draftRes = await exportDraftAcmStatistics(result, resolvedPath, 'GTGD', logs);
      log(`Đã tạo thành công file bản nháp: ${draftRes.filename}`);
      return {
        success: true,
        isDraft: true,
        draftFile: draftRes.filename,
        draftPath: draftRes.draftPath,
        message: `Đã xuất thành công bản nháp Draft: ${draftRes.filename} vào thư mục _Drafts/`,
        logs,
      };
    }

    // 2. Pre-check: Kiểm tra xem ngày phiên đã có dữ liệu chưa (nếu chưa có cờ forceOverwrite)
    if (!options?.forceOverwrite) {
      log(`Kiểm tra xem ngày phiên ${dateStr} đã được ghi nhận trước đó chưa...`);
      const checkRes = await checkDateExistsInAccumulator(resolvedPath, dateStr, 'GTGD', logs);
      if (checkRes.hasExistingData) {
        log(`[CẢNH BÁO GHI ĐÈ] Ngày ${dateStr} đã tồn tại trong file lũy kế GTGD ACM với ${checkRes.existingTotal?.toLocaleString('vi-VN')} VND.`);
        return {
          success: false,
          requiresConfirmation: true,
          hasExistingData: true,
          existingTotal: checkRes.existingTotal,
          existingRow: checkRes.existingRow,
          message: `Ngày phiên ${dateStr} đã có số liệu trong file lũy kế GTGD ACM (${checkRes.existingTotal?.toLocaleString('vi-VN')} VND). Bạn có muốn ghi đè không?`,
          logs,
        };
      }
    }

    // 3. Tiến hành ghi đè (hàm writeCcpGtgdToAccumulator sẽ tự động snapshot vào Backup_Snapshots/)
    if (options?.forceOverwrite) {
      log(`Xác nhận GHI ĐÈ từ người dùng. Tiến hành sao lưu an toàn và ghi dữ liệu mới...`);
    }
    await writeCcpGtgdToAccumulator(result as any, resolvedPath, logs);
    log(`Hoàn tất ghi file lũy kế GTGD CE.`);

    return {
      success: true,
      message: `Đã hoàn tất thống kê và ghi file lũy kế GTGD CE cho ngày ${dateStr}${options?.forceOverwrite ? ' (Ghi đè thành công)' : ''}`,
      logs,
    };
  }

  /**
   * Lấy đường dẫn file draft để phục vụ download
   */
  async getDraftFilePath(filename: string): Promise<string> {
    const config = await this.getConfig();
    const acmLotPath = config.ce_path_acm_lot || config.pathAcmLot;
    const resolvedPath = resolveCcpAccumulatorFilePath(acmLotPath);
    const draftsDir = path.join(path.dirname(resolvedPath), '_Drafts');
    return path.join(draftsDir, filename);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARSER HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private parseCeDsgd(buffer: Buffer, warnings: string[]): CeDsgdRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (rawRows.length < 2) return [];

    const headers = rawRows[0].map((h) => String(h || '').trim().toUpperCase());

    const findIdx = (names: string[], defaultIdx: number) => {
      const idx = headers.findIndex((h) => names.some((n) => h.includes(n.toUpperCase())));
      return idx >= 0 ? idx : defaultIdx;
    };

    const idxTvkd = findIdx(['MEMBERCODE', 'MÃ THÀNH VIÊN', 'MÃ TVKD'], -1);
    const idxTvkdName = findIdx(['MEMBERNAME', 'TÊN THÀNH VIÊN', 'TÊN TVKD'], -1);
    const idxTkgd = findIdx(['AFACCTNO', 'MÃ TKGD', 'SỐ TÀI KHOẢN'], -1);
    const idxHd = findIdx(['SYMBOL', 'MÃ HỢP ĐỒNG', 'MÃ HĐ'], -1);
    const idxLoaiLenh = findIdx(['PRICETYPE_DESC', 'LOẠI LỆNH'], -1);
    const idxKl = findIdx(['EXECQTTY', 'KL KHỚP', 'KHỐI LƯỢNG KHỚP'], -1);
    const idxGia = findIdx(['EXECPRICE', 'GIÁ KHỚP TRUNG BÌNH', 'GIÁ KHỚP', 'PRICE', 'GIÁ ĐẶT'], -1);
    const idxMuaBan = findIdx(['SIDE_DESC', 'MUA/BÁN'], -1);
    const idxNgay = findIdx(['SESSION_DATE', 'NGÀY PHIÊN'], -1);

    const rows: CeDsgdRow[] = [];
    for (let i = 1; i < rawRows.length; i++) {
      const r = rawRows[i];
      if (!r || r.length === 0) continue;

      let maTvkd = idxTvkd >= 0 ? String(r[idxTvkd] || '').trim() : '';
      const maTKGD = idxTkgd >= 0 ? String(r[idxTkgd] || '').trim() : '';

      // Quy tắc C# Ground Truth: Nếu thiếu mã TVKD, bóc 3 ký tự đầu của TKGD (001C...-A -> 001)
      if (!maTvkd && maTKGD.length >= 3) {
        maTvkd = maTKGD.substring(0, 3);
      }

      const klKhop = idxKl >= 0 ? parseFloat(r[idxKl]) || 0 : 0;
      const giaKhop = idxGia >= 0 ? parseFloat(r[idxGia]) || 0 : 0;
      if (klKhop <= 0) continue;

      rows.push({
        raw: r,
        maTvkd,
        tenThanhVien: idxTvkdName >= 0 ? String(r[idxTvkdName] || '').trim() : '',
        maTKGD,
        maHD: idxHd >= 0 ? String(r[idxHd] || '').trim() : '',
        loaiLenh: idxLoaiLenh >= 0 ? String(r[idxLoaiLenh] || '').trim() : '',
        klKhop,
        giaKhop,
        muaBan: idxMuaBan >= 0 ? String(r[idxMuaBan] || '').trim() : '',
        sessionDate: idxNgay >= 0 ? String(r[idxNgay] || '').trim() : '',
      });
    }

    return rows;
  }

  private parseCeTtm(buffer: Buffer): CeTtmRow[] {
    const rows: CeTtmRow[] = [];
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (rawRows.length < 2) return rows;

      const headers = rawRows[0].map((h) => String(h || '').trim().toUpperCase());
      const idxTvkd = headers.findIndex((h) => h.includes('MEMBERCODE') || h.includes('MÃ THÀNH VIÊN'));
      const idxTkgd = headers.findIndex((h) => h.includes('ACCTNO') || h.includes('MÃ TKGD'));
      const idxHd = headers.findIndex((h) => h.includes('SYMBOL') || h.includes('MÃ HỢP ĐỒNG'));
      const idxLong = headers.findIndex((h) => h.includes('LONGQTTY') || h.includes('KHỐI LƯỢNG MUA'));
      const idxShort = headers.findIndex((h) => h.includes('SHORTQTTY') || h.includes('KHỐI LƯỢNG BÁN'));
      const idxPnl = headers.findIndex((h) => h.includes('EVRPLAMT') && !h.includes('VND'));
      const idxPnlVnd = headers.findIndex((h) => h.includes('EVRPLAMT_VND') || (h.includes('LÃI LỖ') && h.includes('VND')));

      for (let i = 1; i < rawRows.length; i++) {
        const r = rawRows[i];
        let tvkd = idxTvkd >= 0 ? String(r[idxTvkd] || '').trim() : '';
        const tkgd = idxTkgd >= 0 ? String(r[idxTkgd] || '').trim() : '';
        if (!tvkd && tkgd.length >= 3) tvkd = tkgd.substring(0, 3);
        if (!tvkd) continue;

        rows.push({
          raw: r,
          maTvkd: tvkd,
          maTKGD: tkgd,
          maHD: idxHd >= 0 ? String(r[idxHd] || '').trim() : '',
          klMua: idxLong >= 0 ? parseFloat(r[idxLong]) || 0 : 0,
          klBan: idxShort >= 0 ? parseFloat(r[idxShort]) || 0 : 0,
          laiLoDuKien: idxPnl >= 0 ? parseFloat(r[idxPnl]) || 0 : 0,
          laiLoDuKienVnd: idxPnlVnd >= 0 ? parseFloat(r[idxPnlVnd]) || 0 : 0,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Lỗi khi parse TTM CE: ${err.message}`);
    }
    return rows;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // SETTINGS & CONFIG
  // ──────────────────────────────────────────────────────────────────────────

  private async getCeBackupBase(): Promise<string> {
    if (!this.settingsService) {
      return 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures';
    }
    return this.settingsService.getSetting(
      'bot_backup_path_ce',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures',
    );
  }

  private async getUsdExchangeRate(): Promise<number> {
    if (!this.settingsService) return 25920;
    try {
      const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '');
      if (matrixStr) {
        const matrix = JSON.parse(matrixStr);
        if (matrix.USD?.conversionRate) return Number(matrix.USD.conversionRate);
      }
      const rawUsd = await this.settingsService.getSetting('usd_exchange_rate', '25920');
      const val = parseFloat(rawUsd);
      return !isNaN(val) && val > 1000 ? val : 25920;
    } catch {
      return 25920;
    }
  }

  async getConfig(): Promise<Record<string, any>> {
    const currentYear = new Date().getFullYear();
    const ceBackupBase = await this.getCeBackupBase();

    const parentRoot = path.dirname(path.dirname(ceBackupBase));
    const defaultAcmLot = path.join(
      parentRoot,
      'Thong ke ccp',
      'output',
      `Thong ke so lot giao dich ACM ${currentYear}.xlsx`,
    );
    const defaultAcmGtgd = path.join(
      parentRoot,
      'Thong ke ccp',
      'output',
      `Thong ke gia tri giao dich ACM ${currentYear}.xlsx`,
    );

    if (!this.settingsService) {
      return {
        bot_backup_path_ce: ceBackupBase,
        ce_path_acm_lot: defaultAcmLot,
        ce_path_acm_gtgd: defaultAcmGtgd,
      };
    }

    const [savedConfigStr, cePathLot, cePathGtgd] = await Promise.all([
      this.settingsService.getSetting('ce_lot_statistics_config', ''),
      this.settingsService.getSetting('ce_path_acm_lot', defaultAcmLot),
      this.settingsService.getSetting('ce_path_acm_gtgd', defaultAcmGtgd),
    ]);

    let cfg: Record<string, any> = {};
    if (savedConfigStr) {
      try {
        cfg = JSON.parse(savedConfigStr);
      } catch {}
    }

    return {
      bot_backup_path_ce: ceBackupBase,
      ce_path_acm_lot: cfg.ce_path_acm_lot || cePathLot,
      ce_path_acm_gtgd: cfg.ce_path_acm_gtgd || cePathGtgd,
      pathAcmLot: cfg.ce_path_acm_lot || cePathLot,
      pathAcmGtgd: cfg.ce_path_acm_gtgd || cePathGtgd,
      ...cfg,
    };
  }

  async saveConfig(config: Record<string, any>): Promise<{ success: boolean }> {
    if (!this.settingsService) return { success: true };

    if (config.bot_backup_path_ce !== undefined) {
      await this.settingsService.setSetting('bot_backup_path_ce', String(config.bot_backup_path_ce).trim());
    }
    if (config.ce_path_acm_lot !== undefined) {
      await this.settingsService.setSetting('ce_path_acm_lot', String(config.ce_path_acm_lot).trim());
    }
    if (config.ce_path_acm_gtgd !== undefined) {
      await this.settingsService.setSetting('ce_path_acm_gtgd', String(config.ce_path_acm_gtgd).trim());
    }

    await this.settingsService.setSetting('ce_lot_statistics_config', JSON.stringify(config));
    return { success: true };
  }
}
