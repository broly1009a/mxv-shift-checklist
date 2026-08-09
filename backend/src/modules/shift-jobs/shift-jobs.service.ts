import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { WorkingCalendarService } from '../working-calendar/working-calendar.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { ShiftsGateway } from '../shifts/shifts.gateway';

@Injectable()
export class ShiftJobsService {
  private readonly logger = new Logger(ShiftJobsService.name);

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
    private readonly workingCalendarService: WorkingCalendarService,
    private readonly systemLogsService: SystemLogsService,
    private readonly shiftsGateway: ShiftsGateway,
  ) {}

  async generateShiftsForDate(
    dateStr: string,
    triggerType: 'SYSTEM' | 'USER',
    userId?: string,
  ): Promise<any> {
    this.logger.log(
      `Starting shift job generation for date ${dateStr} (Trigger: ${triggerType})`,
    );

    // 1. Fetch active checklist templates
    const templates = await this.templateModel
      .find({ isActive: true })
      .populate('departmentId')
      .populate('shiftSlotId')
      .exec();
    this.logger.log(
      `Found ${templates.length} active checklist templates to process.`,
    );

    let createdCount = 0;
    let skippedCount = 0;
    const details = [];

    for (const template of templates) {
      const dept = template.departmentId as any;
      if (dept) {
        const isClosed = await this.workingCalendarService.isDepartmentClosedOnDate(
          dept.monitoredExchanges || [],
          dateStr,
        );
        if (isClosed) {
          skippedCount++;
          details.push({
            templateId: template._id.toString(),
            title: template.title,
            status: 'SKIPPED_HOLIDAY',
          });
          this.logger.log(
            `Department "${dept.name}" is closed on ${dateStr} due to holiday/weekend. Skipping.`,
          );

          await this.systemLogsService.logEvent({
            eventType: 'JOB_GENERATION_SKIPPED',
            source: triggerType,
            actorUserId: userId || null,
            departmentId: dept._id,
            shiftSlotId: template.shiftSlotId,
            status: 'SKIPPED',
            message: `Bỏ qua sinh ca trực "${template.title}" ngày ${dateStr} do phòng ban nghỉ lễ/cuối tuần.`,
            metadata: { templateTitle: template.title, date: dateStr },
          });

          continue;
        }
      }
      // Check if a ShiftLog already exists for this template and date

      const existing = await this.shiftLogModel
        .findOne({
          templateId: template._id,
          shiftDate: dateStr,
        })
        .exec();

      if (existing) {
        skippedCount++;
        details.push({
          templateId: template._id.toString(),
          title: template.title,
          status: 'SKIPPED_EXISTING',
        });
        this.logger.log(
          `Shift log already exists for template "${template.title}" on ${dateStr}. Skipping.`,
        );

        await this.systemLogsService.logEvent({
          eventType: 'JOB_GENERATION_SKIPPED',
          source: triggerType,
          actorUserId: userId || null,
          departmentId: template.departmentId,
          shiftSlotId: template.shiftSlotId,
          status: 'SKIPPED',
          message: `Ca trực "${template.title}" đã tồn tại cho ngày ${dateStr}. Bỏ qua.`,
          metadata: { templateTitle: template.title, date: dateStr },
        });

        continue;
      }

      // Calculate time offset if shiftSlot is configured with seasonal hours
      let offsetMinutes = 0;
      const slot = template.shiftSlotId as any;
      if (slot && slot.seasonalHours && slot.seasonalHours.length > 0) {
        const isSummer = this.workingCalendarService.isDaylightSavingTime(dateStr, 'America/Chicago');
        const seasonName = isSummer ? 'SUMMER' : 'WINTER';
        const matched = slot.seasonalHours.find((h: any) => h.name === seasonName);
        if (matched) {
          const getMinutes = (t: string) => {
            const parts = t.split(':');
            return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
          };
          offsetMinutes = getMinutes(matched.startTime) - getMinutes(slot.startTime);
        }
      }

      // Clone tasks
      const tasksSnapshot = template.tasks.map((task) => ({
        taskId: task.taskId,
        taskNameSnapshot: task.taskName,
        prioritySnapshot: task.priority,
        deadlineSnapshot: offsetMinutes !== 0 ? this.shiftTimeStr(task.deadline, offsetMinutes) : (task.deadline || null),
        isChecked: false,
        checkedAt: null,
        updatedBy: null,
        note: null,
        functionUrlSnapshot: task.functionUrl || '',
        urdReferenceSnapshot: task.urdReference || '',
        fileLocationSnapshot: task.fileLocation || '',
        timetableSnapshot: task.timetable || '',
        isBotCheckSnapshot: task.isBotCheck || false,
        botTriggerTimeSnapshot: offsetMinutes !== 0 ? (this.shiftTimeStr(task.botTriggerTime, offsetMinutes) || '') : (task.botTriggerTime || ''),
        botCheckTypeSnapshot: task.botCheckType || '',
        botCheckTargetSnapshot: task.botCheckTarget || '',
        botSuccessConditionSnapshot: task.botSuccessCondition || '',
        botFailureActionSnapshot: task.botFailureAction || '',
        status: 'PENDING',
        dependsOnTaskIdsSnapshot: task.dependsOnTaskIds || [],
        sessionTypeSnapshot: task.sessionType || null,
        triggerTimeSnapshot: offsetMinutes !== 0 ? this.shiftTimeStr(task.triggerTime, offsetMinutes) : (task.triggerTime || null),
        slaDeadlineSnapshot: offsetMinutes !== 0 ? this.shiftTimeStr(task.slaDeadline, offsetMinutes) : (task.slaDeadline || null),
        slaWindowStartSnapshot: offsetMinutes !== 0 ? this.shiftTimeStr(task.slaWindowStart, offsetMinutes) : (task.slaWindowStart || null),
        slaWindowEndSnapshot: offsetMinutes !== 0 ? this.shiftTimeStr(task.slaWindowEnd, offsetMinutes) : (task.slaWindowEnd || null),
        actionDescriptionSnapshot: task.actionDescription || '',
        exceptionCodeSnapshot: task.exceptionCode || '',
        frequencyMinutesSnapshot: task.frequencyMinutes || null,
        recurrenceGroupIdSnapshot: task.recurrenceGroupId || '',
        parentTaskIdSnapshot: (task as any).parentTaskId || null,
        slaTypeSnapshot: (task as any).slaType || 'FIXED_TIME',
      }));

      // Create new ShiftLog
      const newLog = new this.shiftLogModel({
        templateId: template._id,
        userId: userId ? new Types.ObjectId(userId) : null,
        shiftSlotId: template.shiftSlotId
          ? new Types.ObjectId((template.shiftSlotId as any)._id || template.shiftSlotId)
          : null,
        departmentId: template.departmentId
          ? new Types.ObjectId(template.departmentId as any)
          : null,
        shiftDate: dateStr,
        status: 'PENDING',
        progressPercentage: 0.0,
        details: tasksSnapshot,
        creationSource:
          triggerType === 'SYSTEM' ? 'SYSTEM_CRON' : 'MANUAL_ADMIN',
        createdByType: triggerType === 'SYSTEM' ? 'SYSTEM' : 'USER',
      });

      const savedLog = await newLog.save();
      createdCount++;
      details.push({
        templateId: template._id.toString(),
        title: template.title,
        status: 'CREATED',
      });

      // Log system event
      await this.systemLogsService.logEvent({
        eventType: 'JOB_GENERATED',
        source: triggerType,
        actorUserId: userId || null,
        jobId: savedLog._id,
        departmentId: template.departmentId,
        shiftSlotId: template.shiftSlotId,
        status: 'SUCCESS',
        message: `Khởi tạo thành công ca trực "${template.title}" ngày ${dateStr}.`,
        metadata: { templateTitle: template.title, date: dateStr },
      });

      // Create ActivityLog
      const activityAction =
        triggerType === 'SYSTEM' ? 'SYSTEM_JOB_GEN' : 'MANUAL_JOB_GEN';
      const activityDetails =
        triggerType === 'SYSTEM'
          ? `Hệ thống tự động khởi tạo ca trực cho mẫu: "${template.title}"`
          : `Admin khởi tạo ca trực thủ công cho mẫu: "${template.title}"`;

      const newActivity = new this.activityLogModel({
        userId: userId ? new Types.ObjectId(userId) : null,
        action: activityAction,
        details: activityDetails,
        ipAddress: '127.0.0.1',
      });
      await newActivity.save();
      this.logger.log(
        `Created shift log for template "${template.title}" on ${dateStr}`,
      );
    }

    // Emit WS events
    this.shiftsGateway.emitEvent(
      'SHIFT_JOB_GENERATED',
      null,
      null,
      null,
      dateStr,
      { createdCount, skippedCount },
    );
    this.shiftsGateway.emitEvent(
      'DASHBOARD_UPDATED',
      null,
      null,
      null,
      dateStr,
      {},
    );

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

  private shiftTimeStr(timeStr: string | null | undefined, offsetMinutes: number): string | null {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    let totalMinutes = h * 60 + m + offsetMinutes;
    totalMinutes = (totalMinutes + 1440) % 1440;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(newH)}:${pad(newM)}`;
  }
}

