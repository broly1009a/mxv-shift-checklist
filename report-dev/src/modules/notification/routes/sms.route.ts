import { Router } from "express";
import { catchAsync, validateRequest } from "@svl/share";
import { requireAuth } from "../../../middlewares/requireAuth";
import * as smsController from "../sms/sms.controller";
import { sendSmsDto } from "../sms/dto";

export const smsRouter = Router();

smsRouter.get(
  "/sms/history",
  ...catchAsync([
    requireAuth,
    smsController.getHistory,
  ])
);

smsRouter.post(
  "/sms/send",
  ...catchAsync([
    requireAuth,
    ...sendSmsDto,
    validateRequest,
    smsController.sendSms,
  ])
);
