# Prompt for Antigravity/Vibe Coding - MXV Shift Checklist Sprint 2A

You are working in the repository:

```text
mxv-shift-checklist
```

Read the business overview first:

```text
MXV_SHIFT_CHECKLIST_SYSTEM_OVERVIEW_ENGLISH.md
```

Also read the Sprint 1 implementation context and current codebase before changing code.

This prompt is for **Sprint 2A - Technical Foundation**.

Sprint 2A exists because Sprint 1 is complete, but the business/HR team has not yet provided all detailed checklist items, notification rules, SLA rules, escalation rules, or bot validation rules.

Your goal is to build the **technical foundation for Sprint 2** without hardcoding incomplete business requirements.

---

## 1. Sprint 2A Principle

Build configurable infrastructure.

Do not implement unconfirmed business rules.

The system should become ready for future configuration once the business team provides:

* Final checklist task details
* Notification recipients
* Notification channels
* Alert conditions
* SLA thresholds
* Escalation matrix
* Bot validation rules

Sprint 2A should make those future requirements easy to add without refactoring core architecture.

---

## 2. Sprint 2A Scope

Implement these technical foundations:

* Production dashboard APIs using real database data.
* Dashboard frontend wired to real APIs instead of mock/static metrics.
* Notification module skeleton.
* Notification configuration schema/API.
* Notification log schema/API.
* Realtime WebSocket event structure for operational events.
* System event logging for generated jobs, checklist execution, job closure, and notification attempts.
* Placeholder SLA schema/config only if useful, but no SLA enforcement rules yet.

Do not implement:

* Real bot engine.
* Bot validation rules.
* Automated reconciliation.
* Hardcoded notification recipients.
* Hardcoded SLA escalation.
* Complex night-shift reporting logic.
* Business-specific alert thresholds unless configurable.

---

## 3. Current Assumptions

Sprint 1 should already provide or partially provide:

* Authentication and authorization.
* Department management.
* Working calendar.
* Shift slot management.
* Checklist template management.
* Shift job generation.
* Checklist execution.
* Activity/audit logging.

If some Sprint 1 pieces are missing, do not silently skip them. Document the gap and implement Sprint 2A in a way that does not break existing behavior.

---

## 4. Production Dashboard APIs

The current dashboard may contain mock metrics. Replace mock metrics with backend APIs based on real data.

Create a backend module if not already present:

```text
backend/src/modules/dashboard/
```

Recommended endpoints:

```text
GET /api/v1/dashboard/summary
GET /api/v1/dashboard/jobs
GET /api/v1/dashboard/departments
GET /api/v1/dashboard/shift-slots
GET /api/v1/dashboard/activity
```

All endpoints must require authentication.

Respect existing role/department scope:

* ADMIN, CEO, CHAIRMAN can see all data.
* DIVISION_DIRECTOR can see data for their division.
* DEPARTMENT_HEAD and STAFF can see data for their department.

### 4.1 Summary API

Endpoint:

```text
GET /api/v1/dashboard/summary?date=YYYY-MM-DD
```

Return real metrics:

```json
{
  "date": "2026-06-19",
  "totalJobs": 12,
  "pendingJobs": 8,
  "completedJobs": 4,
  "totalTasks": 120,
  "completedTasks": 87,
  "pendingTasks": 33,
  "completionPercentage": 72.5,
  "failedTasks": 0,
  "botTasks": 0,
  "manualTasks": 120
}
```

Notes:

* If bot fields are not yet meaningful, return `0` or computed placeholder values from `isBotCheck`.
* Do not invent fake business numbers.

### 4.2 Jobs API

Endpoint:

```text
GET /api/v1/dashboard/jobs?date=YYYY-MM-DD&status=PENDING
```

Return job list with:

* job id
* shift date
* department
* shift slot
* template title
* status
* progress percentage
* total tasks
* completed tasks
* created source

### 4.3 Department Stats API

Endpoint:

```text
GET /api/v1/dashboard/departments?date=YYYY-MM-DD
```

Return grouped metrics by department:

