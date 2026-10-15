import { Notification } from "@svl/share";
import { MongoQuery, PaginationService } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import { ZaloHistoryModel } from "../models/zalo-history.model";

const ZALO_ENDPOINTS = {
  OA_MESSAGE: "https://openapi.zalo.me/v3.0/oa/message/cs",
  ZNS_MESSAGE: "https://business.openapi.zalo.me/message/template",
};

export async function sendZaloMessage(
  payload: Notification.Events.NotificationRequestedData
) {
  const phoneNumber =
    payload.channelOptions?.zalo?.phoneNumber ||
    payload.recipients?.find((recipient) => recipient.phoneNumber)?.phoneNumber;
  const userId =
    payload.channelOptions?.zalo?.userId ||
    payload.recipients?.find((recipient) => recipient.zaloUserId)?.zaloUserId;

  if (!phoneNumber && !userId) {
    throw new Error("Zalo recipient phoneNumber or userId must be defined");
  }

  const templateId = payload.channelOptions?.zalo?.templateId || payload.templateCode;

  let endpoint = ZALO_ENDPOINTS.OA_MESSAGE;
  let requestData: any = {};

  if (templateId) {
    endpoint = ZALO_ENDPOINTS.ZNS_MESSAGE;
    requestData = {
      phone: phoneNumber ? phoneNumber.replace(/^0/, "84") : undefined,
      user_id: userId,
      template_id: templateId,
      template_data: payload.metadata || {},
    };
  } else {
    requestData = {
      recipient: {},
      message: {
        text: payload.text || payload.message,
      },
    };
    if (userId) {
      requestData.recipient.user_id = userId;
    } else {
      requestData.recipient.phone = phoneNumber
        ? phoneNumber.replace(/^0/, "84")
        : undefined;
    }
  }

  const accessToken = process.env.ZALO_ACCESS_TOKEN;
  if (!accessToken) {
    throw new Error("ZALO_ACCESS_TOKEN is not configured in environment variables");
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        access_token: accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const data = await response.json();

    if (data.error && data.error !== 0) {
      throw new Error(`Zalo API Error: ${data.message} (Code: ${data.error})`);
    }

    logger.info(
      `Zalo message sent: template=${templateId || "n/a"}, messageId=${data.data?.message_id || data.message_id || "n/a"}`
    );

    await ZaloHistoryModel.create({
      phoneNumber,
      userId,
      templateId,
      payload: JSON.stringify(requestData),
      status: "SUCCESS",
      messageId: data.data?.message_id || data.message_id,
    });
  } catch (error: any) {
    logger.error(`Error sending Zalo message: ${error.message}`);

    await ZaloHistoryModel.create({
      phoneNumber,
      userId,
      templateId,
      payload: JSON.stringify(requestData),
      status: "FAILED",
      error: error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message,
    });

    throw error;
  }
}

export async function getHistory(query: MongoQuery) {
  const pagination = new PaginationService(ZaloHistoryModel);
  const list = await pagination.paginate(query);
  return list;
}
