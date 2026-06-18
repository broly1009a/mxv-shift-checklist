import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User, UserSchema } from '../../schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]), // khai báo model User
    PassportModule, // module passport
    JwtModule.register({  // module jwt
      secret: process.env.JWT_SECRET || 'trading_mxv_secret_key_2026',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, JwtStrategy], // khai báo service và strategy
  controllers: [AuthController], // khai báo controller
  exports: [AuthService, MongooseModule, JwtModule], // export các module
})
export class AuthModule { }
