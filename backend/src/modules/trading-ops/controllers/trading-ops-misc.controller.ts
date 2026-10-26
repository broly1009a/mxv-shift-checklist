/**
 * trading-ops-misc.controller.ts
 *
 * Controller chuyên trách Tỷ giá & Tiện ích Vận hành (Trading Ops Misc Domain).
 * Chuẩn Clean Architecture & Domain-Driven Design (DDD).
 */

import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Res,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';
import { MsEodReconService } from '../services/recon/ms-eod-recon.service';
import { ReconConsoleSummaryService } from '../services/console/recon-console-summary.service';
import { QlgdDashboardService } from '../services/console/qlgd-dashboard.service';
import { QlgdExcelExportService } from '../services/console/qlgd-excel-export.service';
import { TradingOpsPreflightService } from '../services/console/trading-ops-preflight.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class TradingOpsMiscController {
  private readonly logger = new Logger(TradingOpsMiscController.name);

  constructor(
    private readonly msEodReconService: MsEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly shiftsService: ShiftsService,
    private readonly settingsService: SystemSettingsService,
    private readonly qlgdDashboardService: QlgdDashboardService,
    private readonly qlgdExcelExportService: QlgdExcelExportService,
    private readonly preflightService: TradingOpsPreflightService,
  ) {}

  /**
   * Endpoint Kiểm Tra Tình Trạng Tệp & Đường Dẫn Tập Trung (Pre-Flight File Inspector).
   * Dùng chung cho toàn bộ phân hệ Trading Ops dựa theo TRADING_OPS_PREFLIGHT_REGISTRY.
   */
  @Get('preflight')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE', 'ACCESS_RECON_REPORTS')
  async inspectPreFlight(
    @Query('taskKey') taskKey: string,
    @Query('date') date: string,
    @Query('scope') scope?: 'LOT' | 'VALUE' | 'ALL',
  ) {
    if (!taskKey) {
      throw new BadRequestException('taskKey là bắt buộc (ví dụ: CE_STATISTICS, CCP_STATISTICS, CHECK_KLGD...)');
    }
    const targetDate = date || new Date().toISOString().slice(0, 10);
    return this.preflightService.inspect({
      taskKey,
      dateStr: targetDate,
      filterScope: scope || 'ALL',
    });
  }

  /**
   * Lấy danh mục tất cả các tác vụ trong Trading Ops hỗ trợ kiểm tra trước khi chạy
   */
  @Get('preflight/tasks')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE', 'ACCESS_RECON_REPORTS')
  async getPreflightTasks() {
    return {
      success: true,
      tasks: this.preflightService.getRegisteredTasks(),
    };
  }

  /**
   * Đồng bộ tỷ giá USD từ M-System.
   */
  @Post(['sync-usd-rate', 'sync-ms-usd-rate'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async syncUsdRate() {
    try {
      const rate = await this.reconConsoleSummaryService.syncUsdRateFromMSystem();
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể đồng bộ tỷ giá: ${err.message}`);
    }
  }

  /**
   * Đồng bộ toàn bộ tỷ giá đa tiền tệ từ M-System qua Direct REST API.
   */
  @Post(['sync-exchange-rates', 'sync-ms-exchange-rates', 'sync-ms-rate', 'ms/sync-exchange-rate'])
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async syncExchangeRates() {
    try {
      const res = await this.reconConsoleSummaryService.syncAllExchangeRatesFromMSystem();
      return { success: true, ...res };
    } catch (err: any) {
      throw new BadRequestException(`Không thể đồng bộ tỷ giá đa tiền tệ: ${err.message}`);
    }
  }

  /**
   * Lấy tỷ giá USD hiện hành.
   */
  @Get('usd-rate')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getUsdRate() {
    try {
      const rate = await this.reconConsoleSummaryService.getCurrentUsdRate();
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy tỷ giá: ${err.message}`);
    }
  }

  /**
   * Lấy toàn bộ bảng tỷ giá đa tiền tệ.
   */
  @Get('exchange-rates')
  @Permissions('ACCESS_AUTO_SHIFT', 'ACCESS_MARGIN_CHANGE')
  async getExchangeRates() {
    try {
      const rates = await this.reconConsoleSummaryService.getCurrentExchangeRates();
      return { success: true, rates };
    } catch (err: any) {
      throw new BadRequestException(`Không thể lấy tỷ giá đa tiền tệ: ${err.message}`);
    }
  }

  /**
   * Liệt kê các thư mục ngày mẫu từ BackupMS.
   */
  @Get('sample-dates')
  @Permissions('ACCESS_AUTO_SHIFT')
  async listSampleDates() {
    const baseBackupDir = path.join(
      process.cwd(),
      '..',
      'it-tool-src',
      'operate-transaction-app',
      'bin',
      'Debug',
      'Download',
      'BackupMS',
    );

    const dates: {
      label: string;
      samplePath: string;
      year: string;
      month: string;
      day: string;
    }[] = [];

    if (!fs.existsSync(baseBackupDir)) {
      return {
        success: false,
        message: 'Thư mục BackupMS không tồn tại',
        dates: [],
      };
    }

    try {
      const years = fs
        .readdirSync(baseBackupDir)
        .filter((y) => /^\d{4}$/.test(y));
      for (const year of years) {
        const yearPath = path.join(baseBackupDir, year);
        const months = fs
          .readdirSync(yearPath)
          .filter((m) => /^T\d{2}/.test(m));
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const days = fs
            .readdirSync(monthPath)
            .filter((d) => /^\d{2}\.\d{2}$/.test(d));
          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            const [dd, mm] = day.split('.');
            const label = `${dd}/${mm}/${year}`;
            dates.push({ label, samplePath: dayPath, year, month, day });
          }
        }
      }
      dates.sort((a, b) => {
        const da = `${a.year}-${a.day.split('.')[1]}-${a.day.split('.')[0]}`;
        const db = `${b.year}-${b.day.split('.')[1]}-${b.day.split('.')[0]}`;
        return db.localeCompare(da);
      });
      return { success: true, dates };
    } catch (err: any) {
      return { success: false, message: err.message, dates: [] };
    }
  }

  /**
   * Lấy tin nhắn cảnh báo đáo hạn hợp đồng thủ công từ ca trực.
   */
  @Get('maturity-manual-messages')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getMaturityManualMessages(@Query('shiftLogId') shiftLogId: string) {
    if (!shiftLogId) {
      throw new BadRequestException('Thiếu shiftLogId');
    }

    const log = await this.shiftsService.getShiftById(shiftLogId, {
      role: 'ADMIN',
    });
    if (!log) {
      throw new BadRequestException('Không tìm thấy ca trực');
    }

    const shiftDate = log.shiftDate;
    let formattedDate = '';
    if (shiftDate && shiftDate.includes('/')) {
      const [d, m, y] = shiftDate.split('/');
      formattedDate = `${y}-${m}-${d}`;
    } else if (shiftDate && shiftDate.includes('-')) {
      formattedDate = shiftDate;
    } else {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      formattedDate = `${yyyy}-${mm}-${dd}`;
    }

    const dailyTextPath = path.join(
      process.cwd(),
      'temp',
      'reconciliation',
      formattedDate,
      'teams_manual_messages.txt',
    );
    const dailyJsonPath = path.join(
      process.cwd(),
      'temp',
      'reconciliation',
      formattedDate,
      'teams_manual_messages.json',
    );

    let textContent = '';
    let jsonContent: any[] = [];

    if (fs.existsSync(dailyTextPath)) {
      textContent = fs.readFileSync(dailyTextPath, 'utf8');
    }

    if (fs.existsSync(dailyJsonPath)) {
      try {
        jsonContent = JSON.parse(fs.readFileSync(dailyJsonPath, 'utf8'));
      } catch (e) {}
    }

    return {
      success: true,
      shiftDate,
      formattedDate,
      textContent,
      jsonContent,
    };
  }

  /**
   * Lấy dữ liệu tổng hợp cho Màn hình Trading Operation Console.
   */
  @Get('console-summary')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getConsoleSummary(
    @Query('date') dateStr?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.reconConsoleSummaryService.getConsoleSummary(dateStr, jobId);
  }

  /**
   * Kích hoạt chạy lại đối chiếu ngay lập tức (Bypass Cooldown 60p).
   */
  @Post('trigger-console-run')
  @Permissions('ACCESS_AUTO_SHIFT')
  async triggerConsoleRun(
    @Body('date') dateStr?: string,
    @Body('jobType') jobType?: string,
    @Body('options')
    options?: {
      checkKlgd?: boolean;
      checkTtm?: boolean;
      checkTttt?: boolean;
    },
  ) {
    return this.reconConsoleSummaryService.triggerConsoleRun(dateStr, jobType, options);
  }

  /**
   * Kích hoạt đối chiếu chốt sổ EOD CoreCCP (CHECK_EOD_CCP).
   */
  @Post('check-eod-run')
  @Permissions('ACCESS_AUTO_SHIFT')
  async checkEodRun(
    @Body('sessionDate') sessionDate?: string,
    @Body('date') dateStr?: string,
  ) {
    return this.reconConsoleSummaryService.triggerConsoleRun(sessionDate || dateStr, 'CHECK_EOD_CCP');
  }

  /**
   * Kích hoạt đối soát Dsgd-Before-EOD CoreCCP ↔ CoreEX.
   */
  @Post('run-check-dsgd-before-eod')
  @Permissions('ACCESS_AUTO_SHIFT')
  async runCheckDsgdBeforeEod(
    @Body('sessionDate') sessionDate?: string,
    @Body('date') dateStr?: string,
  ) {
    return this.reconConsoleSummaryService.triggerConsoleRun(sessionDate || dateStr, 'CHECK_DSGD_BEFORE_EOD');
  }

  /**
   * Kích hoạt tải các báo cáo tùy chọn từ M-System hoặc CQG.
   */
  @Post('trigger-selective-backup')
  @Permissions('ACCESS_AUTO_SHIFT')
  async triggerSelectiveBackup(
    @Body('source') source: 'MS' | 'CQG',
    @Body('reports') reports: string[],
    @Body('sessionDate') sessionDate?: string,
  ) {
    if (!reports || reports.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 báo cáo để tải.');
    }
    return {
      success: true,
      message: `Đã tiếp nhận yêu cầu sao lưu ${reports.length} báo cáo ${source}.`,
      reports,
    };
  }

  /**
   * Tải riêng 3 file CoreCCP (DSGD, TTM, TTTT) và bóc tách trực tiếp số liệu KLGD, TTM, TTTT.
   */
  @Post('download-ccp-metrics')
  @Permissions('ACCESS_AUTO_SHIFT')
  async downloadCcpMetrics(@Body('date') dateStr?: string) {
    return this.reconConsoleSummaryService.downloadAndExtractCcpMetrics(dateStr);
  }

  /**
   * Lấy dữ liệu tổng hợp Dashboard QLGD phục vụ báo cáo Ban Giám Đốc.
   */
  @Get('executive-dashboard')
  @Permissions('ACCESS_AUTO_SHIFT')
  async getExecutiveDashboard(
    @Query('date') dateStr?: string,
    @Query('scope') scope: 'ALL' | 'ACM' | 'OTHERS' = 'ALL',
    @Query('catalogScope') catalogScope: 'TOP17' | 'ALL' = 'TOP17',
    @Query('refresh') refresh?: string,
    @Query('jobId') jobId?: string,
  ) {
    const shouldRefresh = refresh === 'true' || refresh === '1';
    return this.qlgdDashboardService.getExecutiveDashboard(dateStr, scope, catalogScope, shouldRefresh, jobId);
  }


  /**
   * Kích hoạt đồng bộ dữ liệu tươi từ API Ingress của MS và CoreCCP
   */
  @Post('sync-executive-dashboard')
  @Permissions('ACCESS_AUTO_SHIFT')
  async syncExecutiveDashboard(@Body('date') dateStr?: string) {
    return this.qlgdDashboardService.syncFreshDataFromApis(dateStr);
  }

  /**
   * Xuất file Excel báo cáo Ban Giám Đốc chuẩn template 1:1 từ Check BGS All.xlsm.
   */
  @Get('export-executive-dashboard')
  @Permissions('ACCESS_AUTO_SHIFT')
  async exportExecutiveDashboard(
    @Query('date') dateStr?: string,
    @Query('catalogScope') catalogScope: 'TOP17' | 'ALL' = 'TOP17',
    @Res() res?: any,
  ) {
    try {
      const buffer = await this.qlgdExcelExportService.generateExecutiveDashboardExcel(dateStr, catalogScope);
      const cleanDate = (dateStr || new Date().toISOString().split('T')[0]).replace(/-/g, '');
      const filename = `Bao_Cao_BGS_QLGD_${cleanDate}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      return res.end(buffer);
    } catch (err: any) {
      throw new BadRequestException(`Không thể xuất báo cáo Excel BGS: ${err.message}`);
    }
  }
}

