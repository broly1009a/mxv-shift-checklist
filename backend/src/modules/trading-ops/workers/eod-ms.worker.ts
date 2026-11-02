import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  resolveStoragePathCrossPlatform,
  findLatestFile,
} from '../../../shared';
import type { IReconPipelinePort } from '../../../shared';
import { RECON_PIPELINE_PORT } from '../../../shared';
import { MsEodReconService } from '../services/recon/ms-eod-recon.service';
import {
  CurrentNegativeAccountDetail,
  MonitoredNegativeAccount,
  normalizeMonitoredNegativeAccounts,
  reconcileNegativeMarginList,
} from '../helpers/negative-margin-sync.helper';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class EodMsWorker implements IBotWorker {
  private readonly logger = new Logger(EodMsWorker.name);

  readonly capabilityType = 'CHECK_EOD_MS';
  readonly displayName = 'Đối Chiếu Chốt Sổ EOD M-System';

  constructor(
    private readonly msEodReconService: MsEodReconService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    @Inject(RECON_PIPELINE_PORT)
    private readonly reconPipeline?: IReconPipelinePort,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'EOD_MS' ||
      capabilityType === 'CHECK_EOD_MS'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[EodMsWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate
        ? new Date(context.targetDate)
        : new Date();

      const isExplicitDate = Boolean(
        context.parameters?.isExplicitDate ||
        context.parameters?.exactDate ||
        context.parameters?.options?.exactDate,
      );
      const evalDate = isExplicitDate
        ? targetDate
        : await this.msEodReconService.getPreviousTradingSession(targetDate);

      const year = evalDate.getFullYear().toString();
      const month = String(evalDate.getMonth() + 1).padStart(2, '0');
      const day = String(evalDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

      const msBackupBase = resolveStoragePathCrossPlatform(
        await this.settingsService.getSetting(
          'bot_backup_path_ms',
          'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures',
        ),
      );
      const msDailyPath = path.join(msBackupBase, subFolder);
      if (!fs.existsSync(msDailyPath)) {
        fs.mkdirSync(msDailyPath, { recursive: true });
      }

      const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
      let eodFile = findLatestFile(msDailyPath, /eod/i);

      // Nếu thiếu file EOD: Gọi fallback tải từ Outlook email qua ReconPipelinePort
      if (!eodFile && this.reconPipeline?.fetchEodEmail) {
        this.logger.log(
          `[EodMsWorker] Chưa tìm thấy file EOD phiên ${dateStr}. Kích hoạt kéo file EOD từ hòm thư Outlook M365...`,
        );
        try {
          const mailRes = await this.reconPipeline.fetchEodEmail(dateStr, msDailyPath);
          if (mailRes?.success) {
            eodFile = findLatestFile(msDailyPath, /eod/i);
            this.logger.log(`[EodMsWorker] Đã tải thành công file EOD từ email.`);
          }
        } catch (mailErr: any) {
          this.logger.warn(`[EodMsWorker] Lỗi tải file EOD từ mail: ${mailErr.message}`);
        }
      }

      if (!fs.existsSync(qltkgdPath) || !eodFile) {
        const missing: string[] = [];
        if (!fs.existsSync(qltkgdPath)) missing.push('QLTKGD.xlsx');
        if (!eodFile) missing.push('eod.csv / EOD.xlsx');

        this.logger.warn(
          `[EodMsWorker] Đang chờ file EOD MS phiên T-1 (${dateStr}). Thiếu: ${missing.join(', ')}`,
        );
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} (Phiên T-1) đang chờ cập nhật file đối chiếu EOD MS (${missing.join(', ')}).`,
          metrics: { missingFiles: missing, evalDate: dateStr, targetDate: context.targetDate },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const ttttPath = path.join(msDailyPath, 'TTTT.xlsx');
      const files: any = {
        qltkgd: fs.readFileSync(qltkgdPath),
        eod: fs.readFileSync(eodFile),
      };
      if (fs.existsSync(ttttPath)) {
        files.tttt = fs.readFileSync(ttttPath);
      }

      const checkRes = await this.msEodReconService.checkEOD(files);

            // Xử lý đối soát danh sách âm ký quỹ theo cơ chế đồng bộ CSDL:
      // 1. Máy tự thêm sau mỗi phiên có TK âm mới
      // 2. Nếu đã có sẵn trong danh sách -> Thôi không báo động lặp lại
      // 3. Nếu đã nạp tiền (hết âm) -> Thôi theo dõi, tự động dọn dẹp khỏi CSDL
      const monitoredAccsStr = await this.settingsService.getSetting(
        'negative_margin_monitored_accounts',
        '[]',
      );
      let savedMonitoredList: MonitoredNegativeAccount[] = [];
      try {
        savedMonitoredList = normalizeMonitoredNegativeAccounts(JSON.parse(monitoredAccsStr), 'MS');
      } catch {
        savedMonitoredList = [];
      }

      const currentNegativeMap = new Map<string, CurrentNegativeAccountDetail>();
      const rawDetails = (checkRes as any).negativeAccountDetails || {};
      for (const [acc, detail] of Object.entries(rawDetails)) {
        currentNegativeMap.set(acc.toUpperCase(), detail as any);
      }
      for (const acc of checkRes.negativeIMRAcc || []) {
        const k = acc.toUpperCase();
        if (!currentNegativeMap.has(k)) {
          currentNegativeMap.set(k, {
            account: acc,
            negativeType: 'IMR',
            currentBalance: 0,
            availableMargin: 0,
            additionalMargin: 0,
          });
        }
      }
      for (const acc of checkRes.negativeBalanceAccs || []) {
        const k = acc.toUpperCase();
        if (!currentNegativeMap.has(k)) {
          currentNegativeMap.set(k, {
            account: acc,
            negativeType: 'BALANCE',
            currentBalance: 0,
            availableMargin: 0,
            additionalMargin: 0,
          });
        }
      }

      const reconSyncRes = reconcileNegativeMarginList({
        currentNegativeMap,
        savedAccounts: savedMonitoredList,
        sessionDateStr: dateStr,
        systemType: 'MS',
      });

      if (reconSyncRes.newNegativeAccounts.length > 0 || reconSyncRes.resolvedAccounts.length > 0) {
        try {
          await this.settingsService.setSetting(
            'negative_margin_monitored_accounts',
            JSON.stringify(reconSyncRes.updatedSavedList),
          );
          this.logger.log(
            `[EodMsWorker] Đã cập nhật CSDL danh sách TK âm MS: +${reconSyncRes.newNegativeAccounts.length} âm mới, -${reconSyncRes.resolvedAccounts.length} đã nạp tiền hết âm.`,
          );
        } catch (saveErr: any) {
          this.logger.warn(`[EodMsWorker] Không thể lưu danh sách âm MS vào CSDL: ${saveErr.message}`);
        }
      }

      const mismatchedEod = checkRes.mismatchedEOD || [];
      const rawNegIMR = checkRes.negativeIMRAcc || [];
      const rawNegBal = checkRes.negativeBalanceAccs || [];
      const newNegIMR = reconSyncRes.newNegativeAccounts
        .filter((a) => a.negativeType === 'IMR' || a.negativeType === 'BOTH')
        .map((a) => a.account);
      const newNegBal = reconSyncRes.newNegativeAccounts
        .filter((a) => a.negativeType === 'BALANCE' || a.negativeType === 'BOTH')
        .map((a) => a.account);
      const uniqueNegativeAccounts = reconSyncRes.newNegativeAccounts.map((a) => a.account);
      const totalNegativeNew = uniqueNegativeAccounts.length;
      const totalMismatched = mismatchedEod.length;
      const passed = totalNegativeNew === 0 && totalMismatched === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';

      let summary = passed
        ? `Đối chiếu EOD M-System thành công (Phiên T-1: ${day}/${month}/${year}): Tất cả tài khoản khớp số dư hoàn hảo, không có tài khoản âm ký quỹ mới.`
        : `Đối chiếu EOD M-System có cảnh báo (Phiên T-1: ${day}/${month}/${year}): ${totalNegativeNew} tài khoản âm ký quỹ MỚI, ${totalMismatched} tài khoản lệch công thức EOD.`;

      if (reconSyncRes.persistentAccounts.length > 0) {
        summary += ` (Đang theo dõi ${reconSyncRes.persistentAccounts.length} TK âm cũ)`;
      }
      if (reconSyncRes.resolvedAccounts.length > 0) {
        summary += ` (Đã gỡ bỏ ${reconSyncRes.resolvedAccounts.length} TK đã nạp tiền hết âm)`;
      }

if (this.reconLogModel) {
        try {
          await this.reconLogModel.create({
            reconType: 'EOD_MS',
            tradingDate: dateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed,
            totals: {
              negativeCount: totalNegativeNew,
              differCount: totalMismatched,
            },
            mismatchedTrades: mismatchedEod,
            negativeMarginAccounts: uniqueNegativeAccounts.map(acc => ({ account: acc })),
          });
        } catch (dbErr: any) {
          this.logger.warn(`[EodMsWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        passed,
        metrics: {
          negativeCount: totalNegativeNew,
          differCount: totalMismatched,
          rawNegIMRCount: rawNegIMR.length,
          rawNegBalCount: rawNegBal.length,
        },
        details: {
          newNegIMR,
          newNegBal,
          uniqueNegativeAccounts,
          mismatchedEod: mismatchedEod.slice(0, 30),
          differCount: totalMismatched,
        },
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[EodMsWorker] Lỗi đối chiếu EOD MS: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        summary: `Lỗi đối chiếu EOD MS: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
