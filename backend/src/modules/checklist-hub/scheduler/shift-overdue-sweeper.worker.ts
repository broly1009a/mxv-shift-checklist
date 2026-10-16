import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ShiftLog } from '../../../schemas/shift-log.schema';
import { ActivityLog } from '../../../schemas/activity-log.schema';
import { SystemLogsService } from '../../system-logs/system-logs.service';
import { ShiftsGateway } from '../../shifts/shifts.gateway';

@Injectable()
export class ShiftOverdueSweeperWorker {
  private readonly logger = new Logger(ShiftOverdueSweeperWorker.name);
  private isRunning = false;

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(ActivityLog.name) private readonly activityLogModel: Model<ActivityLog>,
    private readonly systemLogsService: SystemLogsService,
    private readonly shiftsGateway: ShiftsGateway,
  ) {}

  /**
   * Quét và xử lý tự động các ca trực quá hạn (Overdue Shifts).
   * Chạy định kỳ để dọn sạch các ca ngày cũ bị bỏ quên mà không chốt ca.
   * TUYỆT ĐỐI KHÔNG DÙNG TELEGRAM THEO CHỈ ĐẠO CỦA USER.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sweepOverdueShifts(): Promise<{ processedCount: number }> {
    if (this.isRunning) return { processedCount: 0 };
    this.isRunning = true;

    try {
      const vnTime = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
      const todayStr = vnTime.toISOString().slice(0, 10);
      const currentHour = vnTime.getUTCHours();

      // Tìm tất cả ca trực có shiftDate < todayStr mà vẫn ở trạng thái PENDING
      const overdueShifts = await this.shiftLogModel
        .find({
          shiftDate: { $lt: todayStr },
          status: 'PENDING',
        })
        .populate('templateId', 'title')
        .populate('shiftSlotId')
        .exec();

      if (overdueShifts.length === 0) {
        return { processedCount: 0 };
      }

      this.logger.warn(
        `[OverdueSweeper] Phát hiện ${overdueShifts.length} ca trực quá hạn chưa chốt. Bắt đầu rà soát tự động khóa sổ...`,
      );

      let processedCount = 0;

      for (const shift of overdueShifts) {
        const slot = shift.shiftSlotId as any;
        // Nếu là ca đêm (isOvernight) thuộc ngày hôm qua và hiện tại chưa qua 08:00 sáng -> Cho phép nhân sự ca đêm tiếp tục trực
        if (slot?.isOvernight && currentHour < 8) {
          const yesterdayStr = new Date(vnTime.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (shift.shiftDate === yesterdayStr) {
            continue;
          }
        }

        const title = (shift.templateId as any)?.title || 'Ca vận hành';

        shift.status = 'COMPLETED';
        shift.isAutoClosed = true;
        shift.closedAt = new Date();
        shift.handoverNote = shift.handoverNote
          ? `${shift.handoverNote}\n[HỆ THỐNG TỰ ĐỘNG KHÓA SỔ]: Ca trực quá hạn do nhân sự không thực hiện chốt ca theo quy định.`
          : '[HỆ THỐNG TỰ ĐỘNG KHÓA SỔ]: Ca trực quá hạn do nhân sự không thực hiện chốt ca theo quy định.';

        await shift.save();
        processedCount++;

        // Ghi nhận SystemLog nội bộ
        await this.systemLogsService.logEvent({
          eventType: 'SHIFT_OVERDUE_AUTO_CLOSED',
          source: 'SYSTEM',
          actorUserId: null,
          jobId: shift._id,
          departmentId: shift.departmentId,
          shiftSlotId: shift.shiftSlotId,
          status: 'SUCCESS',
          message: `Hệ thống tự động khóa sổ ca trực quá hạn "${title}" ngày ${shift.shiftDate} (Tiến độ: ${shift.progressPercentage}%).`,
          metadata: {
            shiftId: shift._id.toString(),
            shiftDate: shift.shiftDate,
            templateTitle: title,
            progressPercentage: shift.progressPercentage,
          },
        });

        // Ghi nhận ActivityLog nội bộ
        const activity = new this.activityLogModel({
          userId: null,
          action: 'SYSTEM_OVERDUE_CLOSE',
          details: `Hệ thống tự động khóa sổ ca trực quá hạn "${title}" ngày ${shift.shiftDate} (Tiến độ: ${shift.progressPercentage}%).`,
          ipAddress: '127.0.0.1',
        });
        await activity.save();
      }

      // Phát WebSocket để đồng bộ realtime màn hình Dashboard & History mà KHÔNG GỬI TELEGRAM
      this.shiftsGateway.emitEvent('DASHBOARD_UPDATED', null, null, null, todayStr, {
        autoClosedCount: processedCount,
      });

      this.logger.log(
        `[OverdueSweeper] Đã tự động khóa sổ thành công ${processedCount} ca trực quá hạn.`,
      );

      return { processedCount };
    } catch (err: any) {
      this.logger.error(`[OverdueSweeper] Lỗi khi quét ca quá hạn: ${err.message}`, err.stack);
      return { processedCount: 0 };
    } finally {
      this.isRunning = false;
    }
  }
}
