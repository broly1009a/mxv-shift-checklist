/**
 * qlgd-dashboard.service.ts
 *
 * Service chuyên trách tổng hợp dữ liệu Dashboard Quản Lý Giao Dịch & Báo cáo Ban Giám Đốc.
 * Bóc tách và chuyển đổi 100% logic toán học từ file nghiệp vụ gốc Check BGS All.xlsm.
 * Hỗ trợ lấy dữ liệu trực tiếp qua Ingress API (MsApiAdapter, CoreCcpApiAdapter) và đọc từ file Backup.
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { BotJob } from '../../../schemas/bot-job.schema';
import { SystemSettingsService } from '../../system-settings/system-settings.service';

import {
  resolveStoragePathCrossPlatform,
  IngressSourceType,
  getCcpBackupBasePath,
  resolveCcpDailyPath,
} from '../../../shared';
import { findLatestFile } from '../helpers/trading-math.helper';
import {
  parseTTMForExecutive,
  parseTTTTForExecutive,
  parseDSGD,
  ExecutiveTtmRow,
  ExecutiveTtttRow,
} from '../parsers/ms-excel.parser';
import {
  CcpExcelParser,
} from '../parsers/ccp-excel.parser';
import {
  extractCcpBaseProduct,
  isAcm,
  isSpread,
  isLme,
  isOptions,
} from '../helpers/clearing-excel.helper';
import {
  BGS_COMMODITY_METADATA_44,
  BGS_TOP_17_SYMBOLS,
  getBgsCommodityMetadata,
} from '../constants/bgs-commodity-catalog.constant';
import { ValueStatisticsService } from './value-statistics.service';
import { MsApiAdapter } from '../../ingress/adapters/ms-api.adapter';
import { CoreCcpApiAdapter } from '../../ingress/adapters/coreccp-api.adapter';

export interface CommodityDashboardItem {
  stt: number;
  category: string;
  symbol: string;
  name: string;
  expectedPnL: number;
  openPositions: number;
  longRatio: number;
  shortRatio: number;
  realizedPnL: number;
  liquidatedLots: number;
  isTop17: boolean;
  highlightExpectedLoss?: boolean;
  highlightOpenPosition?: boolean;
  highlightLiquidated?: boolean;
}

export interface MilestoneReportData {
  earlySession: number; // Đầu phiên (5h-8h)
  asianSession: number; // Hết phiên Á (5h-16h)
  europeanSession: number; // Hết phiên Âu (5h-23h)
  americanSession: number | null; // Hết phiên Mỹ (cả ngày)
  isAmericanSessionPending?: boolean;
  uniqueAccounts?: {
    earlySession: number;
    asianSession: number;
    europeanSession: number;
    americanSession: number | null;
  };
}

export interface BgsMessagesData {
  session16h: string;
  session23h: string;
  sessionEod: string;
}

export interface QlgdMessagesData {
  sessionTitle: string;
  cqgSummary: string;
  acmSummary: string;
}

export interface ExecutiveRunItem {
  id: string;
  jobId: string;
  time: string;
  label: string;
  createdAt: string;
  status: string;
  triggerType: 'AUTO' | 'MANUAL';
  triggerLabel: string;
  hasDiscrepancy: boolean;
  totalDSGD?: number;
  totalNano?: number;
  cutoffTime?: string;
}

export interface QlgdDashboardResponse {
  sessionDate: string;
  scope: 'ALL' | 'ACM' | 'OTHERS';
  catalogScope?: 'TOP17' | 'ALL';
  hasActualFiles: boolean;
  dataSource: 'DIRECT_API' | 'BACKUP_FILES' | 'MOCK';
  latestMetrics: {
    acm: {
      klgd: number;
      gtgdStr: string;
      gtgdVnd: number;
    };
    others: {
      klgd: number;
      gtgdStr: string;
      gtgdVnd: number;
    };
  };
  milestones: {
    acm: MilestoneReportData;
    others: MilestoneReportData;
    uniqueAccounts: {
      earlySession: number;
      asianSession: number;
      europeanSession: number;
      americanSession: number | null;
      at16h: number;
      at23h: number;
      atEod: number;
    };
  };
  bgsMessages: BgsMessagesData;
  qlgdMessages: QlgdMessagesData;
  items: CommodityDashboardItem[];
  totals: {
    expectedPnL: number;
    openPositions: number;
    realizedPnL: number;
    liquidatedLots: number;
    avgLongRatio: number;
    avgShortRatio: number;
  };
  runs?: ExecutiveRunItem[];
  currentJobId?: string | null;
  isViewingHistorical?: boolean;
}


/**
 * Xác định xem ngày giao dịch có thuộc giờ Mùa Hè (Daylight Saving Time) của Sở Mỹ không.
 * Giờ mùa hè bắt đầu từ Chủ nhật thứ 2 của tháng 3 đến Chủ nhật đầu tiên của tháng 11.
 */
function isSummerTradingSeason(dateStr: string): boolean {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const marchFirst = new Date(y, 2, 1);
    const marchSecondSunday = 1 + ((7 - marchFirst.getDay() + 7) % 7) + 7;
    const novFirst = new Date(y, 10, 1);
    const novFirstSunday = 1 + ((7 - novFirst.getDay() + 7) % 7);
    const summerStart = new Date(y, 2, marchSecondSunday);
    const summerEnd = new Date(y, 10, novFirstSunday);
    return dt >= summerStart && dt < summerEnd;
  } catch {
    return true; // Mặc định giờ mùa Hè
  }
}

