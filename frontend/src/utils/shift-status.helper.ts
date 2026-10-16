import React from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  AlertOctagon,
  LucideIcon 
} from 'lucide-react';

export type EnterpriseShiftStatusCode = 
  | 'COMPLETED_FULL' 
  | 'CLOSED_INCOMPLETE' 
  | 'CLOSED_CRITICAL_PENDING' 
  | 'CLOSED_EMPTY' 
  | 'RUNNING' 
  | 'OVERDUE';

export interface ShiftStatusDescriptor {
  code: EnterpriseShiftStatusCode;
  label: string;
  badgeText: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: LucideIcon;
  operationalLabel: 'Đã chốt sổ' | 'Đang vận hành' | 'Quá hạn';
  qualityLabel: 'Hoàn tất (100%)' | 'Tồn đọng' | 'Tồn đọng trọng yếu' | 'Bỏ trắng (0%)' | 'Đang thực hiện';
}

export const STATUS_CONFIG: Record<EnterpriseShiftStatusCode, Omit<ShiftStatusDescriptor, 'label' | 'badgeText'> & { label: string; badgeText: string }> = {
  COMPLETED_FULL: {
    code: 'COMPLETED_FULL',
    label: 'Hoàn tất (100%)',
    badgeText: 'Hoàn tất (100%)',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    icon: CheckCircle2,
    operationalLabel: 'Đã chốt sổ',
    qualityLabel: 'Hoàn tất (100%)',
  },
  CLOSED_INCOMPLETE: {
    code: 'CLOSED_INCOMPLETE',
    label: 'Đã chốt (Có tồn đọng)',
    badgeText: 'Đã chốt (Tồn đọng)',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    icon: AlertTriangle,
    operationalLabel: 'Đã chốt sổ',
    qualityLabel: 'Tồn đọng',
  },
  CLOSED_CRITICAL_PENDING: {
    code: 'CLOSED_CRITICAL_PENDING',
    label: 'Đã chốt (Tồn đọng trọng yếu)',
    badgeText: 'Tồn đọng trọng yếu',
    color: '#ea580c',
    bgColor: 'rgba(234, 88, 12, 0.12)',
    borderColor: 'rgba(234, 88, 12, 0.3)',
    icon: AlertCircle,
    operationalLabel: 'Đã chốt sổ',
    qualityLabel: 'Tồn đọng trọng yếu',
  },
  CLOSED_EMPTY: {
    code: 'CLOSED_EMPTY',
    label: 'Chốt bỏ trắng (0%)',
    badgeText: 'Bỏ trắng (0%)',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    icon: XCircle,
    operationalLabel: 'Đã chốt sổ',
    qualityLabel: 'Bỏ trắng (0%)',
  },
  RUNNING: {
    code: 'RUNNING',
    label: 'Đang vận hành',
    badgeText: 'Đang vận hành',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    icon: Clock,
    operationalLabel: 'Đang vận hành',
    qualityLabel: 'Đang thực hiện',
  },
  OVERDUE: {
    code: 'OVERDUE',
    label: 'Quá hạn chưa chốt',
    badgeText: 'Quá hạn chưa chốt',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.3)',
    icon: AlertOctagon,
    operationalLabel: 'Quá hạn',
    qualityLabel: 'Đang thực hiện',
  },
};

/**
 * Phân loại trạng thái ca trực chuẩn Doanh nghiệp dựa trên 2 trục:
 * 1. Trục Vòng đời (Operational): PENDING vs COMPLETED, so sánh shiftDate với ngày hiện tại
 * 2. Trục Nghiệm thu (Compliance): progressPercentage (100% vs tồn đọng vs 0%), có task CRITICAL dở dang không
 */
export function resolveShiftStatus(
  shift: {
    shiftDate?: string;
    status?: string;
    progressPercentage?: number;
    details?: Array<{ isChecked?: boolean; prioritySnapshot?: string }>;
  },
  targetToday?: string
): ShiftStatusDescriptor {
  const today = targetToday || new Date().toISOString().slice(0, 10);
  const shiftDate = shift.shiftDate || '';
  const isPending = shift.status === 'PENDING';
  const progress = Number(shift.progressPercentage || 0);

  // 1. Nhóm chưa chốt (PENDING)
  if (isPending) {
    if (shiftDate && shiftDate < today) {
      return { ...STATUS_CONFIG.OVERDUE };
    }
    return { ...STATUS_CONFIG.RUNNING };
  }

  // 2. Nhóm đã chốt (COMPLETED)
  if (progress >= 100) {
    return { ...STATUS_CONFIG.COMPLETED_FULL };
  }
  if (progress <= 0) {
    return { ...STATUS_CONFIG.CLOSED_EMPTY };
  }

  // 3. Chốt dở dang (0% < progress < 100%): Kiểm tra task CRITICAL
  const hasCriticalPending = Array.isArray(shift.details) && shift.details.some(
    d => !d.isChecked && (d.prioritySnapshot || '').toUpperCase() === 'CRITICAL'
  );

  if (hasCriticalPending) {
    return {
      ...STATUS_CONFIG.CLOSED_CRITICAL_PENDING,
      label: `Đã chốt (Tồn đọng trọng yếu ${progress}%)`,
      badgeText: `Tồn đọng trọng yếu (${progress}%)`
    };
  }

  return {
    ...STATUS_CONFIG.CLOSED_INCOMPLETE,
    label: `Đã chốt (Tồn đọng ${progress}%)`,
    badgeText: `Đã chốt (${progress}%)`
  };
}

/**
 * Helper render component Badge hiển thị trạng thái chuẩn Enterprise
 */
export function renderShiftStatusBadge(
  shift: {
    shiftDate?: string;
    status?: string;
    progressPercentage?: number;
    details?: Array<{ isChecked?: boolean; prioritySnapshot?: string }>;
  },
  options?: { size?: 'sm' | 'md'; showPulseForRunning?: boolean }
) {
  const descriptor = resolveShiftStatus(shift);
  const IconComponent = descriptor.icon;
  const isSm = options?.size === 'sm';
  const isRunning = descriptor.code === 'RUNNING';

  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: isSm ? '0.72rem' : '0.75rem',
        fontWeight: 700,
        color: descriptor.color,
        background: descriptor.bgColor,
        border: `1px solid ${descriptor.borderColor}`,
        borderRadius: '20px',
        padding: isSm ? '2px 8px' : '3px 10px',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      },
    },
    React.createElement(IconComponent, {
      size: isSm ? 11 : 13,
      className: isRunning && options?.showPulseForRunning !== false ? 'animate-pulse' : undefined,
      style: { flexShrink: 0 },
    }),
    descriptor.badgeText
  );
}
