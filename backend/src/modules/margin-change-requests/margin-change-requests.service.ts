import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MarginChangeRequest } from '../../schemas/margin-change-request.schema';
import { ShiftsGateway } from '../shifts/shifts.gateway';

@Injectable()
export class MarginChangeRequestsService {
  constructor(
    @InjectModel(MarginChangeRequest.name)
    private readonly requestModel: Model<MarginChangeRequest>,
    @Inject(forwardRef(() => ShiftsGateway))
    private readonly shiftsGateway: ShiftsGateway,
  ) {}

  async createRequest(
    dto: {
      commodity: string;
      oldMargin: number;
      newMargin: number;
      effectiveSession: string;
      comments?: string;
    },
    user: any,
  ): Promise<MarginChangeRequest> {
    const request = new this.requestModel({
      commodity: dto.commodity,
      oldMargin: dto.oldMargin,
      newMargin: dto.newMargin,
      effectiveSession: dto.effectiveSession,
      status: 'PENDING_APPROVAL',
      createdBy: new Types.ObjectId(user.id || user._id),
      comments: dto.comments || null,
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

  async listRequests(status?: string): Promise<MarginChangeRequest[]> {
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
}