/**
 * Trích xuất giờ trong ngày dạng số thực (ví dụ 14h30 -> 14.5) từ chuỗi thời gian khớp lệnh.
 */
function parseTradeHour(ngayGioStr: string): number | null {
  if (!ngayGioStr) return null;
  const str = String(ngayGioStr).trim();
  const timeMatch = str.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return null;
  const h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const s = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
  return h + m / 60 + s / 3600;
}

/**
 * Phân bổ thời gian khớp lệnh vào 4 chu kỳ phiên giao dịch chuẩn (khớp 100% cột AG sheet DSGD MS).
 */
function getSessionBucket(hourFloat: number, isSummer: boolean): 'EARLY' | 'ASIA' | 'EURO' | 'US' {
  const startHour = isSummer ? 5 : 6;
  if (hourFloat >= startHour && hourFloat < 8) return 'EARLY';
  if (hourFloat >= 8 && hourFloat <= 16) return 'ASIA';
  if (hourFloat > 16 && hourFloat <= 23) return 'EURO';
  return 'US';
}

function parseTradeDateTime(tradeTimeStr: string, sessionDate: string): Date | null {
  if (!tradeTimeStr) return null;
  const str = String(tradeTimeStr).trim();
  // Case 1: DD/MM/YYYY HH:mm(:ss)
  const dmyMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dmyMatch) {
    const [, d, m, y, h, min, s = '0'] = dmyMatch;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}+07:00`);
  }
  // Case 2: YYYY-MM-DD(THH:mm:ss)
  const ymdMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[\sT]+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (ymdMatch) {
    const [, y, m, d, h, min, s = '0'] = ymdMatch;
    return new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}+07:00`);
  }
  // Case 3: HH:mm(:ss)
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    const [, h, min, s = '0'] = timeMatch;
    return new Date(`${sessionDate}T${h.padStart(2, '0')}:${min.padStart(2, '0')}:${s.padStart(2, '0')}+07:00`);
  }
  return null;
}

function formatNumber(val: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(val || 0));
}

@Injectable()
export class QlgdDashboardService {
  private readonly logger = new Logger(QlgdDashboardService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly valueStatsService: ValueStatisticsService,
    @Optional() private readonly msApiAdapter?: MsApiAdapter,
    @Optional() private readonly coreCcpApiAdapter?: CoreCcpApiAdapter,
    @Optional() @InjectModel(BotJob.name) private readonly botJobModel?: Model<BotJob>,
  ) {}


  /**
   * Kích hoạt tải dữ liệu tươi từ API Ingress của MS và CoreCCP
   */
  async syncFreshDataFromApis(targetDateStr?: string): Promise<{ success: boolean; message: string }> {
    const today = new Date();
    let targetDate = targetDateStr;
    if (!targetDate) {
      const vnTime = new Date(today.getTime() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    const [year, month, day] = targetDate.split('-');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting('bot_backup_path_ms', ''),
    );
    const tradingCheckBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck'),
    );
    const msTradingDailyPath = path.join(tradingCheckBase, subFolder);

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpTradingDailyPath = path.join(
      resolveStoragePathCrossPlatform(rawCcpBase).replace(/Backup CCP/i, 'TradingCheck/CCP'),
      subFolder,
    );

    // Đảm bảo thư mục TradingCheck tồn tại trước khi tải
    if (!fs.existsSync(msTradingDailyPath)) {
      fs.mkdirSync(msTradingDailyPath, { recursive: true });
    }
    if (!fs.existsSync(ccpTradingDailyPath)) {
      fs.mkdirSync(ccpTradingDailyPath, { recursive: true });
    }

    const tasks: Promise<any>[] = [];

    // Tải M-System qua API trực tiếp vào thư mục kiểm tra trong phiên TradingCheck
    if (this.msApiAdapter) {
      tasks.push(
        this.msApiAdapter
          .download('MS', {
            reportCodes: ['DSGD', 'TTM', 'TTTT'],
            targetDirectory: msTradingDailyPath,
          })
          .catch((e) => this.logger.warn(`API MS Download: ${e.message}`)),
      );
    }

    // Tải CoreCCP qua API trực tiếp vào thư mục kiểm tra trong phiên TradingCheck
    if (this.coreCcpApiAdapter) {
      tasks.push(
        this.coreCcpApiAdapter
          .download('CORE_CCP', {
            reportCodes: ['DSGD_CCP', 'TTM_CCP', 'TTTT'],
            targetDirectory: ccpTradingDailyPath,
          })
          .catch((e) => this.logger.warn(`API CCP Download: ${e.message}`)),
      );
    }

    await Promise.allSettled(tasks);
    return { success: true, message: `Đã hoàn tất đồng bộ dữ liệu tươi từ API cho ngày ${targetDate}` };
  }

