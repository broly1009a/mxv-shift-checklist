# Prompt for Antigravity/Vibe Coding - MXV Shift Checklist Sprint 1

You are working in the repository:

```text
mxv-shift-checklist
```

The product is the **MXV Shift Checklist Digitalization System**. Read and follow the business overview in:

```text
MXV_SHIFT_CHECKLIST_SYSTEM_OVERVIEW_ENGLISH.md
```

Your task is to implement **Sprint 1** only.

Do not implement Sprint 2 or Sprint 3 features unless they are strictly needed as schema placeholders for Sprint 1.

---

## 1. Current Project Context

The project already has:

### Backend

NestJS + MongoDB/Mongoose backend under:

```text
backend/
```

Important existing files/modules:

```text
backend/src/app.module.ts
backend/src/modules/auth/
backend/src/modules/admin/
backend/src/modules/shifts/
backend/src/modules/activity-log/
backend/src/schemas/user.schema.ts
backend/src/schemas/department.schema.ts
backend/src/schemas/template.schema.ts
backend/src/schemas/shift-log.schema.ts
backend/src/schemas/activity-log.schema.ts
backend/src/schemas/audit-log.schema.ts
backend/src/database/seed.service.ts
```

Existing backend capabilities:

* Authentication and authorization with JWT and role guards.
* User management.
* Department management.
* Checklist template CRUD.
* Manual shift initialization through `POST /api/v1/shifts/initialize`.
* Checklist task toggle/update.
* Shift close.
* Shift history and active shift listing.
* Activity logging for write operations.
* Audit logs for checklist task actions.

### Frontend

Next.js frontend under:

```text
frontend/
```

Important existing pages:

```text
frontend/src/app/dashboard/page.tsx
frontend/src/app/checklist/page.tsx
frontend/src/app/admin/departments/page.tsx
frontend/src/app/admin/templates/page.tsx
frontend/src/app/admin/users/page.tsx
frontend/src/app/history/page.tsx
```

Existing frontend capabilities:

* Login/protected routes.
* Dashboard.
* Manual shift initialization from dashboard.
* Checklist execution UI.
* Department admin UI.
* Template/task admin UI.
* User admin UI.
* Shift history UI.

---

## 2. Sprint 1 Business Target

Sprint 1 target from the business overview:

```text
Calendar
→ Generate Shift Job
→ Execute Checklist
→ Save Activity Log
```

Sprint 1 scope:

* Authentication & Authorization
* Department Management
* Working Calendar
* Shift Slot Management
* Checklist Template Management
* Shift Job Management
* Activity Logs

The codebase already has several of these partially implemented. Your job is to complete the missing pieces and align the implementation with the business overview.

---

## 3. Important Business Rules

### Target Departments

The overview defines these target departments:

```text
IT_CORE
QLGD_OPS
QLRR_RISK
```

Current seed data uses older/different department codes:

```text
IT_CORE
RE_OPS
MARKET_SURV
```

For Sprint 1, align department seed data and templates to the overview codes:

```text
IT_CORE
QLGD_OPS
QLRR_RISK
```

Use clear department names. Suggested mapping:

```text
IT_CORE   -> IT Core Operations
QLGD_OPS  -> Trading Operations
QLRR_RISK -> Risk Management
```

If Vietnamese display names already exist in the UI, keep the Vietnamese user-facing style, but make the department codes match the overview.

### Shift Slots

The system must support configurable shift slots.

Default shift slots:

```text
SHIFT_1      14:00 -> 22:00
SHIFT_2      22:00 -> 06:00 next day
SHIFT_3      06:00 -> 14:00
OFFICE_SHIFT 08:00 -> 17:30
```

Shift slots must be stored in MongoDB, not hardcoded into business logic.

For Sprint 1, admin UI for shift slots is optional. Backend schema, API, and seed data are required.

### Working Calendar

The system must maintain a working/trading calendar.

For each date, the system must know:

* Whether it is a trading day.
* Whether it is a public holiday.
* Whether it is a weekend.
* Optional note/reason.

If a date is not a trading day:

* No shift jobs should be generated for that date.

If a date is a trading day:

* The system can generate shift jobs for that date.

### Checklist Templates

Each checklist template must belong to:

* Department
* Shift Slot
* Task list

Current implementation uses:

```text
departmentId
sessionType: OPEN | DURING | CLOSE
tasks
```

Sprint 1 must add support for:

```text
shiftSlotId
```

