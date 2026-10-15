import { Notification } from "@svl/share";
import { MongoQuery, PaginationService } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import nodemailer from "nodemailer";
import { MailHistoryModel } from "../models/mail-history.model";
import { getMailTemplate } from "../utils/mail-template";

export interface MailMessage {
  from?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Notification.Events.NotificationAttachment[];
}

const normalizeEmailService = (service?: string) => {
  if (!service) return undefined;

  const serviceAliases: Record<string, string> = {
    office365: "Outlook365",
    outlook365: "Outlook365",
    microsoft365: "Outlook365",
  };

  return serviceAliases[service.toLowerCase()] || service;
};

const parseBoolean = (value?: string) => {
  if (!value) return undefined;
  return value.toLowerCase() === "true";
};

const getMailTransportOptions = () => {
  const commonOptions = {
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  };

  if (process.env.EMAIL_HOST) {
    return {
      ...commonOptions,
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: parseBoolean(process.env.EMAIL_SECURE) || false,
    };
  }

  return {
    ...commonOptions,
    service: normalizeEmailService(process.env.EMAIL_SERVICE),
  };
};

let lazyTransporter: nodemailer.Transporter | null = null;

const getTransporter = (): nodemailer.Transporter => {
  if (!lazyTransporter) {
    lazyTransporter = nodemailer.createTransport(getMailTransportOptions());
  }
  return lazyTransporter;
};

const getRecipientEmails = (
  payload: Notification.Events.NotificationRequestedData
) => {
  const optionRecipients = payload.channelOptions?.mail?.to || [];
  const eventRecipients =
    payload.recipients?.map((recipient) => recipient.email).filter(Boolean) ||
    [];

  return [...optionRecipients, ...eventRecipients] as string[];
};

export function buildMailMessage(
  payload: Notification.Events.NotificationRequestedData
): MailMessage {
  const subject =
    payload.channelOptions?.mail?.subject ||
    payload.subject ||
    payload.title ||
    "MSS Notification";

  const rawHtml = payload.channelOptions?.mail?.html || payload.html;
  const rawText = payload.channelOptions?.mail?.text || payload.text || payload.message;

  let finalHtml = "";
  if (rawHtml) {
    finalHtml = getMailTemplate(rawHtml);
  } else if (rawText) {
    const formattedText = rawText.replace(/\n/g, "<br>");
    finalHtml = getMailTemplate(`<p>${formattedText}</p>`);
  }

  return {
    from: payload.channelOptions?.mail?.from || process.env.MAIL_FROM || process.env.EMAIL_SENDER,
    to: getRecipientEmails(payload),
    cc: payload.channelOptions?.mail?.cc,
    bcc: payload.channelOptions?.mail?.bcc,
    subject,
    text: rawText,
    html: finalHtml,
    attachments:
      payload.channelOptions?.mail?.attachments || payload.attachments || [],
  };
}

export async function sendMailMessage(
  payload: Notification.Events.NotificationRequestedData
) {
  const message = buildMailMessage(payload);

  if (!message.to.length) {
    throw new Error("Mail recipients must be defined");
  }

  try {
    if (!process.env.EMAIL_HOST && !process.env.EMAIL_SERVICE) {
      logger.warn("Missing required mail configurations (EMAIL_HOST or EMAIL_SERVICE). Aborting SMTP send.");
      throw new Error("Missing mail configuration");
    }

    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: message.from,
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments as any,
    });

    logger.info(
      `Mail message sent: subject=${message.subject}, recipients=${message.to.length}, messageId=${info.messageId}`
    );

    await MailHistoryModel.create({
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      content: JSON.stringify(message),
      status: "SUCCESS",
    });
  } catch (error: any) {
    logger.error(`Error sending mail: ${error.message}`);

    await MailHistoryModel.create({
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      content: JSON.stringify(message),
      status: "FAILED",
      error: error.message,
    });

    throw error;
  }
}

export async function getHistory(query: MongoQuery) {
  const pagination = new PaginationService(MailHistoryModel);
  const list = await pagination.paginate(query);
  return list;
}
