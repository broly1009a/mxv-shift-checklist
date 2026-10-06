import { Model } from 'mongoose';
import { BotJob } from '../../../schemas/bot-job.schema';

export interface IDedupCheckResult {
  canEnqueue: boolean;
  activeJob?: BotJob | any;
  reason?: string;
}

/**
 * Helper kiểm tra và ngăn chặn các Job trùng lặp chạy đè nhau trong hàng đợi bot_jobs.
 * Tuân thủ Clean Architecture: Tái sử dụng dùng chung cho toàn bộ hệ thống Bot Engine.
 */
export class BotJobDedupHelper {
  /**
   * Thời gian tối đa một Job được coi là còn active (30 phút).
   * Nếu một Job PENDING/PROCESSING quá 30 phút, coi như stale/zombie (do server restart/crash)
   * và không chặn các tiến trình mới.
   */
  private static readonly MAX_JOB_ACTIVE_AGE_MS = 30 * 60 * 1000;

  /**
   * Kiểm tra xung đột trước khi đưa Job vào hàng đợi.
   *
   * @param botJobModel Model Mongoose của BotJob
   * @param jobType Loại Job cần kiểm tra
   * @param payload Tham số đầu vào của Job
   * @returns IDedupCheckResult
   */
  static async checkJobConflict(
    botJobModel: Model<BotJob> | any,
    jobType: string,
    payload: Record<string, any> = {},
  ): Promise<IDedupCheckResult> {
    if (!botJobModel || !jobType) {
      return { canEnqueue: true };
    }

    const sessionDay = payload.sessionDay || payload.targetDate || payload.date;
    const shiftLogId = payload.shiftLogId;

    // Ngưỡng 30 phút để loại bỏ zombie job bị kẹt trong quá khứ do sập nguồn/restart
    const freshThreshold = new Date(Date.now() - this.MAX_JOB_ACTIVE_AGE_MS);

    const query: any = {
      jobType,
      status: { $in: ['PENDING', 'PROCESSING'] },
      createdAt: { $gte: freshThreshold },
    };

    // Phân loại phạm vi kiểm tra (Scope):
    // 1. Nếu có ngày giao dịch/đối chiếu (sessionDay) -> Chỉ chặn các job cùng ngày
    if (sessionDay) {
      query['$or'] = [
        { 'payload.sessionDay': sessionDay },
        { 'payload.targetDate': sessionDay },
        { 'payload.date': sessionDay },
      ];
    } else if (shiftLogId) {
      // 2. Nếu có ca trực cụ thể -> Chỉ chặn các job trong cùng ca trực
      query['payload.shiftLogId'] = shiftLogId;
    }
    // 3. Nếu là job toàn cục (không có ngày, không có ca trực) -> Chặn toàn cục theo jobType

    const existingActiveJob = await botJobModel
      .findOne(query)
      .sort({ createdAt: -1 })
      .exec();

    if (existingActiveJob) {
      const statusText =
        existingActiveJob.status === 'PROCESSING'
          ? 'đang thực thi'
          : 'đang chờ trong hàng đợi';
      const timeStr = existingActiveJob.createdAt
        ? new Date(existingActiveJob.createdAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        : '';

      return {
        canEnqueue: false,
        activeJob: existingActiveJob,
        reason: `Tiến trình [${jobType}] ${statusText}${timeStr ? ` (khởi tạo lúc ${timeStr})` : ''}. Hệ thống tự động kết nối theo dõi tiến trình hiện tại.`,
      };
    }

    return { canEnqueue: true };
  }
}
