import {
  Controller,
  Post,
  Body,
  Get,
  Put,
  UseGuards,
  Request,
  UnauthorizedException,
  ForbiddenException,
  Res,
  Query,
  Logger,
} from '@nestjs/common';
import * as express from 'express';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SystemSettingsService } from '../system-settings/system-settings.service';

function getCookie(req: express.Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map((c) => c.trim());
  for (const cookie of cookies) {
    const [key, ...valParts] = cookie.split('=');
    if (key === name) return valParts.join('=');
  }
  return null;
}

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly settingsService: SystemSettingsService,
  ) {}

  @Get('microsoft')
  async microsoftLogin(@Res() res: express.Response) {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = encodeURIComponent(
      process.env.MICROSOFT_CALLBACK_URL || '',
    );
    const scope = encodeURIComponent('openid profile email User.Read');

    // Generate secure dynamic state for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Save state in HTTP-only cookie
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300000, // 5 minutes
    });

    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${state}`;

    return res.redirect(authorizationUrl);
  }

  @Get('microsoft-bot')
  async microsoftBotLogin(
    @Query('token') userToken: string,
    @Res() res: express.Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (!userToken) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent('Yêu cầu xác thực Admin không hợp lệ')}`,
      );
    }
    
    try {
      const decoded = this.jwtService.verify(userToken);
      if (!decoded || decoded.role !== 'ADMIN') {
        return res.redirect(
          `${frontendUrl}/login?error=${encodeURIComponent('Quyền truy cập bị từ chối: Chỉ Admin mới có thể cấp quyền hòm thư Bot')}`,
        );
      }
    } catch (err) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent('Phiên làm việc hết hạn hoặc không hợp lệ')}`,
      );
    }

    const tenantId =
      (await this.settingsService.getSetting('m365_tenant_id', '')) ||
      process.env.MICROSOFT_TENANT_ID ||
      'common';

    const clientId =
      (await this.settingsService.getSetting('m365_client_id', '')) ||
      process.env.MICROSOFT_CLIENT_ID;
      
    const redirectUri = encodeURIComponent(
      process.env.MICROSOFT_CALLBACK_URL || '',
    );
    
    const scope = encodeURIComponent('openid profile email Mail.Read Mail.ReadWrite offline_access');

    // Generate secure signed state for bot auth to bypass cookie cross-origin port issues
    const timestamp = Date.now().toString();
    const secret = process.env.JWT_SECRET || 'trading_mxv_secret_key_2026';
    const hash = crypto.createHmac('sha256', secret).update(`bot:${timestamp}`).digest('hex');
    const state = `bot:${timestamp}:${hash}`;

    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=${state}&prompt=consent`;

    return res.redirect(authorizationUrl);
  }

  @Get('microsoft/callback')
  async microsoftCallback(
    @Request() req: express.Request,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // 1. Check if it is Bot authorization first (uses signed state to avoid cookie-sharing port issues)
    if (state && state.startsWith('bot:')) {
      if (!code) {
        return res.redirect(
          `${frontendUrl}/admin/bot-config?tab=credentials&m365_auth=failed&error=${encodeURIComponent('Không nhận được mã xác thực từ Microsoft')}`,
        );
      }
      
      try {
        const parts = state.split(':');
        if (parts.length !== 3) {
          throw new Error('Mã trạng thái bot không hợp lệ');
        }
        
        const [_, timestamp, hash] = parts;
        const secret = process.env.JWT_SECRET || 'trading_mxv_secret_key_2026';
        const expectedHash = crypto.createHmac('sha256', secret).update(`bot:${timestamp}`).digest('hex');
        
        if (hash !== expectedHash) {
          throw new Error('Chữ ký xác thực bot không khớp (CSRF mismatch)');
        }
        
        const age = Date.now() - parseInt(timestamp, 10);
        if (isNaN(age) || age > 600000) { // 10 minutes limit
          throw new Error('Yêu cầu cấp quyền đã hết hạn');
        }
        
        const tokenData = await this.authService.exchangeMicrosoftCodeForBot(code);
        if (tokenData.refresh_token) {
          await this.settingsService.setSetting('m365_refresh_token', tokenData.refresh_token);
          await this.settingsService.setSetting('m365_token_renewed_at', new Date().toISOString());
          await this.settingsService.setSetting('m365_token_error_sent_at', '1970-01-01T00:00:00.000Z');
          this.logger.log(`[M365-BOT] Bot Refresh Token successfully authorized and saved.`);
        } else {
          throw new Error('Không nhận được Refresh Token từ Microsoft (hãy kiểm tra xem đã bật quyền offline_access chưa)');
        }
        
        return res.redirect(
          `${frontendUrl}/admin/bot-config?tab=credentials&m365_auth=success`,
        );
      } catch (error: any) {
        const errorMsg = error.message || 'Cấp quyền hòm thư Bot thất bại';
        return res.redirect(
          `${frontendUrl}/admin/bot-config?tab=credentials&m365_auth=failed&error=${encodeURIComponent(errorMsg)}`,
        );
      }
    }

    // 2. Normal User Login Flow (uses standard cookie check)
    const cookieState = getCookie(req, 'oauth_state');
    if (!state || state !== cookieState) {
      res.clearCookie('oauth_state');
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent('Yêu cầu xác thực không hợp lệ hoặc đã hết hạn (CSRF detected)')}`,
      );
    }

    res.clearCookie('oauth_state');

    if (!code) {
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent('Không nhận được mã xác thực từ Microsoft')}`,
      );
    }

    try {
      const result = await this.authService.exchangeMicrosoftCode(code);

      // Create exchange code instead of redirecting with JWT token
      const exchangeCode = this.authService.createExchangeCode(
        result.access_token,
        result.user,
      );

      return res.redirect(`${frontendUrl}/login?code=${exchangeCode}`);
    } catch (error: any) {
      const errorMsg = error.message || 'Đăng nhập Microsoft thất bại';
      return res.redirect(
        `${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`,
      );
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const { username, password } = body;
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản hoặc mật khẩu không chính xác',
      );
    }
    return this.authService.login(user);
  }

  @Post('sso')
  async sso(@Body() body: any) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SIMULATED_SSO !== 'true'
    ) {
      throw new ForbiddenException(
        'Tính năng đăng nhập giả lập SSO bị vô hiệu hóa trên môi trường Production.',
      );
    }
    const { email, fullName } = body;
    const user = await this.authService.validateMicrosoftSSO(email, fullName);
    if (!user) {
      throw new UnauthorizedException(
        'Không thể xác thực tài khoản Microsoft 365',
      );
    }
    return this.authService.login(user);
  }

  @Post('exchange-token')
  async exchangeToken(@Body() body: any) {
    const { code } = body;
    if (!code) {
      throw new UnauthorizedException('Thiếu mã xác thực (exchange code).');
    }
    return this.authService.exchangeToken(code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfileDetail(@Request() req: any) {
    const user = req.user;
    return {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      department: user.departmentId || null,
      isActive: user.isActive,
      settings: user.settings,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('profile')
  async updateProfileDetail(@Request() req: any, @Body() body: any) {
    return this.authService.updateProfile(req.user._id.toString(), body);
  }
}
