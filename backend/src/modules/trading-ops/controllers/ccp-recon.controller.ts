import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Req,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import { BotJobQueueService } from '../../checklist-hub/queue/bot-job-queue.service';
import { BotJob } from '../../../schemas/bot-job.schema';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { CcpLotStatisticsService } from '../services/statistics/ccp-lot-statistics.service';
import { CcpStatisticsService } from '../services/statistics/ccp-statistics.service';
import { CcpAdHocStatisticsService } from '../services/statistics/ccp-adhoc-statistics.service';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CcpCeScraperService, IngressService } from '../../ingress';
import { decrypt } from '../../../shared';
import {
  resolveTradingSessionDate,
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
} from '../../../shared/helpers/file-path.helper';

import { ValueStatisticsService } from '../services/statistics/value-statistics.service';
import { CeCcpGttCheckerService } from '../services/recon/ce-ccp-gtt.service';
import { CcpAccumulatorService } from '../services/statistics/ccp-accumulator.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';
import { TradingOpsPreflightService } from '../services/console/trading-ops-preflight.service';

/**
 * Controller chuyên biệt quản lý toàn bộ nghiệp vụ Bù trừ CoreCCP & Thống kê Lot/Value trong Trading Ops
 * Tích hợp toàn bộ API tỷ giá, bóc tách số liệu CoreCCP, đối soát GTT CE-CCP và tra cứu nhật ký bù trừ CCP.
 * Tương thích ngược toàn diện với các route cũ của ccp-statistics.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller([
  'api/v1/ccp-clearing',
  'api/v1/ccp-statistics',
  'ccp-statistics',
  'api/v1/reconciliation',
  'reconciliation',
  'api/v1/bot-engine',
])
export class CcpReconController {
  private readonly logger = new Logger(CcpReconController.name);

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly settingsService: SystemSettingsService,
    private readonly ccpCeDownloaderService: CcpCeScraperService,
    private readonly ceCcpGttService: CeCcpGttCheckerService,
    private readonly ccpAccumulatorService: CcpAccumulatorService,
    private readonly ccpLotStatisticsService: CcpLotStatisticsService,
    private readonly ccpStatisticsService: CcpStatisticsService,
    private readonly ccpAdHocStatisticsService: CcpAdHocStatisticsService,
    private readonly preflightService: TradingOpsPreflightService,
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel: Model<CcpClearingLog>,
    @Optional()
    private readonly ingressService?: IngressService,
    @Optional()
    @Inject(forwardRef(() => BotJobQueueService))
    private readonly botJobQueueService?: BotJobQueueService,
    @Optional()
    @InjectModel(BotJob.name)
    private readonly botJobModel?: Model<BotJob>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. QUẢN LÝ BẢNG TỶ GIÁ BÙ TRỪ CORECCP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Lấy danh sách bảng tỷ giá quy đổi Bù trừ CoreCCP hiện hành
   */
  @Get('exchange-rates')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getExchangeRates() {
    try {
      const rates = await this.valueStatisticsService.getCurrentExchangeRates();
      return { success: true, rates };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy tỷ giá: ${err.message}`);
    }
  }

  /**
   * Đồng bộ và làm mới bảng tỷ giá quy đổi từ tệp CoreCCP (/SYSCONFIGMNG/CURRENCYEXCHANGERATE - Tỷ giá CCP.xlsx).
   * Hỗ trợ đồng bộ tức thì qua Direct REST API hoặc đọc từ thư mục backup ngày.
   */
  @Post(['lot-statistics/sync-exchange-rate', 'sync-ccp-exchange-rates', 'sync-ccp-exchange-rate'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async syncExchangeRates(@Body() body?: { date?: string }) {
    try {
      const targetDate = body?.date || new Date().toISOString().split('T')[0];
      const detailsToSave: Record<string, any> = {};
      let source = '';

      // 1. Xác định thư mục backup ngày của CoreCCP
      let backupPath = await this.settingsService.getSetting('bot_backup_path_ccp', '');
      if (!backupPath) {
        backupPath = path.join(process.cwd(), 'data', 'backup', 'CCP');
      }
      const sessionStartStr = await this.settingsService.getSetting('session_start_time', '05:00');
      const { dateObj } = resolveTradingSessionDate(targetDate, { sessionStartStr });
      const { fullPath: dailyPath } = resolveDailySubfolder(backupPath, dateObj);
      const resolvedBackupPath = resolveStoragePathCrossPlatform(backupPath);
      const scanDir = fs.existsSync(dailyPath) ? dailyPath : resolvedBackupPath;

      let tyGiaFilePath = '';
      if (fs.existsSync(scanDir)) {
        const files = fs.readdirSync(scanDir);
        const match = files.find((f) => /^(?:Tỷ\s*giá.*ccp|TYGIA|Tỷ\s*giá).*\.xlsx$/i.test(f));
        if (match) {
          tyGiaFilePath = path.join(scanDir, match);
        }
      }

      // 2. Nếu chưa có file tỷ giá và có IngressService: Kích hoạt tải tức thì qua Direct REST API
      if (!tyGiaFilePath && this.ingressService) {
        try {
          this.logger.log(`[CcpReconController] Chưa có file tỷ giá tại ${scanDir}, gọi IngressService tải TYGIA...`);
          const ingressRes = await this.ingressService.download('CCP', {
            targetDirectory: scanDir,
            reportCodes: ['TYGIA'],
            targetDate,
          });
          if (ingressRes.success && ingressRes.files.length > 0) {
            tyGiaFilePath = ingressRes.files[0].absolutePath;
          }
        } catch (ingressErr: any) {
          this.logger.warn(`[CcpReconController] Lỗi khi gọi IngressService tải TYGIA: ${ingressErr.message}`);
        }
      }

      // 3. Đọc và bóc tách ma trận đa nguyên tệ từ file Excel
      if (tyGiaFilePath && fs.existsSync(tyGiaFilePath)) {
        try {
          const buf = fs.readFileSync(tyGiaFilePath);
          const wb = XLSX.read(buf, { type: 'buffer' });
          const sheetName = wb.SheetNames[0];
          if (sheetName) {
            const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
            for (const row of rows) {
              const curr = (
                row.BASECURRENCY ||
                row['Nguyên tệ'] ||
                row['Tiền tệ'] ||
                row['Mã tiền tệ'] ||
                row.CURRENCY ||
                row.Currency ||
                ''
              )
                .toString()
                .trim()
                .toUpperCase();
              if (!curr || curr === 'VND') continue;
              const normalizedCurr = curr === 'CNY' ? 'RMB' : curr;
              const convRate = parseFloat(
                String(row.EXCHANGERATE || row['Tỷ giá quy đổi'] || row['Tỷ giá'] || row.RATE || 0).replace(/,/g, ''),
              );
              if (isNaN(convRate) || convRate <= 0) continue;
              const buyRate =
                parseFloat(String(row.BUYRATE || row['Tỷ giá Mua'] || convRate).replace(/,/g, '')) || convRate;
              const sellRate =
                parseFloat(String(row.SELLRATE || row['Tỷ giá Bán'] || convRate).replace(/,/g, '')) || convRate;
              const effDate = (row.CREATEDDATE || row.LASTCHANGE || targetDate).toString().trim();

              detailsToSave[normalizedCurr] = {
                currencyCode: normalizedCurr,
                conversionRate: convRate,
                buyRate,
                sellRate,
                effectiveDate: effDate.split(' ')[0] || targetDate,
              };
            }
            if (Object.keys(detailsToSave).length > 0) {
              source = `Tệp ${path.basename(tyGiaFilePath)} (CoreCCP /SYSCONFIGMNG/CURRENCYEXCHANGERATE)`;
            }
          }
        } catch (parseErr: any) {
          this.logger.warn(`[CcpReconController] Không thể parse tệp tỷ giá ${tyGiaFilePath}: ${parseErr.message}`);
        }
      }

      // 4. Cập nhật vào MongoDB settings
      const nowIso = new Date().toISOString();
      let updatedMatrix: Record<string, any> = {};
      try {
        const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '{}');
        updatedMatrix = JSON.parse(matrixStr || '{}');
      } catch {
        updatedMatrix = {};
      }

      if (Object.keys(detailsToSave).length > 0) {
        for (const [code, item] of Object.entries(detailsToSave)) {
          updatedMatrix[code] = item;
        }
        if (detailsToSave['USD']?.conversionRate) {
          await this.settingsService.setSetting('ccp_usd_exchange_rate', String(detailsToSave['USD'].conversionRate));
        }
        if (detailsToSave['JPY']?.conversionRate) {
          await this.settingsService.setSetting('ccp_jpy_exchange_rate', String(detailsToSave['JPY'].conversionRate));
        }
        if (detailsToSave['MYR']?.conversionRate) {
          await this.settingsService.setSetting('ccp_myr_exchange_rate', String(detailsToSave['MYR'].conversionRate));
        }
        const rmbRate = detailsToSave['RMB']?.conversionRate;
        if (rmbRate) {
          await this.settingsService.setSetting('ccp_rmb_exchange_rate', String(rmbRate));
        }
        await this.settingsService.setSetting('ccp_exchange_rates_matrix', JSON.stringify(updatedMatrix));
        await this.settingsService.setSetting('ccp_rates_last_synced', nowIso);
        await this.settingsService.setSetting('exchange_rates_last_synced', nowIso);
        await this.settingsService.setSetting('exchange_rate_source', source);
      }

      const usdRateStr =
        (await this.settingsService.getSetting('ccp_usd_exchange_rate', '')) ||
        (await this.settingsService.getSetting('usd_exchange_rate', '25400'));
      const usdRate = parseFloat(usdRateStr) || (detailsToSave['USD']?.conversionRate ?? 25400);
      const rates = await this.valueStatisticsService.getCurrentExchangeRates();

      const currenciesSynced =
        Object.keys(detailsToSave).length > 0
          ? Object.keys(detailsToSave).join(', ')
          : Object.keys(updatedMatrix).join(', ') || 'USD';

      return {
        success: true,
        data: {
          usdRate,
          matrix: updatedMatrix,
          source: source || 'CSDL Cấu hình CoreCCP',
          lastSynced: nowIso,
        },
        rates,
        usdRate,
        message: `Đã cập nhật bảng ma trận tỷ giá CoreCCP (${currenciesSynced}) thành công.`,
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể đồng bộ tỷ giá CoreCCP: ${err.message}`);
    }
  }

  /**
   * Tải lên riêng file Excel tỷ giá và tự động cập nhật vào CSDL MongoDB
   */
  @Post(['lot-statistics/upload-tygia', 'upload-tygia'])
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(FileInterceptor('file'))
  async uploadTyGiaFile(@UploadedFile() file: any) {
    if (!file || !file.buffer) {
      throw new BadRequestException('Vui lòng chọn file tỷ giá.');
    }
    try {
      const buf = file.buffer;
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new BadRequestException('File tỷ giá rỗng hoặc không đúng định dạng Excel.');

      const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
      const detailsToSave: Record<string, any> = {};
      const nowIso = new Date().toISOString();

      for (const row of rows) {
        const curr = (
          row.BASECURRENCY ||
          row['Nguyên tệ'] ||
          row['Tiền tệ'] ||
          row['Mã tiền tệ'] ||
          row.CURRENCY ||
          row.Currency ||
          ''
        )
          .toString()
          .trim()
          .toUpperCase();
        if (!curr || curr === 'VND') continue;
        const normalizedCurr = curr === 'CNY' ? 'RMB' : curr;
        const convRate = parseFloat(
          String(row.EXCHANGERATE || row['Tỷ giá quy đổi'] || row['Tỷ giá'] || row.RATE || 0).replace(/,/g, ''),
        );
        if (isNaN(convRate) || convRate <= 0) continue;
        const buyRate =
          parseFloat(String(row.BUYRATE || row['Tỷ giá Mua'] || convRate).replace(/,/g, '')) || convRate;
        const sellRate =
          parseFloat(String(row.SELLRATE || row['Tỷ giá Bán'] || convRate).replace(/,/g, '')) || convRate;
        const effDate = (row.CREATEDDATE || row.LASTCHANGE || nowIso).toString().trim();

        detailsToSave[normalizedCurr] = {
          currencyCode: normalizedCurr,
          conversionRate: convRate,
          buyRate,
          sellRate,
          effectiveDate: effDate.split(' ')[0] || nowIso.split('T')[0],
        };
      }

      if (Object.keys(detailsToSave).length === 0) {
        throw new BadRequestException('Không tìm thấy dòng tỷ giá hợp lệ nào trong file tải lên.');
      }

      let matrix: Record<string, any> = {};
      try {
        const matrixStr = await this.settingsService.getSetting('ccp_exchange_rates_matrix', '{}');
        matrix = JSON.parse(matrixStr || '{}');
      } catch {
        matrix = {};
      }

      for (const [code, item] of Object.entries(detailsToSave)) {
        matrix[code] = item;
      }

      if (detailsToSave['USD']?.conversionRate) {
        await this.settingsService.setSetting('ccp_usd_exchange_rate', String(detailsToSave['USD'].conversionRate));
      }
      if (detailsToSave['JPY']?.conversionRate) {
        await this.settingsService.setSetting('ccp_jpy_exchange_rate', String(detailsToSave['JPY'].conversionRate));
      }
      if (detailsToSave['MYR']?.conversionRate) {
        await this.settingsService.setSetting('ccp_myr_exchange_rate', String(detailsToSave['MYR'].conversionRate));
      }
      const rmbRate = detailsToSave['RMB']?.conversionRate;
      if (rmbRate) {
        await this.settingsService.setSetting('ccp_rmb_exchange_rate', String(rmbRate));
      }
      await this.settingsService.setSetting('ccp_exchange_rates_matrix', JSON.stringify(matrix));
      await this.settingsService.setSetting('ccp_rates_last_synced', nowIso);
      await this.settingsService.setSetting('exchange_rates_last_synced', nowIso);
      await this.settingsService.setSetting('exchange_rate_source', `Tệp tải lên: ${file.originalname || 'tygia.xlsx'}`);

      return {
        success: true,
        data: {
          usdRate: detailsToSave['USD']?.conversionRate || 25400,
          matrix,
          source: `Tệp tải lên: ${file.originalname || 'tygia.xlsx'}`,
          lastSynced: nowIso,
        },
        message: `Đã bóc tách và lưu tỷ giá (${Object.keys(detailsToSave).join(', ')}) vào CSDL thành công!`,
      };
    } catch (err: any) {
      throw new BadRequestException(`Lỗi bóc tách file tỷ giá: ${err.message}`);
    }
  }

  /**
   * Lấy tỷ giá USD quy đổi Bù trừ CoreCCP hiện hành
   */
  @Get('usd-rate')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getUsdRate() {
    try {
      const usdRateStr =
        (await this.settingsService.getSetting('ccp_usd_exchange_rate', '')) ||
        (await this.settingsService.getSetting('usd_exchange_rate', '25400'));
      const rate = parseFloat(usdRateStr) || 25400;
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy tỷ giá USD Bù trừ: ${err.message}`);
    }
  }

  /**
   * Làm mới tỷ giá USD Bù trừ CoreCCP từ CSDL cấu hình
   */
  @Post('sync-usd-rate')
  @Permissions('ACCESS_AUTO_SHIFT')
  async syncUsdRate() {
    try {
      const usdRateStr =
        (await this.settingsService.getSetting('ccp_usd_exchange_rate', '')) ||
        (await this.settingsService.getSetting('usd_exchange_rate', '25400'));
      const rate = parseFloat(usdRateStr) || 25400;
      return { success: true, rate, message: 'Làm mới tỷ giá USD Bù trừ thành công.' };
    } catch (err: any) {
      throw new BadRequestException(`Không thể làm mới tỷ giá USD: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. TẢI VÀ BÓC TÁCH CHỈ SỐ METRICS CORECCP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Tải riêng 3 file CoreCCP (DSGD, TTM, TTTT) và bóc tách trực tiếp số liệu KLGD, TTM, TTTT
   */
  @Post('download-ccp-metrics')
  @Permissions('ACCESS_AUTO_SHIFT')
  async downloadCcpMetrics(@Body('date') dateStr?: string) {
    try {
      let tradingDate = new Date();
      if (dateStr) {
        if (dateStr.includes('/')) {
          const [d, m, y] = dateStr.split('/');
          tradingDate = new Date(`${y}-${m}-${d}`);
        } else if (dateStr.includes('-')) {
          tradingDate = new Date(dateStr);
        }
      }

      const day = String(tradingDate.getDate()).padStart(2, '0');
      const month = String(tradingDate.getMonth() + 1).padStart(2, '0');
      const year = tradingDate.getFullYear().toString();
      const formattedDate = `${day}/${month}/${year}`;

      const credRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
      if (!credRaw) {
        throw new Error('Chưa cấu hình tài khoản CoreCCP (bot_credentials_ccp) trong System Settings');
      }

      let creds: any;
      try {
        creds = JSON.parse(decrypt(credRaw));
      } catch (e: any) {
        throw new Error(`Lỗi giải mã thông tin tài khoản CoreCCP: ${e.message}`);
      }

      const targetDir = path.join(process.cwd(), 'temp', 'ccp_metrics', `${year}-${month}-${day}`);
      fs.mkdirSync(targetDir, { recursive: true });

      const session = await this.ccpCeDownloaderService.prepareKlgdSession({
        systemUrl: creds.url,
        username: creds.username,
        password: creds.password,
        tradingDate: formattedDate,
        outputDir: targetDir,
        options: {
          headless: true,
          overwriteExisting: true,
        },
      });

      const dsgdPath = await session.triggerExportDsgd();
      const remaining = await session.downloadRemainingAndExtract(dsgdPath || undefined);
      await session.close().catch(() => {});

      return {
        success: true,
        tradingDate: formattedDate,
        metrics: remaining.metrics,
        files: remaining.files,
      };
    } catch (err: any) {
      throw new BadRequestException(`Lỗi bóc tách số liệu CoreCCP: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. ĐỐI SOÁT GTT (GIÁ THANH TOÁN) CE VS CCP
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt đối soát GTT giữa CoreEX (CE) và CoreCCP (VNCLEAR).
   */
  @Post('run-ce-ccp-gtt-check')
  async runCeCcpGttCheck(
    @Body()
    body: {
      targetDate?: string;
      filterOpen?: boolean;
      async?: boolean;
      autoDownload?: boolean;
      forceDownload?: boolean;
      ceGttPath?: string;
      ccpGttPath?: string;
      ceHhPath?: string;
      ccpHhPath?: string;
      shiftLogId?: string;
    } = {},
    @Req() req?: any,
  ) {
    if (this.ceCcpGttService.getIsRunning()) {
      return {
        success: true,
        isRunning: true,
        message: 'Tiến trình đối soát GTT CE-CCP đang chạy ngầm trên hệ thống.',
        report: this.ceCcpGttService.getLatestReport(),
      };
    }

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('CHECK_GTT_CE_CCP', {
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.id || req?.user?.userId,
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: 'Đã đưa yêu cầu đối soát GTT CE-CCP vào hàng đợi xử lý.',
          report: this.ceCcpGttService.getLatestReport(),
        };
      }

      this.ceCcpGttService.runCeCcpGttCheck(body).catch((err) => {
        this.logger.error(`[Background CE-CCP GTT Check] Lỗi: ${err.message}`, err.stack);
      });
      return {
        success: true,
        isRunning: true,
        message: 'Đã khởi động tiến trình đối soát GTT CE-CCP ngầm.',
        report: this.ceCcpGttService.getLatestReport(),
      };
    }

    try {
      const report = await this.ceCcpGttService.runCeCcpGttCheck(body);
      return { success: true, isRunning: false, report };
    } catch (err: any) {
      throw new HttpException(
        `Đối soát GTT CE-CCP thất bại: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Lấy báo cáo đối soát GTT CE-CCP gần nhất hoặc theo ngày.
   */
  @Get('ce-ccp-gtt-report')
  async getCeCcpGttReport(
    @Query('date') dateQuery?: string,
    @Query('jobId') jobIdQuery?: string,
  ) {
    // 1. Kiểm tra Job đang chạy trong bot_jobs nếu có
    if (this.botJobModel) {
      const activeJob = jobIdQuery
        ? await this.botJobModel.findById(jobIdQuery).exec()
        : await this.botJobModel
            .findOne({
              jobType: 'CHECK_GTT_CE_CCP',
              status: { $in: ['PENDING', 'PROCESSING'] },
            })
            .sort({ createdAt: -1 })
            .exec();

      if (activeJob) {
        return {
          success: true,
          isRunning: true,
          jobId: activeJob._id,
          status: activeJob.status,
          currentLogs: activeJob.logs || [],
          report: null,
        };
      }
    }

    // 2. Trả về kết quả từ service / cache
    const report = this.ceCcpGttService.getLatestReport();
    const isRunning = this.ceCcpGttService.getIsRunning();
    const currentLogs = this.ceCcpGttService.getCurrentLogs();

    if (isRunning) {
      return { success: true, isRunning: true, currentLogs, report: null };
    }

    if (!report) {
      // 3. Phục hồi kết quả từ Job gần nhất nếu service vừa restart
      if (this.botJobModel) {
        const latestDoneJob = await this.botJobModel
          .findOne({ jobType: 'CHECK_GTT_CE_CCP', status: 'COMPLETED' })
          .sort({ createdAt: -1 })
          .exec();
        if (latestDoneJob && (latestDoneJob.payload as any)?.result) {
          return {
            success: true,
            isRunning: false,
            currentLogs: latestDoneJob.logs || [],
            report: (latestDoneJob.payload as any).result,
          };
        }
      }

      return {
        success: false,
        isRunning: false,
        currentLogs: [],
        report: null,
        message: 'Chưa có báo cáo GTT CE-CCP nào. Hãy chạy đối soát trước.',
      };
    }

    return { success: true, isRunning: false, currentLogs, report };
  }

  /**
   * Xuất file Excel báo cáo đối soát GTT CE-CCP hoặc file điều chỉnh giá.
   */
  @Get('ce-ccp-gtt-report/export')
  async exportCeCcpGttReport(
    @Query('type') type: 'report' | 'correction' = 'report',
    @Res() res: Response,
  ) {
    try {
      let buffer: Buffer;
      let filename: string;
      const dateStr =
        this.ceCcpGttService.getLatestReport()?.targetDate ||
        new Date().toISOString().split('T')[0];

      if (type === 'correction') {
        buffer = this.ceCcpGttService.generateCorrectionExcelBuffer();
        filename = `Dieu_Chinh_GTT_CE_CCP_${dateStr}.xlsx`;
      } else {
        buffer = this.ceCcpGttService.generateReportExcelBuffer();
        filename = `Bao_Cao_CheckGTT_CE_CCP_${dateStr}.xlsx`;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err: any) {
      throw new HttpException(
        `Không thể xuất file GTT CE-CCP: ${err.message || 'Lỗi không xác định'}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. NHẬT KÝ BÙ TRỪ CORECCP (CCP CLEARING LOGS)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Tra cứu chi tiết một bản ghi nhật ký bù trừ CCP theo ID
   */
  @Get('logs/:id')
  async getLogById(@Param('id') id: string) {
    const log = await this.ccpLogModel.findById(id).lean().exec();
    if (!log) {
      throw new NotFoundException(`Không tìm thấy nhật ký bù trừ CCP ID: ${id}`);
    }
    return {
      success: true,
      data: log,
    };
  }

  /**
   * Tra cứu danh sách nhật ký bù trừ CCP theo ngày phiên (YYYY-MM-DD)
   */
  @Get('logs/by-date/:tradingDate')
  async getLogsByDate(@Param('tradingDate') tradingDate: string) {
    const logs = await this.ccpLogModel
      .find({ tradingDate })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return {
      success: true,
      count: logs.length,
      data: logs,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. QUẢN LÝ TEMPLATE EXCEL CORECCP & MỞ RỘNG CỘT (TVKD / HÀNG HÓA MỚI)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Kích hoạt mở rộng cột TVKD mới hoặc Hàng Hóa mới trên file Excel lũy kế CoreCCP
   * Tuân thủ thiết kế 1-Click Provisioning có kiểm soát (THIET_KE_MO_RONG_TVKD_VA_MA_HD_MOI_CORECCP.md)
   */
  @Post('templates/provision-column')
  @Permissions('ACCESS_AUTO_SHIFT')
  async provisionColumn(
    @Body()
    body: {
      filePath?: string;
      type: 'tvkd' | 'commodity';
      code: string;
      label: string;
      applyAll?: boolean;
      year?: string;
      customTargetRoot?: string;
      dryRun?: boolean;
    },
  ) {
    if (!body.code || !body.label || !body.type) {
      throw new BadRequestException('Bắt buộc phải cung cấp đầy đủ: type (tvkd | commodity), code, label');
    }

    if (body.type !== 'tvkd' && body.type !== 'commodity') {
      throw new BadRequestException("Tham số 'type' phải là 'tvkd' hoặc 'commodity'");
    }

    try {
      if (body.applyAll) {
        const results = await this.ccpAccumulatorService.provisionAllTemplates({
          year: body.year,
          customTargetRoot: body.customTargetRoot,
          type: body.type,
          code: body.code,
          label: body.label,
          dryRun: body.dryRun,
        });

        const successCount = results.filter((r) => r.result.success).length;
        return {
          success: successCount > 0,
          totalFiles: results.length,
          successCount,
          results,
          message: `Đã xử lý mở rộng cột ${body.type.toUpperCase()} '${body.code}' trên ${successCount}/${results.length} files template.`,
        };
      } else {
        if (!body.filePath) {
          throw new BadRequestException("Bắt buộc phải truyền 'filePath' khi không kích hoạt 'applyAll'");
        }

        const res = this.ccpAccumulatorService.provisionColumn({
          filePath: body.filePath,
          type: body.type,
          code: body.code,
          label: body.label,
          dryRun: body.dryRun,
        });

        if (!res.success) {
          throw new BadRequestException(res.message);
        }

        return res;
      }
    } catch (err: any) {
      throw new BadRequestException(`Lỗi mở rộng cột template: ${err.message}`);
    }
  }

  /**
   * Lấy danh sách các file template Excel CoreCCP lũy kế hiện có
   */
  @Get('templates/list')
  @Permissions('ACCESS_AUTO_SHIFT')
  async listTemplates(@Query('root') customRoot?: string) {
    try {
      const targetRoot = await this.ccpAccumulatorService.getTargetRoot(customRoot);
      if (!targetRoot || !fs.existsSync(targetRoot)) {
        return { success: true, targetRoot: '', files: [] };
      }

      const files: { name: string; relativePath: string; sizeBytes: number; modifiedAt: Date }[] = [];
      const scanDir = (dir: string, baseRel = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'Backup_Snapshots') continue;
          const fullPath = path.join(dir, entry.name);
          const relPath = path.join(baseRel, entry.name);
          if (entry.isDirectory()) {
            scanDir(fullPath, relPath);
          } else if (entry.isFile() && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls'))) {
            const stat = fs.statSync(fullPath);
            files.push({
              name: entry.name,
              relativePath: relPath,
              sizeBytes: stat.size,
              modifiedAt: stat.mtime,
            });
          }
        }
      };

      scanDir(targetRoot);
      return {
        success: true,
        targetRoot,
        totalFiles: files.length,
        files,
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy danh sách template: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH CORECCP (LOT & VALUE STATISTICS)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * GET lot-statistics/config
   * Lấy cấu hình đường dẫn file lũy kế + CCP API URL
   */
  @Get('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLotConfig() {
    return this.ccpLotStatisticsService.getConfig();
  }

  /**
   * POST lot-statistics/config
   * Lưu cấu hình đường dẫn file lũy kế + CCP API URL
   */
  @Post('lot-statistics/config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async saveLotConfig(@Body() config: any) {
    return this.ccpLotStatisticsService.saveConfig(config);
  }

  /**
   * GET lot-statistics/scan-daily?date=YYYY-MM-DD
   * Tự động quét thư mục backup theo ngày phiên để kiểm tra các file báo cáo CCP có sẵn.
   */
  @Get('lot-statistics/scan-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async scanDaily(@Query('date') date?: string) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    try {
      const scanResult = await this.ccpLotStatisticsService.scanDailyFiles(targetDate);
      return {
        success: true,
        data: scanResult,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi quét thư mục ngày: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST lot-statistics/process-daily
   * Tự động đọc các file trong thư mục ngày và tính toán thống kê số lot & GTGD.
   */
  @Post('lot-statistics/process-daily')
  @Permissions('ACCESS_AUTO_SHIFT')
  async processDaily(@Body() body: { date?: string }) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];
    try {
      const result = await this.ccpLotStatisticsService.processDailyFiles(targetDate);
      return {
        success: true,
        data: result,
        message: `Đã tính toán thành công từ thư mục backup ngày ${targetDate}`,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi xử lý file từ thư mục ngày: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST lot-statistics/run-lot
   * Tự động đọc file từ thư mục ngày, tính số lot và GHI TRỰC TIẾP vào 5 file Số Lot.
   */
  @Post('lot-statistics/run-lot')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runLotDirect(
    @Body() body: { date?: string; async?: boolean; shiftLogId?: string } = {},
    @Req() req?: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('RUN_LOT_MACRO', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu thống kê Số Lot CoreCCP ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const result = await this.ccpLotStatisticsService.runLotStatisticsDirect(targetDate, user);
      return result;
    } catch (err: any) {
      throw new HttpException(
        `Lỗi thống kê và ghi file Số Lot: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST lot-statistics/run-value
   * Tự động đọc file từ thư mục ngày, quy đổi tỷ giá và GHI TRỰC TIẾP vào 5 file Giá Trị.
   */
  @Post('lot-statistics/run-value')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runValueDirect(
    @Body() body: { date?: string; async?: boolean; shiftLogId?: string } = {},
    @Req() req?: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('RUN_VALUE_MACRO', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu thống kê Giá Trị CoreCCP ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const result = await this.ccpLotStatisticsService.runValueStatisticsDirect(targetDate, user);
      return result;
    } catch (err: any) {
      throw new HttpException(
        `Lỗi thống kê và ghi file Giá Trị: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST lot-statistics/run-macro
   * Tự động tổng hợp và GHI TRỰC TIẾP toàn bộ 11 file SỐ LOT & GIÁ TRỊ GIAO DỊCH (CoreCCP Macro).
   */
  @Post(['lot-statistics/run-macro', 'lot-statistics/run-all'])
  @Permissions('ACCESS_AUTO_SHIFT')
  async runMacroDirect(
    @Body() body: { date?: string; async?: boolean; shiftLogId?: string } = {},
    @Req() req?: any,
  ) {
    const targetDate = body?.date || new Date().toISOString().split('T')[0];

    if (body.async) {
      if (this.botJobQueueService) {
        const job = await this.botJobQueueService.enqueue('RUN_MACRO', {
          targetDate,
          ...body,
          scope: body.shiftLogId ? 'CHECKLIST' : 'OPERATION_TOOL',
          userId: req?.user?.userId || req?.user?.id || req?.user?._id,
          username: req?.user?.username || 'SYSTEM',
        });

        return {
          success: true,
          isRunning: true,
          jobId: job._id,
          message: `Đã đưa yêu cầu chạy Macro CoreCCP toàn diện ngày ${targetDate} vào hàng đợi xử lý.`,
        };
      }
    }

    try {
      const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
      const result = await this.ccpLotStatisticsService.runFullMacroStatisticsDirect(targetDate, user);
      return result;
    } catch (err: any) {
      throw new HttpException(
        `Lỗi chạy Macro CoreCCP: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET lot-statistics/run-history
   * Truy vấn danh sách lịch sử thực thi thống kê Số Lot & Giá Trị CoreCCP gần nhất
   */
  @Get('lot-statistics/run-history')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLotRunHistory(
    @Query('date') date?: string,
    @Query('limit') limit?: string,
  ) {
    const lim = limit ? Math.min(50, Math.max(1, parseInt(limit, 10))) : 20;
    return this.ccpLotStatisticsService.getRunHistory(date, lim);
  }

  /**
   * GET lot-statistics/latest-run
   * Truy vấn bản ghi chạy gần nhất (cho phiên giao dịch nếu chỉ định)
   */
  @Get('lot-statistics/latest-run')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getLatestLotRun(
    @Query('date') date?: string,
    @Query('jobId') jobIdQuery?: string,
  ) {
    if (this.botJobModel) {
      const activeJob = jobIdQuery
        ? await this.botJobModel.findById(jobIdQuery).exec()
        : await this.botJobModel
            .findOne({
              jobType: { $in: ['RUN_MACRO', 'RUN_LOT_MACRO', 'RUN_VALUE_MACRO', 'CCP_STATISTICS', 'CCP_LOT_STATS', 'CCP_VALUE_STATS'] },
              status: { $in: ['PENDING', 'PROCESSING'] },
            })
            .sort({ createdAt: -1 })
            .exec();

      if (activeJob) {
        return {
          success: true,
          isRunning: true,
          jobId: activeJob._id,
          status: activeJob.status,
          currentLogs: activeJob.logs || [],
          data: null,
        };
      }
    }

    const runs = await this.ccpLotStatisticsService.getRunHistory(date, 1);
    return runs.length > 0 ? runs[0] : null;
  }

  /**
   * GET lot-statistics/preflight
   * Kiểm tra thông tin các file sẽ chạy và kiểm tra đường dẫn lưu file có hợp lý không (CoreCCP)
   */
  @Get('lot-statistics/preflight')
  @Permissions('ACCESS_AUTO_SHIFT')
  async inspectPreFlight(
    @Query('date') date?: string,
    @Query('type') type?: 'LOT' | 'VALUE' | 'ALL',
  ) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    return this.preflightService.inspect({
      taskKey: 'CCP_STATISTICS',
      dateStr: targetDate,
      filterScope: type || 'ALL',
    });
  }

  /**
   * POST lot-statistics/write-accumulator
   * Ghi kết quả tổng hợp lot CCP vào file lũy kế Excel.
   */
  @Post('lot-statistics/write-accumulator')
  @Permissions('ACCESS_AUTO_SHIFT')
  async writeLotToAccumulator(@Body() body: any) {
    if (!body?.result) {
      throw new HttpException('Thiếu dữ liệu result trong body.', HttpStatus.BAD_REQUEST);
    }

    const config = await this.ccpLotStatisticsService.getConfig();
    const paths = {
      pathAcmLot: body.pathAcmLot || config.pathAcmLot || config.pathAcmCumulative || '',
      pathAcmGtgd: body.pathAcmGtgd || config.pathAcmGtgd || config.pathGtgdAcm || '',
      pathNormalLot: body.pathNormalLot || config.pathNormalLot || config.pathNormalCumulative || '',
      pathSpreadLot: body.pathSpreadLot || config.pathSpreadLot || config.pathSpreadCumulative || '',
      pathLmeLot: body.pathLmeLot || config.pathLmeLot || config.pathLmeCumulative || '',
      pathOptionsLot: body.pathOptionsLot || config.pathOptionsLot || config.pathOptionsCumulative || '',
      pathDsgdCumulative: body.pathDsgdCumulative || config.pathDsgdCumulative || '',
      pathGtgdNormal: body.pathGtgdNormal || config.pathGtgdNormal || '',
      pathGtgdSpread: body.pathGtgdSpread || config.pathGtgdSpread || '',
      pathGtgdLme: body.pathGtgdLme || config.pathGtgdLme || '',
      pathGtgdOptions: body.pathGtgdOptions || config.pathGtgdOptions || '',
    };

    const hasAnyPath = Object.values(paths).some((p) => p && String(p).trim().length > 0);
    if (!hasAnyPath) {
      throw new HttpException(
        'Chưa cấu hình bất kỳ đường dẫn file lũy kế nào. Vui lòng vào Cấu hình đường dẫn để thiết lập.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = {
      ...body.result,
      ngayGD: new Date(body.result.ngayGD),
    };

    const jobLogs: string[] = [];
    try {
      const writeResult = await this.ccpLotStatisticsService.writeToAccumulator(
        result,
        paths,
        undefined,
        jobLogs,
      );

      return {
        success: writeResult.errors.length === 0,
        lotUpdated: writeResult.lotUpdated,
        gtgdUpdated: writeResult.gtgdUpdated,
        errors: writeResult.errors,
        logs: jobLogs,
      };
    } catch (err: any) {
      throw new HttpException(
        `Lỗi ghi file lũy kế: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST lot-statistics (Upload file thủ công)
   */
  @Post('lot-statistics')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'dsgdMmCcp', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
      { name: 'tyGia', maxCount: 1 },
    ]),
  )
  async processLotStatistics(
    @UploadedFiles()
    files: {
      dsgdCcp?: any[];
      dsgdMmCcp?: any[];
      ttm?: any[];
      tttt?: any[];
      tyGia?: any[];
    },
    @Body('date') dateStr: string,
    @Body('hhOverrides') hhOverridesJson?: string,
  ) {
    if (!files.dsgdCcp?.[0]) {
      throw new HttpException(
        'Vui lòng tải lên file DSGD CCP (bắt buộc).',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!dateStr) {
      throw new HttpException(
        'Thiếu tham số date (YYYY-MM-DD).',
        HttpStatus.BAD_REQUEST,
      );
    }

    let hhOverrides: any[] | undefined;
    if (hhOverridesJson) {
      try {
        hhOverrides = JSON.parse(hhOverridesJson);
      } catch {
        throw new HttpException('hhOverrides JSON không hợp lệ.', HttpStatus.BAD_REQUEST);
      }
    }

    try {
      const result = await this.ccpLotStatisticsService.processCcpLotStatistics(
        {
          dsgdCcp: files.dsgdCcp[0].buffer,
          dsgdMmCcp: files.dsgdMmCcp?.[0]?.buffer,
          ttm: files.ttm?.[0]?.buffer,
          tttt: files.tttt?.[0]?.buffer,
          tyGia: files.tyGia?.[0]?.buffer,
        },
        {
          ngayGD: dateStr,
          hhOverrides,
        },
      );

      return result;
    } catch (err: any) {
      throw new HttpException(
        `Lỗi xử lý thống kê lot CCP: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6B. THỐNG KÊ CORECCP THEO KHOẢNG THỜI GIAN (BÁO CÁO ĐỘT XUẤT / AD-HOC RANGE)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * POST lot-statistics/run-adhoc-range
   * Kích hoạt toàn trình Thống kê CoreCCP theo Khoảng Thời Gian:
   * 1-Pass Aggregation từ 1 file DSGD CCP, nhân bản Master Template và ghi 1 dòng rõ nghĩa.
   */
  @Post('lot-statistics/run-adhoc-range')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runAdHocRange(
    @Body()
    body: {
      fromDate: string;
      toDate: string;
      scope?: 'ACM_ONLY' | 'ALL_PHASE2' | 'ALL';
      downloadFresh?: boolean;
      localDsgdFilePath?: string;
    },
    @Req() req: any,
  ) {
    if (!body?.fromDate || !body?.toDate) {
      throw new BadRequestException('Bắt buộc phải cung cấp đầy đủ fromDate và toDate');
    }
    const user = req?.user ? { id: req.user.userId || req.user._id, username: req.user.username } : undefined;
    return this.ccpAdHocStatisticsService.runAdHocRangeWorkflow(body, user);
  }

  /**
   * GET lot-statistics/adhoc-reports
   * Liệt kê danh sách các báo cáo đột xuất đã được sinh ra trong thư mục _AdHoc_Reports
   */
  @Get('lot-statistics/adhoc-reports')
  @Permissions('ACCESS_AUTO_SHIFT')
  async listAdHocReports() {
    return this.ccpAdHocStatisticsService.listAdHocReports();
  }

  /**
   * GET lot-statistics/download-adhoc
   * Tải tệp báo cáo Excel Template clone đã sinh
   */
  @Get('lot-statistics/download-adhoc')
  @Permissions('ACCESS_AUTO_SHIFT')
  async downloadAdHocReport(@Query('filename') filename: string, @Res() res: Response) {
    if (!filename) {
      throw new BadRequestException('Thiếu tham số filename');
    }
    const filePath = await this.ccpAdHocStatisticsService.getAdHocFilePath(filename);
    const safeName = path.basename(filePath);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(safeName)}"`,
    );
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. THỐNG KÊ CCP PILOT (BÁC BẮC)
  // ─────────────────────────────────────────────────────────────────────────────

  @Get('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getPilotConfig() {
    return this.ccpStatisticsService.getConfig();
  }

  @Post('config')
  @Permissions('ACCESS_AUTO_SHIFT')
  async savePilotConfig(@Body() config: any) {
    return this.ccpStatisticsService.saveConfig(config);
  }

  @Post('process')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'dsgdCcp', maxCount: 1 },
      { name: 'dsgdMmCcp', maxCount: 1 },
      { name: 'dstkgd', maxCount: 1 },
      { name: 'nr', maxCount: 1 },
      { name: 'ttm', maxCount: 1 },
      { name: 'tttt', maxCount: 1 },
    ]),
  )
  async processCcpPilot(
    @UploadedFiles()
    files: {
      dsgdCcp?: any[];
      dsgdMmCcp?: any[];
      dstkgd?: any[];
      nr?: any[];
      ttm?: any[];
      tttt?: any[];
    },
    @Body('date') dateStr: string,
    @Res() res: Response,
  ) {
    if (
      !files.dsgdCcp?.[0] ||
      !files.dsgdMmCcp?.[0] ||
      !files.dstkgd?.[0] ||
      !files.nr?.[0] ||
      !files.ttm?.[0] ||
      !files.tttt?.[0]
    ) {
      throw new HttpException(
        'Vui lòng tải lên đầy đủ 6 file Excel (DSGD CCP, DSGD MM CCP, DSTKGD, NR, TTM, TTTT).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const selectedDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(selectedDate.getTime())) {
      throw new HttpException('Ngày chọn không hợp lệ.', HttpStatus.BAD_REQUEST);
    }

    try {
      const outputPath = await this.ccpStatisticsService.processCcpData(
        {
          dsgdCcp: files.dsgdCcp[0].buffer,
          dsgdMmCcp: files.dsgdMmCcp[0].buffer,
          dstkgd: files.dstkgd[0].buffer,
          nr: files.nr[0].buffer,
          ttm: files.ttm[0].buffer,
          tttt: files.tttt[0].buffer,
        },
        selectedDate,
      );

      if (!fs.existsSync(outputPath)) {
        throw new HttpException('Không tìm thấy file kết quả.', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="Thong_ke_kich_ban_Pilot_Bac_Final.xlsx"',
      });

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
    } catch (err: any) {
      throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

