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
  Inject,
  forwardRef,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { BotJobQueueService } from '../../checklist-hub/queue/bot-job-queue.service';
import { FileAuditJobHandler } from '../handlers/file-audit.handler';
import { CqgMergerService } from '../../trading-ops/services/merger/cqg-merger.service';
import { EmailWatcherService } from '../services/email-watcher.service';
import { CcpCeScraperService } from '../scrapers/ccp-ce-scraper.service';
import {
  REQUIRED_CCP_FILES,
  REQUIRED_CE_FILES,
} from '../../../shared/constants/required-files.constant';
import {
  getMsBackupBase,
  getCqgBackupBase,
  getAcmBackupBase,
  resolveDailySubfolder,
  resolveStoragePathCrossPlatform,
  resolveTradingSessionDate,
} from '../../../shared/helpers/file-path.helper';
import { decrypt } from '../../../shared/helpers/crypto';

@Controller(['api/v1/ingress', 'api/v1/bot-engine'])
@UseGuards(JwtAuthGuard)
export class IngressDownloadController {
  private readonly logger = new Logger(IngressDownloadController.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly jobQueueService: BotJobQueueService,
    private readonly fileAuditHandler: FileAuditJobHandler,
    @Inject(forwardRef(() => CqgMergerService))
    private readonly cqgMergerService: CqgMergerService,
    private readonly emailWatcherService: EmailWatcherService,
    private readonly ccpCeScraperService: CcpCeScraperService,
  ) {}

  // =========================================================================
  // TRIGGER DOWNLOAD ENDPOINTS (MS, CQG, ACM, CCP, CE, CAST)
  // =========================================================================

