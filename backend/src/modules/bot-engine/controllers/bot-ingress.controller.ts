import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { BotJobQueueService } from '../bot-job-queue.service';
import { EmailWatcherService } from '../watchers';
import { FileAuditJobHandler } from '../handlers/file-audit.handler';
import {
  REQUIRED_CCP_FILES,
  REQUIRED_CE_FILES,
} from '../constants/required-files.constant';
import {
  getMsBackupBase,
  getCqgBackupBase,
  getAcmBackupBase,
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
} from '../helpers/bot-path.helper';
import { decrypt } from '../utils/crypto';

@Controller('api/v1/bot-engine')
@UseGuards(JwtAuthGuard)
export class BotIngressController {
  private readonly logger = new Logger(BotIngressController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
    private readonly emailWatcherService: EmailWatcherService,
    private readonly fileAuditHandler: FileAuditJobHandler,
  ) {}


  @Post('trigger-cast-download')
  async triggerCastDownload(
    @Body('backupPath') backupPath?: string,
    @Body('targetDate') targetDate?: string,
  ) {
    const job = await this.jobQueueService.enqueue('DOWNLOAD_CAST', {
      maxAttempts: 1,
      backupPath: backupPath || '',
      targetDate: targetDate || '',
    });
    return {
      success: true,
      message: 'Đã đưa yêu cầu tải báo cáo CQG CAST vào hàng đợi.',
      jobId: job._id,
    };
  }

  
  
  /**
   * Quét nhanh thư mục Backup CoreEX (CE) và trả về trạng thái 10 file báo cáo.
   * POST /api/v1/bot-engine/audit-ce-backup
   */
  @Post('audit-ce-backup')
  async auditCeBackup(@Body('targetDate') targetDateStr?: string) {
    const targetDate = targetDateStr ? new Date(targetDateStr) : new Date();
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ce',
      'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures',
    );

    const { fullPath: dailyPath } = resolveDailySubfolder(backupPath, targetDate);
    const resolvedBackupPath = resolveStoragePathCrossPlatform(backupPath);
    const scanPath = fs.existsSync(dailyPath) ? dailyPath : resolvedBackupPath;

    if (!fs.existsSync(scanPath)) {
      return {
        success: false,
        backupPath: scanPath,
        message: `Thư mục backup CE không tồn tại: ${scanPath}`,
        summary: { total: REQUIRED_CE_FILES.length, ok: 0, missing: REQUIRED_CE_FILES.length, empty: 0 },
        files: REQUIRED_CE_FILES.map((f) => ({
          key: f.key,
          name: f.name,
          filename: f.filename,
          status: 'MISSING',
          size: 0,
        })),
      };
    }

    const results = await this.fileAuditHandler.scanCeBackupFiles(
      scanPath,
      targetDate,
    );
    const okCount = results.filter((r: any) => r.status === 'OK').length;
    const missingCount = results.filter((r: any) => r.status === 'MISSING').length;
    const emptyCount = results.filter((r: any) => r.status === 'EMPTY').length;

    return {
      success: true,
      backupPath: scanPath,
      summary: {
        total: results.length,
        ok: okCount,
        missing: missingCount,
        empty: emptyCount,
      },
      files: results,
    };
  }

  /**
   * Enqueue Background BotJob để tải báo cáo CoreEX (CE) (hỗ trợ polling trạng thái & logs).
   * POST /api/v1/bot-engine/trigger-ce-download
   */
  @Post('trigger-ce-download')
  async triggerCeDownload(
    @Body('date') dateStr?: string,
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
    @Body('reports') reports?: string[],
    @Body('outputDir') outputDir?: string,
  ) {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetStart = startDate || dateStr || today;
    const targetEnd = endDate || dateStr || targetStart;

    const job = await this.jobQueueService.enqueue('DOWNLOAD_CE_REPORT', {
      startDate: targetStart,
      endDate: targetEnd,
      reports: reports && reports.length > 0 ? reports : undefined,
      outputDir,
      sessionDay: targetStart,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu tải báo cáo CoreEX (CE) vào hàng đợi.',
      jobId: job._id,
    };
  }

  /**
   * Enqueue Background BotJob để tải báo cáo ACM (Web & SFTP).
   * POST /api/v1/bot-engine/trigger-acm-download
   */
  @Post('trigger-acm-download')
  async triggerAcmDownload(
    @Body('date') dateStr?: string,
    @Body('targetDate') targetDateStr?: string,
    @Body('reports') reports?: string[],
  ) {
    const backupPath = await getAcmBackupBase(this.settingsService);
    const effectiveDate = targetDateStr || dateStr || new Date().toISOString();

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_ACM', {
      backupPath,
      targetDate: effectiveDate,
      reports: reports && reports.length > 0 ? reports : undefined,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu tải và kiểm tra file backup ACM vào hàng đợi.',
      jobId: job._id,
    };
  }
}
