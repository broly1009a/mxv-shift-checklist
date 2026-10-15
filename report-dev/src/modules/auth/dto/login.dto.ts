import { checkSchema } from "express-validator";

export interface LoginDto {
  username: string;
  password: string;
}

export interface VerifyPINDto {
  PIN: string;
}

export const loginDto = checkSchema({
  username: {
    isString: {
      errorMessage: "username must be a string",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "Tên đăng nhập không được để trống",
    },
  },
  password: {
    isString: {
      errorMessage: "password must be a string",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "Mật khẩu không được để trống",
    },
  },
});

export const verifyPINDto = checkSchema({
  PIN: {
    isString: {
      errorMessage: "PIN must be a string",
    },
  },
});