  /**
   * Tổng hợp dữ liệu thực tế cho Dashboard QLGD từ M-System và CoreCCP (khớp 100% Check BGS All.xlsm)
   */
  async getExecutiveDashboard(
    targetDateStr?: string,
    scope: 'ALL' | 'ACM' | 'OTHERS' = 'ALL',
    catalogScope: 'TOP17' | 'ALL' = 'TOP17',
    refreshFromApi = false,
    jobId?: string,
  ): Promise<QlgdDashboardResponse> {
    const today = new Date();
    let targetDate = targetDateStr;
    if (!targetDate) {
      const vnTime = new Date(today.getTime() + 7 * 3600 * 1000);
      targetDate = vnTime.toISOString().split('T')[0];
    }

    let runs: ExecutiveRunItem[] = [];
    let selectedJob: any = null;
    let isViewingHistorical = false;

    if (this.botJobModel) {
      const dayStartVN = new Date(`${targetDate}T00:00:00.000+07:00`);
      const dayEndVN = new Date(`${targetDate}T23:59:59.999+07:00`);
      const dayStartUTC = new Date(`${targetDate}T00:00:00.000Z`);
      const dayEndUTC = new Date(`${targetDate}T23:59:59.999Z`);
      const minDate = new Date(Math.min(dayStartVN.getTime(), dayStartUTC.getTime()));
      const maxDate = new Date(Math.max(dayEndVN.getTime(), dayEndUTC.getTime()));

      const parts = targetDate.split('-');
      const slashDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : targetDate;

      const dateFilterCondition = {
        $or: [
          { createdAt: { $gte: minDate, $lte: maxDate } },
          { 'payload.targetDate': { $in: [targetDate, slashDate] } },
          { 'payload.sessionDay': { $in: [targetDate, slashDate] } },
          { 'payload.shiftDate': { $in: [targetDate, slashDate] } },
          { 'payload.date': { $in: [targetDate, slashDate] } },
        ],
      };

      try {
        const pastJobs = await this.botJobModel
          .find({
            jobType: { $in: ['CHECK_KLGD', 'CHECK_PRE_EOD'] },
            ...dateFilterCondition,
          })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean()
          .exec();

        if (Array.isArray(pastJobs) && pastJobs.length > 0) {
          runs = pastJobs.map((j: any) => {
            const payload = j.payload
              ? typeof j.payload.toObject === 'function' ? j.payload.toObject() : j.payload
              : {};
            const res = payload.result || {};
            const totals = res.totals || {};
            const isManual = payload.isManual || j.triggerType === 'MANUAL' || j.triggeredBy === 'MANUAL' || payload.options?.bypassCooldown;
            const trigger = isManual ? 'Thủ công' : 'Tự động';
            const created = new Date(j.createdAt);
            const vnDate = new Date(created.getTime() + 7 * 3600 * 1000);
            const timeStr = `${String(vnDate.getUTCHours()).padStart(2, '0')}:${String(vnDate.getUTCMinutes()).padStart(2, '0')}:${String(vnDate.getUTCSeconds()).padStart(2, '0')}`;
            const differ = (totals.differ || 0) + (totals.differACM || 0);

            return {
              id: String(j._id || j.jobId),
              jobId: String(j._id || j.jobId),
              time: timeStr,
              label: `${String(vnDate.getUTCDate()).padStart(2, '0')}/${String(vnDate.getUTCMonth() + 1).padStart(2, '0')} ${timeStr}`,
              createdAt: created.toISOString(),
              status: j.status,
              triggerType: isManual ? 'MANUAL' : 'AUTO',
              triggerLabel: trigger,
              hasDiscrepancy: differ > 0,
              totalDSGD: totals.totalDSGD || 0,
              totalNano: totals.totalNano || 0,
              cutoffTime: res.cutoffTime || j.createdAt,
            };
          });
        }

        if (jobId) {
          selectedJob = pastJobs.find((j: any) => String(j._id) === jobId || String(j.jobId) === jobId);
          if (!selectedJob) {
            try {
              selectedJob = await this.botJobModel.findById(jobId).lean().exec();
            } catch {
              // ignore invalid ObjectId
            }
          }
          if (selectedJob && runs.length > 0 && String(selectedJob._id) !== runs[0].id) {
            isViewingHistorical = true;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Lỗi khi truy vấn bot_jobs cho Dashboard: ${err.message}`);
      }
    }


    const [year, month, day] = targetDate.split('-');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    // Đường dẫn thư mục kiểm tra trong phiên (TradingCheck) và backup M-System / CoreCCP
    const msBackupBase = resolveStoragePathCrossPlatform(
      await this.settingsService.getSetting('bot_backup_path_ms', ''),
    );
    const tradingCheckBase = resolveStoragePathCrossPlatform(
      (await this.settingsService.getSetting('bot_trading_check_path', '')) ||
        msBackupBase.replace(/Backup MS[\\/]Futures/i, 'TradingCheck/Futures').replace(/Backup MS/i, 'TradingCheck'),
    );

    const msTradingDailyPath = path.join(tradingCheckBase, subFolder);
    const msDailyPath = msBackupBase ? path.join(msBackupBase, subFolder) : '';

    const rawCcpBase = await getCcpBackupBasePath(this.settingsService);
    const ccpTradingDailyPath = path.join(
      resolveStoragePathCrossPlatform(rawCcpBase).replace(/Backup CCP/i, 'TradingCheck/CCP'),
      subFolder,
    );
    const ccpDailyPath = resolveCcpDailyPath(subFolder, rawCcpBase);

    if (refreshFromApi) {
      await this.syncFreshDataFromApis(targetDate);
    }

    this.logger.log(`[QlgdDashboard] Truy vấn dữ liệu phiên ${targetDate} tại MS Check: ${msTradingDailyPath} | Backup: ${msDailyPath} | CCP Check: ${ccpTradingDailyPath} | Backup: ${ccpDailyPath}`);

    // Cơ chế phân giải đường dẫn kép: Ưu tiên đọc từ thư mục kiểm tra trong phiên (TradingCheck), nếu chưa có mới fallback sang Backup
    const resolvePriorityFile = (primaryDir: string, fallbackDir: string, pattern: RegExp): string => {
      if (primaryDir && fs.existsSync(primaryDir)) {
        const found = findLatestFile(primaryDir, pattern);
        if (found && fs.existsSync(found)) return found;
      }
      if (fallbackDir && fs.existsSync(fallbackDir)) {
        const found = findLatestFile(fallbackDir, pattern);
        if (found && fs.existsSync(found)) return found;
      }
      return '';
    };

    let ttmRows: ExecutiveTtmRow[] = [];
    let ttttRows: ExecutiveTtttRow[] = [];
    let dsgdRows: any[] = [];

    let ccpTtmRows: Array<{ account: string; symbol: string; tongMua: number; tongBan: number; expectedPnLVnd: number }> = [];
    let ccpTtttRows: Array<{ account: string; symbol: string; liquidatedLots: number; realizedPnLVnd: number }> = [];
    let ccpDsgdRows: any[] = [];

    let hasActualFiles = false;

    // 1. Đọc dữ liệu M-System
    const ttmPath = resolvePriorityFile(msTradingDailyPath, msDailyPath, /TTM.*\.xlsx$/i);
    const ttttPath = resolvePriorityFile(msTradingDailyPath, msDailyPath, /TTTT.*\.xlsx$/i);
    const dsgdPath = resolvePriorityFile(msTradingDailyPath, msDailyPath, /DSGD.*\.xlsx$/i);

    if (ttmPath && fs.existsSync(ttmPath)) {
      try {
        const buf = fs.readFileSync(ttmPath);
        ttmRows = parseTTMForExecutive(buf);
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file TTM MS: ${e.message}`);
      }
    }

    if (ttttPath && fs.existsSync(ttttPath)) {
      try {
        const buf = fs.readFileSync(ttttPath);
        ttttRows = parseTTTTForExecutive(buf);
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file TTTT MS: ${e.message}`);
      }
    }

    if (dsgdPath && fs.existsSync(dsgdPath)) {
      try {
        const buf = fs.readFileSync(dsgdPath);
        dsgdRows = parseDSGD(buf);
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file DSGD MS: ${e.message}`);
      }
    }

    // 2. Đọc dữ liệu CoreCCP
    const ccpTtmPath = resolvePriorityFile(ccpTradingDailyPath, ccpDailyPath, /TTM.*\.xlsx$/i);
    const ccpTtttPath = resolvePriorityFile(ccpTradingDailyPath, ccpDailyPath, /TTTT.*\.xlsx$/i);
    const ccpDsgdPath = resolvePriorityFile(ccpTradingDailyPath, ccpDailyPath, /DSGD.*\.xlsx$/i);

    if (ccpTtmPath && fs.existsSync(ccpTtmPath)) {
      try {
        const buf = fs.readFileSync(ccpTtmPath);
        ccpTtmRows = CcpExcelParser.parseCcpTTMForExecutive(buf);
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file TTM CCP: ${e.message}`);
      }
    }

    if (ccpTtttPath && fs.existsSync(ccpTtttPath)) {
      try {
        const buf = fs.readFileSync(ccpTtttPath);
        ccpTtttRows = CcpExcelParser.parseCcpTTTTForExecutive(buf);
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file TTTT CCP: ${e.message}`);
      }
    }

