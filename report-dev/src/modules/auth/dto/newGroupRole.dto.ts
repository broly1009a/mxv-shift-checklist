import { checkSchema } from "express-validator";
import { Identity } from "@svl/share";

export interface NewGroupRoleDto {
  name: string;
  description?: string;
  status?: Identity.Enums.GroupRoleStatus;
  role?: string[];
}

export const newGroupRoleDto = checkSchema({
  name: {
    isString: {
      errorMessage: "name must be a string",
    },
  },
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
    custom: {
      options: (value) => {
        if (!Array.isArray(value)) {
          throw new Error("function must be an array");
        }
        for (let i = 0; i < value.length; i++) {
          const role = value[i];
          if (!role || typeof role !== "string") {
            throw new Error("role must be a string");
          }
        }
        return true;
      },
      errorMessage: "role invalid",
    },
    optional: true,
  },
});
