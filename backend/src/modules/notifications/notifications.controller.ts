import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // =========================================================================
  // Channels Endpoints
  // =========================================================================
  @Get('channels')
  async getChannels() {
    return this.notificationsService.getChannels();
  }

  @Get('channels/:id')
  async getChannelById(@Param('id') id: string) {
    return this.notificationsService.getChannelById(id);
  }

  @Roles('ADMIN')
  @Post('channels')
  async createChannel(@Body() data: any) {
    return this.notificationsService.createChannel(data);
  }

  @Roles('ADMIN')
  @Put('channels/:id')
  async updateChannel(@Param('id') id: string, @Body() data: any) {
    return this.notificationsService.updateChannel(id, data);
  }

  @Roles('ADMIN')
  @Delete('channels/:id')
  async deleteChannel(@Param('id') id: string) {
    return this.notificationsService.deleteChannel(id);
  }

  // =========================================================================
  // Rules Endpoints
  // =========================================================================
  @Get('rules')
  async getRules() {
    return this.notificationsService.getRules();
  }

  @Get('rules/:id')
  async getRuleById(@Param('id') id: string) {
    return this.notificationsService.getRuleById(id);
  }

  @Roles('ADMIN')
  @Post('rules')
  async createRule(@Body() data: any) {
    return this.notificationsService.createRule(data);
  }

  @Roles('ADMIN')
  @Put('rules/:id')
  async updateRule(@Param('id') id: string, @Body() data: any) {
    return this.notificationsService.updateRule(id, data);
  }

  @Roles('ADMIN')
  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    return this.notificationsService.deleteRule(id);
  }

  // =========================================================================
  // Logs & Test Endpoints
  // =========================================================================
  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    const lim = limit ? parseInt(limit, 10) : 100;
    return this.notificationsService.getLogs(lim);
  }

  @Post('test')
  async triggerTest(@Body() data: { eventType: string; ruleId?: string; recipient: string; payload?: any }) {
    return this.notificationsService.triggerTestNotification(data);
  }
}
