import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Incident } from '../../schemas/incident.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { AuditLog } from '../../schemas/audit-log.schema';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccessControlService } from '../auth/access-control.service';
import * as ExcelJS from 'exceljs';

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
    actorUserId?: string,
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

    // Fetch shift log to get taskName
    const shiftLog = await this.shiftLogModel.findById(shiftLogId);
    const taskDetail = shiftLog?.details.find((t) => t.taskId === taskId);
    const taskName = taskDetail ? taskDetail.taskNameSnapshot : taskId;

    // Log audit event
    const audit = new this.auditLogModel({
      shiftLogId: new Types.ObjectId(shiftLogId),
      taskId,
      taskName,
      userId: new Types.ObjectId(actorUserId || '000000000000000000000000'),
      action: 'INCIDENT_CREATED',
      details: `Tự động tạo sự cố [${code}] cho tác vụ "${taskName}".`,
    });
    await audit.save();

    // Emit realtime event
    if (this.shiftsGateway?.server) {
      this.shiftsGateway.server
        .to(shiftLogId)
        .emit('incident-updated', { incident: saved, auditLog: audit });
      this.shiftsGateway.server.emit('dashboard-updated', {
        type: 'INCIDENT_CREATED',
        shiftLogId,
      });
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
      this.accessControlService.validateScope(
        user,
        shift.departmentId || null,
        shift.divisionId || null,
      );
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

    const taskDetail = shift?.details.find((t) => t.taskId === incident.taskId);
    const taskName = taskDetail ? taskDetail.taskNameSnapshot : incident.taskId;

    // Log audit event
    const audit = new this.auditLogModel({
      shiftLogId: incident.shiftLogId,
      taskId: incident.taskId,
      taskName,
      userId: new Types.ObjectId(user.id || user._id),
      action: 'INCIDENT_RESOLVED',
      details: `Giải quyết sự cố [${incident.code}]. Nguyên nhân: ${resolveDto.rootCause}. Xử lý: ${resolveDto.remediationAction}`,
    });
    await audit.save();

    // Emit realtime event
    if (this.shiftsGateway?.server) {
      const room = incident.shiftLogId.toString();
      this.shiftsGateway.server
        .to(room)
        .emit('incident-updated', { incident: saved, auditLog: audit });
      this.shiftsGateway.server.emit('dashboard-updated', {
        type: 'INCIDENT_RESOLVED',
        shiftLogId: incident.shiftLogId,
      });
    }

    return saved;
  }

  async getIncidentsByShift(
    shiftLogId: string,
    user: any,
  ): Promise<Incident[]> {
    const shift = await this.shiftLogModel.findById(shiftLogId);
    if (!shift) {
      throw new NotFoundException('Không tìm thấy ca trực');
    }
    this.accessControlService.validateScope(
      user,
      shift.departmentId || null,
      shift.divisionId || null,
    );

    return this.incidentModel
      .find({ shiftLogId: new Types.ObjectId(shiftLogId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getPendingIncidents(user: any): Promise<Incident[]> {
    const scopeFilter = await this.accessControlService.getScopeFilter(user);
    const filter: any = { status: 'PENDING' };

    if (Object.keys(scopeFilter).length > 0) {
      const matchingShifts = await this.shiftLogModel
        .find(scopeFilter)
        .select('_id')
        .exec();
      const shiftIds = matchingShifts.map((s) => s._id);
      filter.shiftLogId = { $in: shiftIds };
    }

    return this.incidentModel
      .find(filter)
      .populate({
        path: 'shiftLogId',
        populate: { path: 'templateId' },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  // Cron job running every 1 minute to check SLA breaches
  @Cron(CronExpression.EVERY_MINUTE)
  async checkSlaBreaches(): Promise<void> {
    const activeShifts = await this.shiftLogModel
      .find({ status: 'PENDING' })
      .exec();
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
        const deadlineDate = new Date(
          Date.UTC(year, month - 1, day, hours - 7, minutes, 0),
        );

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
          this.shiftsGateway.server
            .to(shift._id.toString())
            .emit('shift-updated', { shiftLog: saved });
        }
      }
    }
  }

  async exportIncidentReport(
    incidentId: string,
    user: any,
    res: any,
  ): Promise<void> {
    const incident = await this.incidentModel
      .findById(incidentId)
      .populate({
        path: 'shiftLogId',
        populate: [
          { path: 'shiftSlotId' },
          { path: 'departmentId' },
          { path: 'userId' },
        ],
      })
      .populate('resolvedBy')
      .exec();

    if (!incident) {
      throw new NotFoundException('Không tìm thấy sự cố');
    }

    const shift = incident.shiftLogId as any;
    if (shift) {
      this.accessControlService.validateScope(
        user,
        shift.departmentId?._id || shift.departmentId || null,
        shift.divisionId?._id || shift.divisionId || null,
      );
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo sự cố 01-QT-TVH');

    worksheet.views = [{ showGridLines: true }];

    worksheet.columns = [
      { key: 'A', width: 8 },
      { key: 'B', width: 22 },
      { key: 'C', width: 18 },
      { key: 'D', width: 50 },
      { key: 'E', width: 22 },
    ];

    // Header standard
    worksheet.mergeCells('A1:C1');
    worksheet.getCell('A1').value = 'SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)';
    worksheet.getCell('A1').font = { name: 'Arial', size: 10, bold: true };

    worksheet.mergeCells('A2:C2');
    worksheet.getCell('A2').value = 'BỘ PHẬN VẬN HÀNH GIAO DỊCH';
    worksheet.getCell('A2').font = {
      name: 'Arial',
      size: 9,
      bold: true,
      italic: true,
    };

    worksheet.mergeCells('D1:E1');
    worksheet.getCell('D1').value = 'Mẫu số: 01/QT/TVH';
    worksheet.getCell('D1').font = { name: 'Arial', size: 10, bold: true };
    worksheet.getCell('D1').alignment = { horizontal: 'right' };

    // Title
    worksheet.mergeCells('A4:E4');
    const titleCell = worksheet.getCell('A4');
    titleCell.value = 'BÁO CÁO GHI NHẬN SỰ CỐ VẬN HÀNH GIAO DỊCH';
    titleCell.font = {
      name: 'Arial',
      size: 14,
      bold: true,
      color: { argb: 'FF1F4E78' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(4).height = 30;

    worksheet.mergeCells('A5:E5');
    const dateCell = worksheet.getCell('A5');
    dateCell.value = `Ngày lập báo cáo: ${new Date().toLocaleDateString('vi-VN')}`;
    dateCell.font = { name: 'Arial', size: 10, italic: true };
    dateCell.alignment = { horizontal: 'center' };

    const borderStyle = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    } as any;

    // Helper for key-value info block
    const writeInfoCell = (
      r: number,
      colKey: string,
      val: string,
      isLabel: boolean,
    ) => {
      const cell = worksheet.getCell(`${colKey}${r}`);
      cell.value = val;
      cell.border = borderStyle;
      if (isLabel) {
        cell.font = { name: 'Arial', size: 10, bold: true };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF2F2F2' },
        };
      } else {
        cell.font = { name: 'Arial', size: 10 };
      }
    };

    // Rows 7 - 12 (Metadata)
    const metadata = [
      {
        l1: 'Mã sự cố:',
        v1: incident.code,
        l2: 'Mức độ:',
        v2: incident.severity,
      },
      {
        l1: 'Trạng thái:',
        v1: incident.status === 'RESOLVED' ? 'Đã khắc phục' : 'Đang xử lý',
        l2: 'Ca trực:',
        v2: shift?.shiftSlotId?.name || '-',
      },
      {
        l1: 'Ngày trực:',
        v1: shift?.shiftDate || '-',
        l2: 'Người trực chính:',
        v2: shift?.userId?.fullName || '-',
      },
      {
        l1: 'Phòng ban:',
        v1: shift?.departmentId?.name || 'Vận Hành Nghiệp Vụ',
        l2: 'Tác vụ ảnh hưởng:',
        v2: (() => {
          const detail = shift?.details?.find(
            (d: any) => d.taskId === incident.taskId,
          );
          return detail ? detail.taskNameSnapshot : incident.taskId;
        })(),
      },
      {
        l1: 'Thời điểm phát hiện:',
        v1: new Date(incident.detectedAt).toLocaleString('vi-VN'),
        l2: 'Thời điểm khắc phục:',
        v2: incident.resolvedAt
          ? new Date(incident.resolvedAt).toLocaleString('vi-VN')
          : '-',
      },
      {
        l1: 'Người khắc phục:',
        v1: (incident.resolvedBy as any)?.fullName || '-',
        l2: '',
        v2: '',
      },
    ];

    let rNum = 7;
    for (const item of metadata) {
      worksheet.getRow(rNum).height = 20;
      writeInfoCell(rNum, 'A', item.l1, true);
      writeInfoCell(rNum, 'B', item.v1, false);
      worksheet.mergeCells(`B${rNum}:C${rNum}`);
      worksheet.getCell(`C${rNum}`).border = borderStyle;

      if (item.l2) {
        writeInfoCell(rNum, 'D', item.l2, true);
        writeInfoCell(rNum, 'E', item.v2, false);
      } else {
        worksheet.mergeCells(`D${rNum}:E${rNum}`);
        worksheet.getCell(`D${rNum}`).border = borderStyle;
        worksheet.getCell(`E${rNum}`).border = borderStyle;
      }
      rNum++;
    }

    // Detail section header
    rNum++; // 14
    worksheet.mergeCells(`A${rNum}:E${rNum}`);
    const sec1Header = worksheet.getCell(`A${rNum}`);
    sec1Header.value = 'THÔNG TIN CHI TIẾT NGUYÊN NHÂN & BIỆN PHÁP KHẮC PHỤC';
    sec1Header.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sec1Header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    sec1Header.alignment = { vertical: 'middle', indent: 1 };
    worksheet.getRow(rNum).height = 24;

    const writeLongField = (row: number, label: string, val: string) => {
      worksheet.getRow(row).height = 24;
      writeInfoCell(row, 'A', label, true);
      worksheet.mergeCells(`B${row}:E${row}`);
      const valCell = worksheet.getCell(`B${row}`);
      valCell.value = val;
      valCell.font = { name: 'Arial', size: 10 };
      valCell.alignment = { wrapText: true, vertical: 'middle' };
      for (let c = 2; c <= 5; c++) {
        worksheet.getCell(row, c).border = borderStyle;
      }
    };

    rNum++; // 15
    let rootCauseText = 'Chưa xác định';
    if (incident.rootCause) {
      switch (incident.rootCause) {
        case 'MISSING_CONFIGURATION':
          rootCauseText = 'Thiếu cấu hình';
          break;
        case 'MESSAGE_SYNC_LOSS':
          rootCauseText = 'Mất đồng bộ tin nhắn';
          break;
        case 'SOFTWARE_BUG':
          rootCauseText = 'Lỗi phần mềm';
          break;
        case 'NETWORK_DISRUPTION':
          rootCauseText = 'Sự cố đường truyền/mạng';
          break;
        case 'DATA_FILE_ERROR':
          rootCauseText = 'Lỗi tệp tin / Dữ liệu';
          break;
        case 'THIRD_PARTY_ERROR':
          rootCauseText = 'Sự cố hệ thống liên kết / Bên thứ 3';
          break;
        case 'OTHER':
          rootCauseText = 'Nguyên nhân khác';
          break;
        default:
          rootCauseText = incident.rootCause;
          break;
      }
    }
    writeLongField(rNum, 'Nguyên nhân chính:', rootCauseText);
    rNum++; // 16
    writeLongField(rNum, 'Yêu cầu SOP:', incident.requiredAction || '-');
    rNum++; // 17
    writeLongField(
      rNum,
      'Biện pháp khắc phục:',
      incident.remediationAction || 'Chưa có hành động cụ thể',
    );
    rNum++; // 18
    writeLongField(
      rNum,
      'Tài khoản ảnh hưởng:',
      incident.affectedAccounts && incident.affectedAccounts.length > 0
        ? incident.affectedAccounts.join(', ')
        : 'Không có / Không ảnh hưởng',
    );

    // Timeline section header
    rNum += 2; // 20
    worksheet.mergeCells(`A${rNum}:E${rNum}`);
    const sec2Header = worksheet.getCell(`A${rNum}`);
    sec2Header.value = 'TIẾN TRÌNH DIỄN BIẾN SỰ CỐ (TIMELINE)';
    sec2Header.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    sec2Header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };
    sec2Header.alignment = { vertical: 'middle', indent: 1 };
    worksheet.getRow(rNum).height = 24;

    // Timeline headers
    rNum++; // 21
    const tlHeaders = [
      'STT',
      'Thời gian',
      'Trạng thái',
      'Nội dung chi tiết (Comment)',
      'Người thực hiện',
    ];
    tlHeaders.forEach((h, idx) => {
      const cell = worksheet.getCell(rNum, idx + 1);
      cell.value = h;
      cell.font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: 'FF1F4E78' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE9EEF4' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = borderStyle;
    });
    worksheet.getRow(rNum).height = 22;

    // Timeline rows
    rNum++; // 22
    (incident.timeline || []).forEach((event, idx) => {
      const row = worksheet.getRow(rNum);
      row.height = 24;

      const c1 = worksheet.getCell(`A${rNum}`);
      c1.value = idx + 1;
      c1.alignment = { horizontal: 'center', vertical: 'middle' };

      const c2 = worksheet.getCell(`B${rNum}`);
      c2.value = new Date(event.timestamp).toLocaleString('vi-VN');
      c2.alignment = { horizontal: 'center', vertical: 'middle' };

      const c3 = worksheet.getCell(`C${rNum}`);
      c3.value = event.status;
      c3.alignment = { horizontal: 'center', vertical: 'middle' };

      const c4 = worksheet.getCell(`D${rNum}`);
      c4.value = event.comment;
      c4.alignment = { wrapText: true, vertical: 'middle' };

      const c5 = worksheet.getCell(`E${rNum}`);
      c5.value = event.actor;
      c5.alignment = { horizontal: 'center', vertical: 'middle' };

      for (let col = 1; col <= 5; col++) {
        const cell = worksheet.getCell(rNum, col);
        cell.font = { name: 'Arial', size: 9 };
        cell.border = borderStyle;
      }
      rNum++;
    });

    // Signatures
    rNum += 2;
    worksheet.mergeCells(`A${rNum}:B${rNum}`);
    const sig1 = worksheet.getCell(`A${rNum}`);
    sig1.value = 'NGƯỜI LẬP BÁO CÁO';
    sig1.font = { name: 'Arial', size: 10, bold: true };
    sig1.alignment = { horizontal: 'center' };

    worksheet.mergeCells(`D${rNum}:E${rNum}`);
    const sig2 = worksheet.getCell(`D${rNum}`);
    sig2.value = 'TRƯỞNG CA TRỰC';
    sig2.font = { name: 'Arial', size: 10, bold: true };
    sig2.alignment = { horizontal: 'center' };

    rNum++;
    worksheet.mergeCells(`A${rNum}:B${rNum}`);
    const subSig1 = worksheet.getCell(`A${rNum}`);
    subSig1.value = '(Ký, ghi rõ họ tên)';
    subSig1.font = { name: 'Arial', size: 9, italic: true };
    subSig1.alignment = { horizontal: 'center' };

    worksheet.mergeCells(`D${rNum}:E${rNum}`);
    const subSig2 = worksheet.getCell(`D${rNum}`);
    subSig2.value = '(Ký, duyệt báo cáo)';
    subSig2.font = { name: 'Arial', size: 9, italic: true };
    subSig2.alignment = { horizontal: 'center' };

    rNum += 4;
    worksheet.mergeCells(`A${rNum}:B${rNum}`);
    const name1 = worksheet.getCell(`A${rNum}`);
    name1.value = user.fullName || user.username || '';
    name1.font = { name: 'Arial', size: 10, bold: true };
    name1.alignment = { horizontal: 'center' };

    worksheet.mergeCells(`D${rNum}:E${rNum}`);
    const name2 = worksheet.getCell(`D${rNum}`);
    name2.value = '......................................................';
    name2.font = { name: 'Arial', size: 10 };
    name2.alignment = { horizontal: 'center' };

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Bao_cao_su_co_01_QT_TVH_${incident.code}.xlsx"`,
    });

    await workbook.xlsx.write(res);
    res.end();
  }

  async searchIncidents(query: string, user: any): Promise<Incident[]> {
    const scopeFilter = await this.accessControlService.getScopeFilter(user);
    const regex = new RegExp(query, 'i');
    const filter: any = {
      $or: [
        { code: { $regex: regex } },
        { taskId: { $regex: regex } },
        { requiredAction: { $regex: regex } },
        { rootCause: { $regex: regex } },
        { remediationAction: { $regex: regex } },
        { affectedAccounts: { $in: [regex] } },
      ],
    };

    if (Object.keys(scopeFilter).length > 0) {
      const matchingShifts = await this.shiftLogModel
        .find(scopeFilter)
        .select('_id')
        .exec();
      const shiftIds = matchingShifts.map((s) => s._id);
      filter.shiftLogId = { $in: shiftIds };
    }

    return this.incidentModel
      .find(filter)
      .populate({
        path: 'shiftLogId',
        populate: { path: 'templateId' },
      })
      .sort({ createdAt: -1 })
      .limit(10)
      .exec();
  }
}
