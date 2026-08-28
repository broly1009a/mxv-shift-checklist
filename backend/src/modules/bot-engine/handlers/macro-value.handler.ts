import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { ValueStatisticsService } from '../../lot-statistics/value-statistics.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { parseJobPayload } from '../helpers/bot-path.helper';

@Injectable()
export class MacroValueJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(MacroValueJobHandler.name);
  readonly jobTypes = ['RUN_VALUE_MACRO', 'RUN_VALUE_TVKD_MACRO'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly valueStatisticsService: ValueStatisticsService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    if (job.jobType === 'RUN_VALUE_TVKD_MACRO') {
      return this.handleRunValueTvkdMacroJob(job);
    }
    return this.handleRunValueMacroJob(job);
  }

  private async handleRunValueMacroJob(job: any) {
    const payload = parseJobPayload(job);
    const targetDateStr = payload.targetDate;
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunValueMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Macro Thống kê Giá Trị] Bắt đầu chạy tính toán [Thống kê giá trị giao dịch có ACM] cho ngày: ${targetDateStr}`,
    );
    log(
      `[Macro Thống kê Giá Trị] Kết quả sẽ được ghi vào thư mục: Thong ke gia tri giao dich theo TVKD`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear();
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(targetDate.getDate()).padStart(2, '0');

      const targetRoot =
        payload.targetRoot ||
        (await this.settingsService.getSetting(
          'bot_lot_macro_target_root',
          'M:\\Quanlygiaodich\\Tai lieu hoat dong',
        ));

      const msFuturesRoot = fs.existsSync(path.join(targetRoot, 'Backup MS', 'Futures'))
        ? path.join(targetRoot, 'Backup MS', 'Futures')
        : targetRoot;
      const monthFolder = fs.existsSync(path.join(msFuturesRoot, String(year), `${monthStr}.${year}`))
        ? `${monthStr}.${year}`
        : `T${monthStr}.${year}`;

      const dsgdPath =
        payload.dsgdPath ||
        path.join(
          msFuturesRoot,
          String(year),
          monthFolder,
          `${dayStr}.${monthStr}`,
          'DSGD.xlsx',
        );

      const pathNormal =
        payload.pathNormal ||
        (await this.settingsService.getSetting('bot_lot_macro_path_normal')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ${year}.xlsx`,
        );

      const pathSpread =
        payload.pathSpread ||
        (await this.settingsService.getSetting('bot_lot_macro_path_spread')) ||
        path.join(
          'C:\\Users\\hiepth\\Videos\\Marco thong ke gia tri',
          `Thong ke gia tri giao dich Spread ${year}.xlsx`,
        );
      const pathLme =
        payload.pathLme ||
        (await this.settingsService.getSetting('bot_lot_macro_path_lme')) ||
        path.join(
          targetRoot,
          'Backup CQG',
          'LME',
          String(year),
          `Thong ke gia tri giao dich LME ${year}.xlsx`,
        );
      const pathOptions =
        payload.pathOptions ||
        (await this.settingsService.getSetting('bot_lot_macro_path_options')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich Options ${year}.xlsx`,
        );
      const pathAcm =
        payload.pathAcm ||
        (await this.settingsService.getSetting('bot_lot_macro_path_acm')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich',
          `Thong ke gia tri giao dich ACM ${year}.xlsx`,
        );
      const pathTvkd =
        payload.pathTvkd ||
        (await this.settingsService.getSetting('bot_lot_macro_path_tvkd')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich theo TVKD',
          `Thong ke gia tri giao dich ${year} theo TVKD.xlsx`,
        );

      const defaultMacroPath = fs.existsSync(path.join(process.cwd(), 'marco'))
        ? path.join(
          process.cwd(),
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        )
        : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke gia tri giao dich có ACM',
          'Macro thong ke gia tri giao dich có ACM.xlsm',
        );
      const macroPath =
        payload.macroPath ||
        (await this.settingsService.getSetting(
          'bot_macro_value_path',
          defaultMacroPath,
        ));

      log(`[NestJS Thống kê Giá Trị] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - Tệp bản đồ cấu hình (Excel): ${macroPath}`);
      log(`   - Thư mục gốc dữ liệu (Target Root): ${targetRoot}`);
      log(`   - File DSGD đầu vào: ${dsgdPath}`);
      log(`   - File Thống kê giá trị (Normal): ${pathNormal}`);
      log(`   - File Thống kê giá trị Spread: ${pathSpread}`);
      log(`   - File Thống kê giá trị LME: ${pathLme}`);
      log(`   - File Thống kê giá trị Options: ${pathOptions}`);
      log(`   - File Thống kê giá trị ACM: ${pathAcm}`);
      log(`   - File Thống kê giá trị theo TVKD: ${pathTvkd}`);
      await safeSave();

      const result = await this.valueStatisticsService.processValueStatistics(
        targetDate,
        {
          ...payload,
          dsgdPath,
          targetRoot,
          pathNormal,
          pathSpread,
          pathLme,
          pathOptions,
          pathAcm,
          pathTvkd,
          macroPath,
        },
      );
      log(`✅ Chạy tính toán thống kê giá trị thành công.`);
      log(
        `Tỷ giá mặc định: ${result.tyGiaDefault}, TRU: ${result.tyGiaTru}, MPO: ${result.tyGiaMpo}`,
      );
      log(
        `Tổng số dòng giao dịch Normal: ${result.normalCount}, Spread: ${result.spreadCount}`,
      );
      await safeSave();
      return result;
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê giá trị giao dịch: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  private async handleRunValueTvkdMacroJob(job: any) {
    const payload = parseJobPayload(job);
    const targetDateStr = payload.targetDate;
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate (YYYY-MM-DD) trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunValueTvkdMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Macro Thống kê TVKD Lũy Kế] Bắt đầu chạy tính toán [TVKD lũy kế] cho ngày: ${targetDateStr}`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear();
      const monthStr = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dayStr = String(targetDate.getDate()).padStart(2, '0');

      const targetRoot =
        payload.targetRoot ||
        (await this.settingsService.getSetting(
          'bot_lot_macro_target_root',
          'M:\\Quanlygiaodich\\Tai lieu hoat dong',
        ));

      const msFuturesRoot = fs.existsSync(path.join(targetRoot, 'Backup MS', 'Futures'))
        ? path.join(targetRoot, 'Backup MS', 'Futures')
        : targetRoot;
      const monthFolder = fs.existsSync(path.join(msFuturesRoot, String(year), `${monthStr}.${year}`))
        ? `${monthStr}.${year}`
        : `T${monthStr}.${year}`;

      const dsgdPath =
        payload.dsgdPath ||
        path.join(
          msFuturesRoot,
          String(year),
          monthFolder,
          `${dayStr}.${monthStr}`,
          'DSGD.xlsx',
        );

      const pathTvkd =
        payload.pathTvkd ||
        (await this.settingsService.getSetting('bot_lot_macro_path_tvkd')) ||
        path.join(
          targetRoot,
          'Thong ke gia tri giao dich theo TVKD',
          `Thong ke gia tri giao dich ${year} theo TVKD.xlsx`,
        );

      log(`[NestJS Thống kê TVKD Lũy Kế] Chi tiết các đường dẫn tệp tin xử lý:`);
      log(`   - Thư mục gốc dữ liệu (Target Root): ${targetRoot}`);
      log(`   - File DSGD đầu vào: ${dsgdPath}`);
      log(`   - File Thống kê giá trị theo TVKD: ${pathTvkd}`);
      await safeSave();

      const result = await this.valueStatisticsService.processTvkdOnly(
        targetDate,
        {
          targetRoot,
          dsgdPath,
          pathTvkd,
        },
      );
      log(`✅ Chạy tính toán thống kê TVKD lũy kế thành công.`);
      await safeSave();
      return result;
    } catch (err: any) {
      log(`❌ Lỗi chạy thống kê TVKD lũy kế: ${err.message}`);
      await safeSave();
      throw err;
    }
  }
}
