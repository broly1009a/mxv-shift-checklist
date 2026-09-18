/**
 * ccp-lot-statistics.service.ts
 *
 * Service thống kê Số Lot và Giá Trị Giao Dịch từ nguồn CCP.
 * Thay thế lot-statistics.service.ts (nguồn MS/CQG) trong giai đoạn chuyển đổi.
 *
 * Nguồn dữ liệu:
 *   - DSGD CCP  → Số lot, GTGD per TVKD, kiểm tra 4 loại lệnh
 *   - TTM CCP   → Trạng thái mở per TVKD
 *   - TTTT CCP  → Trạng thái tất toán per TVKD
 *   - Tỷ giá   → Từ file xuất CCP hoặc API CURRENCYEXCHANGERATE
 *
 * Roadmap:
 *   Phase 1 (hiện tại): Chỉ có tài khoản ACM (-A)
 *   Phase 2 (tương lai): Thêm Spread (-S), LME (L), Options khi CCP migrate
 */

import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  parseCcpDsgdRow,
  parseCcpTtmRow,
  parseCcpTtttRow,
  buildCcpHeaderMap,
  resolveColIdx,
  classifyCcpDsgd,
  getMaHHFromCcpMaHD,
  getCcpHhSpec,
  CCP_HH_DEFAULTS,
  CcpHhSpec,
  CcpDsgdRow,
  CcpTtmRow,
  CcpTtttRow,
  CcpDsgdClassified,
} from './helpers/ccp-classifier.helper';
import {
  writeCcpLotToAccumulator,
  writeCcpGtgdToAccumulator,
  writeCcpTypedLotToAccumulator,
  writeCcpTypedValueToAccumulator,
  appendCcpRawDsgd,
  CcpAccumulatorPaths,
} from './helpers/ccp-accumulator.helper';
import {
  getCcpBackupBase,
  getMsBackupBase,
  resolveDailySubfolder,
  resolveBotTargetDate,
  resolveStoragePathCrossPlatform,
  resolveDynamicPath,
} from '../bot-engine/helpers/bot-path.helper';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CcpDailyFileInfo {
  present: boolean;
  filename: string;
  size: number;
  path: string;
}

export interface CcpDailyScanResult {
  folderPath: string;
  exists: boolean;
  canProcess: boolean;
  files: {
    dsgd?: CcpDailyFileInfo;
    ttm?: CcpDailyFileInfo;
    tttt?: CcpDailyFileInfo;
    tyGia?: CcpDailyFileInfo & { fromDate?: string };
    maHD?: CcpDailyFileInfo & { fromDate?: string };
  };
}

export interface CcpTyGiaMap {
  [currency: string]: number; // 'USD' → 25920
}

/** Thống kê per HH trong mỗi TVKD */
export interface CcpHhStat {
  maHH: string;    // SI5CO, PL1NY, CP2CO...
  soLot: number;   // Số lot GD
  giaTri: number;  // GTGD (VND)
}

/** Kết quả per TVKD */
export interface CcpTvkdStat {
  tvkd: string;            // Mã thành viên (3 ký tự)
  tenThanhVien?: string;   // Tên thành viên
  // Giao dịch (DSGD)
  soLot: number;
  giaTri: number;          // Giá trị giao dịch (VND)
  isFull4Types: boolean;   // Đủ MKT/LMT/STP/STL?
  missingTypes: string[];  // Các loại lệnh còn thiếu
  // Per HH breakdown (for accumulator)
  byHH: CcpHhStat[];
  // Trạng thái mở (TTM)
  ttmMua: number;
  ttmBan: number;
  ttmLaiLoDuKienVnd: number;
  // Trạng thái tất toán (TTTT)
  kltt: number;
  ttttLaiLoThucTeVnd: number;
}

/** Kết quả tổng hợp */
export interface CcpLotResult {
  ngayGD: Date;
  byTvkd: CcpTvkdStat[];
  // Tổng
  totalSoLot: number;
  totalGiaTri: number;
  totalTtmMua: number;
  totalTtmBan: number;
  totalTtmLot: number;   // TTM: tổng lot mở (mua + bán)
  totalKltt: number;
  totalTtttLot: number;  // TTTT: tổng lot tất toán (mua + bán)
  // Phân loại (phase 2: khi có Spread/LME/Options)
  acmLot: number;
  spreadLot: number;
  lmeLot: number;
  optionsLot: number;
  normalLot: number;
  bacThoiLot?: number;
  bacThoiGtgd?: number;
  // Thống kê phân hệ độc lập (Phase 2)
  byType?: {
    acm: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number };
    normal: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number };
    spread: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number };
    lme: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number };
    options: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number };
    bacThoi?: { byTvkd: CcpTvkdStat[]; totalSoLot: number; totalGiaTri: number; isStandby: boolean };
  };
  // Metadata
  tyGiaUsed: CcpTyGiaMap;
  warnings: string[];
}

export interface CcpLotInput {
  dsgdCcp: Buffer;          // required
  dsgdMmCcp?: Buffer;       // optional – TK Market Maker
  ttm?: Buffer;              // optional
  tttt?: Buffer;             // optional
  tyGia?: Buffer;            // optional – file Tỷ giá.xlsx từ CCP
  maHD?: Buffer;             // optional – file Mã HĐ CCP / Hàng hóa (/PRODUCT/COMMODITY)
}

export interface CcpLotParams {
  ngayGD: string;           // YYYY-MM-DD
  apiBaseUrl?: string;      // URL CCP để gọi API tỷ giá (nếu không upload file)
  // HH config override (optional – nếu CCP thêm HH mới chưa có trong CCP_HH_DEFAULTS)
  hhOverrides?: CcpHhSpec[];
}

