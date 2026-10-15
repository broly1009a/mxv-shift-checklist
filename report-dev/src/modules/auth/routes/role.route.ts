import { Router } from 'express';
import {
  Identity,
  requireRole,
  validateRequest,
  catchAsync
} from "@svl/share";
import { requireAuth } from '../../../middlewares/requireAuth';
import * as roleController from "../controllers/role.controller";
import { updateRolesDto } from "../dto/updateRoles.dto";

export const roleRouter = Router();

roleRouter.post(
  '/role/sync',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.SUPER_ADMIN]),
    validateRequest,
    roleController.syncRoles
  ])
);

roleRouter.get(
  '/role/catalog',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.SUPER_ADMIN]),
    validateRequest,
    roleController.listRoleCatalog
  ])
);

roleRouter.get(
  '/role/list',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.ROLE_VIEW]),
    validateRequest,
    roleController.listRoles
  ])
);

roleRouter.put(
  '/role',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.SUPER_ADMIN]),
    ...updateRolesDto,
    validateRequest,
    roleController.updateRolesMetadata
  ])
);
