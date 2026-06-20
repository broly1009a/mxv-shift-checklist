import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { WorkingCalendarService } from './working-calendar.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/working-calendar')
export class WorkingCalendarController {
  constructor(
    private readonly workingCalendarService: WorkingCalendarService,
  ) {}

  @Get()
  async findAll() {
    return this.workingCalendarService.findAll();
  }

  @Get(':date/validate')
  async validateDate(@Param('date') date: string) {
    return this.workingCalendarService.validateDate(date);
  }

  @Get(':date')
  async findOne(@Param('date') date: string) {
    return this.workingCalendarService.findOne(date);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async create(@Body() body: any, @Request() req: any) {
    return this.workingCalendarService.create(
      body,
      req.user._id || req.user.id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put(':date')
  async update(
    @Param('date') date: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.workingCalendarService.update(
      date,
      body,
      req.user._id || req.user.id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Delete(':date')
  async remove(@Param('date') date: string) {
    return this.workingCalendarService.remove(date);
  }
}
