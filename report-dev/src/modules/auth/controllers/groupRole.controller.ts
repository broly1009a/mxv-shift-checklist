import { Request, Response } from "express";
import { QueryBuilder } from "@mss/common";
import { handlerSuccess } from "@svl/share";
import * as grService from "../services/groupRole.service";

export const createGroupRole = async (req: Request, res: Response) => {
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const groupRole = await grService.createGroupRole(req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, groupRole);
};

export const updateGroupRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const groupRole = await grService.updateGroupRole(id, req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, groupRole);
};

export const assignRoleToGroupRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const groupRole = await grService.assignRoleToGroupRole(id, req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, groupRole);
};

export const getGroupRoleById = async (req: Request, res: Response) => {
  const { id } = req.params;
  const groupRole = await grService.getGroupRoleById(id);
  return handlerSuccess(res, groupRole);
};

export const getListGroupRole = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const list = await grService.getListGroupRole(query);
  return handlerSuccess(res, list);
};

export const getListGroupRoleExcel = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const stream = await grService.getListGroupRoleExcel(query);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="group-roles.xlsx"');

  stream.pipe(res);
};
