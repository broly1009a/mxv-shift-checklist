import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
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
    this.logger.log(
      'Bắt đầu quy trình tự động dọn dẹp dữ liệu (Database, Cache & Files)...',
    );

    try {
      // 1. Dọn dẹp cache Telegram
      this.telegramService.clearSentWarningsCache();

      // 2. Dọn dẹp Database (Xóa dữ liệu nhật ký cũ hơn 30 ngày)
      const retentionDays = 30;
      const cutOffDate = new Date();
      cutOffDate.setDate(cutOffDate.getDate() - retentionDays);

      this.logger.log(
        `Xóa dữ liệu nhật ký hệ thống trước ngày: ${cutOffDate.toISOString()}`,
      );

      const [activityDel, notificationDel, systemDel] = await Promise.all([
        this.activityLogModel.deleteMany({ createdAt: { $lt: cutOffDate } }),
        this.notificationLogModel.deleteMany({
          createdAt: { $lt: cutOffDate },
        }),
        this.systemLogModel.deleteMany({ createdAt: { $lt: cutOffDate } }),
      ]);

      this.logger.log(
        `Dọn dẹp Database hoàn tất: ` +
          `Đã xóa ${activityDel.deletedCount} activity_logs, ` +
          `đã xóa ${notificationDel.deletedCount} notification_logs, ` +
          `đã xóa ${systemDel.deletedCount} system_logs.`,
      );

      // 3. Dọn dẹp File vật lý trên ổ đĩa
      this.logger.log('Bắt đầu quét dọn dẹp file tạm trên ổ đĩa...');
      
      // Mốc thời gian cho file tạm (7 ngày)
      const tempCutOffDate = new Date();
      tempCutOffDate.setDate(tempCutOffDate.getDate() - 7);

      // Mốc thời gian cho file báo cáo/uploads (30 ngày)
      const uploadCutOffDate = new Date();
      uploadCutOffDate.setDate(uploadCutOffDate.getDate() - 30);

      // Thư mục temp/ (reports, downloads, gtt, debug, reconciliation)
      const tempDir = path.join(process.cwd(), 'temp');
      const tempCleanResult = this.cleanDirectoryRecursive(tempDir, tempCutOffDate);

      // Thư mục uploads/agent-results/
      const agentResultsDir = path.join(process.cwd(), 'uploads', 'agent-results');
      const agentCleanResult = this.cleanDirectoryRecursive(agentResultsDir, uploadCutOffDate);

      // Thư mục uploads/trading-report/
      const tradingReportDir = path.join(process.cwd(), 'uploads', 'trading-report');
      const tradingReportCleanResult = this.cleanDirectoryRecursive(tradingReportDir, uploadCutOffDate);

      // Thư mục uploads/ccp-statistics/ (loại trừ file Thong_ke_kich_ban_Pilot_Bac_Final.xlsx)
      const ccpStatsDir = path.join(process.cwd(), 'uploads', 'ccp-statistics');
      const ccpCleanResult = this.cleanDirectoryRecursive(ccpStatsDir, uploadCutOffDate, [
        'Thong_ke_kich_ban_Pilot_Bac_Final.xlsx',
      ]);

      this.logger.log(
        `Dọn dẹp file hoàn tất:\n` +
          `- Thư mục temp (mốc 7 ngày): Đã xóa ${tempCleanResult.filesDeleted} file, ${tempCleanResult.dirsDeleted} thư mục rỗng.\n` +
          `- Thư mục uploads/agent-results (mốc 30 ngày): Đã xóa ${agentCleanResult.filesDeleted} file.\n` +
          `- Thư mục uploads/trading-report (mốc 30 ngày): Đã xóa ${tradingReportCleanResult.filesDeleted} file.\n` +
          `- Thư mục uploads/ccp-statistics (mốc 30 ngày): Đã xóa ${ccpCleanResult.filesDeleted} file.`
      );
    } catch (error) {
      this.logger.error('Lỗi khi thực hiện dọn dẹp dữ liệu định kỳ:', error);
    }
  }

  /**
   * Đệ quy dọn dẹp các file cũ trong thư mục và xóa thư mục con rỗng.
   * @param dirPath Đường dẫn thư mục cần quét
   * @param thresholdDate Mốc thời gian (các file có mtime trước mốc này sẽ bị xóa)
   * @param excludeFiles Danh sách tên file cần loại trừ không xóa
   * @returns Thống kê số lượng file và thư mục đã xóa
   */
  private cleanDirectoryRecursive(
    dirPath: string,
    thresholdDate: Date,
    excludeFiles: string[] = [],
  ): { filesDeleted: number; dirsDeleted: number } {
    let filesDeleted = 0;
    let dirsDeleted = 0;

    if (!fs.existsSync(dirPath)) {
      return { filesDeleted, dirsDeleted };
    }

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch (statErr: any) {
          this.logger.warn(`Không thể lấy thông tin (stat) của file/thư mục ${fullPath}: ${statErr.message}`);
          continue;
        }

        if (stat.isDirectory()) {
          // Đệ quy dọn dẹp thư mục con
          const subResult = this.cleanDirectoryRecursive(fullPath, thresholdDate, excludeFiles);
          filesDeleted += subResult.filesDeleted;
          dirsDeleted += subResult.dirsDeleted;

          // Xóa thư mục nếu sau khi dọn dẹp nó trở nên rỗng
          try {
            if (fs.readdirSync(fullPath).length === 0) {
              fs.rmdirSync(fullPath);
              dirsDeleted++;
              this.logger.log(`Đã xóa thư mục rỗng: ${fullPath}`);
            }
          } catch (rmdirErr: any) {
            this.logger.warn(`Không thể xóa thư mục rỗng ${fullPath}: ${rmdirErr.message}`);
          }
        } else {
          // Bỏ qua nếu thuộc danh sách loại trừ
          if (excludeFiles.includes(item)) {
            continue;
          }

          // Xóa file nếu thời gian sửa đổi cũ hơn threshold
          if (stat.mtime < thresholdDate) {
            try {
              fs.unlinkSync(fullPath);
              filesDeleted++;
              this.logger.log(`Đã xóa file tạm: ${fullPath} (Sửa đổi cuối: ${stat.mtime.toISOString()})`);
            } catch (unlinkErr: any) {
              this.logger.warn(`Không thể xóa file ${fullPath}: ${unlinkErr.message}`);
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi trong quá trình dọn dẹp thư mục ${dirPath}: ${err.message}`);
    }

    return { filesDeleted, dirsDeleted };
  }
}
