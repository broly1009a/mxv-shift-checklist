import { Express } from "express";
import { auditLogRouter } from "./routes/audit-log.route";

export function registerAudit(app: Express): void {
  app.use("/api", auditLogRouter);
}

export { writeLog, updateLog } from "./services/audit-log.service";
export { startAuditJobs } from "./jobs";
export { createAuditRecorder } from "./services/audit-recorder.service";
export { registerAuditEventSubscribers } from "./subscribers/audit-event.subscriber";
