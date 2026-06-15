import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string | null = null;
  private chatId: string | null = null;
  private sentWarnings = new Set<string>();

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
  ) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
  }

  onModuleInit() {
    this.logger.log('Khởi chạy daemon giám sát deadline Telegram Bot...');
    // Quét mỗi 60 giây để kiểm thử thời gian thực nhanh nhạy
    setInterval(() => {
      this.scanDeadlines().catch(err => {
        this.logger.error('Lỗi khi quét hạn chót tác vụ:', err);
      });
    }, 60000);
  }

  async sendMessage(text: string, customChatId?: string): Promise<void> {
    const targetChatId = customChatId || this.chatId;
    
    // Check if token and target chat ID are configured
    const isConfigured = 
      this.botToken && 
      this.botToken !== 'YOUR_BOT_TOKEN' && 
      targetChatId && 
      targetChatId !== 'YOUR_CHAT_ID';

    if (isConfigured) {
      try {
        const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: targetChatId,
            text,
            parse_mode: 'HTML',
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          this.logger.error(`Gửi tin nhắn Telegram đến ${targetChatId} thất bại: ${errText}`);
        }
      } catch (err) {
        this.logger.error('Lỗi kết nối API Telegram:', err);
      }
    } else {
      // Simulation Mode inside terminal log
      console.log('\n========================================================================');
      console.log(`[TELEGRAM SIMULATION BOT ALERT - Chat ID: ${targetChatId || 'GROUP_CHAT'}]`);
      console.log(`Nội dung: ${text.replace(/<[^>]*>/g, '')}`); // Strip HTML tags for console printing
      console.log('========================================================================\n');
    }
  }

  async scanDeadlines(): Promise<void> {
    // Vietnam Time (GMT+7)
    const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
    const todayStr = nowVN.toISOString().split('T')[0];

    const currentHour = nowVN.getUTCHours();
    const currentMin = nowVN.getUTCMinutes();
    const currentTotalMins = currentHour * 60 + currentMin;

    // Find active pending shifts for today, populating settings
    const activeShifts = await this.shiftLogModel.find({
      status: 'PENDING',
      shiftDate: todayStr,
    })
    .populate('userId', 'fullName username settings')
    .populate({
      path: 'templateId',
      select: 'title'
    })
    .exec();

    for (const shift of activeShifts) {
      const userObj = shift.userId as any;
      const userSettings = userObj?.settings;
      // Lấy ngưỡng cảnh báo động từ cài đặt cá nhân, mặc định là 15 phút
      const threshold = (userSettings?.alertThresholdMinutes !== undefined && userSettings?.alertThresholdMinutes !== null)
        ? Number(userSettings.alertThresholdMinutes)
        : 15;

      for (const item of shift.details) {
        if (!item.isChecked && item.deadlineSnapshot) {
          const [deadHour, deadMin] = item.deadlineSnapshot.split(':').map(Number);
          if (isNaN(deadHour) || isNaN(deadMin)) continue;

          const deadTotalMins = deadHour * 60 + deadMin;
          const minsDiff = deadTotalMins - currentTotalMins;

          // Cảnh báo nếu sắp đến deadline hoặc đã trễ hạn
          if (minsDiff <= threshold) {
            const warningType = minsDiff < 0 ? 'OVERDUE' : 'COMING_SOON';
            const cacheKey = `${shift._id}-${item.taskId}-${warningType}`;

            if (!this.sentWarnings.has(cacheKey)) {
              this.sentWarnings.add(cacheKey);

              const titleText = warningType === 'OVERDUE' 
                ? `🚨 <b>[CẢNH BÁO QUÁ HẠN CHÓT]</b>` 
                : `⚠️ <b>[CẢNH BÁO SẮP ĐẾN HẠN CHÓT]</b>`;

              const timeText = warningType === 'OVERDUE'
                ? `Đã trễ <b>${Math.abs(minsDiff)} phút</b> so với hạn chót (${item.deadlineSnapshot})`
                : `Chỉ còn <b>${minsDiff} phút</b> nữa đến hạn chót (${item.deadlineSnapshot})`;

              const message = `${titleText}\n` +
                `• Tác vụ: <b>${item.taskId} - ${item.taskNameSnapshot}</b>\n` +
                `• Mức độ ưu tiên: <b>${item.prioritySnapshot}</b>\n` +
                `• Thời hạn: ${timeText}\n` +
                `• Nhân sự trực chính: <b>${userObj?.fullName || 'Chưa rõ'}</b>\n` +
                `• Ca trực: <i>${(shift.templateId as any)?.title || 'Ca vận hành'}</i>\n\n` +
                `Đề nghị đồng chí trực ban khẩn trương kiểm tra và xử lý gấp!`;

              // 1. Gửi vào group vận hành chung
              await this.sendMessage(message);

              // 2. Gửi riêng cho nhân sự trực nếu cấu hình bật nhận tin nhắn và cung cấp chat ID
              if (userSettings?.telegramNotifications && userSettings?.telegramChatId) {
                await this.sendMessage(message, userSettings.telegramChatId);
              }
            }
          }
        }
      }
    }
  }
}
