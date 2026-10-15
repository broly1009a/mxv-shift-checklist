import { Notification } from "@svl/share";
import { sendMailMessage } from "../mail/mail.service";
import { sendSmsMessage } from "../sms/sms.service";
import { sendTeamsMessage } from "../teams/teams.service";
import { sendZaloMessage } from "../zalo/zalo.service";
import { sendWsMessage } from "../ws/ws.service";
import { logger } from "@/loggers/winstonLogger";

const sendByChannel = async (
  channel: Notification.Enums.NotificationChannel,
  payload: Notification.Events.NotificationRequestedData
) => {
  switch (channel) {
    case Notification.Enums.NotificationChannel.MAIL:
      await sendMailMessage(payload);
      break;
    case Notification.Enums.NotificationChannel.SMS:
      await sendSmsMessage(payload);
      break;
    case Notification.Enums.NotificationChannel.TEAMS:
      await sendTeamsMessage(payload);
      break;
    case Notification.Enums.NotificationChannel.ZALO:
      await sendZaloMessage(payload);
      break;
    case Notification.Enums.NotificationChannel.WS:
      await sendWsMessage(payload);
      break;
    default:
      logger.warn(`Unsupported notification channel: ${channel}`);
  }
};

export async function dispatchNotification(
  payload: Notification.Events.NotificationRequestedData
): Promise<void> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Notification payload must be an object");
  }

  if (!Array.isArray(payload.channels) || payload.channels.length === 0) {
    logger.warn(`No notification channel found: ${JSON.stringify(payload)}`);
    return;
  }

  const results = await Promise.allSettled(
    payload.channels.map((channel) => sendByChannel(channel, payload))
  );

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === "rejected"
  );

  if (failures.length > 0) {
    logger.error(
      `[Fan-out] ${failures.length}/${payload.channels.length} channels failed to send.`,
      { errors: failures.map((f) => f.reason) }
    );

    if (failures.length === payload.channels.length) {
      throw new Error("All notification channels failed.");
    }
  }
}
