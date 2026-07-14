import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { MarginChangeRequest } from '../../schemas/margin-change-request.schema';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { AccessControlService } from '../auth/access-control.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { ShiftsService } from '../shifts/shifts.service';

@Injectable()
export class MarginChangeRequestsService {
  constructor(
    @InjectModel(MarginChangeRequest.name)
    private readonly requestModel: Model<MarginChangeRequest>,
    @Inject(forwardRef(() => ShiftsGateway))
    private readonly shiftsGateway: ShiftsGateway,
    private readonly accessControlService: AccessControlService,
    private readonly systemSettingsService: SystemSettingsService,
    @Inject(forwardRef(() => ShiftsService))
    private readonly shiftsService: ShiftsService,
  ) {}

  async createRequest(
    dto: {
      commodity: string;
      oldMargin: number;
      newMargin: number;
      effectiveSession: string;
      comments?: string;
      taskId?: string;
    },
    user: any,
  ): Promise<MarginChangeRequest> {
    const hasAccess = await this.accessControlService.canAccessFeature(user, 'MARGIN_CHANGE');
    if (!hasAccess) {
      throw new ForbiddenException('Tài khoản của bạn không thuộc khối QLGD để tạo yêu cầu ký quỹ.');
    }

    const request = new this.requestModel({
      commodity: dto.commodity,
      oldMargin: dto.oldMargin,
      newMargin: dto.newMargin,
      effectiveSession: dto.effectiveSession,
      status: 'PENDING_APPROVAL',
      createdBy: new Types.ObjectId(user.id || user._id),
      comments: dto.comments || null,
      taskId: dto.taskId || null,
    });

    const saved = await request.save();

    // Trigger dashboard updates via WebSocket
    if (this.shiftsGateway?.server) {
      this.shiftsGateway.server.emit('dashboard-updated', {
        type: 'MARGIN_REQUEST_CREATED',
        id: saved._id,
      });
    }

    return saved;
  }

  async listRequests(user: any, status?: string): Promise<MarginChangeRequest[]> {
    const hasAccess = await this.accessControlService.canAccessFeature(user, 'MARGIN_CHANGE');
    if (!hasAccess) {
      return [];
    }

    const filter = status ? { status } : {};
    return this.requestModel
      .find(filter)
      .populate('createdBy', 'fullName username role')
      .populate('approvedBy', 'fullName username role')
      .sort({ createdAt: -1 })
      .exec();
  }


  async approveRequest(
    id: string,
    checkerUser: any,
    comments?: string,
  ): Promise<MarginChangeRequest> {
    const request = await this.requestModel.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu thay đổi ký quỹ');
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Yêu cầu này đã được xử lý từ trước');
    }

    // Maker-Checker constraint: Maker cannot be Checker
    const makerIdStr = request.createdBy instanceof Types.ObjectId
      ? request.createdBy.toString()
      : (request.createdBy as any)._id?.toString() || (request.createdBy as any).id?.toString();

    const checkerIdStr = (checkerUser.id || checkerUser._id).toString();

    if (makerIdStr === checkerIdStr) {
      throw new BadRequestException(
        'Người tạo yêu cầu (Maker) không được phép tự phê duyệt bản ghi của mình.',
      );
    }

    // Role-based Checker authorization
    const checkerRoles = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'];
    if (!checkerRoles.includes(checkerUser.role)) {
      throw new ForbiddenException(
        'Tài khoản của bạn không có vai trò phê duyệt yêu cầu này (Chỉ dành cho Approver).',
      );
    }

    const hasAccess = await this.accessControlService.canAccessFeature(checkerUser, 'MARGIN_CHANGE');
    if (!hasAccess) {
      throw new ForbiddenException(
        'Tài khoản của bạn không thuộc khối QLGD để phê duyệt yêu cầu ký quỹ.',
      );
    }

    request.status = 'APPROVED';
    request.approvedBy = new Types.ObjectId(checkerUser.id || checkerUser._id);
    if (comments) {
      request.comments = comments;
    }
    const saved = await request.save();

    // Trigger dashboard updates via WebSocket
    if (this.shiftsGateway?.server) {
      this.shiftsGateway.server.emit('dashboard-updated', {
        type: 'MARGIN_REQUEST_APPROVED',
        id: saved._id,
      });
    }

    // Auto-update checklist task status
    await this.checkAndUpdateChecklistTask(checkerUser);

