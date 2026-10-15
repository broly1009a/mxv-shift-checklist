import { Router } from 'express';
import { validateRequest, catchAsync } from "@svl/share";
import { requireAuth } from '../../../middlewares/requireAuth';
import * as layoutControllers from "../layout/layout.controller";

export const layoutRouter = Router();

layoutRouter.post(
  '/layouts',
  ...catchAsync([
    requireAuth,
    validateRequest,
    layoutControllers.setLayout
  ])
);

layoutRouter.get(
  '/layouts',
  ...catchAsync([
    requireAuth,
    validateRequest,
    layoutControllers.getLayout
  ])
);
