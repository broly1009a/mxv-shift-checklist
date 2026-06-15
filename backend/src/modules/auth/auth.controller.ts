import { Controller, Post, Body, Get, Put, UseGuards, Request, UnauthorizedException, Res, Query } from '@nestjs/common';
import * as express from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('microsoft')
  async microsoftLogin(@Res() res: express.Response) {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = encodeURIComponent(process.env.MICROSOFT_CALLBACK_URL || '');
    const scope = encodeURIComponent('openid profile email User.Read');
    
    const authorizationUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&response_mode=query&scope=${scope}&state=mxv_auth_state`;
    
    return res.redirect(authorizationUrl);
  }

  @Get('microsoft/callback')
  async microsoftCallback(@Query('code') code: string, @Res() res: express.Response) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent('Không nhận được mã xác thực từ Microsoft')}`);
    }
    
    try {
      const result = await this.authService.exchangeMicrosoftCode(code);
      
      const token = result.access_token;
      const userStr = encodeURIComponent(JSON.stringify(result.user));
      
      return res.redirect(`${frontendUrl}/login?token=${token}&user=${userStr}`);
    } catch (error: any) {
      const errorMsg = error.message || 'Đăng nhập Microsoft thất bại';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMsg)}`);
    }
  }

  @Post('login')
  async login(@Body() body: any) {
    const { username, password } = body;
    const user = await this.authService.validateUser(username, password);
    if (!user) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không chính xác');
    }
    return this.authService.login(user);
  }

  @Post('sso')
  async sso(@Body() body: any) {
    const { email, fullName } = body;
    const user = await this.authService.validateMicrosoftSSO(email, fullName);
    if (!user) {
      throw new UnauthorizedException('Không thể xác thực tài khoản Microsoft 365');
    }
    return this.authService.login(user);
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
