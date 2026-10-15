import { Notification } from "@svl/share";
import { SocketMethods, SocketMessage, SocketCode } from "@mss/common";
import { logger } from "@/loggers/winstonLogger";
import { clientManager } from "./notification-socket.server";

export function direct(userIds: string[], message: SocketMessage) {
  userIds.forEach((id) => {
    const clientSet = clientManager.get(id);
    if (!clientSet || clientSet.size === 0) {
      logger.error(`Client ${id} is not connected`);
      return;
    }
    clientSet.forEach((client) => {
      if (client.isOpen()) {
        client.send(JSON.stringify(message));
      }
    });
  });
}

export function broadcast(message: SocketMessage) {
  clientManager.forEach((clientSet) => {
    clientSet.forEach((client) => {
      if (client.isOpen()) {
        client.send(JSON.stringify(message));
      }
    });
  });
}

export async function sendWsMessage(
  payload: Notification.Events.NotificationRequestedData
) {
  const event = payload.channelOptions?.ws?.event || SocketMethods.NOTI;
  const room =
    payload.channelOptions?.ws?.room ||
    payload.recipients?.find((recipient) => recipient.wsRoom)?.wsRoom;
  const userId =
    payload.channelOptions?.ws?.userId ||
    payload.recipients?.find((recipient) => recipient.userId)?.userId;

  if (!room && !userId) {
    throw new Error("WebSocket room or userId must be defined");
  }

  const messagePayload: SocketMessage = {
    method: event,
    payload: {
      code: payload.metadata?.code || SocketCode.SUCCESS,
      message: payload.message || "",
      data: {
        title: payload.title,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        ...(payload.metadata || {}),
      },
    },
  };

  if (userId) {
    direct([userId], messagePayload);
    logger.info(`WS message sent to userId=${userId}: event=${event}`);
  } else if (room) {
    // SocketServer from common does not track rooms natively.
    // We broadcast the message and the client should filter it by checking the payload metadata,
    // or we just broadcast to everyone for now.
    broadcast(messagePayload);
    logger.info(`WS message broadcasted (room=${room}): event=${event}`);
  }
}
