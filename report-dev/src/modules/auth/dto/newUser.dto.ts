import { checkSchema } from "express-validator";
import { Identity } from "@svl/share";

export interface NewUserDto {
  _id?: string;
  email: string;
  username: string;
  fullname: string;
  avatar?: string;
  type: Identity.Enums.UserType;
  phoneNumber: string;
  status?: Identity.Enums.UserStatus;
  department?: string;
  note?: string;
}

export const newUserDto = checkSchema({
  email: {
    isEmail: {
      errorMessage: "email incorrect format",
    },
  },
  username: {
    isString: {
      errorMessage: "username must be a string",
    },
    isLength: {
      options: { min: 6, max: 30 },
      errorMessage: "username must be at least 6 characters and only allowed up to 30 characters",
    },
    matches: {
      options: [/^[a-zA-Z0-9_]+$/],
      errorMessage: "username only allow string, number and underscore (_)",
    },
  },
  fullname: {
    isString: {
      errorMessage: "name must be a string",
    },
    isLength: {
      options: { max: 255 },
      errorMessage: "name only allowed up to 255 characters",
    },
  },
  avatar: {
    isString: {
      errorMessage: "avatar must be a string",
    },
    optional: true,
  },
  type: {
    isInt: {
      errorMessage: "type must be an integer",
    },
    isIn: {
      options: [
        Object.values(Identity.Enums.UserType),
      ],
      errorMessage: "type invalid",
    },
    optional: true,
  },
  phoneNumber: {
    isString: {
      errorMessage: "phone must be a string",
    },
  },
  status: {
    isString: true,
    isIn: {
      options: [[Identity.Enums.UserStatus.ACTIVE, Identity.Enums.UserStatus.INACTIVE]],
      errorMessage: "status invalid",
    },
    optional: true,
  },
  department: {
    isString: {
      errorMessage: "department must be a string",
    },
    optional: true,
  },
  note: {
    isString: {
      errorMessage: "note must be a string",
    },
    optional: true,
  },
});
