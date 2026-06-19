import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { WorkingCalendarService } from '../working-calendar/working-calendar.service';

@Injectable()
export class ShiftJobsService {
  private readonly logger = new Logger(ShiftJobsService.name);

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(ChecklistTemplate.name) private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(ActivityLog.name) private readonly activityLogModel: Model<ActivityLog>,
    private readonly workingCalendarService: WorkingCalendarService,
  ) {}

  async generateShiftsForDate(
    dateStr: string,
    triggerType: 'SYSTEM' | 'USER',
    userId?: string,
  ): Promise<any> {
    this.logger.log(`Starting shift job generation for date ${dateStr} (Trigger: ${triggerType})`);

    // 1. Validate if it's a trading day
    const calendarValidation = await this.workingCalendarService.validateDate(dateStr);
    if (!calendarValidation.isTradingDay) {
      this.logger.warn(`Date ${dateStr} is not a trading day. Skipping shift job generation.`);
      return {
        success: false,
        reason: 'NOT_A_TRADING_DAY',
        date: dateStr,
        isTradingDay: false,
        processedCount: 0,
        createdCount: 0,
        skippedCount: 0,
        details: [],
      };
    }

    // 2. Fetch active checklist templates
    const templates = await this.templateModel.find({ isActive: true }).populate('departmentId').exec();
    this.logger.log(`Found ${templates.length} active checklist templates to process.`);

    let createdCount = 0;
    let skippedCount = 0;
    const details = [];

    for (const template of templates) {
      // Check if a ShiftLog already exists for this template and date
      const existing = await this.shiftLogModel.findOne({
        templateId: template._id,
        shiftDate: dateStr,
      }).exec();

      if (existing) {
        skippedCount++;
        details.push({
          templateId: template._id.toString(),
          title: template.title,
          status: 'SKIPPED_EXISTING',
        });
        this.logger.log(`Shift log already exists for template "${template.title}" on ${dateStr}. Skipping.`);
        continue;
      }

      // Clone tasks
      const tasksSnapshot = template.tasks.map(task => ({
        taskId: task.taskId,
        taskNameSnapshot: task.taskName,
        prioritySnapshot: task.priority,
        deadlineSnapshot: task.deadline || null,
        isChecked: false,
        checkedAt: null,
        updatedBy: null,
        note: null,
        functionUrlSnapshot: task.functionUrl || '',
        urdReferenceSnapshot: task.urdReference || '',
        fileLocationSnapshot: task.fileLocation || '',
        timetableSnapshot: task.timetable || '',
        isBotCheckSnapshot: task.isBotCheck || false,
        botTriggerTimeSnapshot: task.botTriggerTime || '',
      }));

      // Create new ShiftLog
      const newLog = new this.shiftLogModel({
        templateId: template._id,
        userId: userId ? new Types.ObjectId(userId) : null,
        shiftSlotId: template.shiftSlotId ? new Types.ObjectId(template.shiftSlotId as any) : null,
        departmentId: template.departmentId ? new Types.ObjectId(template.departmentId as any) : null,
        shiftDate: dateStr,
        status: 'PENDING',
        progressPercentage: 0.0,
        details: tasksSnapshot,
        creationSource: triggerType === 'SYSTEM' ? 'SYSTEM_CRON' : 'MANUAL_ADMIN',
        createdByType: triggerType === 'SYSTEM' ? 'SYSTEM' : 'USER',
      });

      await newLog.save();
      createdCount++;
      details.push({
        templateId: template._id.toString(),
        title: template.title,
        status: 'CREATED',
      });

      // Create ActivityLog
      const activityAction = triggerType === 'SYSTEM' ? 'SYSTEM_JOB_GEN' : 'MANUAL_JOB_GEN';
      const activityDetails = triggerType === 'SYSTEM'
        ? `Hệ thống tự động khởi tạo ca trực cho mẫu: "${template.title}"`
        : `Admin khởi tạo ca trực thủ công cho mẫu: "${template.title}"`;

      const newActivity = new this.activityLogModel({
        userId: userId ? new Types.ObjectId(userId) : null,
        action: activityAction,
        details: activityDetails,
        ipAddress: '127.0.0.1',
      });
      await newActivity.save();
      this.logger.log(`Created shift log for template "${template.title}" on ${dateStr}`);
    }

    return {
      success: true,
      date: dateStr,
      isTradingDay: true,
      processedCount: templates.length,
      createdCount,
      skippedCount,
      details,
    };
  }
}
