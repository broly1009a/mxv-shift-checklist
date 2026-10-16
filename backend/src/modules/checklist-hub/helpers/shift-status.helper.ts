/**
 * Enterprise Shift Status Resolver (Backend Mirror Helper)
 * 
 * Phân định rạch ròi 2 trục: Vòng đời vận hành (Operational Lifecycle) vs Chất lượng nghiệm thu (Compliance & Fulfillment).
 */

export type EnterpriseShiftStatusCode = 
  | 'COMPLETED_FULL' 
  | 'CLOSED_INCOMPLETE' 
  | 'CLOSED_CRITICAL_PENDING' 
  | 'CLOSED_EMPTY' 
  | 'RUNNING' 
  | 'OVERDUE';

export interface BackendShiftStatusDescriptor {
  code: EnterpriseShiftStatusCode;
  label: string;
  badgeText: string;
  operationalLabel: 'Đã chốt sổ' | 'Đang vận hành' | 'Quá hạn';
  qualityLabel: 'Hoàn tất (100%)' | 'Tồn đọng' | 'Tồn đọng trọng yếu' | 'Bỏ trắng (0%)' | 'Đang thực hiện';
}

export function resolveBackendShiftStatus(
  shift: {
    shiftDate?: string;
    status?: string;
    progressPercentage?: number;
    details?: Array<{ isChecked?: boolean; prioritySnapshot?: string }>;
  },
  targetToday?: string
): BackendShiftStatusDescriptor {
  const today = targetToday || new Date().toISOString().slice(0, 10);
  const shiftDate = shift.shiftDate || '';
  const isPending = shift.status === 'PENDING';
  const progress = Number(shift.progressPercentage || 0);

  // 1. Nhóm chưa chốt (PENDING)
  if (isPending) {
    if (shiftDate && shiftDate < today) {
      return {
        code: 'OVERDUE',
        label: 'Quá hạn chưa chốt',
        badgeText: 'Quá hạn chưa chốt',
        operationalLabel: 'Quá hạn',
        qualityLabel: 'Đang thực hiện',
      };
    }
    return {
      code: 'RUNNING',
      label: 'Đang vận hành',
      badgeText: 'Đang vận hành',
      operationalLabel: 'Đang vận hành',
      qualityLabel: 'Đang thực hiện',
    };
  }

  // 2. Nhóm đã chốt (COMPLETED)
  if (progress >= 100) {
    return {
      code: 'COMPLETED_FULL',
      label: 'Hoàn tất (100%)',
      badgeText: 'Hoàn tất (100%)',
      operationalLabel: 'Đã chốt sổ',
      qualityLabel: 'Hoàn tất (100%)',
    };
  }
  if (progress <= 0) {
    return {
      code: 'CLOSED_EMPTY',
      label: 'Chốt bỏ trắng (0%)',
      badgeText: 'Bỏ trắng (0%)',
      operationalLabel: 'Đã chốt sổ',
      qualityLabel: 'Bỏ trắng (0%)',
    };
  }

  // 3. Chốt dở dang (0% < progress < 100%): Kiểm tra task CRITICAL
  const hasCriticalPending = Array.isArray(shift.details) && shift.details.some(
    d => !d.isChecked && (d.prioritySnapshot || '').toUpperCase() === 'CRITICAL'
  );

  if (hasCriticalPending) {
    return {
      code: 'CLOSED_CRITICAL_PENDING',
      label: `Đã chốt (Tồn đọng trọng yếu ${progress}%)`,
      badgeText: `Tồn đọng trọng yếu (${progress}%)`,
      operationalLabel: 'Đã chốt sổ',
      qualityLabel: 'Tồn đọng trọng yếu',
    };
  }

  return {
    code: 'CLOSED_INCOMPLETE',
    label: `Đã chốt (Tồn đọng ${progress}%)`,
    badgeText: `Đã chốt (${progress}%)`,
    operationalLabel: 'Đã chốt sổ',
    qualityLabel: 'Tồn đọng',
  };
}
