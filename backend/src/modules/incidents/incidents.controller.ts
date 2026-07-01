import { Controller, UseGuards, Post, Get, Patch, Body, Param, Request } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  async createIncident(@Request() req: any, @Body() body: any) {
    const { shiftLogId, taskId, code, severity, requiredAction, slaMinutes } = body;
    const actor = req.user.fullName || req.user.username;
    return this.incidentsService.createIncident(
      shiftLogId,
      taskId,
      code,
      severity,
      requiredAction,
      actor,
      slaMinutes,
      req.user.id || req.user._id,
    );
  }

  @Get('shift/:shiftLogId')
  async getByShift(@Request() req: any, @Param('shiftLogId') shiftLogId: string) {
    return this.incidentsService.getIncidentsByShift(shiftLogId, req.user);
  }

  @Get('pending')
  async getPending(@Request() req: any) {
    return this.incidentsService.getPendingIncidents(req.user);
  }

  @Patch(':id/resolve')
  async resolveIncident(
    @Param('id') incidentId: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const { rootCause, remediationAction, affectedAccounts } = body;
    return this.incidentsService.resolveIncident(
      incidentId,
      { rootCause, remediationAction, affectedAccounts },
      req.user,
    );
  }
}
