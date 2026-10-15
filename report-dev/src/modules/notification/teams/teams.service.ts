import { Notification } from "@svl/share";
import { MongoQuery, PaginationService } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import { TeamsHistoryModel } from "../models/teams-history.model";

function buildText(payload: Notification.Events.NotificationRequestedData) {
  if (payload.text) {
    return payload.text;
  }

  const lines: string[] = [];

  if (payload.title) {
    lines.push(`**${payload.title}**`);
  }

  if (payload.message) {
    lines.push(payload.message);
  }

  if (payload.facts && typeof payload.facts === "object") {
    Object.entries(payload.facts).forEach(([key, value]) => {
      lines.push(`- **${key}:** ${String(value)}`);
    });
  }

  return lines.join("\n");
}

export async function sendTeamsMessage(
  payload: Notification.Events.NotificationRequestedData
) {
  const webhookUrl =
    payload.channelOptions?.teams?.webhookUrl || process.env.TEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("TEAMS_WEBHOOK_URL must be defined");
  }

  const text = buildText(payload);
  if (!text) {
    throw new Error("Teams message text is empty");
  }

  const requestBody = { text };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(`Teams webhook failed: ${response.status} ${bodyText}`);
    }

    logger.info("Teams message sent successfully");

    await TeamsHistoryModel.create({
      webhookUrl,
      payload: JSON.stringify(requestBody),
      status: "SUCCESS",
    });
  } catch (error: any) {
    logger.error(`Error sending Teams message: ${error.message}`);

    await TeamsHistoryModel.create({
      webhookUrl,
      payload: JSON.stringify(requestBody),
      status: "FAILED",
      error: error.message,
    });

    throw error;
  }
}

export async function getHistory(query: MongoQuery) {
  const pagination = new PaginationService(TeamsHistoryModel);
  const list = await pagination.paginate(query);
  return list;
}
