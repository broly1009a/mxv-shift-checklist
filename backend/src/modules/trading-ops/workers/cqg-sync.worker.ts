import { Injectable, Logger, Optional, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as path from 'path';
import * as fs from 'fs';
import {
  IBotWorker,
  TaskExecutionContext,
  TaskExecutionResult,
  resolveStoragePathCrossPlatform,
  getMsBackupBase,
  getCqgBackupBase,
  findLatestFile,
} from '../../../shared';
import { CqgMergerService } from '../services/merger/cqg-merger.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { TradingReconLog } from '../schemas/trading-recon-log.schema';
import { IngressService } from '../../ingress/ingress.service';
import { MsApiAdapter } from '../../ingress/adapters/ms-api.adapter';

@Injectable()
export class CqgSyncWorker implements IBotWorker {
  private readonly logger = new Logger(CqgSyncWorker.name);

  readonly capabilityType = 'CHECK_CQG_SYNC';
  readonly displayName = 'Đối Chiếu Số Dư CQG (SOD)';

  constructor(
    private readonly cqgMergerService: CqgMergerService,
    private readonly settingsService: SystemSettingsService,
    @Optional()
    @InjectModel(TradingReconLog.name)
    private readonly reconLogModel?: Model<TradingReconLog>,
    @Optional()
    @Inject(forwardRef(() => IngressService))
    private readonly ingressService?: IngressService,
    @Optional()
    @Inject(forwardRef(() => MsApiAdapter))
    private readonly msApiAdapter?: MsApiAdapter,
  ) {}

  canHandle(capabilityType: string): boolean {
    const upper = String(capabilityType || '').trim().toUpperCase();
    return upper === this.capabilityType;
  }

  async execute(context: TaskExecutionContext): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    this.logger.log(
      `[CqgSyncWorker] Tiếp nhận thực thi ${context.botCheckType || this.capabilityType} cho Task: ${context.taskId}, Ca: ${context.shiftId || 'N/A'}`,
    );

    try {
      let targetDate: Date;
      let year: string;
      let month: string;
      let day: string;
      let dateStr: string;

      if (typeof context.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(context.targetDate)) {
        const parts = context.targetDate.split('-');
        year = parts[0];
        month = parts[1];
        day = parts[2].substring(0, 2);
        dateStr = `${year}-${month}-${day}`;
        targetDate = new Date(Number(year), Number(month) - 1, Number(day));
      } else if (context.targetDate) {
        const parsed = new Date(context.targetDate);
        year = parsed.getFullYear().toString();
        month = String(parsed.getMonth() + 1).padStart(2, '0');
        day = String(parsed.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        targetDate = new Date(Number(year), Number(month) - 1, Number(day));
      } else {
        const vnNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
        year = vnNow.getUTCFullYear().toString();
        month = String(vnNow.getUTCMonth() + 1).padStart(2, '0');
        day = String(vnNow.getUTCDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
        targetDate = new Date(Number(year), Number(month) - 1, Number(day));
      }

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

      const msBackupBase = await getMsBackupBase(this.settingsService);
      const cqgBackupBase = await getCqgBackupBase(this.settingsService);

      const msDailyPath = path.join(msBackupBase, subFolder);
      const cqgDailyPath = path.join(cqgBackupBase, subFolder);

      // =========================================================================
      // BƯỚC TỰ ĐỘNG TẢI DỮ LIỆU TƯƠI (FRESH DATA DOWNLOAD PIPELINE)
      // =========================================================================
      const skipDownload =
        context.parameters?.skipDownload === true ||
        context.parameters?.options?.skipDownload === true;

      const downloadedFiles: string[] = [];
      const downloadErrors: string[] = [];

      if (!skipDownload) {
        if (!fs.existsSync(cqgDailyPath)) {
          fs.mkdirSync(cqgDailyPath, { recursive: true });
        }
        if (!fs.existsSync(msDailyPath)) {
          fs.mkdirSync(msDailyPath, { recursive: true });
        }

        // Bước 1: Tải file số dư tươi từ CQG CAST (Accounts_Balances.xlsx và AS.xlsx)
        if (this.ingressService) {
          this.logger.log(`[CqgSyncWorker] Đang cào dữ liệu tươi số dư từ CQG CAST vào ${cqgDailyPath}...`);
          try {
            const castRes = await this.ingressService.download('CAST', {
              targetDirectory: cqgDailyPath,
              onLog: (msg) => this.logger.log(`[CqgSyncWorker] ${msg}`),
            });
            if (castRes?.files && castRes.files.length > 0) {
              for (const f of castRes.files) {
                downloadedFiles.push(f.fileName);
              }
              this.logger.log(`[CqgSyncWorker] Đã tải thành công file CAST: ${castRes.files.map(f => f.fileName).join(', ')}`);
            }
            if (castRes?.error) {
              downloadErrors.push(`CQG CAST: ${castRes.error}`);
            }
          } catch (castErr: any) {
            this.logger.error(`[CqgSyncWorker] Lỗi tải số dư CQG CAST: ${castErr.message}`);
            downloadErrors.push(`CQG CAST: ${castErr.message}`);
          }
        } else {
          this.logger.warn(`[CqgSyncWorker] IngressService chưa được inject, bỏ qua bước cào CAST.`);
        }

        // Bước 2: Tải báo cáo Quản lý tài khoản giao dịch tươi (QLTKGD.xlsx) từ M-System qua Direct REST API
        if (this.msApiAdapter) {
          this.logger.log(`[CqgSyncWorker] Đang gọi API M-System tải dữ liệu tươi QLTKGD vào ${msDailyPath}...`);
          try {
            const msRes = await this.msApiAdapter.download('MS', {
              targetDirectory: msDailyPath,
              reportCodes: ['QLTKGD'],
              targetDate: dateStr,
            });
            if (msRes?.files && msRes.files.length > 0) {
              for (const f of msRes.files) {
                downloadedFiles.push(f.fileName);
              }
              this.logger.log(`[CqgSyncWorker] Đã tải thành công ${msRes.files.length} file từ M-System: ${msRes.files.map(f => f.fileName).join(', ')}`);
            }
            if (msRes?.error) {
              downloadErrors.push(`M-System: ${msRes.error}`);
            }
          } catch (msErr: any) {
            this.logger.error(`[CqgSyncWorker] Lỗi tải QLTKGD từ M-System: ${msErr.message}`);
            downloadErrors.push(`M-System: ${msErr.message}`);
          }
        } else if (this.ingressService) {
          this.logger.log(`[CqgSyncWorker] Đang dùng IngressService tải dữ liệu tươi QLTKGD vào ${msDailyPath}...`);
          try {
            const msRes = await this.ingressService.download('MS', {
              targetDirectory: msDailyPath,
              reportCodes: ['QLTKGD'],
              targetDate: dateStr,
            });
            if (msRes?.files && msRes.files.length > 0) {
              for (const f of msRes.files) {
                downloadedFiles.push(f.fileName);
              }
            }
            if (msRes?.error) {
              downloadErrors.push(`M-System: ${msRes.error}`);
            }
          } catch (msErr: any) {
            downloadErrors.push(`M-System: ${msErr.message}`);
          }
        }
      }

      // =========================================================================
      // FAIL-FAST: NẾU CÓ LỖI TẢI TƯƠI, DỪNG NGAY ĐỂ TRÁNH ĐỐI CHIẾU TRÊN FILE CŨ
      // Tuân thủ nghiêm ngặt AGENTS.md Quy Tắc Fail-Fast & Zero-Silent-Swallow
      // =========================================================================
      if (downloadErrors.length > 0) {
        const errMsg = `[FAIL-FAST] Tải dữ liệu tươi thất bại: ${downloadErrors.join('; ')}. Dừng đối chiếu để tránh so sánh trên dữ liệu cũ/lỗi thời.`;
        this.logger.error(`[CqgSyncWorker] ${errMsg}`);
        throw new Error(errMsg);
      }

      // =========================================================================
      // KIỂM TRA SỰ TỒN TẠI FILE VÀ THỰC THI ĐỐI SOÁT
      // =========================================================================
      const qltkgdPath = path.join(msDailyPath, 'QLTKGD.xlsx');
      const accountsBalancesPath =
        findLatestFile(cqgDailyPath, /^(Accounts_Balances|AS\.xlsx)/i) ||
        findLatestFile(cqgDailyPath, /Accounts_Balances/i) ||
        findLatestFile(msDailyPath, /Accounts_Balances/i);

      if (!fs.existsSync(qltkgdPath) || !accountsBalancesPath) {
        const missing: string[] = [];
        if (!fs.existsSync(qltkgdPath)) missing.push('QLTKGD.xlsx');
        if (!accountsBalancesPath) missing.push('Accounts_Balances.xlsx');

        const errDetail = downloadErrors.length > 0 ? ` (Chi tiết lỗi tải: ${downloadErrors.join('; ')})` : '';
        this.logger.warn(
          `[CqgSyncWorker] Đang chờ file đồng bộ CQG ngày ${dateStr}. Thiếu: ${missing.join(', ')}${errDetail}`,
        );
        return {
          status: 'WAITING',
          isWaitingFiles: true,
          summary: `[Đang chờ dữ liệu] Thư mục backup ngày ${day}.${month}.${year} đang chờ file đối chiếu số dư CQG (${missing.join(', ')}).${errDetail}`,
          metrics: { missingFiles: missing, downloadedFiles, downloadErrors },
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
        };
      }

      const res = await this.cqgMergerService.runAutoCheckCQGSync(targetDate);
      const cqgResult = res?.cqgResult || [];
      const totalMismatched = cqgResult.length;
      const passed = totalMismatched === 0;
      const status = passed ? 'SUCCESS' : 'WARNING';
      let summary = passed
        ? `Đồng bộ số dư CQG thành công: Khớp 100% số dư tất cả tài khoản.`
        : `Phát hiện ${totalMismatched} tài khoản lệch số dư đồng bộ CQG.`;

      if (downloadedFiles.length > 0) {
        summary += ` (Dữ liệu tươi: ${downloadedFiles.join(', ')})`;
      }
      if (downloadErrors.length > 0) {
        summary += ` [Cảnh báo tải tươi: ${downloadErrors.join('; ')}]`;
      }

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
          totalMismatchedCQG: totalMismatched,
          freshDownload: !skipDownload,
          downloadedFilesCount: downloadedFiles.length,
          downloadErrorsCount: downloadErrors.length,
        },
        details: {
          cqgResult,
          discrepancies: cqgResult.slice(0, 100),
          mismatched: cqgResult.slice(0, 30),
          downloadedFiles,
          downloadErrors: downloadErrors.length > 0 ? downloadErrors : undefined,
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
