import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../schemas/role.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1')
export class RolesController {
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_ROLES')
  @Get('permissions')
  getSystemPermissions() {
    return [
      { code: 'VIEW_CHECKLIST', name: 'Xem checklist ca trực', category: 'Checklist ca trực' },
      { code: 'EDIT_CHECKLIST', name: 'Thực hiện checklist / Check tác vụ', category: 'Checklist ca trực' },
      { code: 'INITIALIZE_SHIFT', name: 'Khởi tạo ca trực mới', category: 'Checklist ca trực' },
      { code: 'CLOSE_SHIFT', name: 'Chốt ca trực (Hoàn thành ca)', category: 'Checklist ca trực' },
      { code: 'ACCESS_MARGIN_CHANGE', name: 'Đối chiếu Nano (Ký quỹ)', category: 'Đối chiếu & RPA' },
      { code: 'ACCESS_AUTO_SHIFT', name: 'Đối chiếu Khớp lệnh/Vị thế (Auto Shift)', category: 'Đối chiếu & RPA' },
      { code: 'ACCESS_HEALTH_CHECKS', name: 'Giám sát hạ tầng (Health Checks)', category: 'Vận hành IT' },
      { code: 'RESOLVE_INCIDENTS', name: 'Ghi nhận và xử lý sự cố', category: 'Sự cố & Ngoại lệ' },
      { code: 'MANAGE_TEMPLATES', name: 'Quản lý mẫu checklist (Templates)', category: 'Quản trị' },
      { code: 'MANAGE_USERS', name: 'Quản lý tài khoản người dùng', category: 'Quản trị' },
      { code: 'MANAGE_ROLES', name: 'Phân quyền & Vai trò (Roles)', category: 'Quản trị' },
      { code: 'MANAGE_CALENDAR', name: 'Quản lý lịch trực (Calendar)', category: 'Quản trị' },
    ];
  }

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_ROLES')
  @Get('roles')
  async getRoles() {
    return this.roleModel.find().sort({ code: 1 }).exec();
  }

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_ROLES')
  @Put('roles/:code/permissions')
  async updateRolePermissions(
    @Param('code') code: string,
    @Body('permissions') permissions: string[],
  ) {
    if (code === 'ADMIN') {
      throw new ForbiddenException(
        'Không thể điều chỉnh phân quyền của vai trò ADMIN.',
      );
    }
    const updated = await this.roleModel
      .findOneAndUpdate({ code }, { $set: { permissions } }, { new: true })
      .exec();
    return updated;
  }
}
