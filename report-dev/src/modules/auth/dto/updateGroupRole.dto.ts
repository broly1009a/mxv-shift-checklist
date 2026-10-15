import { checkSchema } from "express-validator";
import { Identity } from "@svl/share";

export interface UpdateGroupRoleDto {
  description?: string;
  status?: Identity.Enums.GroupRoleStatus;
}

export interface AssignRoleToGroupRoleDto {
  role: string[];
}

export const updateGroupRoleDto = checkSchema({
  description: {
    isString: {
      errorMessage: "description must be a string",
    },
    optional: true,
  },
  status: {
    isString: {
      errorMessage: "status must be a string",
    },
    isIn: {
      options: [
        [
          Identity.Enums.GroupRoleStatus.ACTIVE,
          Identity.Enums.GroupRoleStatus.INACTIVE,
        ],
      ],
      errorMessage: "status invalid",
    },
    optional: true,
  },
  role: {
    isArray: {
      errorMessage: "function must be an array",
    },
    optional: true,
  },
});

export const assignRoleToGroupRoleDto = checkSchema({
  role: {
    isArray: {
      errorMessage: "role must be an array",
    },
    custom: {
      options: (value) => {
        if (!Array.isArray(value)) {
          throw new Error("role must be an array");
        }
        for (let i = 0; i < value.length; i++) {
          const r = value[i];
          if (typeof r !== "string" || r.trim() === "") {
            throw new Error("role items must be non-empty strings");
          }
        }
        return true;
      },
    },
  },
});
