import { Injectable, Logger, Optional } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IReconPipelinePort } from '../../../../shared/ports/recon-pipeline.port';
import { SystemSettingsService } from '../../../system-settings/system-settings.service';
import { ReconIngressPipelineService } from '../../../ingress/services/recon-ingress-pipeline.service';
import { KlgdReconService } from '../recon/klgd-recon.service';
import { DsgdBeforeEodService } from '../recon/dsgd-before-eod.service';
import { CqgMergerService } from '../merger/cqg-merger.service';
import { EmailWatcherService } from '../../../bot-engine/watchers/email-watcher.service';
import {
  parseJobPayload,
  resolveTradingSessionDate,
  resolveBotTargetDate,
  isMarketWeekendClosed,
} from '../../../bot-engine/helpers/bot-path.helper';

/**
 * Service điều phối Pipeline Đối soát trong phiên (CHECK_KLGD) và Cuối ngày (CHECK_DSGD_BEFORE_EOD)
 * Kết nối Ingress (tải dữ liệu đa nguồn 4 bên có rào cản) với Domain Recon Services của TradingOps.
 * Cung cấp cổng IReconPipelinePort cho các Worker V2 mà không cần đi qua Monolith Handlers cũ.
 */
@Injectable()
export class ReconPipelineService implements IReconPipelinePort {
  private readonly logger = new Logger(ReconPipelineService.name);

  constructor(
    private readonly settingsService: SystemSettingsService,
    private readonly ingressPipelineService: ReconIngressPipelineService,
    @Optional()
    private readonly klgdReconService?: KlgdReconService,
    @Optional()
    private readonly dsgdBeforeEodService?: DsgdBeforeEodService,
    @Optional()
    private readonly cqgMergerService?: CqgMergerService,
    @Optional()
    private readonly emailWatcherService?: EmailWatcherService,
  ) {}

  /**
   * Kéo file EOD từ Outlook email (M365) qua EmailWatcherService
   */
  public async fetchEodEmail(dateStr: string, destDir: string): Promise<any> {
    if (this.emailWatcherService) {
      return await this.emailWatcherService.fetchEodEmail(dateStr, destDir);
    }
    return { success: false, message: 'EmailWatcherService chưa sẵn sàng' };
  }

  /**
   * Thực thi Pipeline Đối chiếu khớp lệnh trong phiên (CHECK_KLGD)
   */
  public async handleCheckKlgdJob(job: any): Promise<any> {
    const payload = parseJobPayload(job);
    const sessionStartSetting = await this.settingsService.getSetting(
      'session_start_time',
      '05:00',
    );
    const resolved = resolveTradingSessionDate(
      payload.sessionDay || payload.targetDate,
      { sessionStartStr: sessionStartSetting },
    );
    const targetDate = resolved.dateObj;
    const dateStr = resolved.dateStr;
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);

    const log = (msg: string) => {
      this.logger.log(msg);
      if (job?.logs && Array.isArray(job.logs)) {
        job.logs.push(`[${new Date().toISOString()}] ${msg}`);
      }
    };

    log(`Bắt đầu chạy đối chiếu khớp lệnh định kỳ trong phiên ngày ${dateStr}...`);
    if (job?.save) await job.save();

    // Market Weekend Guard: Tạm nghỉ khi thị trường đóng cửa cuối tuần
    if (!payload.targetDate && isMarketWeekendClosed()) {
      log('⏸ [Market Weekend Guard] Thị trường hàng hóa quốc tế và MXV đang đóng cửa cuối tuần (từ sáng Thứ Bảy đến 05:00 sáng Thứ Hai). Tác vụ đối chiếu trong phiên (CHECK_KLGD) tạm nghỉ.');
      payload.result = {
        passed: true,
        isWeekendRest: true,
        message: 'Thị trường đóng cửa cuối tuần. Tác vụ đối chiếu trong phiên (CHECK_KLGD) tự động tạm nghỉ cho đến khi phiên mới mở lúc 05:00 sáng Thứ Hai.',
        mismatchedTrades: [],
        mismatchedTradesTotal: 0,
      };
      job.payload = payload;
      if (job?.markModified) job.markModified('payload');
      if (job?.save) await job.save();
      return payload.result;
    }

    const options = {
      checkKlgd: payload.options?.checkKlgd ?? true,
      checkTtm: payload.options?.checkTtm ?? true,
      checkTttt: payload.options?.checkTttt ?? true,
    };

    // ── BƯỚC 1: KÍCH HOẠT LUỒNG INGRESS TẢI DỮ LIỆU TƯƠI 4 NGUỒN ─────────────
    const ingressResult = await this.ingressPipelineService.downloadSessionData({
      targetDate,
      dateStr,
      year,
      month,
      day,
      subFolder,
      options,
      log,
    });

