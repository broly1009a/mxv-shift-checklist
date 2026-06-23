import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { Department } from '../../schemas/department.schema';
import { AuditLog } from '../../schemas/audit-log.schema';
import { SystemLog } from '../../schemas/system-log.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(Department.name) private readonly departmentModel: Model<Department>,
    @InjectModel(AuditLog.name) private readonly auditLogModel: Model<AuditLog>,
    @InjectModel(SystemLog.name) private readonly systemLogModel: Model<SystemLog>,
  ) {}

  private async getScopeFilter(user: any): Promise<any> {
    if (!user) return { _id: null }; // Fail closed
    if (user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'CHAIRMAN') {
      return {};
    }
    if (user.role === 'DIVISION_DIRECTOR') {
      const divId = user.divisionId?._id || user.divisionId;
      if (!divId) return { _id: null };
      const depts = await this.departmentModel.find({ divisionId: new Types.ObjectId(divId.toString()) }).exec();
      const deptIds = depts.map(d => d._id);
      return { departmentId: { $in: deptIds } };
    }
    const deptId = user.departmentId?._id || user.departmentId;
    if (!deptId) return { _id: null };
    return { departmentId: new Types.ObjectId(deptId.toString()) };
  }

  async getSummary(dateStr: string, user: any): Promise<any> {
    this.validateDateStr(dateStr);
    const scopeFilter = await this.getScopeFilter(user);
    const query = { shiftDate: dateStr, ...scopeFilter };

    const logs = await this.shiftLogModel.find(query).exec();

    let totalTasks = 0;
    let completedTasks = 0;
    let botTasks = 0;
    let progressSum = 0;

    const pendingJobs = logs.filter(l => l.status === 'PENDING').length;
    const completedJobs = logs.filter(l => l.status === 'COMPLETED').length;

    logs.forEach(log => {
      progressSum += log.progressPercentage || 0;
      log.details.forEach(task => {
        totalTasks++;
        if (task.isChecked) completedTasks++;
        if (task.isBotCheckSnapshot) botTasks++;
      });
    });

    const completionPercentage = logs.length > 0 ? parseFloat((progressSum / logs.length).toFixed(2)) : 0.0;

    return {
      date: dateStr,
      totalJobs: logs.length,
      pendingJobs,
      completedJobs,
      totalTasks,
      completedTasks,
      pendingTasks: totalTasks - completedTasks,
      completionPercentage,
      failedTasks: 0, // Placeholder for Sprint 2A
      botTasks,
      manualTasks: totalTasks - botTasks,
    };
  }

  async getJobs(dateStr: string, user: any, status?: string): Promise<ShiftLog[]> {
    this.validateDateStr(dateStr);
    const scopeFilter = await this.getScopeFilter(user);
    const query: any = { shiftDate: dateStr, ...scopeFilter };
    if (status) {
      query.status = status;
    }

    return this.shiftLogModel
      .find(query)
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

  async getDepartmentStats(dateStr: string, user: any): Promise<any[]> {
    this.validateDateStr(dateStr);
    const scopeFilter = await this.getScopeFilter(user);
    const query = { shiftDate: dateStr, ...scopeFilter };

    const logs = await this.shiftLogModel
      .find(query)
      .populate('departmentId')
      .exec();

    const deptMap = new Map<string, any>();

    logs.forEach(log => {
      const dept = log.departmentId as any;
      if (!dept) return;
      const deptId = dept._id.toString();

      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          departmentCode: dept.code,
          departmentName: dept.name,
          totalJobs: 0,
          completedJobs: 0,
          totalTasks: 0,
          completedTasks: 0,
          progressSum: 0,
        });
      }

      const stats = deptMap.get(deptId);
      stats.totalJobs++;
      if (log.status === 'COMPLETED') stats.completedJobs++;
      stats.progressSum += log.progressPercentage || 0;
      log.details.forEach(task => {
        stats.totalTasks++;
        if (task.isChecked) stats.completedTasks++;
      });
    });

    return Array.from(deptMap.values()).map(stats => {
      const { progressSum, ...rest } = stats;
      return {
        ...rest,
        completionPercentage: stats.totalJobs > 0 ? parseFloat((progressSum / stats.totalJobs).toFixed(2)) : 0.0,
      };
    });
  }

  async getShiftSlotStats(dateStr: string, user: any): Promise<any[]> {
    this.validateDateStr(dateStr);
    const scopeFilter = await this.getScopeFilter(user);
    const query = { shiftDate: dateStr, ...scopeFilter };

    const logs = await this.shiftLogModel
      .find(query)
      .populate('shiftSlotId')
      .exec();

    const slotMap = new Map<string, any>();

    logs.forEach(log => {
      const slot = log.shiftSlotId as any;
      if (!slot) return;
      const slotId = slot._id.toString();

      if (!slotMap.has(slotId)) {
        slotMap.set(slotId, {
          shiftSlotCode: slot.code,
          shiftSlotName: slot.name,
          totalJobs: 0,
          completedJobs: 0,
          totalTasks: 0,
          completedTasks: 0,
          progressSum: 0,
        });
      }

      const stats = slotMap.get(slotId);
      stats.totalJobs++;
      if (log.status === 'COMPLETED') stats.completedJobs++;
      stats.progressSum += log.progressPercentage || 0;
      log.details.forEach(task => {
        stats.totalTasks++;
        if (task.isChecked) stats.completedTasks++;
      });
    });

    return Array.from(slotMap.values()).map(stats => {
      const { progressSum, ...rest } = stats;
      return {
        ...rest,
        completionPercentage: stats.totalJobs > 0 ? parseFloat((progressSum / stats.totalJobs).toFixed(2)) : 0.0,
      };
    });
  }

  async getActivity(dateStr: string, user: any, limit = 20): Promise<any[]> {
    this.validateDateStr(dateStr);
    const scopeFilter = await this.getScopeFilter(user);

    // Calculate date range in UTC/Saigon
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    // 1. Query Audit Logs on shifts that match the scoped filter and are active on that date
    const targetShiftQuery = { shiftDate: dateStr, ...scopeFilter };
    const matchingShifts = await this.shiftLogModel.find(targetShiftQuery).select('_id').exec();
    const matchingShiftIds = matchingShifts.map(s => s._id);

    const auditQuery = {
      shiftLogId: { $in: matchingShiftIds },
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    };

    const auditLogs = await this.auditLogModel
      .find(auditQuery)
      .populate('userId', 'fullName username')
      .populate({
        path: 'shiftLogId',
        populate: { path: 'departmentId' },
      })
      .exec();

    // 2. Query System Logs on that date
    const systemQuery: any = {
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    };
    // For non-admin, filter system logs by department scope
    if (scopeFilter.departmentId) {
      systemQuery.departmentId = scopeFilter.departmentId;
    } else if (scopeFilter.departmentId?.$in) {
      systemQuery.departmentId = { $in: scopeFilter.departmentId.$in };
    }

    const systemLogs = await this.systemLogModel
      .find(systemQuery)
      .populate('actorUserId', 'fullName username')
      .populate('departmentId')
      .exec();

    // 3. Map and merge
    const activities: any[] = [];

    auditLogs.forEach(log => {
      const shift = log.shiftLogId as any;
      const dept = shift?.departmentId as any;
      let actionMsg = '';
      if (log.action === 'CHECK') actionMsg = 'tích hoàn thành';
      else if (log.action === 'UNCHECK') actionMsg = 'bỏ tích';
      else actionMsg = 'cập nhật ghi chú';

      activities.push({
        id: log._id.toString(),
        type: 'TASK_UPDATED',
        message: `Tác vụ "${log.taskName}" được ${actionMsg}`,
        actorName: log.userId ? (log.userId as any).fullName : 'Hệ thống',
        departmentCode: dept ? dept.code : 'UNKNOWN',
        jobId: log.shiftLogId.toString(),
        createdAt: log.createdAt,
      });
    });

    systemLogs.forEach(log => {
      const dept = log.departmentId as any;
      activities.push({
        id: log._id.toString(),
        type: log.eventType === 'JOB_GENERATED' ? 'JOB_GENERATED' : 'SYSTEM_EVENT',
        message: log.message,
        actorName: log.actorUserId ? (log.actorUserId as any).fullName : 'System',
        departmentCode: dept ? dept.code : 'SYSTEM',
        jobId: log.jobId ? log.jobId.toString() : null,
        createdAt: log.createdAt,
      });
    });

    // Sort by createdAt descending and slice
    return activities
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  private validateDateStr(dateStr: string) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateStr || !dateRegex.test(dateStr)) {
      throw new BadRequestException('Định dạng ngày không hợp lệ. Vui lòng sử dụng YYYY-MM-DD');
    }
  }
}
