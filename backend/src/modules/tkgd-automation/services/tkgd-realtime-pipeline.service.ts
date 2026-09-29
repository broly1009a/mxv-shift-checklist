import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { CleanAccountRecord, CleanAccountRecordDocument } from '../../../schemas/clean-account-record.schema';
import { TkgdUserConfig, TkgdUserConfigDocument } from '../../../schemas/tkgd-user-config.schema';
import { TkgdActivityLog, TkgdActivityLogDocument } from '../../../schemas/tkgd-activity-log.schema';
import { RawAccountMail, RawAccountMailDocument } from '../../../schemas/raw-account-mail.schema';
import { TkgdMsPersistentService, MsScrapeResult } from './tkgd-ms-persistent.service';
import { TkgdProgressService } from './tkgd-progress.service';
import { TkgdMailIngestService, StagedAccountInfo } from './tkgd-mail-ingest.service';
import { evaluateRecordReconciliationRule } from '../../bot-engine/helpers/tkgd-reconcile-rules.helper';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { runPythonExtractor, PythonExtractorResult } from '../../bot-engine/helpers/tkgd-python-bridge.helper';
import {
  isIgnoredEmailAttachment,
  pickCccdImagePaths,
  isNamedContractImage,
  isNamedCccdPdf,
  probeImageDimensions,
} from '../../bot-engine/helpers/tkgd-mail-parser.helper';
import { getTkgdAttachmentDirectory } from '../../bot-engine/helpers/tkgd-reconcile-exporter.helper';
import { decrypt } from '../../bot-engine/utils/crypto';

/**
 * Kết quả xử lý song song 1 hồ sơ
 */
export interface ProcessOneAccountResult {
  code: string;
  ocrSuccess: boolean;
  msSuccess: boolean;
  finalStatus: string;
  durationMs: number;
}

function parseDate(dStr?: string): Date | undefined {
  if (!dStr) return undefined;
  const s = dStr.trim().replace(/-/g, '/');
  const p = s.split('/');
  if (p.length === 3) {
    let dd: number, mm: number, yyyy: number;
    if (p[0].length === 4) {
      yyyy = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      dd = parseInt(p[2], 10);
    } else {
      dd = parseInt(p[0], 10);
      mm = parseInt(p[1], 10) - 1;
      yyyy = parseInt(p[2], 10);
    }
    const d = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0));
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? undefined : d;
}

function inferFromCCCD(soCCCD?: string): { gioiTinh?: string; namSinh?: number } {
  if (!soCCCD) return {};
  const clean = soCCCD.replace(/\D/g, '');
  if (clean.length !== 12) return {};
  const genderCenturyDigit = parseInt(clean.charAt(3), 10);
  let gioiTinh: string | undefined = undefined;
  let century = 1900;
  if (genderCenturyDigit === 0 || genderCenturyDigit === 1) {
    century = 1900;
    gioiTinh = genderCenturyDigit === 0 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 2 || genderCenturyDigit === 3) {
    century = 2000;
    gioiTinh = genderCenturyDigit === 2 ? 'Nam' : 'Nữ';
  } else if (genderCenturyDigit === 4 || genderCenturyDigit === 5) {
    century = 2100;
    gioiTinh = genderCenturyDigit === 4 ? 'Nam' : 'Nữ';
  }
  const yearShort = parseInt(clean.substring(4, 6), 10);
  const namSinh = century + yearShort;
  return { gioiTinh, namSinh };
}

/**
 * TkgdRealtimePipelineService — Orchestrator Song Song Nội Bộ Từng Hồ Sơ (Intra-Record Parallel Pipeline)
 *
 * Đáp ứng yêu cầu nghiệp vụ:
 * 1. Khi quét được email có TKGD: Lập tức kích hoạt SONG SONG cả 2 luồng:
 *    - Luồng A (CPU-bound): Bóc tách PDF Hợp đồng + OCR CCCD mặt trước/sau
 *    - Luồng B (I/O-bound): M-System Persistent Browser cào dữ liệu NĐT + tải ảnh CCCD/chữ ký MS
 * 2. Concurrency = 1 tài khoản tại một thời điểm (an toàn tuyệt đối cho session M-System).
 * 3. Cả 2 luồng hoàn thành (Promise.all) → Bảo chứng chéo hash MD5 ảnh → Đối soát chéo 3 bên tức thì.
 * 4. Cập nhật MongoDB Atlas + Push Realtime UI trong ~2.5s/hồ sơ (nhanh gấp đôi tuần tự).
 */
@Injectable()
export class TkgdRealtimePipelineService implements OnModuleDestroy {
  private readonly logger = new Logger(TkgdRealtimePipelineService.name);

