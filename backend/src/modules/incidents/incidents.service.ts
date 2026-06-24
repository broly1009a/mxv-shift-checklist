import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Incident } from '../../schemas/incident.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { AuditLog } from '../../schemas/audit-log.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessControlService } from '../auth/access-control.service';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectModel(Incident.name) private readonly incidentModel: Model<Incident>,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    @Inject(forwardRef(() => ShiftsGateway))
    private readonly shiftsGateway: ShiftsGateway,
    private readonly accessControlService: AccessControlService,
  ) {}


  async createIncident(
    shiftLogId: string,
    taskId: string,
    code: string,
    severity: string,
    requiredAction: string,
    actor: string,
    slaMinutes: number = 15,
  ): Promise<Incident> {
    // Check if there is an existing PENDING incident for the same task in this shift log
    const existing = await this.incidentModel.findOne({
      shiftLogId: new Types.ObjectId(shiftLogId),
      taskId,
      status: 'PENDING',
    });
    if (existing) return existing;

    const slaDeadlineAt = new Date();
    slaDeadlineAt.setMinutes(slaDeadlineAt.getMinutes() + slaMinutes);

    const incident = new this.incidentModel({
      code,
      taskId,
      shiftLogId: new Types.ObjectId(shiftLogId),
      severity,
      requiredAction,
      status: 'PENDING',
      detectedAt: new Date(),
      slaDeadlineAt,
      timeline: [
        {
          status: 'PENDING',
          comment: `Sự cố phát hiện tự động. Yêu cầu hành động: ${requiredAction}`,
          timestamp: new Date(),
          actor,
        },
      ],
    });

    const saved = await incident.save();

    // Log audit event
    const audit = new this.auditLogModel({
      shiftLogId: new Types.ObjectId(shiftLogId),
      taskId,
      action: 'INCIDENT_CREATED',
      performedBy: actor,
      comment: `Tự động tạo sự cố [${code}] cho tác vụ [${taskId}].`,
      timestamp: new Date(),
    });
    await audit.save();

    // Emit realtime event
    if (this.shiftsGateway?.server) {
      this.shiftsGateway.server.to(shiftLogId).emit('incident-updated', { incident: saved, auditLog: audit });
      this.shiftsGateway.server.emit('dashboard-updated', { type: 'INCIDENT_CREATED', shiftLogId });
    }

    return saved;
  }

  async resolveIncident(
    incidentId: string,
    resolveDto: {
      rootCause: string;
      remediationAction: string;
      affectedAccounts?: string[];
    },
    user: any,
  ): Promise<Incident> {
    const incident = await this.incidentModel.findById(incidentId);
    if (!incident) {
      throw new NotFoundException('Không tìm thấy sự cố');
    }

    const shift = await this.shiftLogModel.findById(incident.shiftLogId);
    if (shift) {
      this.accessControlService.validateScope(user, (shift.departmentId || null) as any, (shift.divisionId || null) as any);
    }

    if (incident.status === 'RESOLVED') {
      return incident;
    }

    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date();
    incident.resolvedBy = new Types.ObjectId(user.id || user._id);
    incident.rootCause = resolveDto.rootCause;
    incident.remediationAction = resolveDto.remediationAction;
    incident.affectedAccounts = resolveDto.affectedAccounts || [];
    incident.timeline.push({
      status: 'RESOLVED',
      comment: `Đã khắc phục sự cố. Nguyên nhân: ${resolveDto.rootCause}. Xử lý: ${resolveDto.remediationAction}`,
      timestamp: new Date(),
      actor: user.fullName || user.username,
    });

    const saved = await incident.save();

    // Log audit event
    const audit = new this.auditLogModel({
      shiftLogId: incident.shiftLogId,
      taskId: incident.taskId,
      action: 'INCIDENT_RESOLVED',
      performedBy: user.fullName || user.username,
      comment: `Giải quyết sự cố [${incident.code}]. Nguyên nhân: ${resolveDto.rootCause}`,
      timestamp: new Date(),
    });
    await audit.save();

    // Emit realtime event
    if (this.shiftsGateway?.server) {
      const room = incident.shiftLogId.toString();
      this.shiftsGateway.server.to(room).emit('incident-updated', { incident: saved, auditLog: audit });
      this.shiftsGateway.server.emit('dashboard-updated', { type: 'INCIDENT_RESOLVED', shiftLogId: incident.shiftLogId });
    }

    return saved;
  }

  async getIncidentsByShift(shiftLogId: string, user: any): Promise<Incident[]> {
    const shift = await this.shiftLogModel.findById(shiftLogId);
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }
    this.accessControlService.validateScope(user, (shift.departmentId || null) as any, (shift.divisionId || null) as any);

    return this.incidentModel
      .find({ shiftLogId: new Types.ObjectId(shiftLogId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPendingIncidents(user: any): Promise<Incident[]> {
    const scopeFilter = await this.accessControlService.getScopeFilter(user);
    const filter: any = { status: 'PENDING' };

    if (Object.keys(scopeFilter).length > 0) {
      const matchingShifts = await this.shiftLogModel.find(scopeFilter).select('_id').exec();
      const shiftIds = matchingShifts.map((s) => s._id);
      filter.shiftLogId = { $in: shiftIds };
    }

    return this.incidentModel
      .find(filter)
      .populate({
        path: 'shiftLogId',
        populate: { path: 'templateId' }
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  // Cron job running every 1 minute to check SLA breaches
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSlaBreaches(): Promise<void> {
    const activeShifts = await this.shiftLogModel.find({ status: 'PENDING' }).exec();
    const now = new Date();

    for (const shift of activeShifts) {
      let shiftUpdated = false;
      for (const item of shift.details) {
        if (item.isChecked) continue;

        const deadlineStr = item.slaDeadlineSnapshot;
        if (!deadlineStr) continue;

        const [hours, minutes] = deadlineStr.split(':').map(Number);
        if (isNaN(hours) || isNaN(minutes)) continue;

        const [year, month, day] = shift.shiftDate.split('-').map(Number);
        const deadlineDate = new Date(Date.UTC(year, month - 1, day, hours - 7, minutes, 0));

        if (now > deadlineDate) {
          if (item.status === 'PENDING') {
            item.status = 'NEEDS_ATTENTION';
            shiftUpdated = true;
          }

          await this.createIncident(
            shift._id.toString(),
            item.taskId,
            `SLA_BREACH_${hours.toString().padStart(2, '0')}${minutes.toString().padStart(2, '0')}`,
            'HIGH',
            `Báo cáo trễ hạn SLA tác vụ ${item.taskId} (${item.taskNameSnapshot}).`,
            'SYSTEM',
            15,
          );
        }
      }

      if (shiftUpdated) {
        const saved = await shift.save();
        if (this.shiftsGateway?.server) {
          this.shiftsGateway.server.to(shift._id.toString()).emit('shift-updated', { shiftLog: saved });
        }
      }
    }
  }
}
