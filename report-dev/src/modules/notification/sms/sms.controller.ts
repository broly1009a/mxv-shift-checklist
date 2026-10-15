import { Request, Response } from "express";
import { QueryBuilder } from "@mss/common";
import { handlerSuccess, Notification } from "@svl/share";
import * as smsService from "./sms.service";
import { SendSmsDto } from "./dto";

export const getHistory = async (req: Request, res: Response) => {
  const query = QueryBuilder.build(req.query);
  const list = await smsService.getHistory(query);
  return handlerSuccess(res, list);
};

export const sendSms = async (req: Request, res: Response) => {
  const body: SendSmsDto = req.body;

  const payload: Notification.Events.NotificationRequestedData = {
    channels: [Notification.Enums.NotificationChannel.SMS],
    message: body.message,
    templateCode: body.templateCode,
    templateParams: body.templateParams,
    channelOptions: {
      sms: {
        to: Array.isArray(body.to) ? body.to : [body.to],
        message: body.message,
        sender: body.sender,
        brandName: body.brandName,
        templateCode: body.templateCode,
        templateParams: body.templateParams,
      },
    },
  };

  await smsService.sendSmsMessage(payload);

  return handlerSuccess(res, { message: "SMS sent successfully" });
};
