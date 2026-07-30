import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department } from '../../schemas/department.schema';
import { Role } from '../../schemas/role.schema';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(Role.name)
    private readonly roleModel: Model<Role>,
  ) {}

  /**
   * Generates a MongoDB query filter to restrict entities by the user's organizational scope.
   * Returns:
   * - `{}` for general admins (ADMIN, CEO, CHAIRMAN)
   * - `{ departmentId: ... }` for DEPARTMENT_HEAD or STAFF
   */
  async getScopeFilter(user: any): Promise<any> {
    if (!user) return { _id: null }; // Fail closed

    const { role, departmentId } = user;

    if (
      role === 'ADMIN' ||
      role === 'CEO' ||
      role === 'CHAIRMAN' ||
      role === 'DIVISION_DIRECTOR'
    ) {
      return {};
    }

    const deptId = departmentId?._id || departmentId;
    if (!deptId) return { _id: null };

    return {
      departmentId: {
        $in: [new Types.ObjectId(deptId.toString()), deptId.toString()],
      },
    };
  }

  /**
   * Validates if a user is allowed to access/mutate a resource belonging to a specific department.
   * Throws ForbiddenException if not authorized.
   */
  validateScope(
    user: any,
    resourceDeptId: string | Types.ObjectId | null,
  ): boolean {
    if (!user) {
      throw new ForbiddenException('Yêu cầu đăng nhập để truy cập tài nguyên.');
    }

    const { role } = user;

    // General admins can access everything
    if (role === 'ADMIN' || role === 'CEO' || role === 'CHAIRMAN') {
      return true;
    }

    const userDeptIdStr =
      (user.departmentId?._id || user.departmentId)?.toString() || null;

    // DEPARTMENT_HEAD and STAFF must match department
    const targetDeptIdStr = resourceDeptId?.toString();
    if (!userDeptIdStr || userDeptIdStr !== targetDeptIdStr) {
      throw new ForbiddenException(
        'Tài khoản không thuộc phòng ban quản lý của tài nguyên này.',
      );
    }

    return true;
  }

  /**
   * Checks if a user has permission to access a specific feature based on their dynamic role permissions.
   */
  async canAccessFeature(
    user: any,
    feature: string,
  ): Promise<boolean> {
    if (!user) return false;

    const { role } = user;
    if (role === 'ADMIN') return true;

    // Map legacy static feature codes to new standard permission keys
    let permissionKey = feature;
    if (feature === 'MARGIN_CHANGE') permissionKey = 'ACCESS_MARGIN_CHANGE';
    if (feature === 'AUTO_SHIFT') permissionKey = 'ACCESS_AUTO_SHIFT';
    if (feature === 'HEALTH_CHECKS') permissionKey = 'ACCESS_HEALTH_CHECKS';

    // Retrieve Role from DB
    const roleDoc = await this.roleModel.findOne({ code: role }).exec();
    if (!roleDoc) return false;

    return roleDoc.permissions && roleDoc.permissions.includes(permissionKey);
  }
}
