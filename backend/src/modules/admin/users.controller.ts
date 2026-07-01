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
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/users')
export class UsersController {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(ShiftLog.name) private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(Incident.name) private readonly incidentModel: Model<Incident>,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD')
  async findAll(
    @Query('page') pageNum?: string,
    @Query('limit') limitNum?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('departmentId') departmentId?: string,
    @Query('divisionId') divisionId?: string,
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

    if (divisionId) {
      filter.divisionId = divisionId;
    }

    if (isActive !== undefined && isActive !== '') {
      filter.isActive = isActive === 'true';
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .populate('departmentId')
        .populate('divisionId')
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
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async create(@Body() body: any) {
    const {
      username,
      password,
      fullName,
      departmentId,
      divisionId,
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
      if (role === 'DIVISION_DIRECTOR' && !divisionId) {
        throw new BadRequestException(
          'Tài khoản Giám đốc Khối đã kích hoạt bắt buộc phải được gán Khối quản lý',
        );
      }
    }

    const lowerUsername = username.toLowerCase();
    const existing = await this.userModel.findOne({ username: lowerUsername }).exec();
    if (existing) {
      throw new ConflictException('Tài khoản đã tồn tại');
    }
    const passwordHash = await bcrypt.hash(password || 'Staff@MXV123', 10);
    const newUser = new this.userModel({
      username: lowerUsername,
      passwordHash,
      fullName,
      departmentId: departmentId || null,
      divisionId: divisionId || null,
      role,
      isActive: isActiveVal,
    });
    return newUser.save();
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() body: any) {
    const { password, departmentId, divisionId, ...rest } = body;
    const isActiveVal = body.isActive;
    const role = body.role;

    if (isActiveVal) {
      if ((role === 'STAFF' || role === 'DEPARTMENT_HEAD') && !departmentId) {
        throw new BadRequestException(
          'Tài khoản Nhân viên / Trưởng bộ phận đã kích hoạt bắt buộc phải được gán Phòng ban',
        );
      }
      if (role === 'DIVISION_DIRECTOR' && !divisionId) {
        throw new BadRequestException(
          'Tài khoản Giám đốc Khối đã kích hoạt bắt buộc phải được gán Khối quản lý',
        );
      }
    }

    const updateData: any = {
      ...rest,
      departmentId: departmentId || null,
      divisionId: divisionId || null,
    };
    if (updateData.username) {
      updateData.username = updateData.username.toLowerCase();
    }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }
    return this.userModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('departmentId')
      .populate('divisionId')
      .exec();
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    const [hasLog, hasIncident] = await Promise.all([
      this.shiftLogModel.findOne({
        $or: [
          { userId: new Types.ObjectId(id) },
          { closedBy: new Types.ObjectId(id) },
        ],
      }).exec(),
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
