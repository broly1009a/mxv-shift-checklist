import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department } from '../../schemas/department.schema';
import { ShiftLog } from '../../schemas/shift-log.schema';
import { User } from '../../schemas/user.schema';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(ShiftLog.name)
    private readonly shiftLogModel: Model<ShiftLog>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
  ) {}

  @Get()
  async findAll() {
    return this.departmentModel.find().sort({ name: 1 }).exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any) {
    const newDept = new this.departmentModel(body);
    return newDept.save();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.departmentModel
      .findByIdAndUpdate(id, body, { new: true })
      .exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    const [hasLog, hasUser, hasTemplate] = await Promise.all([
      this.shiftLogModel.findOne({ departmentId: new Types.ObjectId(id) }).exec(),
      this.userModel.findOne({ departmentId: new Types.ObjectId(id) }).exec(),
      this.templateModel.findOne({ departmentId: new Types.ObjectId(id) }).exec(),
    ]);

    if (hasLog || hasUser || hasTemplate) {
      const updated = await this.departmentModel
        .findByIdAndUpdate(id, { isActive: false }, { new: true })
        .exec();
      return { deleted: false, statusChanged: true, data: updated };
    }

    const deleted = await this.departmentModel.findByIdAndDelete(id).exec();
    return { deleted: true, data: deleted };
  }
}
