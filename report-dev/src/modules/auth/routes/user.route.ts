import { Router } from 'express';
import {
  Identity,
  requireRole,
  validateRequest,
  catchAsync
} from "@svl/share";
import { requireAuth } from '../../../middlewares/requireAuth';
import * as userController from "../controllers/user.controller";
import {
  newUserDto,
  updateProfileDto,
  assignRolesDto,
  assignGroupRolesDto
} from "../dto";

export const userRouter = Router();

userRouter.get(
  '/user/list',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_VIEW]),
    validateRequest,
    userController.listUser
  ])
);

userRouter.get(
  '/user/me',
  ...catchAsync([
    requireAuth,
    validateRequest,
    userController.getMe
  ])
);

userRouter.post(
  '/user',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_CREATE]),
    ...newUserDto,
    validateRequest,
    userController.newUser
  ])
);

userRouter.get(
  '/user/audit/:id',
  ...catchAsync([
    requireAuth,
    validateRequest,
    userController.getAuditTags
  ])
);

userRouter.get(
  '/user/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_VIEW]),
    validateRequest,
    userController.getUser
  ])
);

userRouter.put(
  '/user/profile/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_UPDATE]),
    ...updateProfileDto,
    validateRequest,
    userController.updateProfile
  ])
);

userRouter.put(
  '/user/assign-roles/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_ROLE_UPDATE]),
    ...assignRolesDto,
    validateRequest,
    userController.assignRoles
  ])
);

userRouter.put(
  '/user/assign-group-roles/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_GROUP_ROLE_UPDATE]),
    ...assignGroupRolesDto,
    validateRequest,
    userController.assignGroupRoles
  ])
);

userRouter.delete(
  '/user/:id',
  ...catchAsync([
    requireAuth,
    requireRole([Identity.Enums.Permission.USER_ROLE_UPDATE]),
    validateRequest,
    userController.deleteUser
  ])
);
