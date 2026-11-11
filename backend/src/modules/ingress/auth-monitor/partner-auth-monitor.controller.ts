/**
 * partner-auth-monitor.controller.ts
 *
 * REST API Controller phục vụ màn hình giám sát tần suất đăng nhập & yêu cầu
 * đối tác (/trading-manager/auth-monitor).
 * Bắt buộc bảo vệ bởi JwtAuthGuard theo chuẩn bảo mật hệ thống.
 */

import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PartnerAuthMonitorService } from './partner-auth-monitor.service';
import {
  PartnerSubsystem,
  IPartnerMonitorConfig,
} from './partner-auth-monitor.interface';

@Controller('ingress/auth-monitor')
@UseGuards(JwtAuthGuard)
export class PartnerAuthMonitorController {
  constructor(private readonly monitorService: PartnerAuthMonitorService) {}

  /**
   * Lấy tổng quan trạng thái sức khỏe (Health Summary) của 5 phân hệ đối tác có lọc theo ngày
   */
  @Get('health')
  async getHealth(@Query('date') date?: string) {
    const data = await this.monitorService.getHealthSummaries(date);
    return {
      success: true,
      timestamp: new Date(),
      data,
    };
  }

  /**
   * Lấy danh sách sự kiện xác thực & kết nối (Audit Log) có hỗ trợ bộ lọc và phân trang
   */
  @Get('events')
  async getEvents(
    @Query('partner') partner?: string,
    @Query('date') date?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
    @Query('eventType') eventType?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedPage = Math.max(1, page ? parseInt(page, 10) : 1);
    const parsedLimit = Math.min(1000, Math.max(1, limit ? parseInt(limit, 10) : 50));
    const result = await this.monitorService.queryEvents({
      partner: partner as PartnerSubsystem,
      date,
      startDate,
      endDate,
      status: status as any,
      eventType,
      search,
      page: parsedPage,
      limit: parsedLimit,
    });
    return {
      success: true,
      count: result.data.length,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
      data: result.data,
    };
  }

  /**
   * Lấy cấu hình ngưỡng và thông tin cảnh báo
   */
  @Get('config')
  async getConfig() {
    const data = await this.monitorService.getConfig();
    return {
      success: true,
      data,
    };
  }

  /**
   * Cập nhật cấu hình ngưỡng và người nhận cảnh báo
   */
  @Put('config')
  @HttpCode(HttpStatus.OK)
  async updateConfig(@Body() body: Partial<IPartnerMonitorConfig>) {
    const updated = await this.monitorService.updateConfig(body);
    return {
      success: true,
      message: 'Cập nhật cấu hình giám sát đối tác thành công',
      data: updated,
    };
  }
}
