import { Notification } from "@svl/share";
import { MongoQuery, PaginationService } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import { SmsHistoryModel } from "../models/sms-history.model";

export interface SmsMessage {
  to: string[];
  message: string;
  sender?: string;
  brandName?: string;
  templateCode?: string;
  templateParams?: Record<string, any>;
  providerPayload?: Record<string, any>;
}

const normalizePhoneNumbers = (value?: string | string[]) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const getRecipientPhoneNumbers = (
  payload: Notification.Events.NotificationRequestedData
) => {
  const optionRecipients = normalizePhoneNumbers(
    payload.channelOptions?.sms?.to || payload.channelOptions?.sms?.phoneNumber
  );
  const eventRecipients =
    payload.recipients
      ?.map((recipient) => recipient.phoneNumber)
      .filter(Boolean) || [];

  return [...optionRecipients, ...eventRecipients] as string[];
};

export function buildSmsMessage(
  payload: Notification.Events.NotificationRequestedData
): SmsMessage {
  return {
    to: getRecipientPhoneNumbers(payload),
    message:
      payload.channelOptions?.sms?.message ||
      payload.text ||
      payload.message ||
      payload.title ||
      "",
    sender:
      payload.channelOptions?.sms?.sender ||
      process.env.SMS_SENDER ||
      process.env.SMS_BRAND_NAME,
    brandName: payload.channelOptions?.sms?.brandName || process.env.SMS_BRAND_NAME,
    templateCode: payload.channelOptions?.sms?.templateCode || payload.templateCode,
    templateParams:
      payload.channelOptions?.sms?.templateParams || payload.templateParams,
    providerPayload: payload.channelOptions?.sms?.providerPayload,
  };
}

const buildProviderRequest = (message: SmsMessage) => ({
  to: message.to,
  message: message.message,
  sender: message.sender,
  brandName: message.brandName,
  templateCode: message.templateCode,
  templateParams: message.templateParams,
  ...(message.providerPayload || {}),
});

const buildHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.SMS_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.SMS_API_TOKEN}`;
  }

  if (process.env.SMS_API_KEY) {
    headers["x-api-key"] = process.env.SMS_API_KEY;
  }

  return headers;
};

export async function sendSmsMessage(
  payload: Notification.Events.NotificationRequestedData
) {
  const message = buildSmsMessage(payload);

  if (!message.to.length) {
    throw new Error("SMS recipients must be defined");
  }

  if (!message.message) {
    throw new Error("SMS message must be defined");
  }

  const smsApiUrl = process.env.SMS_API_URL;
  if (!smsApiUrl) {
    throw new Error("SMS_API_URL must be defined");
  }

  const requestBody = buildProviderRequest(message);

  try {
    const response = await fetch(smsApiUrl, {
      method: process.env.SMS_API_METHOD || "POST",
      headers: buildHeaders(),
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    let responseData: any = responseText;

    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Keep raw provider response when it is not JSON.
    }

    if (!response.ok) {
      throw new Error(`SMS provider failed: ${response.status} ${responseText}`);
    }

    const providerMessageId =
      responseData?.messageId ||
      responseData?.message_id ||
      responseData?.data?.messageId ||
      responseData?.data?.message_id;

    logger.info(
      `SMS message sent: recipients=${message.to.length}, providerMessageId=${providerMessageId || "n/a"}`
    );

    await SmsHistoryModel.create({
      to: message.to,
      message: message.message,
      sender: message.sender,
      brandName: message.brandName,
      providerMessageId,
      payload: JSON.stringify(requestBody),
      response: typeof responseData === "string" ? responseData : JSON.stringify(responseData),
      status: "SUCCESS",
    });
  } catch (error: any) {
    logger.error(`Error sending SMS message: ${error.message}`);

    await SmsHistoryModel.create({
      to: message.to,
      message: message.message,
      sender: message.sender,
      brandName: message.brandName,
      payload: JSON.stringify(requestBody),
      status: "FAILED",
      error: error.message,
    });

    throw error;
  }
}

export async function getHistory(query: MongoQuery) {
  const pagination = new PaginationService(SmsHistoryModel);
  const list = await pagination.paginate(query);
  return list;
}