    if (job?.save) await job.save();

    if (ingressResult.isAborted || !ingressResult.success) {
      const abortMsg = ingressResult.abortReason || 'Lỗi tải dữ liệu tươi từ hệ thống đối tác';
      payload.result = {
        passed: false,
        isAborted: true,
        error: abortMsg,
        message: `Tạm dừng đối chiếu do thiếu dữ liệu từ hệ thống: ${abortMsg}`,
      };
      job.payload = payload;
      if (job?.save) await job.save();
      throw new Error(`[PARTNER_SERVICE_UNAVAILABLE] ${abortMsg}`);
    }

    // ── BƯỚC 2: GHÉP NỐI CÁC FILE THÔ CQG ────────────────────────────────────
    const { cqgDailyPath, msDailyPath } = ingressResult.paths;
    if (this.cqgMergerService && fs.existsSync(cqgDailyPath)) {
      const keysToMerge: Array<'FR' | 'OP' | 'PS'> = [];
      if (options.checkKlgd !== false) keysToMerge.push('FR');
      if (options.checkTtm !== false) keysToMerge.push('OP');
      if (options.checkTttt !== false) keysToMerge.push('PS');

      log(`CQG → Ghép nối các file thô (${keysToMerge.join(', ')})...`);
      try {
        const ttmPath = path.join(msDailyPath, 'TTTT.xlsx');
        if (options.checkKlgd !== false) {
          const fr1 = path.join(cqgDailyPath, 'FR1.xlsx');
          const fr2 = path.join(cqgDailyPath, 'FR2.xlsx');
          const frDest = path.join(cqgDailyPath, 'FR.xlsx');
          if (fs.existsSync(fr1) || fs.existsSync(fr2)) {
            this.cqgMergerService.mergeFR(fr1, fr2, frDest);
            log('CQG Ghép thành công FR.xlsx.');
          }
        }
        if (options.checkTtm !== false) {
          const op1 = path.join(cqgDailyPath, 'OP1.xlsx');
          const op2 = path.join(cqgDailyPath, 'OP2.xlsx');
          const opDest = path.join(cqgDailyPath, 'OP.xlsx');
          if (fs.existsSync(op1) || fs.existsSync(op2)) {
            this.cqgMergerService.mergeOP(op1, op2, opDest);
            log('CQG Ghép thành công OP.xlsx.');
          }
        }
        if (options.checkTttt !== false) {
          const ps1 = path.join(cqgDailyPath, 'PS1.xlsx');
          const ps2 = path.join(cqgDailyPath, 'PS2.xlsx');
          const psDest = path.join(cqgDailyPath, 'PS.xlsx');
          if (fs.existsSync(ps1) || fs.existsSync(ps2)) {
            this.cqgMergerService.mergePS(ps1, ps2, psDest, fs.existsSync(ttmPath) ? ttmPath : undefined);
            log('CQG Ghép thành công PS.xlsx.');
          }
        }
        log('CQG Hoàn tất kiểm tra và ghép file thô CQG.');
      } catch (mergeErr: any) {
        log(`CQG Merge Cảnh báo: ${mergeErr.message}`);
      }
    }

    // ── BƯỚC 3: THỰC THI SO KHỚP ĐỐI CHIẾU SỐ LIỆU (TRADING-OPS) ─────────────
    if (!this.klgdReconService) {
      throw new Error('KlgdReconService chưa được khởi tạo trong TradingOps.');
    }

    try {
      const result = await this.klgdReconService.runAutoCheckKLGD(targetDate, options);
      if (result.sessionStart && result.checkTime) {
        const startStr = new Date(result.sessionStart).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        const endStr = new Date(result.checkTime).toLocaleString('vi-VN', {
          timeZone: 'Asia/Ho_Chi_Minh',
        });
        log(`Khoảng thời gian lọc: từ ${startStr} đến ${endStr}`);
      }
      if (result.pendingSyncTrades && result.pendingSyncTrades.length > 0) {
        log(
          `[Bảo lưu lệnh khớp muộn] Ghi nhận ${result.pendingSyncTrades.length} giao dịch phát sinh sau mốc snapshot dữ liệu. Tự động bảo lưu sang chu kỳ kế tiếp.`,
        );
      }
      if (result.acmSessionAnomaly && result.acmAnomalyNote) {
        log(` ${result.acmAnomalyNote}`);
      }
      if (result.isWaitingFiles) {
        log(result.message || '[Đang chờ dữ liệu] Đang chờ cập nhật đầy đủ file đối chiếu.');
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
      if (job?.markModified) job.markModified('payload');
      if (job?.save) await job.save();

      if (!result.passed) {
        if (mismatchedAll.length > 0) {
          if (mismatchedAll.length > LOG_THRESHOLD) {
            const preview = mismatchedAll
              .slice(0, MAX_PREVIEW)
              .map((t: any) => `[${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}: ${t.reason}`)
              .join(' | ');
            log(
              ` Phát hiện ${mismatchedAll.length} lệch KLGD (vượt ngưỡng ${LOG_THRESHOLD}). ` +
              `Chi tiết đầy đủ xem file CSV đính kèm email. ` +
              `Preview ${MAX_PREVIEW} đầu tiên: ${preview}`,
            );
          } else {
            log('Chi tiết chênh lệch khớp lệnh:');
            mismatchedAll.forEach((t: any) => {
              if (job?.logs) {
                job.logs.push(
                  `- [${t.source}] TK ${t.maTKGD}, HĐ ${t.maHD}, Giá ${t.giaKhop}, Qty ${t.klGiaoDich}: ${t.reason}`,
                );
              }
            });
          }
        }
        log('Hoàn thành đối chiếu: Phát hiện chênh lệch khớp lệnh (LỆCH). Đã cập nhật kết quả đối soát.');
        if (job?.save) await job.save();
      }

      this.appendOvernightLog(dateStr, result, job.logs || []);
      return result;
    } catch (err: any) {
      log(`Lỗi đối chiếu khớp lệnh tự động: ${err.message}`);
      if (job?.save) await job.save();
      this.appendOvernightLog(dateStr, null, job.logs || [], err.message);
      throw err;
    }
  }

