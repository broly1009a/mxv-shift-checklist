import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { CcpCeDownloaderService, CcpReportConfig, DEFAULT_CCP_REPORTS, DEFAULT_CE_REPORTS } from '../ccp-ce-downloader.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { decrypt } from '../utils/crypto';
import { parseJobPayload, resolveStoragePathCrossPlatform } from '../helpers/bot-path.helper';

/**
 * CcpCeDownloadJobHandler — Xử lý Job tải báo cáo từ VNCLEAR CoreCCP / CoreEX.
 *
 * Trigger qua BotJob với jobType: 'DOWNLOAD_CCP_REPORT' hoặc 'DOWNLOAD_CE_REPORT'.
 * Payload JSON:
 *   {
 *     startDate: 'YYYY-MM-DD',
 *     endDate: 'YYYY-MM-DD',
 *     reports?: string[],   // Danh sách mã báo cáo (NR, TTTT, DSL...) — rỗng = tất cả mặc định
 *     outputDir?: string,   // Override thư mục lưu (nếu không có thì lấy từ credentials DB)
 *   }
 *
 * Handler tự đọc credentials từ DB (bot_credentials_ccp / bot_credentials_ce) — zero hardcode.
 */
@Injectable()
export class CcpCeDownloadJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(CcpCeDownloadJobHandler.name);

  /** Một handler phục vụ cả 2 jobType CCP và CE */
  readonly jobTypes = ['DOWNLOAD_CCP_REPORT', 'DOWNLOAD_CE_REPORT'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly ccpCeDownloaderService: CcpCeDownloaderService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const { jobType } = job;
    const isCcp = jobType === 'DOWNLOAD_CCP_REPORT';
    const credKey = isCcp ? 'bot_credentials_ccp' : 'bot_credentials_ce';
    const systemLabel = isCcp ? 'CoreCCP' : 'CoreEX';

    // ─── Đọc Credentials từ DB ─────────────────────────────────────────────
    const credRaw = await this.settingsService.getSetting(credKey, '');
    if (!credRaw) {
      throw new Error(
        `Chưa cấu hình thông tin đăng nhập ${systemLabel}. ` +
        `Vào Admin -> Cấu hình kết nối để thiết lập.`,
      );
    }

    let creds: any = {};
    try {
      creds = JSON.parse(decrypt(credRaw));
    } catch {
      throw new Error(`Không thể giải mã cấu hình ${systemLabel}.`);
    }

    if (!creds.url || !creds.username || !creds.password) {
      throw new Error(
        `Cấu hình ${systemLabel} thiếu url/username/password. ` +
        `Vào Admin -> Cấu hình kết nối để bổ sung.`,
      );
    }

    // ─── Đọc Payload ───────────────────────────────────────────────────────
    const payload = parseJobPayload(job);

    const startDate: string = payload.startDate;
    const endDate: string = payload.endDate;

    if (!startDate || !endDate) {
      throw new Error(
        `Job ${systemLabel} thiếu startDate/endDate trong payload.`,
      );
    }

    // outputDir: ưu tiên payload -> credentials DB -> thư mục ca trực theo ngày
    let baseDir: string = payload.outputDir || creds.outputDir;
    if (!baseDir || baseDir === 'backupCCP' || baseDir === 'backupCE') {
      const backupSettingKey = isCcp ? 'bot_backup_path_ccp' : 'bot_backup_path_ce';
      const defaultSettingPath = isCcp
        ? 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CCP\\Futures'
        : 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CE\\Futures';
      baseDir = await this.settingsService.getSetting(backupSettingKey, defaultSettingPath);
    }

    const [sY, sM, sD] = startDate.includes('-')
      ? startDate.split('-')
      : startDate.split('/').reverse();
    const subFolder = path.join(sY, `T${sM}.${sY}`, `${sD}.${sM}`);

    let rawOutputDir = baseDir;
    if (!/\d{2}\.\d{2}$/.test(rawOutputDir.trim())) {
      rawOutputDir = path.join(baseDir, subFolder);
    }
    const outputDir: string = resolveStoragePathCrossPlatform(rawOutputDir);
    if (!fs.existsSync(outputDir)) {
      try {
        fs.mkdirSync(outputDir, { recursive: true });
      } catch {}
    }

    const reports: string[] | undefined = payload.reports;

    // ─── Log bắt đầu ───────────────────────────────────────────────────────
    const logPrefix = `[${new Date().toISOString()}]`;
    job.logs = job.logs || [];
    job.logs.push(
      `${logPrefix} [${systemLabel}] Bắt đầu tải báo cáo: ${startDate} → ${endDate}`,
    );
    job.logs.push(
      `${logPrefix} [${systemLabel}] Thư mục lưu: ${outputDir}`,
    );
    if (reports?.length) {
      job.logs.push(
        `${logPrefix} [${systemLabel}] Báo cáo được chọn: ${reports.join(', ')}`,
      );
    } else {
      job.logs.push(
        `${logPrefix} [${systemLabel}] Báo cáo: tất cả mặc định`,
      );
    }
    await job.save();

    // ─── Resolve report list ────────────────────────────────────────────────
    const defaultReports = isCcp ? DEFAULT_CCP_REPORTS : DEFAULT_CE_REPORTS;
    let resolvedReports: CcpReportConfig[] | undefined;
    if (Array.isArray(reports) && reports.length > 0) {
      // payload.reports có thể là string[] (mã code) hoặc CcpReportConfig[]
      if (typeof reports[0] === 'string') {
        const codes = (reports as unknown as string[]).map((c) => c.toUpperCase());
        resolvedReports = defaultReports.filter((r) =>
          codes.includes(r.code.toUpperCase()),
        );
      } else {
        resolvedReports = reports as unknown as CcpReportConfig[];
      }
    }
    // undefined = dùng tất cả mặc định trong service

    // ─── Thực thi tải báo cáo ──────────────────────────────────────────────
    let success = false;
    try {
      success = await this.ccpCeDownloaderService.run(
        {
          systemUrl: creds.url,
          username: creds.username,
          password: creds.password,
          startDate,
          endDate,
          outputDir,
          reports: resolvedReports,
        },
        async (msg: string) => {
          job.logs = job.logs || [];
          job.logs.push(`[${new Date().toISOString()}] ${msg}`);
          await job.save().catch(() => {});
        },
      );
    } catch (err: any) {
      job.logs.push(
        `${logPrefix} [${systemLabel}] LỖI khi tải báo cáo: ${err?.message || String(err)}`,
      );
      await job.save();
      throw err;
    }

    // ─── Dọn dẹp các thư mục con trùng lặp cũ nếu đã có file phẳng ────────
    const reportCodes = ['EOD', 'NR', 'QLTTTKGD', 'TTTT'];
    for (const code of reportCodes) {
      const sub = path.join(outputDir, code);
      const flat = path.join(outputDir, `${code}.csv`);
      if (fs.existsSync(sub) && fs.existsSync(flat)) {
        try {
          fs.rmSync(sub, { recursive: true, force: true });
        } catch {}
      }
    }

    // ─── Log kết quả ───────────────────────────────────────────────────────
    if (success) {
      job.logs.push(
        `${logPrefix} [${systemLabel}] Tải báo cáo THÀNH CÔNG. Thư mục: ${outputDir}`,
      );
    } else {
      job.logs.push(
        `${logPrefix} [${systemLabel}] Tải báo cáo KẾT THÚC với cảnh báo (partial failure).`,
      );
    }
    await job.save();

    return {
      success,
      systemLabel,
      startDate,
      endDate,
      outputDir,
    };
  }
}
