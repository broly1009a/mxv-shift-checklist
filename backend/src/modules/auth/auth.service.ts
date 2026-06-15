import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
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
    const user = await this.userModel.findOne({ username }).populate('departmentId').exec();
    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản của bạn chưa được kích hoạt hoặc đã bị khóa. Vui lòng liên hệ Admin.');
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
      divisionId: user.divisionId?._id || user.divisionId || null
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
          alertThresholdMinutes: 15
        },
      },
    };
  }

  async register(username: string, pass: string, fullName: string, departmentId: string, role: string) {
    const existing = await this.userModel.findOne({ username }).exec();
    if (existing) {
      throw new ConflictException('Username already exists');
    }
    const passwordHash = await bcrypt.hash(pass, 10);
    const created = new this.userModel({
      username,
      passwordHash,
      fullName,
      departmentId: departmentId || null,
      role,
      isActive: true, // Manually registered users are active by default
    });
    await created.save();
    return created;
  }

  async validateMicrosoftSSO(email: string, fullName: string): Promise<any> {
    if (!email || !email.endsWith('@mxv.vn')) {
      throw new UnauthorizedException('Email không thuộc tên miền Sở MXV (@mxv.vn)');
    }

    const username = email.split('@')[0];
    
    // Check if user already exists
    let user = await this.userModel.findOne({ username }).populate('departmentId').exec();
    
    if (user) {
      // User exists - check activation status
      if (!user.isActive) {
        throw new UnauthorizedException('Tài khoản của bạn đang chờ Admin kích hoạt và gán phòng ban.');
      }
      return user;
    }
    
    // User does not exist - create automatically in pending status
    const dummyHash = await bcrypt.hash('dummy_sso_pass_2026', 10);
    const isInitialAdmin = username === 'admin_sso';
    
    const newUser = new this.userModel({
      username,
      passwordHash: dummyHash,
      fullName: fullName || `${username.charAt(0).toUpperCase() + username.slice(1)} (M365)`,
      departmentId: null, // Waiting for admin assignment
      role: isInitialAdmin ? 'ADMIN' : 'STAFF',
      isActive: isInitialAdmin ? true : false, // Initial admin is active, others wait for admin approval
    });
    
    await newUser.save();
    
    throw new UnauthorizedException('Tài khoản đã được tạo tự động từ Microsoft 365 và đang chờ Admin kích hoạt, gán phòng ban.');
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
        theme: data.settings.theme !== undefined ? data.settings.theme : user.settings?.theme || 'dark',
        autoRefreshInterval: data.settings.autoRefreshInterval !== undefined ? Number(data.settings.autoRefreshInterval) : user.settings?.autoRefreshInterval || 30,
        telegramNotifications: data.settings.telegramNotifications !== undefined ? !!data.settings.telegramNotifications : user.settings?.telegramNotifications ?? true,
        telegramChatId: data.settings.telegramChatId !== undefined ? data.settings.telegramChatId : user.settings?.telegramChatId || '',
        alertThresholdMinutes: data.settings.alertThresholdMinutes !== undefined ? Number(data.settings.alertThresholdMinutes) : user.settings?.alertThresholdMinutes || 15,
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
