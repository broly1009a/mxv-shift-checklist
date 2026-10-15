import { Notification } from "@svl/share";
import { NotificationPort } from "../../../shared/ports/notification.port";
import { dispatchNotification } from "../dispatcher/notification.dispatcher";

export class NotificationService implements NotificationPort {
  async send(data: Notification.Events.NotificationRequestedData): Promise<void> {
    await dispatchNotification(data);
  }
}

export function createNotificationService(): NotificationPort {
  return new NotificationService();
}
