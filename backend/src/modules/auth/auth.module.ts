import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { User, UserSchema } from '../../schemas/user.schema';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { Division, DivisionSchema } from '../../schemas/division.schema';
import { AccessControlService } from './access-control.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Division.name, schema: DivisionSchema },
    ]), // khai báo models
    PassportModule, // module passport
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('CRITICAL CONFIGURATION ERROR: JWT_SECRET environment variable is not defined!');
        }
        return {
          secret: secret || 'trading_mxv_secret_key_2026',
          signOptions: { expiresIn: '1d' },
        };
      },
    }),
  ],
  providers: [AuthService, JwtStrategy, AccessControlService], // khai báo service và strategy
  controllers: [AuthController], // khai báo controller
  exports: [AuthService, MongooseModule, JwtModule, AccessControlService], // export các module và service
})
export class AuthModule { }

