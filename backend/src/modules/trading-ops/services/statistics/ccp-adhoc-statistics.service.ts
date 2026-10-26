import { Injectable, Logger, BadRequestException, NotFoundException, Optional, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import { CoreCcpApiAdapter } from '../../../ingress/adapters/coreccp-api.adapter';
import { CcpLotStatisticsService, CcpLotResult, CcpTvkdStat } from './ccp-lot-statistics.service';
import { executePythonTemplateWriter } from '../../helpers/ccp-adhoc-template.helper';
import { resolveStoragePathCrossPlatform, resolveDynamicPath } from '../../../bot-engine/helpers/bot-path.helper';

export interface CcpAdHocRangeParams {
  fromDate: string; // YYYY-MM-DD hoặc DD/MM/YYYY
  toDate: string;   // YYYY-MM-DD hoặc DD/MM/YYYY
  scope?: 'ACM_ONLY' | 'ALL_PHASE2' | 'ALL';
  downloadFresh?: boolean;
  localDsgdFilePath?: string;
}

export interface CcpAdHocFileResult {
  fileName: string;
  filePath?: string;
  absolutePath?: string;
  downloadUrl: string;
  sizeBytes?: number;
  fileSizeBytes: number;
  reportType: 'LOT' | 'GTGD';
  category: string;
  targetRow?: number;
  tongRow?: number;
}

export interface CcpAdHocRangeResponse {
  success: boolean;
  period: string;
  generatedAt: string;
  files: CcpAdHocFileResult[];
  summary: {
    totalLot: number;
    totalGiaTri: number;
    acmLot: number;
    acmGiaTri: number;
    byTvSummary: Array<{ tvkd: string; lot: number; giaTri: number }>;
  };
  logs: string[];
}

@Injectable()
export class CcpAdHocStatisticsService {
  private readonly logger = new Logger(CcpAdHocStatisticsService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly ccpLotStatisticsService: CcpLotStatisticsService,
    @Optional()
    @Inject(forwardRef(() => CoreCcpApiAdapter))
    private readonly coreCcpApiAdapter?: CoreCcpApiAdapter,
  ) {}

  /**
   * Chuẩn hóa chuỗi ngày YYYY-MM-DD hoặc DD/MM/YYYY sang { iso: 'YYYY-MM-DD', dmy: 'DD/MM/YYYY', clean: 'DD.MM.YYYY', date: Date }
   */
  private normalizeDate(dStr: string) {
    let y = 0, m = 0, d = 0;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else if (dStr.includes('/') || dStr.includes('.')) {
      const sep = dStr.includes('/') ? '/' : '.';
      const parts = dStr.split(sep);
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
    } else {
      throw new BadRequestException(`Định dạng ngày không hợp lệ: "${dStr}"`);
    }

    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) {
      throw new BadRequestException(`Giá trị ngày không hợp lệ: "${dStr}"`);
    }

    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      iso: `${y}-${pad(m)}-${pad(d)}`,
      dmy: `${pad(d)}/${pad(m)}/${y}`,
      clean: `${pad(d)}.${pad(m)}.${y}`,
      year: y,
      month: m,
      day: d,
      date: dateObj,
    };
  }

  /**
   * Xác định thư mục chứa Master Templates và thư mục lưu trữ báo cáo đột xuất _AdHoc_Reports
   */
  async resolveAdHocDirectories(): Promise<{ masterDir: string; adHocDir: string }> {
    const rawConfig = await this.settingsService.getSetting('ccp_lot_statistics_config', '{}');
    let configuredOut = '';
    try {
      const parsed = JSON.parse(rawConfig);
      const refPath = parsed.pathAcmLot || parsed.pathNormalLot || parsed.pathDsgdCumulative;
      if (refPath) {
        // Bắt buộc chuyển đổi cross-platform TRƯỚC để chuẩn hóa dấu phân tách thư mục sang / trên Linux,
        // tránh lỗi path.dirname() trên Linux trả về "." khi chuỗi đường dẫn chứa dấu gạch chéo ngược Windows "\"!
        const resolvedRef = resolveStoragePathCrossPlatform(refPath);
        configuredOut = path.dirname(resolvedRef);
      }
    } catch {}

    const defaultOut = 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Thong ke ccp\\output';
    const candidateDirs = [
      configuredOut,
      defaultOut,
      path.join(process.cwd(), 'data', 'backup', 'CCP', 'output'),
      path.join(process.cwd(), 'scratch', 'adhoc_test_output', 'all_10_masters'),
    ].filter((dir) => Boolean(dir) && dir !== '.' && dir !== './');

    let masterDir = '';
    for (const cDir of candidateDirs) {
      const resolved = resolveStoragePathCrossPlatform(cDir);
      if (fs.existsSync(resolved) && path.resolve(resolved) !== process.cwd()) {
        masterDir = resolved;
        break;
      }
    }

    if (!masterDir) {
      masterDir = resolveStoragePathCrossPlatform(defaultOut);
    }

    const adHocDir = path.join(masterDir, '_AdHoc_Reports');
    if (!fs.existsSync(adHocDir)) {
      try {
        fs.mkdirSync(adHocDir, { recursive: true });
      } catch (err: any) {
        this.logger.warn(`Không thể tạo thư mục _AdHoc_Reports tại ${adHocDir}: ${err.message}`);
        const localAdHoc = path.join(process.cwd(), 'data', '_AdHoc_Reports');
        fs.mkdirSync(localAdHoc, { recursive: true });
        return { masterDir, adHocDir: localAdHoc };
      }
    }

    return { masterDir, adHocDir };
  }

  /**
   * Tìm file Master Template chuẩn phù hợp trong thư mục masterDir
   */
  private findMasterTemplateFile(masterDir: string, patterns: RegExp[]): string | null {
    if (!fs.existsSync(masterDir)) return null;
    const files = fs.readdirSync(masterDir);

    for (const pattern of patterns) {
      const match = files.find((f) => pattern.test(f) && !f.startsWith('~$') && f.endsWith('.xlsx'));
      if (match) {
        return path.join(masterDir, match);
      }
    }
    return null;
  }

  /**
   * Trích xuất map số liệu theo TVKD và Mã Hàng từ danh sách CcpTvkdStat
   */
  private extractBreakdowns(
    tvkdStats: CcpTvkdStat[] | undefined,
    isLot: boolean,
  ): { tvkdMap: Record<string, number>; hhMap: Record<string, number> } {
    const tvkdMap: Record<string, number> = {};
    const hhMap: Record<string, number> = {};

    if (!tvkdStats || !Array.isArray(tvkdStats)) {
      return { tvkdMap, hhMap };
    }

    for (const stat of tvkdStats) {
      const code = stat.tvkd?.trim();
      if (code) {
        tvkdMap[code] = isLot ? (stat.soLot || 0) : (stat.giaTri || 0);
      }
      if (stat.byHH && Array.isArray(stat.byHH)) {
        for (const hh of stat.byHH) {
          const hhCode = hh.maHH?.trim();
          if (hhCode) {
            const val = isLot ? (hh.soLot || 0) : (hh.giaTri || 0);
            hhMap[hhCode] = (hhMap[hhCode] || 0) + val;
          }
        }
      }
    }

    return { tvkdMap, hhMap };
  }

  /**
   * Kích hoạt toàn trình Thống kê CoreCCP theo Khoảng Thời Gian (1-Pass Aggregation & Template Cloning)
   */
  async runAdHocRangeWorkflow(
    params: CcpAdHocRangeParams,
    user?: { id?: any; username?: string },
  ): Promise<CcpAdHocRangeResponse> {
    const jobLogs: string[] = [];
    const fromNorm = this.normalizeDate(params.fromDate);
    const toNorm = this.normalizeDate(params.toDate);

    if (fromNorm.date > toNorm.date) {
      throw new BadRequestException(`Ngày bắt đầu (${fromNorm.dmy}) không được lớn hơn ngày kết thúc (${toNorm.dmy})`);
    }

    const periodLabel = `${fromNorm.dmy} - ${toNorm.dmy}`;
    const timestampStr = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/[:]/g, '-');
    jobLogs.push(`[Ad-Hoc Range] Bắt đầu tổng hợp báo cáo đột xuất kỳ: ${periodLabel} (Scope: ${params.scope || 'ALL_PHASE2'})`);

    // ── 1. Nạp tệp DSGD CCP cho khoảng thời gian ──────────────────────────────
    let dsgdBuffer: Buffer | null = null;
    const tempDir = path.join(process.cwd(), 'temp', `adhoc_${Date.now()}`);

    if (params.localDsgdFilePath && fs.existsSync(params.localDsgdFilePath)) {
      jobLogs.push(`[Ad-Hoc Ingress] Sử dụng tệp DSGD chỉ định sẵn: ${params.localDsgdFilePath}`);
      dsgdBuffer = fs.readFileSync(params.localDsgdFilePath);
    } else if (params.downloadFresh !== false && this.coreCcpApiAdapter) {
      jobLogs.push(`[Ad-Hoc Ingress] Đang gọi API CoreCCP lấy toàn bộ lệnh khớp trong kỳ ${fromNorm.dmy} -> ${toNorm.dmy}...`);
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

      try {
        const dlResult = await this.coreCcpApiAdapter.download('CORE_CCP', {
          targetDate: toNorm.iso,
          targetDateRange: {
            fromDate: fromNorm.iso,
            toDate: toNorm.iso,
          },
          reportCodes: ['DSGD_CCP'],
          outputDir: tempDir,
        });

        const dsgdFile = dlResult.files.find((f) => f.fileName.includes('DSGD') || f.fileName.includes('ORDERMATCH'));
        if (dsgdFile && fs.existsSync(dsgdFile.absolutePath)) {
          dsgdBuffer = fs.readFileSync(dsgdFile.absolutePath);
          jobLogs.push(`[Ad-Hoc Ingress]  Tải tươi thành công tệp DSGD CCP (${(dsgdBuffer.length / 1024).toFixed(1)} KB)`);
        }
      } catch (dlErr: any) {
        jobLogs.push(`[Ad-Hoc Ingress WARN] Tải fresh qua API CoreCCP thất bại: ${dlErr.message}`);
        this.logger.warn(`[AdHoc] Download fresh failed: ${dlErr.message}`);
      }
    }

    if (!dsgdBuffer) {
      throw new BadRequestException(
        `Không thể lấy dữ liệu DSGD CCP cho khoảng thời gian ${periodLabel}. Vui lòng kiểm tra kết nối CoreCCP API hoặc tải lên tệp DSGD cả kỳ. (Hệ thống không lấy từ thư mục backup ngày để tránh sai lệch số liệu của cả kỳ).`,
      );
    }

    // ── 2. Đọc file phụ trợ (Tỷ giá, TTM, TTTT) ────────────────────────────────
    let ttmBuffer: Buffer | undefined;
    let ttttBuffer: Buffer | undefined;
    let tyGiaBuffer: Buffer | undefined;

    try {
      const scanTo = await this.ccpLotStatisticsService.scanDailyFiles(toNorm.iso);
      if (scanTo.exists) {
        if (scanTo.files.ttm?.path && fs.existsSync(scanTo.files.ttm.path)) {
          ttmBuffer = fs.readFileSync(scanTo.files.ttm.path);
        }
        if (scanTo.files.tttt?.path && fs.existsSync(scanTo.files.tttt.path)) {
          ttttBuffer = fs.readFileSync(scanTo.files.tttt.path);
        }
        if (scanTo.files.tyGia?.path && fs.existsSync(scanTo.files.tyGia.path)) {
          tyGiaBuffer = fs.readFileSync(scanTo.files.tyGia.path);
        }
      }
    } catch {}

    // ── 3. Tính toán 1 lần duy nhất bằng engine chuẩn processCcpLotStatistics ──
    jobLogs.push(`[Ad-Hoc Engine] Bắt đầu tính toán tổng hợp 1-Pass cho toàn bộ dữ liệu kỳ...`);
    const lotResult: CcpLotResult = await this.ccpLotStatisticsService.processCcpLotStatistics(
      {
        dsgdCcp: dsgdBuffer,
        ttm: ttmBuffer,
        tttt: ttttBuffer,
        tyGia: tyGiaBuffer,
      },
      { ngayGD: toNorm.iso },
      jobLogs,
    );
    jobLogs.push(
      `[Ad-Hoc Engine]  Tính toán hoàn tất: Tổng ${lotResult.totalSoLot?.toLocaleString('vi-VN')} lot, Tổng GTGD ${lotResult.totalGiaTri?.toLocaleString('vi-VN')} VND`,
    );

    // ── 4. Chuẩn bị danh mục Master Templates & thư mục đích _AdHoc_Reports ────
    const { masterDir, adHocDir } = await this.resolveAdHocDirectories();
    jobLogs.push(`[Ad-Hoc Templates] Thư mục Master: ${masterDir}`);
    jobLogs.push(`[Ad-Hoc Templates] Thư mục lưu báo cáo: ${adHocDir}`);

    const targetYear = toNorm.year;
    const targetMonthSheet = `T${toNorm.month}.${targetYear}`;
    const scope = params.scope || 'ALL_PHASE2';

    // Danh sách định nghĩa 10 báo cáo chuẩn
    interface TemplateJobDef {
      key: string;
      category: string;
      reportType: 'LOT' | 'GTGD';
      patterns: RegExp[];
      outputPrefix: string;
      getData: (res: CcpLotResult) => {
        totalLot: number;
        totalGtgd: number;
        totalKltt?: number;
        totalTtm?: number;
        tvkdMap: Record<string, number>;
        hhMap: Record<string, number>;
      };
    }

    const templateDefinitions: TemplateJobDef[] = [
      // 1. Số Lot ACM
      {
        key: 'AcmLot',
        category: 'ACM',
        reportType: 'LOT',
        patterns: [
          new RegExp(`^Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*ACM\\s*${targetYear}\\.xlsx$`, 'i'),
          new RegExp(`Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*ACM.*${targetYear}`, 'i'),
          /Thong\s*ke\s*so\s*lot\s*giao\s*dich\s*ACM.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_So_Lot_ACM_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const acmStats = r.byType?.acm;
          const { tvkdMap, hhMap } = this.extractBreakdowns(acmStats?.byTvkd || r.byTvkd, true);
          return {
            totalLot: acmStats?.totalSoLot || r.acmLot || 0,
            totalGtgd: acmStats?.totalGiaTri || 0,
            totalKltt: r.totalKltt || 0,
            totalTtm: r.totalTtmLot || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 2. GTGD ACM
      {
        key: 'AcmGtgd',
        category: 'ACM',
        reportType: 'GTGD',
        patterns: [
          new RegExp(`^Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*ACM\\s*${targetYear}\\.xlsx$`, 'i'),
          new RegExp(`Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*ACM.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*ACM.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_Gia_Tri_ACM_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const acmStats = r.byType?.acm;
          const { tvkdMap, hhMap } = this.extractBreakdowns(acmStats?.byTvkd || r.byTvkd, false);
          return {
            totalLot: acmStats?.totalSoLot || r.acmLot || 0,
            totalGtgd: acmStats?.totalGiaTri || r.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 3. Số Lot Normal (Giao dịch chung)
      {
        key: 'NormalLot',
        category: 'NORMAL',
        reportType: 'LOT',
        patterns: [
          new RegExp(`^Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*${targetYear}\\.xlsx$`, 'i'),
          /^Thong\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*\d{4}\.xlsx$/i,
          /^Thong\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*T\d{1,2}\.\d{4}\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_So_Lot_Normal_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.normal;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, true);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 4. GTGD Normal (Giá trị chung)
      {
        key: 'NormalGtgd',
        category: 'NORMAL',
        reportType: 'GTGD',
        patterns: [
          new RegExp(`^Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*${targetYear}\\.xlsx$`, 'i'),
          /^Thong\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*\d{4}\.xlsx$/i,
          /^Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*T\d{1,2}\.\d{4}\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_Gia_Tri_Normal_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.normal;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, false);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 5. Số Lot LME
      {
        key: 'LmeLot',
        category: 'LME',
        reportType: 'LOT',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*LME.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*so\\s*lot\\s*giao\\s*dich\\s*LME.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_So_Lot_LME_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.lme;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, true);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 6. GTGD LME
      {
        key: 'LmeGtgd',
        category: 'LME',
        reportType: 'GTGD',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*LME.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*gia\\s*tri\\s*giao\\s*dich\\s*LME.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_Gia_Tri_LME_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.lme;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, false);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 7. Số Lot Options
      {
        key: 'OptionsLot',
        category: 'OPTIONS',
        reportType: 'LOT',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich.*Option.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*so\\s*lot\\s*giao\\s*dich.*Option.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_So_Lot_Option_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.options;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, true);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 8. GTGD Options
      {
        key: 'OptionsGtgd',
        category: 'OPTIONS',
        reportType: 'GTGD',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich.*Option.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*gia\\s*tri\\s*giao\\s*dich.*Option.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_Gia_Tri_Option_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.options;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, false);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 9. Số Lot Spread
      {
        key: 'SpreadLot',
        category: 'SPREAD',
        reportType: 'LOT',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*so\\s*lot\\s*giao\\s*dich.*Spread.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*so\\s*lot\\s*giao\\s*dich.*Spread.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_So_Lot_Spread_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.spread;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, true);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
      // 10. GTGD Spread
      {
        key: 'SpreadGtgd',
        category: 'SPREAD',
        reportType: 'GTGD',
        patterns: [
          new RegExp(`Thong\\s*ke\\s*gia\\s*tri\\s*giao\\s*dich.*Spread.*${targetYear}`, 'i'),
          /Thong\s*ke\\s*gia\\s*tri\\s*giao\\s*dich.*Spread.*\.xlsx$/i,
        ],
        outputPrefix: `Thong_Ke_Gia_Tri_Spread_Tu_${fromNorm.clean}_Den_${toNorm.clean}`,
        getData: (r) => {
          const st = r.byType?.spread;
          const { tvkdMap, hhMap } = this.extractBreakdowns(st?.byTvkd, false);
          return {
            totalLot: st?.totalSoLot || 0,
            totalGtgd: st?.totalGiaTri || 0,
            tvkdMap,
            hhMap,
          };
        },
      },
    ];

    const activeDefs = scope === 'ACM_ONLY'
      ? templateDefinitions.filter((d) => d.category === 'ACM')
      : templateDefinitions;

    // ── 5. Tiến hành nhân bản và kích hoạt Python Writer trên từng file ───────
    const generatedFiles: CcpAdHocFileResult[] = [];

    for (const def of activeDefs) {
      const masterPath = this.findMasterTemplateFile(masterDir, def.patterns);
      if (!masterPath) {
        jobLogs.push(`[Ad-Hoc WARN] Không tìm thấy Master Template cho [${def.key}] tại: ${masterDir}`);
        continue;
      }

      const outFileName = `${def.outputPrefix}_${timestampStr}.xlsx`;
      const outFilePath = path.join(adHocDir, outFileName);

      const itemData = def.getData(lotResult);

      // Kích hoạt Python Instant Row Pull Helper
      const writerRes = executePythonTemplateWriter({
        templatePath: masterPath,
        outputPath: outFilePath,
        dateLabel: periodLabel,
        targetMonth: targetMonthSheet,
        data: {
          reportType: def.reportType,
          totalLot: itemData.totalLot,
          totalGtgd: itemData.totalGtgd,
          totalKltt: itemData.totalKltt,
          totalTtm: itemData.totalTtm,
          tvkdMap: itemData.tvkdMap,
          hhMap: itemData.hhMap,
        },
        jobLogs,
      });

      if (writerRes.success && fs.existsSync(outFilePath)) {
        const stat = fs.statSync(outFilePath);
        generatedFiles.push({
          fileName: outFileName,
          filePath: outFilePath,
          absolutePath: outFilePath,
          downloadUrl: `/api/v1/ccp-statistics/lot-statistics/download-adhoc?filename=${encodeURIComponent(outFileName)}`,
          sizeBytes: stat.size,
          fileSizeBytes: stat.size,
          reportType: def.reportType,
          category: def.category,
          targetRow: writerRes.targetRow,
          tongRow: writerRes.tongRow,
        });
      }
    }

    // Dọn dẹp thư mục tạm
    try {
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}

    // ── 6. Tổng hợp bảng Preview TVKD ─────────────────────────────────────────
    const byTvSummary: Array<{ tvkd: string; lot: number; giaTri: number }> = [];
    if (lotResult.byTvkd && Array.isArray(lotResult.byTvkd)) {
      lotResult.byTvkd.forEach((stat) => {
        if ((stat.soLot || 0) > 0 || (stat.giaTri || 0) > 0) {
          byTvSummary.push({
            tvkd: stat.tvkd,
            lot: stat.soLot || 0,
            giaTri: stat.giaTri || 0,
          });
        }
      });
    }

    byTvSummary.sort((a, b) => b.lot - a.lot);

    jobLogs.push(`[Ad-Hoc Range]  Đã hoàn thành tạo ${generatedFiles.length} tệp báo cáo Template chuẩn MXV.`);

    return {
      success: true,
      period: periodLabel,
      generatedAt: new Date().toISOString(),
      files: generatedFiles,
      summary: {
        totalLot: lotResult.totalSoLot || 0,
        totalGiaTri: lotResult.totalGiaTri || 0,
        acmLot: (lotResult as any).byType?.acm?.totalSoLot || lotResult.acmLot || 0,
        acmGiaTri: (lotResult as any).byType?.acm?.totalGiaTri || 0,
        byTvSummary,
      },
      logs: jobLogs,
    };
  }

  /**
   * Liệt kê danh sách các file báo cáo đột xuất đã sinh trong _AdHoc_Reports
   */
  async listAdHocReports(): Promise<Array<{ fileName: string; sizeBytes: number; mtime: Date; downloadUrl: string }>> {
    const { adHocDir } = await this.resolveAdHocDirectories();
    if (!fs.existsSync(adHocDir)) return [];

    const files = fs.readdirSync(adHocDir);
    const results: Array<{ fileName: string; sizeBytes: number; mtime: Date; downloadUrl: string }> = [];

    for (const f of files) {
      if (f.endsWith('.xlsx') && !f.startsWith('~$')) {
        const full = path.join(adHocDir, f);
        try {
          const st = fs.statSync(full);
          results.push({
            fileName: f,
            sizeBytes: st.size,
            mtime: st.mtime,
            downloadUrl: `/api/v1/ccp-statistics/lot-statistics/download-adhoc?filename=${encodeURIComponent(f)}`,
          });
        } catch {}
      }
    }

    results.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return results;
  }

  /**
   * Lấy đường dẫn tuyệt đối an toàn của file để tải về (chống Directory Traversal)
   */
  async getAdHocFilePath(filename: string): Promise<string> {
    const safeBaseName = path.basename(filename);
    const { adHocDir } = await this.resolveAdHocDirectories();
    const candidatePath = path.join(adHocDir, safeBaseName);

    if (fs.existsSync(candidatePath)) {
      return candidatePath;
    }

    // Kiểm tra thêm thư mục local fallback
    const localFallback = path.join(process.cwd(), 'data', '_AdHoc_Reports', safeBaseName);
    if (fs.existsSync(localFallback)) {
      return localFallback;
    }

    throw new NotFoundException(`File báo cáo "${safeBaseName}" không tồn tại hoặc đã bị xóa.`);
  }
}
