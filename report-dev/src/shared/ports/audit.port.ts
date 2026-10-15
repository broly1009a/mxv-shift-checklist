import type { Audit } from '@svl/share';

export interface AuditRecorder {
  writeLog(message: Audit.Events.AuditLogMessage): Promise<void>;
  updateResult(message: Audit.Events.UpdateResultAuditLogMessage): Promise<void>;
  executeWithAudit<T>(
    log: Audit.Helpers.AuditLog,
    owner: string,
    operation: () => Promise<T>,
    createdBy?: Audit.Enums.AuditCreatedBy
  ): Promise<T>;
}
