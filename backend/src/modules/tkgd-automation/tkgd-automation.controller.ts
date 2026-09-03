import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { TkgdAutomationService } from './tkgd-automation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tkgd')

export class TkgdAutomationController {
  constructor(private readonly tkgdService: TkgdAutomationService) {}

  /**
   * Helper lấy email của user từ request hoặc fallback
   */
  private getUserEmail(req: any): string {
    return req?.user?.email || req?.headers?.['x-user-email'] || 'hieptruong@mxv.vn';
  }

  /**
   * Lấy cấu hình đối soát TKGD của User
   */
  @Get('config')
  async getConfig(@Req() req: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.getUserConfig(email);
  }

  /**
   * Lưu cấu hình đối soát TKGD cho User
   */
  @Post('config')
  async saveConfig(@Req() req: any, @Body() dto: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.saveUserConfig(email, dto);
  }

  /**
   * Kiểm tra kết nối M-System trực tiếp
   */
  @Post('test-ms')
  async testMSystem(@Req() req: any, @Body() body: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.testMSystemConnection(email, body);
  }

  /**
   * Lấy danh sách hồ sơ đối soát
   */
  @Get('records')
  async getRecords(
    @Query('limit') limit: string,
    @Query('skip') skip: string,
    @Query('filter') filter: string,
  ) {
    const l = parseInt(limit || '20', 10);
    const s = parseInt(skip || '0', 10);
    return await this.tkgdService.getRecords(l, s, filter);
  }

  /**
   * Chạy quy trình đối soát chéo và xuất file Excel
   */
  @Post('run')
  async runReconciliation(@Req() req: any) {
    const email = this.getUserEmail(req);
    return await this.tkgdService.runReconciliation(email);
  }
}
