import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { LotStatisticsService } from '../../lot-statistics/lot-statistics.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import {
  parseJobPayload,
  getMsBackupBase,
  getCqgBackupBase,
} from '../helpers/bot-path.helper';

@Injectable()
export class MacroLotJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(MacroLotJobHandler.name);
  readonly jobTypes = ['RUN_LOT_MACRO'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly lotStatisticsService: LotStatisticsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const targetDateStr = payload.targetDate; // Định dạng YYYY-MM-DD
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunLotMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    const targetDate = new Date(targetDateStr);
    const year = targetDate.getFullYear().toString();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');

    log(`[Macro Thống kê Số Lốt] Bắt đầu chạy tính toán [Thống kê số lốt giao dịch có ACM] cho ngày: ${targetDateStr}`);
    log(`[Macro Thống kê Số Lốt] Báo cáo đầu ra sẽ cập nhật vào các tệp cumulative: Thong ke so lot giao dich ${year} 2.xlsx, Thong ke so lot giao dich ACM/LME/Options...`);
    await safeSave();

    try {
      const backupMs = payload.backupPathMs || (await getMsBackupBase(this.settingsService));
      const backupCqg = payload.backupPathCqg || (await getCqgBackupBase(this.settingsService));

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const folderPathMs = path.join(backupMs, subFolder);
      const folderPathCqg = path.join(backupCqg, subFolder);

      log(`Thư mục MS: ${folderPathMs}`);
      log(`Thư mục CQG: ${folderPathCqg}`);
      await safeSave();

      const files = this.lotStatisticsService.loadFilesFromDirectories(
        folderPathMs,
        folderPathCqg,
      );
      log(`Nạp file thành công. Tiến hành chạy tính toán số lot...`);
      await safeSave();

      const lotConfig = await this.lotStatisticsService.getConfig();
      const filterLmeKyHan = lotConfig.defaultLmeKyHan || 'M26';

      const lastPartCqgIdx = backupCqg.lastIndexOf('\\');
      const parentBaseCqg =
        lastPartCqgIdx > 0 ? backupCqg.substring(0, lastPartCqgIdx) : backupCqg;

      const pathDsgdCumulative =
        lotConfig.defaultPathDsgdCumulative ||
        `${folderPathMs}\\DSGD T${month}.${year}.xlsx`;
      const pathNormal =
        lotConfig.defaultPathNormal ||
        `${folderPathCqg}\\Thong ke so lot giao dich ${year} 2.xlsx`;
      const pathAcm =
        lotConfig.defaultPathAcm ||
        `${parentBaseCqg}\\ACM\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich ACM ${year} 2.xlsx`;
      const pathLme =
        lotConfig.defaultPathLme ||
        `${parentBaseCqg}\\LME\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich LME ${year}.xlsx`;
      const pathOptions =
        lotConfig.defaultPathOptions ||
        `${parentBaseCqg}\\Options\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Options ${year}.xlsx`;
      const pathSpread =
        lotConfig.defaultPathSpread ||
        `${parentBaseCqg}\\Spread\\${year}\\T${month}.${year}\\${day}.${month}\\Thong ke so lot giao dich Spread ${year}.xlsx`;

      log(`[NestJS Thống kê Số Lốt] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - File DSGD Tuần/Tháng (Cumulative): ${pathDsgdCumulative}`);
      log(`   - File Thống kê số lốt (Normal): ${pathNormal}`);
      log(`   - File Thống kê số lốt ACM: ${pathAcm}`);
      log(`   - File Thống kê số lốt LME: ${pathLme}`);
      log(`   - File Thống kê số lốt Options: ${pathOptions}`);
      log(`   - File Thống kê số lốt Spread: ${pathSpread}`);
      await safeSave();

      const parseDateArray = (input: any) => {
        if (!input) return [];
        if (Array.isArray(input)) return input;
        try {
          const parsed = JSON.parse(input);
          return Array.isArray(parsed) ? parsed : [input];
        } catch {
          if (typeof input === 'string') {
            return input
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
          }
          return [];
        }
      };

      const updateCumulativeStr = await this.settingsService.getSetting(
        'bot_lot_macro_update_cumulative',
        'true',
      );
      const updateCumulative =
        payload?.updateCumulative === true ||
        payload?.updateCumulative === 'true' ||
        updateCumulativeStr === 'true';

      const processParams = {
        ngayGD: targetDateStr,
        truDates: parseDateArray(payload.truDates),
        fefDates: parseDateArray(payload.fefDates),
        zftDates: parseDateArray(payload.zftDates),
        filterLmeKyHan,
        deadline: payload.deadline ? parseFloat(payload.deadline) : undefined,
        updateCumulative,
        pathDsgdCumulative,
        pathNormal,
        pathAcm,
        pathLme,
        pathOptions,
        pathSpread,
      };

      const result = await this.lotStatisticsService.processLotStatistics(
        files,
        processParams,
        job.logs,
      );
      log(`✅ Chạy tính toán thống kê số lot thành công.`);
      log(
        `Kết quả: DSGD Product: ${result.summary.dsgdProduct}, FR Product: ${result.summary.frProduct}`,
      );

      const allPassed = result.validations.every((v: any) => v.passed);
      if (allPassed) {
        log(`✅ Tất cả các kiểm tra đối chiếu (Validation) đều khớp.`);
      } else {
        log(`⚠️ Phát hiện chênh lệch đối chiếu:`);
        for (const val of result.validations) {
          if (!val.passed) {
            log(
              `   - ${val.field}: mong đợi ${val.expected}, thực tế ${val.actual}`,
            );
          }
        }
      }

      await safeSave();
      return result;
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê số lot: ${err.message}`);
      await safeSave();
      throw err;
    }
  }
}
