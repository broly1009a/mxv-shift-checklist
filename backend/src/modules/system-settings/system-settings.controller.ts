import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SystemSettingsService } from './system-settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('api/v1/system-settings')
export class SystemSettingsController {
  constructor(private readonly settingsService: SystemSettingsService) {}

  @Get()
  async findAll() {
    return this.settingsService.findAll();
  }

  @Get(':key')
  async getSetting(@Param('key') key: string) {
    const value = await this.settingsService.getSetting(key);
    return { key, value };
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Post()
  async setSetting(@Body() body: { key: string; value: string }) {
    return this.settingsService.setSetting(body.key, body.value);
  }
}
