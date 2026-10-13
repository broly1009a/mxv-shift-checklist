import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../../schemas/shift-log.schema';

@Injectable()
export class ShiftLifecycleService {
  private readonly logger = new Logger(ShiftLifecycleService.name);

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
  ) {}

  /**
   * Kiểm tra điều kiện tiên quyết trước khi thực thi một tác vụ (Dependency & Parent-Child Task Resolver)
   * TUYỆT ĐỐI KHÔNG HARDCODE TASK ID: Quan hệ cha-con được giải quyết động 100% qua parentTaskIdSnapshot
   */
  async canExecuteTask(
    shiftLogId: string,
    taskId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const shift = await this.shiftLogModel.findById(shiftLogId).lean().exec();
    if (!shift) {
      throw new NotFoundException(`Không tìm thấy ca trực với ID: ${shiftLogId}`);
    }

    if (shift.status === 'COMPLETED') {
      return { allowed: false, reason: 'Ca trực đã kết thúc (COMPLETED).' };
    }

    const task = (shift.details || []).find((d: any) => d.taskId === taskId);
    if (!task) {
      return { allowed: false, reason: `Không tìm thấy tác vụ [${taskId}] trong ca trực.` };
    }

    // Nếu tác vụ có phụ thuộc tác vụ cha
    if (task.parentTaskIdSnapshot) {
      const parentTask = (shift.details || []).find(
        (d: any) => d.taskId === task.parentTaskIdSnapshot,
      );
      if (parentTask && !parentTask.isChecked) {
        return {
          allowed: false,
          reason: `Tác vụ cha [${parentTask.taskNameSnapshot || parentTask.taskId}] chưa hoàn thành.`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Đóng ca trực (Hoàn thành ca)
   */
  async completeShift(shiftLogId: string, userId: string, notes?: string): Promise<boolean> {
    const shift = await this.shiftLogModel.findById(shiftLogId).exec();
    if (!shift) throw new NotFoundException('Không tìm thấy ca trực.');

    if (shift.status === 'COMPLETED') {
      throw new BadRequestException('Ca trực đã được đóng trước đó.');
    }

    shift.status = 'COMPLETED';
    shift.closedBy = new Types.ObjectId(userId) as any;
    shift.closedAt = new Date();
    if (notes) {
      shift.handoverNote = `${shift.handoverNote ? shift.handoverNote + '\n' : ''}[Đóng ca]: ${notes}`;
    }

    await shift.save();
    this.logger.log(`[ShiftLifecycle] Ca trực ${shiftLogId} đã đóng thành công bởi User [${userId}].`);
    return true;
  }
}
