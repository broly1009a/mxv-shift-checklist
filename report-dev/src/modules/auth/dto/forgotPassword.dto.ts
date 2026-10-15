import { checkSchema } from "express-validator";

export interface ForgotPasswordDto {
  username: string;
}

export interface ResetPasswordByTokenDto {
  token: string;
  newPassword: string;
}

export interface VerifyResetTokenDto {
  token: string;
}

export const forgotPasswordDto = checkSchema({
  username: {
    isString: {
      errorMessage: "Tên đăng nhập phải là một chuỗi ký tự",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "Tên đăng nhập không được để trống",
    },
    trim: true,
  },
});

export const resetPasswordByTokenDto = checkSchema({
  token: {
    isString: {
      errorMessage: "Token phải là một chuỗi ký tự",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "Token không được để trống",
    },
  },
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
});

export const verifyResetTokenDto = checkSchema({
  token: {
    isString: {
      errorMessage: "Token phải là một chuỗi ký tự",
    },
    isLength: {
      options: { min: 1 },
      errorMessage: "Token không được để trống",
    },
  },
});
