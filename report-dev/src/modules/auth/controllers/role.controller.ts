import { Request, Response } from "express";
import { handlerSuccess } from "@svl/share";
import * as roleService from "../services/role.service";

export const listRoles = async (req: Request, res: Response) => {
  const list = await roleService.listRoles();
  return handlerSuccess(res, list);
};

export const syncRoles = async (req: Request, res: Response) => {
  const result = await roleService.syncRolesFromShare(
    req.user?.username || req.user?.id || "system"
  );
  return handlerSuccess(res, result);
};

export const listRoleCatalog = async (req: Request, res: Response) => {
  const list = await roleService.listRoleCatalog();
  return handlerSuccess(res, list);
};

export const updateRolesMetadata = async (req: Request, res: Response) => {
  const result = await roleService.updateRolesMetadata(
    req.body.roles,
    req.user?.username || req.user?.id || "system"
  );
  return handlerSuccess(res, result);
};
