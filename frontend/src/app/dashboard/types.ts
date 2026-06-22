export interface Template {
  _id: string;
  id: string;
  title: string;
  sessionType: 'OPEN' | 'DURING' | 'CLOSE';
  departmentId?: {
    _id: string;
    name: string;
    code: string;
  };
  tasks?: { taskId: string; taskName: string; priority: string; sortOrder: number }[];
}

export interface ShiftLog {
  _id: string;
  shiftDate: string;
  status: 'PENDING' | 'COMPLETED';
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
}
