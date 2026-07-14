import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';
import { MarginChangeRequest } from '../../schemas/margin-change-request.schema';
import { ShiftsGateway } from '../shifts/shifts.gateway';
import { AccessControlService } from '../auth/access-control.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class MarginChangeRequestsService {
  constructor(
    @InjectModel(MarginChangeRequest.name)
    private readonly requestModel: Model<MarginChangeRequest>,
    @Inject(forwardRef(() => ShiftsGateway))
    private readonly shiftsGateway: ShiftsGateway,
    private readonly accessControlService: AccessControlService,
    private readonly systemSettingsService: SystemSettingsService,
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

    const files = fs.readdirSync(targetDir)
      .filter(file => file.endsWith('.docx') && !file.startsWith('~$'))
      .map(file => {
        const filePath = path.join(targetDir, file);
        const stat = fs.statSync(filePath);
        return { file, filePath, mtime: stat.mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (files.length === 0) {
      throw new BadRequestException(`Không tìm thấy file quyết định ký quỹ (.docx) nào trong: ${targetDir}`);
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
}