const REQUIRED_ORDER_TYPES = ['MKT', 'LMT', 'STP', 'STL'];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CcpLotStatisticsService {
  private readonly logger = new Logger(CcpLotStatisticsService.name);

  constructor(private readonly settingsService: SystemSettingsService) {}

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Main Entry Point
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Thống kê số lot và giá trị giao dịch từ file CCP.
   */
  async processCcpLotStatistics(
    files: CcpLotInput,
    params: CcpLotParams,
    jobLogs?: string[],
  ): Promise<CcpLotResult> {
    const ngayGD = new Date(params.ngayGD);
    const warnings: string[] = [];
    this.logger.log(`[CCP] Bắt đầu thống kê lot ngày ${params.ngayGD}`);

    // ── 1. Parse tỷ giá ───────────────────────────────────────────────────
    let tyGiaMap: CcpTyGiaMap = {};
    if (files.tyGia) {
      tyGiaMap = this.parseTyGiaFile(files.tyGia);
      this.logger.log(`[CCP] Đọc tỷ giá từ file: ${JSON.stringify(tyGiaMap)}`);
    } else {
      this.logger.log('[CCP] Không có file tỷ giá, áp dụng tỷ giá mặc định USD = 25,920 VND');
      warnings.push('Sử dụng tỷ giá mặc định 1 USD = 25.920 đ');
    }
    // Mặc định tỷ giá USD quy đổi nếu file tỷ giá thiếu
    tyGiaMap['USD'] = tyGiaMap['USD'] ?? 25920;
    // VND luôn = 1
    tyGiaMap['VND'] = tyGiaMap['VND'] ?? 1;

    // ── 1B. Parse file Mã HĐ / Quy chuẩn Hàng hóa CCP (doCao) ──────────────
    if (files.maHD) {
      try {
        const parsedSpecs = this.parseCcpCommoditySpecFile(files.maHD);
        this.logger.log(`[CCP] Đọc thành công ${parsedSpecs.length} quy chuẩn hàng hóa (doCao) từ file CCP`);
        params.hhOverrides = [...(params.hhOverrides ?? []), ...parsedSpecs];
      } catch (err: any) {
        this.logger.warn(`[CCP] Không thể bóc tách file Mã HĐ CCP: ${err.message}`);
      }
    }

    // ── 2. Parse file DSGD ────────────────────────────────────────────────
    const dsgdParsed = this.parseRawRowsWithHeaders(files.dsgdCcp);
    const dsgdHeaderMap = buildCcpHeaderMap(dsgdParsed.headers);
    const dsgdRows = dsgdParsed.rows.map((r) => parseCcpDsgdRow(r, dsgdHeaderMap));

    let mmRows: CcpDsgdRow[] = [];
    if (files.dsgdMmCcp) {
      const mmParsed = this.parseRawRowsWithHeaders(files.dsgdMmCcp);
      const mmHeaderMap = buildCcpHeaderMap(mmParsed.headers);
      mmRows = mmParsed.rows.map((r) => parseCcpDsgdRow(r, mmHeaderMap));
    }
    const allDsgd = [...dsgdRows, ...mmRows];
    this.logger.debug(`[CCP] DSGD rows: ${dsgdRows.length} + MM: ${mmRows.length}`);

    // ── 3. Parse TTM / TTTT ───────────────────────────────────────────────
    let ttmRows: CcpTtmRow[] = [];
    if (files.ttm) {
      const ttmParsed = this.parseRawRowsWithHeaders(files.ttm);
      const ttmHeaderMap = buildCcpHeaderMap(ttmParsed.headers);
      ttmRows = ttmParsed.rows.map((r) => parseCcpTtmRow(r, ttmHeaderMap));
    }

    let ttttRows: CcpTtttRow[] = [];
    if (files.tttt) {
      const ttttParsed = this.parseRawRowsWithHeaders(files.tttt);
      const ttttHeaderMap = buildCcpHeaderMap(ttttParsed.headers);
      ttttRows = ttttParsed.rows.map((r) => parseCcpTtttRow(r, ttttHeaderMap));
    }
    this.logger.debug(`[CCP] TTM rows: ${ttmRows.length}, TTTT rows: ${ttttRows.length}`);

    // ── 4. Phân loại DSGD ─────────────────────────────────────────────────
    const classified = classifyCcpDsgd(allDsgd);
    const bacThoiRows = classified.bacThoi || [];
    const hasBacThoi = bacThoiRows.length > 0;
    const bacThoiLot = this.sumLot(bacThoiRows);
    const bacThoiGtgd = this.calcGtgd(bacThoiRows, tyGiaMap, params);

    this.logger.debug(
      `[CCP] Phân loại: ACM=${classified.acm.length}, Spread=${classified.spread.length}, LME=${classified.lme.length}, BacThoi=${bacThoiRows.length}, Normal=${classified.normal.length}`,
    );
    if (classified.spread.length > 0 || classified.lme.length > 0 || classified.normal.length > 0) {
      warnings.push(
        `Phát hiện tài khoản non-ACM: Spread=${classified.spread.length}, LME=${classified.lme.length}, Normal=${classified.normal.length} – Phase 2 support.`,
      );
    }
    if (hasBacThoi) {
      const msg = `[CCP STANDBY] Phát hiện ${bacThoiRows.length} giao dịch tài khoản Bạc thỏi (-M) với ${bacThoiLot} lot, GTGD: ${bacThoiGtgd.toLocaleString('vi-VN')} VND. Tạm thời tách riêng lưu vào Database (MongoDB) & File audit Standby (chưa ghi vào file Sổ thường).`;
      warnings.push(msg);
      jobLogs?.push(msg);
      this.logger.warn(msg);
    }

    // ── 5. Tính toán per TVKD & Phân hệ độc lập (Phase 2) ────────────────
    const byTvkd = this.calcPerTvkd(allDsgd, ttmRows, ttttRows, tyGiaMap, params, warnings);

    const byType = {
      acm: {
        byTvkd: this.calcPerTvkd(classified.acm, ttmRows, ttttRows, tyGiaMap, params, []),
        totalSoLot: this.sumLot(classified.acm),
        totalGiaTri: this.calcGtgd(classified.acm, tyGiaMap, params),
      },
      normal: {
        byTvkd: this.calcPerTvkd(classified.normal, [], [], tyGiaMap, params, []),
        totalSoLot: this.sumLot(classified.normal),
        totalGiaTri: this.calcGtgd(classified.normal, tyGiaMap, params),
      },
      spread: {
        byTvkd: this.calcPerTvkd(classified.spread, [], [], tyGiaMap, params, []),
        totalSoLot: this.sumLot(classified.spread),
        totalGiaTri: this.calcGtgd(classified.spread, tyGiaMap, params),
      },
      lme: {
        byTvkd: this.calcPerTvkd(classified.lme, [], [], tyGiaMap, params, []),
        totalSoLot: this.sumLot(classified.lme),
        totalGiaTri: this.calcGtgd(classified.lme, tyGiaMap, params),
      },
      options: {
        byTvkd: this.calcPerTvkd(classified.options, [], [], tyGiaMap, params, []),
        totalSoLot: this.sumLot(classified.options),
        totalGiaTri: this.calcGtgd(classified.options, tyGiaMap, params),
      },
      bacThoi: hasBacThoi
        ? {
            byTvkd: this.calcPerTvkd(bacThoiRows, [], [], tyGiaMap, params, []),
            totalSoLot: bacThoiLot,
            totalGiaTri: bacThoiGtgd,
            isStandby: true,
          }
        : undefined,
    };

    // ── 6. Tổng hợp ───────────────────────────────────────────────────────
    const totalSoLot = byTvkd.reduce((s, r) => s + r.soLot, 0);
    const totalGiaTri = byTvkd.reduce((s, r) => s + r.giaTri, 0);
    const totalTtmMua = byTvkd.reduce((s, r) => s + r.ttmMua, 0);
    const totalTtmBan = byTvkd.reduce((s, r) => s + r.ttmBan, 0);
    const totalKltt = byTvkd.reduce((s, r) => s + r.kltt, 0);

    const result: CcpLotResult = {
      ngayGD,
      byTvkd,
      byType,
      totalSoLot,
      totalGiaTri,
      totalTtmMua,
      totalTtmBan,
      totalKltt,
      totalTtttLot: byTvkd.reduce((s, r) => s + r.kltt, 0),
      totalTtmLot:  byTvkd.reduce((s, r) => s + r.ttmMua + r.ttmBan, 0),
      acmLot: this.sumLot(classified.acm),
      spreadLot: this.sumLot(classified.spread),
      lmeLot: this.sumLot(classified.lme),
      optionsLot: this.sumLot(classified.options),
      normalLot: this.sumLot(classified.normal),
      bacThoiLot,
      bacThoiGtgd,
      tyGiaUsed: tyGiaMap,
      warnings,
    };

    this.logger.log(
      `[CCP] Hoàn thành: totalLot=${totalSoLot}, totalGTGD=${totalGiaTri.toFixed(0)}, TVKD=${byTvkd.length}`,
    );

    if (jobLogs) {
      jobLogs.push(`[CCP Lot] ngayGD=${params.ngayGD} | lot=${totalSoLot} | GTGD=${totalGiaTri.toFixed(0)} VND | TVKD=${byTvkd.length}`);
    }

    return result;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Write to Accumulator (Phase 2)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Ghi kết quả CcpLotResult vào file lũy kế ACM.
   * Gọi sau khi processCcpLotStatistics() trả kết quả.
   */
  async writeToAccumulator(
    result: CcpLotResult,
    paths: CcpAccumulatorPaths,
    dsgdBuffer?: Buffer,
    jobLogs?: string[],
  ): Promise<{ lotUpdated: boolean; gtgdUpdated: boolean; errors: string[] }> {
    const errors: string[] = [];
    let lotUpdated = false;
    let gtgdUpdated = false;

    // ── 1. Phase 1: ACM Lot & GTGD (giữ nguyên tương thích) ────────────────
    const resolvedAcmLotPath = (paths.pathAcmLot || (paths as any).pathAcmCumulative)
      ? resolveStoragePathCrossPlatform(resolveDynamicPath(paths.pathAcmLot || (paths as any).pathAcmCumulative, result.ngayGD))
      : undefined;
    const resolvedAcmGtgdPath = (paths.pathAcmGtgd || (paths as any).pathGtgdAcm)
      ? resolveStoragePathCrossPlatform(resolveDynamicPath(paths.pathAcmGtgd || (paths as any).pathGtgdAcm, result.ngayGD))
      : undefined;

    if (resolvedAcmLotPath) {
      try {
        await writeCcpLotToAccumulator(result, resolvedAcmLotPath, jobLogs);
        lotUpdated = true;
        this.logger.log(`[CCP-ACC] Đã ghi lot ACM vào: ${resolvedAcmLotPath}`);
      } catch (err: any) {
        const msg = `Lỗi ghi file lũy kế lot ACM: ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
        jobLogs?.push(`[CCP-ACC ERROR] ${msg}`);
      }
    }

    if (resolvedAcmGtgdPath) {
      try {
        await writeCcpGtgdToAccumulator(result, resolvedAcmGtgdPath, jobLogs);
        gtgdUpdated = true;
        this.logger.log(`[CCP-ACC] Đã ghi GTGD ACM vào: ${resolvedAcmGtgdPath}`);
      } catch (err: any) {
        const msg = `Lỗi ghi file lũy kế GTGD ACM: ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
        jobLogs?.push(`[CCP-ACC ERROR] ${msg}`);
      }
    }

    // ── 2. Phase 2: Số Lot theo phân hệ (Normal, Spread, LME, Options) ─────
    const typedLots: Array<{ key: string; rawPath?: string; type: 'normal' | 'spread' | 'lme' | 'options' }> = [
      { key: 'NormalLot', rawPath: paths.pathNormalLot || (paths as any).pathNormalCumulative, type: 'normal' },
      { key: 'SpreadLot', rawPath: paths.pathSpreadLot || (paths as any).pathSpreadCumulative, type: 'spread' },
      { key: 'LmeLot',    rawPath: paths.pathLmeLot || (paths as any).pathLmeCumulative,       type: 'lme' },
      { key: 'OptionsLot',rawPath: paths.pathOptionsLot || (paths as any).pathOptionsCumulative, type: 'options' },
    ];

    for (const { key, rawPath, type } of typedLots) {
      if (!rawPath) continue;

      // Zero-Lot Bypass: Nếu phân hệ này không có lot phát sinh (totalSoLot === 0),
      // tự động bỏ qua (Skip), không mở và không ghi đè số 0 vào file Excel lũy kế.
      const typeStats = (result as any).byType?.[type];
      if (!typeStats || typeStats.totalSoLot <= 0) {
        this.logger.debug(`[CCP-ACC] Bỏ qua ghi lot ${key}: 0 lot phát sinh.`);
        continue;
      }

      const resolved = resolveStoragePathCrossPlatform(resolveDynamicPath(rawPath, result.ngayGD));
      try {
        await writeCcpTypedLotToAccumulator(result, resolved, type, jobLogs);
        lotUpdated = true;
        this.logger.log(`[CCP-ACC] Đã ghi lot ${key} vào: ${resolved}`);
      } catch (err: any) {
        const msg = `Lỗi ghi file lũy kế lot ${key}: ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
        jobLogs?.push(`[CCP-ACC ERROR] ${msg}`);
      }
    }

    // ── 3. Phase 2: GTGD theo phân hệ (Normal, Spread, LME, Options) ───────
    const typedGtgd: Array<{ key: string; rawPath?: string; type: 'normal' | 'spread' | 'lme' | 'options' }> = [
      { key: 'GtgdNormal',  rawPath: paths.pathGtgdNormal,  type: 'normal' },
      { key: 'GtgdSpread',  rawPath: paths.pathGtgdSpread,  type: 'spread' },
      { key: 'GtgdLme',     rawPath: paths.pathGtgdLme,     type: 'lme' },
      { key: 'GtgdOptions', rawPath: paths.pathGtgdOptions, type: 'options' },
    ];

    for (const { key, rawPath, type } of typedGtgd) {
      if (!rawPath) continue;

      // Zero-Lot Bypass: Nếu phân hệ này không có GTGD phát sinh, tự động bỏ qua.
      const typeStats = (result as any).byType?.[type];
      if (!typeStats || typeStats.totalGiaTri <= 0) {
        this.logger.debug(`[CCP-ACC] Bỏ qua ghi GTGD ${key}: 0 VND phát sinh.`);
        continue;
      }

      const resolved = resolveStoragePathCrossPlatform(resolveDynamicPath(rawPath, result.ngayGD));
      try {
        await writeCcpTypedValueToAccumulator(result, resolved, type, jobLogs);
        gtgdUpdated = true;
        this.logger.log(`[CCP-ACC] Đã ghi GTGD ${key} vào: ${resolved}`);
      } catch (err: any) {
        const msg = `Lỗi ghi file lũy kế GTGD ${key}: ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
        jobLogs?.push(`[CCP-ACC ERROR] ${msg}`);
      }
    }

    // ── 4. Phase 2: Raw DSGD Lũy Kế ───────────────────────────────────────
    if (paths.pathDsgdCumulative && dsgdBuffer) {
      const resolved = resolveStoragePathCrossPlatform(resolveDynamicPath(paths.pathDsgdCumulative, result.ngayGD));
      try {
        await appendCcpRawDsgd(dsgdBuffer, resolved, result.ngayGD, jobLogs);
        this.logger.log(`[CCP-ACC] Đã ghi lũy kế DSGD Raw vào: ${resolved}`);
      } catch (err: any) {
        const msg = `Lỗi ghi file raw DSGD lũy kế: ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
        jobLogs?.push(`[CCP-ACC ERROR] ${msg}`);
      }
    }

    // ── 5. Standby: Ghi File Audit Bạc Thỏi (-M) nếu phát sinh giao dịch ──
    const bacThoiData = (result as any).byType?.bacThoi;
    if (bacThoiData && bacThoiData.totalSoLot > 0) {
      try {
        const anyRefPath =
          paths.pathNormalLot ||
          (paths as any).pathNormalCumulative ||
          paths.pathAcmLot ||
          (paths as any).pathAcmCumulative ||
          paths.pathDsgdCumulative;
        if (anyRefPath) {
          const resolvedRef = resolveStoragePathCrossPlatform(
            resolveDynamicPath(anyRefPath, result.ngayGD),
          );
          const targetDir = path.dirname(resolvedRef);
          if (fs.existsSync(targetDir)) {
            const dateStr =
              result.ngayGD instanceof Date
                ? `${result.ngayGD.getFullYear()}${String(result.ngayGD.getMonth() + 1).padStart(2, '0')}${String(result.ngayGD.getDate()).padStart(2, '0')}`
                : String(result.ngayGD).replace(/[^0-9]/g, '').slice(0, 8);
            const auditFilePath = path.join(targetDir, `Standby_Bac_Thoi_${dateStr}.txt`);

            const lines: string[] = [
              '================================================================================',
              'BÁO CÁO KIỂM TOÁN TÀI KHOẢN BẠC THỎI NIÊM YẾT (-M) [CHẾ ĐỘ STANDBY]',
              `Ngày giao dịch: ${result.ngayGD instanceof Date ? result.ngayGD.toLocaleDateString('vi-VN') : result.ngayGD}`,
              `Thời gian hệ thống ghi nhận: ${new Date().toLocaleString('vi-VN')}`,
              'Trạng thái: Chờ quyết định chính thức từ MXV về việc tách sổ riêng hay gộp vào Sổ thường.',
              '--------------------------------------------------------------------------------',
              `TỔNG SỐ LOT BẠC THỎI: ${bacThoiData.totalSoLot} lot`,
              `TỔNG GIÁ TRỊ GIAO DỊCH: ${bacThoiData.totalGiaTri.toLocaleString('vi-VN')} VND`,
              '--------------------------------------------------------------------------------',
              'CHI TIẾT THEO THÀNH VIÊN KINH DOANH (TVKD):',
            ];

            for (const tvkd of bacThoiData.byTvkd || []) {
              lines.push(
                `- TVKD ${tvkd.tvkd} (${tvkd.tenThanhVien || 'N/A'}): ${tvkd.soLot} lot | ${tvkd.giaTri.toLocaleString('vi-VN')} VND`,
              );
              for (const hh of tvkd.byHH || []) {
                lines.push(
                  `    + Mã hàng: ${hh.maHH} - Số lot: ${hh.soLot} - GTGD: ${hh.giaTri.toLocaleString('vi-VN')} VND`,
                );
              }
            }
            lines.push('================================================================================');

            fs.writeFileSync(auditFilePath, lines.join('\n'), 'utf-8');
            this.logger.log(`[CCP-STANDBY] Đã ghi file audit Bạc thỏi (-M) vào: ${auditFilePath}`);
            jobLogs?.push(`[CCP-STANDBY] Đã xuất file audit Bạc thỏi (-M): ${path.basename(auditFilePath)}`);
          }
        }
      } catch (err: any) {
        this.logger.warn(`[CCP-STANDBY] Không thể ghi file audit Bạc thỏi: ${err.message}`);
      }
    }

    return { lotUpdated, gtgdUpdated, errors };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC: Config
  // ──────────────────────────────────────────────────────────────────────────

  async getConfig(): Promise<Record<string, any>> {
    const raw = await this.settingsService.getSetting('ccp_lot_statistics_config', '{}');
    const ccpBackupPath = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures',
    );
    try {
      const p = JSON.parse(raw);
      return {
        // Phase 1
        pathAcmLot: p.pathAcmLot || p.pathAcmCumulative || '',
        pathAcmGtgd: p.pathAcmGtgd || p.pathGtgdAcm || '',
        pathAcmCumulative: p.pathAcmCumulative || p.pathAcmLot || '',
        pathGtgdAcm: p.pathGtgdAcm || p.pathAcmGtgd || '',
        // Phase 2 - Số Lot
        pathNormalLot: p.pathNormalLot || p.pathNormalCumulative || '',
        pathSpreadLot: p.pathSpreadLot || p.pathSpreadCumulative || '',
        pathLmeLot: p.pathLmeLot || p.pathLmeCumulative || '',
        pathOptionsLot: p.pathOptionsLot || p.pathOptionsCumulative || '',
        pathNormalCumulative: p.pathNormalCumulative || p.pathNormalLot || '',
        pathSpreadCumulative: p.pathSpreadCumulative || p.pathSpreadLot || '',
        pathLmeCumulative: p.pathLmeCumulative || p.pathLmeLot || '',
        pathOptionsCumulative: p.pathOptionsCumulative || p.pathOptionsLot || '',
        // Phase 2 - Raw DSGD
        pathDsgdCumulative: p.pathDsgdCumulative || '',
        // Phase 2 - GTGD
        pathGtgdNormal: p.pathGtgdNormal || '',
        pathGtgdSpread: p.pathGtgdSpread || '',
        pathGtgdLme: p.pathGtgdLme || '',
        pathGtgdOptions: p.pathGtgdOptions || '',
        // Cấu hình chung
        ccpApiBaseUrl: p.ccpApiBaseUrl || '',
        updateCumulative: p.updateCumulative === true || p.updateCumulative === 'true',
        bot_backup_path_ccp: ccpBackupPath,
      };
    } catch {
      return {
        pathAcmLot: '',
        pathAcmGtgd: '',
        pathAcmCumulative: '',
        pathGtgdAcm: '',
        pathNormalLot: '',
        pathSpreadLot: '',
        pathLmeLot: '',
        pathOptionsLot: '',
        pathNormalCumulative: '',
        pathSpreadCumulative: '',
        pathLmeCumulative: '',
        pathOptionsCumulative: '',
        pathDsgdCumulative: '',
        pathGtgdNormal: '',
        pathGtgdSpread: '',
        pathGtgdLme: '',
        pathGtgdOptions: '',
        ccpApiBaseUrl: '',
        updateCumulative: false,
        bot_backup_path_ccp: ccpBackupPath,
      };
    }
  }

  async saveConfig(config: Record<string, any>): Promise<{ success: boolean }> {
    if (config.bot_backup_path_ccp !== undefined) {
      await this.settingsService.setSetting(
        'bot_backup_path_ccp',
        String(config.bot_backup_path_ccp).trim(),
      );
    }
    await this.settingsService.setSetting(
      'ccp_lot_statistics_config',
      JSON.stringify(config),
    );
    return { success: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE: Core Calculations
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Tính toán thống kê per TVKD từ DSGD, TTM, TTTT
   */
  private calcPerTvkd(
    dsgdRows: CcpDsgdRow[],
    ttmRows: CcpTtmRow[],
    ttttRows: CcpTtttRow[],
    tyGiaMap: CcpTyGiaMap,
    params: CcpLotParams,
    warnings: string[],
  ): CcpTvkdStat[] {
    // Group DSGD by TVKD
    const dsgdByTvkd = new Map<string, CcpDsgdRow[]>();
    const tvkdNames = new Map<string, string>();

    for (const row of dsgdRows) {
      const tvkd = row.maTvkd;
      if (!tvkd) continue;
      if (!dsgdByTvkd.has(tvkd)) dsgdByTvkd.set(tvkd, []);
      dsgdByTvkd.get(tvkd)!.push(row);
      // Lấy tên thành viên từ col[22] trong raw (index 22 = Tên thành viên)
      if (!tvkdNames.has(tvkd) && row.raw[22]) {
        tvkdNames.set(tvkd, String(row.raw[22]).trim());
      }
    }

    // Group TTM by TVKD
    const ttmByTvkd = new Map<string, CcpTtmRow[]>();
    for (const row of ttmRows) {
      const tvkd = row.maTvkd;
      if (!tvkd) continue;
      if (!ttmByTvkd.has(tvkd)) ttmByTvkd.set(tvkd, []);
      ttmByTvkd.get(tvkd)!.push(row);
    }

    // Group TTTT by TVKD
    const ttttByTvkd = new Map<string, CcpTtttRow[]>();
    for (const row of ttttRows) {
      const tvkd = row.maTvkd;
      if (!tvkd) continue;
      if (!ttttByTvkd.has(tvkd)) ttttByTvkd.set(tvkd, []);
      ttttByTvkd.get(tvkd)!.push(row);
    }

    // Build all unique TVKDs (union of DSGD + TTM + TTTT)
    const allTvkds = new Set<string>([
      ...dsgdByTvkd.keys(),
      ...ttmByTvkd.keys(),
      ...ttttByTvkd.keys(),
    ]);

    const result: CcpTvkdStat[] = [];

    for (const tvkd of Array.from(allTvkds).sort()) {
      const dsgdGroup = dsgdByTvkd.get(tvkd) ?? [];
      const ttmGroup = ttmByTvkd.get(tvkd) ?? [];
      const ttttGroup = ttttByTvkd.get(tvkd) ?? [];

      // ── DSGD calculations ──────────────────────────────────────────────
      const soLot = dsgdGroup.reduce((s, r) => s + r.klKhop, 0);
      const giaTri = this.calcGtgd(dsgdGroup, tyGiaMap, params);

      // Check 4 order types
      const orderTypes = new Set(
        dsgdGroup.map((r) => r.loaiLenh.toUpperCase()).filter((t) => t),
      );
      const missingTypes = REQUIRED_ORDER_TYPES.filter((t) => !orderTypes.has(t));
      const isFull4Types = missingTypes.length === 0;

      // ── TTM calculations ───────────────────────────────────────────────
      const ttmMua = ttmGroup.reduce((s, r) => s + r.klMua, 0);
      const ttmBan = ttmGroup.reduce((s, r) => s + r.klBan, 0);
      const ttmLaiLoDuKienVnd = ttmGroup.reduce((s, r) => s + r.laiLoDuKienVnd, 0);

      // ── TTTT calculations ──────────────────────────────────────────────
      const kltt = ttttGroup.reduce((s, r) => s + r.klMua + r.klBan, 0);
      const ttttLaiLoThucTeVnd = ttttGroup.reduce((s, r) => s + r.laiLoThucTeVnd, 0);

      result.push({
        tvkd,
        tenThanhVien: tvkdNames.get(tvkd),
        soLot,
        giaTri,
        isFull4Types,
        missingTypes,
        byHH: this.calcByHH(dsgdGroup, tyGiaMap, params),
        ttmMua,
        ttmBan,
        ttmLaiLoDuKienVnd,
        kltt,
        ttttLaiLoThucTeVnd,
      });
    }

    return result;
  }

  /**
   * Tính breakdown Lot + GTGD per mã HH trong một nhóm DSGD của TVKD.
   * Dùng cho accumulator ghi per-HH vào file lũy kế.
   */
  private calcByHH(
    rows: CcpDsgdRow[],
    tyGiaMap: CcpTyGiaMap,
    params: CcpLotParams,
  ): CcpHhStat[] {
    const hhMap = new Map<string, { soLot: number; giaTri: number }>();

    for (const row of rows) {
      if (row.klKhop <= 0) continue;
      const maHH = getMaHHFromCcpMaHD(row.maHD, row.maTKGD);
      const hhSpec = getCcpHhSpec(maHH, params.hhOverrides);
      const doCao = hhSpec?.doCao ?? 1;
      const currency = hhSpec?.tienTe ?? 'USD';
      const tyGia = tyGiaMap[currency] ?? tyGiaMap['USD'] ?? 1;
      const gtgd = Math.round(row.klKhop * row.giaKhop * doCao * tyGia);

      if (!hhMap.has(maHH)) hhMap.set(maHH, { soLot: 0, giaTri: 0 });
      const entry = hhMap.get(maHH)!;
      entry.soLot += row.klKhop;
      entry.giaTri += gtgd;
    }

    return Array.from(hhMap.entries()).map(([maHH, v]) => ({ maHH, ...v }));
  }

  /**
   * Tính Giá Trị Giao Dịch (GTGD) từ DSGD CCP rows.
   *
   * Công thức (đã xác nhận từ file Mã HĐ CCP_14_06.xlsx):
   *   GTGD = KL_khop × Giá_khớp_TB × doCao × tyGia
   *
   * Trong đó:
   *   doCao  = Độ lớn hợp đồng (PL1NY=5, CP2CO=1000, SI5CO=100) – đơn vị Pound
   *   tyGia  = VND/ngoại tệ từ bảng Tỷ giá CCP (USD=25920, JPY=170, MYR=6383...)
   *   Giá khớp TB = USD/Pound (ví dụ: SI5COZ26 = 6.485 USD/Pound)
   *
   * Ví dụ:
   *   DSGD: SI5COZ26, KL=1, Giá=6.485 USD/Pound, doCao=100, tyGia(USD)=25920
   *   GTGD = 1 × 6.485 × 100 × 25920 = 16,806,720 VND
   */
  private calcGtgd(
    rows: CcpDsgdRow[],
    tyGiaMap: CcpTyGiaMap,
    params: CcpLotParams,
  ): number {
    let total = 0;
    for (const row of rows) {
      if (row.klKhop <= 0 || row.giaKhop <= 0) continue;

      const maHH = getMaHHFromCcpMaHD(row.maHD, row.maTKGD);

      // Tra bảng HH spec (doCao + tienTe)
      const hhSpec = getCcpHhSpec(maHH, params.hhOverrides);
      const doCao = hhSpec?.doCao ?? 1;
      const currency = hhSpec?.tienTe ?? 'USD';

      const tyGia = tyGiaMap[currency] ?? tyGiaMap['USD'] ?? 1;

      // GTGD = KL × Giá × doCao × tyGia (làm tròn số nguyên VND)
      total += Math.round(row.klKhop * row.giaKhop * doCao * tyGia);
    }
    return total;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE: File Parsers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Parse buffer Excel → mảng rows (bỏ header row 0)
   */
  private parseRawRows(buffer: Buffer): any[][] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    return rows.slice(1); // bỏ header
  }

  /**
   * Parse buffer Excel → trả về cả headers và data rows
   */
  private parseRawRowsWithHeaders(buffer: Buffer): { headers: any[]; rows: any[][] } {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const all = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
    if (all.length === 0) return { headers: [], rows: [] };
    return { headers: all[0] || [], rows: all.slice(1) };
  }

  /**
   * Parse file Tỷ giá CCP (xuất từ /SYSCONFIGMNG/CURRENCYEXCHANGERATE).
   *
   * Cấu trúc file (đã xác nhận từ file mẫu Tỷ giá_14.06.xlsx):
   *   col[0] = Nguyên tệ (USD, JPY, MYR, CNY, VND)
   *   col[1] = Tỷ giá quy đổi  ← dùng cái này
   *   col[2] = Tỷ giá Mua
   *   col[3] = Tỷ giá Bán
   */
  parseTyGiaFile(buffer: Buffer): CcpTyGiaMap {
    const rows = this.parseRawRows(buffer);
    const map: CcpTyGiaMap = {};
    for (const row of rows) {
      const currency = String(row[0] ?? '').trim().toUpperCase();
      const rate = parseFloat(String(row[1] ?? '0').replace(/,/g, ''));
      if (currency && !isNaN(rate) && rate > 0) {
        map[currency] = rate;
      }
    }
    return map;
  }

  /**
   * Parse file Mã Hàng hóa / Hợp đồng CCP (xuất từ /PRODUCT/COMMODITY).
   *
   * Cấu trúc file (đã xác nhận từ file mẫu Mã HĐ CCP_14_06.xlsx):
   *   col[1] = Mã hàng hóa (PL1NY, CP2CO, SI5CO, SIV...)
   *   col[5] = Tên hàng hóa tiếng Việt
   *   col[7] = Độ lớn hợp đồng (5, 1000, 100, 1200...) -> chính là doCao
   *   col[8] = Đơn vị đo lường (Pound, kg, Lô...)
   *   col[14] = Tiền tệ (USD, VND...)
   */
  parseCcpCommoditySpecFile(buffer: Buffer): CcpHhSpec[] {
    const { headers, rows } = this.parseRawRowsWithHeaders(buffer);
    const headerMap = buildCcpHeaderMap(headers);

    const idxMaHH = resolveColIdx(headerMap, ['mahanghoa', 'mahh', 'symbol'], 1);
    const idxTenHH = resolveColIdx(headerMap, ['tenhanghoatiengviet', 'tenhh', 'name'], 5);
    const idxDoCao = resolveColIdx(headerMap, ['dolonhopdong', 'docao', 'multiplier', 'contractsize'], 7);
    const idxDonVi = resolveColIdx(headerMap, ['donvidoluong', 'donvi', 'unit'], 8);
    const idxTienTe = resolveColIdx(headerMap, ['tiente', 'currency'], 14);

    const specs: CcpHhSpec[] = [];
    for (const row of rows) {
      const maHH = String(row[idxMaHH] ?? '').trim().toUpperCase();
      if (!maHH) continue;
      const doCao = parseFloat(String(row[idxDoCao] ?? '1').replace(/,/g, ''));
      const tienTe = String(row[idxTienTe] ?? 'USD').trim().toUpperCase() || 'USD';
      const tenHH = String(row[idxTenHH] ?? maHH).trim();
      const donVi = String(row[idxDonVi] ?? '').trim();

      specs.push({
        maHH,
        tenHH,
        doCao: isNaN(doCao) || doCao <= 0 ? 1 : doCao,
        donVi,
        tienTe,
      });
    }
    return specs;
  }

  /**
   * Lấy tỷ giá từ API CCP: GET {baseUrl}/SYSCONFIGMNG/CURRENCYEXCHANGERATE
   * Trả về map { 'USD': 25920, 'JPY': 170, ... }
   *
   * NOTE: Phần này cần JWT token – sẽ được implement sau khi có auth handler.
   * Hiện tại sử dụng file upload Tỷ giá.xlsx là phương án chính.
   */
  async fetchTyGiaFromApi(apiBaseUrl: string, authToken?: string): Promise<CcpTyGiaMap> {
    this.logger.log(`[CCP] Đang lấy tỷ giá từ API: ${apiBaseUrl}/SYSCONFIGMNG/CURRENCYEXCHANGERATE`);
    // TODO: Implement HTTP call với axios/fetch khi có auth token
    // const response = await fetch(`${apiBaseUrl}/SYSCONFIGMNG/CURRENCYEXCHANGERATE`, {
    //   headers: { Authorization: `Bearer ${authToken}` }
    // });
    // const data = await response.json();
    // return data.reduce((map, item) => { map[item.BASECURRENCY] = item.EXCHANGERATE; return map; }, {});
    this.logger.warn('[CCP] API tỷ giá chưa implement – sử dụng file upload');
    return {};
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PRIVATE: Helpers
  // ──────────────────────────────────────────────────────────────────────────

  private sumLot(rows: CcpDsgdRow[]): number {
    return rows.reduce((s, r) => s + r.klKhop, 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AUTO-SCAN & AUTO-PROCESS DAILY FILES FROM BACKUP FOLDER
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Tự động quét thư mục backup theo ngày để kiểm tra sự tồn tại của 4 file báo cáo CCP:
   *  - DSGD (DSGD*.xlsx / DSGD*.csv)
   *  - TTM (TTM*.xlsx / TTM*.csv)
   *  - TTTT (TTTT*.xlsx / TTTT*.csv)
   *  - Tỷ giá (Tỷ giá*.xlsx / Ty_gia*.xlsx...)
   */
  async scanDailyFiles(dateStr: string): Promise<CcpDailyScanResult> {
    const ccpBaseRaw = await getCcpBackupBase(this.settingsService);
    const msBaseRaw = await getMsBackupBase(this.settingsService);

    let targetFolder = '';
    let candidateFolders: string[] = [];
    let dateObj = new Date();

    try {
      const resolved = resolveBotTargetDate({ targetDate: dateStr });
      dateObj = resolved.dateObj;
      const ccpSub = resolveDailySubfolder(resolveStoragePathCrossPlatform(ccpBaseRaw), dateObj);
      const msSub = resolveDailySubfolder(resolveStoragePathCrossPlatform(msBaseRaw), dateObj);
      candidateFolders = [ccpSub.fullPath, msSub.fullPath];
      targetFolder = ccpSub.fullPath;
    } catch {
      targetFolder = resolveStoragePathCrossPlatform(ccpBaseRaw);
      candidateFolders = [targetFolder, resolveStoragePathCrossPlatform(msBaseRaw)];
    }

    // Check which candidate folder exists and has DSGD file
    let folderToScan = targetFolder;
    let folderExists = false;

    for (const folder of candidateFolders) {
      if (fs.existsSync(folder)) {
        folderExists = true;
        try {
          const files = fs.readdirSync(folder);
          const hasDsgd = files.some(
            (f) =>
              /^DSGD.*\.xlsx$/i.test(f) ||
              /^DSGD.*\.xls$/i.test(f) ||
              /^DSGD.*\.csv$/i.test(f) ||
              /^ORDERMATCH.*\.xlsx$/i.test(f) ||
              /^ORDERMATCH.*\.csv$/i.test(f),
          );
          if (hasDsgd) {
            folderToScan = folder;
            break;
          }
          folderToScan = folder;
        } catch {
          // ignore
        }
      }
    }

    const result: CcpDailyScanResult = {
      folderPath: folderToScan,
      exists: folderExists,
      canProcess: false,
      files: {},
    };

    if (!folderExists) {
      return result;
    }

    try {
      const dirFiles = fs.readdirSync(folderToScan);

      const findFile = (patterns: RegExp[]): CcpDailyFileInfo | undefined => {
        for (const pattern of patterns) {
          const match = dirFiles.find((f) => pattern.test(f));
          if (match) {
            const fpath = path.join(folderToScan, match);
            const stat = fs.statSync(fpath);
            return {
              present: true,
              filename: match,
              size: stat.size,
              path: fpath,
            };
          }
        }
        return undefined;
      };

      // 1. DSGD (bắt buộc) - Ưu tiên file DSGD giao dịch chuẩn
      result.files.dsgd = findFile([
        /^DSGD(?!\s*MM).*\.csv$/i,
        /^DSGD(?!\s*MM).*\.xlsx$/i,
        /^DSGD(?!\s*MM).*\.xls$/i,
        /^ORDERMATCH_DETAIL.*\.xlsx$/i,
        /^ORDERMATCH.*\.xlsx$/i,
        /^ORDERMATCH.*\.csv$/i,
        /^DSGD.*\.csv$/i,
        /^DSGD.*\.xlsx$/i,
        /^DSGD.*\.xls$/i,
      ]);

      // 2. TTM (tùy chọn)
      result.files.ttm = findFile([
        /^TTM.*\.xlsx$/i,
        /^TTM.*\.xls$/i,
        /^TTM.*\.csv$/i,
        /^OPEN_POSITION.*\.xlsx$/i,
        /^OPEN_POSITION.*\.csv$/i,
      ]);

      // 3. TTTT (tùy chọn)
      result.files.tttt = findFile([
        /^TTTT.*\.xlsx$/i,
        /^TTTT.*\.xls$/i,
        /^TTTT.*\.csv$/i,
        /^PNL_EXECUTED.*\.xlsx$/i,
        /^PNL_EXECUTED.*\.csv$/i,
      ]);

      // 4. Tỷ giá (tùy chọn) - ưu tiên ngày hiện tại
      result.files.tyGia = findFile([
        /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.xlsx$/i,
        /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.xls$/i,
        /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.csv$/i,
      ]);

      // Nếu ngày hiện tại chưa có file tỷ giá -> Quét tìm file tỷ giá gần nhất từ các ngày trước
      if (!result.files.tyGia) {
        for (const candidateFolder of candidateFolders) {
          const baseFolder = path.dirname(candidateFolder);
          const nearestTyGia = this.findLatestFileInHistory(
            baseFolder,
            dateObj,
            [
              /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.xlsx$/i,
              /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.xls$/i,
              /^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.csv$/i,
            ],
            30,
          );
          if (nearestTyGia) {
            result.files.tyGia = nearestTyGia;
            this.logger.log(
              `[CCP] Ngày ${dateStr} chưa có file tỷ giá, tự động sử dụng tỷ giá gần nhất từ ngày ${nearestTyGia.fromDate} (${nearestTyGia.filename})`,
            );
            break;
          }
        }
      }

      // 5. Mã HĐ / Quy chuẩn Hàng hóa doCao (tùy chọn) - ưu tiên ngày hiện tại
      result.files.maHD = findFile([
        /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xlsx$/i,
        /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xls$/i,
        /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.csv$/i,
      ]);

      // Nếu ngày hiện tại chưa có file Mã HĐ -> Quét tìm file Mã HĐ gần nhất từ các ngày trước
      if (!result.files.maHD) {
        for (const candidateFolder of candidateFolders) {
          const baseFolder = path.dirname(candidateFolder);
          const nearestMaHD = this.findLatestFileInHistory(
            baseFolder,
            dateObj,
            [
              /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xlsx$/i,
              /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.xls$/i,
              /^(?:Mã\s*HĐ|Ma_?HD|COMMODITY|Hợp\s*đồng).*\.csv$/i,
            ],
            60,
          );
          if (nearestMaHD) {
            result.files.maHD = nearestMaHD;
            this.logger.log(
              `[CCP] Tự động sử dụng file quy chuẩn hàng hóa (doCao) gần nhất từ ngày ${nearestMaHD.fromDate} (${nearestMaHD.filename})`,
            );
            break;
          }
        }
      }

      result.canProcess = !!result.files.dsgd?.present;
    } catch (err: any) {
      this.logger.warn(`[CCP] Lỗi khi quét thư mục ${folderToScan}: ${err.message}`);
    }

    return result;
  }

  /**
   * Quét lùi về các ngày trước đó (tối đa maxDays ngày) để tìm file gần nhất
   * (áp dụng cho Tỷ giá và Mã HĐ / Độ lớn hợp đồng khi ngày hiện tại chưa có file mới).
   */
  private findLatestFileInHistory(
    baseDir: string,
    targetDate: Date,
    patterns: RegExp[],
    maxDays = 30,
  ): (CcpDailyFileInfo & { fromDate?: string }) | undefined {
    if (!fs.existsSync(baseDir)) return undefined;

    for (let dayOffset = 1; dayOffset <= maxDays; dayOffset++) {
      const prevDate = new Date(targetDate);
      prevDate.setDate(prevDate.getDate() - dayOffset);

      try {
        const sub = resolveDailySubfolder(baseDir, prevDate);
        if (fs.existsSync(sub.fullPath)) {
          const files = fs.readdirSync(sub.fullPath);
          for (const pattern of patterns) {
            const match = files.find((f) => pattern.test(f));
            if (match) {
              const fpath = path.join(sub.fullPath, match);
              const stat = fs.statSync(fpath);
              const dStr = prevDate.toISOString().slice(0, 10);
              return {
                present: true,
                filename: match,
                size: stat.size,
                path: fpath,
                fromDate: dStr,
              };
            }
          }
        }
      } catch {
        // continue
      }
    }
    return undefined;
  }

  /**
   * Tự động đọc các file trong thư mục ngày và xử lý tính toán ra CcpLotResult.
   * Không cần người dùng phải upload thủ công.
   */
  async processDailyFiles(dateStr: string): Promise<CcpLotResult> {
    const scan = await this.scanDailyFiles(dateStr);
    if (!scan.exists) {
      throw new Error(`Thư mục backup cho ngày ${dateStr} không tồn tại: ${scan.folderPath}`);
    }
    if (!scan.files.dsgd?.present || !scan.files.dsgd.path) {
      throw new Error(`Không tìm thấy file DSGD (khớp lệnh) trong thư mục ngày: ${scan.folderPath}`);
    }

    const dsgdCcp = fs.readFileSync(scan.files.dsgd.path);
    const ttm = scan.files.ttm?.path ? fs.readFileSync(scan.files.ttm.path) : undefined;
    const tttt = scan.files.tttt?.path ? fs.readFileSync(scan.files.tttt.path) : undefined;
    const tyGia = scan.files.tyGia?.path ? fs.readFileSync(scan.files.tyGia.path) : undefined;
    const maHD = scan.files.maHD?.path ? fs.readFileSync(scan.files.maHD.path) : undefined;

    return this.processCcpLotStatistics(
      { dsgdCcp, ttm, tttt, tyGia, maHD },
      { ngayGD: dateStr },
    );
  }
}
