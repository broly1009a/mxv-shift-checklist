import { Types } from "mongoose";
import { MongoQuery, PaginationService, PaginationExcelExporter } from "@mss/common";
import { authDB } from "../utils/redis.util";
import { Identity, Session, HandlerError, Audit } from "@svl/share";
import GroupRoleModel from "../models/groupRole.model";
import UserModel from "../models/user.model";
import { NewGroupRoleDto, UpdateGroupRoleDto, AssignRoleToGroupRoleDto } from "../dto";
import type { AuditRecorder } from "@/shared";
import { logger } from "@/loggers/winstonLogger";
import dictionary from "../groupRole/dictionary.json";

const noopAuditRecorder: AuditRecorder = {
  writeLog: async () => undefined,
  updateResult: async () => undefined,
  executeWithAudit: async <T>(_log: any, _owner: string, operation: () => Promise<T>): Promise<T> => {
    return operation();
  }
};

let auditRecorder = noopAuditRecorder;

export function setGroupRoleAuditRecorder(recorder?: AuditRecorder) {
  auditRecorder = recorder || noopAuditRecorder;
}

export async function createGroupRole(
  newGroupRole: NewGroupRoleDto,
  createdBy: string,
  correlationId?: string,
  deviceInfo?: any
) {
  const existGroupRole = await GroupRoleModel.findOne({
    name: newGroupRole.name,
  });
  if (existGroupRole) {
    throw new HandlerError(`Group role ${newGroupRole.name} đã tồn tại`);
  }

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId || '',
    title: `Tạo nhóm quyền ${newGroupRole.name}`,
    content: `Tạo mới nhóm quyền ${newGroupRole.name}`,
    action: Audit.Enums.AuditAction.CREATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { name: newGroupRole.name },
      metadata: {}
    }
  };

  try {
    const createdGroupRole = await auditRecorder.executeWithAudit(
      auditLog,
      createdBy,
      async () => {
        return await GroupRoleModel.create({
          ...newGroupRole,
          status: newGroupRole.status || Identity.Enums.GroupRoleStatus.ACTIVE,
          createdBy,
        });
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return createdGroupRole;
  } catch (error) {
    logger.error(`createGroupRole audit failed for groupRole ${newGroupRole.name}: ${error}`);
    throw error;
  }
}

export async function getGroupRoleById(_id: string) {
  let groupRole: any = await GroupRoleModel.findById(_id)
    .select({
      name: 1,
      description: 1,
      status: 1,
      role: 1,
    })
    .lean();
  if (!groupRole) throw new HandlerError("Nhóm quyền không tồn tại");

  groupRole = {
    ...groupRole,
    functions: groupRole.role || [],
  };
  return groupRole;
}

export async function updateGroupRole(
  id: string,
  updateDto: UpdateGroupRoleDto,
  modifier: string,
  correlationId?: string,
  deviceInfo?: any
) {
  const groupRole = await GroupRoleModel.findById(id);
  if (!groupRole) throw new HandlerError("Nhóm quyền không tồn tại");

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId || '',
    title: `Cập nhật nhóm quyền ${groupRole.name}`,
    content: `Cập nhật thông tin nhóm quyền ${groupRole.name}`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { groupRoleId: groupRole._id.toString(), name: groupRole.name, updates: updateDto },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        Object.assign(groupRole, updateDto);
        groupRole.lastModifiedBy = modifier;

        await groupRole.save();

        const cacheUser = await authDB.scanAllKeys("session");
        const userId = cacheUser.map((session) => {
          const idStr = session.slice(8);
          return new Types.ObjectId(idStr);
        });

        const users = await UserModel.aggregate([
          {
            $match: {
              _id: { $in: userId },
            },
          },
          {
            $match: {
              groupRole: { $in: [groupRole._id] },
            },
          },
        ]);

        for (const user of users) {
          await Session.userSession.clearAllLoginSessions(user._id.toString());
        }

        return groupRole;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`updateGroupRole audit failed for groupRole ${id}: ${error}`);
    throw error;
  }
}

export async function assignRoleToGroupRole(
  id: string,
  dto: AssignRoleToGroupRoleDto,
  modifier: string,
  correlationId?: string,
  deviceInfo?: any
) {
  if (!dto || !Array.isArray(dto.role)) {
    throw new HandlerError("role invalid");
  }
  for (const r of dto.role) {
    if (typeof r !== "string" || r.trim() === "") {
      throw new HandlerError("role invalid");
    }
  }

  const groupRole = await GroupRoleModel.findById(id);
  if (!groupRole) throw new HandlerError("Nhóm quyền không tồn tại");

  const auditLog: Audit.Helpers.AuditLog = {
    correlation_id: correlationId || '',
    title: `Gán quyền cho nhóm quyền ${groupRole.name}`,
    content: `Gán quyền cho nhóm quyền ${groupRole.name}`,
    action: Audit.Enums.AuditAction.UPDATE,
    time: new Date().toISOString(),
    device_info: deviceInfo ? {
      ip: deviceInfo.ip || 'Unknown',
      client: deviceInfo.client || 'Unknown',
      os: deviceInfo.os || 'Unknown',
      device: deviceInfo.device || 'Unknown'
    } : undefined,
    attach_data: {
      raw: { groupRoleId: groupRole._id.toString(), name: groupRole.name, roles: dto.role },
      metadata: {}
    }
  };

  try {
    const result = await auditRecorder.executeWithAudit(
      auditLog,
      modifier,
      async () => {
        groupRole.role = dto.role;
        groupRole.lastModifiedBy = modifier;

        await groupRole.save();

        const cacheUser = await authDB.scanAllKeys("session");
        const userId = cacheUser.map((session) => {
          const idStr = session.slice(8);
          return new Types.ObjectId(idStr);
        });

        const users = await UserModel.aggregate([
          {
            $match: {
              _id: { $in: userId },
            },
          },
          {
            $match: {
              groupRole: { $in: [groupRole._id] },
            },
          },
        ]);

        for (const user of users) {
          await Session.userSession.clearAllLoginSessions(user._id.toString());
        }

        return groupRole;
      },
      Audit.Enums.AuditCreatedBy.USER
    );
    return result;
  } catch (error) {
    logger.error(`assignRoleToGroupRole audit failed for groupRole ${id}: ${error}`);
    throw error;
  }
}

export async function getListGroupRole(query: MongoQuery) {
  const pagination = new PaginationService(GroupRoleModel);
  const listGroupRole = await pagination.paginate(query);

  const data = listGroupRole.data.map((gr: any) => {
    const obj = typeof gr.toObject === 'function' ? gr.toObject() : gr;

    return {
      ...obj,
      role: gr?.role || [],
    };
  });

  listGroupRole.data = data;

  return listGroupRole;
}

export async function getListGroupRoleExcel(query: MongoQuery) {
  const queryAggregate = [
    {
      $project: {
        name: 1,
        description: 1,
        status: 1,
        memberCode: 1,
      },
    },
  ];

  const exporter = new PaginationExcelExporter(GroupRoleModel);
  const stream = await exporter.exportStream(
    query,
    {
      headers: [
        {
          key: "name",
          title: "Tên nhóm quyền",
        },
        {
          key: "description",
          title: "Mô tả",
        },
        {
          key: "status",
          title: "Trạng thái",
        },
      ],
      globalDictionary: dictionary,
      aggregate: queryAggregate,
      select: "-memberCode -_id",
    }
  );

  return stream;
}
