# BUSINESS OVERVIEW – MXV SHIFT CHECKLIST DIGITALIZATION SYSTEM

# 1. System Objectives

The system is designed to fully replace paper-based checklists, Excel files, and manual operational monitoring processes used by MXV shift operators.

Target departments:

* IT_CORE
* QLGD_OPS
* QLRR_RISK

Main objectives:

* Digitize all operational checklists
* Automatically generate checklists based on trading days
* Support automated execution through system bots where applicable
* Maintain a complete audit trail for compliance and post-operation reviews
* Monitor checklist execution progress in real time
* Provide a foundation for future operational monitoring and automation capabilities

---

# 2. High-Level Business Workflow

## Step 1 – Determine Trading Day

The system maintains a Working Calendar.

For each day, the system determines:

* Whether it is a trading day
* Whether it is a public holiday
* Whether it falls on a weekend

If the day is not a trading day:

* No shift checklist jobs will be generated

If the day is a trading day:

* Proceed to Shift Job Generation

---

## Step 2 – Automatic Shift Job Generation

A scheduled Cron Job runs daily at:

```text
00:01 AM
```

If the current day is a Trading Day:

The system automatically generates shift jobs based on:

* Department
* Shift Slot
* Checklist Template

Each generated job is created by cloning the configured checklist template.

---

## Step 3 – Checklist Execution

Users belonging to the corresponding department access the system and perform checklist activities.

Typical activities include:

* Accessing operational systems
* Verifying business data
* Performing system health checks
* Marking checklist items as completed

All actions are recorded in the Activity Log.

---

## Step 4 – Bot Automation (Future Phase)

For checklist items that can be automated, such as:

* Backup verification
* Data file validation
* Reconciliation checks
* Service health monitoring

The system bot will execute tasks automatically according to predefined schedules.

### Success Scenario

```text
Task Status = PASSED
Updated By = SYSTEM_BOT
```

### Failure Scenario

```text
Task Status = FAILED
```

The bot records error details and generates alerts.

The shift operator will then investigate and manually confirm the final result.

---

# 3. Shift Model

The system is designed with a configurable shift architecture while providing predefined default shifts.

## Shift 1

```text
14:00 → 22:00
```

## Shift 2

```text
22:00 → 06:00 (Next Day)
```

## Shift 3

```text
06:00 → 14:00
```

## Office Shift

```text
08:00 → 17:30
```

Shift configurations are stored in a dedicated collection:

```text
shift_slots
```

This allows future modifications without code changes.

---

# 4. Confirmed Modules Ready for Development

## Module 1 – Authentication & Authorization

Features:

* Login
* Logout
* User Management
* Department Management
* Role Management
* Permission Management

---

## Module 2 – Working Calendar

Manage:

* Public Holidays
* Non-working Days
* Trading Days

Functions:

* Calendar CRUD Operations
* Trading Day Validation
* Support for Job Generation Process

---

## Module 3 – Shift Slot Management

Manage shift definitions.

Attributes:

* Shift Name
* Shift Code
* Start Time
* End Time
* Active Status

Default data can be seeded initially.

Administrative UI is not required at this stage.

---

## Module 4 – Checklist Template Management

Manage checklist templates.

Each template consists of:

* Department
* Shift Slot
* Task List

Task Attributes:

* Task Name
* Function URL
* URD Reference
* File Location
* Timetable
* Is Bot Check
* Bot Trigger Time

---

## Module 5 – Shift Job Management

Manage generated operational checklists.

Functions:

* Automatic Job Generation
* Job Listing
* Job Details
* Task Completion Updates
* Status Management

---

## Module 6 – Activity Logs

Record all system activities.

### Authentication Logs

* Login
* Logout
* Failed Login

### Activity Logs

* Checklist Completion
* Checklist Modification
* Template Creation
* Data Updates

### System Logs

* Cron Job Execution
* Bot Execution
* Notification Failures

---

## Module 7 – Dashboard

Provide operational monitoring metrics:

* Total Jobs
* Total Tasks
* Completion Progress
* Failed Checklists
* Pending Checklists
* Department Statistics
* Shift Statistics

Mock APIs can be implemented initially.

---

# 5. Business Requirements Already Confirmed

The following modules have sufficient requirements and are ready for implementation:

✅ Authentication & Authorization

✅ Department Management

✅ Working Calendar

✅ Shift Slot Management

✅ Checklist Template Management

✅ Shift Job Generation

✅ Activity Logging

✅ Dashboard

---

# 6. Pending Business Requirements

## 6.1 Detailed Checklist Content

The business team is currently preparing:

* Task Names
* Execution Procedures
* Function URLs
* URD References
* File Locations
* Timetables

At this stage, only the data management capability is required.

No hardcoded checklist data is needed.

---

## 6.2 Bot Automation

The following details are still pending:

* Validation Rules
* Input Data Sources
* Output Definitions
* PASS Criteria
* FAIL Criteria
* Alert Conditions

Current requirement is limited to schema preparation:

```text
isBotCheck
botTriggerTime
```

---

## 6.3 Notification Module

Notification channels have not yet been finalized.

Potential channels include:

* Telegram
* Email
* Web Notifications

For now, only database schema and module structure should be designed.

---

## 6.4 SLA Management

No business requirements have been provided yet.

Implementation is postponed.

---

## 6.5 Shift Assignment

Currently, there is no requirement for assigning specific operators to shifts.

Any user belonging to the corresponding department may perform checklist activities.

Shift Assignment functionality will not be implemented at this stage.

---

## 6.6 Night Shift Handling Rules

For Shift 2:

```text
22:00 → 06:00
```

Additional clarification is required.

Example:

```text
19/06 22:00
→
20/06 06:00
```

Should the generated job belong to:

```text
19/06
```

or

```text
20/06
```

This requirement must be finalized before implementing reporting and dashboard calculations.

---

# 7. Implementation Roadmap

## Sprint 1

Scope:

* Authentication & Authorization
* Department Management
* Working Calendar
* Shift Slot Management
* Checklist Template Management
* Shift Job Management
* Activity Logs

Target Outcome:

```text
Calendar
→ Generate Shift Job
→ Execute Checklist
→ Save Activity Log
```

---

## Sprint 2

Scope:

* Production Dashboard APIs
* Notification Module
* Real-time WebSocket Updates

---

## Sprint 3

Scope:

* Bot Engine
* Automated Checklist Validation
* Automated Reconciliation
* Rule Engine

Final Target Workflow:

```text
Calendar
→ Generate Shift Job
→ Bot Auto Check
→ Manual Verification
→ Activity Log
→ Dashboard Monitoring
```
