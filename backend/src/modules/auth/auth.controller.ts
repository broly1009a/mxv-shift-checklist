import { Controller, Post, Body, Get, Put, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
