import {
  Controller,
  Post,
  Body,
  Patch,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('initialize')
  @Permissions('INITIALIZE_SHIFT')
  async initialize(@Request() req: any, @Body() body: any) {
    const { templateId, shiftDate } = body;
    return this.shiftsService.initializeShift(templateId, req.user, shiftDate);
  }

  @Patch('items/toggle')
  @Permissions('EDIT_CHECKLIST')
  async toggleItem(@Request() req: any, @Body() body: any) {
    const { shiftLogId, taskId, isChecked, note } = body;
    return this.shiftsService.toggleTask(
      shiftLogId,
      taskId,
      isChecked,
      req.user,
      note,
    );
  }

  @Patch('items/status')
  @Permissions('EDIT_CHECKLIST')
  async updateStatus(@Request() req: any, @Body() body: any) {
    const { shiftLogId, taskId, status, note } = body;
    return this.shiftsService.updateTaskStatus(
      shiftLogId,
      taskId,
      status,
      req.user,
      note,
    );
  }

  @Post('close')
  @Permissions('CLOSE_SHIFT')
  async close(@Request() req: any, @Body() body: any) {
    const { shiftLogId, handoverNote } = body;
    return this.shiftsService.closeShift(shiftLogId, req.user, handoverNote);
  }

  @Get('history')
  @Permissions('VIEW_CHECKLIST')
  async getHistory(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shiftsService.getHistory(
      req.user,
      departmentId,
      startDate,
      endDate,
      status,
      page ? parseInt(page, 10) : undefined,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('active')
  @Permissions('VIEW_CHECKLIST')
  async getActive(
    @Request() req: any,
    @Query('departmentId') departmentId?: string,
    @Query('shiftDate') shiftDate?: string,
  ) {
    return this.shiftsService.getActiveShiftsByDepartment(
      req.user,
      departmentId,
      shiftDate,
    );
  }

  @Get('search/global')
  @Permissions('VIEW_CHECKLIST')
  async globalSearch(@Request() req: any, @Query('q') query: string) {
    if (!query) {
      return { incidents: [], tasks: [], handovers: [] };
    }
    return this.shiftsService.globalSearch(query, req.user);
  }

  @Get(':id')
  @Permissions('VIEW_CHECKLIST')
  async getOne(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.getShiftById(id, req.user);
  }

  @Get(':id/audit-logs')
  @Permissions('VIEW_CHECKLIST')
  async getAuditLogs(@Request() req: any, @Param('id') id: string) {
    return this.shiftsService.getAuditLogs(id, req.user);
  }

  @Post(':id/add-task')
  @Permissions('EDIT_CHECKLIST')
  async addAdhocTask(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const { taskName, priority, deadline } = body;
    return this.shiftsService.addAdhocTask(id, req.user, {
      taskName,
      priority,
      deadline,
    });
  }
}
