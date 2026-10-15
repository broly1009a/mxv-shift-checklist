import { Identity } from "@svl/share";
import { checkSchema } from "express-validator";

export interface UpdateProfileDto {
  fullname?: string;
  avatar?: string;
  phoneNumber?: string;
  email?: string;
  status?: Identity.Enums.UserStatus;
}

export interface AssignRolesDto {
  userRoles: string[];
}

export interface AssignGroupRolesDto {
  groupRoles: { description?: string; id: string }[];
}

export const updateProfileDto = checkSchema({
  fullname: {
    isString: {
      errorMessage: "fullname must be a string",
    },
    isLength: {
      options: { max: 255 },
      errorMessage: "fullname only allowed up to 255 characters",
    },
    optional: true,
  },
  avatar: {
    isString: {
      errorMessage: "avatar must be a string",
    },
    optional: true,
  },
  phoneNumber: {
    isString: {
      errorMessage: "phoneNumber must be a string",
    },
    optional: true,
  },
  email: {
    isEmail: {
      errorMessage: "email incorrect format",
    },
    optional: true,
  },
  status: {
    isString: true,
    isIn: {
      options: [Object.values(Identity.Enums.UserStatus)],
      errorMessage: "status invalid",
    },
    optional: true,
  },
});

export const assignRolesDto = checkSchema({
  userRoles: {
    isArray: {
      errorMessage: "userRoles must be an array",
    },
    custom: {
      options: (value) => {
        if (!Array.isArray(value)) {
          throw new Error("userRoles must be an array");
        }
        for (let i = 0; i < value.length; i++) {
          const role = value[i];
          if (typeof role !== "string" || role.trim() === "") {
            throw new Error("role must be a non-empty string");
          }
        }
        return true;
      },
      errorMessage: "userRoles invalid",
    },
  },
});

export const assignGroupRolesDto = checkSchema({
  groupRoles: {
    isArray: {
      errorMessage: "groupRoles must be an array",
    },
    custom: {
      options: (value) => {
        if (!Array.isArray(value)) {
          throw new Error("groupRoles must be an array");
        }
        for (let i = 0; i < value.length; i++) {
          const gr = value[i];
          if (!gr || typeof gr !== "object") {
            throw new Error("groupRole must be an object");
          }
          if (gr.description !== undefined && typeof gr.description !== "string") {
            throw new Error("description must be a string");
          }
          if (typeof gr.id !== "string" || gr.id.trim() === "") {
            throw new Error("id must be a non-empty string");
          }
        }
        return true;
      },
      errorMessage: "groupRoles invalid",
    },
  },
});

export interface ChangePasswordDto {
  newPassword: string;
  oldPassword: string;
}

export interface ChangePINDto {
  password: string;
  newPIN: string;
}

export const changePasswordDto = checkSchema({
  newPassword: {
    isString: {
      errorMessage: "Mật khẩu mới phải là một chuỗi ký tự",
    },
    isLength: {
      options: { min: 8 },
      errorMessage: "Mật khẩu mới phải có ít nhất 8 ký tự",
    },
    custom: {
      options: (value) => {
        if (!/[A-Z]/.test(value)) {
          throw new Error(
            "Mật khẩu mới phải chứa ít nhất một chữ cái viết hoa"
          );
        }
        if (!/[0-9]/.test(value)) {
          throw new Error("Mật khẩu mới phải chứa ít nhất một chữ số");
        }
        if (!/[!@#$%^&*()\-=_+]/.test(value)) {
          throw new Error(
            "Mật khẩu mới phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*()-=_+)"
          );
        }
        return true;
      },
    },
  },
  oldPassword: {
    isString: {
      errorMessage: "Mật khẩu cũ phải là một chuỗi ký tự",
    },
  },
});

export const changePINDto = checkSchema({
  password: {
    isString: {
      errorMessage: "password must be a string",
    },
  },
  newPIN: {
    isString: {
      errorMessage: "newPIN must be a string",
    },
    isLength: {
      options: { min: 6, max: 6 },
      errorMessage: "PIN phải 6 ký tự",
    },
  },
});
