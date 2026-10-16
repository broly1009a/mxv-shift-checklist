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
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { ShiftsService } from '../../shifts/shifts.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { resolveStoragePathCrossPlatform } from '../../../shared';
import { PreEodReconService } from '../services/pre-eod-recon.service';
import { ReconConsoleSummaryService } from '../services/recon-console-summary.service';
import { QlgdDashboardService } from '../services/qlgd-dashboard.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller(['api/v1/trading-ops', 'api/v1/reconciliation', 'reconciliation'])
export class TradingOpsMiscController {
  private readonly logger = new Logger(TradingOpsMiscController.name);

  constructor(
    private readonly preEodReconService: PreEodReconService,
    private readonly reconConsoleSummaryService: ReconConsoleSummaryService,
    private readonly shiftsService: ShiftsService,
    private readonly settingsService: SystemSettingsService,
    private readonly qlgdDashboardService: QlgdDashboardService,
  ) {}

  /**
   * Đồng bộ tỷ giá USD từ M-System.
   */
  @Post('sync-usd-rate')
  @Permissions('ACCESS_AUTO_SHIFT')
  async syncUsdRate() {
    try {
      const rate = await this.reconConsoleSummaryService.syncUsdRateFromMSystem();
      return { success: true, rate };
    } catch (err: any) {
      throw new BadRequestException(`Không thể đồng bộ tỷ giá: ${err.message}`);
    }
  }

  /**
   * Đồng bộ toàn bộ tỷ giá đa tiền tệ từ M-System.
   */
  @Post('sync-exchange-rates')
  @Permissions('ACCESS_AUTO_SHIFT')
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
   * Upload file sao lưu thủ công vào thư mục lưu trữ Backup CQG/MS.
   */
  @Post('upload-backup')
  @Permissions('ACCESS_AUTO_SHIFT')
  @UseInterceptors(FilesInterceptor('files'))
  async uploadBackupFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('date') dateStr?: string,
    @Body('categories') categories?: string | string[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Không có file nào được tải lên');
    }

    const targetDate = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Định dạng ngày không hợp lệ. Sử dụng YYYY-MM-DD');
    }

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const cqgBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
    ));
    const msBase = resolveStoragePathCrossPlatform(await this.settingsService.getSetting(
      'bot_backup_path_ms',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
    ));

    const savedFiles: { filename: string; path: string; category: string }[] = [];

    let index = 0;
    const catList = Array.isArray(categories) ? categories : [categories || 'auto'];

    for (const file of files) {
      const category = catList[index] || catList[0] || 'auto';
      index++;

      const isCqg = category === 'cqg' || /FR|OP|PS|Od|Accounts_Balances/i.test(file.originalname);
      const targetBase = isCqg ? cqgBase : msBase;
      const targetDir = path.join(targetBase, subFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, file.originalname);
      fs.writeFileSync(filePath, file.buffer);

      savedFiles.push({
        filename: file.originalname,
        path: filePath,
        category: isCqg ? 'CQG' : 'M-System',
      });
    }

    return {
      success: true,
      message: `Đã lưu thành công ${savedFiles.length} file vào thư mục Backup (${subFolder})`,
      targetDate: targetDate.toISOString().split('T')[0],
      savedFiles,
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
  ) {
    return this.qlgdDashboardService.getExecutiveDashboard(dateStr, scope);
  }
}
