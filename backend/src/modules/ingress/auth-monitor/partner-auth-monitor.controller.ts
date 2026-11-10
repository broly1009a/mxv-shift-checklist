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
   * Lấy tổng quan trạng thái sức khỏe (Health Summary) của 5 phân hệ đối tác
   */
  @Get('health')
  async getHealth() {
    const data = await this.monitorService.getHealthSummaries();
    return {
      success: true,
      timestamp: new Date(),
      data,
    };
  }

  /**
   * Lấy danh sách sự kiện Telemetry gần nhất (Audit log)
   */
  @Get('events')
  async getEvents(
    @Query('partner') partner?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const data = await this.monitorService.getRecentEvents(partner as PartnerSubsystem, parsedLimit);
    return {
      success: true,
      count: data.length,
      data,
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
