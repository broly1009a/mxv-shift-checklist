import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../schemas/user.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    const secret = process.env.JWT_SECRET;
    if (!secret && process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined!');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'trading_mxv_secret_key_2026',
    });
  }

  async validate(payload: any) {
    const user = await this.userModel
      .findById(payload.sub)
      .populate('departmentId')
      .populate('divisionId')
      .exec();
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return user; // Attached to request.user
  }
}
