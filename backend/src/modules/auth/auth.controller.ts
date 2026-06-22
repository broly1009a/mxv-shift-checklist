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
} from '@nestjs/common';
import * as express from 'express';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function getCookie(req: express.Request, name: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').map(c => c.trim());
  for (const cookie of cookies) {
    const [key, ...valParts] = cookie.split('=');
    if (key === name) return valParts.join('=');
  }
  return null;
}

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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

  @Get('microsoft/callback')
  async microsoftCallback(
    @Request() req: express.Request,
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: express.Response,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Verify state to prevent CSRF
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

      return res.redirect(
        `${frontendUrl}/login?code=${exchangeCode}`,
      );
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
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SIMULATED_SSO !== 'true') {
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
      division: user.divisionId || null,
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
