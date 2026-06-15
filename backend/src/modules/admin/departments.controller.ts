import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Department } from '../../schemas/department.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/departments')
export class DepartmentsController {
  constructor(
    @InjectModel(Department.name) private readonly departmentModel: Model<Department>,
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
    return this.departmentModel.findByIdAndUpdate(id, body, { new: true }).exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.departmentModel.findByIdAndDelete(id).exec();
  }
}
