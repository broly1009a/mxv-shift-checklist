import { Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { TkgdActivityLog, TkgdActivityLogDocument } from '../../schemas/tkgd-activity-log.schema';

// ── Sub-services (Facade delegates) ────────────────────────────────────────
import { TkgdConfigService } from './services/tkgd-config.service';
import { TkgdProgressService, TkgdProgressState } from './services/tkgd-progress.service';
import { TkgdMailIngestService } from './services/tkgd-mail-ingest.service';
import { TkgdReconcileCoreService } from './services/tkgd-reconcile-core.service';
import { TkgdExcelExportService } from './services/tkgd-excel-export.service';
import { TkgdMsCrawlerService } from './services/tkgd-ms-crawler.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

export { TkgdProgressState };

/**
 * TkgdAutomationService — Facade / Orchestrator Pattern
 *
 * ╔════════════════════════════════════════════════════════════════╗
 * ║  SAU KHI REFACTOR: ~320 dòng (từ 4.571 dòng ban đầu)        ║
 * ║  Service này KHÔNG chứa logic nghiệp vụ.                     ║
 * ║  Mọi xử lý đều được delegate sang sub-service chuyên trách.  ║
 * ╚════════════════════════════════════════════════════════════════╝
 *
 * Sơ đồ delegate:
 *   TkgdAutomationService (Facade)
 *   ├── TkgdConfigService          → Config, Auth, Outlook token
 *   ├── TkgdProgressService        → Real-time progress tracking
 *   ├── TkgdMailIngestService      → Graph API, phân tích email, tải attachment
 *   ├── TkgdReconcileCoreService   → M-System scraping, OCR reparse, đối soát luật
 *   └── TkgdExcelExportService     → Xuất Excel, quản lý file manifest
 */
@Injectable()
export class TkgdAutomationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TkgdAutomationService.name);

  /** Theo dõi user đang chạy auto-pipeline — ngăn đè nhau */
  private autoPipelineRunningUsers = new Set<string>();

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(TkgdActivityLog.name) private activityLogModel: Model<TkgdActivityLogDocument>,
    private readonly configService: TkgdConfigService,
    private readonly progressService: TkgdProgressService,
    private readonly mailIngestService: TkgdMailIngestService,
    private readonly reconcileCoreService: TkgdReconcileCoreService,
    private readonly excelExportService: TkgdExcelExportService,
    private readonly msCrawlerService: TkgdMsCrawlerService,
    @Optional() private readonly settingsService?: SystemSettingsService,
  ) {}

  onModuleInit() {
    const isDedicatedWorker =
      process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'true' ||
      process.env.TKGD_LOCAL_AUTO_RUNNER === 'true';
    const isWorkerDisabled = process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'false';

    if (isWorkerDisabled) {
      this.logger.log('[TKGD-ROLE] Node role: WEB_ONLY (Background auto pipeline cron da tat hoan toan).');
    } else if (isDedicatedWorker) {
      this.logger.log('[TKGD-ROLE] Node role: DEDICATED_WORKER (Kich hoat Background Worker chay ngam tu dong).');
      // Kích hoạt ngay 1 chu kỳ quét sau 5s khởi động, không phải chờ đến mốc phút chia hết cho 5 tiếp theo
      setTimeout(() => {
        this.logger.log('[TKGD-WORKER] Dang khoi dong chu trinh quet ban dau...');
        this.handleCronAutoPipeline(true).catch((err) => {
          this.logger.warn(`[TKGD-WORKER-INIT] Lỗi: ${err.message}`);
        });
      }, 5000);
    } else {
      this.logger.log('[TKGD-ROLE] Node role: STANDARD (Chay theo trang thai autoPipeline.enabled tren CSDL).');
    }
  }

  onModuleDestroy() {
    this.autoPipelineRunningUsers.clear();
  }

  // ═══════════════════════════════════════════════════════════
  // I. ACTIVITY LOGGING
  // ═══════════════════════════════════════════════════════════

  async logActivity(params: {
    action: string;
    title: string;
    details?: string;
    status?: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
    userEmail?: string;
    userName?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const log = new this.activityLogModel({
        action: params.action,
        title: params.title,
        details: params.details || '',
        status: params.status || 'SUCCESS',
        userEmail: params.userEmail || 'clearing.acc@mxv.vn',
        userName: params.userName || '',
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
        metadata: params.metadata || {},
      });
      await log.save();
    } catch (err: any) {
      this.logger.warn(`[TKGD-LOG] Không thể lưu log: ${err.message}`);
    }
  }

  async getActivityLogs(query: {
    page?: number;
    limit?: number;
    action?: string;
    status?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
    userEmail?: string;
  }): Promise<{ data: any[]; total: number; page: number; pages: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: any = {};
    if (query.action && query.action !== 'ALL') filter.action = query.action;
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.userEmail) filter.userEmail = query.userEmail;
    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [{ title: regex }, { details: regex }, { action: regex }, { userEmail: regex }];
    }
    if (query.startDate || query.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    const total = await this.activityLogModel.countDocuments(filter);
    const data = await this.activityLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    return { data, total, page, pages: Math.ceil(total / limit) || 1 };
  }

  // ═══════════════════════════════════════════════════════════
  // II. PROGRESS  →  TkgdProgressService
  // ═══════════════════════════════════════════════════════════

  updateProgress(userEmail: string, state: Partial<TkgdProgressState>): void {
    this.progressService.updateProgress(userEmail, state);
  }

  getProgress(userEmail: string): TkgdProgressState {
    return this.progressService.getProgress(userEmail);
  }

  // ═══════════════════════════════════════════════════════════
  // III. CONFIG & AUTH  →  TkgdConfigService
  // ═══════════════════════════════════════════════════════════

  async getUserConfig(userEmail: string) {
    return this.configService.getUserConfig(userEmail);
  }

  async saveUserConfig(userEmail: string, dto: any) {
    return this.configService.saveUserConfig(userEmail, dto);
  }

  async saveOutlookAuthorizedToken(userEmail: string, tokenData: { refreshToken: string; authorizedEmail?: string }) {
    return this.configService.saveOutlookAuthorizedToken(userEmail, tokenData);
  }

  async getRawClientSecret(userEmail: string): Promise<string> {
    return this.configService.getRawClientSecret(userEmail);
  }

  async disconnectOutlook(userEmail: string) {
    return this.configService.disconnectOutlook(userEmail);
  }

  // ═══════════════════════════════════════════════════════════
  // IV. RECORDS & STATS  →  TkgdReconcileCoreService
  // ═══════════════════════════════════════════════════════════

  async testMSystemConnection(userEmail: string, testCreds?: { username?: string; password?: string; pin?: string }) {
    return this.msCrawlerService.testMSystemConnection(userEmail, testCreds);
  }

  async getRecords(options: any, skipArg?: number, filterArg?: string) {
    return this.reconcileCoreService.getRecords(options, skipArg, filterArg);
  }

  async verifyAndHealWithImageHash(record: any): Promise<boolean> {
    return this.reconcileCoreService.verifyAndHealWithImageHash(record);
  }

  public evaluateRecordReconciliation(record: any): { finalStatus: string; finalErrors: string[] } {
    return this.reconcileCoreService.evaluateRecordReconciliation(record);
  }

  async getTkgdStats(userEmail: string, batchDate?: string) {
    return this.reconcileCoreService.getTkgdStats(userEmail, batchDate);
  }

  async getAnalyticsSummary(userEmail: string, batchDate?: string, shift?: string, range?: string) {
    return this.reconcileCoreService.getAnalyticsSummary(userEmail, batchDate, shift, range);
  }

  async manualApproveRecord(recordId: string, userEmail: string, reason?: string) {
    return this.reconcileCoreService.manualApproveRecord(recordId, userEmail, reason);
  }

  async revertManualApprove(recordId: string, userEmail: string) {
    return this.reconcileCoreService.revertManualApprove(recordId, userEmail);
  }

  async runReconciliation(userEmail: string, batchDate?: string) {
    return this.reconcileCoreService.runReconciliation(userEmail, batchDate);
  }

  // ═══════════════════════════════════════════════════════════
  // V. EXCEL EXPORT  →  TkgdExcelExportService
  // ═══════════════════════════════════════════════════════════

  async getLatestExcelFilePath(userEmail: string): Promise<string | null> {
    return this.excelExportService.getLatestExcelFilePath(userEmail);
  }

  async getAccountFilesManifest(userEmail: string, accountCode: string, batchDate?: string) {
    return this.excelExportService.getAccountFilesManifest(userEmail, accountCode, batchDate);
  }

  async resolveAttachmentFilePath(
    userEmail: string,
    options: { accountCode?: string; batchDate?: string; fileName?: string; filePath?: string },
  ) {
    return this.excelExportService.resolveAttachmentFilePath(userEmail, options);
  }

  // ═══════════════════════════════════════════════════════════
  // VI. MAIL INGEST  →  TkgdMailIngestService
  // ═══════════════════════════════════════════════════════════

  async syncMailOpeningAccounts(userEmail: string, options?: any) {
    const batchDate = typeof options === 'string' ? options : options?.batchDate;
    return this.mailIngestService.syncMailOpeningAccounts(userEmail, batchDate);
  }

  // ═══════════════════════════════════════════════════════════
  // VII. M-SYSTEM SCRAPING  →  TkgdReconcileCoreService
  // ═══════════════════════════════════════════════════════════

  async syncMSystemAccounts(
    userEmail: string,
    options?: { investorCode?: string; investorCodes?: string[]; downloadImages?: boolean; batchDate?: string },
  ) {
    return this.msCrawlerService.syncMSystemAccounts(userEmail, options);
  }

  // ═══════════════════════════════════════════════════════════
  // VIII. OCR / REPARSE  →  TkgdReconcileCoreService
  // ═══════════════════════════════════════════════════════════

  async reparseAccount(userEmail: string, options?: { recordId?: string; accountCode?: string; batchDate?: string }) {
    return this.reconcileCoreService.reparseAccount(userEmail, options);
  }

  async reEvaluateRecord(recordId: string, userEmail: string, forceReparse?: boolean) {
    return this.reconcileCoreService.reEvaluateRecord(recordId, userEmail, forceReparse);
  }

  async bulkReEvaluate(recordIds: string[], userEmail: string) {
    return this.reconcileCoreService.bulkReEvaluate(recordIds, userEmail);
  }

  async bulkSyncMSystem(accountCodes: string[], userEmail: string) {
    return this.msCrawlerService.bulkSyncMSystem(accountCodes, userEmail);
  }

  // ═══════════════════════════════════════════════════════════
  // IX. PIPELINE ORCHESTRATION  (Facade — điều phối cao cấp)
  // ═══════════════════════════════════════════════════════════

  /**
   * Pipeline tổng hợp (All-in-One): Mail → M-System → Đối soát → Ghi log
   */
  async runPipelineAll(
    userEmail: string,
    options?: {
      downloadImages?: boolean;
      batchDate?: string;
      fromDateTime?: string;
      toDateTime?: string;
      forceReparse?: boolean;
    },
  ) {
    this.progressService.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'ALL',
      current: 1,
      total: 3,
      percent: 15,
      stage: 'Bước 1/3: Đang quét email mở TKGD và hồ sơ đính kèm...',
    });

    const mailResult = await this.mailIngestService.syncMailOpeningAccounts(
      userEmail,
      options?.batchDate,
    );

    this.progressService.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'ALL',
      current: 2,
      total: 3,
      percent: 50,
      stage: 'Bước 2/3: Đang cào dữ liệu từ M-System...',
    });

    const msResult = await this.msCrawlerService.syncMSystemAccounts(userEmail, {
      downloadImages: options?.downloadImages !== undefined ? options.downloadImages : true,
      batchDate: options?.batchDate,
    });

    this.progressService.updateProgress(userEmail, {
      isProcessing: false,
      taskType: 'IDLE',
      current: 3,
      total: 3,
      percent: 100,
      stage: 'Hoàn tất toàn bộ chu trình tự động A-Z!',
    });

    await this.logActivity({
      action: 'RUN_PIPELINE',
      title: 'Hoàn tất chu trình tổng hợp TKGD',
      details: JSON.stringify({ mail: (mailResult as any)?.summary, ms: (msResult as any)?.summary }),
      userEmail,
    });

    return { success: true, mailResult, msResult };
  }

  /**
   * Bulk E2E: OCR → M-System → Tái thẩm định cho danh sách hồ sơ
   */
  async bulkReRunE2E(
    recordIds: string[],
    userEmail: string,
    options?: { reparseOcr?: boolean; resyncMSystem?: boolean; reEvaluate?: boolean },
  ) {
    const result = await this.reconcileCoreService.bulkReRunE2E(recordIds, userEmail, options);
    if (options?.resyncMSystem !== false) {
      const records = await this.reconcileCoreService
        .getModel()
        .find({ _id: { $in: recordIds } })
        .select('maTKGDBase maTKGD')
        .lean();
      const accountCodes = records.map((record: any) => record.maTKGDBase || record.maTKGD).filter(Boolean);
      await this.msCrawlerService.bulkSyncMSystem(accountCodes, userEmail);
    }
    return result;
  }

  async autoReconcilePendingMismatches(daysBack = 7) {
    return this.reconcileCoreService.autoReconcilePendingMismatches(daysBack);
  }

  // ═══════════════════════════════════════════════════════════
  // X. CRON & AUTO-PIPELINE  (Scheduler — chỉ ở Facade)
  // ═══════════════════════════════════════════════════════════

  /** Quét ngầm & chữa lành hồ sơ LỆCH/CẦN_KIỂM_TRA mỗi 30 phút */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handleCronAutoReconcilePending() {
    try {
      const res = await this.reconcileCoreService.autoReconcilePendingMismatches(7);
      if (res.checkedCount > 0) {
        this.logger.log(`[AUTO-RECONCILE] ${res.checkedCount} ca, chữa lành: ${res.healedCount} ca.`);
      }
    } catch (err: any) {
      this.logger.warn(`[AUTO-RECONCILE] Lỗi: ${err.message}`);
    }
  }

  /** Kích hoạt Auto-Pipeline cho user đã bật (kiểm tra mỗi 5 phút) */
  @Cron('*/5 * * * *')
  async handleCronAutoPipeline(forceRun = false) {
    try {
      // 1. Phân định vai trò Node: Nếu Node được cấu hình là Web-Only, tuyệt đối không chạy cron
      if (process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'false') {
        return;
      }

      // 2. Chế độ Dedicated Worker: Nếu đặt ENABLE_TKGD_BACKGROUND_WORKER=true hoặc TKGD_LOCAL_AUTO_RUNNER=true
      // Node này sẽ chủ động thực thi chu trình tự động ngay cả khi cờ trên DB chung đang tạm tắt (tránh xung đột Web Server)
      const isDedicatedWorker =
        process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'true' ||
        process.env.TKGD_LOCAL_AUTO_RUNNER === 'true';

      // Khi Dedicated Worker: vẫn phải lọc user có cấu hình M-System hợp lệ
      // (có msystem.username) — tránh chạy với user chưa cấu hình → login fail
      const filter = isDedicatedWorker
        ? { 'msystem.username': { $exists: true, $ne: '' } }
        : { 'autoPipeline.enabled': true };
      const enabledUsers = await this.userConfigModel
        .find(filter)
        .select('userEmail autoPipeline msystem')
        .lean();

      if (isDedicatedWorker && enabledUsers.length > 0) {
        this.logger.log(`[TKGD-WORKER] Dedicated Worker dang quet chu trinh tu dong cho ${enabledUsers.length} user...`);
      }

      for (const cfg of enabledUsers) {
        const userEmail = cfg.userEmail;
        if (this.autoPipelineRunningUsers.has(userEmail)) continue;
        const ap = (cfg as any).autoPipeline;
        const interval = ap?.intervalMinutes ?? 5;
        const lastRun = ap?.lastRunTime ?? 0;
        if (!forceRun && Date.now() - lastRun < interval * 60 * 1000) continue;
        this.runAutoPipelineCycle(userEmail).catch((err) => {
          this.logger.warn(`[TKGD-AUTO] ${userEmail}: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.warn(`[TKGD-CRON] ${err.message}`);
    }
  }

  async runAutoPipelineCycle(userEmail: string): Promise<{ success: boolean; processedCount: number; message: string }> {
    if (this.autoPipelineRunningUsers.has(userEmail)) {
      return { success: false, processedCount: 0, message: 'Chu trình đang chạy cho user này.' };
    }
    this.autoPipelineRunningUsers.add(userEmail);
    try {
      await this.runPipelineAll(userEmail);
      await this.userConfigModel.updateOne(
        { userEmail },
        { 'autoPipeline.lastRunTime': Date.now(), 'autoPipeline.lastProcessedCount': 1 },
      );
      return { success: true, processedCount: 1, message: 'Chu trình tự động hoàn tất.' };
    } catch (err: any) {
      this.logger.error(`[TKGD-AUTO] Lỗi: ${err.message}`);
      return { success: false, processedCount: 0, message: err.message };
    } finally {
      this.autoPipelineRunningUsers.delete(userEmail);
    }
  }

  async toggleAutoPipeline(userEmail: string, enabled?: boolean) {
    const cfg = await this.userConfigModel.findOne({ userEmail });
    const newStatus = enabled !== undefined ? enabled : !((cfg as any)?.autoPipeline?.enabled ?? false);
    await this.userConfigModel.findOneAndUpdate(
      { userEmail },
      { $set: { 'autoPipeline.enabled': newStatus } },
      { upsert: true },
    );
    const interval = (cfg as any)?.autoPipeline?.intervalMinutes ?? 1;
    return {
      success: true,
      enabled: newStatus,
      message: newStatus
        ? `Đã bật Tự Động 24/7 (mỗi ${interval} phút).`
        : 'Đã tắt Tự Động 24/7.',
    };
  }

  async getAutoPipelineStatus(userEmail: string) {
    const cfg = await this.userConfigModel.findOne({ userEmail }).lean();
    const ap = (cfg as any)?.autoPipeline;
    return {
      enabled: ap?.enabled ?? false,
      executionMode: ap?.executionMode ?? 'BATCH',
      isRunning: this.autoPipelineRunningUsers.has(userEmail),
      lastRunTime: ap?.lastRunTime ?? 0,
      lastProcessedCount: ap?.lastProcessedCount ?? 0,
      intervalMinutes: ap?.intervalMinutes ?? 5,
      nextRunTime: (ap?.lastRunTime ?? 0) > 0 ? ap.lastRunTime + (ap.intervalMinutes ?? 5) * 60 * 1000 : 0,
    };
  }

  async runHistoricalBackfill(userEmail: string, fromDate?: string, toDate?: string) {
    this.logger.log(`[TKGD-BACKFILL] ${userEmail} quét vét từ ${fromDate || 'toàn bộ'} đến ${toDate || 'nay'}`);
    return this.runAutoPipelineCycle(userEmail);
  }
}
