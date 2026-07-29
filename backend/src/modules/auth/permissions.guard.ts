import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../schemas/role.schema';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Role.name) private readonly roleModel: Model<Role>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      throw new ForbiddenException('Yêu cầu đăng nhập để truy cập tài nguyên.');
    }

    // ADMIN bypasses all permission checks
    if (user.role === 'ADMIN') {
      return true;
    }

    // Fetch user permissions dynamically from the database
    let userPermissions = user.permissions;
    if (!userPermissions || !Array.isArray(userPermissions)) {
      const roleDoc = await this.roleModel.findOne({ code: user.role }).exec();
      userPermissions = roleDoc ? roleDoc.permissions || [] : [];
    }

    // Check if user has at least one of the required permissions (OR logic)
    const hasPermission = requiredPermissions.some((perm) =>
      userPermissions.includes(perm),
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        'Tài khoản không có quyền thực hiện chức năng này.',
      );
    }

    return true;
  }
}