You may keep `sessionType` temporarily for backward compatibility with the existing frontend, but the new Sprint 1 workflow should use `shiftSlotId` as the primary shift mapping.

Task attributes required by the overview:

* Task Name
* Function URL
* URD Reference
* File Location
* Timetable
* Is Bot Check
* Bot Trigger Time

Current tasks only have:

* taskId
* taskName
* priority
* sortOrder
* deadline

For Sprint 1, extend task schema to include these optional fields:

```text
functionUrl?: string
urdReference?: string
fileLocation?: string
timetable?: string
isBotCheck?: boolean
botTriggerTime?: string
```

Do not implement actual bot execution in Sprint 1.

### Shift Jobs

The overview calls generated operational checklist instances "shift jobs".

The current system uses `ShiftLog` as the real checklist instance. You may either:

1. Keep using `ShiftLog` but align naming/API comments with "shift job".
2. Introduce a separate `ShiftJob` schema if this is cleaner.

Prefer minimal disruption: keep `ShiftLog` if possible, but add missing fields needed for generated jobs.

Each generated job should include:

* Template reference.
* Department reference.
* Shift slot reference.
* Shift date.
* Status.
* Progress.
* Snapshot of template tasks.
* Creation source, such as `SYSTEM_CRON`, `MANUAL_ADMIN`, or `MANUAL_USER`.

The current `ShiftLog` requires `userId`. Auto-generated jobs may not have a human creator, so update the model to support either:

```text
createdBy?: ObjectId | null
createdByType: USER | SYSTEM
```

or make `userId` nullable and add a clear source field.

Avoid breaking existing checklist execution.

### Job Generation

Implement a service that:

1. Accepts a date in `YYYY-MM-DD`.
2. Validates whether the date is a trading day using Working Calendar.
3. If not a trading day, returns a clear result and generates no jobs.
4. If trading day, finds active checklist templates.
5. Generates one shift job per applicable template/department/shift slot/date.
6. Prevents duplicate jobs for the same template/date/shift slot.
7. Records activity/system logs.

Required manual endpoint:

```text
POST /api/v1/shift-jobs/generate
```

Request body:

```json
{
  "date": "2026-06-19"
}
```

Response should include:

```json
{
  "date": "2026-06-19",
  "isTradingDay": true,
  "created": 12,
  "skipped": 0,
  "jobs": []
}
```

You can choose the exact shape, but it must be useful to the frontend and tests.

### Cron Job

Add a scheduled cron job that runs daily at:

```text
00:01 Asia/Saigon
```

It should call the same generation service.

Use NestJS schedule support, likely:

```text
@nestjs/schedule
ScheduleModule.forRoot()
```

If the package is not installed, add it to backend dependencies.

### Activity/System Logs

The existing `ActivityLogInterceptor` logs authenticated write requests.

Sprint 1 also needs logs for system-generated events:

* Calendar validation for generation.
* Manual shift job generation.
* Cron shift job generation.
* Checklist task completion/modification.

You may add a `SystemLog` schema or extend `ActivityLog` carefully.

Keep existing `AuditLog` behavior for checklist task actions.

---

## 4. Required Backend Work

### 4.1 Add Working Calendar

Create:

```text
backend/src/schemas/working-calendar.schema.ts
backend/src/modules/working-calendar/
```

Suggested schema:

```ts
date: string; // YYYY-MM-DD, unique
isTradingDay: boolean;
isHoliday: boolean;
isWeekend: boolean;
note?: string;
createdBy?: ObjectId | null;
updatedBy?: ObjectId | null;
```

Required APIs:

```text
GET    /api/v1/working-calendar
GET    /api/v1/working-calendar/:date
POST   /api/v1/working-calendar
PUT    /api/v1/working-calendar/:date
DELETE /api/v1/working-calendar/:date
GET    /api/v1/working-calendar/:date/validate
```

Admin-only for create/update/delete.
Authenticated users may read/validate.

Validation behavior:

* If date exists in calendar, use stored value.
* If date does not exist, compute weekend from date and default:
  * weekend -> not trading day
  * weekday -> trading day
* This fallback should be explicit in response.

### 4.2 Add Shift Slot Management

Create:

```text
backend/src/schemas/shift-slot.schema.ts
backend/src/modules/shift-slots/
```

Suggested schema:

```ts
name: string;
code: string; // unique
startTime: string; // HH:mm
endTime: string; // HH:mm
isOvernight: boolean;
isActive: boolean;
sortOrder: number;
```

