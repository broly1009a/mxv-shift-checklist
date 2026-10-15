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
} from '@nestjs/common';
import type { Response } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { CcpCeScraperService } from '../../ingress';
import { decrypt } from '../../../shared';

import { ValueStatisticsService } from '../services/value-statistics.service';
import { CeCcpGttCheckerService } from '../services/ce-ccp-gtt.service';
import { CcpAccumulatorService } from '../services/ccp-accumulator.service';
import { CcpClearingLog } from '../schemas/ccp-clearing-log.schema';

/**
 * Controller chuyên biệt quản lý toàn bộ nghiệp vụ Bù trừ CoreCCP & Thống kê Lot/Value trong Trading Ops
 * Tích hợp toàn bộ API tỷ giá, bóc tách số liệu CoreCCP, đối soát GTT CE-CCP và tra cứu nhật ký bù trừ CCP.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/ccp-clearing', 'api/v1/reconciliation', 'reconciliation'])
export class CcpReconController {
  private readonly logger = new Logger(CcpReconController.name);

  constructor(
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly settingsService: SystemSettingsService,
    private readonly ccpCeDownloaderService: CcpCeScraperService,
    private readonly ceCcpGttService: CeCcpGttCheckerService,
    private readonly ccpAccumulatorService: CcpAccumulatorService,
    @InjectModel(CcpClearingLog.name)
    private readonly ccpLogModel: Model<CcpClearingLog>,
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
   * Tải lại và làm mới bảng tỷ giá quy đổi Bù trừ CoreCCP từ CSDL cấu hình
   */
  @Post('sync-exchange-rates')
  @Permissions('ACCESS_AUTO_SHIFT')
  async syncExchangeRates() {
    try {
      const rates = await this.valueStatisticsService.getCurrentExchangeRates();
      const usdRateStr =
        (await this.settingsService.getSetting('ccp_usd_exchange_rate', '')) ||
        (await this.settingsService.getSetting('usd_exchange_rate', '25400'));
      const usdRate = parseFloat(usdRateStr) || 25400;
      return {
        success: true,
        rates,
        usdRate,
        message: 'Làm mới bảng tỷ giá Bù trừ CoreCCP thành công.',
      };
    } catch (err: any) {
      throw new BadRequestException(`Không thể làm mới tỷ giá Bù trừ: ${err.message}`);
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
    } = {},
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
  async getCeCcpGttReport(@Query('date') dateQuery?: string) {
    const report = this.ceCcpGttService.getLatestReport();
    const isRunning = this.ceCcpGttService.getIsRunning();
    const currentLogs = this.ceCcpGttService.getCurrentLogs();

    if (isRunning) {
      return { success: true, isRunning: true, currentLogs, report: null };
    }

    if (!report) {
      return {
        success: false,
        isRunning: false,
        currentLogs: [],
        report: null,
        message: 'Chưa có báo cáo GTT CE-CCP nào. Hãy bấm nút [Đối Chiếu GTT (CE vs CCP)] để chạy.',
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

        return {
          success: true,
          ...res,
        };
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
}

