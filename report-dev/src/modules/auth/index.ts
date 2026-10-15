import { Express } from 'express';
import { authRouter } from './routes/auth.route';
import { userRouter } from './routes/user.route';
import { roleRouter } from './routes/role.route';
import { groupRoleRouter } from './routes/groupRole.route';
import { approvalRouter } from './routes/approval.route';
import { layoutRouter } from './routes/layout.route';

export function registerAuth(app: Express): void {
  app.use('/api', authRouter);
  app.use('/api', userRouter);
  app.use('/api', roleRouter);
  app.use('/api', groupRoleRouter);
  app.use('/api', approvalRouter);
  app.use('/api', layoutRouter);
}

export { setAuthNotificationPort, setAuthAuditRecorder } from './services/auth.service';
export { setUserAuditRecorder } from './services/user.service';
export { setGroupRoleAuditRecorder } from './services/groupRole.service';