    if (ccpDsgdPath && fs.existsSync(ccpDsgdPath)) {
      try {
        const buf = fs.readFileSync(ccpDsgdPath);
        const parsed = CcpExcelParser.parseDSGD(buf);
        ccpDsgdRows = parsed.records;
        hasActualFiles = true;
      } catch (e: any) {
        this.logger.warn(`Lỗi khi đọc file DSGD CCP: ${e.message}`);
      }
    }

    // 3. Gom danh sách khớp lệnh từ cả MS và CoreCCP
    interface UnifiedTrade {
      account: string;
      symbol: string;
      lot: number;
      price: number;
      timeStr: string;
      source: 'MS' | 'CCP';
    }

    let unifiedTrades: UnifiedTrade[] = [];

    for (const r of dsgdRows) {
      unifiedTrades.push({
        account: r.maTKGD || '',
        symbol: r.maHD || '',
        lot: Number(r.klGiaoDich) || 0,
        price: Number(r.giaKhop) || 0,
        timeStr: r.ngayGio || '',
        source: 'MS',
      });
    }

    for (const r of ccpDsgdRows) {
      unifiedTrades.push({
        account: r.soTK || '',
        symbol: r.maHD || '',
        lot: Number(r.klKhop) || 0,
        price: Number(r.giaKhop) || 0,
        timeStr: r.thoiGianKhop || '',
        source: 'CCP',
      });
    }

