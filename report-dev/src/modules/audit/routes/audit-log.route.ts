import { Router } from "express";
import { Identity, requireRole, validateRequest, catchAsync } from "@svl/share";
import { requireAuth } from "../../../middlewares/requireAuth";
import * as auditLogController from "../controllers/audit-log.controller";
import {
  getAdminAuditLogsSchema,
  getUserActivitySchema,
  getAuditLogDetailSchema
} from "../dto/audit-log.dto";

export const auditLogRouter = Router();

auditLogRouter.get(
  "/logs/admin",
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.AUDIT_VIEW]),
    ...getAdminAuditLogsSchema,
    validateRequest,
    auditLogController.findAll
  ])
);

auditLogRouter.get(
  "/logs/user",
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.AUDIT_VIEW]),
    ...getUserActivitySchema,
    validateRequest,
    auditLogController.findAll
  ])
);

auditLogRouter.get(
  "/logs/detail",
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.AUDIT_VIEW]),
    ...getAuditLogDetailSchema,
    validateRequest,
    auditLogController.findOne
  ])
);