```json
[
  {
    "departmentCode": "IT_CORE",
    "departmentName": "IT Core Operations",
    "totalJobs": 4,
    "completedJobs": 2,
    "totalTasks": 40,
    "completedTasks": 31,
    "completionPercentage": 77.5
  }
]
```

### 4.4 Shift Slot Stats API

Endpoint:

```text
GET /api/v1/dashboard/shift-slots?date=YYYY-MM-DD
```

Return grouped metrics by shift slot:

```json
[
  {
    "shiftSlotCode": "SHIFT_1",
    "shiftSlotName": "Shift 1",
    "totalJobs": 3,
    "completedJobs": 1,
    "totalTasks": 25,
    "completedTasks": 12,
    "completionPercentage": 48
  }
]
```

### 4.5 Activity API

Endpoint:

```text
GET /api/v1/dashboard/activity?date=YYYY-MM-DD&limit=20
```

Return recent operational activity from audit logs, activity logs, and/or system logs.

Normalize response shape:

```json
[
  {
    "id": "string",
    "type": "TASK_UPDATED",
    "message": "Task checked",
    "actorName": "Nguyen Van A",
    "departmentCode": "IT_CORE",
    "jobId": "string",
    "createdAt": "2026-06-19T08:30:00.000Z"
  }
]
```

---

## 5. Frontend Dashboard Update

Update:

```text
frontend/src/app/dashboard/page.tsx
```

Replace mock/static dashboard data with the real dashboard APIs.

The dashboard should show:

* Total jobs for selected date.
* Total tasks.
* Completion percentage.
* Pending jobs.
* Completed jobs.
* Department statistics.
* Shift slot statistics.
* Recent activity.
* Today's generated jobs.

Add a date selector if not present.

Keep the existing ability to open a checklist/job detail.

Avoid a full redesign. Preserve the current visual language unless the existing UI blocks the new functionality.

---

## 6. Notification Module Skeleton

Create a module:

```text
backend/src/modules/notifications/
```

Create schemas:

```text
backend/src/schemas/notification-channel.schema.ts
backend/src/schemas/notification-rule.schema.ts
backend/src/schemas/notification-log.schema.ts
```

### 6.1 Notification Channel Schema

Suggested fields:

```ts
name: string;
code: string;
type: 'TELEGRAM' | 'EMAIL' | 'WEB';
isActive: boolean;
config: Record<string, any>;
createdBy?: ObjectId | null;
updatedBy?: ObjectId | null;
```

Important:

* Do not store secrets in plain text unless existing project conventions already do this.
* If token/secret fields are needed, mark them clearly and avoid returning them in API responses.

### 6.2 Notification Rule Schema

Suggested fields:

```ts
name: string;
code: string;
eventType: string;
departmentId?: ObjectId | null;
shiftSlotId?: ObjectId | null;
channelIds: ObjectId[];
recipientUsers?: ObjectId[];
recipientRoles?: string[];
isActive: boolean;
conditions: Record<string, any>;
template: {
  title: string;
  body: string;
};
```

Do not hardcode real conditions yet.

Example event types:

```text
SHIFT_JOB_GENERATED
SHIFT_JOB_CLOSED
TASK_COMPLETED
TASK_UNCHECKED
TASK_NOTE_UPDATED
JOB_OVERDUE_PLACEHOLDER
BOT_TASK_FAILED_PLACEHOLDER
```

The placeholder event types may exist, but do not implement actual SLA/bot logic yet.

### 6.3 Notification Log Schema

Suggested fields:

```ts
eventType: string;
channelType: string;
channelId?: ObjectId | null;
ruleId?: ObjectId | null;
recipient?: string;
status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
payload: Record<string, any>;
errorMessage?: string;
createdAt: Date;
sentAt?: Date | null;
```

### 6.4 Notification APIs

Add authenticated/admin APIs:

```text
GET    /api/v1/notifications/channels
POST   /api/v1/notifications/channels
PUT    /api/v1/notifications/channels/:id
DELETE /api/v1/notifications/channels/:id

GET    /api/v1/notifications/rules
POST   /api/v1/notifications/rules
PUT    /api/v1/notifications/rules/:id
DELETE /api/v1/notifications/rules/:id

GET    /api/v1/notifications/logs
```

