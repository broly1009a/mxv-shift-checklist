import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { Department } from '../../schemas/department.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessControlService } from '../auth/access-control.service';

import { ShiftLog } from '../../schemas/shift-log.schema';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/templates')
export class TemplatesController {
  constructor(
    @InjectModel(ChecklistTemplate.name)
    private readonly templateModel: Model<ChecklistTemplate>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(ShiftLog.name)
    private readonly shiftLogModel: Model<ShiftLog>,
    private readonly accessControlService: AccessControlService,
  ) {}

  @Get()
  async findAll(@Request() req: any, @Query('departmentId') departmentId?: string) {
    const scopeFilter = await this.accessControlService.getScopeFilter(req.user);
    const filter: any = { ...scopeFilter };

    if (departmentId) {
      const targetDeptId = new Types.ObjectId(departmentId);
      // If there's already a scopeFilter restricting departmentIds
      if (filter.departmentId) {
        if (filter.departmentId.$in) {
          const hasAccess = filter.departmentId.$in.some((id: any) => id.toString() === departmentId);
          if (!hasAccess) {
            return []; // No access to this department
          }
        } else if (filter.departmentId.toString() !== departmentId) {
          return []; // No access to this department
        }
      }
      filter.departmentId = targetDeptId;
    }

    return this.templateModel
      .find(filter)
      .populate('departmentId')
      .populate('shiftSlotId')
      .exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD')
  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const deptId = body.departmentId;
    if (!deptId) {
      throw new NotFoundException('Vui lòng chọn phòng ban');
    }
    const dept = await this.departmentModel.findById(deptId).exec();
    if (!dept) {
      throw new NotFoundException('Phòng ban không tồn tại');
    }

    this.accessControlService.validateScope(req.user, dept._id, (dept.divisionId || null) as any);

    const newTpl = new this.templateModel(body);
    const saved = await newTpl.save();
    return this.templateModel
      .findById(saved._id)
      .populate('departmentId')
      .populate('shiftSlotId')
      .exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD')
  @Put(':id')
  async update(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const existing = await this.templateModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Mẫu checklist không tồn tại');
    }

    const oldDept = await this.departmentModel.findById(existing.departmentId).exec();
    this.accessControlService.validateScope(req.user, existing.departmentId, oldDept?.divisionId || null);

    if (body.departmentId && body.departmentId.toString() !== existing.departmentId.toString()) {
      const newDept = await this.departmentModel.findById(body.departmentId).exec();
      if (!newDept) {
        throw new NotFoundException('Phòng ban mới không tồn tại');
      }
      this.accessControlService.validateScope(req.user, newDept._id, (newDept.divisionId || null) as any);
    }

    return this.templateModel
      .findByIdAndUpdate(id, body, { new: true })
      .populate('departmentId')
      .populate('shiftSlotId')
      .exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD')
  @Delete(':id')
  async remove(@Request() req: any, @Param('id') id: string) {
    const existing = await this.templateModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Mẫu checklist không tồn tại');
    }

    const dept = await this.departmentModel.findById(existing.departmentId).exec();
    this.accessControlService.validateScope(req.user, existing.departmentId, dept?.divisionId || null);

    const hasLog = await this.shiftLogModel.findOne({ templateId: new Types.ObjectId(id) }).exec();
    if (hasLog) {
      const updated = await this.templateModel
        .findByIdAndUpdate(id, { isActive: false }, { new: true })
        .exec();
      return { deleted: false, statusChanged: true, data: updated };
    }

    const deleted = await this.templateModel.findByIdAndDelete(id).exec();
    return { deleted: true, data: deleted };
  }
}

