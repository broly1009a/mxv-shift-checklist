import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { AuditLog } from '../../schemas/audit-log.schema';
import { ShiftsGateway } from './shifts.gateway';
import { TelegramService } from '../telegram/telegram.service';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(ChecklistTemplate.name) private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    private readonly shiftsGateway: ShiftsGateway,
    private readonly telegramService: TelegramService,
  ) {}

  private validateScope(user: any, departmentId: string | Types.ObjectId, divisionId?: string | Types.ObjectId) {
    if (!user) {
      throw new ForbiddenException('Yêu cầu đăng nhập để truy cập tài nguyên');
    }

    if (user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'CHAIRMAN') {
      return true;
    }

    if (user.role === 'DIVISION_DIRECTOR') {
      if (!user.divisionId || !divisionId) {
        throw new ForbiddenException('Bạn không thuộc Khối nào hoặc tài nguyên không thuộc Khối nào');
      }
      if (user.divisionId.toString() !== divisionId.toString()) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của Khối khác');
      }
      return true;
    }

    if (user.role === 'DEPARTMENT_HEAD' || user.role === 'STAFF') {
      if (!user.departmentId || !departmentId) {
        throw new ForbiddenException('Bạn không thuộc Bộ phận nào hoặc tài nguyên không thuộc Bộ phận nào');
      }
      if (user.departmentId.toString() !== departmentId.toString()) {
        throw new ForbiddenException('Bạn không có quyền truy cập dữ liệu của Bộ phận khác');
      }
      return true;
    }

    throw new ForbiddenException('Quyền hạn của bạn không hợp lệ');
  }

  async initializeShift(templateId: string, user: any, shiftDateInput?: string): Promise<ShiftLog> {
    if (user.role === 'STAFF' || user.role === 'CHAIRMAN') {
      throw new ForbiddenException('Chức vụ của bạn không có quyền khởi tạo ca trực');
    }

    const template = await this.templateModel.findById(templateId).populate('departmentId').exec();
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
      .findOne({ templateId: new Types.ObjectId(templateId), shiftDate, status: 'PENDING' })
      .populate('userId', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();

    if (existingLog) {
      return existingLog;
    }

    const details = template.tasks.map(task => ({
      taskId: task.taskId,
      taskNameSnapshot: task.taskName,
      prioritySnapshot: task.priority,
      deadlineSnapshot: task.deadline || null,
      isChecked: false,
      checkedAt: null,
      updatedBy: null,
      note: null,
    }));

    const newLog = new this.shiftLogModel({
      templateId: new Types.ObjectId(templateId),
      userId: new Types.ObjectId(user.id || user._id),
      shiftDate,
      status: 'PENDING',
      progressPercentage: 0.00,
      details,
    });

    const saved = await newLog.save();
    const result = await this.shiftLogModel.findById(saved._id)
      .populate('userId', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();
    if (!result) {
      throw new NotFoundException('Lỗi khởi tạo ca trực');
    }

    // Gửi thông báo Telegram khi khởi tạo ca trực
    const deptName = (result.templateId as any)?.departmentId?.name || 'Vận hành';
    await this.telegramService.sendMessage(
      `🔔 <b>[MXV KHỞI TẠO CA TRỰC]</b>\n` +
      `• Ca trực: <b>${(result.templateId as any)?.title}</b>\n` +
      `• Ngày trực: <b>${result.shiftDate}</b>\n` +
      `• Phòng ban: <b>${deptName}</b>\n` +
      `• Người trực chính: <b>${(result.userId as any)?.fullName}</b>`
    );

    return result;
  }

  async toggleTask(shiftLogId: string, taskId: string, isChecked: boolean, user: any, note?: string): Promise<ShiftLog> {
    const log = await this.shiftLogModel.findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    if (log.status === 'COMPLETED') {
      throw new BadRequestException('Ca trực đã được chốt, không thể thay đổi dữ liệu');
    }

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    const task = log.details.find(d => d.taskId === taskId);
    if (!task) {
      throw new NotFoundException('Không tìm thấy tác vụ tương ứng trong ca trực');
    }

    const oldIsChecked = task.isChecked;
    const oldNote = task.note;

    // Cập nhật nguyên tử mảng details của MongoDB để bảo vệ chống ghi đè đồng thời
    const now = new Date();
    const updateQuery: any = {
      $set: {
        "details.$.isChecked": isChecked,
        "details.$.checkedAt": isChecked ? now : null,
        "details.$.updatedBy": new Types.ObjectId(user.id || user._id) as any,
      }
    };
    if (note !== undefined) {
      updateQuery.$set["details.$.note"] = note || null;
    }

    const updatedLog = await this.shiftLogModel.findOneAndUpdate(
      { _id: shiftLogId, "details.taskId": taskId },
      updateQuery,
      { new: true }
    ).exec();

    if (!updatedLog) {
      throw new NotFoundException('Lỗi cập nhật tác vụ đồng thời');
    }

    // Tính toán lại tiến trình và lưu trữ
    const total = updatedLog.details.length;
    const completed = updatedLog.details.filter(d => d.isChecked).length;
    updatedLog.progressPercentage = total > 0 ? parseFloat(((completed / total) * 100).toFixed(2)) : 0.00;
    await updatedLog.save();

    const result = await this.shiftLogModel.findById(updatedLog._id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy ca trực sau cập nhật');
    }

    // Tạo Audit Logs
    let auditLogRecord: any = null;
    if (oldIsChecked !== isChecked) {
      const audit = new this.auditLogModel({
        shiftLogId: new Types.ObjectId(shiftLogId),
        taskId,
        taskName: task.taskNameSnapshot,
        userId: new Types.ObjectId(user.id || user._id),
        action: isChecked ? 'CHECK' : 'UNCHECK',
        details: isChecked ? 'Tích hoàn thành tác vụ' : 'Hủy hoàn thành tác vụ',
      });
      const saved = await audit.save();
      auditLogRecord = await this.auditLogModel.findById(saved._id).populate('userId', 'fullName username').exec();
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
        auditLogRecord = await this.auditLogModel.findById(saved._id).populate('userId', 'fullName username').exec();
      }
    }

    // Notify Gateway
    this.shiftsGateway.notifyShiftUpdate(shiftLogId, result, auditLogRecord);

    // Alert Telegram nếu tác vụ khẩn cấp (CRITICAL) vừa được hoàn thành
    if (isChecked && !oldIsChecked && task.prioritySnapshot === 'CRITICAL') {
      const actorName = user.fullName || 'Nhân sự vận hành';
      await this.telegramService.sendMessage(
        `✅ <b>[TÁC VỤ KHẨN CẤP HOÀN THÀNH]</b>\n` +
        `• Tác vụ: <b>${task.taskId} - ${task.taskNameSnapshot}</b>\n` +
        `• Ca trực: <i>${(result.templateId as any)?.title || 'Ca vận hành'}</i>\n` +
        `• Thực hiện bởi: <b>${actorName}</b>`
      );
    }

    return result;
  }

  async closeShift(shiftLogId: string, user: any, handoverNote?: string): Promise<ShiftLog> {
    if (user.role === 'STAFF' || user.role === 'CHAIRMAN') {
      throw new ForbiddenException('Chức vụ của bạn không có quyền chốt ca trực');
    }

    const log = await this.shiftLogModel.findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();

    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    log.status = 'COMPLETED';
    log.closedBy = new Types.ObjectId(user.id || user._id) as any;
    log.closedAt = new Date();
    if (handoverNote !== undefined) {
      log.handoverNote = handoverNote || null;
    }
    await log.save();

    const result = await this.shiftLogModel.findById(log._id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();
    if (!result) {
      throw new NotFoundException('Không tìm thấy ca trực sau khi đóng');
    }

    // Notify Gateway
    this.shiftsGateway.notifyShiftUpdate(shiftLogId, result);

    // Gửi thông báo Telegram báo cáo kết quả chốt ca
    const completedCount = result.details.filter(d => d.isChecked).length;
    const totalCount = result.details.length;
    let telMsg = `🔒 <b>[MXV CHỐT CA TRỰC]</b>\n` +
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

  async getHistory(user: any, departmentId?: string, startDate?: string, endDate?: string, status?: string): Promise<ShiftLog[]> {
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
    if (user.role !== 'ADMIN' && user.role !== 'CEO' && user.role !== 'CHAIRMAN') {
      if (user.role === 'DIVISION_DIRECTOR') {
        const templates = await this.templateModel.find().populate('departmentId').exec();
        const filteredTemplates = templates.filter(t => {
          const dept = t.departmentId as any;
          return dept?.divisionId?.toString() === user.divisionId?.toString();
        });
        const templateIds = filteredTemplates.map(t => t._id);
        filter.templateId = { $in: templateIds };
      } else {
        const deptId = user.departmentId;
        const templates = await this.templateModel.find({ departmentId: new Types.ObjectId(deptId) }).exec();
        const templateIds = templates.map(t => t._id);
        filter.templateId = { $in: templateIds };
      }
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel.find({ departmentId: new Types.ObjectId(departmentId) }).exec();
      const templateIds = templates.map(t => t._id);
      filter.templateId = { $in: templateIds };
    }

    return this.shiftLogModel.find(filter)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .sort({ shiftDate: -1, createdAt: -1 })
      .exec();
  }

  async getActiveShiftsByDepartment(user: any, departmentId?: string, shiftDate?: string): Promise<ShiftLog[]> {
    const targetDate = shiftDate || new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    const filter: any = { shiftDate: targetDate };

    if (user.role !== 'ADMIN' && user.role !== 'CEO' && user.role !== 'CHAIRMAN') {
      if (user.role === 'DIVISION_DIRECTOR') {
        const templates = await this.templateModel.find().populate('departmentId').exec();
        const filteredTemplates = templates.filter(t => {
          const dept = t.departmentId as any;
          return dept?.divisionId?.toString() === user.divisionId?.toString();
        });
        const templateIds = filteredTemplates.map(t => t._id);
        filter.templateId = { $in: templateIds };
      } else {
        const deptId = user.departmentId;
        const templates = await this.templateModel.find({ departmentId: new Types.ObjectId(deptId) }).exec();
        const templateIds = templates.map(t => t._id);
        filter.templateId = { $in: templateIds };
      }
    } else if (departmentId && Types.ObjectId.isValid(departmentId)) {
      const templates = await this.templateModel.find({ departmentId: new Types.ObjectId(departmentId) }).exec();
      const templateIds = templates.map(t => t._id);
      filter.templateId = { $in: templateIds };
    }

    return this.shiftLogModel.find(filter)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();
  }

  async getShiftById(id: string, user: any): Promise<ShiftLog> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID ca trực không hợp lệ');
    }
    const log = await this.shiftLogModel.findById(id)
      .populate('userId', 'fullName username')
      .populate('closedBy', 'fullName username')
      .populate('details.updatedBy', 'fullName username')
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
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

    const log = await this.shiftLogModel.findById(shiftLogId)
      .populate({
        path: 'templateId',
        populate: { path: 'departmentId' }
      })
      .exec();
    if (!log) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }

    const dept = (log.templateId as any)?.departmentId;
    const deptId = dept?._id || dept;
    const divId = dept?.divisionId || null;
    this.validateScope(user, deptId, divId);

    return this.auditLogModel.find({ shiftLogId: new Types.ObjectId(shiftLogId) })
      .populate('userId', 'fullName username')
      .sort({ createdAt: -1 })
      .exec();
  }
}