For Sprint 2A, sending can be a dry-run/stub:

```text
POST /api/v1/notifications/test
```

It should create a notification log with status `SKIPPED` or `SENT` depending on whether a real existing service is safely available.

Do not force real Telegram/email integration if requirements are not finalized.

---

## 7. Realtime WebSocket Event Structure

If the project already has a shifts gateway, extend it carefully.

Define consistent event names:

```text
shift-job-generated
shift-job-updated
shift-job-closed
task-updated
notification-created
dashboard-updated
```

When key actions happen, emit appropriate events:

* Job generation.
* Task toggle/note update.
* Job close.
* Notification log creation.

The payload should be consistent:

```json
{
  "eventType": "TASK_UPDATED",
  "jobId": "string",
  "departmentId": "string",
  "shiftSlotId": "string",
  "date": "YYYY-MM-DD",
  "data": {}
}
```

Do not build complex realtime subscription permissions unless required. Use existing auth/scope patterns where available.

---

## 8. System Event Logging

If Sprint 1 did not add a system log, add one now.

Create:

```text
backend/src/schemas/system-log.schema.ts
```

Suggested fields:

```ts
eventType: string;
source: 'SYSTEM' | 'CRON' | 'USER' | 'NOTIFICATION' | 'BOT_PLACEHOLDER';
actorUserId?: ObjectId | null;
jobId?: ObjectId | null;
departmentId?: ObjectId | null;
shiftSlotId?: ObjectId | null;
status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
message: string;
metadata: Record<string, any>;
createdAt: Date;
```

Log at least:

* Shift job generation.
* Shift job duplicate skip.
* Non-trading-day generation skip.
* Shift job close.
* Notification test/stub attempts.

---

## 9. Optional SLA Placeholder

If it fits cleanly, create a placeholder schema:

```text
backend/src/schemas/sla-policy.schema.ts
```

Suggested fields:

```ts
name: string;
code: string;
departmentId?: ObjectId | null;
shiftSlotId?: ObjectId | null;
taskPriority?: string | null;
thresholdMinutes: number;
isActive: boolean;
notificationRuleIds: ObjectId[];
```

Do not enforce SLA yet.

Do not show SLA status as real business output unless it is clearly marked as not configured.

---

## 10. Admin UI for Notifications

If time permits, add simple admin pages:

```text
frontend/src/app/admin/notifications/page.tsx
```

Minimum useful features:

* List notification channels.
* Create/edit basic channel metadata.
* List notification rules.
* Create/edit basic rule metadata.
* View notification logs.

If frontend work would become too large, prioritize backend APIs and logs first.

---

## 11. Acceptance Criteria

Sprint 2A is complete when:

### Backend

* Backend builds successfully.
* Dashboard APIs return real data from MongoDB.
* Dashboard APIs respect user role/department scope.
* Notification schemas and APIs exist.
* Notification test/stub creates logs.
* System logs exist for operational events.
* Existing Sprint 1 flow still works:
  * Generate jobs.
  * Open checklist.
  * Toggle task.
  * Close job.
  * View history.
* WebSocket events are emitted for key operational changes, or documented if intentionally deferred.

### Frontend

* Dashboard uses real APIs.
* Dashboard no longer shows fake static metrics as production values.
* User can select date and inspect jobs/statistics.
* Existing checklist page still works.
* If notification UI is implemented, admin can view/manage basic config.

### Verification Commands

Run:

```text
cd backend
npm run build
npm test
```

Run:

```text
cd frontend
npm run build
```

If a command fails because of pre-existing issues, document:

* Command.
* Error summary.
* Whether the failure is related to Sprint 2A changes.

---

## 12. Final Report

When done, provide:

1. Summary of implemented Sprint 2A scope.
2. New backend schemas/modules/endpoints.
3. Updated frontend pages.
4. How dashboard data is calculated.
5. How notification skeleton works.
6. What is still waiting for business/HR requirements.
7. Commands run and results.

Explicitly list deferred items:

* Detailed checklist content from business/HR.
* Notification recipient matrix.
* Notification channel decision.
* SLA rules.
* Escalation rules.
* Bot validation/pass-fail rules.
* Night shift reporting date rule.

