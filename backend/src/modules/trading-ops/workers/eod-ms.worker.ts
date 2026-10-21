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
import { MsEodReconService } from '../services/ms-eod-recon.service';
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

      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');
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
          `[EodMsWorker] Đang chờ file EOD MS ngày ${dateStr}. Thiếu: ${missing.join(', ')}`,
        );
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ cập nhật file đối chiếu EOD MS (${missing.join(', ')}).`,
          metrics: { missingFiles: missing },
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

      // Lọc tài khoản theo dõi
      const monitoredAccsStr = await this.settingsService.getSetting(
        'negative_margin_monitored_accounts',
        '[]',
      );
      let monitoredAccounts: string[] = [];
      try {
        monitoredAccounts = JSON.parse(monitoredAccsStr) || [];
      } catch {}
      const monitoredSet = new Set(
        monitoredAccounts.map((a: string) => String(a || '').trim().toUpperCase()),
      );

      const rawNegIMR = checkRes.negativeIMRAcc || [];
      const newNegIMR = rawNegIMR.filter(
        (acc: string) => !monitoredSet.has(String(acc || '').trim().toUpperCase()),
      );
      const rawNegBal = checkRes.negativeBalanceAccs || [];
      const newNegBal = rawNegBal.filter(
        (acc: string) => !monitoredSet.has(String(acc || '').trim().toUpperCase()),
      );
      const mismatchedEod = checkRes.mismatchedEOD || [];

      const totalNegativeNew = newNegIMR.length + newNegBal.length;
      const totalMismatched = mismatchedEod.length;
      const passed = totalNegativeNew === 0 && totalMismatched === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';

      const summary = passed
        ? `Đối chiếu EOD M-System thành công: Tất cả tài khoản khớp số dư hoàn hảo, không có tài khoản âm ký quỹ mới.`
        : `Đối chiếu EOD M-System có cảnh báo: ${totalNegativeNew} tài khoản âm ký quỹ mới, ${totalMismatched} tài khoản lệch công thức EOD.`;

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
            negativeMarginAccounts: [...newNegIMR, ...newNegBal].map(acc => ({ account: acc })),
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
          mismatchedEod: mismatchedEod.slice(0, 30),
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
