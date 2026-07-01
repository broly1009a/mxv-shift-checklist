import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
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

@Injectable()
export class ShiftsService {
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
  ) { }

  private validateScope(
    user: any,
    departmentId: string | Types.ObjectId,
    divisionId?: string | Types.ObjectId,
  ) {
    this.accessControlService.validateScope(
      user,
      departmentId ? departmentId.toString() : null,
      divisionId ? divisionId.toString() : null,
    );
  }


  async initializeShift(
    templateId: string,
    user: any,
    shiftDateInput?: string,
  ): Promise<ShiftLog> {
    if (user.role === 'STAFF' || user.role === 'CHAIRMAN') {
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
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    // Default shift date is current date in Vietnam time (GMT+7)
    let shiftDate = shiftDateInput;
    if (!shiftDate) {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      shiftDate = vietnamTime.toISOString().split('T')[0];
    }

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
        departmentId: existingLog.departmentId as any,
        shiftSlotId: existingLog.shiftSlotId as any,
        jobId: existingLog._id as any,
        status: 'SKIPPED',
        message: `Bỏ qua khởi tạo ca trực cho mẫu "${(existingLog.templateId as any)?.title}" do đã tồn tại.`,
        metadata: { templateTitle: (existingLog.templateId as any)?.title, date: shiftDate },
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
      divisionId: divId ? new Types.ObjectId(divId as any) : null,
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
      eventType: 'JOB_GENERATED',
      source: 'USER',
      actorUserId: user.id || user._id,
      jobId: result._id as any,
      departmentId: result.departmentId as any,
      shiftSlotId: result.shiftSlotId as any,
      status: 'SUCCESS',
      message: `Khởi tạo thành công ca trực "${(result.templateId as any)?.title}" bởi ${user.fullName || 'Nhân sự'}.`,
      metadata: { templateTitle: (result.templateId as any)?.title, date: result.shiftDate },
    });

    // Phát sự kiện qua WebSocket
    this.shiftsGateway.emitEvent(
      'SHIFT_JOB_GENERATED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      { title: (result.templateId as any)?.title }
    );
    this.shiftsGateway.emitEvent('DASHBOARD_UPDATED', null, null, null, result.shiftDate, {});

    return result;
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
      throw new BadRequestException('Ca trực đã đóng, không thể thêm tác vụ mới');
    }

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

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

    log.details.push(newDetail as any);

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
      jobId: result._id as any,
      departmentId: result.departmentId as any,
      shiftSlotId: result.shiftSlotId as any,
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
      { taskId, taskName: taskData.taskName, isChecked: false, status: 'PENDING', progressPercentage: result.progressPercentage }
    );
    this.shiftsGateway.emitEvent('DASHBOARD_UPDATED', null, null, null, result.shiftDate, {});

    return result;
  }

  async updateTaskStatus(
    shiftLogId: string,
    taskId: string,
    status: string,
    user: any,
    note?: string,
  ): Promise<ShiftLog> {
    const validStatuses = ['PENDING', 'WAITING', 'PASSED', 'FAILED', 'SKIPPED', 'NEEDS_ATTENTION'];
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

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    const task = log.details.find((d) => d.taskId === taskId);
    if (!task) {
      throw new NotFoundException(
        'Không tìm thấy tác vụ tương ứng trong ca trực',
      );
    }

    const oldIsChecked = task.isChecked;
    const oldStatus = task.status || 'PENDING';
    const oldNote = task.note;

    // Check task dependencies if status is not PENDING
    if (status !== 'PENDING' && task.dependsOnTaskIdsSnapshot && task.dependsOnTaskIdsSnapshot.length > 0) {
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
          d.dependsOnTaskIdsSnapshot.includes(taskId),
      );
      if (dependents.length > 0) {
        const listStr = dependents.map((d) => `[${d.taskId}] "${d.taskNameSnapshot}"`).join(', ');
        throw new BadRequestException(
          `Không thể hủy hoàn thành tác vụ này do có tác vụ khác đang hoàn thành phụ thuộc vào nó: ${listStr}`,
        );
      }
    }

    const now = new Date();
    const isChecked = status !== 'PENDING';

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
      const requiredAction = task.actionDescriptionSnapshot || 'Yêu cầu kiểm tra sự cố hệ thống.';
      const severity = task.prioritySnapshot || 'MEDIUM';
      this.incidentsService.createIncident(
        shiftLogId,
        taskId,
        code,
        severity,
        requiredAction,
        user.fullName || user.username,
        15
      ).catch(err => console.error('Error creating automatic incident:', err));
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
        { new: true },
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
    if (oldStatus !== status) {
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
      jobId: result._id as any,
      departmentId: result.departmentId as any,
      shiftSlotId: result.shiftSlotId as any,
      status: 'SUCCESS',
      message: `Tác vụ "${task.taskNameSnapshot}" trong ca trực "${(result.templateId as any)?.title || 'Ca trực'}" được cập nhật: status=${status}${note !== undefined ? `, note="${note}"` : ''}.`,
      metadata: { taskId, taskName: task.taskNameSnapshot, status, isChecked, note },
    });

    // Emit WebSocket Events
    this.shiftsGateway.emitEvent(
      'TASK_UPDATED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      { taskId, taskName: task.taskNameSnapshot, isChecked, status, progressPercentage: result.progressPercentage }
    );
    this.shiftsGateway.emitEvent('DASHBOARD_UPDATED', null, null, null, result.shiftDate, {});

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
    if (user.role === 'STAFF' || user.role === 'CHAIRMAN') {
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

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    // Enforce CE/ACM priority backup validation for closing checklists
    const sessionType = (log.templateId as any)?.sessionType || '';
    if (sessionType === 'CLOSE') {
      const backupTasks = log.details.filter(
        (d) =>
          (d.taskId.toLowerCase().includes('ce') || d.taskId.toLowerCase().includes('acm')) &&
          (d.taskNameSnapshot.toLowerCase().includes('backup') ||
            d.taskNameSnapshot.toLowerCase().includes('sao lưu')),
      );
      const incomplete = backupTasks.filter((d) => !d.isChecked);
      if (incomplete.length > 0) {
        const listStr = incomplete.map((d) => `[${d.taskId}] "${d.taskNameSnapshot}"`).join(', ');
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
      jobId: result._id as any,
      departmentId: result.departmentId as any,
      shiftSlotId: result.shiftSlotId as any,
      status: 'SUCCESS',
      message: `Chốt ca trực "${(result.templateId as any)?.title || 'Ca trực'}" ngày ${result.shiftDate} thành công.`,
      metadata: { handoverNote: result.handoverNote, progressPercentage: result.progressPercentage },
    });

    // Phát sự kiện qua WebSocket
    this.shiftsGateway.emitEvent(
      'SHIFT_JOB_CLOSED',
      result._id.toString(),
      result.departmentId ? result.departmentId.toString() : null,
      result.shiftSlotId ? result.shiftSlotId.toString() : null,
      result.shiftDate,
      { progressPercentage: result.progressPercentage }
    );
    this.shiftsGateway.emitEvent('DASHBOARD_UPDATED', null, null, null, result.shiftDate, {});

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

    return result;
  }

  async getHistory(
    user: any,
    departmentId?: string,
    startDate?: string,
    endDate?: string,
    status?: string,
  ): Promise<ShiftLog[]> {
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
      user.role !== 'CHAIRMAN'
    ) {
      if (user.role === 'DIVISION_DIRECTOR') {
        const templates = await this.templateModel
          .find()
          .populate('departmentId')
          .exec();
        const filteredTemplates = templates.filter((t) => {
          const dept = t.departmentId as any;
          const uDivId = user.divisionId?._id || user.divisionId;
          const targetDivId = dept?.divisionId?._id || dept?.divisionId;
          return targetDivId?.toString() === uDivId?.toString();
        });
        const templateIds = filteredTemplates.map((t) => t._id);
        filter.templateId = { $in: templateIds };
      } else {
        const deptId = user.departmentId?._id || user.departmentId;
        const templates = await this.templateModel
          .find({ departmentId: new Types.ObjectId(deptId) })
          .exec();
        const templateIds = templates.map((t) => t._id);
        filter.templateId = { $in: templateIds };
      }
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel
        .find({ departmentId: new Types.ObjectId(departmentId) })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    }

    return this.shiftLogModel
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
      .sort({ shiftDate: -1, createdAt: -1 })
      .exec();
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
    const filter: any = { shiftDate: targetDate };

    if (
      user.role !== 'ADMIN' &&
      user.role !== 'CEO' &&
      user.role !== 'CHAIRMAN'
    ) {
      if (user.role === 'DIVISION_DIRECTOR') {
        const templates = await this.templateModel
          .find()
          .populate('departmentId')
          .exec();
        const filteredTemplates = templates.filter((t) => {
          const dept = t.departmentId as any;
          const uDivId = user.divisionId?._id || user.divisionId;
          const targetDivId = dept?.divisionId?._id || dept?.divisionId;
          return targetDivId?.toString() === uDivId?.toString();
        });
        const templateIds = filteredTemplates.map((t) => t._id);
        filter.templateId = { $in: templateIds };
      } else {
        const deptId = user.departmentId?._id || user.departmentId;
        const templates = await this.templateModel
          .find({ departmentId: new Types.ObjectId(deptId) })
          .exec();
        const templateIds = templates.map((t) => t._id);
        filter.templateId = { $in: templateIds };
      }
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel
        .find({ departmentId: new Types.ObjectId(departmentId) })
        .exec();
      const templateIds = templates.map((t) => t._id);
      filter.templateId = { $in: templateIds };
    }

    return this.shiftLogModel
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

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    return log;
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

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    return this.auditLogModel
      .find({ shiftLogId: new Types.ObjectId(shiftLogId) })
      .populate('userId', 'fullName username')
      .sort({ createdAt: -1 })
      .exec();
  }
}
