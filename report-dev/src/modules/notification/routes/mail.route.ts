import { Router } from "express";
import { catchAsync, validateRequest } from "@svl/share";
import { requireAuth } from "../../../middlewares/requireAuth";
import * as mailController from "../mail/mail.controller";
import { sendMailDto } from "../mail/dto";

export const mailRouter = Router();

mailRouter.get(
  "/mail/history",
  ...catchAsync([
    requireAuth,
    mailController.getHistory,
  ])
);

mailRouter.post(
  "/mail/send",
  ...catchAsync([
    requireAuth,
    ...sendMailDto,
    validateRequest,
    mailController.sendMail,
  ])
);
