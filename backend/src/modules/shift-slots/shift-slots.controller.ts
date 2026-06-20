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
import { ShiftSlotsService } from './shift-slots.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/shift-slots')
export class ShiftSlotsController {
  constructor(private readonly shiftSlotsService: ShiftSlotsService) {}

  @Get()
  async findAll() {
    return this.shiftSlotsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.shiftSlotsService.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any) {
    return this.shiftSlotsService.create(body);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.shiftSlotsService.update(id, body);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.shiftSlotsService.remove(id);
  }
}
