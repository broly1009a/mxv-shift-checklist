import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChecklistTemplate } from '../../schemas/template.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/templates')
export class TemplatesController {
  constructor(
    @InjectModel(ChecklistTemplate.name) private readonly templateModel: Model<ChecklistTemplate>,
  ) {}

  @Get()
  async findAll(@Query('departmentId') departmentId?: string) {
    const filter: any = {};
    if (departmentId) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    return this.templateModel.find(filter).populate('departmentId').exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any) {
    const newTpl = new this.templateModel(body);
    return newTpl.save();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.templateModel.findByIdAndUpdate(id, body, { new: true }).populate('departmentId').exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.templateModel.findByIdAndDelete(id).exec();
  }
}
