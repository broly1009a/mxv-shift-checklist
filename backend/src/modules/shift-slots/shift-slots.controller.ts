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
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

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

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_CALENDAR')
  @Post()
  async create(@Body() body: any) {
    return this.shiftSlotsService.create(body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_CALENDAR')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.shiftSlotsService.update(id, body);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('MANAGE_CALENDAR')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.shiftSlotsService.remove(id);
  }
}
