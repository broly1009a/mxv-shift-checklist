import { Injectable, Logger, Optional, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../schemas/tkgd-user-config.schema';
import { TkgdActivityLog, TkgdActivityLogDocument } from '../../schemas/tkgd-activity-log.schema';
import { TkgdExtractionLog, TkgdExtractionLogDocument } from '../../schemas/tkgd-extraction-log.schema';

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
  private isMailSyncRunning = false;
  private isMsCrawlerRunning = false;

  constructor(
    @InjectModel(TkgdUserConfig.name) private userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(TkgdActivityLog.name) private activityLogModel: Model<TkgdActivityLogDocument>,
    @InjectModel(TkgdExtractionLog.name) private extractionLogModel: Model<TkgdExtractionLogDocument>,
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
      this.logger.log('[TKGD-ROLE] Node role: DEDICATED_WORKER (Kich hoat Background Worker chay ngam song song).');
      // Kích hoạt ngay 2 luồng quét độc lập sau 5s khởi động: Quét Mail & Cào M-System song song
      setTimeout(() => {
        this.logger.log('[TKGD-WORKER] 🚀 Khởi động độc lập 2 luồng song song: Quét Mail & Cào M-System...');
        this.handleCronMailSync().catch((err) => {
          this.logger.warn(`[TKGD-WORKER-MAIL-INIT] Lỗi: ${err.message}`);
        });
        this.handleCronMsCrawler().catch((err) => {
          this.logger.warn(`[TKGD-WORKER-MS-INIT] Lỗi: ${err.message}`);
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

  /**
   * Lấy toàn bộ nhật ký bóc tách & truy vết chi tiết của 1 tài khoản
   */
  async getExtractionLogs(accountCode: string, batchDate?: string) {
    const filter: any = {
      maTKGD: accountCode.trim(),
    };
    if (batchDate && batchDate.trim()) {
      filter.batchDate = batchDate.trim();
    }
    return await this.extractionLogModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  /**
   * Lấy danh sách toàn bộ nhật ký bóc tách & cào M-System có phân trang và bộ lọc
   */
  async getAllExtractionLogs(query: {
    page?: number;
    limit?: number;
    stage?: string;
    status?: string;
    search?: string;
    batchDate?: string;
  }): Promise<{ data: any[]; total: number; page: number; pages: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: any = {};
    if (query.stage && query.stage !== 'ALL') filter.stage = query.stage;
    if (query.status && query.status !== 'ALL') filter.status = query.status;
    if (query.batchDate && query.batchDate.trim()) filter.batchDate = query.batchDate.trim();
    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), 'i');
      filter.$or = [{ maTKGD: regex }, { title: regex }, { details: regex }, { performer: regex }];
    }
    const total = await this.extractionLogModel.countDocuments(filter);
    const data = await this.extractionLogModel
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

  async getTkgdStats(userEmail: string, batchDate?: string, startDate?: string, endDate?: string) {
    return this.reconcileCoreService.getTkgdStats(userEmail, batchDate, startDate, endDate);
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

  async getLatestExcelFilePath(userEmail: string, batchDate?: string): Promise<string | null> {
    return this.excelExportService.getLatestExcelFilePath(userEmail, batchDate);
  }

  async exportFilteredExcel(
    userEmail: string,
    options: {
      batchDate?: string;
      startDate?: string;
      endDate?: string;
      filter?: string;
      search?: string;
    },
  ) {
    return this.excelExportService.exportFilteredExcel(userEmail, options);
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
    options?: {
      investorCode?: string;
      investorCodes?: string[];
      downloadImages?: boolean;
      batchDate?: string;
      mode?: 'REALTIME' | 'HEALING';
      limit?: number;
      maTVKD?: string;
    },
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
      total: 2,
      percent: 30,
      stage: 'Đang chạy song song: Quét Email/OCR Hợp đồng & Cào dữ liệu M-System...',
    });

    this.logger.log('[TKGD-PIPELINE] 🚀 Kích hoạt song song: Luồng Quét Email/OCR & Luồng Cào M-System Playwright...');

    // CHẠY SONG SONG (PARALLEL DUAL RUN):
    // Luồng Mail & Luồng Cào MS là 2 tác vụ độc lập, chạy đồng thời để M-System không phải chờ bóc tách xong 100+ email.
    const [mailResult, msResult] = await Promise.all([
      this.mailIngestService
        .syncMailOpeningAccounts(userEmail, options?.batchDate)
        .catch((err) => {
          this.logger.error(`[PIPELINE-MAIL] Lỗi quét email: ${err.message}`, err.stack);
          return { success: false, error: err.message };
        }),
      this.msCrawlerService
        .syncMSystemAccounts(userEmail, {
          downloadImages: options?.downloadImages !== undefined ? options.downloadImages : true,
          batchDate: options?.batchDate,
          mode: 'REALTIME',
        })
        .catch((err) => {
          this.logger.error(`[PIPELINE-MS] Lỗi cào M-System: ${err.message}`, err.stack);
          return { success: false, error: err.message };
        }),
    ]);

    this.progressService.updateProgress(userEmail, {
      isProcessing: true,
      taskType: 'ALL',
      current: 2,
      total: 2,
      percent: 85,
      stage: 'Đang tổng hợp đối soát & xuất báo cáo...',
    });

    const reconResult = await this.reconcileCoreService.runReconciliation(
      userEmail,
      options?.batchDate,
    );

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
      details: JSON.stringify({
        mail: (mailResult as any)?.summary,
        ms: (msResult as any)?.results?.length,
        recon: (reconResult as any)?.summary,
      }),
      userEmail,
    });

    return { success: true, mailResult, msResult, reconResult };
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

  /** Luồng 1 (Mail Sync Cron): Quét email Outlook & OCR định kỳ mỗi 5 phút độc lập */
  @Cron('*/5 * * * *')
  async handleCronMailSync() {
    if (process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'false') return;
    if (this.isMailSyncRunning) {
      this.logger.log('[TKGD-CRON-MAIL] ⏳ Chu kỳ quét email trước vẫn đang chạy. Bỏ qua để không chồng lấn.');
      return;
    }

    try {
      const isDedicatedWorker =
        process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'true' ||
        process.env.TKGD_LOCAL_AUTO_RUNNER === 'true';

      const filter: any = { 'autoPipeline.enabled': true };
      if (isDedicatedWorker) {
        filter['msystem.username'] = { $exists: true, $ne: '' };
      }

      const config = await this.userConfigModel.findOne(filter).select('userEmail').lean();
      if (!config?.userEmail) return;

      this.isMailSyncRunning = true;
      this.logger.log(`[TKGD-CRON-MAIL] 📬 Bắt đầu chu kỳ quét email độc lập cho ${config.userEmail}...`);
      await this.mailIngestService.syncMailOpeningAccounts(config.userEmail);
    } catch (err: any) {
      this.logger.warn(`[TKGD-CRON-MAIL] Lỗi: ${err.message}`);
    } finally {
      this.isMailSyncRunning = false;
    }
  }

  /** Luồng 2 (M-System Crawler Cron): Cào M-System song song độc lập mỗi 2 phút, không chờ Mail */
  @Cron('*/2 * * * *')
  async handleCronMsCrawler() {
    if (process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'false') return;
    if (this.isMsCrawlerRunning) {
      this.logger.log('[TKGD-CRON-MS] ⏳ Chu kỳ cào M-System trước vẫn đang chạy. Bỏ qua để không chồng lấn.');
      return;
    }

    try {
      const isDedicatedWorker =
        process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'true' ||
        process.env.TKGD_LOCAL_AUTO_RUNNER === 'true';

      const filter: any = { 'autoPipeline.enabled': true };
      if (isDedicatedWorker) {
        filter['msystem.username'] = { $exists: true, $ne: '' };
      }

      const config = await this.userConfigModel.findOne(filter).select('userEmail').lean();
      if (!config?.userEmail) return;

      this.isMsCrawlerRunning = true;
      this.logger.log(`[TKGD-CRON-MS] 🌐 Bắt đầu chu kỳ cào M-System song song độc lập cho ${config.userEmail}...`);
      await this.msCrawlerService.syncMSystemAccounts(config.userEmail, {
        mode: 'REALTIME',
        limit: 25,
      });
    } catch (err: any) {
      this.logger.warn(`[TKGD-CRON-MS] Lỗi: ${err.message}`);
    } finally {
      this.isMsCrawlerRunning = false;
    }
  }

  /** Kích hoạt Auto-Pipeline tổng hợp theo yêu cầu (Manual / On-demand) */
  async handleCronAutoPipeline(forceRun = false) {
    try {
      if (process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'false') {
        return;
      }

      const isDedicatedWorker =
        process.env.ENABLE_TKGD_BACKGROUND_WORKER === 'true' ||
        process.env.TKGD_LOCAL_AUTO_RUNNER === 'true';

      const filter: any = { 'autoPipeline.enabled': true };
      if (isDedicatedWorker) {
        filter['msystem.username'] = { $exists: true, $ne: '' };
      }
      const enabledUsers = await this.userConfigModel
        .find(filter)
        .select('userEmail autoPipeline msystem')
        .lean();

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