  // Per-user execution mutex: Chặn cùng 1 user chạy đè chu kỳ
  private readonly runningUsers = new Set<string>();

  // Stream timers map: Quản lý các polling streams đang chạy
  private readonly activeStreams = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectModel(CleanAccountRecord.name)
    private readonly cleanRecordModel: Model<CleanAccountRecordDocument>,
    @InjectModel(TkgdUserConfig.name)
    private readonly userConfigModel: Model<TkgdUserConfigDocument>,
    @InjectModel(TkgdActivityLog.name)
    private readonly activityLogModel: Model<TkgdActivityLogDocument>,
    @InjectModel(RawAccountMail.name)
    private readonly rawMailModel: Model<RawAccountMailDocument>,
    @Optional()
    private readonly msPersistentService?: TkgdMsPersistentService,
    @Optional()
    private readonly progressService?: TkgdProgressService,
    @Optional()
    private readonly mailIngestService?: TkgdMailIngestService,
    @Optional()
    private readonly settingsService?: SystemSettingsService,
  ) { }

  onModuleDestroy() {
    for (const [userEmail, timer] of this.activeStreams.entries()) {
      clearInterval(timer);
      this.logger.log(`[TKGD-RT] Dọn dẹp stream cho ${userEmail} khi shutdown.`);
    }
    this.activeStreams.clear();
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC API: CHU TRÌNH CHÍNH (REALTIME CYCLE)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Chạy 1 chu trình Realtime Pipeline hoàn chỉnh:
   * Staging Mail → Bóc tách OCR & Cào M-System SONG SONG → Đối soát → Push Realtime
   *
   * @param userEmail Email user (để lấy credentials, config)
   * @returns Kết quả tổng hợp
   */
  async runRealtimeCycle(userEmail: string): Promise<{
    success: boolean;
    processedCount: number;
    results: ProcessOneAccountResult[];
    message: string;
  }> {
    if (this.runningUsers.has(userEmail)) {
      return {
        success: false,
        processedCount: 0,
        results: [],
        message: `${userEmail} đang trong chu kỳ xử lý, bỏ qua để tránh trùng lặp.`,
      };
    }

    this.runningUsers.add(userEmail);
    this.logger.log(`[TKGD-RT] ⚡ Bắt đầu chu trình Realtime Song Song cho ${userEmail}...`);

    const PIPELINE_TIMEOUT_MS = 8 * 60 * 1000;
    const results: ProcessOneAccountResult[] = [];

    try {
      const pipelineTask = async () => {
        const userCfg = await this.userConfigModel.findOne({ userEmail }).lean();
        const shouldSyncMS = userCfg?.autoPipeline?.autoSyncMSystem !== false;
        const todayStr = new Date().toISOString().slice(0, 10);

        // ── BƯỚC 1: Quét email mới & Staging file đính kèm (KHÔNG chạy OCR) ──
        this.updateProgress(userEmail, {
          isProcessing: true,
          taskType: 'SYNC_MAIL',
          stage: '[Realtime] Đang quét email và staging tệp đính kèm...',
          percent: 10,
        });

        let stagedAccounts: StagedAccountInfo[] = [];
        if (this.mailIngestService) {
          const stageRes = await this.mailIngestService.stageMailOpeningAccounts(userEmail, todayStr);
          stagedAccounts = stageRes.stagedAccounts || [];
          if (stagedAccounts.length > 0) {
            this.logger.log(`[TKGD-RT] Staging thành công ${stagedAccounts.length} hồ sơ mới từ email.`);
          }
        }

        // ── BƯỚC 2: Khởi tạo Persistent Browser Session (nếu có hồ sơ cần xử lý) ──
        if (shouldSyncMS && this.msPersistentService) {
          await this.msPersistentService.initialize(userEmail);
        }

        // ── BƯỚC 3: Xử lý các hồ sơ vừa nạp từ Email (OCR + MS SONG SONG) ──
        const processedCodes = new Set<string>();

        for (let idx = 0; idx < stagedAccounts.length; idx++) {
          const staged = stagedAccounts[idx];
          const baseCode = staged.baseCode;
          processedCodes.add(baseCode);

          this.updateProgress(userEmail, {
            isProcessing: true,
            taskType: 'SYNC_MS',
            current: idx + 1,
            total: stagedAccounts.length,
            percent: 15 + Math.round(((idx + 1) / Math.max(1, stagedAccounts.length)) * 70),
            currentCode: baseCode,
            stage: `[Realtime Song Song] Xử lý hồ sơ mới: ${baseCode} (${idx + 1}/${stagedAccounts.length})...`,
          });

          try {
            const freshDoc = await this.cleanRecordModel.findById(staged.recordId);
            if (freshDoc) {
              const res = await this.processOneAccount(
                baseCode,
                freshDoc,
                userEmail,
                todayStr,
                staged.attachFiles,
                staged.group,
              );
              results.push(res);
            }
          } catch (err: any) {
            this.logger.error(`[TKGD-RT] Lỗi xử lý ${baseCode}: ${err.message}`);
            results.push({
              code: baseCode,
              ocrSuccess: false,
              msSuccess: false,
              finalStatus: 'ERROR',
              durationMs: 0,
            });
          }
        }

        // ── BƯỚC 4: Xử lý các hồ sơ chờ còn tồn đọng trong DB (nếu có) ──
        if (shouldSyncMS) {
          const pendingRecords = await this.cleanRecordModel
            .find({
              maTKGDBase: { $nin: Array.from(processedCodes) },
              $or: [
                { 'ms.isFoundOnMS': { $ne: true } },
                { ms: null },
                { 'ketLuan.trangThai': 'CHUA_XU_LY' },
              ],
            })
            .sort({ createdAt: -1 })
            .limit(userCfg?.autoPipeline?.batchSize || 10);

          if (pendingRecords.length > 0) {
            this.logger.log(`[TKGD-RT] Tìm thấy ${pendingRecords.length} hồ sơ tồn đọng cần hoàn thiện đối soát.`);

            for (let idx = 0; idx < pendingRecords.length; idx++) {
              const record = pendingRecords[idx];
              const baseCode = record.maTKGDBase || record.noiDungMail?.maTKGD_Futures || record.maTKGD?.split('-')[0] || '';
              if (!baseCode || processedCodes.has(baseCode)) continue;
              processedCodes.add(baseCode);

              this.updateProgress(userEmail, {
                isProcessing: true,
                taskType: 'SYNC_MS',
                current: idx + 1,
                total: pendingRecords.length,
                percent: 85 + Math.round(((idx + 1) / pendingRecords.length) * 14),
                currentCode: baseCode,
                stage: `[Realtime Song Song] Xử lý tồn đọng: ${baseCode}...`,
              });

              try {
                const res = await this.processOneAccount(baseCode, record, userEmail, todayStr);
                results.push(res);
              } catch (err: any) {
                this.logger.error(`[TKGD-RT] Lỗi xử lý tồn đọng ${baseCode}: ${err.message}`);
              }
            }
          }
        }

        return results;
      };

      await Promise.race([
        pipelineTask(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Pipeline timeout sau ${PIPELINE_TIMEOUT_MS / 60000} phút`)), PIPELINE_TIMEOUT_MS),
        ),
      ]);

      // Lưu timestamp lần chạy cuối
      await this.userConfigModel.updateOne(
        { userEmail },
        { $set: { 'autoPipeline.lastRunTime': Date.now(), 'autoPipeline.lastProcessedCount': results.length } },
      );

      const successCount = results.filter((r) => r.msSuccess || r.ocrSuccess).length;
      this.updateProgress(userEmail, {
        isProcessing: false,
        taskType: 'IDLE',
        percent: 100,
        stage: `Hoàn tất chu kỳ Realtime Song Song: đã xử lý ${results.length} hồ sơ (${successCount} thành công).`,
      });

      this.logger.log(`[TKGD-RT] ✅ Hoàn tất chu trình Realtime. ${successCount}/${results.length} hồ sơ thành công.`);

      return {
        success: true,
        processedCount: successCount,
        results,
        message: `Đã xử lý song song ${results.length} hồ sơ (${successCount} thành công).`,
      };
    } catch (err: any) {
      this.logger.error(`[TKGD-RT] ❌ Chu trình Realtime thất bại: ${err.message}`);
      this.updateProgress(userEmail, {
        isProcessing: false,
        taskType: 'IDLE',
        percent: 0,
        stage: `Lỗi chu trình: ${err.message}`,
      });
      return {
        success: false,
        processedCount: 0,
        results,
        message: `Lỗi: ${err.message}`,
      };
    } finally {
      this.runningUsers.delete(userEmail);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CORE: XỬ LÝ SONG SONG NỘI BỘ 1 HỒ SƠ (INTRA-RECORD CONCURRENCY)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Xử lý 1 hồ sơ với 2 luồng song song:
   * - Luồng A (CPU-bound): Python OCR bóc tách CCCD + PDF Hợp đồng (~2.5s)
   * - Luồng B (I/O-bound): Chromium Persistent cào dữ liệu M-System (~1.8s)
   *
   * 2 luồng dùng 2 loại tài nguyên khác nhau → Zero Resource Contention.
   * Tổng thời gian = max(OCR, MS) ≈ 2.5s thay vì tuần tự OCR + MS ≈ 5.0s.
   */
  async processOneAccount(
    baseCode: string,
    record: CleanAccountRecordDocument,
    userEmail: string,
    todayStr: string,
    stagedAttachFiles?: {
      hopDongPath?: string;
      phuLucPath?: string;
      cccdFrontPath?: string;
      cccdBackPath?: string;
    },
    groupInfo?: any,
  ): Promise<ProcessOneAccountResult> {
    const startTime = Date.now();
    this.logger.log(`[TKGD-RT] ⚡ [${baseCode}] Bắt đầu xử lý song song (Luồng A: OCR + Luồng B: M-System)...`);

    // ── Xác định file đính kèm để chạy OCR ────────────────────────────
    let filesToUse = stagedAttachFiles;
    if (!filesToUse || (!filesToUse.hopDongPath && !filesToUse.cccdFrontPath)) {
      const config = await this.userConfigModel.findOne({ userEmail }).lean();
      const attachDir = getTkgdAttachmentDirectory(
        config?.documentProcessing?.attachmentSavePath,
        todayStr,
        baseCode,
      );
      filesToUse = this.findExistingAccountFiles(attachDir, baseCode);
    }

    const geminiKey = await this.getGeminiApiKey();

    // ── KÍCH HOẠT ĐỒNG THỜI 2 LUỒNG SONG SONG BẰNG PROMISE.ALL ─────────
    const [ocrResult, msResult] = await Promise.all([
      // Luồng A: Python OCR (CPU-bound)
      this.runOcrExtraction(baseCode, record, filesToUse, groupInfo, geminiKey).catch((err) => {
        this.logger.warn(`[TKGD-RT] OCR thất bại cho ${baseCode}: ${err.message}`);
        return null as PythonExtractorResult | null;
      }),

      // Luồng B: M-System Scrape (I/O-bound)
      this.runMsScrape(baseCode, userEmail, todayStr).catch((err) => {
        this.logger.warn(`[TKGD-RT] MS scrape thất bại cho ${baseCode}: ${err.message}`);
        return { maTKGD: baseCode, isFoundOnMS: false } as MsScrapeResult;
      }),
    ]);

    const ocrSuccess = !!(ocrResult && (ocrResult.hopDong || ocrResult.canCuoc));
    const msSuccess = !!(msResult && msResult.isFoundOnMS);

    // ── BÓC TÁCH KẾT QUẢ OCR VÀO SCHEMA ──────────────────────────────
    const { hopDongData, phuLucData, cccdData } = this.mapOcrResultToRecordFields(
      ocrResult,
      groupInfo || record.noiDungMail,
      baseCode,
    );

    // ── BẢO CHỨNG CHÉO HASH ẢNH (RULE 6.3) ───────────────────────────
    const docObj = record.toObject ? record.toObject() : record;
    const workingRecord: any = {
      ...docObj,
      ...(hopDongData ? { hopDong: hopDongData } : {}),
      ...(phuLucData ? { phuLuc: phuLucData } : {}),
      ...(cccdData ? { canCuoc: cccdData } : {}),
      ...(msResult && msResult.isFoundOnMS ? { ms: msResult } : {}),
    };

    if (msSuccess) {
      await this.verifyAndHealWithImageHash(workingRecord, todayStr, baseCode);
    }

    // ── ĐỐI SOÁT CHÉO TỨC THÌ 3 BÊN ───────────────────────────────────
    const evalResult = evaluateRecordReconciliationRule(workingRecord);
    const finalStatus = evalResult.finalStatus;
    const finalErrors = evalResult.finalErrors;

    // ── CẬP NHẬT DATABASE ATOMIC TRONG 1 LỆNH $SET ────────────────────
    const updateSet: Record<string, any> = {
      'ketLuan.trangThai': finalStatus,
      'ketLuan.danhSachLoi': finalErrors,
      'ketLuan.reconciledAt': new Date(),
      trangThaiDoiSoat: finalStatus,
      lyDoLoi: finalErrors,
      daDoiSoat: true,
      thoiGianDoiSoat: new Date(),
    };

    if (hopDongData) updateSet.hopDong = hopDongData;
    if (phuLucData) updateSet.phuLuc = phuLucData;
    if (workingRecord.canCuoc) updateSet.canCuoc = workingRecord.canCuoc;
    if (msResult && msResult.isFoundOnMS) updateSet.ms = msResult;

    await this.cleanRecordModel.updateOne({ _id: record._id }, { $set: updateSet });

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[TKGD-RT] ⚡ [${baseCode}] Hoàn tất trong ${(durationMs / 1000).toFixed(1)}s ` +
      `| OCR: ${ocrSuccess ? 'OK' : 'SKIP'} | MS: ${msSuccess ? 'OK' : 'SKIP'} | Kết luận: ${finalStatus}`,
    );

    // Ghi Activity Log
    await this.logActivity({
      action: 'REALTIME_PROCESS',
      title: `Đối soát song song: ${baseCode}`,
      details: `OCR: ${ocrSuccess ? 'OK' : 'Bỏ qua'}, MS: ${msSuccess ? 'OK' : 'Bỏ qua'}, Kết luận: ${finalStatus} (${(durationMs / 1000).toFixed(1)}s)`,
      userEmail,
      metadata: {
        baseCode,
        durationMs,
        finalStatus,
        ocrSuccess,
        msSuccess,
      },
    });

    return { code: baseCode, ocrSuccess, msSuccess, finalStatus, durationMs };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SHORT-POLLING REALTIME STREAM (15s POLLING LOOP)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Bật luồng realtime stream short-polling liên tục cho 1 user (mặc định 15 giây)
   */
  startMailStream(userEmail: string, intervalSeconds: number = 15): { success: boolean; message: string } {
    if (this.activeStreams.has(userEmail)) {
      return { success: true, message: `Luồng Realtime Stream cho ${userEmail} đang hoạt động.` };
    }

    const intervalMs = Math.max(5, intervalSeconds) * 1000;
    this.logger.log(`[TKGD-RT] 🚀 Khởi động Realtime Mail Stream cho ${userEmail} (chu kỳ ${intervalMs / 1000}s)...`);

    // Chạy ngay lần đầu
    this.runRealtimeCycle(userEmail).catch((err) => {
      this.logger.error(`[TKGD-RT-STREAM] Lỗi lần chạy đầu cho ${userEmail}: ${err.message}`);
    });

    // Thiết lập timer định kỳ
    const timer = setInterval(() => {
      this.runRealtimeCycle(userEmail).catch((err) => {
        this.logger.error(`[TKGD-RT-STREAM] Lỗi chu kỳ stream cho ${userEmail}: ${err.message}`);
      });
    }, intervalMs);

    this.activeStreams.set(userEmail, timer);
    return { success: true, message: `Đã kích hoạt Realtime Stream (chu kỳ ${intervalMs / 1000}s).` };
  }

  /**
   * Dừng luồng realtime stream cho 1 user
   */
  stopMailStream(userEmail: string): { success: boolean; message: string } {
    const timer = this.activeStreams.get(userEmail);
    if (timer) {
      clearInterval(timer);
      this.activeStreams.delete(userEmail);
      this.logger.log(`[TKGD-RT] 🛑 Đã dừng Realtime Mail Stream cho ${userEmail}.`);
      return { success: true, message: `Đã dừng Realtime Mail Stream.` };
    }
    return { success: false, message: `Luồng Realtime Stream cho ${userEmail} hiện không hoạt động.` };
  }

  /**
   * Kiểm tra trạng thái luồng realtime stream của user
   */
  isStreamActive(userEmail: string): boolean {
    return this.activeStreams.has(userEmail);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-TASK: LUỒNG A (OCR) & LUỒNG B (M-SYSTEM)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Luồng A: Chạy Python OCR bóc tách hồ sơ (PDF Hợp đồng + Ảnh CCCD 2 mặt)
   */
  private async runOcrExtraction(
    baseCode: string,
    record: CleanAccountRecordDocument,
    existingFiles: {
      hopDongPath?: string;
      phuLucPath?: string;
      cccdFrontPath?: string;
      cccdBackPath?: string;
    },
    groupInfo?: any,
    geminiKey?: string,
  ): Promise<PythonExtractorResult | null> {
    // Nếu hồ sơ đã có đủ dữ liệu OCR trước đó và không có file mới → bỏ qua
    const hasOcrData = record.hopDong?.hoVaTen || record.hopDong?.soCanCuoc || record.canCuoc?.soCanCuoc;
    if (hasOcrData && !existingFiles.hopDongPath && !existingFiles.cccdFrontPath) {
      this.logger.log(`[TKGD-RT] ${baseCode}: Đã có OCR data sẵn, bỏ qua chạy lại.`);
      return null;
    }

    if (!existingFiles.hopDongPath && !existingFiles.cccdFrontPath) {
      this.logger.log(`[TKGD-RT] ${baseCode}: Không có file HĐ/CCCD để bóc tách.`);
      return null;
    }

    const accountName = groupInfo?.tenTaiKhoan || (record.noiDungMail as any)?.tenTaiKhoan || '';

    return runPythonExtractor({
      accountCode: baseCode,
      accountName,
      hopDongPath: existingFiles.hopDongPath,
      phuLucPath: existingFiles.phuLucPath,
      cccdFrontPath: existingFiles.cccdFrontPath,
      cccdBackPath: existingFiles.cccdBackPath,
      geminiKey,
    });
  }

  /**
   * Luồng B: Cào dữ liệu M-System qua Persistent Session Pool (~1.5-2.0s)
   */
  private async runMsScrape(
    baseCode: string,
    userEmail: string,
    todayStr: string,
  ): Promise<MsScrapeResult> {
    if (!this.msPersistentService) {
      this.logger.warn(`[TKGD-RT] MsPersistentService chưa sẵn sàng, bỏ qua cào MS cho ${baseCode}.`);
      return { maTKGD: baseCode, isFoundOnMS: false };
    }

    return this.msPersistentService.scrapeAccount(baseCode, userEmail, {
      downloadImages: true,
      batchDate: todayStr,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // MAPPERS & HEALING HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Ánh xạ kết quả Python OCR thành các đối tượng Schema MongoDB
   */
  private mapOcrResultToRecordFields(
    pythonRes: PythonExtractorResult | null,
    group: any,
    baseCode: string,
  ): {
    hopDongData?: any;
    phuLucData?: any;
    cccdData?: any;
  } {
    if (!pythonRes) return {};

    let hopDongData: any = undefined;
    let phuLucData: any = undefined;
    let cccdData: any = undefined;

    if (pythonRes.hopDong) {
      hopDongData = {
        soHopDong: pythonRes.hopDong.soHopDong,
        maTKGD: group?.maTKGDFutures || baseCode,
        hoVaTen: pythonRes.hopDong.hoTen || group?.tenTaiKhoan,
        soCanCuoc: pythonRes.hopDong.soCCCD,
        ngaySinh: parseDate(pythonRes.hopDong.ngaySinh),
        rawNgaySinh: pythonRes.hopDong.rawNgaySinh || pythonRes.hopDong.ngaySinh,
        ngayCap: parseDate(pythonRes.hopDong.ngayCap),
        rawNgayCap: pythonRes.hopDong.rawNgayCap || pythonRes.hopDong.ngayCap,
        noiCap: pythonRes.hopDong.noiCap || undefined,
        ngayKyHD: parseDate(pythonRes.hopDong.ngayKyHD),
        gioiTinh: pythonRes.hopDong.gioiTinh,
        rawGioiTinh: pythonRes.hopDong.rawGioiTinh || pythonRes.hopDong.gioiTinh,
        loaiHinhTaiKhoan: 'Cá nhân',
        chuKy: 'Đã ký',
        dinhDangLoi: pythonRes.hopDong.dinhDangLoi || [],
      };
    }

    if (pythonRes.phuLuc) {
      phuLucData = {
        tenPhuLuc: (pythonRes.phuLuc as any).tenPhuLuc || (pythonRes.phuLuc.isPl01 ? 'PL01' : 'Phụ lục'),
        soPhuLuc: (pythonRes.phuLuc as any).soPhuLuc || pythonRes.phuLuc.maTKGD,
        dinhDangLoi: (pythonRes.phuLuc as any).dinhDangLoi || [],
      };
    }

    if (pythonRes.canCuoc) {
      const rawDob = pythonRes.canCuoc.rawNgaySinh || pythonRes.canCuoc.ngaySinh;
      const rawCap = pythonRes.canCuoc.rawNgayCap || pythonRes.canCuoc.ngayCap;
      const noiCapFinal = pythonRes.canCuoc.noiCap || hopDongData?.noiCap || undefined;
      cccdData = {
        soCanCuoc: pythonRes.canCuoc.soCCCD || hopDongData?.soCanCuoc,
        hoVaTen: pythonRes.canCuoc.hoTen || group?.tenTaiKhoan || hopDongData?.hoVaTen,
        ngaySinh: parseDate(pythonRes.canCuoc.ngaySinh) || hopDongData?.ngaySinh,
        rawNgaySinh: rawDob || hopDongData?.rawNgaySinh,
        ngayCap: parseDate(pythonRes.canCuoc.ngayCap) || hopDongData?.ngayCap,
        rawNgayCap: rawCap || hopDongData?.rawNgayCap,
        gioiTinh: pythonRes.canCuoc.gioiTinh || hopDongData?.gioiTinh,
        noiCap: noiCapFinal,
        diaChiThuongTru: pythonRes.canCuoc.diaChi,
        canhBaoChatLuong: pythonRes.canCuoc.canhBaoChatLuong || [],
        ocrConfidence: pythonRes.canCuoc.source || 'OCR',
        theGeneration: pythonRes.canCuoc.theGeneration,
        confidenceScore: pythonRes.canCuoc.confidenceScore,
        boundingBoxes: pythonRes.canCuoc.boundingBoxes,
      };
    }

    // Tự suy luận Giới tính & Năm sinh từ 12 số CCCD chuẩn nếu còn thiếu
    const cccdNumber = hopDongData?.soCanCuoc || cccdData?.soCanCuoc;
    if (cccdNumber) {
      const inferred = inferFromCCCD(cccdNumber);
      if (inferred.gioiTinh) {
        if (hopDongData && !hopDongData.gioiTinh) {
          hopDongData.gioiTinh = inferred.gioiTinh;
          hopDongData.rawGioiTinh = inferred.gioiTinh;
        }
        if (cccdData && !cccdData.gioiTinh) {
          cccdData.gioiTinh = inferred.gioiTinh;
        }
      }
      if (inferred.namSinh) {
        if (hopDongData && !hopDongData.rawNgaySinh && !hopDongData.ngaySinh) {
          hopDongData.rawNgaySinh = `${inferred.namSinh}`;
        }
        if (cccdData && !cccdData.rawNgaySinh && !cccdData.ngaySinh) {
          cccdData.rawNgaySinh = `${inferred.namSinh}`;
        }
      }
    }

    return { hopDongData, phuLucData, cccdData };
  }

  /**
   * Bảo chứng chéo hash MD5 ảnh giữa Email khách hàng và M-System (Rule 6.3)
   * Khi ảnh đính kèm mail trùng MD5 với ảnh M-System, danh tính đã được kiểm chứng chuẩn xác.
   * Ưu tiên trường thông tin: ms -> canCuoc -> hopDong.
   */
  private async verifyAndHealWithImageHash(
    record: any,
    batchDate: string,
    baseCode: string,
  ): Promise<boolean> {
    if (!record) return false;
    const msCccd = (record.ms?.soCMND_HoChieu || '').replace(/\D/g, '');
    const hdCccd = (record.hopDong?.soCanCuoc || '').replace(/\D/g, '');
    if (!msCccd || !hdCccd || msCccd !== hdCccd || msCccd.length !== 12) {
      return false;
    }

    const normName = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

    const msName = normName(record.ms?.hoVaTen || record.ms?.tenTKGD || '');
    const hdName = normName(record.hopDong?.hoVaTen || record.noiDungMail?.tenTaiKhoan || '');
    if (!msName || !hdName || msName !== hdName) {
      return false;
    }

    const candidates = [
      path.resolve(process.cwd(), 'data/temp_tkgd_attachments', baseCode),
      path.resolve('/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Mo TKGD/HoSo_DinhKem', batchDate || '', baseCode),
    ];
    const dir = candidates.find((p) => fs.existsSync(p));
    if (!dir) return false;

    try {
      const files = fs.readdirSync(dir);
      const isImg = (f: string) => ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => f.toLowerCase().endsWith(ext));
      const isMs = (f: string) => f.toLowerCase().includes('_ms_') || f.toLowerCase().startsWith(`${baseCode.toLowerCase()}_ms`);

      const mailImages = files.filter((f) => isImg(f) && !isMs(f));
      const msImages = files.filter((f) => isImg(f) && isMs(f));

      if (mailImages.length === 0 || msImages.length === 0) {
        return false;
      }

      const getMd5 = (fn: string) => {
        try {
          return crypto.createHash('md5').update(fs.readFileSync(path.join(dir, fn))).digest('hex');
        } catch {
          return null;
        }
      };

      let hasMatch = false;
      for (const mImg of mailImages) {
        const mMd5 = getMd5(mImg);
        if (!mMd5) continue;
        for (const sImg of msImages) {
          const sMd5 = getMd5(sImg);
          if (sMd5 && sMd5 === mMd5) {
            hasMatch = true;
            break;
          }
        }
        if (hasMatch) break;
      }

      if (!hasMatch) return false;

      this.logger.log(`[MD5-VERIFIED] Tài khoản ${baseCode}: Ảnh Mail và MS trùng khớp MD5 100%! HĐ và MS trùng số CCCD (${msCccd}). Kích hoạt bảo chứng chéo.`);

      // Thứ tự ưu tiên trường: M-System xác thực > OCR > HĐ (Rule 6.3)
      const updatedCanCuoc = {
        ...(record.canCuoc || {}),
        soCanCuoc: msCccd,
        hoVaTen: record.ms?.hoVaTen || record.hopDong?.hoVaTen,
        ngaySinh: record.ms?.ngaySinh || record.canCuoc?.ngaySinh || record.hopDong?.ngaySinh,
        rawNgaySinh: record.ms?.rawNgaySinh || record.canCuoc?.rawNgaySinh || record.hopDong?.rawNgaySinh,
        ngayCap: record.ms?.ngayCap || record.canCuoc?.ngayCap || record.hopDong?.ngayCap,
        rawNgayCap: record.ms?.rawNgayCap || record.canCuoc?.rawNgayCap || record.hopDong?.rawNgayCap,
        noiCap: record.ms?.noiCap || record.canCuoc?.noiCap || record.hopDong?.noiCap || 'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        gioiTinh: record.ms?.gioiTinh || record.canCuoc?.gioiTinh || record.hopDong?.gioiTinh,
        theGeneration: record.canCuoc?.theGeneration || 'CCCD_CHIP_2021',
        confidenceScore: 0.98,
        source: 'VERIFIED_MS_HASH',
        canhBaoChatLuong: [],
      };

      record.canCuoc = updatedCanCuoc;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Tìm các file hồ sơ đã tồn tại trên ổ đĩa cho 1 tài khoản
   */
  private findExistingAccountFiles(
    attachDir: string | undefined,
    baseCode: string,
  ): {
    hopDongPath?: string;
    phuLucPath?: string;
    cccdFrontPath?: string;
    cccdBackPath?: string;
  } {
    const candidateDirs = [
      attachDir,
      path.join(process.cwd(), 'data', 'temp_tkgd_attachments', baseCode),
    ].filter(Boolean) as string[];

    let targetDir: string | undefined;
    for (const d of candidateDirs) {
      if (fs.existsSync(d)) {
        targetDir = d;
        break;
      }
    }

    if (!targetDir) return {};

    const files = fs.readdirSync(targetDir);
    let hopDongPath: string | undefined;
    let phuLucPath: string | undefined;
    let cccdFrontPath: string | undefined;
    let cccdBackPath: string | undefined;

    for (const f of files) {
      const lower = f.toLowerCase();
      const fullPath = path.join(targetDir, f);

      // Bỏ qua file thumbnail M-System
      if (lower.includes('_ms_') || lower.includes('chuky') || lower.includes('signature') || lower.includes('sign')) {
        continue;
      }

      if (lower.endsWith('.pdf')) {
        if (isNamedCccdPdf(f)) {
          if (!cccdFrontPath) cccdFrontPath = fullPath;
        } else if (lower.includes('pl01') || lower.includes('phuluc') || lower.includes('-pl')) {
          phuLucPath = fullPath;
        } else if (!hopDongPath) {
          hopDongPath = fullPath;
        }
      } else if (/\.(jpg|jpeg|png|webp)$/i.test(lower)) {
        if (isNamedContractImage(f)) {
          if (!hopDongPath) hopDongPath = fullPath;
        } else if (lower.includes('truoc') || lower.includes('front') || lower.includes('mat-truoc')) {
          if (!cccdFrontPath) cccdFrontPath = fullPath;
        } else if (lower.includes('sau') || lower.includes('back') || lower.includes('mat-sau')) {
          if (!cccdBackPath) cccdBackPath = fullPath;
        } else {
          if (!cccdFrontPath) cccdFrontPath = fullPath;
          else if (!cccdBackPath) cccdBackPath = fullPath;
        }
      }
    }

    return { hopDongPath, phuLucPath, cccdFrontPath, cccdBackPath };
  }

  /**
   * Lấy Gemini API Key nếu có cấu hình
   */
  private async getGeminiApiKey(): Promise<string> {
    if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
    try {
      if (this.settingsService) {
        const raw = await this.settingsService.getSetting('bot_credentials_acm', '');
        if (raw) {
          const cred = JSON.parse(decrypt(raw));
          if (cred?.geminiApiKey) return cred.geminiApiKey;
        }
      }
    } catch { }
    return '';
  }

  /**
   * Cập nhật tiến độ UI
   */
  private updateProgress(userEmail: string, data: any): void {
    if (this.progressService) {
      this.progressService.updateProgress(userEmail, data);
    }
  }

  /**
   * Ghi Activity Log
   */
  private async logActivity(data: {
    action: string;
    title: string;
    details: string;
    userEmail: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.activityLogModel.create({
        action: data.action,
        title: data.title,
        details: data.details,
        userEmail: data.userEmail,
        metadata: data.metadata,
      });
    } catch { }
  }
}
