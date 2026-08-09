import {
  Controller,
  UseGuards,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Request,
  Res,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Permissions('RESOLVE_INCIDENTS')
  async createIncident(@Request() req: any, @Body() body: any) {
    const { shiftLogId, taskId, code, severity, requiredAction, slaMinutes } =
      body;
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
  @Permissions('VIEW_CHECKLIST')
  async getByShift(
    @Request() req: any,
    @Param('shiftLogId') shiftLogId: string,
  ) {
    return this.incidentsService.getIncidentsByShift(shiftLogId, req.user);
  }

  @Get('pending')
  @Permissions('VIEW_CHECKLIST')
  async getPending(@Request() req: any) {
    return this.incidentsService.getPendingIncidents(req.user);
  }

  @Get(':id/export')
  @Permissions('VIEW_CHECKLIST')
  async exportIncident(
    @Param('id') incidentId: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    return this.incidentsService.exportIncidentReport(
      incidentId,
      req.user,
      res,
    );
  }

  @Patch(':id/resolve')
  @Permissions('RESOLVE_INCIDENTS')
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