Required APIs:

```text
GET    /api/v1/shift-slots
GET    /api/v1/shift-slots/:id
POST   /api/v1/shift-slots
PUT    /api/v1/shift-slots/:id
DELETE /api/v1/shift-slots/:id
```

Admin-only for write operations.
Authenticated users may read.

Seed default shift slots in:

```text
backend/src/database/seed.service.ts
```

### 4.3 Extend Checklist Template

Update:

```text
backend/src/schemas/template.schema.ts
backend/src/modules/admin/templates.controller.ts
frontend/src/app/admin/templates/page.tsx
```

Add:

```ts
shiftSlotId: ObjectId ref ShiftSlot
isActive: boolean
```

Extend task item fields:

```ts
functionUrl?: string
urdReference?: string
fileLocation?: string
timetable?: string
isBotCheck?: boolean
botTriggerTime?: string
```

Backend template listing should populate:

```text
departmentId
shiftSlotId
```

Template create/update must accept `shiftSlotId`.

Frontend admin template form should allow selecting a shift slot.

Keep existing task edit workflow working. Add optional fields in a practical way. A full complex UI is not required, but the user must be able to create/update the fields or at least the backend must support them.

### 4.4 Implement Shift Job Generation

Create a generation service, either inside `shifts` or a new module:

Preferred:

```text
backend/src/modules/shift-jobs/
```

Required endpoint:

```text
POST /api/v1/shift-jobs/generate
```

Admin or authorized manager only.

Also provide read endpoints if needed by frontend:

```text
GET /api/v1/shift-jobs
GET /api/v1/shift-jobs/active
GET /api/v1/shift-jobs/:id
```

You can reuse existing `shifts` endpoints if less disruptive, but the generation endpoint must exist.

Generation logic:

* Input date defaults to today's date in Asia/Saigon if not provided.
* Validate trading day through Working Calendar.
* If not trading day, no jobs are created.
* Find active templates.
* For each template:
  * Require department and shift slot.
  * Create job if not already existing for date/template/shift slot.
  * Clone task snapshot from template.
* Return created/skipped counts.
* Record a system/activity log.

Duplicate prevention should be enforced in code and preferably by an index.

### 4.5 Add Daily Cron

Add scheduler:

```text
backend/src/modules/shift-jobs/shift-job.scheduler.ts
```

Cron:

```text
00:01 Asia/Saigon
```

It should call the same generation service used by the manual endpoint.

### 4.6 Keep Checklist Execution Working

Existing checklist execution must continue to work:

```text
PATCH /api/v1/shifts/items/toggle
POST  /api/v1/shifts/close
GET   /api/v1/shifts/active
GET   /api/v1/shifts/history
GET   /api/v1/shifts/:id
```

If you refactor naming from shift logs to shift jobs, keep backward compatibility for existing frontend routes unless you also update frontend fully.

---

## 5. Required Frontend Work

### 5.1 Add Working Calendar Admin Page

Create a page such as:

```text
frontend/src/app/admin/calendar/page.tsx
```

Features:

* List calendar records.
* Add/edit/delete date records.
* Fields:
  * date
  * isTradingDay
  * isHoliday
  * isWeekend
  * note
* Validate a date.

Add navigation entry if the sidebar/header has admin links.

### 5.2 Update Template Admin Page

Update:

```text
frontend/src/app/admin/templates/page.tsx
```

Add shift slot selection when creating/editing templates.

Show shift slot in template list/detail.

Support the new optional task fields as much as practical:

* function URL
* URD reference
* file location
* timetable
* bot flag
* bot trigger time

### 5.3 Update Dashboard

Update:

```text
frontend/src/app/dashboard/page.tsx
```

Current dashboard manually initializes shifts by choosing a template.

Sprint 1 dashboard should support the new workflow:

* Show today's generated shift jobs.
* Add an admin-only/manual button to generate jobs for a selected date.
* If today is not a trading day, show a clear "No trading day / no jobs generated" state.
* Keep existing "open checklist" behavior.

Manual initialization may remain for compatibility, but the preferred Sprint 1 path should be:

```text
Generate jobs from calendar -> open checklist -> execute tasks
```

### 5.4 Keep Checklist Page Working

Update only as needed:

```text
frontend/src/app/checklist/page.tsx
```

It must still:

* Open a generated job/checklist.
* Toggle task completion.
* Save notes.
* Show audit logs.
* Close shift/job.

