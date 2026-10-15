import { Router } from 'express';
import {
  Identity,
  requireRole,
  validateRequest,
  catchAsync
} from "@svl/share";
import { requireAuth } from '../../../middlewares/requireAuth';
import * as groupRoleController from "../controllers/groupRole.controller";
import { newGroupRoleDto, updateGroupRoleDto, assignRoleToGroupRoleDto } from "../dto";

export const groupRoleRouter = Router();

groupRoleRouter.post(
  '/group-role',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_CREATE]),
    ...newGroupRoleDto,
    validateRequest,
    groupRoleController.createGroupRole
  ])
);

groupRoleRouter.get(
  '/group-role/list',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_VIEW]),
    validateRequest,
    groupRoleController.getListGroupRole
  ])
);

groupRoleRouter.get(
  '/group-role/list/:excel',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_VIEW]),
    validateRequest,
    groupRoleController.getListGroupRoleExcel
  ])
);

groupRoleRouter.put(
  '/group-role/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_UPDATE]),
    ...updateGroupRoleDto,
    validateRequest,
    groupRoleController.updateGroupRole
  ])
);

groupRoleRouter.put(
  '/group-role/:id/role',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_PERMISSION_UPDATE]),
    ...assignRoleToGroupRoleDto,
    validateRequest,
    groupRoleController.assignRoleToGroupRole
  ])
);

groupRoleRouter.get(
  '/group-role/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.GROUP_ROLE_VIEW]),
    validateRequest,
    groupRoleController.getGroupRoleById
  ])
);
