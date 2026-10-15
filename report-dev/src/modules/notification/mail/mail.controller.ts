import { Request, Response } from "express";
import { handlerSuccess, Notification } from "@svl/share";
import { QueryBuilder } from "@mss/common";
import * as mailService from "./mail.service";
import { SendMailDto } from "./dto";

export const getHistory = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const list = await mailService.getHistory(query);
  return handlerSuccess(res, list);
};

export const sendMail = async (req: Request, res: Response) => {
  const body: SendMailDto = req.body;

  const payload: Notification.Events.NotificationRequestedData = {
    channels: [Notification.Enums.NotificationChannel.MAIL],
    subject: body.subject,
    html: body.html,
    channelOptions: {
      mail: {
        to: Array.isArray(body.to) ? body.to : [body.to],
        cc: body.cc ? (Array.isArray(body.cc) ? body.cc : [body.cc]) : undefined,
        bcc: body.bcc ? (Array.isArray(body.bcc) ? body.bcc : [body.bcc]) : undefined,
      },
    },
  };

  await mailService.sendMailMessage(payload);

  return handlerSuccess(res, { message: "Mail sent successfully" });
};
