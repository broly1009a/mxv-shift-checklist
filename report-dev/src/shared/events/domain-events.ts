import type { Audit } from '@svl/share';

export enum DomainEventName {
  AUDIT_WRITE = 'AUDIT_WRITE',
  AUDIT_UPDATE_RESULT = 'AUDIT_UPDATE_RESULT',
}

export interface DomainEventMap {
  [DomainEventName.AUDIT_WRITE]: Audit.Events.AuditLogMessage;
  [DomainEventName.AUDIT_UPDATE_RESULT]: Audit.Events.UpdateResultAuditLogMessage;
}
