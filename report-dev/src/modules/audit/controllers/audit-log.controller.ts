import { Request, Response } from "express";
import { handlerSuccess } from "@svl/share";
import * as auditLogService from "../services/audit-log.service";

export const findAll = async (req: Request, res: Response) => {
  const result = await auditLogService.getAuditLogs(req.query as any);
  return handlerSuccess(res, result);
};

export const findOne = async (req: Request, res: Response) => {
  const { audit_log_id } = req.query;
  const result = await auditLogService.getAuditLogDetail(audit_log_id as string);
  return handlerSuccess(res, result);
};