  /**
   * Thực thi Pipeline Đối chiếu DSGD trước EOD 3 bên (CHECK_DSGD_BEFORE_EOD)
   */
  public async handleCheckDsgdBeforeEodJob(job: any): Promise<any> {
    const payload = parseJobPayload(job);
    let targetDate: Date;
    let dateStr: string;
    if (payload.sessionDay || payload.targetDate) {
      const resolved = resolveBotTargetDate(payload);
      targetDate = resolved.dateObj;
      dateStr = resolved.dateStr;
    } else {
      const localNow = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      targetDate = new Date(Date.UTC(
        localNow.getUTCFullYear(),
        localNow.getUTCMonth(),
        localNow.getUTCDate(),
      ));
      targetDate.setUTCHours(0, 0, 0, 0);
      dateStr = targetDate.toISOString().split('T')[0];
    }

    // Tính toán ngày phiên T-1 (lùi weekend)
    const t1Date = new Date(targetDate);
    t1Date.setDate(t1Date.getDate() - 1);
    while (t1Date.getDay() === 0 || t1Date.getDay() === 6) {
      t1Date.setDate(t1Date.getDate() - 1);
    }
    t1Date.setHours(0, 0, 0, 0);
    const t1Year = t1Date.getFullYear();
    const t1Month = String(t1Date.getMonth() + 1).padStart(2, '0');
    const t1Day = String(t1Date.getDate()).padStart(2, '0');
    const t1DateStr = `${t1Year}-${t1Month}-${t1Day}`;

    if (job?.logs) {
      job.logs.push(
        `[${new Date().toISOString()}] Bắt đầu Kiểm tra DSGD Trước EOD (Chuẩn C#) ngày ca trực ${dateStr} (Phiên T-1: ${t1DateStr})...`,
      );
    }
    if (job?.save) await job.save();

    try {
      const dsgdResult = this.dsgdBeforeEodService
        ? await this.dsgdBeforeEodService.runAutoCheckDSGDBeforeEOD({
            system: payload.system || 'MS',
            tradingDate: targetDate,
            triggerDownload: true,
          })
        : null;

      const result = {
        passed: dsgdResult ? dsgdResult.passed : true,
        isWaitingFiles: Boolean(dsgdResult?.isSnapshotMissing),
        message: dsgdResult ? dsgdResult.messages.join(' | ') : 'Không có service DsgdBeforeEodService',
        totals: {
          totalOriginal: dsgdResult?.totalOriginal ?? 0,
          totalTemp: dsgdResult?.totalTemp ?? 0,
          differTotal: dsgdResult?.differTotal ?? 0,
          totalACMMS: dsgdResult?.totalACMMS ?? 0,
          totalACMSFTP: dsgdResult?.totalACMSFTP ?? 0,
          differACM: dsgdResult?.differACM ?? 0,
        },
        tradingDate: targetDate,
        targetDate: t1Date,
        summaryMessage: dsgdResult ? dsgdResult.messages.join(' | ') : '',
        dsgdBeforeEod: dsgdResult,
      };

      const t1DisplayStr = t1Date.toLocaleDateString('vi-VN');
      if (job?.logs) {
        job.logs.push(`[${new Date().toISOString()}] Dữ liệu phiên T-1: ${t1DisplayStr}`);
        if (result.isWaitingFiles) {
          job.logs.push(`[${new Date().toISOString()}] ${result.message}`);
        } else {
          job.logs.push(`[${new Date().toISOString()}] Hoàn thành Kiểm tra DSGD Trước EOD.`);
          job.logs.push(`[${new Date().toISOString()}] Kết quả: ${result.passed ? 'KHỚP' : 'LỆCH'}`);
          if (result.totals) {
            const orig = result.totals.totalOriginal ?? 0;
            const snap = result.totals.totalTemp ?? 0;
            const diffTot = result.totals.differTotal ?? 0;
            const acmMs = result.totals.totalACMMS ?? 0;
            const acmCsv = result.totals.totalACMSFTP ?? 0;
            const diffAcm = result.totals.differACM ?? 0;
            job.logs.push(
              `[${new Date().toISOString()}] Tổng kết KLGD:` +
              `\n• DSGD gốc: ${orig} lot vs DSGD snapshot: ${snap} lot (Lệch: ${diffTot} lot)` +
              `\n• ACM MS: ${acmMs} lot vs Straits CSV: ${acmCsv} lot (Lệch: ${diffAcm} lot)`,
            );
          }
          const msgs = dsgdResult?.messages || [result.summaryMessage || ''];
          for (const msg of msgs) {
            if (msg) job.logs.push(`[${new Date().toISOString()}] • ${msg}`);
          }
        }
      }

      payload.result = result;
      job.payload = payload;
      if (job?.markModified) job.markModified('payload');
      if (job?.save) await job.save();

      this.appendOvernightLog(t1DateStr, result, job?.logs || []);
      return result;
    } catch (err: any) {
      if (job?.logs) {
        job.logs.push(`[${new Date().toISOString()}] Lỗi đối chiếu Dsgd-Before-EOD tự động: ${err.message}`);
      }
      if (job?.save) await job.save();
      this.appendOvernightLog(t1DateStr, null, job?.logs || [], err.message);
      throw err;
    }
  }

