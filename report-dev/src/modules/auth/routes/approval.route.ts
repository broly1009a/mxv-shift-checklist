import { Router } from 'express';
import { validateRequest, catchAsync } from "@svl/share";
import { requireAuth } from '../../../middlewares/requireAuth';
import * as approvalController from "../approval/approval.controller";
import { updateApprovalDto } from "../approval/dto";

export const approvalRouter = Router();

approvalRouter.post(
  '/approval',
  ...catchAsync([
    requireAuth,
    validateRequest,
    approvalController.createApproval
  ])
);

approvalRouter.get(
  '/approval',
  ...catchAsync([
    requireAuth,
    validateRequest,
    approvalController.listApproval
  ])
);

approvalRouter.put(
  '/approval/:id',
  ...catchAsync([
    requireAuth,
    ...updateApprovalDto,
    validateRequest,
    approvalController.updateApproval
  ])
);

approvalRouter.get(
  '/approval/:id',
  ...catchAsync([
    requireAuth,
    validateRequest,
    approvalController.getApproval
  ])
);
