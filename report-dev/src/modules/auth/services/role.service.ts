import { HandlerError, Identity } from "@svl/share";
import RoleModel from "../models/role.model";

const ROLE_STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
  DEPRECATED: "DEPRECATED",
} as const;

type RoleStatus = typeof ROLE_STATUS[keyof typeof ROLE_STATUS];

export interface UpdateRoleMetadataDto {
  code: string;
  name?: string;
  module?: string;
  action?: string;
  description?: string;
  status?: RoleStatus;
  sortOrder?: number;
}

function getSharePermissionCodes() {
  return Object.values(Identity.Enums.Permission).filter(
    (code) => code !== Identity.Enums.Permission.SUPER_ADMIN
  ) as string[];
}

function isConfigured(role: any) {
  return Boolean(role.name && role.module && role.action && role.description);
}

export async function listRoles() {
  const shareCodes = getSharePermissionCodes();
  const list = await RoleModel.find({
    code: {
      $in: shareCodes,
      $ne: Identity.Enums.Permission.SUPER_ADMIN,
    },
    status: ROLE_STATUS.ACTIVE,
    name: { $nin: [null, ""] },
    module: { $nin: [null, ""] },
    action: { $nin: [null, ""] },
    description: { $nin: [null, ""] },
  })
    .sort({ sortOrder: 1, module: 1, action: 1, code: 1 })
    .lean();

  return list;
}

export async function syncRolesFromShare(modifier = "system") {
  const shareCodes = getSharePermissionCodes();

  const bulkOps = shareCodes.map((code) => ({
    updateOne: {
      filter: { code },
      update: {
        $setOnInsert: {
          code,
          name: "",
          module: "",
          action: "",
          description: "",
          status: ROLE_STATUS.ACTIVE,
          source: "SHARE",
          isSystem: true,
          sortOrder: 0,
          createdBy: modifier,
        },
      },
      upsert: true,
    },
  }));

  const result = bulkOps.length ? await RoleModel.bulkWrite(bulkOps) : null;

  const deprecatedResult = await RoleModel.updateMany(
    {
      code: { $nin: shareCodes },
      source: "SHARE",
      status: { $ne: ROLE_STATUS.DEPRECATED },
    },
    {
      $set: {
        status: ROLE_STATUS.DEPRECATED,
        lastModifiedBy: modifier,
      },
    }
  );

  return {
    totalInShare: shareCodes.length,
    inserted: result?.upsertedCount || 0,
    matched: result?.matchedCount || 0,
    modified: result?.modifiedCount || 0,
    deprecated: deprecatedResult.modifiedCount || 0,
  };
}

export async function listRoleCatalog() {
  const shareCodes = getSharePermissionCodes();
  const roles = await RoleModel.find({})
    .sort({ sortOrder: 1, module: 1, action: 1, code: 1 })
    .lean();

  return roles.map((role) => ({
    ...role,
    isInShare: shareCodes.includes(role.code),
    isConfigured: isConfigured(role),
  }));
}

export async function updateRolesMetadata(
  roles: UpdateRoleMetadataDto[],
  modifier = "system"
) {
  const shareCodes = getSharePermissionCodes();
  const invalidCodes = roles
    .map((role) => role.code)
    .filter((code) => !shareCodes.includes(code));

  if (invalidCodes.length > 0) {
    throw new HandlerError(`Permission code does not exist in share: ${invalidCodes.join(", ")}`);
  }

  const existingRoles = await RoleModel.find({
    code: { $in: roles.map((role) => role.code) },
  })
    .select({ code: 1 })
    .lean();
  const existingCodes = existingRoles.map((role) => role.code);
  const missingCodes = roles
    .map((role) => role.code)
    .filter((code) => !existingCodes.includes(code));

  if (missingCodes.length > 0) {
    throw new HandlerError(`Permission code has not been synced to DB: ${missingCodes.join(", ")}`);
  }

  const bulkOps = roles.map((role) => {
    const update: any = {
      lastModifiedBy: modifier,
    };

    if (role.name !== undefined) update.name = role.name;
    if (role.module !== undefined) update.module = role.module;
    if (role.action !== undefined) update.action = role.action;
    if (role.description !== undefined) update.description = role.description;
    if (role.status !== undefined) update.status = role.status;
    if (role.sortOrder !== undefined) update.sortOrder = role.sortOrder;

    return {
      updateOne: {
        filter: { code: role.code },
        update: { $set: update },
      },
    };
  });

  const result = await RoleModel.bulkWrite(bulkOps);

  return {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  };
}
