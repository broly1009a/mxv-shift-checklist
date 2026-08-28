import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { ReconciliationService } from '../../reconciliation/reconciliation.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { CqgSyncService } from '../cqg-sync.service';
import { parseJobPayload } from '../helpers/bot-path.helper';

@Injectable()
export class ReconJobsHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(ReconJobsHandler.name);
  readonly jobTypes = ['AUTO_CHECK_SOD', 'CHECK_KLGD', 'CHECK_PRE_EOD', 'CHECK_EOD_MM'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    @Inject(forwardRef(() => ReconciliationService))
    private readonly reconciliationService: ReconciliationService,
    private readonly settingsService: SystemSettingsService,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly cqgSyncService: CqgSyncService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    switch (job.jobType) {
      case 'AUTO_CHECK_SOD':
        return this.handleAutoCheckSodJob(job);
      case 'CHECK_KLGD':
        return this.handleCheckKlgdJob(job);
      case 'CHECK_PRE_EOD':
        return this.handleCheckPreEodJob(job);
      case 'CHECK_EOD_MM':
        return this.handleCheckEodMmJob(job);
      default:
        throw new Error(`ReconJobsHandler không hỗ trợ jobType: ${job.jobType}`);
    }
  }

  private async handleAutoCheckSodJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }

    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu kiểm tra đối chiếu SOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckSOD(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu SOD.`);
      job.logs.push(
        `[${new Date().toISOString()}] Kết quả: ${result.success ? 'KHỚP' : 'LỆCH'}`,
      );

      payload.result = result;
      job.payload = payload;
      await job.save();

      if (!result.success) {
        if (result.discrepancies && result.discrepancies.length > 0) {
          job.logs.push(
            `[${new Date().toISOString()}] Danh sách tài khoản lệch số dư:`,
          );
          result.discrepancies.forEach((d: any) => {
            job.logs.push(
              `- [SOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
            );
          });
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch số dư tài khoản (> $100) giữa M-System và CQG CAST. Vui lòng kiểm tra báo cáo.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu SOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckKlgdJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(`Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày ${dateStr}...`);
    await job.save();

    const defaultMsPath = path.join(process.cwd(), 'data', 'backup', 'ms', 'futures');
    const defaultCqgPath = path.join(process.cwd(), 'data', 'backup', 'cqg', 'futures');
    const msBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_ms',
      defaultMsPath,
    );
    const cqgBackupBase = await this.settingsService.getSetting(
      'bot_backup_path_cqg',
      defaultCqgPath,
    );
    const acmBackupBase = path.join(path.dirname(msBackupBase), 'ACM');

    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const msDailyPath = path.join(msBackupBase, subFolder);
    const cqgDailyPath = path.join(cqgBackupBase, subFolder);
    const acmDailyPath = path.join(acmBackupBase, subFolder);

    for (const dir of [msDailyPath, cqgDailyPath, acmDailyPath]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    log('Bắt đầu tải dữ liệu tươi từ MS, CQG và ACM song song...');
    await job.save();

    const errors: string[] = [];

    const downloadMs = async () => {
      log('MS → Đăng nhập M-System...');
      const { browser, page } = await this.rpaDownloaderService.loginMSystem(msDailyPath);
      try {
        log('MS → Đang tải DSGD.xlsx (Danh sách giao dịch)...');
        await this.rpaDownloaderService.downloadDSGD(
          page,
          path.join(msDailyPath, 'DSGD.xlsx'),
        );
        log('MS ✅ Tải DSGD.xlsx thành công.');

        log('MS → Đang tải TTM.xlsx (Trạng thái mở)...');
        await this.rpaDownloaderService.downloadTTM(
          page,
          path.join(msDailyPath, 'TTM.xlsx'),
        );
        log('MS ✅ Tải TTM.xlsx thành công.');
      } catch (err: any) {
        errors.push(`MS: ${err.message}`);
        log(`MS ❌ Lỗi tải file MS: ${err.message}`);
      } finally {
        await browser.close().catch(() => { });
      }
    };

    const downloadCqg = async () => {
      log('CQG → Tải FR1 + FR2 từ 2 tài khoản CQG...');
      const result = await this.rpaDownloaderService.downloadCqgBackup(
        { FR1: true, FR2: true },
        cqgDailyPath,
      );
      if (result.downloaded.length > 0) {
        log(`CQG ✅ Đã tải: ${result.downloaded.join(', ')}.`);
      }
      if (result.errors.length > 0) {
        errors.push(...result.errors.map((e) => `CQG: ${e}`));
        log(`CQG ⚠️ Lỗi: ${result.errors.join(' | ')}`);
      }
      log('CQG → Merge FR1+FR2 → FR.xlsx...');
      const mergeResult = await this.cqgSyncService.autoMergeMissingFiles(targetDate);
      for (const l of mergeResult.logs) {
        log(`CQG Merge: ${l}`);
      }
      if (!mergeResult.success) {
        errors.push(`CQG Merge: ${mergeResult.logs.filter(l => l.includes('❌')).join(' | ')}`);
      } else {
        log('CQG ✅ Merge FR.xlsx thành công.');
      }
    };

    const downloadAcm = async () => {
      log('ACM → Đăng nhập ACM để tải báo cáo Fill (Nano trades)...');
      const jobLogFn = (msg: string) => log(`ACM: ${msg}`);
      const { browser, page } = await this.rpaDownloaderService.loginACM(
        acmDailyPath,
        undefined,
        jobLogFn,
      );
      try {
        await this.rpaDownloaderService.downloadAcmBackup(page, acmDailyPath, jobLogFn);
        log('ACM ✅ Tải báo cáo Fill/Order thành công.');
      } catch (err: any) {
        errors.push(`ACM: ${err.message}`);
        log(`ACM ❌ Lỗi tải file ACM: ${err.message}`);
      } finally {
        await browser.close().catch(() => { });
      }
    };

    log('1/3 - Đang tải dữ liệu từ M-System (DSGD, TTM)...');
    await downloadMs();
    await job.save();

    log('2/3 - Đang tải dữ liệu từ CQG (FR1, FR2)...');
    await downloadCqg();
    await job.save();

    log('3/3 - Đang tải dữ liệu từ ACM (Fill, Order)...');
    await downloadAcm();
    await job.save();

    if (errors.length > 0) {
      log(`⚠️ Có ${errors.length} lỗi khi tải file, tiếp tục đối chiếu với dữ liệu có sẵn...`);
    } else {
      log('✅ Tải dữ liệu tươi hoàn tất từ tất cả 3 nguồn (MS, CQG, ACM).');
    }

    try {
      const result = await this.reconciliationService.runAutoCheckKLGD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        log(`Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      if (result.isWaitingFiles) {
        log(result.message);
      } else {
        log('Hoàn thành đối chiếu khớp lệnh định kỳ trong phiên.');
        log(`Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
      }

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedAll = result.mismatchedTrades ?? [];
      if (mismatchedAll.length > LOG_THRESHOLD) {
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedAll.length > 0) {
          if (mismatchedAll.length > LOG_THRESHOLD) {
            const preview = mismatchedAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            log(
              `⚠️ Phát hiện ${mismatchedAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết đầy đủ xem file CSV đính kèm email. ` +
              `Preview ${MAX_PREVIEW} đầu tiên: ${preview}`,
            );
          } else {
            log('Chi tiết chênh lệch khớp lệnh:');
            mismatchedAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch khớp lệnh trong phiên (KLGD). Vui lòng kiểm tra báo cáo.`,
        );
      }
      return result;
    } catch (err: any) {
      log(`Lỗi đối chiếu khớp lệnh tự động: ${err.message}`);
      await job.save();
      throw err;
    }
  }

  private async handleCheckPreEodJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate: Date;
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      const localNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      targetDate = new Date(Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate()
      ));
    }
    targetDate.setUTCHours(0, 0, 0, 0);
    const dateStr = payload.sessionDay || targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu Pre-EOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckPreEOD(targetDate);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        job.logs.push(
          `[${new Date().toISOString()}] Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`,
        );
      }
      if (result.isWaitingFiles) {
        job.logs.push(`[${new Date().toISOString()}] ${result.message}`);
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Hoàn thành đối chiếu Pre-EOD.`,
        );
        job.logs.push(
          `[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`,
        );
      }

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const mismatchedTradesAll = result.mismatchedTrades ?? [];
      const mismatchedPositionsAll = result.mismatchedPositions ?? [];
      const needTruncate = mismatchedTradesAll.length > LOG_THRESHOLD || mismatchedPositionsAll.length > LOG_THRESHOLD;
      if (needTruncate) {
        payload.result = {
          ...result,
          mismatchedTrades: mismatchedTradesAll.slice(0, MAX_PREVIEW),
          mismatchedTradesTotal: mismatchedTradesAll.length,
          mismatchedPositions: mismatchedPositionsAll.slice(0, MAX_PREVIEW),
          mismatchedPositionsTotal: mismatchedPositionsAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      if (!result.passed) {
        if (mismatchedTradesAll.length > 0) {
          if (mismatchedTradesAll.length > LOG_THRESHOLD) {
            const preview = mismatchedTradesAll.slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${mismatchedTradesAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch khớp lệnh:`);
            mismatchedTradesAll.forEach((t: any) => {
              job.logs.push(
                `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
              );
            });
          }
        }
        if (mismatchedPositionsAll.length > 0) {
          if (mismatchedPositionsAll.length > LOG_THRESHOLD) {
            const preview = mismatchedPositionsAll.slice(0, MAX_PREVIEW)
              .map((p: any) => `TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${mismatchedPositionsAll.length} lệch vị thế Net (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch vị thế Net:`);
            mismatchedPositionsAll.forEach((p: any) => {
              job.logs.push(
                `- TK ${p.account}, HĐ ${p.symbol}: MS ${p.msPosition} vs CQG ${p.cqgPosition} (Chênh lệch: ${p.differ})`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện chênh lệch khớp lệnh hoặc vị thế cuối ngày (Pre-EOD). Vui lòng kiểm tra báo cáo.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu Pre-EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }

  private async handleCheckEodMmJob(job: any) {
    const payload = parseJobPayload(job);
    let targetDate = new Date();
    if (payload.sessionDay) {
      targetDate = new Date(payload.sessionDay);
    } else {
      targetDate = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    }
    const dateStr = targetDate.toISOString().split('T')[0];
    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy đối chiếu EOD tự động ngày ${dateStr}...`,
    );
    await job.save();

    try {
      const result = await this.reconciliationService.runAutoCheckEodMm(targetDate);
      job.logs.push(`[${new Date().toISOString()}] Hoàn thành đối chiếu EOD.`);

      const LOG_THRESHOLD = 50;
      const MAX_PREVIEW = 30;
      const cqgResultAll = result.cqgResult ?? [];
      if (cqgResultAll.length > LOG_THRESHOLD) {
        payload.result = {
          ...result,
          cqgResult: cqgResultAll.slice(0, MAX_PREVIEW),
          cqgResultTotal: cqgResultAll.length,
          isPreviewOnly: true,
        };
      } else {
        payload.result = result;
      }
      job.payload = payload;
      job.markModified('payload');
      await job.save();

      const totalNegative =
        result.eodResult.negativeBalanceAccs.length +
        result.eodResult.negativeIMRAcc.length;
      const totalMismatched = cqgResultAll.length;
      if (totalNegative > 0 || totalMismatched > 0) {
        if (cqgResultAll.length > 0) {
          if (cqgResultAll.length > LOG_THRESHOLD) {
            const preview = cqgResultAll.slice(0, MAX_PREVIEW)
              .map((d: any) => `TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)}`)
              .join(' | ');
            job.logs.push(
              `[${new Date().toISOString()}] ⚠️ Phát hiện ${cqgResultAll.length} TK lệch số dư EOD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết xem CSV email. Preview: ${preview}`,
            );
          } else {
            job.logs.push(`[${new Date().toISOString()}] Chi tiết chênh lệch số dư CQG EOD:`);
            cqgResultAll.forEach((d: any) => {
              job.logs.push(
                `- [EOD] TK ${d.maTKGD}: MS $${d.calculatedBalance.toFixed(2)} vs CQG $${d.cqgBalance.toFixed(2)} (Chênh lệch: $${d.differ.toFixed(2)})`,
              );
            });
          }
        }
        await job.save();
        throw new Error(
          `Phát hiện bất thường EOD: ${totalNegative} tài khoản âm margin/số dư, ${totalMismatched} tài khoản lệch số dư EOD CQG.`,
        );
      }
      return result;
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi đối chiếu EOD tự động: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }
}
