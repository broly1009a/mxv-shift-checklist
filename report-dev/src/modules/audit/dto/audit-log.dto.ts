import { checkSchema, Schema } from "express-validator";
import { Audit } from "@svl/share";

export type GetAuditLogsDto = {
  page?: number;
  limit?: number;
  lang?: string;
  keyword?: string;
  user_id?: string;
  action?: number;
  start_time?: number;
  end_time?: number;
};

export type GetAuditLogDetailDto = {
  audit_log_id: string;
};

const auditLogFilterSchema: Schema = {
  keyword: {
    in: "query",
    optional: true,
    isString: true,
    trim: true,
    errorMessage: "Từ khóa tìm kiếm không hợp lệ",
  },
  action: {
    in: "query",
    optional: true,
    isInt: true,
    toInt: true,
    isIn: {
      options: [
        Object.values(Audit.Enums.AuditAction).filter(
          (value) => typeof value === "number"
        ),
      ],
    },
    errorMessage: "Hành động không hợp lệ",
  },
  start_time: {
    in: "query",
    optional: true,
    isInt: true,
    toInt: true,
    errorMessage: "Thời gian bắt đầu không hợp lệ",
  },
  end_time: {
    in: "query",
    optional: true,
    isInt: true,
    toInt: true,
    errorMessage: "Thời gian kết thúc không hợp lệ",
  },
  page: {
    in: "query",
    optional: true,
    isInt: {
      options: { min: 1 },
    },
    toInt: true,
    customSanitizer: {
      options: (value: number) => {
        return value || 1;
      },
    },
    errorMessage: "Số trang không hợp lệ",
  },
  limit: {
    in: "query",
    optional: true,
    isInt: {
      options: { min: 1, max: 100 },
    },
    toInt: true,
    customSanitizer: {
      options: (value: number) => {
        return value || 20;
      },
    },
    errorMessage: "Số dòng mỗi trang không hợp lệ",
  },
  lang: {
    in: "query",
    optional: true,
    isString: true,
    toLowerCase: true,
    isIn: {
      options: [["vi", "en"]],
    },
    customSanitizer: {
      options: (value: string) => {
        return value || "vi";
      },
    },
    errorMessage: "Ngôn ngữ không hợp lệ",
  },
};

export const getAdminAuditLogsSchema = checkSchema({
  user_id: {
    in: "query",
    optional: true,
    isMongoId: true,
    errorMessage: "User ID không hợp lệ",
  },
  ...auditLogFilterSchema,
});

export const getUserActivitySchema = checkSchema({
  user_id: {
    in: "query",
    isMongoId: true,
    notEmpty: true,
    errorMessage: "User ID không hợp lệ",
  },
  ...auditLogFilterSchema,
});

export const getAuditLogDetailSchema = checkSchema({
  audit_log_id: {
    in: "query",
    isMongoId: true,
    errorMessage: "ID log không hợp lệ",
  },
});
