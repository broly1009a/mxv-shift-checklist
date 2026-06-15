import { Controller, Post, Body, Patch, Get, Query, UseGuards, Request, Param } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('initialize')
  async initialize(@Request() req: any, @Body() body: any) {
    const { templateId, shiftDate } = body;
    return this.shiftsService.initializeShift(templateId, req.user, shiftDate);
  }

  @Patch('items/toggle')
  async toggleItem(@Request() req: any, @Body() body: any) {
    const { shiftLogId, taskId, isChecked, note } = body;
    return this.shiftsService.toggleTask(shiftLogId, taskId, isChecked, req.user, note);
  }

  @Post('close')
  async close(@Request() req: any, @Body() body: any) {
    const { shiftLogId, handoverNote } = body;
    return this.shiftsService.closeShift(shiftLogId, req.user, handoverNote);
  }

  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ) {
    return this.shiftsService.getHistory(req.user, departmentId, startDate, endDate, status);
  }

  @Get('active')
  async getActive(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('shiftDate') shiftDate?: string,
  ) {
    return this.shiftsService.getActiveShiftsByDepartment(req.user, departmentId, shiftDate);
  }

  @Get(':id')
  async getOne(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.getShiftById(id, req.user);
  }

  @Get(':id/audit-logs')
  async getAuditLogs(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.getAuditLogs(id, req.user);
  }
}
