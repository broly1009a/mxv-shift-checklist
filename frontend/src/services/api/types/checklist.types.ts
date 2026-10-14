export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'PENDING' | 'WAITING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'NEEDS_ATTENTION';
export type ShiftStatus = 'PENDING' | 'COMPLETED' | 'IN_PROGRESS';

export interface TaskDetail {
  taskId: string;
  taskNameSnapshot: string;
  prioritySnapshot: TaskPriority;
  isChecked: boolean;
  checkedAt?: string;
  updatedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  note?: string;
  deadlineSnapshot?: string;
  functionUrlSnapshot?: string;
  urdReferenceSnapshot?: string;
  fileLocationSnapshot?: string;
  timetableSnapshot?: string;
  isBotCheckSnapshot?: boolean;
  botTriggerTimeSnapshot?: string;
  status: TaskStatus;
  resultNote?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  skippedAt?: string | null;
  needsAttentionAt?: string | null;
  dependsOnTaskIdsSnapshot?: string[];
  sessionTypeSnapshot?: string;
  triggerTimeSnapshot?: string;
  slaDeadlineSnapshot?: string;
  slaWindowStartSnapshot?: string;
  slaWindowEndSnapshot?: string;
  actionDescriptionSnapshot?: string;
  exceptionCodeSnapshot?: string;
  frequencyMinutesSnapshot?: number | null;
  slaTypeSnapshot?: string;
}

export interface ShiftLog {
  _id: string;
  shiftDate: string;
  status: ShiftStatus;
  progressPercentage: number;
  templateId?: {
    _id: string;
    title: string;
    sessionType: 'OPEN' | 'DURING' | 'CLOSE';
    departmentId?: {
      _id: string;
      name: string;
      code: string;
    };
  } | null;
  userId?: {
    _id: string;
    fullName: string;
    username: string;
  } | null;
  details: TaskDetail[];
  closedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  closedAt?: string;
  handoverNote?: string;
}

export interface AuditLog {
  _id: string;
  taskId: string;
  taskName: string;
  userId: {
    fullName: string;
    username: string;
  };
  action:
    | 'CHECK'
    | 'UNCHECK'
    | 'NOTE_UPDATE'
    | 'STATUS_UPDATE'
    | 'INCIDENT_CREATED'
    | 'INCIDENT_RESOLVED'
    | 'ADD_TASK';
  details: string;
  createdAt: string;
}

export interface Incident {
  _id: string;
  shiftId: string;
  taskId?: string;
  taskName?: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  reportedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  resolvedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  resolvedAt?: string;
  rootCause?: string;
  remediationAction?: string;
  affectedAccounts?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CloseShiftPayload {
  shiftLogId: string;
  handoverNote?: string;
}

export interface UpdateItemStatusPayload {
  shiftLogId: string;
  taskId: string;
  isChecked?: boolean;
  status?: TaskStatus;
  note?: string;
  resultNote?: string;
}

export interface AddTaskPayload {
  taskName: string;
  priority?: TaskPriority;
  deadline?: string;
  note?: string;
  functionUrl?: string;
}

export interface ResolveIncidentPayload {
  rootCause: string;
  remediationAction: string;
  affectedAccounts?: string[];
}

export interface GlobalSearchResult {
  incidents: any[];
  tasks: any[];
  handovers: any[];
}

