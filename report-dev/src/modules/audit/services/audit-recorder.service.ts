import { Audit, HandlerError } from "@svl/share";
import { AuditRecorder } from "../../../shared/ports/audit.port";
import { logger } from "@/loggers/winstonLogger";
import { EventBus, DomainEventName } from "../../../shared";

export function createAuditRecorder(eventBus: EventBus): AuditRecorder {
  return {
    async writeLog(message: Audit.Events.AuditLogMessage): Promise<void> {
      eventBus.emit(DomainEventName.AUDIT_WRITE, message);
    },

    async updateResult(message: Audit.Events.UpdateResultAuditLogMessage): Promise<void> {
      eventBus.emit(DomainEventName.AUDIT_UPDATE_RESULT, message);
    },

    async executeWithAudit<T>(
      log: Audit.Helpers.AuditLog,
      owner: string,
      operation: () => Promise<T>,
      createdBy: Audit.Enums.AuditCreatedBy = Audit.Enums.AuditCreatedBy.USER
    ): Promise<T> {
      const message: Audit.Events.AuditLogMessage = {
        correlation_id: log.correlation_id,
        owner,
        title: log.title,
        content: log.content,
        ip: log.device_info?.ip || "Unknown",
        client: log.device_info?.client || "Unknown",
        os: log.device_info?.os || "Unknown",
        device: log.device_info?.device || "Unknown",
        action: log.action ?? Audit.Enums.AuditAction.UNKOWN,
        time: new Date(log.time).toISOString(),
        created_by: createdBy,
        attach_data: log.attach_data,
        member_id: log.member_id,
        account_id: log.account_id,
        broker_id: log.broker_id,
      };

      try {
        eventBus.emit(DomainEventName.AUDIT_WRITE, message);
      } catch (writeErr) {
        logger.error(`Failed to emit AUDIT_WRITE for correlation_id ${log.correlation_id}: ${writeErr}`);
      }

      try {
        const result = await operation();

        try {
          eventBus.emit(DomainEventName.AUDIT_UPDATE_RESULT, {
            correlation_id: log.correlation_id,
            status: Audit.Enums.AuditStatus.SUCCESS,
          });
        } catch (updateErr) {
          logger.error(`Failed to emit AUDIT_UPDATE_RESULT SUCCESS for correlation_id ${log.correlation_id}: ${updateErr}`);
        }

        return result;
      } catch (error) {
        const isHandlerError = error instanceof HandlerError;
        const status = isHandlerError
          ? Audit.Enums.AuditStatus.FAILED
          : Audit.Enums.AuditStatus.SYSTEM_ERROR;

        try {
          eventBus.emit(DomainEventName.AUDIT_UPDATE_RESULT, {
            correlation_id: log.correlation_id,
            status,
          });
        } catch (updateErr) {
          logger.error(`Failed to emit AUDIT_UPDATE_RESULT ${isHandlerError ? "FAILED" : "SYSTEM_ERROR"} for correlation_id ${log.correlation_id}: ${updateErr}`);
        }

        throw error;
      }
    },
  };
}
