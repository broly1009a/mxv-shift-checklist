import { checkSchema } from "express-validator";

const ROLE_STATUSES = ["ACTIVE", "INACTIVE", "DEPRECATED"];

export const updateRolesDto = checkSchema({
  roles: {
    isArray: {
      errorMessage: "roles must be an array",
    },
    custom: {
      options: (value) => {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error("roles must be a non-empty array");
        }

        for (const role of value) {
          if (!role || typeof role !== "object") {
            throw new Error("role must be an object");
          }

          if (!role.code || typeof role.code !== "string") {
            throw new Error("role.code must be a string");
          }

          if (role.name !== undefined && typeof role.name !== "string") {
            throw new Error("role.name must be a string");
          }

          if (role.module !== undefined && typeof role.module !== "string") {
            throw new Error("role.module must be a string");
          }

          if (role.action !== undefined && typeof role.action !== "string") {
            throw new Error("role.action must be a string");
          }

          if (
            role.description !== undefined &&
            typeof role.description !== "string"
          ) {
            throw new Error("role.description must be a string");
          }

          if (role.status !== undefined && !ROLE_STATUSES.includes(role.status)) {
            throw new Error("role.status invalid");
          }

          if (role.sortOrder !== undefined && typeof role.sortOrder !== "number") {
            throw new Error("role.sortOrder must be a number");
          }
        }

        return true;
      },
      errorMessage: "roles invalid",
    },
  },
});
