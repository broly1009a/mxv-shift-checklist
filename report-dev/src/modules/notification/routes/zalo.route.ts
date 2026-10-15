import { Router } from "express";
import { catchAsync } from "@svl/share";
import { requireAuth } from "../../../middlewares/requireAuth";
import * as zaloController from "../zalo/zalo.controller";

export const zaloRouter = Router();

zaloRouter.get(
  "/zalo/history",
  ...catchAsync([
    requireAuth,
    zaloController.getHistory,
  ])
);
