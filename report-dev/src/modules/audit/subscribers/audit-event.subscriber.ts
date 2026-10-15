import { EventBus, DomainEventName } from "../../../shared";
import { logger } from "@/loggers/winstonLogger";
import * as auditLogService from "../services/audit-log.service";

export function registerAuditEventSubscribers(eventBus: EventBus): () => void {
  const unsubWrite = eventBus.on(DomainEventName.AUDIT_WRITE, async (payload) => {
    try {
      await auditLogService.writeLog(payload);
    } catch (error) {
      logger.error(`Error processing AUDIT_WRITE event: ${error}`);
    }
  });

  const unsubUpdate = eventBus.on(DomainEventName.AUDIT_UPDATE_RESULT, async (payload) => {
    try {
      await auditLogService.updateLog(payload);
    } catch (error) {
      logger.error(`Error processing AUDIT_UPDATE_RESULT event: ${error}`);
    }
  });

  return () => {
    unsubWrite();
    unsubUpdate();
  };
}
