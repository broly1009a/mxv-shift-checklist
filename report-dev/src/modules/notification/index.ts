import { Express } from "express";
import { NotificationPort } from "../../shared/ports/notification.port";
import { createNotificationService } from "./services/notification.service";
import { mailRouter } from "./routes/mail.route";
import { smsRouter } from "./routes/sms.route";
import { teamsRouter } from "./routes/teams.route";
import { zaloRouter } from "./routes/zalo.route";

export function registerNotification(app: Express): void {
  app.use("/api", mailRouter);
  app.use("/api", smsRouter);
  app.use("/api", teamsRouter);
  app.use("/api", zaloRouter);
}

export { createNotificationService };
export { dispatchNotification } from "./dispatcher/notification.dispatcher";
export { attachNotificationWs } from "./ws/notification-socket.server";
export { buildMailMessage, sendMailMessage } from "./mail/mail.service";
