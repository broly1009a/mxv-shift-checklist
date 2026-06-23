import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SystemLog } from '../../schemas/system-log.schema';

@Injectable()
export class SystemLogsService {
  private readonly logger = new Logger(SystemLogsService.name);

  constructor(
    @InjectModel(SystemLog.name)
    private readonly systemLogModel: Model<SystemLog>,
  ) {}

  async logEvent(logData: {
    eventType: string;
    source: 'SYSTEM' | 'CRON' | 'USER' | 'NOTIFICATION' | 'BOT_PLACEHOLDER';
    actorUserId?: string | Types.ObjectId | null;
    jobId?: string | Types.ObjectId | null;
    departmentId?: string | Types.ObjectId | null;
    shiftSlotId?: string | Types.ObjectId | null;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
    message: string;
    metadata?: Record<string, any>;
  }): Promise<SystemLog> {
    try {
      const newLog = new this.systemLogModel({
        eventType: logData.eventType,
        source: logData.source,
        actorUserId: logData.actorUserId ? new Types.ObjectId(logData.actorUserId.toString()) : null,
        jobId: logData.jobId ? new Types.ObjectId(logData.jobId.toString()) : null,
        departmentId: logData.departmentId ? new Types.ObjectId(logData.departmentId.toString()) : null,
        shiftSlotId: logData.shiftSlotId ? new Types.ObjectId(logData.shiftSlotId.toString()) : null,
        status: logData.status,
        message: logData.message,
        metadata: logData.metadata || {},
      });

      const saved = await newLog.save();
      this.logger.log(`[SystemLog] [${logData.source}] [${logData.status}] ${logData.eventType}: ${logData.message}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to write SystemLog: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getLogs(limit = 100): Promise<SystemLog[]> {
    return this.systemLogModel
      .find()
      .populate('actorUserId', 'fullName username')
      .populate('departmentId', 'name code')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
