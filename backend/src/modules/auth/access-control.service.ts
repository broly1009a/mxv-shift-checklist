import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Department } from '../../schemas/department.schema';
import { Division } from '../../schemas/division.schema';

@Injectable()
export class AccessControlService {
  constructor(
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(Division.name)
    private readonly divisionModel: Model<Division>,
  ) {}

  /**
   * Generates a MongoDB query filter to restrict entities by the user's organizational scope.
   * Returns:
   * - `{}` for general admins (ADMIN, CEO, CHAIRMAN)
   * - `{ departmentId: { $in: [...] } }` for DIVISION_DIRECTOR
   * - `{ departmentId: ... }` for DEPARTMENT_HEAD or STAFF
   */
  async getScopeFilter(user: any): Promise<any> {
    if (!user) return { _id: null }; // Fail closed

    const { role, divisionId, departmentId } = user;

    if (role === 'ADMIN' || role === 'CEO' || role === 'CHAIRMAN') {
      return {};
    }

    if (role === 'DIVISION_DIRECTOR') {
      const divId = divisionId?._id || divisionId;
      if (!divId) return { _id: null };

      const depts = await this.departmentModel
        .find({ divisionId: new Types.ObjectId(divId.toString()) })
        .exec();
      const deptIds = depts.map((d) => d._id);
      return { departmentId: { $in: deptIds } };
    }

    const deptId = departmentId?._id || departmentId;
    if (!deptId) return { _id: null };

    return { departmentId: new Types.ObjectId(deptId.toString()) };
  }

  /**
   * Validates if a user is allowed to access/mutate a resource belonging to a specific department and division.
   * Throws ForbiddenException if not authorized.
   */
  validateScope(
    user: any,
    resourceDeptId: string | Types.ObjectId | null,
    resourceDivId: string | Types.ObjectId | null,
  ): boolean {
    if (!user) {
      throw new ForbiddenException('Yêu cầu đăng nhập để truy cập tài nguyên.');
    }


    const { role } = user;

    // General admins can access everything
    if (role === 'ADMIN' || role === 'CEO' || role === 'CHAIRMAN') {
      return true;
    }

    const userDivIdStr = (user.divisionId?._id || user.divisionId)?.toString() || null;
    const userDeptIdStr = (user.departmentId?._id || user.departmentId)?.toString() || null;

    if (role === 'DIVISION_DIRECTOR') {
      // Must match division
      const targetDivIdStr = resourceDivId?.toString();
      if (!userDivIdStr || userDivIdStr !== targetDivIdStr) {
        throw new ForbiddenException(
          'Tài khoản không thuộc khối quản lý của tài nguyên này.',
        );
      }
      return true;
    }

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
   * Checks if a user has permission to access a specific feature based on their role/division.
   * Features:
   * - 'MARGIN_CHANGE': only TRADE_DIVISION (QLGD) or general admins (ADMIN, CEO, CHAIRMAN)
   * - 'AUTO_SHIFT': only IT_DIVISION or general admins (ADMIN)
   * - 'HEALTH_CHECKS': only IT_DIVISION or general admins (ADMIN)
   */
  async canAccessFeature(
    user: any,
    feature: 'MARGIN_CHANGE' | 'AUTO_SHIFT' | 'HEALTH_CHECKS',
  ): Promise<boolean> {
    if (!user) return false;

    const { role } = user;
    if (role === 'ADMIN') return true;
    if ((role === 'CEO' || role === 'CHAIRMAN') && feature === 'MARGIN_CHANGE') {
      return true;
    }

    // Get the division code
    let divisionCode = user.divisionId?.code;
    if (!divisionCode && user.divisionId) {
      const div = await this.divisionModel.findById(user.divisionId).exec();
      divisionCode = div?.code;
    }

    if (!divisionCode) return false;

    if (feature === 'MARGIN_CHANGE') {
      return divisionCode === 'TRADE_DIVISION';
    }

    if (feature === 'AUTO_SHIFT' || feature === 'HEALTH_CHECKS') {
      return divisionCode === 'IT_DIVISION';
    }

    return false;
  }
}
