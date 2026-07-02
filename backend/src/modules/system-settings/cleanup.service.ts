import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { NotificationLog } from '../../schemas/notification-log.schema';
import { SystemLog } from '../../schemas/system-log.schema';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
    @InjectModel(NotificationLog.name)
    private readonly notificationLogModel: Model<NotificationLog>,
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLog>,
    private readonly telegramService: TelegramService,
  ) {}

  // Chạy tự động vào lúc 00:00 hàng ngày
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRetentionCleanup() {
    this.logger.log('Bắt đầu quy trình tự động dọn dẹp dữ liệu (Database & Cache)...');

    try {
      // 1. Dọn dẹp cache Telegram
      this.telegramService.clearSentWarningsCache();

      // 2. Dọn dẹp Database (Xóa dữ liệu nhật ký cũ hơn 30 ngày)
      const retentionDays = 30;
      const cutOffDate = new Date();
      cutOffDate.setDate(cutOffDate.getDate() - retentionDays);

      this.logger.log(`Xóa dữ liệu nhật ký hệ thống trước ngày: ${cutOffDate.toISOString()}`);

      const [activityDel, notificationDel, systemDel] = await Promise.all([
        this.activityLogModel.deleteMany({ createdAt: { $lt: cutOffDate } }),
        this.notificationLogModel.deleteMany({ createdAt: { $lt: cutOffDate } }),
        this.systemLogModel.deleteMany({ createdAt: { $lt: cutOffDate } }),
      ]);

      this.logger.log(
        `Dọn dẹp Database hoàn tất: ` +
          `Đã xóa ${activityDel.deletedCount} activity_logs, ` +
          `đã xóa ${notificationDel.deletedCount} notification_logs, ` +
          `đã xóa ${systemDel.deletedCount} system_logs.`,
      );
    } catch (error) {
      this.logger.error('Lỗi khi thực hiện dọn dẹp dữ liệu định kỳ:', error);
    }
  }
}
