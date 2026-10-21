export * from './endpoints';
export * from './client';
export * from './auth.api';
export * from './ingress.api';
export * from './trading-ops.api';
export * from './ccp-clearing.api';
export * from './checklist-hub.api';
export * from './dashboard.api';
export * from './admin.api';
export * from './trading-report.api';
export * from './margin-checker.api';
export * from './ccp-statistics-legacy.api';
export * from './ce-clearing.api';

import { authApi } from './auth.api';
import { ingressApi } from './ingress.api';
import { tradingOpsApi } from './trading-ops.api';
import { ccpClearingApi } from './ccp-clearing.api';
import { ceClearingApi } from './ce-clearing.api';
import { checklistHubApi } from './checklist-hub.api';
import { dashboardApi } from './dashboard.api';
import { adminApi } from './admin.api';
import { tradingReportApi } from './trading-report.api';
import { marginCheckerApi } from './margin-checker.api';
import { ccpStatisticsLegacyApi } from './ccp-statistics-legacy.api';

/**
 * Singleton API Client tập trung cho toàn bộ ứng dụng Frontend
 * Cách dùng:
 *   import { api } from '@/services/api';
 *   const shifts = await api.checklistHub.getActiveShifts();
 */
export const api = {
  auth: authApi,
  ingress: ingressApi,
  tradingOps: tradingOpsApi,
  ccpClearing: ccpClearingApi,
  ceClearing: ceClearingApi,
  checklistHub: checklistHubApi,
  dashboard: dashboardApi,
  admin: adminApi,
  tradingReport: tradingReportApi,
  marginChecker: marginCheckerApi,
  ccpStatisticsLegacy: ccpStatisticsLegacyApi,
} as const;

export default api;
