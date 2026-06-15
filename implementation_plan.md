# Implementation Plan - Shift Checklist Digitalization (TradingMXV)

We will develop and deploy the digital checklist system for the operations shift at MXV. The system consists of a NestJS backend and a NextJS frontend, integrated with MongoDB as the database using an Embedded Document Model to handle shifts, users, departments, and tasks.

## User Review Required

> [!IMPORTANT]
> The database connection is configured to run on `mongodb://localhost:27017/trading_mxv`. Ensure that the local MongoDB instance is running (the system service is currently verified to be `RUNNING`).
>
> To support user credentials, we will seed default accounts:
> - **Admin**: `admin` / `Admin@MXV123` (Admin privileges)
> - **IT Staff**: `sonhh` / `Staff@MXV123` (IT Department Staff)
> - **Ops Staff**: `ops_staff` / `Staff@MXV123` (Delivery Ops Department Staff)
> - **Surv Staff**: `surv_staff` / `Staff@MXV123` (Market Surveillance Department Staff)

> [!WARNING]
> Running PowerShell scripts directly on this environment is subject to execution policy restrictions. We will invoke CLI utilities and packages using `cmd /c` to bypass these restrictions.

## Proposed Changes

### Backend Component (NestJS v10)
Initialize NestJS under `backend/` and install required dependencies.

#### [NEW] [backend/package.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/package.json)
Contains script configurations and production dependencies: mongoose, jwt, passport, bcrypt.

#### [NEW] [backend/src/app.module.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/app.module.ts)
Root application module configured with database connections and security modules.

#### [NEW] [backend/src/schemas/department.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/schemas/department.schema.ts)
Mongoose schema defining departments (`IT_CORE`, `RE_OPS`, `MARKET_SURV`).

#### [NEW] [backend/src/schemas/user.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/schemas/user.schema.ts)
Mongoose schema defining user profiles, hashed credentials, and roles.

#### [NEW] [backend/src/schemas/template.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/schemas/template.schema.ts)
Mongoose schema for templates defining session types (`OPEN`, `DURING`, `CLOSE`) and nested list of tasks.

#### [NEW] [backend/src/schemas/shift-log.schema.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/schemas/shift-log.schema.ts)
Mongoose schema tracking the actual shift execution snapshot, completion states, checked times, and notes.

#### [NEW] [backend/src/modules/auth/](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/modules/auth/)
Authentication logic, JWT token generation, guards, and registration hooks.

#### [NEW] [backend/src/modules/shifts/](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/modules/shifts/)
Shifts initialization, atomic task toggle updates, checklist close actions, and audit logs queries.

#### [NEW] [backend/src/database/seed.service.ts](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/backend/src/database/seed.service.ts)
Automatically populates initial departments, users, templates, and the 34 specific MXV tasks upon server startup.

---

### Frontend Component (NextJS v14/v15 App Router)
Initialize NextJS under `frontend/` using a glassmorphic design language, responsive sidebar layouts, and dark mode configuration.

#### [NEW] [frontend/package.json](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/package.json)
Configured with dependencies like lucide-react, chart.js, etc.

#### [NEW] [frontend/src/app/layout.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/layout.tsx)
Root layout defining fonts (Outfit/Inter) and theme provider wrappers.

#### [NEW] [frontend/src/app/globals.css](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/globals.css)
Global styling variables, dark/light theme properties, and glassmorphic utility classes.

#### [NEW] [frontend/src/app/login/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/login/page.tsx)
Beautiful login portal utilizing subtle glow effects and glass card structures.

#### [NEW] [frontend/src/app/dashboard/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/dashboard/page.tsx)
High-end, clean dashboard for stats overview, real-time progress indicators, and current shift summaries.

#### [NEW] [frontend/src/app/checklist/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/checklist/page.tsx)
Operational worksheet. Allows selecting session (OPEN/DURING/CLOSE), toggling tasks with comments, and submitting/closing shift logs.

#### [NEW] [frontend/src/app/history/page.tsx](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/history/page.tsx)
Audit log historical page supporting searches, date filters, and detail expansions.

#### [NEW] [frontend/src/app/admin/](file:///c:/Users/hiepth/OneDrive%20-%20MERCANTILE%20EXCHANGE%20OF%20VIETNAM/Documents/Github/TradingMXV/frontend/src/app/admin/)
Administration panel for managing users, templates, and departments.

## Verification Plan

### Automated Tests
1. **Database Seeding Verification**: Ensure startup queries successfully populate all 34 tasks.
2. **REST API Endpoint Testing**:
   - Verify `POST /api/v1/auth/login` returns valid token.
   - Verify `POST /api/v1/shifts/initialize` initializes database objects correctly.
   - Verify `PATCH /api/v1/shifts/items/toggle` changes task statuses atomically.

### Manual Verification
1. **UI Layout and Themes**: Inspect layout responsiveness, sidebar navigation, dark/light switches, and card displays.
2. **Session Progression**: Execute a staff workflow from opening a ca trực, ticking tasks, inputting notes, and submitting the shift log. Confirm progress meters scale in real-time.
3. **Audit Log Inspection**: Query historical shifts and verify that changes show correct editors, comments, and audit dates.