    return saved;
  }

  async rejectRequest(
    id: string,
    checkerUser: any,
    reason: string,
    comments?: string,
  ): Promise<MarginChangeRequest> {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('Vui lòng cung cấp lý do từ chối yêu cầu.');
    }

    const request = await this.requestModel.findById(id);
    if (!request) {
      throw new NotFoundException('Không tìm thấy yêu cầu thay đổi ký quỹ');
    }

    if (request.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Yêu cầu này đã được xử lý từ trước');
    }

    // Maker-Checker constraint
    const makerIdStr = request.createdBy instanceof Types.ObjectId
      ? request.createdBy.toString()
      : (request.createdBy as any)._id?.toString() || (request.createdBy as any).id?.toString();

    const checkerIdStr = (checkerUser.id || checkerUser._id).toString();

    if (makerIdStr === checkerIdStr) {
      throw new BadRequestException(
        'Người tạo yêu cầu (Maker) không được phép tự từ chối bản ghi của mình.',
      );
    }

    // Role-based Checker authorization
    const checkerRoles = ['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'];
    if (!checkerRoles.includes(checkerUser.role)) {
      throw new ForbiddenException(
        'Tài khoản của bạn không có vai trò từ chối yêu cầu này (Chỉ dành cho Approver).',
      );
    }

    const hasAccess = await this.accessControlService.canAccessFeature(checkerUser, 'MARGIN_CHANGE');
    if (!hasAccess) {
      throw new ForbiddenException(
        'Tài khoản của bạn không thuộc khối QLGD để từ chối yêu cầu ký quỹ.',
      );
    }

    request.status = 'REJECTED';
    request.approvedBy = new Types.ObjectId(checkerUser.id || checkerUser._id);
    request.rejectionReason = reason;
    if (comments) {
      request.comments = comments;
    }
    const saved = await request.save();

    // Trigger dashboard updates via WebSocket
    if (this.shiftsGateway?.server) {
      this.shiftsGateway.server.emit('dashboard-updated', {
        type: 'MARGIN_REQUEST_REJECTED',
        id: saved._id,
      });
    }

    // Auto-update checklist task status
    await this.checkAndUpdateChecklistTask(checkerUser);

    return saved;
  }

  async scanDecisionDocument(user: any): Promise<any> {
    const hasAccess = await this.accessControlService.canAccessFeature(user, 'MARGIN_CHANGE');
    if (!hasAccess) {
      throw new ForbiddenException('Tài khoản của bạn không thuộc khối QLGD để thực hiện quét quyết định.');
    }

    const folderPath = await this.systemSettingsService.getSetting(
      'margin_decision_folder_path',
      'M:\\Quanlygiaodich\\Tai lieu hoat dong\\Quyết định - Thông báo\\2. QĐ ban hành mức ký quỹ',
    );

    let targetDir = folderPath;
    if (!fs.existsSync(targetDir)) {
      // Local fallback in workspace
      const localFallback = path.resolve(__dirname, '../../../../Quanlygiaodich/Tai lieu hoat dong/Quyết định - Thông báo');
      if (fs.existsSync(localFallback)) {
        targetDir = localFallback;
      } else {
        throw new BadRequestException(`Thư mục quyết định ký quỹ không tồn tại: ${folderPath}`);
      }
    }

    // Format shiftDate to check against filenames
    let shiftDateStr = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
    let activeShift: any = null;
    try {
      const activeShifts = await this.shiftsService.getActiveShiftsByDepartment(user);
      activeShift = activeShifts.find(s => s.status === 'PENDING');
      if (activeShift) {
        shiftDateStr = activeShift.shiftDate;
      }
    } catch (err) {
      console.error('Error fetching active shifts for date matching:', err);
    }

    const yyyyMMdd_dot = shiftDateStr.replace(/-/g, '.'); // e.g. "2026.07.10"
    const yyyyMMdd_dash = shiftDateStr; // e.g. "2026-07-10"
    const parts = shiftDateStr.split('-');
    const ddMMmmyyyy_dot = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : ''; // e.g. "10.07.2026"

    const files = fs.readdirSync(targetDir)
      .filter(file => file.endsWith('.docx') && !file.startsWith('~$'))
      .filter(file => {
        return (yyyyMMdd_dot && file.includes(yyyyMMdd_dot)) || 
               (yyyyMMdd_dash && file.includes(yyyyMMdd_dash)) || 
               (ddMMmmyyyy_dot && file.includes(ddMMmmyyyy_dot));
      })
      .map(file => {
        const filePath = path.join(targetDir, file);
        const stat = fs.statSync(filePath);
        return { file, filePath, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      if (activeShift) {
        try {
          const task = activeShift.details.find((d: any) => d.taskId === 'ops_during_01');
          if (task && activeShift.status === 'PENDING') {
            const noteText = `[Tự động] Không tìm thấy quyết định thay đổi ký quỹ cho ngày ${shiftDateStr}. Mức ký quỹ giữ nguyên.`;
            await this.shiftsService.updateTaskStatus(
              activeShift._id.toString(),
              'ops_during_01',
              'PASSED',
              user,
              noteText
            );
          }
        } catch (shiftErr) {
          console.error('Error updating checklist task when no file found:', shiftErr);
        }
      }

      return {
        success: true,
        message: `Không tìm thấy file quyết định ký quỹ nào khớp với ngày ${shiftDateStr} trong thư mục. Mức ký quỹ giữ nguyên.`,
        fileName: null,
        effectiveSession: null,
        totalExtracted: 0,
        totalCreated: 0,
        requests: []
      };
    }

    const latestDocx = files[0].filePath;
    
    // Resolve python script path with fallback for src/dist directories
    let scriptPath = path.resolve(__dirname, '../../scripts/parse_margin_decision.py');
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(__dirname, '../../../src/scripts/parse_margin_decision.py');
    }
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(process.cwd(), 'src/scripts/parse_margin_decision.py');
    }
    if (!fs.existsSync(scriptPath)) {
      scriptPath = path.resolve(process.cwd(), 'backend/src/scripts/parse_margin_decision.py');
    }

    const commodityXlsxPath = path.resolve(
      __dirname,
      '../../../../it-tool-src/margin-checker/margin-checker/bin/Debug/Configuration/Commodity.xlsx',
    );

    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python', [scriptPath, latestDocx, commodityXlsxPath]);
      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data: any) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data: any) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', async (code: any) => {
        if (code !== 0) {
          return reject(new BadRequestException(`Lỗi phân tích file quyết định (Python code ${code}): ${stderrData}`));
        }

        try {
          const parsed = JSON.parse(stdoutData);
          if (!parsed.success) {
            return reject(new BadRequestException(parsed.error || 'Lỗi phân tích file quyết định từ Python.'));
          }

          const changes = parsed.changes || [];
          const createdRequests = [];

          for (const change of changes) {
            // Check for existing request
            const existing = await this.requestModel.findOne({
              commodity: change.commodity,
              newMargin: change.newMargin,
              status: { $in: ['PENDING_APPROVAL', 'APPROVED'] },
            });

            if (!existing) {
              const req = new this.requestModel({
                commodity: change.commodity,
                oldMargin: change.oldMargin,
                newMargin: change.newMargin,
                effectiveSession: change.effectiveSession,
                status: 'PENDING_APPROVAL',
                createdBy: new Types.ObjectId(user.id || user._id),
                comments: change.comments,
                taskId: 'ops_during_01',
              });
              const saved = await req.save();
              createdRequests.push(saved);
            }
          }

          // WebSocket update
          if (createdRequests.length > 0 && this.shiftsGateway?.server) {
            this.shiftsGateway.server.emit('dashboard-updated', {
              type: 'MARGIN_REQUEST_CREATED',
              count: createdRequests.length,
            });
          }

          // Update checklist task if there is an active shift log
          try {
            const activeShifts = await this.shiftsService.getActiveShiftsByDepartment(user);
            for (const shift of activeShifts) {
              const task = shift.details.find((d: any) => d.taskId === 'ops_during_01');
              if (task && shift.status === 'PENDING') {
                const summaryLines = [
                  `[Tự động] Đã quét quyết định: "${path.basename(latestDocx)}"`,
                  `Hiệu lực: ${parsed.effectiveSession}`,
                  `Phát hiện ${changes.length} mặt hàng thay đổi mức ký quỹ.`,
                  createdRequests.length > 0
                    ? `Đã tự động tạo mới ${createdRequests.length} yêu cầu thay đổi ký quỹ chờ duyệt.`
                    : `Không có yêu cầu thay đổi mới nào cần tạo.`
                ];
                const noteText = summaryLines.join('\n');
                const taskStatus = createdRequests.length > 0 ? 'WAITING' : 'PASSED';
                
                await this.shiftsService.updateTaskStatus(
                  shift._id.toString(),
                  'ops_during_01',
                  taskStatus,
                  user,
                  noteText
                );
                break; 
              }
            }
          } catch (shiftErr) {
            console.error('Error updating checklist task ops_during_01:', shiftErr);
          }

          resolve({
            success: true,
            fileName: path.basename(latestDocx),
            effectiveSession: parsed.effectiveSession,
            totalExtracted: changes.length,
            totalCreated: createdRequests.length,
            requests: createdRequests,
          });
        } catch (err) {
          reject(new BadRequestException(`Lỗi phân tích kết quả JSON: ${err.message}`));
        }
      });
    });
  }

  private async checkAndUpdateChecklistTask(user: any): Promise<void> {
    try {
      const pendingCount = await this.requestModel.countDocuments({
        taskId: 'ops_during_01',
        status: 'PENDING_APPROVAL',
      });

      if (pendingCount === 0) {
        const activeShifts = await this.shiftsService.getActiveShiftsByDepartment(user);
        for (const shift of activeShifts) {
          const task = shift.details.find((d: any) => d.taskId === 'ops_during_01');
          if (task && shift.status === 'PENDING') {
            const rejectedCount = await this.requestModel.countDocuments({
              taskId: 'ops_during_01',
              status: 'REJECTED',
            });

            const taskStatus = rejectedCount > 0 ? 'NEEDS_ATTENTION' : 'PASSED';
            
            const currentNote = task.resultNote || '';
            const appendNote = `\n[Tự động] Tất cả yêu cầu thay đổi ký quỹ đã được xử lý (Duyệt thành công, Từ chối: ${rejectedCount}).`;
            const noteText = currentNote.includes('[Tự động] Tất cả yêu cầu') ? currentNote : (currentNote + appendNote);

            await this.shiftsService.updateTaskStatus(
              shift._id.toString(),
              'ops_during_01',
              taskStatus,
              user,
              noteText
            );
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error in checkAndUpdateChecklistTask:', err);
    }
  }
}
