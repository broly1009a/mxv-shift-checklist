import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { User } from '../../schemas/user.schema';
import { Department } from '../../schemas/department.schema';
import { Role } from '../../schemas/role.schema';
import { SystemSettingsService } from '../system-settings/system-settings.service';

@Injectable()
export class AuthService {
  private readonly exchangeCodes = new Map<
    string,
    { token: string; user: any; expiresAt: number }
  >();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
    private readonly jwtService: JwtService,
    private readonly settingsService: SystemSettingsService,
  ) {
    // Periodically clean up expired exchange codes (every 5 minutes)
    setInterval(() => {
      const now = Date.now();
      for (const [code, data] of this.exchangeCodes.entries()) {
        if (data.expiresAt < now) {
          this.exchangeCodes.delete(code);
        }
      }
    }, 300000).unref();
  }

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.userModel
      .findOne({ username: username.toLowerCase() })
      .populate({
        path: 'departmentId',
        populate: { path: 'parentDepartmentId' },
      })
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
    let permissions: string[] = [];
    if (user.role === 'ADMIN') {
      permissions = [
        'VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'INITIALIZE_SHIFT', 'CLOSE_SHIFT',
        'ACCESS_MARGIN_CHANGE', 'ACCESS_AUTO_SHIFT', 'ACCESS_HEALTH_CHECKS', 'RESOLVE_INCIDENTS',
        'MANAGE_TEMPLATES', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_CALENDAR'
      ];
    } else {
      const roleDoc = await this.roleModel.findOne({ code: user.role }).exec();
      if (roleDoc) {
        permissions = roleDoc.permissions || [];
      }
    }

    const payload = {
      username: user.username,
      sub: user._id,
      role: user.role,
      departmentId: user.departmentId?._id || user.departmentId || null,
      permissions,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        title: user.title || '',
        role: user.role,
        department: user.departmentId || null,
        isActive: user.isActive,
        permissions,
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
    const existing = await this.userModel
      .findOne({ username: lowerUsername })
      .exec();
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
      .populate({
        path: 'departmentId',
        populate: { path: 'parentDepartmentId' },
      })
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

    // User does not exist - read mapping config to see if we should auto-assign
    let autoAssignedUser: any = null;
    try {
      const configPath = path.join(
        process.cwd(),
        'sso-auto-assign.config.json',
      );
      if (fs.existsSync(configPath)) {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const matched = configData.find(
          (item: any) => item.email.toLowerCase() === email.toLowerCase(),
        );
        if (matched) {
          let departmentId = null;

          if (matched.departmentCode) {
            const dept = await this.departmentModel
              .findOne({ code: matched.departmentCode })
              .exec();
            if (dept) departmentId = dept._id;
          }

          autoAssignedUser = {
            role: matched.role || 'STAFF',
            departmentId,
            fullName: matched.fullName || fullName,
            isActive: true, // Activated immediately!
          };
        }
      }
    } catch (err) {
      console.error('Error loading sso-auto-assign.config.json:', err);
    }

    // User does not exist - create automatically
    const dummyHash = await bcrypt.hash(
      process.env.DUMMY_SSO_PASS || 'dummy_sso_pass_2026',
      10,
    );
    const isInitialAdmin =
      username === 'admin_sso' && process.env.NODE_ENV !== 'production';

    const newUser = new this.userModel({
      username,
      passwordHash: dummyHash,
      fullName: autoAssignedUser
        ? autoAssignedUser.fullName
        : fullName ||
          `${username.charAt(0).toUpperCase() + username.slice(1)} (M365)`,
      departmentId: autoAssignedUser ? autoAssignedUser.departmentId : null,
      role: autoAssignedUser
        ? autoAssignedUser.role
        : isInitialAdmin
          ? 'ADMIN'
          : 'STAFF',
      isActive: autoAssignedUser ? true : isInitialAdmin ? true : false,
    });

    await newUser.save();

    if (autoAssignedUser) {
      // Return the created user directly (no need to throw wait exception since isActive = true)
      return this.userModel
        .findById(newUser._id)
        .populate({
          path: 'departmentId',
          populate: { path: 'parentDepartmentId' },
        })
        .exec();
    }

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

    const updated = await this.userModel
      .findById(userId)
      .populate({
        path: 'departmentId',
        populate: { path: 'parentDepartmentId' },
      })
      .exec();

    if (!updated) {
      throw new UnauthorizedException('Không tìm thấy tài khoản sau khi lưu');
    }

    let permissions: string[] = [];
    if (updated.role === 'ADMIN') {
      permissions = [
        'VIEW_CHECKLIST', 'EDIT_CHECKLIST', 'INITIALIZE_SHIFT', 'CLOSE_SHIFT',
        'ACCESS_MARGIN_CHANGE', 'ACCESS_AUTO_SHIFT', 'ACCESS_HEALTH_CHECKS', 'RESOLVE_INCIDENTS',
        'MANAGE_TEMPLATES', 'MANAGE_USERS', 'MANAGE_ROLES', 'MANAGE_CALENDAR'
      ];
    } else {
      const roleDoc = await this.roleModel.findOne({ code: updated.role }).exec();
      if (roleDoc) {
        permissions = roleDoc.permissions || [];
      }
    }

    return {
      id: updated._id,
      username: updated.username,
      fullName: updated.fullName,
      title: updated.title || '',
      role: updated.role,
      department: updated.departmentId || null,
      isActive: updated.isActive,
      permissions,
      settings: updated.settings,
    };
  }

  createExchangeCode(token: string, user: any): string {
    const code = 'ex_' + crypto.randomBytes(16).toString('hex');
    this.exchangeCodes.set(code, {
      token,
      user,
      expiresAt: Date.now() + 60000, // Valid for 60 seconds
    });
    return code;
  }

  exchangeToken(code: string) {
    const data = this.exchangeCodes.get(code);
    if (!data) {
      throw new UnauthorizedException(
        'Mã xác thực không hợp lệ hoặc đã hết hạn.',
      );
    }
    if (data.expiresAt < Date.now()) {
      this.exchangeCodes.delete(code);
      throw new UnauthorizedException('Mã xác thực đã hết hạn.');
    }
    this.exchangeCodes.delete(code); // Single-use!
    return {
      access_token: data.token,
      user: data.user,
    };
  }

  async exchangeMicrosoftCodeForBot(code: string) {
    const tenantId =
      (await this.settingsService.getSetting('m365_tenant_id', '')) ||
      process.env.MICROSOFT_TENANT_ID ||
      'common';
    const clientId =
      (await this.settingsService.getSetting('m365_client_id', '')) ||
      process.env.MICROSOFT_CLIENT_ID;
    const clientSecret =
      (await this.settingsService.getSetting('m365_client_secret', '')) ||
      process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_CALLBACK_URL;

    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId || '',
          scope: 'Mail.Read Mail.ReadWrite offline_access',
          code: code,
          redirect_uri: redirectUri || '',
          grant_type: 'authorization_code',
          client_secret: clientSecret || '',
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json();
      throw new Error(
        errData.error_description || 'Không thể xác thực mã OAuth Bot với Microsoft.',
      );
    }

    return tokenResponse.json();
  }
}
