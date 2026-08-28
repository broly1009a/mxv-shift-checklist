import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { CcpStatisticsService } from '../../ccp-statistics/ccp-statistics.service';
import { SystemSettingsService } from '../../system-settings/system-settings.service';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { parseJobPayload, getMsBackupBase } from '../helpers/bot-path.helper';

@Injectable()
export class CcpStatsJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(CcpStatsJobHandler.name);
  readonly jobTypes = ['RUN_MACRO'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly ccpStatisticsService: CcpStatisticsService,
    private readonly settingsService: SystemSettingsService,
    private readonly rpaDownloaderService: RpaDownloaderService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const targetDateStr = payload.targetDate || payload.sessionDay;
    if (!targetDateStr) {
      throw new Error('Thiếu tham số targetDate/sessionDay trong payload.');
    }

    let savePromise: Promise<any> = Promise.resolve();
    const safeSave = () => {
      savePromise = savePromise
        .then(() => job.save())
        .catch((err) => {
          this.logger.error(
            `Error saving bot job in handleRunMacroJob: ${err.message}`,
          );
        });
      return savePromise;
    };

    const log = (msg: string) => {
      this.logger.log(msg);
      job.logs.push(`[${new Date().toISOString()}] ${msg}`);
    };

    log(
      `[Báo cáo CCP Bạc Thỏi] Bắt đầu chạy tính toán [Macro Thống kê Số Lô & Giá Trị Giao Dịch CCP] cho ngày: ${targetDateStr}`,
    );
    log(
      `[Báo cáo CCP Bạc Thỏi] Lưu ý: Đây là báo cáo dành riêng cho Pilot Bạc Thỏi (đầu ra Thong_ke_kich_ban_Pilot_Bac_Final.xlsx), biệt lập với Macro Số Lốt hoặc Macro Giá Trị.`,
    );
    await safeSave();

    try {
      const targetDate = new Date(targetDateStr);
      const year = targetDate.getFullYear().toString();
      const month = String(targetDate.getMonth() + 1).padStart(2, '0');
      const day = String(targetDate.getDate()).padStart(2, '0');

      const backupMs = payload.backupPathMs || (await getMsBackupBase(this.settingsService));

      const subFolder = path.join(year, `T${month}.${year}`, `${day}.${month}`);
      const dailyPath = path.join(backupMs, subFolder);

      log(`Thư mục MS Daily: ${dailyPath}`);
      await safeSave();

      if (!fs.existsSync(dailyPath)) {
        throw new Error(
          `Thư mục backup ngày ${targetDateStr} không tồn tại: ${dailyPath}`,
        );
      }

      // Resolve 6 files
      const dsgdCcpPath = path.join(dailyPath, 'DSGD.xlsx');
      let dsgdMmCcpBuffer: Buffer;
      const dsgdMmCcpPathStd = path.join(dailyPath, 'DSGD MM CCP.xlsx');
      const dsgdMmCcpPath = path.join(dailyPath, 'DSGD-MM.xlsx');
      const dsgdMmCcpPath2 = path.join(dailyPath, 'DSGD_MM.xlsx');

      if (fs.existsSync(dsgdMmCcpPathStd)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPathStd);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPathStd}`);
      } else if (fs.existsSync(dsgdMmCcpPath)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPath);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPath}`);
      } else if (fs.existsSync(dsgdMmCcpPath2)) {
        dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPath2);
        log(`Tìm thấy file DSGD MM CCP tại: ${dsgdMmCcpPath2}`);
      } else {
        log(`Chưa có file DSGD MM CCP trong thư mục backup. Tiến hành đăng nhập Core CCP để tải tự động...`);
        await safeSave();
        try {
          const downloadSuccess = await this.rpaDownloaderService.downloadDsgdMmCcp(dsgdMmCcpPathStd);
          if (downloadSuccess && fs.existsSync(dsgdMmCcpPathStd)) {
            dsgdMmCcpBuffer = fs.readFileSync(dsgdMmCcpPathStd);
            log(`✅ Tự động tải file DSGD MM CCP thành công và nạp vào dữ liệu tính toán.`);
          } else {
            throw new Error('Tải tệp tin không thành công không rõ lý do.');
          }
        } catch (err: any) {
          log(`⚠️ Không tải được DSGD MM CCP tự động: ${err.message}`);
          dsgdMmCcpBuffer = this.createEmptyDsgdBuffer();
          log(
            `File DSGD MM CCP riêng biệt vắng mặt (không bắt buộc). Khởi tạo buffer trống.`,
          );
        }
      }

      const dstkgdPath = path.join(dailyPath, 'DSTKGD-Futures.xlsx');
      const dstkgdPathFallback = path.join(dailyPath, 'DSTKGD.xlsx');
      const nrPath = path.join(dailyPath, 'NR.xlsx');
      const ttmPath = path.join(dailyPath, 'TTM.xlsx');
      const ttttPath = path.join(dailyPath, 'TTTT.xlsx');

      if (!fs.existsSync(dsgdCcpPath)) {
        throw new Error(
          `Thiếu file giao dịch CCP (DSGD.xlsx) tại: ${dailyPath}`,
        );
      }

      const dstkgdFinalPath = fs.existsSync(dstkgdPath)
        ? dstkgdPath
        : dstkgdPathFallback;
      if (!fs.existsSync(dstkgdFinalPath)) {
        throw new Error(
          `Thiếu file danh sách tài khoản (DSTKGD-Futures.xlsx / DSTKGD.xlsx) tại: ${dailyPath}`,
        );
      }
      if (!fs.existsSync(nrPath)) {
        throw new Error(
          `Thiếu file nộp rút (NR.xlsx) tại: ${dailyPath}`,
        );
      }
      if (!fs.existsSync(ttmPath)) {
        throw new Error(
          `Thiếu file thông tin mở (TTM.xlsx) tại: ${dailyPath}`,
        );
      }
      if (!fs.existsSync(ttttPath)) {
        throw new Error(
          `Thiếu file thông tin tất toán (TTTT.xlsx) tại: ${dailyPath}`,
        );
      }

      const dsgdCcpBuffer = fs.readFileSync(dsgdCcpPath);
      const dstkgdBuffer = fs.readFileSync(dstkgdFinalPath);
      const nrBuffer = fs.readFileSync(nrPath);
      const ttmBuffer = fs.readFileSync(ttmPath);
      const ttttBuffer = fs.readFileSync(ttttPath);

      log(`Đã nạp thành công 6 buffer file đầu vào. Bắt đầu tính toán...`);
      await safeSave();

      const defaultTemplatePath = fs.existsSync(
        path.join(
          process.cwd(),
          'marco',
          'Thong ke so lot va gia tri giao dich CCP',
          'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
        ),
      )
        ? path.join(
          process.cwd(),
          'marco',
          'Thong ke so lot va gia tri giao dich CCP',
          'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
        )
        : path.join(
          process.cwd(),
          '..',
          'marco',
          'Thong ke so lot va gia tri giao dich CCP',
          'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
        );

      const templatePath =
        payload.templatePath ||
        (await this.settingsService.getSetting(
          'bot_ccp_template_path',
          defaultTemplatePath,
        ));

      const targetOutputPath = path.join(
        dailyPath,
        'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
      );

      const outputPath = await this.ccpStatisticsService.processCcpData(
        {
          dsgdCcp: dsgdCcpBuffer,
          dsgdMmCcp: dsgdMmCcpBuffer,
          dstkgd: dstkgdBuffer,
          nr: nrBuffer,
          ttm: ttmBuffer,
          tttt: ttttBuffer,
        },
        targetDate,
        targetOutputPath,
      );

      log(`✅ Chạy báo cáo CCP thành công. File kết quả: ${outputPath}`);
      await safeSave();
      return { outputPath };
    } catch (err: any) {
      log(`❌ Lỗi chạy báo cáo thống kê CCP: ${err.message}`);
      await safeSave();
      throw err;
    }
  }

  private createEmptyDsgdBuffer(): Buffer {
    const headers = [
      'STT',
      'Mã lệnh',
      'Mã giao dịch',
      'Mã TKGD',
      'Tên TKGD',
      'Mã HĐ',
      'Tên HĐ',
      'Hình thức lệnh',
      'Loại lệnh',
      'Phương thức ghép',
      'Chiều mua bán',
      'KL đặt lệnh',
      'KL giao dịch',
      'Giá khớp',
      'Giá giới hạn',
      'Giá dừng',
      'Phí quyền chọn (USD)',
      'Phí quyền chọn (VND)',
      'Phí giao dịch',
      'Người đặt lệnh',
      'Ngày giờ đặt lệnh',
      'Ngày giờ thực hiện',
      'Mã TVKD',
      'Tên TVKD',
      'Mã MG',
      'Tên MG',
      'Mã CTV',
      'Tên CTV',
      'Nhóm hàng hoá',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
}
