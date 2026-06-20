import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from '../../schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userModel
      .findOne({ username: username.toLowerCase() })
      .populate('departmentId')
      .populate('divisionId')
      .exec();
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      if (!user.isActive) {
        throw new UnauthorizedException(
          'Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa. Vui lòng liên hệ Admin.',
        );
      }
      return user;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user._id,
      role: user.role,
      departmentId: user.departmentId?._id || user.departmentId || null,
      divisionId: user.divisionId?._id || user.divisionId || null,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        department: user.departmentId || null,
        division: user.divisionId || null,
        isActive: user.isActive,
        settings: user.settings || {
          theme: 'dark',
          autoRefreshInterval: 30,
          telegramNotifications: true,
          telegramChatId: '',
          alertThresholdMinutes: 15,
        },
      },
    };
  }

  async register(
    username: string,
    pass: string,
    fullName: string,
    departmentId: string,
    role: string,
  ) {
    const lowerUsername = username.toLowerCase();
    const existing = await this.userModel.findOne({ username: lowerUsername }).exec();
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    const passwordHash = await bcrypt.hash(pass, 10);
    const created = new this.userModel({
      username: lowerUsername,
      passwordHash,
      fullName,
      departmentId: departmentId || null,
      role,
      isActive: true, // Manually registered users are active by default
    });
    await created.save();
    return created;
  }

  async exchangeMicrosoftCode(code: string) {
    const tenantId = process.env.MICROSOFT_TENANT_ID || 'common';
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_CALLBACK_URL;

    // 1. Send POST request to Microsoft to exchange authorization code for access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId || '',
          scope: 'openid profile email User.Read',
          code: code,
          redirect_uri: redirectUri || '',
          grant_type: 'authorization_code',
          client_secret: clientSecret || '',
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json();
      throw new UnauthorizedException(
        errData.error_description || 'Không thể xác thực mã với Microsoft.',
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Use access token to retrieve user details from Microsoft Graph API
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new UnauthorizedException(
        'Không thể lấy thông tin tài khoản từ Microsoft Graph.',
      );
    }

    const profile = await profileResponse.json();
    const email = profile.mail || profile.userPrincipalName;
    const fullName = profile.displayName;

    // 3. Call validateMicrosoftSSO to check/create user in the database
    const user = await this.validateMicrosoftSSO(email, fullName);

    // 4. Generate local system JWT and return
    return this.login(user);
  }

  async validateMicrosoftSSO(email: string, fullName: string): Promise<any> {
    if (!email || !email.endsWith('@mxv.vn')) {
      throw new UnauthorizedException(
        'Email không thuộc tên miền Sở MXV (@mxv.vn)',
      );
    }

    const username = email.split('@')[0].toLowerCase();

    // Check if user already exists
    const user = await this.userModel
      .findOne({ username })
      .populate('departmentId')
      .populate('divisionId')
      .exec();

    if (user) {
      // User exists - check activation status
      if (!user.isActive) {
        throw new UnauthorizedException(
          'Tài khoản của bạn đang chờ Admin kích hoạt và gán phòng ban.',
        );
      }
      return user;
    }

    // User does not exist - create automatically in pending status
    const dummyHash = await bcrypt.hash('dummy_sso_pass_2026', 10);
    const isInitialAdmin = username === 'admin_sso';

    const newUser = new this.userModel({
      username,
      passwordHash: dummyHash,
      fullName:
        fullName ||
        `${username.charAt(0).toUpperCase() + username.slice(1)} (M365)`,
      departmentId: null, // Waiting for admin assignment
      role: isInitialAdmin ? 'ADMIN' : 'STAFF',
      isActive: isInitialAdmin ? true : false, // Initial admin is active, others wait for admin approval
    });

    await newUser.save();

    throw new UnauthorizedException(
      'Tài khoản đã được tạo tự động từ Microsoft 365 và đang chờ Admin kích hoạt, gán phòng ban.',
    );
  }

  async updateProfile(userId: string, data: any): Promise<any> {
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    if (data.fullName) {
      user.fullName = data.fullName;
    }

    if (data.password) {
      user.passwordHash = await bcrypt.hash(data.password, 10);
    }

    if (data.settings) {
      user.settings = {
        theme:
          data.settings.theme !== undefined
            ? data.settings.theme
            : user.settings?.theme || 'dark',
        autoRefreshInterval:
          data.settings.autoRefreshInterval !== undefined
            ? Number(data.settings.autoRefreshInterval)
            : user.settings?.autoRefreshInterval || 30,
        telegramNotifications:
          data.settings.telegramNotifications !== undefined
            ? !!data.settings.telegramNotifications
            : (user.settings?.telegramNotifications ?? true),
        telegramChatId:
          data.settings.telegramChatId !== undefined
            ? data.settings.telegramChatId
            : user.settings?.telegramChatId || '',
        alertThresholdMinutes:
          data.settings.alertThresholdMinutes !== undefined
            ? Number(data.settings.alertThresholdMinutes)
            : user.settings?.alertThresholdMinutes || 15,
      };
    }

    await user.save();

    return {
      id: user._id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      departmentId: user.departmentId || null,
      divisionId: user.divisionId || null,
      isActive: user.isActive,
      settings: user.settings,
    };
  }
}