  /**
   * Ghi log kết quả đối chiếu ra file check_klgd_overnight_log.txt phục vụ theo dõi ca đêm
   */
  private appendOvernightLog(
    targetDateStr: string,
    result: any,
    logs: string[],
    error?: string,
  ) {
    try {
      const nowStr = new Date().toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
      });
      const logFiles = [
        path.join(process.cwd(), 'check_klgd_overnight_log.txt'),
        path.join(path.dirname(process.cwd()), 'check_klgd_overnight_log.txt'),
      ];

      const lines: string[] = [];
      lines.push('================================================================================');
      lines.push(` THỜI ĐIỂM CHẠY: ${nowStr} (Ngày phiên: ${targetDateStr})`);
      lines.push('================================================================================');

      if (error) {
        lines.push(` TRẠNG THÁI: LỖI THỰC THI - ${error}`);
      } else if (result) {
        const status = result.passed ? ' KHỚP HOÀN TOÀN' : ' CÓ CHÊNH LỆCH';
        lines.push(` KẾT QUẢ TỔNG QUÁT: ${status}`);
        lines.push('');
        lines.push('--- BẢNG TỔNG HỢP SỐ LIỆU ---');
        const orig = result.totals?.totalOriginal ?? result.dsgdBeforeEod?.totalOriginal ?? 0;
        const snap = result.totals?.totalTemp ?? result.dsgdBeforeEod?.totalTemp ?? 0;
        const diffTotal = result.totals?.differTotal ?? result.dsgdBeforeEod?.differTotal ?? 0;
        const acmMs = result.totals?.totalACMMS ?? result.dsgdBeforeEod?.totalACMMS ?? 0;
        const acmCsv = result.totals?.totalACMSFTP ?? result.dsgdBeforeEod?.totalACMSFTP ?? 0;
        const diffAcm = result.totals?.differACM ?? result.dsgdBeforeEod?.differACM ?? 0;

        lines.push(`• Khối lượng DSGD: Gốc = ${orig} lot | Snapshot = ${snap} lot | Lệch = ${diffTotal} lot`);
        lines.push(`• Khối lượng ACM : MS = ${acmMs} lot | Straits CSV = ${acmCsv} lot | Lệch = ${diffAcm} lot`);
        lines.push('');

        const msgs = result.dsgdBeforeEod?.messages || [result.summaryMessage || ''];
        for (const msg of msgs) {
          if (msg) lines.push(`• ${msg}`);
        }
        lines.push('');
      }

      lines.push('--- NHẬT KÝ TIẾN TRÌNH BOT ---');
      logs.forEach((l) => lines.push(`[LOG] ${l}`));
      lines.push('\n');

      const content = lines.join('\n');
      for (const f of logFiles) {
        try {
          fs.appendFileSync(f, content, 'utf8');
        } catch {}
      }
    } catch (e: any) {
      this.logger.error(`Không thể ghi log overnight: ${e.message}`);
    }
  }
}
