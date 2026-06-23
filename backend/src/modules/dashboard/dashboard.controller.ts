import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  private getTodayVietnam(): string {
    const now = new Date();
    const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return vietnamTime.toISOString().split('T')[0];
  }

  @Get('summary')
  async getSummary(@Query('date') date: string, @Request() req: any) {
    const targetDate = date || this.getTodayVietnam();
    return this.dashboardService.getSummary(targetDate, req.user);
  }

  @Get('jobs')
  async getJobs(
    @Query('date') date: string,
    @Query('status') status: string,
    @Request() req: any,
  ) {
    const targetDate = date || this.getTodayVietnam();
    return this.dashboardService.getJobs(targetDate, req.user, status);
  }

  @Get('departments')
  async getDepartmentStats(@Query('date') date: string, @Request() req: any) {
    const targetDate = date || this.getTodayVietnam();
    return this.dashboardService.getDepartmentStats(targetDate, req.user);
  }

  @Get('shift-slots')
  async getShiftSlotStats(@Query('date') date: string, @Request() req: any) {
    const targetDate = date || this.getTodayVietnam();
    return this.dashboardService.getShiftSlotStats(targetDate, req.user);
  }

  @Get('activity')
  async getActivity(
    @Query('date') date: string,
    @Query('limit') limit: string,
    @Request() req: any,
  ) {
    const targetDate = date || this.getTodayVietnam();
    const lim = limit ? parseInt(limit, 10) : 20;
    return this.dashboardService.getActivity(targetDate, req.user, lim);
  }
}
