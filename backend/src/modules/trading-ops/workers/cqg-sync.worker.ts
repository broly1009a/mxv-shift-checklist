import { Injectable, Logger, Optional } from '@nestjs/common';
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
import { CqgMergerService } from '../services/merger/cqg-merger.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class CqgSyncWorker implements IBotWorker {
  private readonly logger = new Logger(CqgSyncWorker.name);

  readonly capabilityType = 'CHECK_CQG_SYNC';
  readonly displayName = 'Đối Chiếu Đồng Bộ Số Dư CQG';

  constructor(
    private readonly cqgMergerService: CqgMergerService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
  ) {}

  canHandle(capabilityType: string): boolean {
    return (
      capabilityType === this.capabilityType ||
      capabilityType === 'CQG_SYNC' ||
      capabilityType === 'CHECK_CQG_SYNC'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CqgSyncWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
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
      const cqgBackupBase = resolveStoragePathCrossPlatform(
        await this.settingsService.getSetting(
          'bot_backup_path_cqg',
          'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures',
        ),
      );

      const msDailyPath = path.join(msBackupBase, subFolder);
      const cqgDailyPath = path.join(cqgBackupBase, subFolder);

      const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
      const accountsBalancesPath =
        findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
        findLatestFile(msDailyPath, /Accounts_Balances/i);

      if (!fs.existsSync(qltkgdPath) || !accountsBalancesPath) {
        const missing: string[] = [];
        if (!fs.existsSync(qltkgdPath)) missing.push('QLTKGD.xlsx');
        if (!accountsBalancesPath) missing.push('Accounts_Balances.xlsx');

        this.logger.warn(
          `[CqgSyncWorker] Đang chờ file đồng bộ CQG ngày ${dateStr}. Thiếu: ${missing.join(', ')}`,
        );
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ file đối chiếu số dư CQG (${missing.join(', ')}).`,
          metrics: { missingFiles: missing },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const res = await this.cqgMergerService.runAutoCheckCQGSync(targetDate);
      const cqgResult = res?.cqgResult || [];
      const totalMismatched = cqgResult.length;
      const passed = totalMismatched === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';
      const summary = passed
        ? `Đồng bộ số dư CQG thành công: Khớp 100% số dư tất cả tài khoản.`
        : `Phát hiện ${totalMismatched} tài khoản lệch số dư đồng bộ CQG.`;

      if (this.reconLogModel) {
        try {
          await this.reconLogModel.create({
            reconType: 'CQG_SYNC',
            tradingDate: dateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed,
            totals: { differCount: totalMismatched },
            mismatchedTrades: cqgResult,
          });
        } catch (dbErr: any) {
          this.logger.warn(`[CqgSyncWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        passed,
        metrics: {
          differCount: totalMismatched,
          totalAccountsChecked: res?.totalAccounts || 0,
        },
        details: {
          mismatched: cqgResult.slice(0, 30),
        },
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[CqgSyncWorker] Lỗi đồng bộ CQG: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        summary: `Lỗi đồng bộ số dư CQG: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
