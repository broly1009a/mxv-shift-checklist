import { Types } from "mongoose";
import { MongoQuery, PaginationService } from "@mss/common";
import { Identity, Session, HandlerError, Audit } from "@svl/share";
import UserModel from "../models/user.model";
import { cacheDB } from "../utils/redis.util";
import { REDIS_KEYS } from "../constants/redisKey.constant";
import { NewUserDto, UpdateProfileDto, AssignRolesDto, AssignGroupRolesDto } from "../dto";
import type { AuditRecorder } from "@/shared";
import { logger } from "@/loggers/winstonLogger";

const INITIALIZE_USERNAMES = ["admin", "itadmin"];

const noopAuditRecorder: AuditRecorder = {
  writeLog: async () => undefined,
  updateResult: async () => undefined,
  executeWithAudit: async <T>(_log: any, _owner: string, operation: () => Promise<T>): Promise<T> => {
    return operation();
  }
};

let auditRecorder = noopAuditRecorder;

export function setUserAuditRecorder(recorder?: AuditRecorder) {
  auditRecorder = recorder || noopAuditRecorder;
}

export async function listUser(query: MongoQuery) {
  query.filter = {
    $and: [
      query.filter || {},
      { username: { $nin: INITIALIZE_USERNAMES } },
    ],
  };

  const pagination = new PaginationService(UserModel);
  const list = await pagination.paginate(query);
  return list;
}

export async function getMe(currentUser: any) {
  const user = await UserModel.findById(currentUser?.id, {
    password: 0,
    userRoles: 0,
  }).populate("department", "name");

  if (!user) {
    throw new HandlerError(`Người dùng ${currentUser?.id} không tồn tại`);
  }
  return user;
}

export async function newUser(createDto: NewUserDto, createdBy: string, correlationId: string, deviceInfo?: any) {
  const emailExist = await UserModel.findOne({
    email: createDto.email,
  });

  if (emailExist)
    throw new HandlerError(`Email ${createDto.email} đã được sử dụng`);

  const usernameExist = await UserModel.findOne({
    username: createDto.username,
  });

  if (usernameExist)
    throw new HandlerError(`Username ${createDto.username} đã được sử dụng`);

  const password = "Mxv@2026";
  const PIN = "123456";

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Tạo user ${createDto.username}`,
    content: `Tạo mới user ${createDto.username} (${createDto.email})`,
    action: Audit.Enums.AuditAction.CREATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { username: createDto.username, email: createDto.email },
      metadata: {}
    }
  };

  try {
    const createdUser = await auditRecorder.executeWithAudit(
      auditLog,
      createdBy,
      async () => {
        return await UserModel.create({
          ...createDto,
          PIN,
          password,
          status: Identity.Enums.UserStatus.ACTIVE,
          type: createDto.type,
          createdBy,
          joinDepartmentTime: Date.now(),
        });
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return createdUser;
  } catch (error) {
    logger.error(`newUser audit failed for username ${createDto.username}: ${error}`);
    throw error;
  }
}

export async function getUser(id: string) {
  const user = await UserModel.findById(id, {
    password: 0,
    salt: 0,
    secret: 0,
    lastModifiedBy: 0,
    updatedAt: 0,
    createdBy: 0,
    version: 0,
  });

  if (!user) {
    throw new HandlerError(`Tài khoản ${id} không tồn tại`);
  }

  user.role = user.role || [];

  return user;
}

export async function updateProfile(id: string, updateDto: UpdateProfileDto, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id).select(
    "fullname avatar phoneNumber username version status lastModifiedBy type memberCode requirePasswordExpired email"
  );
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  if (updateDto.email && updateDto.email !== user.email) {
    const emailExist = await UserModel.findOne({ email: updateDto.email, _id: { $ne: user._id } });
    if (emailExist) {
      throw new HandlerError(`Email ${updateDto.email} đã được sử dụng`);
    }
  }

  const { fullname, avatar, phoneNumber, email, status } = updateDto;
  const updateData: any = {};
  if (fullname !== undefined) updateData.fullname = fullname;
  if (avatar !== undefined) updateData.avatar = avatar;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
  if (email !== undefined) updateData.email = email;
  if (status !== undefined) updateData.status = status;

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Cập nhật profile user ${user.username}`,
    content: `Cập nhật thông tin profile user ${user.username}`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username, updates: updateData },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        Object.assign(user, updateData);
        user.lastModifiedBy = modifier;
        await user.save();

        await cacheDB.del(REDIS_KEYS.AUDIT_TAG(user._id.toString()));

        return user;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`updateProfile audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function assignRoles(id: string, dto: AssignRolesDto, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Gán quyền cho user ${user.username}`,
    content: `Gán quyền cho user ${user.username}`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username, roles: dto.userRoles },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        user.role = dto.userRoles;
        user.lastModifiedBy = modifier;
        await user.save();

        await Session.userSession.clearAllLoginSessions(user._id.toString());

        return user;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`assignRoles audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function assignGroupRoles(id: string, dto: AssignGroupRolesDto, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Gán nhóm quyền cho user ${user.username}`,
    content: `Gán nhóm quyền cho user ${user.username}`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username, groupRoles: dto.groupRoles },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        user.groupRole = dto.groupRoles.map(
          (gr) => new Types.ObjectId(gr.id)
        );
        user.lastModifiedBy = modifier;
        await user.save();

        await Session.userSession.clearAllLoginSessions(user._id.toString());

        return user;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`assignGroupRoles audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function deleteUser(id: string, modifier: string, correlationId: string, deviceInfo?: any) {
  const user = await UserModel.findById(id);

  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId,
    title: `Xóa/Deactivate user ${user.username}`,
    content: `Xóa/Deactivate user ${user.username} (${user.email}), chuyển sang trạng thái INACTIVE`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { userId: user._id.toString(), username: user.username, email: user.email, previousStatus: user.status, newStatus: Identity.Enums.UserStatus.INACTIVE },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        user.status = Identity.Enums.UserStatus.INACTIVE;
        await user.save();

        await Session.userSession.clearAllLoginSessions(id);
        await cacheDB.del(REDIS_KEYS.AUDIT_TAG(id));

        return { id: user.id, email: user.email };
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`deleteUser audit failed for user ${id}: ${error}`);
    throw error;
  }
}

export async function getAuditTags(id: string) {
  const cacheKey = REDIS_KEYS.AUDIT_TAG(id);
  const cachedUser = await cacheDB.get(cacheKey);
  if (cachedUser) {
    return cachedUser;
  }

  const user = await UserModel.findById(id).select(
    "fullname username avatar status"
  );

  if (!user) {
    throw new HandlerError(`Người dùng ${id} không tồn tại`);
  }

  await cacheDB.setDebounce(cacheKey, user, 86400);

  return user;
}
