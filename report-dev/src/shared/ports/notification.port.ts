import type { Notification } from '@svl/share';

export interface NotificationPort {
  send(data: Notification.Events.NotificationRequestedData): Promise<void>;
}
