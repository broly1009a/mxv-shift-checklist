import { EventBus } from './shared';
import { createAuditRecorder, registerAuditEventSubscribers } from './modules/audit';
import { createNotificationService } from './modules/notification';
import { setAuthAuditRecorder, setUserAuditRecorder, setGroupRoleAuditRecorder, setAuthNotificationPort } from './modules/auth';

export interface MonolithComposition {
  eventBus: EventBus;
}

export function createMonolithComposition(): MonolithComposition {
  const eventBus = new EventBus();
  
  // Register audit subscribers before requests arrive
  registerAuditEventSubscribers(eventBus);

  const auditRecorder = createAuditRecorder(eventBus);
  const notificationService = createNotificationService();

  // Wire audit recorder into auth services
  setAuthAuditRecorder(auditRecorder);
  setUserAuditRecorder(auditRecorder);
  setGroupRoleAuditRecorder(auditRecorder);

  // Wire notification service into auth
  setAuthNotificationPort(notificationService);

  return {
    eventBus
  };
}
