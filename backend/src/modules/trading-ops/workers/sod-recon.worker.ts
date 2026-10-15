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
import { CqgMergerService } from '../services/cqg-merger.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';

@Injectable()
export class SodReconWorker implements IBotWorker {
  private readonly logger = new Logger(SodReconWorker.name);

  readonly capabilityType = 'AUTO_CHECK_SOD';
  readonly displayName = 'Đối Chiếu Số Dư Đầu Ngày SOD (MS vs CQG CAST)';

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
      capabilityType === 'CHECK_SOD' ||
      capabilityType === 'AUTO_CHECK_SOD'
    );
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[SodReconWorker] Tiếp nhận thực thi ${this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      const targetDate = context.targetDate
        ? new Date(context.targetDate)
        : new Date(new Date().getTime() + 7 * 60 * 60 * 1000);

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
          `[SodReconWorker] Đang chờ file SOD ngày ${dateStr}. Thiếu: ${missing.join(', ')}`,
        );
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ cập nhật file đối chiếu SOD (${missing.join(', ')}).`,
          metrics: { missingFiles: missing },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const usdRateSetting = await this.settingsService.getSetting(
        'usd_exchange_rate',
        '25400',
      );
      const usdRate = parseFloat(usdRateSetting) || 25400;

      const qltkgdBuffer = fs.readFileSync(qltkgdPath);
      const accountsBalancesBuffer = fs.readFileSync(accountsBalancesPath);

      const discrepancies = await this.cqgMergerService.checkEODCQG(
        {
          qltkgd: qltkgdBuffer,
          accountsBalances: accountsBalancesBuffer,
        },
        usdRate,
      );

      const differCount = discrepancies ? discrepancies.length : 0;
      const passed = differCount === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';
      const summary = passed
        ? `Đối chiếu SOD thành công: Khớp 100% số dư đầu ngày giữa M-System và CQG CAST.`
        : `Đối chiếu SOD phát hiện ${differCount} tài khoản lệch số dư đầu ngày (> $100).`;

      if (this.reconLogModel) {
        try {
          await this.reconLogModel.create({
            reconType: 'SOD_RECON',
            tradingDate: dateStr,
            shiftLogId: context.shiftId,
            taskId: context.taskId,
            passed,
            totals: { differCount },
            mismatchedTrades: discrepancies,
          });
        } catch (dbErr: any) {
          this.logger.warn(`[SodReconWorker] Lỗi lưu TradingReconLog: ${dbErr.message}`);
        }
      }

      return {
        status,
        summary,
        passed,
        metrics: {
          differCount,
          usdRate,
          totalDiscrepancies: differCount,
        },
        details: {
          discrepancies: discrepancies.slice(0, 30),
        },
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    } catch (err: any) {
      this.logger.error(`[SodReconWorker] Lỗi đối chiếu SOD: ${err.message}`, err.stack);
      return {
        status: 'FAILED',
        summary: `Lỗi đối chiếu SOD: ${err.message}`,
        error: err.message,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
      };
    }
  }
}
