import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { AuditLog } from '../../schemas/audit-log.schema';
import { ShiftsGateway } from './shifts.gateway';
import { TelegramService } from '../telegram/telegram.service';
import { SystemLogsService } from '../system-logs/system-logs.service';
import { IncidentsService } from '../incidents/incidents.service';
import { AccessControlService } from '../auth/access-control.service';
import { MarginCheckerService } from '../margin-checker/margin-checker.service';
import { WorkingCalendarService } from '../working-calendar/working-calendar.service';

@Injectable()
export class ShiftsService {
  private readonly logger = new Logger(ShiftsService.name);
  private initializingKeys = new Set<string>();

  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    private readonly shiftsGateway: ShiftsGateway,
    private readonly telegramService: TelegramService,
    private readonly systemLogsService: SystemLogsService,
    @Inject(forwardRef(() => IncidentsService))
    private readonly incidentsService: IncidentsService,
    private readonly accessControlService: AccessControlService,
    private readonly marginCheckerService: MarginCheckerService,
    private readonly workingCalendarService: WorkingCalendarService,
  ) {}


  private validateScope(
    user: any,
    departmentId: string | Types.ObjectId,
  ) {
    this.accessControlService.validateScope(
      user,
      departmentId ? departmentId.toString() : null,
    );
  }

  async initializeShift(
    templateId: string,
    user: any,
    shiftDateInput?: string,
  ): Promise<ShiftLog> {
    const canInitialize = await this.accessControlService.canAccessFeature(user, 'INITIALIZE_SHIFT');
    if (!canInitialize) {
      throw new ForbiddenException(
        'Chức vụ của bạn không có quyền khởi tạo ca trực',
      );
    }

    const template = await this.templateModel
      .findById(templateId)
      .populate('departmentId')
      .exec();
    if (!template) {
      throw new NotFoundException('Mẫu checklist không tồn tại');
    }

    const dept = template.departmentId as any;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    // Default shift date is current date in Vietnam time (GMT+7)
    let shiftDate = shiftDateInput;
    if (!shiftDate) {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      shiftDate = vietnamTime.toISOString().split('T')[0];
    }

    // Concurrency Lock: Check if another request is initializing this template on this date
    const lockKey = `${templateId}_${shiftDate}`;
    if (this.initializingKeys.has(lockKey)) {
      // Wait for a short duration to let the concurrent creation finish
      await new Promise((resolve) => setTimeout(resolve, 800));
      // Re-query database to see if the pending log exists now
      const existing = await this.shiftLogModel
        .findOne({
          templateId: new Types.ObjectId(templateId),
          shiftDate,
          status: 'PENDING',
        })
        .populate('userId', 'fullName username')
        .populate({
          path: 'templateId',
          populate: { path: 'departmentId' },
        })
        .exec();
      if (existing) {
        return existing;
      }
    }

    this.initializingKeys.add(lockKey);

    try {
      // Check if an active (PENDING) shift log already exists for this template and date
      const existingLog = await this.shiftLogModel
        .findOne({
          templateId: new Types.ObjectId(templateId),
          shiftDate,
          status: 'PENDING',
        })
        .populate('userId', 'fullName username')
        .populate({
          path: 'templateId',
          populate: { path: 'departmentId' },
        })
        .exec();

      if (existingLog) {
        await this.systemLogsService.logEvent({
          eventType: 'JOB_GENERATION_SKIPPED',
          source: 'USER',
          actorUserId: user.id || user._id,
          departmentId: existingLog.departmentId,
          shiftSlotId: existingLog.shiftSlotId,
          jobId: existingLog._id,
          status: 'SKIPPED',
          message: `Bỏ qua khởi tạo ca trực cho mẫu "${(existingLog.templateId as any)?.title}" do đã tồn tại.`,
          metadata: {
            templateTitle: (existingLog.templateId as any)?.title,
            date: shiftDate,
          },
        });
        return existingLog;
      }

      const details = template.tasks.map((task) => ({
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
        botCheckTypeSnapshot: task.botCheckType || '',
        botCheckTargetSnapshot: task.botCheckTarget || '',
        botSuccessConditionSnapshot: task.botSuccessCondition || '',
        botFailureActionSnapshot: task.botFailureAction || '',
        status: 'PENDING',
        dependsOnTaskIdsSnapshot: task.dependsOnTaskIds || [],
        sessionTypeSnapshot: task.sessionType || null,
        triggerTimeSnapshot: task.triggerTime || null,
        slaDeadlineSnapshot: task.slaDeadline || null,
        slaWindowStartSnapshot: task.slaWindowStart || null,
        slaWindowEndSnapshot: task.slaWindowEnd || null,
        actionDescriptionSnapshot: task.actionDescription || '',
        exceptionCodeSnapshot: task.exceptionCode || '',
        frequencyMinutesSnapshot: task.frequencyMinutes || null,
        recurrenceGroupIdSnapshot: task.recurrenceGroupId || '',
        parentTaskIdSnapshot: (task as any).parentTaskId || null,
        slaTypeSnapshot: (task as any).slaType || 'FIXED_TIME',
      }));

      const newLog = new this.shiftLogModel({
        templateId: new Types.ObjectId(templateId),
        userId: new Types.ObjectId(user.id || user._id),
        shiftSlotId: template.shiftSlotId
          ? new Types.ObjectId(template.shiftSlotId as any)
          : null,
        departmentId: template.departmentId
          ? new Types.ObjectId(template.departmentId as any)
          : null,
        shiftDate,
        status: 'PENDING',
        progressPercentage: 0.0,
        details,
        creationSource: 'MANUAL_USER',
        createdByType: 'USER',
      });

      const saved = await newLog.save();
      const result = await this.shiftLogModel
        .findById(saved._id)
        .populate('userId', 'fullName username')
        .populate({
          path: 'templateId',
          populate: { path: 'departmentId' },
        })
        .populate('shiftSlotId')
        .populate('departmentId')
        .exec();
      if (!result) {
        throw new NotFoundException('Lỗi khởi tạo ca trực');
      }

      // Gửi thông báo Telegram khi khởi tạo ca trực
      const deptName =
        (result.templateId as any)?.departmentId?.name || 'Vận hành';
      await this.telegramService.sendMessage(
        `🔔 <b>[MXV KHỞI TẠO CA TRỰC]</b>\n` +
          `• Ca trực: <b>${(result.templateId as any)?.title}</b>\n` +
          `• Ngày trực: <b>${result.shiftDate}</b>\n` +
          `• Phòng ban: <b>${deptName}</b>\n` +
          `• Người trực chính: <b>${(result.userId as any)?.fullName}</b>`,
      );

      // Ghi nhận log hệ thống
      await this.systemLogsService.logEvent({
        eventType: 'JOB_GENERATION',
        source: 'USER',
        actorUserId: user.id || user._id,
        jobId: result._id,
        departmentId: result.departmentId,
        shiftSlotId: result.shiftSlotId,
        status: 'SUCCESS',
        message: `Khởi tạo thành công ca trực "${(result.templateId as any)?.title}" bởi ${user.fullName || 'Nhân sự'}.`,
        metadata: {
          templateTitle: (result.templateId as any)?.title,
          date: result.shiftDate,
        },
      });

      // Phát sự kiện qua WebSocket
      this.shiftsGateway.emitEvent(
        'SHIFT_JOB_GENERATED',
        result._id.toString(),
        result.departmentId ? result.departmentId.toString() : null,
        result.shiftSlotId ? result.shiftSlotId.toString() : null,
        result.shiftDate,
        { title: (result.templateId as any)?.title },
      );
      this.shiftsGateway.emitEvent(
        'DASHBOARD_UPDATED',
        null,
        null,
        null,
        result.shiftDate,
        {},
      );

      this.adjustShiftSlotTimesForSeason(result);
      return result;
    } finally {
      this.initializingKeys.delete(lockKey);
    }
  }


  async addAdhocTask(
    shiftLogId: string,
    user: any,
    taskData: { taskName: string; priority: string; deadline?: string },
  ): Promise<ShiftLog> {
    const log = await this.shiftLogModel
      .findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    if (log.status === 'COMPLETED') {
      throw new BadRequestException(
        'Ca trực đã đóng, không thể thêm tác vụ mới',
      );
    }

    const dept = log.departmentId || (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    const timestamp = Date.now();
    const taskId = `adhoc_${timestamp}`;

    const newDetail = {
      taskId,
      taskNameSnapshot: taskData.taskName,
      prioritySnapshot: taskData.priority || 'MEDIUM',
      deadlineSnapshot: taskData.deadline || null,
      isChecked: false,
      status: 'PENDING',
      checkedAt: null,
      updatedBy: null,
      note: null,
    };

    log.details.push(newDetail);

    // Recalculate progress
    const total = log.details.length;
    const completed = log.details.filter((d) => d.isChecked).length;
    log.progressPercentage =
      total > 0 ? parseFloat(((completed / total) * 100).toFixed(2)) : 0.0;

    const saved = await log.save();

    // Create Audit Log record
    const audit = new this.auditLogModel({
      shiftLogId: new Types.ObjectId(shiftLogId),
      taskId,
      taskName: taskData.taskName,
      userId: new Types.ObjectId(user.id || user._id),
      action: 'ADD_TASK',
      details: `Thêm tác vụ phát sinh: "${taskData.taskName}" (Độ ưu tiên: ${taskData.priority})`,
    });
    const savedAudit = await audit.save();
    const auditLogRecord = await this.auditLogModel
      .findById(savedAudit._id)
      .populate('userId', 'fullName username')
      .exec();

    const result = await this.shiftLogModel
      .findById(saved._id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();

    if (!result) {
      throw new NotFoundException('Không tìm thấy ca trực sau khi cập nhật');
    }

    // Notify Gateway
    this.shiftsGateway.notifyShiftUpdate(shiftLogId, result, auditLogRecord);

    // Write system log
    await this.systemLogsService.logEvent({
      eventType: 'TASK_UPDATED',
      source: 'USER',
      actorUserId: user.id || user._id,
      jobId: result._id,
      departmentId: result.departmentId,
      shiftSlotId: result.shiftSlotId,
      status: 'SUCCESS',
      message: `Thêm tác vụ phát sinh: "${taskData.taskName}" (Độ ưu tiên: ${taskData.priority})`,
      metadata: { taskId, taskName: taskData.taskName },
    });

    // Emit WebSocket Events
    this.shiftsGateway.emitEvent(
      'TASK_UPDATED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      {
        taskId,
        taskName: taskData.taskName,
        isChecked: false,
        status: 'PENDING',
        progressPercentage: result.progressPercentage,
      },
    );
    this.shiftsGateway.emitEvent(
      'DASHBOARD_UPDATED',
      null,
      null,
      null,
      result.shiftDate,
      {},
    );

    return result;
  }

  async updateTaskStatus(
    shiftLogId: string,
    taskId: string,
    status: string,
    user: any,
    note?: string,
    isInternal = false,
  ): Promise<ShiftLog> {
    const validStatuses = [
      'PENDING',
      'WAITING',
      'PASSED',
      'FAILED',
      'SKIPPED',
      'NEEDS_ATTENTION',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException('Trạng thái tác vụ không hợp lệ');
    }

    const log = await this.shiftLogModel
      .findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    if (log.status === 'COMPLETED') {
      throw new BadRequestException(
        'Ca trực đã được chốt, không thể thay đổi dữ liệu',
      );
    }

    const dept = log.departmentId || (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    const task = log.details.find((d) => d.taskId === taskId);
    if (!task) {
      throw new NotFoundException(
        'Không tìm thấy tác vụ tương ứng trong ca trực',
      );
    }

    const isParentTask = log.details.some(
      (d) => d.parentTaskIdSnapshot === taskId,
    );
    if (isParentTask && !isInternal) {
      if (status !== 'SKIPPED' && status !== 'PENDING') {
        throw new BadRequestException(
          `Tác vụ "${task.taskNameSnapshot}" là tác vụ tổng hợp. Nó sẽ tự động hoàn thành khi tất cả các tác vụ con của nó hoàn thành.`,
        );
      }
      // Cascade update children tasks in the database first to prevent WebSocket out-of-sync lag
      const childrenIsChecked = status === 'SKIPPED';
      const nowTime = new Date();
      const setFields: any = {
        'details.$[elem].status': status,
        'details.$[elem].isChecked': childrenIsChecked,
        'details.$[elem].updatedBy': new Types.ObjectId(user.id || user._id) as any,
      };

      if (status === 'PENDING') {
        setFields['details.$[elem].startedAt'] = null;
        setFields['details.$[elem].completedAt'] = null;
        setFields['details.$[elem].failedAt'] = null;
        setFields['details.$[elem].skippedAt'] = null;
        setFields['details.$[elem].needsAttentionAt'] = null;
        setFields['details.$[elem].checkedAt'] = null;
      } else if (status === 'SKIPPED') {
        setFields['details.$[elem].skippedAt'] = nowTime;
        setFields['details.$[elem].completedAt'] = null;
        setFields['details.$[elem].failedAt'] = null;
        setFields['details.$[elem].needsAttentionAt'] = null;
        setFields['details.$[elem].checkedAt'] = nowTime;
      }

      await this.shiftLogModel.updateOne(
        { _id: shiftLogId },
        { $set: setFields },
        { arrayFilters: [{ 'elem.parentTaskIdSnapshot': taskId }] },
      );
    }

    const oldIsChecked = task.isChecked;
    const oldStatus = task.status || 'PENDING';
    const oldNote = task.note;

    // Check task dependencies if status is not PENDING or WAITING
    if (
      status !== 'PENDING' &&
      status !== 'WAITING' &&
      task.dependsOnTaskIdsSnapshot &&
      task.dependsOnTaskIdsSnapshot.length > 0
    ) {
      for (const depId of task.dependsOnTaskIdsSnapshot) {
        const depTask = log.details.find((d) => d.taskId === depId);
        if (depTask && !depTask.isChecked) {
          throw new BadRequestException(
            `Tác vụ này phụ thuộc vào tác vụ [${depId}] "${depTask.taskNameSnapshot}" chưa hoàn thành.`,
          );
        }
      }
    }

    // Ensure no other checked task depends on this task if we are unchecking it
    if (status === 'PENDING') {
      const dependents = log.details.filter(
        (d) =>
          d.isChecked &&
          d.dependsOnTaskIdsSnapshot &&
          d.dependsOnTaskIdsSnapshot.includes(taskId) &&
          !log.details.some((child) => child.parentTaskIdSnapshot === d.taskId),
      );
      if (dependents.length > 0) {
        const listStr = dependents
          .map((d) => `[${d.taskId}] "${d.taskNameSnapshot}"`)
          .join(', ');
        throw new BadRequestException(
          `Không thể hủy hoàn thành tác vụ này do có tác vụ khác đang hoàn thành phụ thuộc vào nó: ${listStr}`,
        );
      }
    }

    const now = new Date();
    const isChecked = status === 'PASSED' || status === 'SKIPPED';

    const updateQuery: any = {
      $set: {
        'details.$.status': status,
        'details.$.isChecked': isChecked,
        'details.$.checkedAt': isChecked ? now : null,
        'details.$.updatedBy': new Types.ObjectId(user.id || user._id) as any,
      },
    };

    if (note !== undefined) {
      updateQuery.$set['details.$.note'] = note || null;
      updateQuery.$set['details.$.resultNote'] = note || null;
    }

    // Set startedAt if transitioning from PENDING
    if (oldStatus === 'PENDING' && status !== 'PENDING' && !task.startedAt) {
      updateQuery.$set['details.$.startedAt'] = now;
    }

    // Set other lifecycle timestamps and clear non-matching ones
    if (status === 'PENDING') {
      updateQuery.$set['details.$.startedAt'] = null;
      updateQuery.$set['details.$.completedAt'] = null;
      updateQuery.$set['details.$.failedAt'] = null;
      updateQuery.$set['details.$.skippedAt'] = null;
      updateQuery.$set['details.$.needsAttentionAt'] = null;
    } else if (status === 'WAITING') {
      updateQuery.$set['details.$.completedAt'] = null;
      updateQuery.$set['details.$.failedAt'] = null;
      updateQuery.$set['details.$.skippedAt'] = null;
      updateQuery.$set['details.$.needsAttentionAt'] = null;
    } else if (status === 'PASSED') {
      updateQuery.$set['details.$.completedAt'] = now;
      updateQuery.$set['details.$.failedAt'] = null;
      updateQuery.$set['details.$.skippedAt'] = null;
      updateQuery.$set['details.$.needsAttentionAt'] = null;
    } else if (status === 'FAILED') {
      updateQuery.$set['details.$.failedAt'] = now;
      updateQuery.$set['details.$.completedAt'] = null;
      updateQuery.$set['details.$.skippedAt'] = null;
      updateQuery.$set['details.$.needsAttentionAt'] = null;

      // Trigger Automatic Incident Creation
      const code = task.exceptionCodeSnapshot || 'SYSTEM_OR_NETWORK_ERROR';
      const requiredAction =
        task.actionDescriptionSnapshot || 'Yêu cầu kiểm tra sự cố hệ thống.';
      const severity = task.prioritySnapshot || 'MEDIUM';
      this.incidentsService
        .createIncident(
          shiftLogId,
          taskId,
          code,
          severity,
          requiredAction,
          user.fullName || user.username,
          15,
          user.id || user._id,
        )
        .catch((err) =>
          console.error('Error creating automatic incident:', err),
        );
    } else if (status === 'SKIPPED') {
      updateQuery.$set['details.$.skippedAt'] = now;
      updateQuery.$set['details.$.completedAt'] = null;
      updateQuery.$set['details.$.failedAt'] = null;
      updateQuery.$set['details.$.needsAttentionAt'] = null;
    } else if (status === 'NEEDS_ATTENTION') {
      updateQuery.$set['details.$.needsAttentionAt'] = now;
      updateQuery.$set['details.$.completedAt'] = null;
      updateQuery.$set['details.$.failedAt'] = null;
      updateQuery.$set['details.$.skippedAt'] = null;
    }

    const updatedLog = await this.shiftLogModel
      .findOneAndUpdate(
        { _id: shiftLogId, 'details.taskId': taskId },
        updateQuery,
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedLog) {
      throw new NotFoundException('Lỗi cập nhật tác vụ đồng thời');
    }

    // Recalculate progress
    const total = updatedLog.details.length;
    const completed = updatedLog.details.filter((d) => d.isChecked).length;
    updatedLog.progressPercentage =
      total > 0 ? parseFloat(((completed / total) * 100).toFixed(2)) : 0.0;
    await updatedLog.save();

    const result = await this.shiftLogModel
      .findById(updatedLog._id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy ca trực sau cập nhật');
    }

    // Create Audit Log record
    let auditLogRecord: any = null;
    if (oldStatus !== status && oldIsChecked !== isChecked) {
      const audit = new this.auditLogModel({
        shiftLogId: new Types.ObjectId(shiftLogId),
        taskId,
        taskName: task.taskNameSnapshot,
        userId: new Types.ObjectId(user.id || user._id),
        action: isChecked ? 'CHECK' : 'UNCHECK',
        details: `Cập nhật trạng thái tác vụ từ "${oldStatus}" sang "${status}"`,
      });
      const saved = await audit.save();
      auditLogRecord = await this.auditLogModel
        .findById(saved._id)
        .populate('userId', 'fullName username')
        .exec();
    }

    if (note !== undefined && oldNote !== note) {
      const noteAudit = new this.auditLogModel({
        shiftLogId: new Types.ObjectId(shiftLogId),
        taskId,
        taskName: task.taskNameSnapshot,
        userId: new Types.ObjectId(user.id || user._id),
        action: 'NOTE_UPDATE',
        details: `Cập nhật ghi chú: "${note || ''}" (Ghi chú cũ: "${oldNote || ''}")`,
      });
      const saved = await noteAudit.save();
      if (!auditLogRecord) {
        auditLogRecord = await this.auditLogModel
          .findById(saved._id)
          .populate('userId', 'fullName username')
          .exec();
      }
    }

    // Notify Gateway
    this.shiftsGateway.notifyShiftUpdate(shiftLogId, result, auditLogRecord);

    // Write system log
    await this.systemLogsService.logEvent({
      eventType: 'TASK_UPDATED',
      source: 'USER',
      actorUserId: user.id || user._id,
      jobId: result._id,
      departmentId: result.departmentId,
      shiftSlotId: result.shiftSlotId,
      status: 'SUCCESS',
      message: `Tác vụ "${task.taskNameSnapshot}" trong ca trực "${(result.templateId as any)?.title || 'Ca trực'}" được cập nhật: status=${status}${note !== undefined ? `, note="${note}"` : ''}.`,
      metadata: {
        taskId,
        taskName: task.taskNameSnapshot,
        status,
        isChecked,
        note,
      },
    });

    // Emit WebSocket Events
    this.shiftsGateway.emitEvent(
      'TASK_UPDATED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      {
        taskId,
        taskName: task.taskNameSnapshot,
        isChecked,
        status,
        progressPercentage: result.progressPercentage,
      },
    );
    this.shiftsGateway.emitEvent(
      'DASHBOARD_UPDATED',
      null,
      null,
      null,
      result.shiftDate,
      {},
    );

    // Alert Telegram if CRITICAL just updated
    if (isChecked && !oldIsChecked && task.prioritySnapshot === 'CRITICAL') {
      const actorName = user.fullName || 'Nhân sự vận hành';
      await this.telegramService.sendMessage(
        `✅ <b>[TÁC VỤ KHẨN CẤP HOÀN THÀNH]</b>\n` +
          `• Tác vụ: <b>${task.taskId} - ${task.taskNameSnapshot}</b>\n` +
          `• Trạng thái: <b>${status}</b>\n` +
          `• Ca trực: <i>${(result.templateId as any)?.title || 'Ca vận hành'}</i>\n` +
          `• Thực hiện bởi: <b>${actorName}</b>`,
      );
    }

    // Auto-update parent tasks if any child or dependency is updated
    if (!isParentTask) {
      // It is a subtask or regular task. We re-evaluate all parent tasks.
      const latestLog = await this.shiftLogModel.findById(shiftLogId).exec();
      if (latestLog) {
        const parentTaskIds = new Set(
          latestLog.details.map((d) => d.parentTaskIdSnapshot).filter(Boolean),
        );

        for (const parentId of parentTaskIds) {
          const parentTask = latestLog.details.find(
            (d) => d.taskId === parentId,
          );
          if (parentTask) {
            const siblings = latestLog.details.filter(
              (d) => d.parentTaskIdSnapshot === parentId,
            );
            const allSiblingsChecked = siblings.every((d) => d.isChecked);

            // Check parent dependencies
            let allDepsChecked = true;
            if (
              parentTask.dependsOnTaskIdsSnapshot &&
              parentTask.dependsOnTaskIdsSnapshot.length > 0
            ) {
              for (const depId of parentTask.dependsOnTaskIdsSnapshot) {
                const depTask = latestLog.details.find(
                  (d) => d.taskId === depId,
                );
                if (depTask && !depTask.isChecked) {
                  allDepsChecked = false;
                  break;
                }
              }
            }

            if (allSiblingsChecked && allDepsChecked && !parentTask.isChecked) {
              const hasManualBotOverride = siblings.some(
                (s) =>
                  s.isBotCheckSnapshot &&
                  s.isChecked &&
                  s.updatedBy &&
                  (s.updatedBy as any).role !== 'SYSTEM' &&
                  (s.updatedBy as any).fullName !== 'System Bot',
              );

              const noteText = hasManualBotOverride
                ? 'Hoàn thành theo các tác vụ con (Maker đã xác nhận thủ công thay cho Bot)'
                : 'Tự động hoàn thành theo các tác vụ con';

              const resLog = await this.updateTaskStatus(
                shiftLogId,
                parentId as string,
                'PASSED',
                user,
                noteText,
                true,
              );
              return resLog;
            } else if (
              (!allSiblingsChecked || !allDepsChecked) &&
              parentTask.isChecked
            ) {
              const resLog = await this.updateTaskStatus(
                shiftLogId,
                parentId as string,
                'PENDING',
                user,
                'Hủy hoàn thành tự động do có tác vụ con hoặc tác vụ phụ thuộc chưa hoàn tất',
                true,
              );
              return resLog;
            } else if (!parentTask.isChecked) {
              // Synchronize parent task status to WAITING when any sub-task is active or completed
              const hasActiveWork = siblings.some(
                (s) =>
                  s.status === 'WAITING' ||
                  s.isChecked ||
                  s.status === 'FAILED' ||
                  s.status === 'NEEDS_ATTENTION',
              );
              const targetStatus = hasActiveWork ? 'WAITING' : 'PENDING';
              if (parentTask.status !== targetStatus) {
                const resLog = await this.updateTaskStatus(
                  shiftLogId,
                  parentId as string,
                  targetStatus,
                  user,
                  targetStatus === 'WAITING'
                    ? 'Tự động chuyển trạng thái sang Đang kiểm tra/Đang thực hiện theo tiến trình các đầu việc con'
                    : 'Chuyển về trạng thái Chưa thực hiện do chưa có tiến trình đầu việc con nào hoạt động',
                  true,
                );
                return resLog;
              }
            }
          }
        }
      }
    }

    return result;
  }

  async toggleTask(
    shiftLogId: string,
    taskId: string,
    isChecked: boolean,
    user: any,
    note?: string,
  ): Promise<ShiftLog> {
    const status = isChecked ? 'PASSED' : 'PENDING';
    return this.updateTaskStatus(shiftLogId, taskId, status, user, note);
  }

  async closeShift(
    shiftLogId: string,
    user: any,
    handoverNote?: string,
  ): Promise<ShiftLog> {
    const canClose = await this.accessControlService.canAccessFeature(user, 'CLOSE_SHIFT');
    if (!canClose) {
      throw new ForbiddenException(
        'Chức vụ của bạn không có quyền chốt ca trực',
      );
    }

    const log = await this.shiftLogModel
      .findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    const dept = log.departmentId || (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    // Enforce CE/ACM priority backup validation for closing checklists
    const sessionType = (log.templateId as any)?.sessionType || '';
    if (sessionType === 'CLOSE') {
      const backupTasks = log.details.filter(
        (d) =>
          (d.taskId.toLowerCase().includes('ce') ||
            d.taskId.toLowerCase().includes('acm')) &&
          (d.taskNameSnapshot.toLowerCase().includes('backup') ||
            d.taskNameSnapshot.toLowerCase().includes('sao lưu')),
      );
      const incomplete = backupTasks.filter((d) => !d.isChecked);
      if (incomplete.length > 0) {
        const listStr = incomplete
          .map((d) => `[${d.taskId}] "${d.taskNameSnapshot}"`)
          .join(', ');
        throw new BadRequestException(
          `Không thể chốt ca trực. Các tác vụ sao lưu CE/ACM bắt buộc chưa hoàn thành: ${listStr}`,
        );
      }
    }

    log.status = 'COMPLETED';
    log.closedBy = new Types.ObjectId(user.id || user._id);
    log.closedAt = new Date();
    if (handoverNote !== undefined) {
      log.handoverNote = handoverNote || null;
    }
    await log.save();

    const result = await this.shiftLogModel
      .findById(log._id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy ca trực sau khi đóng');
    }

    // Notify Gateway
    this.shiftsGateway.notifyShiftUpdate(shiftLogId, result);

    // Ghi nhận log hệ thống
    await this.systemLogsService.logEvent({
      eventType: 'SHIFT_JOB_CLOSED',
      source: 'USER',
      actorUserId: user.id || user._id,
      jobId: result._id,
      departmentId: result.departmentId,
      shiftSlotId: result.shiftSlotId,
      status: 'SUCCESS',
      message: `Chốt ca trực "${(result.templateId as any)?.title || 'Ca trực'}" ngày ${result.shiftDate} thành công.`,
      metadata: {
        handoverNote: result.handoverNote,
        progressPercentage: result.progressPercentage,
      },
    });

    // Phát sự kiện qua WebSocket
    this.shiftsGateway.emitEvent(
      'SHIFT_JOB_CLOSED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      { progressPercentage: result.progressPercentage },
    );
    this.shiftsGateway.emitEvent(
      'DASHBOARD_UPDATED',
      null,
      null,
      null,
      result.shiftDate,
      {},
    );

    // Gửi thông báo Telegram báo cáo kết quả chốt ca
    const completedCount = result.details.filter((d) => d.isChecked).length;
    const totalCount = result.details.length;
    let telMsg =
      `🔒 <b>[MXV CHỐT CA TRỰC]</b>\n` +
      `• Ca trực: <b>${(result.templateId as any)?.title || 'Ca vận hành'}</b>\n` +
      `• Ngày trực: <b>${result.shiftDate}</b>\n` +
      `• Trạng thái: <b>ĐÃ HOÀN THÀNH & KHÓA SỔ</b>\n` +
      `• Người chốt: <b>${(result.closedBy as any)?.fullName}</b>\n` +
      `• Kết quả: <b>${completedCount}/${totalCount} tác vụ hoàn thành</b> (${result.progressPercentage}%)`;

    if (result.handoverNote) {
      telMsg += `\n• Biên bản bàn giao: <i>${result.handoverNote}</i>`;
    }

    await this.telegramService.sendMessage(telMsg);

    // Gửi email báo cáo bàn giao ca trực
    this.sendShiftHandoverEmail(result).catch((emailErr) => {
      this.logger.error(
        `Lỗi khi gọi sendShiftHandoverEmail: ${emailErr.message}`,
      );
    });

    return result;
  }

  private async sendShiftHandoverEmail(logResult: ShiftLog) {
    try {
      const config = await this.marginCheckerService.loadConfig();
      const mailSettings = config.shiftHandoverReport || {
        isSendWarning: true,
        email: ['it.support@mxv.vn'],
      };
      if (!mailSettings.isSendWarning) return;

      const templateTitle =
        (logResult.templateId as any)?.title || 'Ca vận hành';
      const shiftDate = logResult.shiftDate;
      const closedBy =
        (logResult.closedBy as any)?.fullName || 'Nhân sự vận hành';
      const completedCount = logResult.details.filter(
        (d) => d.isChecked,
      ).length;
      const totalCount = logResult.details.length;

      const subject = `[MXV SHIFT HANDOVER] Báo cáo bàn giao ca trực: ${templateTitle} - Ngày ${shiftDate}`;

      const detailsRows = logResult.details
        .map((d, idx) => {
          const statusText = d.isChecked
            ? 'HOÀN THÀNH'
            : d.status === 'FAILED'
              ? 'LỖI'
              : 'CHƯA LÀM';
          const statusColor = d.isChecked
            ? '#2e7d32'
            : d.status === 'FAILED'
              ? '#c62828'
              : '#e65100';
          const updatedBy = (d.updatedBy as any)?.fullName || '-';
          return `
          <tr>
            <td style="border: 1px solid #ddd; padding: 8px;">${idx + 1}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">${d.taskId}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${d.taskNameSnapshot}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold; color: ${statusColor};">${statusText}</td>
            <td style="border: 1px solid #ddd; padding: 8px;">${updatedBy}</td>
            <td style="border: 1px solid #ddd; padding: 8px; font-style: italic;">${d.note || '-'}</td>
          </tr>
        `;
        })
        .join('');

      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f6f9; padding: 20px;">
            <div style="max-width: 800px; margin: 0 auto; background-color: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 8px solid #1e3a8a;">
              <div style="padding: 20px;">
                <h2 style="color: #1e3a8a; margin-top: 0;">Báo Cáo Bàn Giao Ca Trực</h2>
                <p>Hệ thống ghi nhận ca trực đã hoàn thành và được chốt khóa sổ.</p>
                
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 180px; background-color: #f8f9fa;">Ca trực</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${templateTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Ngày trực</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${shiftDate}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Người chốt ca</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${closedBy}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Thời gian chốt</td>
                    <td style="padding: 8px; border: 1px solid #ddd;">${logResult.closedAt ? new Date(logResult.closedAt).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN')}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Tỷ lệ hoàn thành</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #2e7d32;">${completedCount}/${totalCount} tác vụ (${logResult.progressPercentage}%)</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">Ghi chú bàn giao</td>
                    <td style="padding: 8px; border: 1px solid #ddd; font-style: italic;">${logResult.handoverNote || 'Không có ghi chú.'}</td>
                  </tr>
                </table>

                <h3>Chi Tiết Tác Vụ Checklist</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                  <thead>
                    <tr style="background-color: #f8f9fa;">
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 40px;">STT</th>
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 100px;">Mã Tác Vụ</th>
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Tên Tác Vụ</th>
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 120px;">Trạng Thế</th>
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left; width: 120px;">Người Thực Hiện</th>
                      <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Ghi Chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${detailsRows}
                  </tbody>
                </table>
              </div>
              <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #777; border-top: 1px solid #ddd;">
                Đây là email tự động từ hệ thống MXV Shift Checklist.
              </div>
            </div>
          </body>
        </html>
      `;

      await this.marginCheckerService.sendEmailNotification(
        config,
        mailSettings.email,
        subject,
        htmlBody,
      );
      this.logger.log(`Đã gửi email báo cáo bàn giao ca trực thành công.`);
    } catch (err: any) {
      this.logger.error(
        `Không thể gửi email báo cáo bàn giao ca trực: ${err.message}`,
      );
    }
  }

  async getHistory(
    user: any,
    departmentId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
    page?: number,
    limit?: number,
  ): Promise<any> {
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (startDate || endDate) {
      filter.shiftDate = {};
      if (startDate) {
        filter.shiftDate.$gte = startDate;
      }
      if (endDate) {
        filter.shiftDate.$lte = endDate;
      }
    }

    // Scoping
    if (
      user.role !== 'ADMIN' &&
      user.role !== 'CEO' &&
      user.role !== 'CHAIRMAN' &&
      user.role !== 'DIVISION_DIRECTOR'
    ) {
      const deptId = user.departmentId?._id || user.departmentId;
      const templates = await this.templateModel
        .find({
          departmentId: {
            $in: [new Types.ObjectId(deptId), deptId.toString()],
          },
        })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel
        .find({
          departmentId: {
            $in: [
              new Types.ObjectId(departmentId),
              departmentId.toString(),
            ],
          },
        })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    }

    const total = await this.shiftLogModel.countDocuments(filter).exec();

    let query = this.shiftLogModel
      .find(filter)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .populate('shiftSlotId')
      .populate('departmentId')
      .sort({ shiftDate: -1, createdAt: -1 });

    if (page && limit) {
      const skip = (page - 1) * limit;
      query = query.skip(skip).limit(limit);
    }

    const data = await query.exec();
    for (const log of data) {
      this.adjustShiftSlotTimesForSeason(log);
    }

    return {
      data,
      total,
      page: page || 1,
      limit: limit || total,
    };

  }

  async getActiveShiftsByDepartment(
    user: any,
    departmentId?: string,
    shiftDate?: string,
  ): Promise<ShiftLog[]> {
    const targetDate =
      shiftDate ||
      new Date(new Date().getTime() + 7 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    const filter: any = shiftDate
      ? { shiftDate }
      : {
          $or: [{ shiftDate: targetDate }, { status: 'PENDING' }],
        };

    if (
      user.role !== 'ADMIN' &&
      user.role !== 'CEO' &&
      user.role !== 'CHAIRMAN' &&
      user.role !== 'DIVISION_DIRECTOR'
    ) {
      const deptId = user.departmentId?._id || user.departmentId;
      const templates = await this.templateModel
        .find({
          departmentId: {
            $in: [new Types.ObjectId(deptId), deptId.toString()],
          },
        })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel
        .find({
          departmentId: {
            $in: [
              new Types.ObjectId(departmentId),
              departmentId.toString(),
            ],
          },
        })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    }

    const logs = await this.shiftLogModel
      .find(filter)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .populate('shiftSlotId')
      .populate('departmentId')
      .exec();

    for (const log of logs) {
      this.adjustShiftSlotTimesForSeason(log);
    }
    return logs;

  }

  async getShiftById(id: string, user: any): Promise<ShiftLog> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID ca trực không hợp lệ');
    }
    const log = await this.shiftLogModel
      .findById(id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .populate('shiftSlotId')
      .populate('departmentId')
      .exec();
    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    const dept = log.departmentId || (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    this.adjustShiftSlotTimesForSeason(log);
    return log;

  }

  async getShiftByIdInternal(id: string): Promise<ShiftLog | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.shiftLogModel
      .findById(id)
      .populate('userId', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .populate('shiftSlotId')
      .populate('departmentId')
      .exec();
  }


  async getAuditLogs(shiftLogId: string, user: any): Promise<AuditLog[]> {
    if (!Types.ObjectId.isValid(shiftLogId)) {
      throw new BadRequestException('ID ca trực không hợp lệ');
    }

    const log = await this.shiftLogModel
      .findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' },
      })
      .exec();
    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    const dept = log.departmentId || (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    this.validateScope(user, deptId);

    return this.auditLogModel
      .find({ shiftLogId: new Types.ObjectId(shiftLogId) })
      .populate('userId', 'fullName username')
      .sort({ createdAt: -1 })
      .exec();
  }

  async globalSearch(query: string, user: any) {
    console.log('[DEBUG] Global search details:', {
      username: user?.username,
      role: user?.role,
      departmentId: user?.departmentId?._id || user?.departmentId,
    });
    const scopeFilter = await this.accessControlService.getScopeFilter(user);
    console.log('[DEBUG] Generated scopeFilter:', JSON.stringify(scopeFilter));
    const regex = new RegExp(query, 'i');
    
    // 1. Search Incidents via incidentsService
    const incidents = await this.incidentsService.searchIncidents(query, user);

    // 2. Search ShiftLogs (handoverNote, details)
    const logFilter: any = {
      ...scopeFilter,
      $or: [
        { handoverNote: { $regex: regex } },
        { 'details.taskNameSnapshot': { $regex: regex } },
        { 'details.note': { $regex: regex } },
        { 'details.resultNote': { $regex: regex } },
      ],
    };

    const logs = await this.shiftLogModel
      .find(logFilter)
      .populate('templateId')
      .sort({ createdAt: -1 })
      .limit(30)
      .exec();

    const matchedHandovers = [];
    const matchedTasks = [];

    for (const log of logs) {
      // Check handoverNote
      if (log.handoverNote && regex.test(log.handoverNote)) {
        matchedHandovers.push({
          shiftLogId: log._id.toString(),
          shiftTitle: (log.templateId as any)?.title || 'Ca trực',
          shiftDate: log.shiftDate,
          handoverNote: log.handoverNote,
          status: log.status,
        });
      }

      // Check tasks details
      for (const detail of log.details) {
        const isTaskMatch = 
          regex.test(detail.taskId) ||
          regex.test(detail.taskNameSnapshot) ||
          (detail.note && regex.test(detail.note)) ||
          (detail.resultNote && regex.test(detail.resultNote));

        if (isTaskMatch) {
          matchedTasks.push({
            shiftLogId: log._id.toString(),
            shiftTitle: (log.templateId as any)?.title || 'Ca trực',
            shiftDate: log.shiftDate,
            taskId: detail.taskId,
            taskName: detail.taskNameSnapshot,
            isChecked: detail.isChecked,
            status: detail.status,
            note: detail.note,
            resultNote: detail.resultNote,
          });
        }
      }
    }

    return {
      incidents,
      tasks: matchedTasks.slice(0, 10),
      handovers: matchedHandovers.slice(0, 10),
    };
  }

  adjustShiftSlotTimesForSeason(log: any) {
    if (log && log.shiftSlotId && log.shiftDate) {
      const slot = log.shiftSlotId;
      if (slot.seasonalHours && slot.seasonalHours.length > 0) {
        const timezone = 'America/Chicago';
        const isSummer = this.workingCalendarService.isDaylightSavingTime(
          log.shiftDate,
          timezone,
        );
        const seasonName = isSummer ? 'SUMMER' : 'WINTER';
        const matched = slot.seasonalHours.find(
          (h: any) => h.name === seasonName,
        );
        if (matched) {
          const st = matched.startTime;
          const et = matched.endTime;
          try {
            slot.startTime = st;
            slot.endTime = et;
          } catch {
            if (typeof slot.toObject === 'function') {
              log.shiftSlotId = slot.toObject();
              log.shiftSlotId.startTime = st;
              log.shiftSlotId.endTime = et;
            }
          }
        }
      }
    }
    return log;
  }

}

