import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Division } from '../../schemas/division.schema';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/divisions')
export class DivisionsController {
  constructor(
    @InjectModel(Division.name) private readonly divisionModel: Model<Division>,
  ) {}

  @Get()
  async findAll() {
    return this.divisionModel.find().sort({ name: 1 }).exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any) {
    const newDiv = new this.divisionModel(body);
    return newDiv.save();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.divisionModel.findByIdAndUpdate(id, body, { new: true }).exec();
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.divisionModel.findByIdAndDelete(id).exec();
  }
}