---

## 6. Out of Scope for Sprint 1

Do not implement these beyond schema placeholders:

* Real bot execution.
* Bot validation rules.
* Notification module implementation.
* Telegram/email/web notification workflows, except existing code must not break.
* SLA management.
* Shift assignment to specific operators.
* Production-grade dashboard analytics.
* Real-time WebSocket enhancements beyond keeping existing behavior working.
* Night shift reporting date decision for `SHIFT_2`; mark it clearly as pending if needed.

For `SHIFT_2` overnight handling, use a simple implementation for generation:

* Job belongs to the input generation date.
* Add `isOvernight: true` on the shift slot.
* Do not implement complex reporting logic yet.

---

## 7. Data Migration and Backward Compatibility

This is an active codebase. Avoid destructive changes.

Important:

* Do not delete existing collections.
* Do not break existing login.
* Do not break existing checklist execution.
* Preserve existing APIs where the frontend depends on them.
* If adding required schema fields, provide defaults or migration-safe behavior.
* Existing templates without `shiftSlotId` should not crash the app. Either backfill in seed or handle gracefully.

Update seed data so a fresh database can run Sprint 1 end-to-end.

Seed required:

* Departments: `IT_CORE`, `QLGD_OPS`, `QLRR_RISK`.
* Shift slots: `SHIFT_1`, `SHIFT_2`, `SHIFT_3`, `OFFICE_SHIFT`.
* Checklist templates linked to departments and shift slots.
* A small working calendar sample, including at least:
  * today or a recent weekday as trading day
  * one weekend/non-trading day
  * one holiday/non-trading day

---

## 8. Suggested Implementation Order

Follow this order:

1. Add `ShiftSlot` schema/module/API and seed default shift slots.
2. Add `WorkingCalendar` schema/module/API and validation logic.
3. Extend `ChecklistTemplate` schema with `shiftSlotId`, `isActive`, and optional task fields.
4. Update template backend controller and frontend admin template page.
5. Add shift job generation service and manual endpoint.
6. Add cron scheduler for 00:01 Asia/Saigon.
7. Update dashboard to show generated jobs and trigger manual generation.
8. Add admin calendar page.
9. Verify checklist execution still works.
10. Update DBML/documentation if practical.

---

## 9. Acceptance Criteria

Sprint 1 is complete when all of these are true:

### Backend

* App starts successfully.
* Existing auth works.
* Existing department/user/template APIs still work.
* `GET /api/v1/shift-slots` returns seeded default shift slots.
* `GET /api/v1/working-calendar/:date/validate` returns trading-day status.
* Admin can create/update/delete working calendar records.
* Template records can be linked to a shift slot.
* Manual generation endpoint can generate jobs for a trading day.
* Manual generation endpoint creates no jobs for a non-trading day.
* Running generation twice for the same date does not create duplicates.
* Generated jobs can be opened and executed through the existing checklist flow.
* Task toggle creates audit logs.
* Job generation creates activity/system logs.
* Cron job is registered and calls the same generation service.

### Frontend

* Admin can manage working calendar records.
* Admin can select shift slot for templates.
* Dashboard shows generated jobs for today.
* Admin can manually trigger job generation from dashboard.
* Users can open a generated job and complete checklist tasks.
* Existing history/checklist pages do not break.

### Tests/Verification

At minimum, run:

```text
cd backend
npm run build
npm test
```

And:

```text
cd frontend
npm run build
```

If tests are missing or fail for unrelated existing reasons, document exactly what failed and why.

---

## 10. Engineering Constraints

Follow the existing code style and patterns.

Use Mongoose schemas consistently.

Use NestJS modules/controllers/services.

Use existing `JwtAuthGuard`, `RolesGuard`, and `Roles` decorator.

Prefer small, focused changes over large rewrites.

Avoid unnecessary frontend redesign. Preserve the existing visual language.

Do not remove existing Telegram/WebSocket code unless it is clearly broken and blocks Sprint 1.

Do not implement hidden behavior. Make job generation results visible and inspectable.

---

## 11. Final Deliverable

When finished, provide:

1. Summary of what changed.
2. List of new backend modules/schemas/endpoints.
3. List of updated frontend pages.
4. How to test Sprint 1 manually.
5. Commands run and results.
6. Any remaining known gaps, especially:
   * Night shift reporting date rule.
   * Bot automation details.
   * Notification module.
   * SLA management.