    // Nếu đang xem một lượt trong quá khứ, lọc các giao dịch xảy ra trước hoặc tại thời điểm cutoff của lượt đó
    if (isViewingHistorical && selectedJob) {
      const jobCutoffStr = selectedJob.payload?.result?.cutoffTime || selectedJob.createdAt;
      const jobCutoff = jobCutoffStr ? new Date(jobCutoffStr) : null;
      if (jobCutoff && !isNaN(jobCutoff.getTime())) {
        unifiedTrades = unifiedTrades.filter((t) => {
          const dt = parseTradeDateTime(t.timeStr, targetDate);
          if (!dt) return true;
          return dt.getTime() <= jobCutoff.getTime();
        });
      }
    }

    // Lọc theo Scope nếu người dùng yêu cầu (ALL / ACM / OTHERS)
    let filteredTrades = unifiedTrades;
    if (scope === 'ACM') {
      filteredTrades = unifiedTrades.filter((t) => isAcm(t.account));
    } else if (scope === 'OTHERS') {
      filteredTrades = unifiedTrades.filter((t) => !isAcm(t.account));
    }


    // 4. Phân loại 4 mốc thời điểm và tính số tài khoản duy nhất (UNIQUE Accounts)
    const isSummer = isSummerTradingSeason(targetDate);
    const startHour = isSummer ? 5 : 6;

    let acmKlgd = 0;
    let othersKlgd = 0;
    let acmGtgdVnd = 0;
    let othersGtgdVnd = 0;

    let acmEarly = 0;
    let acmAsia = 0;
    let acmEuro = 0;
    let acmUs = 0;

    let othersEarly = 0;
    let othersAsia = 0;
    let othersEuro = 0;
    let othersUs = 0;

    // Các rổ tài khoản duy nhất theo phiên cho ACM & Others
    const acmEarlyAccs = new Set<string>();
    const acmAsiaAccs = new Set<string>();
    const acmEuroAccs = new Set<string>();
    const acmUsAccs = new Set<string>();

    const othersEarlyAccs = new Set<string>();
    const othersAsiaAccs = new Set<string>();
    const othersEuroAccs = new Set<string>();
    const othersUsAccs = new Set<string>();

    // Đếm các mặt hàng tiêu điểm cho tin nhắn Room QLGD
    let pleLot = 0;
    let sieLot = 0;
    let cpeLot = 0;
    let lrcLot = 0;
    let si5coLot = 0;
    let pl1nyLot = 0;
    let cp2coLot = 0;

    // Loại hình giao dịch: Spreads, LME, Options
    let spreadsLot = 0;
    let lmeLot = 0;
    let optionsLot = 0;

    for (const trade of filteredTrades) {
      const isAccountAcm = isAcm(trade.account);
      const lot = trade.lot;
      const price = trade.price;
      const estimatedValueVnd = lot * price * 25400;

      const hourFloat = parseTradeHour(trade.timeStr);
      const baseSym = extractCcpBaseProduct(trade.symbol);

      // Thống kê mặt hàng tiêu điểm
      if (baseSym === 'PLE') pleLot += lot;
      if (baseSym === 'SIE') sieLot += lot;
      if (baseSym === 'CPE') cpeLot += lot;
      if (baseSym === 'LRC') lrcLot += lot;
      if (baseSym === 'SI5CO') si5coLot += lot;
      if (baseSym === 'PL1NY') pl1nyLot += lot;
      if (baseSym === 'CP2CO') cp2coLot += lot;

      if (isSpread(trade.account)) spreadsLot += lot;
      if (isLme(trade.account)) lmeLot += lot;
      if (isOptions(trade.symbol)) optionsLot += lot;

      if (isAccountAcm) {
        acmKlgd += lot;
        acmGtgdVnd += estimatedValueVnd;

        if (hourFloat !== null) {
          const bucket = getSessionBucket(hourFloat, isSummer);
          if (bucket === 'EARLY') {
            acmEarly += lot;
            acmEarlyAccs.add(trade.account);
          } else if (bucket === 'ASIA') {
            acmAsia += lot;
            acmAsiaAccs.add(trade.account);
          } else if (bucket === 'EURO') {
            acmEuro += lot;
            acmEuroAccs.add(trade.account);
          } else if (bucket === 'US') {
            acmUs += lot;
            acmUsAccs.add(trade.account);
          }
        } else {
          acmEuro += lot;
          acmEuroAccs.add(trade.account);
        }
      } else {
        othersKlgd += lot;
        othersGtgdVnd += estimatedValueVnd;

        if (hourFloat !== null) {
          const bucket = getSessionBucket(hourFloat, isSummer);
          if (bucket === 'EARLY') {
            othersEarly += lot;
            othersEarlyAccs.add(trade.account);
          } else if (bucket === 'ASIA') {
            othersAsia += lot;
            othersAsiaAccs.add(trade.account);
          } else if (bucket === 'EURO') {
            othersEuro += lot;
            othersEuroAccs.add(trade.account);
          } else if (bucket === 'US') {
            othersUs += lot;
            othersUsAccs.add(trade.account);
          }
        } else {
          othersEuro += lot;
          othersEuroAccs.add(trade.account);
        }
      }
    }

    // Kiểm tra cờ chưa qua 23h
    const now = new Date();
    const vnNowHour = (now.getUTCHours() + 7) % 24 + now.getUTCMinutes() / 60;
    const vnTodayStr = new Date(now.getTime() + 7 * 3600 * 1000).toISOString().split('T')[0];
    const isToday = targetDate === vnTodayStr;
    const isAmericanSessionPending = isToday && (vnNowHour >= startHour && vnNowHour < 23);

