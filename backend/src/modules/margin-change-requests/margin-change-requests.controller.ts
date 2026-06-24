import { Controller, UseGuards, Post, Get, Patch, Body, Param, Request, Query } from '@nestjs/common';
import { MarginChangeRequestsService } from './margin-change-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/margin-change-requests')
export class MarginChangeRequestsController {
  constructor(
    private readonly marginChangeRequestsService: MarginChangeRequestsService,
  ) {}

  @Post()
  async create(@Request() req: any, @Body() body: any) {
    const { commodity, oldMargin, newMargin, effectiveSession, comments } = body;
    return this.marginChangeRequestsService.createRequest(
      { commodity, oldMargin, newMargin, effectiveSession, comments },
      req.user,
    );
  }

  @Get()
  async list(@Query('status') status?: string) {
    return this.marginChangeRequestsService.listRequests(status);
  }

  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const { comments } = body;
    return this.marginChangeRequestsService.approveRequest(id, req.user, comments);
  }

  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: any,
  ) {
    const { reason, comments } = body;
    return this.marginChangeRequestsService.rejectRequest(id, req.user, reason, comments);
  }
}
