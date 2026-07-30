import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from '../../schemas/user.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { Incident } from '../../schemas/incident.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(Incident.name) private readonly incidentModel: Model<Incident>,
  ) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @Permissions('VIEW_CHECKLIST', 'MANAGE_USERS')
  async findAll(
    @Query('page') pageNum?: string,
    @Query('limit') limitNum?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('departmentId') departmentId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const page = parseInt(pageNum || '1', 10);
    const limit = parseInt(limitNum || '10', 10);
    const skip = (page - 1) * limit;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { fullName: { $regex: search, $options: 'i' } },
      ];
    }

    if (role) {
      filter.role = role;
    }

    if (departmentId) {
      filter.departmentId = departmentId;
    }

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate({
          path: 'departmentId',
          populate: { path: 'parentDepartmentId' },
        })
        .sort({ username: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
    };
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  async create(@Body() body: any) {
    const {
      username,
      password,
      fullName,
      title,
      departmentId,
      role,
      isActive,
    } = body;
    const isActiveVal = isActive !== undefined ? isActive : true;

    if (isActiveVal) {
      if ((role === 'STAFF' || role === 'DEPARTMENT_HEAD') && !departmentId) {
        throw new BadRequestException(
          'Tài khoản Nhân viên / Trưởng bộ phận đã kích hoạt bắt buộc phải được gán Phòng ban',
        );
      }
    }

    const lowerUsername = username.toLowerCase();
    const existing = await this.userModel
      .findOne({ username: lowerUsername })
      .exec();
    if (existing) {
      throw new ConflictException('Tài khoản đã tồn tại');
    }
    const passwordHash = await bcrypt.hash(password || 'Staff@MXV123', 10);
    const newUser = new this.userModel({
      username: lowerUsername,
      passwordHash,
      fullName,
      title: title || '',
      departmentId: departmentId || null,
      role,
      isActive: isActiveVal,
    });
    return newUser.save();
  }

  @Put(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  async update(@Param('id') id: string, @Body() body: any) {
    const { password, departmentId, ...rest } = body;
    const isActiveVal = body.isActive;
    const role = body.role;

    if (isActiveVal) {
      if ((role === 'STAFF' || role === 'DEPARTMENT_HEAD') && !departmentId) {
        throw new BadRequestException(
          'Tài khoản Nhân viên / Trưởng bộ phận đã kích hoạt bắt buộc phải được gán Phòng ban',
        );
      }
    }

    const updateData: any = {
      ...rest,
      departmentId: departmentId || null,
    };
    if (updateData.username) {
      updateData.username = updateData.username.toLowerCase();
    }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate({
        path: 'departmentId',
        populate: { path: 'parentDepartmentId' },
      })
      .exec();
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_USERS')
  async remove(@Param('id') id: string) {
    const [hasLog, hasIncident] = await Promise.all([
      this.shiftLogModel
        .findOne({
          $or: [
            { userId: new Types.ObjectId(id) },
            { closedBy: new Types.ObjectId(id) },
          ],
        })
        .exec(),
      this.incidentModel.findOne({ resolvedBy: new Types.ObjectId(id) }).exec(),
    ]);

    if (hasLog || hasIncident) {
      const updated = await this.userModel
        .findByIdAndUpdate(id, { isActive: false }, { new: true })
        .exec();
      return { deleted: false, statusChanged: true, data: updated };
    }

    const deleted = await this.userModel.findByIdAndDelete(id).exec();
    return { deleted: true, data: deleted };
  }
}
