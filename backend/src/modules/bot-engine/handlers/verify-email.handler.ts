import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { IBotJobHandler, IJobExecutionContext } from '../core/job-handler.interface';
import { BotJobHandlerRegistry } from '../core/job-handler.registry';
import { RpaDownloaderService } from '../rpa-downloader.service';
import { TelegramService } from '../../telegram/telegram.service';
import { parseJobPayload } from '../helpers/bot-path.helper';

@Injectable()
export class VerifyEmailJobHandler implements IBotJobHandler, OnModuleInit {
  private readonly logger = new Logger(VerifyEmailJobHandler.name);
  readonly jobTypes = ['VERIFY_EMAIL_STATUS'];

  constructor(
    private readonly registry: BotJobHandlerRegistry,
    private readonly rpaDownloaderService: RpaDownloaderService,
    private readonly telegramService: TelegramService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(job: any, context: IJobExecutionContext): Promise<any> {
    const payload = parseJobPayload(job);
    const { shiftLogId, sessionDay } = payload;

    job.logs.push(
      `[${new Date().toISOString()}] Bắt đầu chạy RPA xác minh email sao kê...`,
    );
    await job.save();

    const tempDir = path.join(
      process.cwd(),
      'temp',
      'email-verify',
      shiftLogId || 'default',
    );
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    try {
      job.logs.push(
        `[${new Date().toISOString()}] Đang đăng nhập và tải báo cáo gửi email từ M-System Admin...`,
      );
      await job.save();

      const filePath =
        await this.rpaDownloaderService.downloadEmailHistoryReport(
          tempDir,
          sessionDay,
        );
      job.logs.push(
        `[${new Date().toISOString()}] Đã tải file lịch sử gửi email thành công: ${path.basename(filePath)}`,
      );
      await job.save();

      job.logs.push(
        `[${new Date().toISOString()}] Đang phân tích file báo cáo...`,
      );
      await job.save();

      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const data: any[] = XLSX.utils.sheet_to_json(sheet);

      let checkDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      if (sessionDay && sessionDay.includes('-')) {
        const parts = sessionDay.split('-');
        if (parts.length === 3) {
          checkDateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      } else {
        const todayVN = new Date(Date.now() + 7 * 60 * 60 * 1000);
        const dd = String(todayVN.getUTCDate()).padStart(2, '0');
        const mm = String(todayVN.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = todayVN.getUTCFullYear().toString();
        checkDateStr = `${dd}-${mm}-${yyyy}`;
      }

      job.logs.push(
        `[${new Date().toISOString()}] Ngày cần kiểm tra: ${checkDateStr}`,
      );
      await job.save();

      const matchingRows = data.filter((r: any) => {
        const title = String(r['Tiêu đề'] || '').toLowerCase();
        const sendDate = String(r['Ngày gửi'] || '');
        const matchesTitle =
          title.includes('sao kê') || title.includes('sao ke');
        const matchesDate = sendDate.includes(checkDateStr);
        return matchesTitle && matchesDate;
      });

      job.logs.push(
        `[${new Date().toISOString()}] Tìm thấy ${matchingRows.length} email sao kê trong ngày ${checkDateStr}`,
      );
      await job.save();

      if (matchingRows.length === 0) {
        throw new Error(
          `Không tìm thấy bản ghi gửi email sao kê nào trong ngày ${checkDateStr}. Vui lòng kiểm tra đã gửi thủ công trên M-System chưa.`,
        );
      }

      const failedRows = matchingRows.filter((r: any) => {
        const status = String(r['Trạng thái'] || '').toLowerCase();
        return (
          status.includes('thất bại') ||
          status.includes('fail') ||
          status === 'false' ||
          !status
        );
      });

      if (failedRows.length > 0) {
        const failedDetails = failedRows
          .map((r: any) => `${r['Email/SĐT']} (${r['Tiêu đề']})`)
          .join(', ');
        job.logs.push(
          `[${new Date().toISOString()}] Phát hiện ${failedRows.length} email gửi thất bại: ${failedDetails}`,
        );

        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: failedRows.length,
          failedList: failedDetails.substring(0, 1000),
        };
        job.markModified('payload');
        await job.save();

        const alertMsg =
          `⚠️ <b>[CẢNH BÁO LỖI GỬI EMAIL SAO KÊ]</b>\n` +
          `Hệ thống phát hiện lỗi gửi email sao kê giao dịch ngày <b>${checkDateStr}</b>:\n\n` +
          `• Tổng số email: <b>${matchingRows.length}</b>\n` +
          `• Số lượng lỗi: <b>${failedRows.length}</b>\n\n` +
          `<b>Chi tiết lỗi:</b>\n` +
          failedRows
            .slice(0, 10)
            .map(
              (r: any) =>
                `• <code>${r['Email/SĐT']}</code> - <i>${r['Tiêu đề']}</i>`,
            )
            .join('\n') +
          (failedRows.length > 10
            ? `\n... và ${failedRows.length - 10} email khác.`
            : '') +
          `\n\n` +
          `Đề nghị bộ phận trực ca kiểm tra lại cấu hình hoặc liên hệ đối tác để gửi lại sao kê!`;

        await this.telegramService.sendMessage(alertMsg).catch((err) => {
          this.logger.error(`Lỗi gửi thông báo Telegram: ${err.message}`);
        });
      } else {
        job.logs.push(
          `[${new Date().toISOString()}] Toàn bộ ${matchingRows.length} email sao kê đã được gửi thành công.`,
        );
        job.payload = {
          ...payload,
          totalCount: matchingRows.length,
          failedCount: 0,
        };
        job.markModified('payload');
        await job.save();
      }
      return { totalCount: matchingRows.length, failedCount: failedRows.length };
    } catch (err: any) {
      job.logs.push(
        `[${new Date().toISOString()}] Lỗi khi chạy job: ${err.message}`,
      );
      await job.save();
      throw err;
    }
  }
}
