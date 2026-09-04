import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { TkgdAutomationService } from './tkgd-automation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller(['api/v1/tkgd', 'tkgd'])
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
   * Khởi tạo URL chuyển hướng đăng nhập Microsoft OAuth2 độc lập cho TKGD
   */
  @Get('auth/microsoft')
  async microsoftOutlookAuth(@Req() req: any, @Res() res: any, @Query('userEmail') qUserEmail?: string) {
    const email = qUserEmail || this.getUserEmail(req);
    const userConfig = await this.tkgdService.getUserConfig(email);

    const tenantId =
      userConfig.outlook?.tenantId ||
      process.env.MICROSOFT_TENANT_ID ||
      'common';

    const clientId =
      userConfig.outlook?.clientId ||
      process.env.MICROSOFT_CLIENT_ID;

    const redirectUri = encodeURIComponent(
      process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:3000/api/v1/auth/microsoft/callback',
    );

    const scope = encodeURIComponent('openid profile email Mail.Read Mail.ReadWrite offline_access User.Read');

    // Signed state: tkgd:${encodeURIComponent(email)}:${timestamp}:${hash}
    const timestamp = Date.now().toString();
    const secret = process.env.JWT_SECRET || 'trading_mxv_secret_key_2026';
    const hash = crypto.createHmac('sha256', secret).update(`tkgd:${email}:${timestamp}`).digest('hex');
    const state = `tkgd:${encodeURIComponent(email)}:${timestamp}:${hash}`;

    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${state}&prompt=select_account`;

    return res.redirect(authorizationUrl);
  }

  /**
   * Hủy kết nối / Đăng xuất tài khoản Outlook độc lập của TKGD
   */
  @Post('auth/microsoft/disconnect')
  async disconnectOutlook(@Req() req: any, @Body() body: any) {
    const email = body?.userEmail || this.getUserEmail(req);
    return await this.tkgdService.disconnectOutlook(email);
  }

  /**
   * Lấy danh sách hồ sơ đối soát
   */
  @Get('records')
  async getRecords(
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('page') page?: string,
    @Query('filter') filter?: string,
    @Query('batchDate') batchDate?: string,
    @Query('search') search?: string,
  ) {
    const l = parseInt(limit || '20', 10);
    const p = page ? parseInt(page, 10) : undefined;
    const s = p ? (p - 1) * l : parseInt(skip || '0', 10);
    return await this.tkgdService.getRecords({
      limit: l,
      skip: s,
      page: p || Math.floor(s / l) + 1,
      filter,
      batchDate,
      search,
    });
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
