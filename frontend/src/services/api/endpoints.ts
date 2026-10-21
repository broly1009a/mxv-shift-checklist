/**
 * SINGLE SOURCE OF TRUTH CHO TOÀN BỘ ENDPOINT API
 * Để trỏ sang Modular Monolith V2 hoặc môi trường mới, chỉ cần cấu hình lại tại file này.
 */

export const API_ENDPOINTS = {
  // ─── AUTH ────────────────────────────────────────────────────────────────────
  AUTH: {
    PROFILE: '/api/v1/auth/profile',
    LOGIN: '/api/v1/auth/login',
    SSO: '/api/v1/auth/sso',
    EXCHANGE_TOKEN: '/api/v1/auth/exchange-token',
  },

  // ─── INGRESS (Thu thập dữ liệu từ sàn / RPA / Crawler) ───────────────────────
  INGRESS: {
    TRIGGER_MS: '/api/v1/bot-engine/trigger-download',
    TRIGGER_CQG: '/api/v1/bot-engine/trigger-cqg-download',
    TRIGGER_ACM: '/api/v1/bot-engine/trigger-acm-download',
    TRIGGER_CCP: '/api/v1/bot-engine/trigger-ccp-download',
    AUDIT_MS: '/api/v1/bot-engine/audit-ms-backup',
    AUDIT_CQG: '/api/v1/bot-engine/audit-cqg-backup',
    AUDIT_ACM: '/api/v1/bot-engine/audit-acm-backup',
    AUDIT_CCP: '/api/v1/bot-engine/audit-ccp-backup',
    TRIGGER_CE: '/api/v1/bot-engine/trigger-ce-download',
    AUDIT_CE: '/api/v1/bot-engine/audit-ce-backup',
    FETCH_EOD_EMAIL: '/api/v1/bot-engine/fetch-eod-email',
    AGENT_STATUS: '/api/v1/bot-engine/agent-status',
    BOT_CONFIG: '/api/v1/bot-engine/config',
    TEST_CONNECTION_MS: '/api/v1/bot-engine/test-connection',
    TEST_CONNECTION_CQG: '/api/v1/bot-engine/test-connection-cqg',
    TEST_CONNECTION_CQG1: '/api/v1/bot-engine/test-connection-cqg1',
    TEST_CONNECTION_CQG3: '/api/v1/bot-engine/test-connection-cqg3',
    TEST_CONNECTION_ACM: '/api/v1/bot-engine/test-connection-acm',
    TEST_CONNECTION_CCP: '/api/v1/bot-engine/test-connection-ccp',
    TEST_CONNECTION_CE: '/api/v1/bot-engine/test-connection-ce',
    UPLOAD_DAILY_FILES: '/api/v1/bot-engine/files/upload-daily',
    READINESS_MATRIX: (date: string) => `/api/v1/bot-engine/files/readiness-matrix?date=${encodeURIComponent(date)}`,
  },

  // ─── TRADING OPS (Đối chiếu giao dịch, Giám sát, KLGD, Dsgd-Before-EOD, GTT MS vs CQG) ──
  TRADING_OPS: {
    CONSOLE_SUMMARY: '/api/v1/trading-ops/console-summary',
    TRIGGER_RUN: '/api/v1/trading-ops/trigger-console-run',
    RECON_LOGS: (date: string) => `/api/v1/trading-ops/recon-logs/by-date/${encodeURIComponent(date)}`,
    RECON_LOG_DETAIL: (id: string) => `/api/v1/trading-ops/recon-logs/${encodeURIComponent(id)}`,
    DSGD_BEFORE_EOD: '/api/v1/trading-ops/check-dsgd-before-eod',
    CHECK_IMR: '/api/v1/trading-ops/check-imr',
    UPLOAD_KLGD: '/api/v1/trading-ops/upload-klgd',
    UPLOAD_DSGD_BEFORE_EOD: '/api/v1/trading-ops/upload-dsgd-before-eod',
    UPLOAD_EOD: '/api/v1/trading-ops/upload-eod',
    MATURITY_MESSAGES: (shiftLogId: string) => `/api/v1/trading-ops/maturity-manual-messages?shiftLogId=${encodeURIComponent(shiftLogId)}`,
    CHECK_NEGATIVE_MARGIN: '/api/v1/trading-ops/negative-margin',
    CHECK_EOD_RUN: '/api/v1/trading-ops/check-eod-run',
    RUN_CHECK_DSGD_BEFORE_EOD: '/api/v1/trading-ops/run-check-dsgd-before-eod',
    SAMPLE_DATES: '/api/v1/trading-ops/sample-dates',
    USD_RATE: '/api/v1/trading-ops/usd-rate',
    SYNC_USD_RATE: '/api/v1/trading-ops/sync-usd-rate',
    SYNC_MS_EXCHANGE_RATES: '/api/v1/trading-ops/sync-exchange-rates',
    RUN_TEST_LOCAL: '/api/v1/trading-ops/run-test-local',
    RUN_AUTO: '/api/v1/trading-ops/run-auto',
    TEST_UPLOAD: '/api/v1/trading-ops/test-upload',
    GTT_REPORT: (date?: string) =>
      date ? `/api/v1/trading-ops/gtt-report?date=${encodeURIComponent(date)}` : '/api/v1/trading-ops/gtt-report',
    GTT_CHECK: '/api/v1/trading-ops/run-gtt-check',
    GTT_PUSH_TO_MS: '/api/v1/trading-ops/gtt-report/push-to-ms',
    GTT_EXPORT_CORRECTION: (type: string = 'settlement') => `/api/v1/trading-ops/gtt-report/export-correction?type=${encodeURIComponent(type)}`,
  },

  // ─── CCP CLEARING (Bù trừ, Thống kê Lot/Value, GTT CE vs CCP) ─────────────
  CCP_CLEARING: {
    LOGS: (date: string) => `/api/v1/ccp-clearing/logs/by-date/${encodeURIComponent(date)}`,
    LOG_DETAIL: (id: string) => `/api/v1/ccp-clearing/logs/${encodeURIComponent(id)}`,
    EXCHANGE_RATES: '/api/v1/ccp-clearing/exchange-rates',
    SYNC_EXCHANGE_RATES: '/api/v1/trading-ops/sync-exchange-rates',
    SYNC_CCP_EXCHANGE_RATES: '/api/v1/ccp-clearing/lot-statistics/sync-exchange-rate',
    USD_RATE: '/api/v1/ccp-clearing/usd-rate',
    SYNC_USD_RATE: '/api/v1/ccp-clearing/sync-usd-rate',
    DOWNLOAD_CCP_METRICS: '/api/v1/ccp-clearing/download-ccp-metrics',
    CE_CCP_GTT_REPORT: (date?: string) =>
      date ? `/api/v1/ccp-clearing/ce-ccp-gtt-report?date=${encodeURIComponent(date)}` : '/api/v1/ccp-clearing/ce-ccp-gtt-report',
    RUN_CE_CCP_GTT_CHECK: '/api/v1/ccp-clearing/run-ce-ccp-gtt-check',
    EXPORT_CE_CCP_GTT: (type: string) =>
      `/api/v1/ccp-clearing/ce-ccp-gtt-report/export?type=${encodeURIComponent(type)}`,
    SYNC_EXCHANGE_RATE_LOT: '/api/v1/ccp-clearing/lot-statistics/sync-exchange-rate',
    LOT_CONFIG: '/api/v1/ccp-statistics/lot-statistics/config',
    LOT_SCAN: (date: string) => `/api/v1/ccp-statistics/lot-statistics/scan-daily?date=${encodeURIComponent(date)}`,
    LOT_STATISTICS: '/api/v1/ccp-statistics/lot-statistics',
    LOT_RUN: '/api/v1/ccp-statistics/lot-statistics/run-lot',
    VALUE_RUN: '/api/v1/ccp-statistics/lot-statistics/run-value',
    LOT_PROCESS: '/api/v1/ccp-statistics/lot-statistics/process-daily',
    LOT_ACCUMULATOR: '/api/v1/ccp-statistics/lot-statistics/write-accumulator',
    LOT_UPLOAD_TYGIA: '/api/v1/ccp-clearing/lot-statistics/upload-tygia',
    TRIGGER_LOT_MACRO: '/api/v1/bot-engine/trigger-lot-macro',
    TRIGGER_VALUE_MACRO: '/api/v1/bot-engine/trigger-value-macro',
    VALUE_CONFIG: '/api/v1/value-statistics/config',
    VALUE_PROCESS_LOCAL: '/api/v1/value-statistics/process-local',
    VALUE_PROCESS_TVKD_ONLY: '/api/v1/value-statistics/process-tvkd-only',
    LOT_STATS_CONFIG: '/api/v1/lot-statistics/config',
    LOT_STATS_PROCESS: '/api/v1/lot-statistics/process',
    LOT_STATS_PROCESS_LOCAL: '/api/v1/lot-statistics/process-local',
    LOT_STATS_PROCESS_DOWNLOAD: '/api/v1/lot-statistics/process/download',
    LOT_STATS_PROCESS_LOCAL_DOWNLOAD: '/api/v1/lot-statistics/process-local/download',
  },

  // ─── CE CLEARING (Thống kê Số Lot & Giá trị Giao dịch CoreEX) ─────────────
  CE_CLEARING: {
    LOT_SCAN: (date: string) => `/api/v1/ce-clearing/lot-statistics/scan-daily?date=${encodeURIComponent(date)}`,
    LOT_PROCESS: '/api/v1/ce-clearing/lot-statistics/process-daily',
    LOT_RUN: '/api/v1/ce-clearing/lot-statistics/run-lot',
    VALUE_RUN: '/api/v1/ce-clearing/lot-statistics/run-value',
    DRAFT_DOWNLOAD: (filename: string) =>
      `/api/v1/ce-clearing/lot-statistics/download-draft?filename=${encodeURIComponent(filename)}`,
    CONFIG: '/api/v1/ce-clearing/lot-statistics/config',
  },

  // ─── CHECKLIST HUB (Quản lý ca trực, Sự cố, Bot Dispatcher) ───────────────
  CHECKLIST_HUB: {
    ACTIVE_SHIFTS: '/api/v1/shifts/active',
    SHIFT_DETAIL: (id: string) => `/api/v1/shifts/${encodeURIComponent(id)}`,
    SHIFT_AUDIT: (id: string) => `/api/v1/shifts/${encodeURIComponent(id)}/audit-logs`,
    SHIFT_CLOSE: '/api/v1/shifts/close',
    SHIFT_ADD_TASK: (id: string) => `/api/v1/shifts/${encodeURIComponent(id)}/add-task`,
    SHIFT_UPDATE_STATUS: '/api/v1/shifts/items/status',
    SHIFT_SEARCH: (q: string) => `/api/v1/shifts/search/global?q=${encodeURIComponent(q)}`,
    INCIDENTS: (shiftId: string) => `/api/v1/incidents/shift/${encodeURIComponent(shiftId)}`,
    INCIDENT_RESOLVE: (id: string) => `/api/v1/incidents/${encodeURIComponent(id)}/resolve`,
    INCIDENT_EXPORT: (id: string) => `/api/v1/incidents/${encodeURIComponent(id)}/export`,
    JOBS: '/api/v1/bot-engine/jobs',
    JOB_DETAIL: (id: string) => `/api/v1/bot-engine/jobs/${encodeURIComponent(id)}`,
    JOB_CANCEL: (id: string) => `/api/v1/bot-engine/jobs/${encodeURIComponent(id)}/cancel`,
    JOB_CAPTCHA: (id: string) => `/api/v1/bot-engine/jobs/${encodeURIComponent(id)}/submit-captcha`,
    JOB_DOWNLOAD_ZIP: (id: string) => `/api/v1/bot-engine/jobs/${encodeURIComponent(id)}/download-zip`,
    TRIGGER_EMAIL: (shiftId: string, taskId: string) =>
      `/api/v1/bot-engine/trigger-email-check/${encodeURIComponent(shiftId)}/${encodeURIComponent(taskId)}`,
    TRIGGER_OMS: (shiftId: string, taskId: string) =>
      `/api/v1/bot-engine/trigger-oms-check/${encodeURIComponent(shiftId)}/${encodeURIComponent(taskId)}`,
    GTT_REPORT: (date?: string) =>
      date ? `/api/v1/trading-ops/gtt-report?date=${encodeURIComponent(date)}` : '/api/v1/trading-ops/gtt-report',
    GTT_CHECK: '/api/v1/trading-ops/run-gtt-check',
    GTT_UPLOAD: '/api/v1/bot-engine/gtt-upload',
    GTT_MARKET_CSV_UPLOAD: '/api/v1/bot-engine/market-csv-upload',
    GTT_COMMODITY_UPLOAD: '/api/v1/bot-engine/commodity-upload',
    GTT_PUSH_TO_MS: '/api/v1/trading-ops/gtt-report/push-to-ms',
    GTT_EXPORT_CORRECTION: (type: string = 'settlement') => `/api/v1/trading-ops/gtt-report/export-correction?type=${encodeURIComponent(type)}`,
    CE_CCP_GTT_REPORT: (date?: string) =>
      date ? `/api/v1/ccp-clearing/ce-ccp-gtt-report?date=${encodeURIComponent(date)}` : '/api/v1/ccp-clearing/ce-ccp-gtt-report',
    RUN_CE_CCP_GTT_CHECK: '/api/v1/ccp-clearing/run-ce-ccp-gtt-check',
    EXPORT_CE_CCP_GTT: (type: string) =>
      `/api/v1/ccp-clearing/ce-ccp-gtt-report/export?type=${encodeURIComponent(type)}`,
    SHIFT_INITIALIZE: '/api/v1/shifts/initialize',
    SHIFT_JOBS_GENERATE: '/api/v1/shift-jobs/generate',
    SHIFT_HISTORY: '/api/v1/shifts/history',
  },

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  DASHBOARD: {
    SYSTEM_STATUS: '/api/v1/dashboard/system-status',
    SUMMARY: (date: string) => `/api/v1/dashboard/summary?date=${encodeURIComponent(date)}`,
    ACTIVITY: (date: string, limit: number) => `/api/v1/dashboard/activity?date=${encodeURIComponent(date)}&limit=${limit}`,
    UNREAD_COUNT: (date: string, lastRead: string, lastCleared: string) =>
      `/api/v1/dashboard/unread-activities-count?date=${encodeURIComponent(date)}&lastReadTime=${encodeURIComponent(lastRead)}&lastClearedTime=${encodeURIComponent(lastCleared)}`,
    JOBS: (date?: string, status?: string) => {
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (status) params.append('status', status);
      const q = params.toString();
      return q ? `/api/v1/dashboard/jobs?${q}` : '/api/v1/dashboard/jobs';
    },
    INITIALIZE_SHIFT: '/api/v1/shifts/initialize',
    GENERATE_JOBS: '/api/v1/shift-jobs/generate',
    MARGIN_CHANGE_REQUESTS: '/api/v1/margin-change-requests',
    MARGIN_CHANGE_SCAN_DECISION: '/api/v1/margin-change-requests/scan-decision',
    MARGIN_CHANGE_APPROVE: (id: string) => `/api/v1/margin-change-requests/${encodeURIComponent(id)}/approve`,
    MARGIN_CHANGE_REJECT: (id: string) => `/api/v1/margin-change-requests/${encodeURIComponent(id)}/reject`,
    PENDING_INCIDENTS: '/api/v1/incidents/pending',
  },

  // ─── ADMIN ───────────────────────────────────────────────────────────────────
  ADMIN: {
    SYSTEM_SETTINGS: '/api/v1/system-settings',
    VERIFY_STORAGE_PATH: '/api/v1/system-settings/verify-storage-path',
    USERS: '/api/v1/users',
    USER_DETAIL: (id: string) => `/api/v1/users/${encodeURIComponent(id)}`,
    DEPARTMENTS: '/api/v1/departments',
    DEPARTMENT_DETAIL: (id: string) => `/api/v1/departments/${encodeURIComponent(id)}`,
    SHIFT_SLOTS: '/api/v1/shift-slots',
    SHIFT_SLOT_DETAIL: (id: string) => `/api/v1/shift-slots/${encodeURIComponent(id)}`,
    TEMPLATES: '/api/v1/templates',
    TEMPLATE_DETAIL: (id: string) => `/api/v1/templates/${encodeURIComponent(id)}`,
    PERMISSIONS: '/api/v1/permissions',
    ROLES: '/api/v1/roles',
    ROLE_PERMISSIONS: (code: string) => `/api/v1/roles/${encodeURIComponent(code)}/permissions`,
    ROLE_AUDIT_LOGS: '/api/v1/roles/audit-logs',
    NOTIFICATION_CHANNELS: '/api/v1/notifications/channels',
    NOTIFICATION_CHANNEL_DETAIL: (id: string) => `/api/v1/notifications/channels/${encodeURIComponent(id)}`,
    NOTIFICATION_RULES: '/api/v1/notifications/rules',
    NOTIFICATION_RULE_DETAIL: (id: string) => `/api/v1/notifications/rules/${encodeURIComponent(id)}`,
    NOTIFICATION_LOGS: '/api/v1/notifications/logs',
    NOTIFICATION_TEST: '/api/v1/notifications/test',
    WORKING_CALENDAR: '/api/v1/working-calendar',
    WORKING_CALENDAR_DETAIL: (date: string) => `/api/v1/working-calendar/${encodeURIComponent(date)}`,
    UPLOAD_BACKUP: '/api/v1/trading-ops/upload-backup',
    ACTIVITY_LOGS: '/api/v1/activity-logs',
  },

  // ─── TRADING REPORT (Báo cáo tổng hợp khối lượng & TTTT định kỳ) ────────────
  TRADING_REPORT: {
    EXCHANGE_RATES: '/api/v1/trading-report/exchange-rates',
    EXCHANGE_RATE_DETAIL: (id: string) => `/api/v1/trading-report/exchange-rates/${encodeURIComponent(id)}`,
    IMPORT_EXCHANGE_RATES: '/api/v1/trading-report/import-exchange-rates',
    CONFIG: '/api/v1/trading-report/config',
    PROCESS_MONTH: '/api/v1/trading-report/process-month',
    PROCESS_QUARTER: '/api/v1/trading-report/process-quarter',
    PROCESS_TTTT: '/api/v1/trading-report/process-tttt',
  },

  // ─── MARGIN CHECKER ──────────────────────────────────────────────────────────
  MARGIN_CHECKER: {
    CONFIG: '/margin-checker/config',
    CHECK_MARGIN: '/margin-checker/check-margin',
    CHECK_CHANGE: '/margin-checker/check-change',
  },

  // ─── CCP STATISTICS (LEGACY TOOL) ───────────────────────────────────────────
  CCP_STATISTICS: {
    CONFIG: '/ccp-statistics/config',
    PROCESS: '/ccp-statistics/process',
  },

  // ─── TKGD (TÀI KHOẢN GIAO DỊCH) ──────────────────────────────────────────────
  TKGD: {
    RECORDS: '/api/v1/tkgd/records',
    STATS: '/api/v1/tkgd/stats',
    SYNC_MAIL: '/api/v1/tkgd/sync-mail',
    SYNC_MSYSTEM: '/api/v1/tkgd/sync-msystem',
    REPARSE_ACCOUNT: '/api/v1/tkgd/reparse-account',
    RUN_PIPELINE_ALL: '/api/v1/tkgd/run-pipeline-all',
    RUN: '/api/v1/tkgd/run',
    DOWNLOAD_EXCEL: '/api/v1/tkgd/download-excel',
    MANIFEST: (accountCode: string) => `/api/v1/tkgd/files/manifest/${encodeURIComponent(accountCode)}`,
    MANUAL_APPROVE: (recordId: string) => `/api/v1/tkgd/records/${encodeURIComponent(recordId)}/manual-approve`,
    REVERT_APPROVE: (recordId: string) => `/api/v1/tkgd/records/${encodeURIComponent(recordId)}/revert-approve`,
    PROGRESS: '/api/v1/tkgd/progress',
    AUTO_PIPELINE_STATUS: '/api/v1/tkgd/auto-pipeline/status',
    AUTO_PIPELINE_TOGGLE: '/api/v1/tkgd/auto-pipeline/toggle',
    AUTO_PIPELINE_BACKFILL: '/api/v1/tkgd/auto-pipeline/backfill',
    LOGS: '/api/v1/tkgd/logs',
    CONFIG: '/api/v1/tkgd/config',
    AUTH_MICROSOFT: (userEmail: string) => `/api/v1/tkgd/auth/microsoft?userEmail=${encodeURIComponent(userEmail)}`,
    DISCONNECT_MICROSOFT: '/api/v1/tkgd/auth/microsoft/disconnect',
    TEST_MS: '/api/v1/tkgd/test-ms',
  },
} as const;