  /**
   * Kích hoạt bot tải báo cáo M-System (20 báo cáo RPA).
   * POST /api/v1/ingress/trigger-download & POST /api/v1/bot-engine/trigger-download
   */
  @Post('trigger-download')
  async triggerDownload(
    @Body('targets') targets?: string[],
    @Body('sessionDay') sessionDay?: string,
    @Body('sessionDate') sessionDate?: string,
  ) {
    const defaultTargets = [
      'NKTTHT',
      'DSTKGD-Futures',
      'DSTKGD-Spread',
      'DSTKGD-LME',
      'DSTKGD-ACM',
      'QLTKGD',
      'TTTT',
      'NR',
      'Markettruoc6h',
    ];

    const actualTargets =
      targets && targets.length > 0 ? targets : defaultTargets;

    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const resolvedSession = resolveTradingSessionDate(sessionDay || sessionDate, {
      sessionStartStr,
    });
    const actualSessionDay = resolvedSession.dateStr;

    const job = await this.jobQueueService.enqueue('RPA_DOWNLOAD_REPORTS', {
      targets: actualTargets,
      sessionDay: actualSessionDay,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu chạy RPA tải báo cáo vào hàng đợi.',
      jobId: job._id,
      sessionDay: actualSessionDay,
    };
  }

  /**
   * Kích hoạt bot tải và ghép file báo cáo CQG (FR, PS, OP, OD song song 2 TK).
   * POST /api/v1/ingress/trigger-cqg-download & POST /api/v1/bot-engine/trigger-cqg-download
   */
  @Post('trigger-cqg-download')
  async triggerCqgDownload(
    @Body('reports') reports?: Record<string, boolean>,
    @Body('sessionDay') sessionDay?: string,
    @Body('sessionDate') sessionDate?: string,
    @Body('targetDate') targetDate?: string,
    @Body('skipMerge') skipMerge?: boolean,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const resolvedSession = resolveTradingSessionDate(sessionDay || sessionDate || targetDate, {
      sessionStartStr,
    });
    const actualSessionDay = resolvedSession.dateStr;

    const job = await this.jobQueueService.enqueue('DOWNLOAD_CQG_BACKUP', {
      reports,
      targetDate: actualSessionDay,
      sessionDay: actualSessionDay,
      skipMerge: !!skipMerge,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu tải và ghép file báo cáo CQG vào hàng đợi.',
      jobId: job._id,
      sessionDay: actualSessionDay,
    };
  }

  /**
   * Kích hoạt kiểm tra và ghép file backup CQG.
   * POST /api/v1/ingress/trigger-audit-cqg & POST /api/v1/bot-engine/trigger-audit-cqg
   */
  @Post('trigger-audit-cqg')
  async triggerAuditCqg(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const resolvedSession = resolveTradingSessionDate(targetDateStr || sessionDateStr, {
      sessionStartStr,
    });
    const actualSessionDay = resolvedSession.dateStr;

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_CQG', {
      targetDate: actualSessionDay,
      sessionDay: actualSessionDay,
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra và ghép file backup CQG vào hàng đợi.',
      jobId: job._id,
      sessionDay: actualSessionDay,
    };
  }

  /**
   * Enqueue Background BotJob để tải báo cáo CoreCCP (25 file báo cáo).
   * POST /api/v1/ingress/trigger-ccp-download & POST /api/v1/bot-engine/trigger-ccp-download
   */
  @Post('trigger-ccp-download')
  async triggerCcpDownload(
    @Body('date') dateStr?: string,
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
    @Body('sessionDate') sessionDate?: string,
    @Body('reports') reports?: string[],
    @Body('outputDir') outputDir?: string,
    @Body('isTradingCheck') isTradingCheck?: boolean,
    @Body('purpose') purpose?: string,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const rawStart = startDate || sessionDate || dateStr;
    const rawEnd = endDate || sessionDate || dateStr || rawStart;

    const resolvedStart = resolveTradingSessionDate(rawStart, {
      sessionStartStr,
    });
    const resolvedEnd = resolveTradingSessionDate(rawEnd, {
      sessionStartStr,
    });
    const targetStart = resolvedStart.dateStr;
    const targetEnd = resolvedEnd.dateStr;

    const job = await this.jobQueueService.enqueue('DOWNLOAD_CCP_REPORT', {
      startDate: targetStart,
      endDate: targetEnd,
      reports: reports && reports.length > 0 ? reports : ['QLTTTKGD', 'EOD', 'NR', 'TTTT'],
      outputDir,
      sessionDay: targetStart,
      isTradingCheck: isTradingCheck ?? (purpose === 'CHECK'),
      purpose,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu tải báo cáo CoreCCP vào hàng đợi.',
      jobId: job._id,
      sessionDay: targetStart,
    };
  }

  /**
   * Kích hoạt bot tải báo cáo CQG CAST.
   * POST /api/v1/ingress/trigger-cast-download & POST /api/v1/bot-engine/trigger-cast-download
   */
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
   * Enqueue Background BotJob để tải báo cáo CoreEX (CE) (hỗ trợ polling trạng thái & logs).
   * POST /api/v1/ingress/trigger-ce-download & POST /api/v1/bot-engine/trigger-ce-download
   */
  @Post('trigger-ce-download')
  async triggerCeDownload(
    @Body('date') dateStr?: string,
    @Body('startDate') startDate?: string,
    @Body('endDate') endDate?: string,
    @Body('sessionDate') sessionDate?: string,
    @Body('reports') reports?: string[],
    @Body('outputDir') outputDir?: string,
  ) {
    const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const targetStart = startDate || sessionDate || dateStr || today;
    const targetEnd = endDate || sessionDate || dateStr || targetStart;

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
   * Enqueue Background BotJob để tải báo cáo ACM (Web & SFTP Straits Financial).
   * POST /api/v1/ingress/trigger-acm-download & POST /api/v1/bot-engine/trigger-acm-download
   */
  @Post('trigger-acm-download')
  async triggerAcmDownload(
    @Body('date') dateStr?: string,
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
    @Body('reports') reports?: string[],
  ) {
    const backupPath = await getAcmBackupBase(this.settingsService);
    const effectiveDate = targetDateStr || sessionDateStr || dateStr || new Date().toISOString();

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

  /**
   * Kích hoạt kiểm tra và tải bổ sung file backup MS.
   * POST /api/v1/ingress/trigger-audit-ms & POST /api/v1/bot-engine/trigger-audit-ms
   */
  @Post('trigger-audit-ms')
  async triggerAuditMs(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const backupPath = await getMsBackupBase(this.settingsService);

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_MS', {
      backupPath,
      targetDate: targetDateStr || sessionDateStr || new Date().toISOString(),
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra và tải bổ sung file backup MS vào hàng đợi.',
      jobId: job._id,
    };
  }

  /**
   * Kích hoạt kiểm tra file backup ACM.
   * POST /api/v1/ingress/trigger-audit-acm & POST /api/v1/bot-engine/trigger-audit-acm
   */
  @Post('trigger-audit-acm')
  async triggerAuditAcm(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const backupPath = await getAcmBackupBase(this.settingsService);

    const job = await this.jobQueueService.enqueue('FILE_AUDIT_ACM', {
      backupPath,
      targetDate: targetDateStr || sessionDateStr || new Date().toISOString(),
      maxAttempts: 1,
    });

    return {
      success: true,
      message: 'Đã đưa yêu cầu kiểm tra file backup ACM vào hàng đợi.',
      jobId: job._id,
    };
  }

  /**
   * Trigger trực tiếp tải báo cáo từ CoreCCP (Async).
   * POST /api/v1/ingress/download-ccp-report & POST /api/v1/bot-engine/download-ccp-report
   */
  @Post('download-ccp-report')
  async downloadCcpReport(@Body() body: any) {
    const ccpRaw = await this.settingsService.getSetting('bot_credentials_ccp', '');
    if (!ccpRaw) {
      throw new HttpException(
        'Chưa cấu hình thông tin đăng nhập CoreCCP. Vào Admin -> Cấu hình kết nối để thiết lập.',
        HttpStatus.BAD_REQUEST,
      );
    }
    let creds: any = {};
    try {
      creds = JSON.parse(decrypt(ccpRaw));
    } catch {}

    if (!creds.url || !creds.username || !creds.password) {
      throw new HttpException(
        'Cấu hình CoreCCP thiếu url/username/password.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const outputDir = body.outputDir || creds.outputDir || 'backupCCP';

    this.logger.log(`[CCP Downloader] Bắt đầu tải báo cáo CoreCCP: ${body.startDate} -> ${body.endDate}`);

    this.ccpCeScraperService
      .run({
        systemUrl: creds.url,
        username: creds.username,
        password: creds.password,
        startDate: body.startDate,
        endDate: body.endDate,
        outputDir,
        reports: body.reports,
        options: body.options,
      })
      .then((ok) => this.logger.log(`[CCP Downloader] Kết quả: ${ok ? 'Thành công' : 'Thất bại'}`))
      .catch((e) => this.logger.error(`[CCP Downloader] Lỗi: ${e?.message}`));

    return {
      message: 'Đã kích hoạt tải báo cáo CoreCCP. Kiểm tra log để theo dõi tiến trình.',
      systemUrl: creds.url,
      startDate: body.startDate,
      endDate: body.endDate,
      outputDir,
    };
  }

  /**
   * Trigger trực tiếp tải báo cáo từ CoreEX (Async).
   * POST /api/v1/ingress/download-ce-report & POST /api/v1/bot-engine/download-ce-report
   */
  @Post('download-ce-report')
  async downloadCeReport(@Body() body: any) {
    const ceRaw = await this.settingsService.getSetting('bot_credentials_ce', '');
    if (!ceRaw) {
      throw new HttpException(
        'Chưa cấu hình thông tin đăng nhập CoreEX. Vào Admin -> Cấu hình kết nối để thiết lập.',
        HttpStatus.BAD_REQUEST,
      );
    }
    let creds: any = {};
    try {
      creds = JSON.parse(decrypt(ceRaw));
    } catch {}

    if (!creds.url || !creds.username || !creds.password) {
      throw new HttpException(
        'Cấu hình CoreEX thiếu url/username/password.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const outputDir = body.outputDir || creds.outputDir || 'backupCE';

    this.logger.log(`[CE Downloader] Bắt đầu tải báo cáo CoreEX: ${body.startDate} -> ${body.endDate}`);

    this.ccpCeScraperService
      .run({
        systemUrl: creds.url,
        username: creds.username,
        password: creds.password,
        startDate: body.startDate,
        endDate: body.endDate,
        outputDir,
        reports: body.reports,
        options: body.options,
      })
      .then((ok) => this.logger.log(`[CE Downloader] Kết quả: ${ok ? 'Thành công' : 'Thất bại'}`))
      .catch((e) => this.logger.error(`[CE Downloader] Lỗi: ${e?.message}`));

    return {
      message: 'Đã kích hoạt tải báo cáo CoreEX. Kiểm tra log để theo dõi tiến trình.',
      systemUrl: creds.url,
      startDate: body.startDate,
      endDate: body.endDate,
      outputDir,
    };
  }

  // =========================================================================
  // AUDIT BACKUP ENDPOINTS (MS, CQG, ACM, CCP, CE)
  // =========================================================================

  /**
   * Quét nhanh thư mục Backup M-System và trả về trạng thái 20 file báo cáo.
   * POST /api/v1/ingress/audit-ms-backup & POST /api/v1/bot-engine/audit-ms-backup
   */
  @Post('audit-ms-backup')
  async auditMsBackup(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const { dateObj: targetDate } = resolveTradingSessionDate(targetDateStr || sessionDateStr, {
      sessionStartStr,
    });
    const backupPath = await getMsBackupBase(this.settingsService);

    const { fullPath: dailyPath } = resolveDailySubfolder(backupPath, targetDate);
    const resolvedBackupPath = resolveStoragePathCrossPlatform(backupPath);
    const scanPath = fs.existsSync(dailyPath) ? dailyPath : resolvedBackupPath;

    if (!fs.existsSync(scanPath)) {
      throw new HttpException(
        `Thư mục backup không tồn tại: ${scanPath}. Vui lòng kiểm tra lại đường dẫn.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const results = await this.fileAuditHandler.scanMsBackupFiles(
      scanPath,
      targetDate,
    );
    const okCount = results.filter((r: any) => r.status === 'OK').length;
    const missingCount = results.filter((r: any) => r.status === 'MISSING').length;
    const outdatedCount = results.filter((r: any) => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: scanPath,
      summary: {
        total: results.length,
        ok: okCount,
        missing: missingCount,
        outdated: outdatedCount,
      },
      files: results,
    };
  }

  /**
   * Quét nhanh thư mục Backup CQG và trả về trạng thái file báo cáo.
   * POST /api/v1/ingress/audit-cqg-backup & POST /api/v1/bot-engine/audit-cqg-backup
   */
  @Post('audit-cqg-backup')
  async auditCqgBackup(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const { dateObj: targetDate } = resolveTradingSessionDate(targetDateStr || sessionDateStr, {
      sessionStartStr,
    });
    const { fullPath } = await this.cqgMergerService.getDailyBackupPath(targetDate);

    const results = await this.cqgMergerService.scanCqgBackupFiles(targetDate);
    const okCount = results.filter((r) => r.status === 'OK').length;
    const missingCount = results.filter((r) => r.status === 'MISSING').length;
    const outdatedCount = results.filter((r) => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: fullPath,
      summary: {
        total: results.length,
        ok: okCount,
        missing: missingCount,
        outdated: outdatedCount,
      },
      files: results,
    };
  }

  /**
   * Quét nhanh thư mục Backup ACM Straits và trả về trạng thái file báo cáo.
   * POST /api/v1/ingress/audit-acm-backup & POST /api/v1/bot-engine/audit-acm-backup
   */
  @Post('audit-acm-backup')
  async auditAcmBackup(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const targetDate = targetDateStr || sessionDateStr ? new Date(targetDateStr || sessionDateStr!) : new Date();
    const backupPath = await getAcmBackupBase(this.settingsService);

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
    const dailyPath = path.join(backupPath, subFolder);

    const scanPath = fs.existsSync(dailyPath) ? dailyPath : backupPath;

    if (!fs.existsSync(scanPath)) {
      fs.mkdirSync(scanPath, { recursive: true });
    }

    const results = await this.fileAuditHandler.scanAcmBackupFiles(
      scanPath,
      targetDate,
    );
    const okCount = results.filter((r: any) => r.status === 'OK').length;
    const missingCount = results.filter((r: any) => r.status === 'MISSING').length;
    const outdatedCount = results.filter((r: any) => r.status === 'OUTDATED').length;

    return {
      success: true,
      backupPath: scanPath,
      summary: {
        total: results.length,
        ok: okCount,
        missing: missingCount,
        outdated: outdatedCount,
      },
      files: results,
    };
  }

  /**
   * Quét nhanh thư mục Backup CoreCCP và trả về trạng thái 8 file báo cáo.
   * POST /api/v1/ingress/audit-ccp-backup & POST /api/v1/bot-engine/audit-ccp-backup
   */
  @Post('audit-ccp-backup')
  async auditCcpBackup(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const sessionStartStr = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const { dateObj: targetDate } = resolveTradingSessionDate(targetDateStr || sessionDateStr, {
      sessionStartStr,
    });
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ccp',
      '',
    );

    const { fullPath: dailyPath } = resolveDailySubfolder(backupPath, targetDate);
    const resolvedBackupPath = resolveStoragePathCrossPlatform(backupPath);
    const scanPath = fs.existsSync(dailyPath) ? dailyPath : resolvedBackupPath;

    if (!fs.existsSync(scanPath)) {
      return {
        success: false,
        backupPath: scanPath,
        message: `Thư mục backup CCP không tồn tại: ${scanPath}`,
        summary: { total: REQUIRED_CCP_FILES.length, ok: 0, missing: REQUIRED_CCP_FILES.length, empty: 0 },
        files: REQUIRED_CCP_FILES.map((f) => ({
          key: f.key,
          name: f.name,
          filename: f.filename,
          status: 'MISSING',
          size: 0,
        })),
      };
    }

    const results = await this.fileAuditHandler.scanCcpBackupFiles(
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
   * Quét nhanh thư mục Backup CoreEX (CE) và trả về trạng thái 10 file báo cáo.
   * POST /api/v1/ingress/audit-ce-backup & POST /api/v1/bot-engine/audit-ce-backup
   */
  @Post('audit-ce-backup')
  async auditCeBackup(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
  ) {
    const targetDate = targetDateStr || sessionDateStr ? new Date(targetDateStr || sessionDateStr!) : new Date();
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

    const filesInDir = fs.readdirSync(scanPath);
    const results = REQUIRED_CE_FILES.map((def) => {
      const matched = filesInDir.find((f) => def.patterns.some((p) => p.test(f)));
      if (!matched) {
        return {
          key: def.key,
          name: def.name,
          filename: def.filename,
          status: 'MISSING',
          size: 0,
        };
      }
      try {
        const stat = fs.statSync(path.join(scanPath, matched));
        return {
          key: def.key,
          name: def.name,
          filename: matched,
          status: stat.size > 0 ? 'OK' : 'EMPTY',
          size: stat.size,
        };
      } catch {
        return {
          key: def.key,
          name: def.name,
          filename: matched,
          status: 'MISSING',
          size: 0,
        };
      }
    });

    const okCount = results.filter((r) => r.status === 'OK').length;
    const missingCount = results.filter((r) => r.status === 'MISSING').length;
    const emptyCount = results.filter((r) => r.status === 'EMPTY').length;

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
   * Tải trực tiếp file EOD từ hòm thư Microsoft 365 Outlook về thư mục Backup M-System.
   * POST /api/v1/ingress/fetch-eod-email & POST /api/v1/bot-engine/fetch-eod-email
   */
  @Post('fetch-eod-email')
  async fetchEodEmail(
    @Body('targetDate') targetDateStr?: string,
    @Body('sessionDate') sessionDateStr?: string,
    @Body('customDir') customDir?: string,
  ) {
    try {
      const result = await this.emailWatcherService.fetchEodEmail(
        targetDateStr || sessionDateStr,
        customDir,
      );
      return result;
    } catch (err: any) {
      this.logger.error(`Error in fetchEodEmail: ${err.message}`);
      throw new HttpException(
        err.message || 'Lỗi khi tải file EOD từ Microsoft 365 Outlook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // =========================================================================
  // FILE READINESS MATRIX & DAILY UPLOAD ENDPOINTS
  // =========================================================================

  /**
   * Kiểm tra ma trận sẵn sàng file (Readiness Matrix) theo ngày giao dịch.
   * GET /api/v1/ingress/files/readiness-matrix & GET /api/v1/bot-engine/files/readiness-matrix
   */
  @Get('files/readiness-matrix')
  async getFileReadinessMatrix(@Query('date') dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const msBaseRaw = await getMsBackupBase(this.settingsService);
    const msBase = resolveStoragePathCrossPlatform(msBaseRaw);
    const cqgBaseRaw = await getCqgBackupBase(this.settingsService);
    const cqgBase = resolveStoragePathCrossPlatform(cqgBaseRaw);

    const msSub = resolveDailySubfolder(msBase, targetDate);
    const cqgSub = resolveDailySubfolder(cqgBase, targetDate);

    // Scan MS daily directory
    let msFiles: Array<{ name: string; size: number; mtime: Date }> = [];
    if (fs.existsSync(msSub.fullPath)) {
      try {
        const entries = fs.readdirSync(msSub.fullPath);
        msFiles = entries.map((name) => {
          try {
            const stat = fs.statSync(path.join(msSub.fullPath, name));
            return { name, size: stat.size, mtime: stat.mtime };
          } catch {
            return { name, size: 0, mtime: new Date() };
          }
        });
      } catch (err: any) {
        this.logger.warn(`Error reading MS daily folder ${msSub.fullPath}: ${err.message}`);
      }
    }

    // Scan CQG daily directory
    let cqgFiles: Array<{ name: string; size: number; mtime: Date }> = [];
    if (fs.existsSync(cqgSub.fullPath)) {
      try {
        const entries = fs.readdirSync(cqgSub.fullPath);
        cqgFiles = entries.map((name) => {
          try {
            const stat = fs.statSync(path.join(cqgSub.fullPath, name));
            return { name, size: stat.size, mtime: stat.mtime };
          } catch {
            return { name, size: 0, mtime: new Date() };
          }
        });
      } catch (err: any) {
        this.logger.warn(`Error reading CQG daily folder ${cqgSub.fullPath}: ${err.message}`);
      }
    }

    const findMsFile = (regex: RegExp) => {
      const match = msFiles.find((f) => regex.test(f.name));
      if (!match) return { exists: false, filename: null, sizeBytes: 0, updatedAt: null };
      return { exists: true, filename: match.name, sizeBytes: match.size, updatedAt: match.mtime };
    };

    const findCqgFile = (regex: RegExp) => {
      const match = cqgFiles.find((f) => regex.test(f.name));
      if (!match) return { exists: false, filename: null, sizeBytes: 0, updatedAt: null };
      return { exists: true, filename: match.name, sizeBytes: match.size, updatedAt: match.mtime };
    };

    // Check CoreCCP reports
    const ccpDsgd = findMsFile(/^DSGD.*\.xlsx$/i);
    const ccpTtm = findMsFile(/^TTM.*\.xlsx$/i);
    const ccpTttt = findMsFile(/^TTTT.*\.xlsx$/i);
    const ccpTyGia = findMsFile(/^(?:Tỷ\s*giá|Ty_?gia|ExchangeRate).*\.xlsx$/i);

    // Check CQG reports
    const cqgFr = findCqgFile(/^FR\.(?:xlsx|xls)$/i);
    const cqgFr1 = findCqgFile(/^FR1\.(?:xlsx|xls)$/i);
    const cqgFr2 = findCqgFile(/^FR2\.(?:xlsx|xls)$/i);
    const cqgPs = findCqgFile(/^PS\.(?:xlsx|xls)$/i);
    const cqgPs1 = findCqgFile(/^PS1\.(?:xlsx|xls)$/i);
    const cqgPs2 = findCqgFile(/^PS2\.(?:xlsx|xls)$/i);
    const cqgOp = findCqgFile(/^OP\.(?:xlsx|xls)$/i);
    const cqgOd = findCqgFile(/^Od\.(?:xlsx|xls)$/i);

    // Check M-System standard reports
    const msQltkgd = findMsFile(/^QLTKGD.*\.xlsx$/i);
    const msNr = findMsFile(/^NR.*\.xlsx$/i);
    const msNkttht = findMsFile(/^NKTTHT.*\.xlsx$/i);
    const msTlkqhskq = findMsFile(/^TLKQHSKQ.*\.xlsx$/i);
    const msMarket6h = findMsFile(/^market.*(?:csv|xlsx)$/i);
    const msDstrader = findMsFile(/^DSTrader.*\.xlsx$/i);
    const msDslk = findMsFile(/^DSLK.*\.xlsx$/i);
    const msDslck = findMsFile(/^DSLCK.*\.xlsx$/i);
    const msDslh = findMsFile(/^DSLH.*\.xlsx$/i);
    const msDsldk = findMsFile(/^DSLDK.*\.xlsx$/i);

    const isReadyForLotStatistics = ccpDsgd.exists;
    const isReadyForDsgdBeforeEod =
      (ccpDsgd.exists || msQltkgd.exists) &&
      (cqgFr.exists || (cqgFr1.exists && cqgFr2.exists));

    return {
      success: true,
      date: dateStr || targetDate.toISOString().split('T')[0],
      msDailyFolder: msSub.fullPath,
      cqgDailyFolder: cqgSub.fullPath,
      msFolderExists: fs.existsSync(msSub.fullPath),
      cqgFolderExists: fs.existsSync(cqgSub.fullPath),
      matrix: {
        ccp: {
          dsgd: ccpDsgd,
          ttm: ccpTtm,
          tttt: ccpTttt,
          tyGia: ccpTyGia,
        },
        cqg: {
          fr: cqgFr.exists
            ? cqgFr
            : {
                ...cqgFr,
                exists: cqgFr1.exists && cqgFr2.exists,
                isMerged: false,
                rawParts: { fr1: cqgFr1.exists, fr2: cqgFr2.exists },
              },
          ps: cqgPs.exists
            ? cqgPs
            : {
                ...cqgPs,
                exists: cqgPs1.exists && cqgPs2.exists,
                isMerged: false,
                rawParts: { ps1: cqgPs1.exists, ps2: cqgPs2.exists },
              },
          op: cqgOp,
          od: cqgOd,
        },
        ms: {
          qltkgd: msQltkgd,
          nr: msNr,
          nkttht: msNkttht,
          tlkqhskq: msTlkqhskq,
          market6h: msMarket6h,
          dstrader: msDstrader,
          dslk: msDslk,
          dslck: msDslck,
          dslh: msDslh,
          dsldk: msDsldk,
        },
      },
      readiness: {
        lotStatistics: isReadyForLotStatistics,
        dsgdBeforeEod: isReadyForDsgdBeforeEod,
      },
    };
  }

  /**
   * Nạp trực tiếp file báo cáo vào thư mục backup theo ngày tương ứng.
   * POST /api/v1/ingress/files/upload-daily & POST /api/v1/bot-engine/files/upload-daily
   */
  @Post('files/upload-daily')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDailyFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('date') dateStr: string,
    @Body('targetType') targetType?: string,
  ) {
    if (!file) {
      throw new HttpException('Không có file nào được tải lên.', HttpStatus.BAD_REQUEST);
    }
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const msBaseRaw = await getMsBackupBase(this.settingsService);
    const msBase = resolveStoragePathCrossPlatform(msBaseRaw);
    const msSub = resolveDailySubfolder(msBase, targetDate);

    if (!fs.existsSync(msSub.fullPath)) {
      fs.mkdirSync(msSub.fullPath, { recursive: true });
    }

    let finalName = file.originalname;
    const lowerName = file.originalname.toLowerCase();

    if (targetType === 'DSGD' || lowerName.includes('dsgd')) {
      finalName = 'DSGD.xlsx';
    } else if (targetType === 'TTM' || lowerName.includes('ttm')) {
      finalName = 'TTM.xlsx';
    } else if (targetType === 'TTTT' || lowerName.includes('tttt')) {
      finalName = 'TTTT.xlsx';
    } else if (
      targetType === 'EXCHANGE_RATE' ||
      lowerName.includes('tỷ giá') ||
      lowerName.includes('ty_gia') ||
      lowerName.includes('exchangerate')
    ) {
      const d = targetDate.getDate().toString().padStart(2, '0');
      const m = (targetDate.getMonth() + 1).toString().padStart(2, '0');
      const y = targetDate.getFullYear();
      finalName = `Tỷ giá ${d}.${m}.${y}.xlsx`;
    }

    const destPath = path.join(msSub.fullPath, finalName);
    fs.writeFileSync(destPath, file.buffer);

    return {
      success: true,
      message: `Đã nạp file ${finalName} vào thư mục ngày: ${msSub.fullPath}`,
      filename: finalName,
      sizeBytes: file.size,
      destPath,
    };
  }

  // =========================================================================
  // BACKUP FOLDER CONFIG & SCHEDULE ENDPOINTS
  // =========================================================================

  /**
   * Đọc đường dẫn backup MS.
   * GET /api/v1/ingress/backup-ms/config & GET /api/v1/bot-engine/backup-ms/config
   */
  @Get('backup-ms/config')
  async getBackupMsConfig() {
    const backupPath = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      '',
    );
    return { backupPath };
  }

  /**
   * Lưu đường dẫn backup MS.
   * POST /api/v1/ingress/backup-ms/config & POST /api/v1/bot-engine/backup-ms/config
   */
  @Post('backup-ms/config')
  async saveBackupMsConfig(@Body('backupPath') backupPath: string) {
    if (!backupPath || typeof backupPath !== 'string') {
      throw new HttpException(
        'backupPath không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.settingsService.setSetting(
      'bot_backup_path_ms',
      backupPath.trim(),
    );
    return { success: true, message: 'Đã lưu đường dẫn thư mục backup MS.' };
  }

  /**
   * Đọc đường dẫn backup CQG.
   * GET /api/v1/ingress/backup-cqg/config & GET /api/v1/bot-engine/backup-cqg/config
   */
  @Get('backup-cqg/config')
  async getBackupCqgConfig() {
    const { baseDir, fullPath } = await this.cqgMergerService.getDailyBackupPath(
      new Date(),
    );
    return { backupPath: baseDir, fullPath };
  }

  /**
   * Lưu đường dẫn backup CQG.
   * POST /api/v1/ingress/backup-cqg/config & POST /api/v1/bot-engine/backup-cqg/config
   */
  @Post('backup-cqg/config')
  async saveBackupCqgConfig(@Body('backupPath') backupPath: string) {
    if (!backupPath || typeof backupPath !== 'string') {
      throw new HttpException(
        'backupPath không hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.settingsService.setSetting(
      'bot_backup_path_cqg',
      backupPath.trim(),
    );
    return { success: true, message: 'Đã lưu đường dẫn thư mục backup CQG.' };
  }

  /**
   * Đọc đường dẫn backup ACM.
   * GET /api/v1/ingress/backup-acm/config & GET /api/v1/bot-engine/backup-acm/config
   */
  @Get('backup-acm/config')
  async getBackupAcmConfig() {
    const backupPath = await getAcmBackupBase(this.settingsService);
    return { backupPath };
  }

  /**
   * Lưu đường dẫn backup ACM.
   * POST /api/v1/ingress/backup-acm/config & POST /api/v1/bot-engine/backup-acm/config
   */
  @Post('backup-acm/config')
  async saveBackupAcmConfig(@Body('backupPath') _backupPath: string) {
    return {
      success: true,
      message: 'Đường dẫn ACM được tự động đồng bộ theo Backup MS.',
    };
  }

  /**
   * Đọc cấu hình lịch tự động tải CoreCCP.
   * GET /api/v1/ingress/backup-ccp/schedule & GET /api/v1/bot-engine/backup-ccp/schedule
   */
  @Get('backup-ccp/schedule')
  async getCcpSchedule() {
    const periodic = await this.settingsService.getSetting('bot_ccp_periodic_enabled', 'true');
    const periodicMinutes = await this.settingsService.getSetting('bot_ccp_periodic_minutes', '60');
    const timeEnabled = await this.settingsService.getSetting('bot_ccp_time_enabled', 'true');
    const time = await this.settingsService.getSetting('bot_ccp_time', '06:00');
    const reportsRaw = await this.settingsService.getSetting(
      'bot_ccp_reports',
      JSON.stringify(['QLTTTKGD', 'EOD', 'NR', 'DSL', 'DSGD', 'TTTT', 'TTM', 'LSGTT']),
    );
    let reports: string[] = [];
    try {
      reports = JSON.parse(reportsRaw);
    } catch {
      reports = ['QLTTTKGD', 'EOD', 'NR', 'DSL', 'DSGD', 'TTTT', 'TTM', 'LSGTT'];
    }

    return {
      periodic: periodic === 'true',
      periodicMinutes: parseInt(periodicMinutes, 10) || 60,
      timeEnabled: timeEnabled === 'true',
      time,
      reports,
    };
  }

  /**
   * Lưu cấu hình lịch tự động tải CoreCCP.
   * POST /api/v1/ingress/backup-ccp/schedule & POST /api/v1/bot-engine/backup-ccp/schedule
   */
  @Post('backup-ccp/schedule')
  async saveCcpSchedule(
    @Body('periodic') periodic?: boolean,
    @Body('periodicMinutes') periodicMinutes?: number,
    @Body('timeEnabled') timeEnabled?: boolean,
    @Body('time') time?: string,
    @Body('reports') reports?: string[],
  ) {
    if (periodic !== undefined) {
      await this.settingsService.setSetting('bot_ccp_periodic_enabled', String(periodic));
    }
    if (periodicMinutes !== undefined) {
      await this.settingsService.setSetting('bot_ccp_periodic_minutes', String(periodicMinutes));
    }
    if (timeEnabled !== undefined) {
      await this.settingsService.setSetting('bot_ccp_time_enabled', String(timeEnabled));
    }
    if (time !== undefined) {
      await this.settingsService.setSetting('bot_ccp_time', time.trim());
    }
    if (reports && Array.isArray(reports)) {
      await this.settingsService.setSetting('bot_ccp_reports', JSON.stringify(reports));
    }
    return { success: true, message: 'Đã lưu cấu hình tự động tải CoreCCP thành công.' };
  }
}