    // Tính lũy kế khối lượng qua các mốc (Cumulative)
    const acmEarlyCum = acmEarly;
    const acmAsiaCum = acmEarlyCum + acmAsia;
    const acmEuroCum = acmAsiaCum + acmEuro;
    const acmUsCum = acmEuroCum + acmUs;

    const othersEarlyCum = othersEarly;
    const othersAsiaCum = othersEarlyCum + othersAsia;
    const othersEuroCum = othersAsiaCum + othersEuro;
    const othersUsCum = othersEuroCum + othersUs;

    // Tính số tài khoản duy nhất lũy kế (Mảng LET UNIQUE khớp 100% Excel Col E)
    const acmEarlyAccCount = acmEarlyAccs.size;
    const acmAsiaAccCount = new Set([...acmEarlyAccs, ...acmAsiaAccs]).size;
    const acmEuroAccCount = new Set([...acmEarlyAccs, ...acmAsiaAccs, ...acmEuroAccs]).size;
    const acmUsAccCount = new Set([...acmEarlyAccs, ...acmAsiaAccs, ...acmEuroAccs, ...acmUsAccs]).size;

    const othersEarlyAccCount = othersEarlyAccs.size;
    const othersAsiaAccCount = new Set([...othersEarlyAccs, ...othersAsiaAccs]).size;
    const othersEuroAccCount = new Set([...othersEarlyAccs, ...othersAsiaAccs, ...othersEuroAccs]).size;
    const othersUsAccCount = new Set([...othersEarlyAccs, ...othersAsiaAccs, ...othersEuroAccs, ...othersUsAccs]).size;

    // Số tài khoản tổng theo mốc tin nhắn BGS
    const accountsAt16h = acmAsiaAccCount + othersAsiaAccCount;
    const accountsAt23h = acmEuroAccCount + othersEuroAccCount;
    const accountsAtEod = acmUsAccCount + othersUsAccCount;

    const acmMilestones: MilestoneReportData = {
      earlySession: acmEarlyCum,
      asianSession: acmAsiaCum,
      europeanSession: acmEuroCum,
      americanSession: isAmericanSessionPending ? acmEuroCum : acmUsCum,
      isAmericanSessionPending,
      uniqueAccounts: {
        earlySession: acmEarlyAccCount,
        asianSession: acmAsiaAccCount,
        europeanSession: acmEuroAccCount,
        americanSession: isAmericanSessionPending ? acmEuroAccCount : acmUsAccCount,
      },
    };

    const othersMilestones: MilestoneReportData = {
      earlySession: othersEarlyCum,
      asianSession: othersAsiaCum,
      europeanSession: othersEuroCum,
      americanSession: isAmericanSessionPending ? othersEuroCum : othersUsCum,
      isAmericanSessionPending,
      uniqueAccounts: {
        earlySession: othersEarlyAccCount,
        asianSession: othersAsiaAccCount,
        europeanSession: othersEuroAccCount,
        americanSession: isAmericanSessionPending ? othersEuroAccCount : othersUsAccCount,
      },
    };

    // 5. Sinh 3 mẫu tin nhắn tự động chuẩn cho Ban Giám Sát và Room QLGD
    const [tY, tM, tD] = targetDate.split('-');
    const formattedVnDate = `${tD}/${tM}/${tY}`;
    const shortVnDate = `${tD}/${tM}`;

    const total16h = acmAsiaCum + othersAsiaCum;
    const total23h = acmEuroCum + othersEuroCum;
    const totalEod = acmUsCum + othersUsCum;

    const bgsMessages: BgsMessagesData = {
      session16h: `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 16:00 phiên ${formattedVnDate} ạ. Tổng khối lượng giao dịch đạt ${formatNumber(total16h)} lot, với Futures là ${formatNumber(othersAsiaCum)} lot và ACM là ${formatNumber(acmAsiaCum)} lot.\nTới thời điểm này có ${formatNumber(accountsAt16h)} tài khoản phát sinh giao dịch ạ.`,
      session23h: `Em xin phép báo cáo các anh khối lượng giao dịch tính tới 23:00 phiên ${formattedVnDate} ạ. Tổng khối lượng giao dịch đạt ${formatNumber(total23h)} lot, với Futures là ${formatNumber(othersEuroCum)} lot và ACM là ${formatNumber(acmEuroCum)} lot.\nTới thời điểm này có ${formatNumber(accountsAt23h)} tài khoản phát sinh giao dịch ạ.`,
      sessionEod: `Em xin phép báo cáo các anh khối lượng giao dịch phiên ${formattedVnDate} ạ. Tổng khối lượng giao dịch đạt ${formatNumber(totalEod)} lot, với Futures là ${formatNumber(othersUsCum)} lot và ACM là ${formatNumber(acmUsCum)} lot.\nTrong phiên có ${formatNumber(accountsAtEod)} tài khoản phát sinh giao dịch ạ.`,
    };

