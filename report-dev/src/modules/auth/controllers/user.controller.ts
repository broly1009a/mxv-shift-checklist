import { Request, Response } from "express";
import { QueryBuilder } from "@mss/common";
import { handlerSuccess } from "@svl/share";
import * as userService from "../services/user.service";

export const listUser = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const list = await userService.listUser(query);
  return handlerSuccess(res, list);
};

export const getMe = async (req: Request, res: Response) => {
  const me = await userService.getMe(req.user);
  return handlerSuccess(res, me);
};

export const newUser = async (req: Request, res: Response) => {
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const user = await userService.newUser(req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, user);
};

export const getUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await userService.getUser(id);
  return handlerSuccess(res, user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const user = await userService.updateProfile(id, req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, user);
};

export const assignRoles = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const assign = await userService.assignRoles(id, req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, assign);
};

export const assignGroupRoles = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const assign = await userService.assignGroupRoles(id, req.body, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, assign);
};

export const deleteUser = async (req: Request, res: Response) => {
  const { id } = req.params;
  const modifier = req.user?.username || req.user?.id || "system";
  const correlationId = req.headers['correlation_id'] as string;
  const deviceInfo = req.deviceInfo;
  const result = await userService.deleteUser(id, modifier, correlationId, deviceInfo);
  return handlerSuccess(res, result);
};

export const getAuditTags = async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await userService.getAuditTags(id);
  return handlerSuccess(res, user);
};