    const qlgdMessages: QlgdMessagesData = {
      sessionTitle: `Phiên ${shortVnDate}:`,
      cqgSummary: `CQG: ${formatNumber(othersUsCum)} lot - ${formatNumber(pleLot)} lot Bạch kim - ${formatNumber(sieLot)} lot Bạc - ${formatNumber(cpeLot)} lot Đồng - ${formatNumber(lrcLot)} lot LRC - ${formatNumber(spreadsLot)} lot Spreads - ${formatNumber(lmeLot)} lot LME - ${formatNumber(optionsLot)} lot Options`,
      acmSummary: `ACM: ${formatNumber(acmUsCum)} lot - ${formatNumber(si5coLot)} lot Bạc Nano - ${formatNumber(pl1nyLot)} lot Bạch kim Nano - ${formatNumber(cp2coLot)} lot Đồng Nano`,
    };

    // 6. Gom nhóm 44 mặt hàng phái sinh từ cả M-System và CoreCCP
    const productAggregation = new Map<
      string,
      {
        longLots: number;
        shortLots: number;
        expectedPnL: number;
        liquidatedLots: number;
        realizedPnL: number;
      }
    >();

    // Khởi tạo trước 44 mặt hàng
    for (const item of BGS_COMMODITY_METADATA_44) {
      productAggregation.set(item.symbol, {
        longLots: 0,
        shortLots: 0,
        expectedPnL: 0,
        liquidatedLots: 0,
        realizedPnL: 0,
      });
    }

    // =========================================================================
    // CẤU HÌNH NGUỒN TÍNH VỊ THẾ MỞ (TTM) & LÃI LỖ DỰ KIẾN (PnL UNREALIZED):
    // -------------------------------------------------------------------------
    // - CHUẨN NGHIỆP VỤ MỚI (Mặc định: INCLUDE_MS_TTM = false):
    //   CoreCCP hiện là Trung tâm Bù trừ & Ký quỹ tập trung duy nhất của MXV.
    //   Toàn bộ vị thế mở (Open Interest) được quản lý trên CoreCCP.
    //   Chỉ lấy dữ liệu từ CoreCCP ('TTM CCP') để phản ánh chính xác và tránh bị
    //   nhân đôi số liệu (double counting) do cộng thêm M-System.
    //   (Nếu CoreCCP chưa có dữ liệu, hệ thống tự động fallback sang MS để không bị trống).
    //
    // - LOGIC CŨ THEO FILE EXCEL GỐC Check BGS All.xlsm Sheet 2 (INCLUDE_MS_TTM = true):
    //   Giai đoạn chuyển đổi (migration), Excel cộng cả 2 nguồn:
    //   =SUMIFS('TTM MS'!N:N...) + SUMIFS('TTM CCP'!I:I...)
    //   Được lưu trữ nguyên vẹn bên dưới để phục vụ tra cứu hoặc kích hoạt lại khi cần.
    // =========================================================================
    const INCLUDE_MS_TTM = false;

    if (INCLUDE_MS_TTM) {
      // ── LOGIC CŨ (LƯU TRỮ NGUYÊN BẢN): CỘNG GỘP CẢ M-SYSTEM VÀ CORECCP ──
      // 1. Tích lũy TTM M-System (loại trừ tài khoản tận cùng A cho PnL theo chuẩn Sheet 2)
      for (const row of ttmRows) {
        const baseSym = extractCcpBaseProduct(row.symbol);
        const curr = productAggregation.get(baseSym) || {
          longLots: 0,
          shortLots: 0,
          expectedPnL: 0,
          liquidatedLots: 0,
          realizedPnL: 0,
        };

        const isAccountAcm = isAcm(row.account);
        curr.longLots += row.tongMua;
        curr.shortLots += row.tongBan;
        if (!isAccountAcm) {
          curr.expectedPnL += row.expectedPnLVnd;
        }
        productAggregation.set(baseSym, curr);
      }

      // 2. Tích lũy TTM CoreCCP
      for (const row of ccpTtmRows) {
        const baseSym = extractCcpBaseProduct(row.symbol);
        const curr = productAggregation.get(baseSym) || {
          longLots: 0,
          shortLots: 0,
          expectedPnL: 0,
          liquidatedLots: 0,
          realizedPnL: 0,
        };

        curr.longLots += row.tongMua;
        curr.shortLots += row.tongBan;
        curr.expectedPnL += row.expectedPnLVnd;
        productAggregation.set(baseSym, curr);
      }
    } else {
      // ── LOGIC MỚI: CHỈ TÍNH TRÊN CORECCP (100% CORECCP, TUYỆT ĐỐI KHÔNG FALLBACK SANG MS) ──
      // Theo chỉ đạo của USER: Nếu CoreCCP chưa có dữ liệu TTM thì để 0, tuyệt đối không fallback sang MS.
      for (const row of ccpTtmRows) {
        const baseSym = extractCcpBaseProduct(row.symbol);
        const curr = productAggregation.get(baseSym) || {
          longLots: 0,
          shortLots: 0,
          expectedPnL: 0,
          liquidatedLots: 0,
          realizedPnL: 0,
        };

        curr.longLots += row.tongMua;
        curr.shortLots += row.tongBan;
        curr.expectedPnL += row.expectedPnLVnd;
        productAggregation.set(baseSym, curr);
      }

      /*
      // [ARCHIVED - ĐÃ VÔ HIỆU HÓA THEO CHỈ ĐẠO USER] Tuyệt đối không fallback sang M-System
      if (ccpTtmRows.length === 0 && ttmRows.length > 0) {
        this.logger.log(`Fallback M-System đã bị vô hiệu hóa.`);
      }
      */
    }

    // Tích lũy TTTT M-System
    for (const row of ttttRows) {
      const baseSym = extractCcpBaseProduct(row.symbol);
      const curr = productAggregation.get(baseSym) || {
        longLots: 0,
        shortLots: 0,
        expectedPnL: 0,
        liquidatedLots: 0,
        realizedPnL: 0,
      };

      curr.liquidatedLots += row.liquidatedLots;
      curr.realizedPnL += row.realizedPnLVnd;
      productAggregation.set(baseSym, curr);
    }

    // Tích lũy TTTT CoreCCP
    for (const row of ccpTtttRows) {
      const baseSym = extractCcpBaseProduct(row.symbol);
      const curr = productAggregation.get(baseSym) || {
        longLots: 0,
        shortLots: 0,
        expectedPnL: 0,
        liquidatedLots: 0,
        realizedPnL: 0,
      };

      curr.liquidatedLots += row.liquidatedLots;
      curr.realizedPnL += row.realizedPnLVnd;
      productAggregation.set(baseSym, curr);
    }

    // 7. Xây dựng danh sách 44 mặt hàng
    const allItems: CommodityDashboardItem[] = [];

    for (const meta of BGS_COMMODITY_METADATA_44) {
      const data = productAggregation.get(meta.symbol) || {
        longLots: 0,
        shortLots: 0,
        expectedPnL: 0,
        liquidatedLots: 0,
        realizedPnL: 0,
      };

      const totalOpen = data.longLots + data.shortLots;
      const longRatio = totalOpen > 0 ? Math.round((data.longLots / totalOpen) * 100) : 0;
      const shortRatio = totalOpen > 0 ? 100 - longRatio : 0;

      allItems.push({
        stt: meta.stt,
        category: meta.category,
        symbol: meta.symbol,
        name: meta.nameVn,
        expectedPnL: Math.round(data.expectedPnL),
        openPositions: totalOpen,
        longRatio,
        shortRatio,
        realizedPnL: Math.round(data.realizedPnL),
        liquidatedLots: data.liquidatedLots,
        isTop17: meta.isTop17,
        highlightExpectedLoss: meta.symbol === 'SI5CO' && data.expectedPnL < 0,
        highlightOpenPosition: meta.symbol === 'SI5CO' && totalOpen > 1000,
        highlightLiquidated: (meta.symbol === 'ZME' || meta.symbol === 'SI5CO') && data.liquidatedLots > 500,
      });
    }

    // Sắp xếp: Ưu tiên hiển thị 17 mặt hàng chủ lực lên trước theo thứ tự BGS_TOP_17_SYMBOLS
    allItems.sort((a, b) => {
      const idxA = BGS_TOP_17_SYMBOLS.indexOf(a.symbol);
      const idxB = BGS_TOP_17_SYMBOLS.indexOf(b.symbol);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.stt - b.stt;
    });

    allItems.forEach((it, idx) => {
      it.stt = idx + 1;
    });

    // Tính toán Tổng chân trang
    const totals = allItems.reduce(
      (acc, it) => {
        acc.expectedPnL += it.expectedPnL;
        acc.openPositions += it.openPositions;
        acc.realizedPnL += it.realizedPnL;
        acc.liquidatedLots += it.liquidatedLots;
        return acc;
      },
      {
        expectedPnL: 0,
        openPositions: 0,
        realizedPnL: 0,
        liquidatedLots: 0,
        avgLongRatio: 78,
        avgShortRatio: 22,
      },
    );

    let totalLongLots = 0;
    for (const it of allItems) totalLongLots += it.openPositions * (it.longRatio / 100);
    if (totals.openPositions > 0) {
      totals.avgLongRatio = Math.round((totalLongLots / totals.openPositions) * 100);
      totals.avgShortRatio = 100 - totals.avgLongRatio;
    }

    const formatGtgdStr = (vnd: number): string => {
      if (vnd === 0) return '0 đ';
      const ty = vnd / 1_000_000_000;
      return `${ty.toFixed(1)} tỷ`;
    };

    return {
      sessionDate: targetDate,
      scope,
      catalogScope,
      hasActualFiles,
      dataSource: hasActualFiles ? 'DIRECT_API' : 'MOCK',
      latestMetrics: {
        acm: {
          klgd: acmKlgd,
          gtgdStr: formatGtgdStr(acmGtgdVnd),
          gtgdVnd: acmGtgdVnd,
        },
        others: {
          klgd: othersKlgd,
          gtgdStr: formatGtgdStr(othersGtgdVnd),
          gtgdVnd: othersGtgdVnd,
        },
      },
      milestones: {
        acm: acmMilestones,
        others: othersMilestones,
        uniqueAccounts: {
          earlySession: acmEarlyAccCount + othersEarlyAccCount,
          asianSession: acmAsiaAccCount + othersAsiaAccCount,
          europeanSession: acmEuroAccCount + othersEuroAccCount,
          americanSession: isAmericanSessionPending ? acmEuroAccCount + othersEuroAccCount : acmUsAccCount + othersUsAccCount,
          at16h: accountsAt16h,
          at23h: accountsAt23h,
          atEod: accountsAtEod,
        },
      },
      bgsMessages,
      qlgdMessages,
      items: allItems,
      totals,
      runs,
      currentJobId: jobId || (runs.length > 0 ? runs[0].id : null),
      isViewingHistorical,
    };
  }
}

