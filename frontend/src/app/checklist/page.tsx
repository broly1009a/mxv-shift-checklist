'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import {
  CheckSquare,
  Lock,
  Unlock,
  User as UserIcon,
  Clock,
  MessageSquare,
  AlertCircle,
  FileText,
  Save,
  CheckCircle2,
  Download,
  Printer,
  Activity,
  UserCheck,
  Search,
  Filter,
  Link2,
  Cpu,
  AlertTriangle,
  XCircle,
  SkipForward,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';

interface TaskDetail {
  taskId: string;
  taskNameSnapshot: string;
  prioritySnapshot: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
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

  status: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'NEEDS_ATTENTION';
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
}

interface ShiftLog {
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
  details: TaskDetail[];
  closedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  closedAt?: string;
  handoverNote?: string;
}

interface AuditLog {
  _id: string;
  taskId: string;
  taskName: string;
  userId: {
    fullName: string;
    username: string;
  };
  action: 'CHECK' | 'UNCHECK' | 'NOTE_UPDATE' | 'STATUS_UPDATE' | 'INCIDENT_CREATED' | 'INCIDENT_RESOLVED';
  details: string;
  createdAt: string;
}

const STATUS_CONFIGS = {
  PENDING: {
    label: 'Chưa thực hiện',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    icon: Clock,
  },
  PASSED: {
    label: 'Đạt',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.2)',
    icon: CheckCircle2,
  },
  FAILED: {
    label: 'Không đạt',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    icon: XCircle,
  },
  SKIPPED: {
    label: 'Bỏ qua',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: 'rgba(96, 165, 250, 0.2)',
    icon: SkipForward,
  },
  NEEDS_ATTENTION: {
    label: 'Cần chú ý',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.2)',
    icon: AlertTriangle,
  },
};

function IncidentSlaCountdown({ deadline }: { deadline: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  useEffect(() => {
    const target = new Date(deadline).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsOverdue(true);
        const absDiff = Math.abs(diff);
        const mins = Math.floor(absDiff / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        setTimeLeft(`Trễ SLA ${mins}m ${secs}s`);
      } else {
        setIsOverdue(false);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span
      className="badge"
      style={{
        fontSize: '0.7rem',
        padding: '2px 8px',
        fontWeight: 'bold',
        backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        color: isOverdue ? '#ef4444' : '#f59e0b',
        border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '4px'
      }}
    >
      {timeLeft}
    </span>
  );
}

function ChecklistWorksheet() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const shiftLogId = searchParams.get('id');

  const [activeLogs, setActiveLogs] = useState<ShiftLog[]>([]);
  const [log, setLog] = useState<ShiftLog | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [resolvingIncident, setResolvingIncident] = useState<any | null>(null);
  const [rootCause, setRootCause] = useState('MISSING_CONFIGURATION');
  const [remediationAction, setRemediationAction] = useState('');
  const [affectedAccountsInput, setAffectedAccountsInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [openStatusDropdownTaskId, setOpenStatusDropdownTaskId] = useState<string | null>(null);

  const togglingTaskIds = useRef<Set<string>>(new Set());
  const focusedTaskIdRef = useRef<string | null>(null);

  const loadActiveLogs = useCallback(async () => {
    if (!token) return;
    try {
      const deptIdFilter = user?.role === 'ADMIN' ? '' : `departmentId=${user?.department?.id || user?.department?._id || ''}`;
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/active?${deptIdFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setActiveLogs(data);
    } catch (err) {
      console.error(err);
    }
  }, [token, user]);

  const loadLogDetail = useCallback(async (id: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Không tìm thấy ca trực tương ứng.');
      }
      const target: ShiftLog = await res.json();
      setLog(target);
      // Pre-fill notesState
      const notes: Record<string, string> = {};
      target.details.forEach(item => {
        notes[item.taskId] = item.note || '';
      });
      setNotesState(notes);
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadAuditLogs = useCallback(async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/${id}/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Lỗi tải nhật ký kiểm toán:', err);
    }
  }, [token]);

  const loadIncidents = useCallback(async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/shift/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách sự cố:', err);
    }
  }, [token]);

  const handleResolveIncident = async () => {
    if (!resolvingIncident || !token) return;
    setIsResolving(true);
    setActionError('');
    setActionSuccess('');

    try {
      const accounts = affectedAccountsInput.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${resolvingIncident._id}/resolve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          rootCause,
          remediationAction,
          affectedAccounts: accounts
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi xử lý sự cố');
      }

      const updated = await res.json();
      setIncidents(prev => prev.map(inc => inc._id === updated._id ? updated : inc));
      setResolvingIncident(null);
      setRootCause('MISSING_CONFIGURATION');
      setRemediationAction('');
      setAffectedAccountsInput('');
      setActionSuccess('Đã xử lý giải quyết sự cố thành công!');
    } catch (err: any) {
      console.error(err);
      setActionError(err.message || 'Không thể cập nhật sự cố.');
    } finally {
      setIsResolving(false);
    }
  };

  // Load baseline data
  useEffect(() => {
    if (shiftLogId) {
      loadLogDetail(shiftLogId);
      loadAuditLogs(shiftLogId);
      loadIncidents(shiftLogId);
    } else {
      loadActiveLogs();
      setLoading(false);
    }
  }, [shiftLogId, loadLogDetail, loadActiveLogs, loadAuditLogs, loadIncidents]);

  // WebSockets Real-time Synchronization
  useEffect(() => {
    if (!shiftLogId || !token) return;

    // Establish WebSocket Connection
    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to socket gateway');
      socket.emit('joinRoom', { shiftLogId });
    });

    // Listen for shift update events
    socket.on('shift-updated', (data: { shiftLog: ShiftLog; auditLog?: AuditLog }) => {
      console.log('Real-time sync update received:', data);
      if (data?.shiftLog) {
        setLog(data.shiftLog);

        // Sync local input values (do not overwrite active editing note)
        setNotesState(prev => {
          const notes = { ...prev };
          data.shiftLog.details.forEach(item => {
            if (item.taskId !== focusedTaskIdRef.current) {
              notes[item.taskId] = item.note || '';
            }
          });
          return notes;
        });
      }

      if (data?.auditLog) {
        setAuditLogs(prev => [data.auditLog!, ...prev]);
      }
    });

    // Listen for incident update events
    socket.on('incident-updated', (data: { incident: any; auditLog?: any }) => {
      console.log('Real-time incident update received:', data);
      if (data?.incident) {
        setIncidents(prev => {
          const idx = prev.findIndex(inc => inc._id === data.incident._id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = data.incident;
            return copy;
          } else {
            return [data.incident, ...prev];
          }
        });
      }

      if (data?.auditLog) {
        setAuditLogs(prev => [data.auditLog!, ...prev]);
      }
    });

    return () => {
      socket.emit('leaveRoom', { shiftLogId });
      socket.disconnect();
    };
  }, [shiftLogId, token]);

  const isTaskLocked = useCallback((item: TaskDetail) => {
    if (!item.dependsOnTaskIdsSnapshot || item.dependsOnTaskIdsSnapshot.length === 0) {
      return false;
    }
    return item.dependsOnTaskIdsSnapshot.some(depId => {
      const depTask = log?.details.find(d => d.taskId === depId);
      return depTask && !depTask.isChecked;
    });
  }, [log]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (!log || log.status === 'COMPLETED' || !token) return;
    if (togglingTaskIds.current.has(taskId)) return;

    // Check frontend dependency validation
    const targetItem = log.details.find(d => d.taskId === taskId);
    if (targetItem?.dependsOnTaskIdsSnapshot && targetItem.dependsOnTaskIdsSnapshot.length > 0 && newStatus !== 'PENDING') {
      const unmet = targetItem.dependsOnTaskIdsSnapshot.filter(depId => {
        const depTask = log.details.find(d => d.taskId === depId);
        return depTask && !depTask.isChecked;
      });
      if (unmet.length > 0) {
        const listStr = unmet.map(depId => {
          const depTask = log.details.find(d => d.taskId === depId);
          return `[${depId}] "${depTask ? depTask.taskNameSnapshot : ''}"`;
        }).join(', ');
        setActionError(`Không thể thay đổi trạng thái. Tác vụ này phụ thuộc vào tác vụ chưa hoàn thành: ${listStr}`);
        return;
      }
    }

    togglingTaskIds.current.add(taskId);
    setActionError('');
    setActionSuccess('');

    const isChecked = newStatus !== 'PENDING';
    const note = notesState[taskId] || '';

    // Save previous state for rollback
    const previousLog = log;

    // Optimistically update the UI state
    const updatedDetails = log.details.map(item => {
      if (item.taskId === taskId) {
        return {
          ...item,
          status: newStatus as any,
          isChecked,
          checkedAt: isChecked ? new Date().toISOString() : undefined,
          updatedBy: isChecked ? {
            _id: user?.id || '',
            fullName: user?.fullName || '',
            username: user?.username || ''
          } : undefined
        };
      }
      return item;
    });

    const total = updatedDetails.length;
    const completed = updatedDetails.filter(d => d.isChecked).length;
    const progressPercentage = total > 0 ? parseFloat(((completed / total) * 100).toFixed(2)) : 0.00;

    const optimisticLog: ShiftLog = {
      ...log,
      details: updatedDetails,
      progressPercentage
    };

    setLog(optimisticLog);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/items/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shiftLogId: log._id,
          taskId,
          status: newStatus,
          note
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Cập nhật trạng thái thất bại');
      }

      const updated: ShiftLog = await res.json();
      setLog(updated);
      setActionSuccess('Cập nhật trạng thái tác vụ thành công.');
    } catch (err: any) {
      setLog(previousLog);
      setActionError(err.message || 'Có lỗi xảy ra');
    } finally {
      togglingTaskIds.current.delete(taskId);
    }
  };

  const handleToggle = async (taskId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus ? 'PASSED' : 'PENDING';
    await handleStatusChange(taskId, newStatus);
  };

  const handleSaveNote = async (taskId: string) => {
    if (!log || log.status === 'COMPLETED' || !token) return;
    setSavingTaskId(taskId);
    setActionError('');
    setActionSuccess('');

    const targetItem = log.details.find(d => d.taskId === taskId);
    const status = targetItem ? (targetItem.status || (targetItem.isChecked ? 'PASSED' : 'PENDING')) : 'PENDING';
    const note = notesState[taskId] || '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/items/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shiftLogId: log._id,
          taskId,
          status,
          note
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lưu ghi chú thất bại');
      }

      const updated: ShiftLog = await res.json();
      setLog(updated);
      setActionSuccess('Ghi chú đã được cập nhật.');
    } catch (err: any) {
      setActionError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleCloseShift = async () => {
    if (!log || !token) return;
    const noteInput = window.prompt(
      'Nhập Biên Bản Bàn Giao Ca Trực (Thông tin bàn giao vị thế, trạng thái hệ thống cho ca sau,...):',
      ''
    );
    if (noteInput === null) return;

    setLoading(true);
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shiftLogId: log._id,
          handoverNote: noteInput
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Chốt ca trực thất bại');
      }

      const updated: ShiftLog = await res.json();
      setLog(updated);
      setActionSuccess('Đã CHỐT ca trực vận hành thành công!');
    } catch (err: any) {
      setActionError(err.message || 'Có lỗi xảy ra');
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel (CSV with UTF-8 BOM)
  const exportToExcel = () => {
    if (!log) return;

    // Headers
    const headers = [
      'STT',
      'Mã tác vụ',
      'Nội dung tác vụ',
      'Mức độ ưu tiên',
      'Trạng thái',
      'Thời gian kiểm tra',
      'Người xác nhận',
      'Ghi chú'
    ];

    // Rows
    const rows = log.details.map((item, idx) => [
      idx + 1,
      item.taskId,
      `"${item.taskNameSnapshot.replace(/"/g, '""')}"`,
      item.prioritySnapshot,
      item.isChecked ? 'ĐÃ KIỂM TRA' : 'CHƯA KIỂM TRA',
      item.checkedAt ? new Date(item.checkedAt).toLocaleString('vi-VN') : '',
      item.updatedBy?.fullName || '',
      `"${(item.note || '').replace(/"/g, '""')}"`
    ]);

    // Build file content
    const csvContent = [
      'SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)',
      `BIÊN BẢN VẬN HÀNH: ${log.templateId?.title}`,
      `Ngày trực: ${log.shiftDate}`,
      `Người trực chính: ${log.userId?.fullName}`,
      `Phòng ban: ${log.templateId?.departmentId?.name || 'ADMIN Portal'}`,
      `Trạng thái: ${log.status === 'COMPLETED' ? 'ĐÃ CHỐT CA' : 'ĐANG VẬN HÀNH'}`,
      `Tiến độ hoàn thành: ${log.progressPercentage}%`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // BOM character to ensure Vietnamese displays properly in Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Biên_Bản_MXV_${log.shiftDate}_${log._id.substring(0, 6)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const triggerPrint = () => {
    window.print();
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW': return <span className="badge badge-low">Thấp</span>;
      case 'MEDIUM': return <span className="badge badge-medium">Trung Bình</span>;
      case 'HIGH': return <span className="badge badge-high">Cao</span>;
      default: return <span className="badge badge-critical">Khẩn Cấp</span>;
    }
  };

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
      case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
      default: return <span className="badge badge-high">Đóng Cửa</span>;
    }
  };

  // Filter tasks based on query variables
  const filteredDetails = log?.details?.filter(item => {
    const matchesSearch = item.taskNameSnapshot.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.taskId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || item.prioritySnapshot === priorityFilter;
    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'CHECKED' && item.isChecked) ||
      (statusFilter === 'UNCHECKED' && !item.isChecked) ||
      (item.status === statusFilter || (!item.status && statusFilter === 'PENDING' && !item.isChecked));
    return matchesSearch && matchesPriority && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>
        Đang tải thông tin ca trực...
      </div>
    );
  }

  // View: No Shift ID specified
  if (!shiftLogId) {
    return (
      <ProtectedRoute>
        <div className="animate-fade-in no-print" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Bảng Vận Hành Ca Trực
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Chọn một ca trực đang mở dưới đây hoặc quay lại <Link href="/dashboard" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>Bảng điều khiển</Link> để bắt đầu ca mới.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
              <CheckSquare size={20} color="var(--color-accent)" /> Ca trực hôm nay của bạn
            </h3>

            {activeLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Chưa có ca trực nào đang chạy hôm nay.</p>
                <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '16px' }}>
                  Đến bảng điều khiển khởi tạo
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {activeLogs.map(item => (
                  <div key={item._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {item.templateId?.title || 'Không rõ mẫu'}
                      </h4>
                      <span className="badge badge-medium">{item.templateId?.sessionType || 'OPEN'}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div>Trực ngày: <strong>{item.shiftDate}</strong></div>
                      <div>Phòng ban: <strong>{item.templateId?.departmentId?.name || 'Không xác định'}</strong></div>
                      <div>Người trực: <strong>{item.userId?.fullName || 'Hệ thống'}</strong></div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${item.progressPercentage}%`, height: '100%', background: 'var(--color-accent)' }}></div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{item.progressPercentage}%</span>
                    </div>
                    <Link href={`/checklist?id=${item._id}`} className="btn btn-primary" style={{ width: '100%', padding: '10px' }}>
                      Mở Worksheet
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  // View: Shift Worksheet details
  if (!log) {
    return (
      <ProtectedRoute>
        <div className="glass-panel no-print" style={{ padding: '40px', textAlign: 'center' }}>
          <AlertCircle size={40} color="var(--color-critical)" style={{ marginBottom: '16px' }} />
          <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lỗi tải ca trực</p>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{actionError || 'Vui lòng kiểm tra lại đường dẫn.'}</p>
          <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '20px' }}>
            Quay lại bảng điều khiển
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  const isCompleted = log.status === 'COMPLETED';

  return (
    <ProtectedRoute>
      {/* Dynamic Print Stylesheet injection */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body, html, main, #__next, .app-layout-content {
            background: #fff !important;
            color: #000 !important;
          }
          .sidebar, .no-print, .app-header {
            display: none !important;
          }
          .mobile-content-layout {
            margin-left: 0 !important;
            width: 100% !important;
          }
          .main-content {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .print-only {
            display: block !important;
          }
          .print-container {
            font-family: "Times New Roman", Times, serif, sans-serif;
            color: #000 !important;
            padding: 20px;
          }
          .print-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .print-header h1 {
            font-size: 1.35rem;
            font-weight: bold;
            margin-bottom: 4px;
            text-transform: uppercase;
          }
          .print-header h2 {
            font-size: 1.15rem;
            font-weight: bold;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          .print-meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 20px;
            font-size: 0.95rem;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 0.85rem;
          }
          .print-table th, .print-table td {
            border: 1px solid #000 !important;
            padding: 6px 10px;
            text-align: left;
            color: #000 !important;
          }
          .print-table th {
            background-color: #f3f4f6 !important;
            font-weight: bold;
          }
          .print-signature-section {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            text-align: center;
            font-size: 0.95rem;
          }
        }
        .print-only {
          display: none;
        }
        .status-option-hover:hover {
          background: rgba(255, 255, 255, 0.06) !important;
        }
      `}} />

      {/* Screen view wrapper (hidden on print via no-print class) */}
      <div className="animate-fade-in no-print" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Bảng điều khiển</Link>
            <span style={{ margin: '0 8px' }}>/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Chi tiết ca trực</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToExcel} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px' }}>
              <Download size={14} /> Xuất file Excel
            </button>
            <button onClick={triggerPrint} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px' }}>
              <Printer size={14} /> In Biên Bản (PDF)
            </button>
          </div>
        </div>

        {/* Shift log state banner */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                {log.templateId?.title}
              </h1>
              {getSessionBadge(log.templateId?.sessionType || '')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={15} /> Ngày trực: <strong style={{ color: 'var(--text-primary)' }}>{log.shiftDate}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={15} /> Trực chính: <strong style={{ color: 'var(--text-primary)' }}>{log.userId?.fullName}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isCompleted ? <Lock size={15} color="var(--color-primary)" /> : <Unlock size={15} color="var(--color-accent)" />}
                Trạng thái:
                {isCompleted ? (
                  <strong style={{ color: 'var(--color-primary)' }}>ĐÃ CHỐT</strong>
                ) : (
                  <strong style={{ color: 'var(--color-accent)' }}>ĐANG TRỰC</strong>
                )}
              </span>
              {isCompleted && log.closedBy && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} color="var(--color-primary)" /> Người chốt: <strong style={{ color: 'var(--text-primary)' }}>{log.closedBy.fullName}</strong>
                </span>
              )}
            </div>
            {isCompleted && log.handoverNote && (
              <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', borderLeft: '4px solid var(--color-primary)', maxWidth: '700px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Biên bản bàn giao ca trực:</span>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.88rem', fontStyle: 'italic', lineHeight: '1.4' }}>"{log.handoverNote}"</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tiến độ ca trực</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '120px', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${log.progressPercentage}%`, height: '100%', background: isCompleted ? 'var(--color-primary)' : 'var(--color-accent)' }}></div>
                </div>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isCompleted ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                  {log.progressPercentage}%
                </span>
              </div>
            </div>

            {!isCompleted && (
              <button onClick={handleCloseShift} className="btn btn-success" style={{ padding: '10px 18px', height: '40px', fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Chốt Ca Trực
              </button>
            )}
          </div>
        </div>

        {/* Feedback states */}
        {actionError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.875rem' }}>
            {actionSuccess}
          </div>
        )}

        {/* Workspace Layout Grid: Left Checklist, Right Audit Logs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="lg:grid-cols-[1fr_360px]">

          {/* Left Panel: Checklist Tasks */}
          <div className="glass-panel" style={{ padding: '24px' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <FileText size={18} color="var(--color-accent)" /> Checklist Nhiệm vụ ({filteredDetails.length} / {log.details?.length || 0})
              </h3>
            </div>

            {/* Live Search and Filters group */}
            <div style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginBottom: '20px',
              background: 'rgba(128,128,128,0.02)',
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              alignItems: 'center'
            }}>
              {/* Text search */}
              <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm nội dung, mã tác vụ..."
                  className="form-input"
                  style={{ height: '36px', paddingLeft: '32px', fontSize: '0.82rem' }}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Priority Select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={13} color="var(--text-muted)" className="hidden sm:inline" />
                <select
                  className="form-input"
                  style={{ width: '130px', height: '36px', padding: '0 10px', fontSize: '0.82rem', cursor: 'pointer' }}
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                >
                  <option value="ALL">Mọi ưu tiên</option>
                  <option value="CRITICAL">Khẩn cấp</option>
                  <option value="HIGH">Ưu tiên Cao</option>
                  <option value="MEDIUM">Ưu tiên Trung bình</option>
                  <option value="LOW">Ưu tiên Thấp</option>
                </select>
              </div>

              {/* Status Select */}
              <div>
                <select
                  className="form-input"
                  style={{ width: '130px', height: '36px', padding: '0 10px', fontSize: '0.82rem', cursor: 'pointer' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">Mọi trạng thái</option>
                  <option value="CHECKED">Đã kiểm tra</option>
                  <option value="UNCHECKED">Chưa kiểm tra</option>
                  <option value="PENDING">Chưa thực hiện</option>
                  <option value="PASSED">Đạt</option>
                  <option value="FAILED">Không đạt</option>
                  <option value="SKIPPED">Bỏ qua</option>
                  <option value="NEEDS_ATTENTION">Cần chú ý</option>
                </select>
              </div>
            </div>

            {/* Checklist tasks mapping */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                  Không tìm thấy tác vụ phù hợp với bộ lọc.
                </div>
              ) : (
                filteredDetails.map((item, index) => {
                  const isSaving = savingTaskId === item.taskId;
                  const currentStatus = item.status || 'PENDING';
                  const currentStatusConfig = STATUS_CONFIGS[currentStatus] || STATUS_CONFIGS.PENDING;
                  const StatusIcon = currentStatusConfig.icon;
                  const locked = isTaskLocked(item);
                  return (
                    <div key={item.taskId} className="glass-panel animate-fade-in" style={{
                      padding: '16px',
                      borderRadius: '12px',
                      background: item.isChecked ? 'rgba(16, 185, 129, 0.012)' : 'var(--bg-app)',
                      borderLeft: item.isChecked ? '4px solid var(--color-primary)' : '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      transition: 'all 0.2s ease'
                    }}>

                      {/* Checkbox and task information row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                          {locked ? (
                            <span title="Bị khóa do phụ thuộc tác vụ chưa hoàn thành">
                              <Lock
                                size={18}
                                color="#ef4444"
                                style={{ marginTop: '3px', flexShrink: 0 }}
                              />
                            </span>
                          ) : (
                            <input
                              type="checkbox"
                              checked={item.isChecked}
                              onChange={() => handleToggle(item.taskId, item.isChecked)}
                              disabled={isCompleted || isSaving}
                              style={{
                                width: '18px',
                                height: '18px',
                                marginTop: '3px',
                                cursor: isCompleted ? 'not-allowed' : 'pointer',
                                accentColor: 'var(--color-primary)'
                              }}
                            />
                          )}
                          <div>
                            <p style={{
                              fontSize: '0.92rem',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              lineHeight: '1.4',
                              textDecoration: item.isChecked ? 'line-through' : 'none',
                              opacity: item.isChecked ? 0.65 : 1,
                              margin: 0
                            }}>
                              [{item.taskId}] {item.taskNameSnapshot}
                            </p>

                            {item.dependsOnTaskIdsSnapshot && item.dependsOnTaskIdsSnapshot.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                {item.dependsOnTaskIdsSnapshot.map(depId => {
                                  const depTask = log.details.find(d => d.taskId === depId);
                                  const isDepDone = depTask ? depTask.isChecked : false;
                                  return (
                                    <span key={depId} style={{
                                      fontSize: '0.72rem',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: isDepDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                                      color: isDepDone ? '#10b981' : '#ef4444',
                                      border: `1px solid ${isDepDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                                      fontWeight: 600
                                    }}>
                                      {isDepDone ? <Unlock size={11} /> : <Lock size={11} />}
                                      Phụ thuộc: {depId} ({isDepDone ? 'Đã hoàn thành' : 'Chưa hoàn thành'})
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
                              {getPriorityBadge(item.prioritySnapshot)}
                              {item.deadlineSnapshot && (
                                <span style={{
                                  fontSize: '0.72rem',
                                  color: '#ef4444',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 600
                                }}>
                                  <Clock size={11} /> Hạn chót: {item.deadlineSnapshot}
                                </span>
                              )}
                              {item.isChecked && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Clock size={11} /> Đã kiểm: {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString('vi-VN') : ''}
                                </span>
                              )}
                              {item.isChecked && item.updatedBy && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <UserIcon size={11} /> Bởi: {item.updatedBy.fullName}
                                </span>
                              )}
                            </div>

                            {/* Additional Snapshotted Fields */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px', fontSize: '0.75rem' }}>
                              {item.functionUrlSnapshot && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.06)', color: '#3b82f6', padding: '2px 8px', borderRadius: '4px' }}>
                                  <Link2 size={12} /> URL: <a href={item.functionUrlSnapshot} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{item.functionUrlSnapshot}</a>
                                </span>
                              )}
                              {item.urdReferenceSnapshot && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(139, 92, 246, 0.06)', color: '#8b5cf6', padding: '2px 8px', borderRadius: '4px' }}>
                                  <FileText size={12} /> URD: {item.urdReferenceSnapshot}
                                </span>
                              )}
                              {item.fileLocationSnapshot && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px' }}>
                                  <FileText size={12} /> File: {item.fileLocationSnapshot}
                                </span>
                              )}
                              {item.timetableSnapshot && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.06)', color: '#10b981', padding: '2px 8px', borderRadius: '4px' }}>
                                  <Clock size={12} /> Khung giờ: {item.timetableSnapshot}
                                </span>
                              )}
                              {item.isBotCheckSnapshot && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(236, 72, 153, 0.06)', color: '#ec4899', padding: '2px 8px', borderRadius: '4px' }}>
                                  <Cpu size={12} /> Bot Check {item.botTriggerTimeSnapshot ? `(${item.botTriggerTimeSnapshot})` : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status Selector Dropdown */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <button
                            onClick={() => {
                              if (isCompleted || locked || isSaving) return;
                              setOpenStatusDropdownTaskId(openStatusDropdownTaskId === item.taskId ? null : item.taskId);
                            }}
                            disabled={isCompleted || locked || isSaving}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              cursor: (isCompleted || locked || isSaving) ? 'not-allowed' : 'pointer',
                              background: currentStatusConfig.bgColor,
                              color: currentStatusConfig.color,
                              border: `1px solid ${currentStatusConfig.borderColor}`,
                              transition: 'all 0.2s ease',
                              minWidth: '140px',
                              justifyContent: 'space-between'
                            }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <StatusIcon size={14} />
                              {currentStatusConfig.label}
                            </span>
                            {!isCompleted && !locked && <ChevronDown size={12} />}
                          </button>

                          {/* Dropdown Options List */}
                          {openStatusDropdownTaskId === item.taskId && (
                            <>
                              {/* Overlay click catcher to close dropdown */}
                              <div
                                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                                onClick={() => setOpenStatusDropdownTaskId(null)}
                              />
                              <div style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: '#1e293b',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '10px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                                zIndex: 1000,
                                minWidth: '170px',
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '4px'
                              }}>
                                {Object.entries(STATUS_CONFIGS).map(([statusKey, cfg]) => {
                                  const OptionIcon = cfg.icon;
                                  return (
                                    <button
                                      key={statusKey}
                                      onClick={() => {
                                        handleStatusChange(item.taskId, statusKey);
                                        setOpenStatusDropdownTaskId(null);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px 12px',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        color: cfg.color,
                                        background: 'transparent',
                                        border: 'none',
                                        borderRadius: '6px',
                                        width: '100%',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'background 0.15s ease'
                                      }}
                                      className="status-option-hover"
                                    >
                                      <OptionIcon size={14} />
                                      {cfg.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>

                      </div>

                      {/* Notes / Comment section */}
                      <div style={{
                        borderTop: '1px dashed var(--border-color)',
                        paddingTop: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                      }}>
                        <MessageSquare size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <input
                          type="text"
                          className="form-input"
                          placeholder={isCompleted ? "Không thể ghi chú khi đã chốt ca" : "Nhập ghi chú kết quả vận hành..."}
                          value={notesState[item.taskId] || ''}
                          onChange={(e) => setNotesState({ ...notesState, [item.taskId]: e.target.value })}
                          onFocus={() => { focusedTaskIdRef.current = item.taskId; }}
                          onBlur={() => { focusedTaskIdRef.current = null; }}
                          disabled={isCompleted || isSaving}
                          style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px' }}
                        />
                        {!isCompleted && (
                          <button
                            onClick={() => handleSaveNote(item.taskId)}
                            className="btn btn-secondary"
                            disabled={isSaving}
                            style={{ padding: '6px 10px', flexShrink: 0, height: '32px' }}
                            title="Lưu ghi chú"
                          >
                            <Save size={13} />
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column Layout: Incident Manager & Audit Trail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Incident Manager Panel */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
                <AlertTriangle size={16} color="#ef4444" /> Sự cố & Ngoại lệ ({incidents.filter(inc => inc.status === 'PENDING').length})
              </h3>

              {incidents.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                  Không có ngoại lệ hay sự cố trễ SLA nào trong ca.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }} className="custom-scrollbar">
                  {incidents.map((inc) => {
                    const isPending = inc.status === 'PENDING';
                    return (
                      <div
                        key={inc._id}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          background: isPending ? 'rgba(239, 68, 68, 0.04)' : 'rgba(16, 185, 129, 0.02)',
                          border: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isPending ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
                            [{inc.code}] {inc.taskId}
                          </span>
                          {isPending && inc.slaDeadlineAt && (
                            <IncidentSlaCountdown deadline={inc.slaDeadlineAt} />
                          )}
                          {!isPending && (
                            <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '2px 6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '4px' }}>Đã khắc phục</span>
                          )}
                        </div>

                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          <strong>Yêu cầu SOP:</strong> {inc.requiredAction}
                        </p>

                        {!isPending && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div><strong>Nguyên nhân:</strong> {inc.rootCause}</div>
                            <div><strong>Giải quyết:</strong> {inc.remediationAction}</div>
                            {inc.affectedAccounts && inc.affectedAccounts.length > 0 && (
                              <div><strong>Tài khoản ảnh hưởng:</strong> {inc.affectedAccounts.join(', ')}</div>
                            )}
                          </div>
                        )}

                        {isPending && !isCompleted && (
                          <button
                            onClick={() => {
                              setRootCause('MISSING_CONFIGURATION');
                              setRemediationAction('');
                              setAffectedAccountsInput('');
                              setResolvingIncident(inc);
                            }}
                            className="btn btn-primary"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.72rem',
                              alignSelf: 'flex-end',
                              height: 'auto',
                              marginTop: '4px'
                            }}
                          >
                            Khắc phục sự cố
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audit Trail Timeline */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '420px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
                <Activity size={16} color="var(--color-accent)" /> Nhật ký hoạt động (Audit)
              </h3>

              {auditLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
                  Chưa có hoạt động nào được ghi nhận.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                  {/* Visual vertical line for timeline */}
                  <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '15px', width: '2px', background: 'var(--border-color)' }}></div>

                  {auditLogs.map((audit) => {
                    let badgeColor = 'rgba(255,255,255,0.02)';
                    let dotColor = '#94a3b8';
                    if (audit.action === 'CHECK' || audit.action === 'INCIDENT_RESOLVED') {
                      badgeColor = 'rgba(16, 185, 129, 0.03)';
                      dotColor = 'var(--color-primary)';
                    } else if (audit.action === 'UNCHECK' || audit.action === 'INCIDENT_CREATED') {
                      badgeColor = 'rgba(239, 68, 68, 0.03)';
                      dotColor = '#ef4444';
                    } else if (audit.action === 'NOTE_UPDATE') {
                      badgeColor = 'rgba(245, 158, 11, 0.03)';
                      dotColor = '#f59e0b';
                    }

                    return (
                      <div key={audit._id} style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
                        {/* Custom timeline dot */}
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--bg-app)',
                          border: `2px solid ${dotColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <UserCheck size={14} style={{ color: dotColor }} />
                        </div>

                        <div style={{ flex: 1, padding: '10px', borderRadius: '8px', background: badgeColor, border: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {audit.userId?.fullName || 'Hệ thống'}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                              {new Date(audit.createdAt).toLocaleTimeString('vi-VN')}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: '1.4', margin: 0 }}>
                            <strong>{audit.taskId}</strong>: {audit.details}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      {/* Incident Resolution Modal */}
      {resolvingIncident && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#ef4444" /> Giải quyết sự cố [{resolvingIncident.code}]
              </h3>
              <button
                onClick={() => setResolvingIncident(null)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                &times;
              </button>
            </div>

            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                <strong>Mã tác vụ lỗi:</strong> {resolvingIncident.taskId}<br />
                <strong>Yêu cầu khắc phục:</strong> {resolvingIncident.requiredAction}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nguyên nhân gốc rễ (Root Cause)*</label>
                  <select
                    className="form-input"
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                  >
                    <option value="MISSING_CONFIGURATION">MISSING_CONFIGURATION (Thiếu cấu hình)</option>
                    <option value="MESSAGE_SYNC_LOSS">MESSAGE_SYNC_LOSS (Mất đồng bộ tin nhắn)</option>
                    <option value="SOFTWARE_BUG">SOFTWARE_BUG (Lỗi phần mềm)</option>
                    <option value="NETWORK_DISRUPTION">NETWORK_DISRUPTION (Sự cố đường truyền/mạng)</option>
                    <option value="OTHER">OTHER (Nguyên nhân khác)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Giải pháp khắc phục (Remediation)*</label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="Mô tả chi tiết các bước xử lý khắc phục sự cố..."
                    value={remediationAction}
                    onChange={(e) => setRemediationAction(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tài khoản bị ảnh hưởng (Tùy chọn)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Nhập các tài khoản cách nhau bằng dấu phẩy, vd: TVKD01, TVKD02..."
                    value={affectedAccountsInput}
                    onChange={(e) => setAffectedAccountsInput(e.target.value)}
                    style={{ background: '#1e293b', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setResolvingIncident(null)}
                className="btn btn-secondary"
                disabled={isResolving}
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleResolveIncident}
                className="btn btn-primary"
                disabled={isResolving || !remediationAction.trim()}
                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
              >
                {isResolving ? 'Đang lưu...' : 'Xác nhận khắc phục'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF PRINT ONLY CONTAINER (Normally hidden, shown only in media print mode) */}
      <div className="print-only print-container">
        <div className="print-header">
          <h1>SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)</h1>
          <h2>BIÊN BẢN BÀN GIAO CA TRỰC VẬN HÀNH</h2>
          <div style={{ width: '150px', height: '1px', background: '#000', margin: '0 auto 16px auto' }}></div>
        </div>

        <div className="print-meta-grid">
          <div><strong>Biên bản ca:</strong> {log.templateId?.title}</div>
          <div><strong>Ngày trực:</strong> {log.shiftDate}</div>
          <div><strong>Phòng ban:</strong> {log.templateId?.departmentId?.name || 'Vận Hành Nghiệp Vụ'}</div>
          <div><strong>Trực chính:</strong> {log.userId?.fullName}</div>
          <div><strong>Tiến độ ca trực:</strong> {log.progressPercentage}%</div>
          <div><strong>Trạng thái:</strong> {log.status === 'COMPLETED' ? 'ĐÃ CHỐT CA' : 'ĐANG VẬN HÀNH'}</div>
          {log.handoverNote && (
            <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '8px', border: '1px dashed #000' }}>
              <strong>Biên bản bàn giao ca trực:</strong> <i>"{log.handoverNote}"</i>
            </div>
          )}
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>STT</th>
              <th style={{ width: '100px' }}>Mã Tác Vụ</th>
              <th>Nội Dung Tác Vụ</th>
              <th style={{ width: '80px' }}>Ưu Tiên</th>
              <th style={{ width: '80px' }}>Hạn Chót</th>
              <th style={{ width: '90px' }}>Trạng Thái</th>
              <th style={{ width: '120px' }}>Thời Gian Kiểm</th>
              <th>Ghi Chú</th>
            </tr>
          </thead>
          <tbody>
            {log.details?.map((item, idx) => (
              <tr key={item.taskId}>
                <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                <td>{item.taskId}</td>
                <td>{item.taskNameSnapshot}</td>
                <td style={{ textAlign: 'center' }}>
                  {item.prioritySnapshot === 'LOW' && 'Thấp'}
                  {item.prioritySnapshot === 'MEDIUM' && 'Trung Bình'}
                  {item.prioritySnapshot === 'HIGH' && 'Cao'}
                  {item.prioritySnapshot === 'CRITICAL' && 'Khẩn Cấp'}
                </td>
                <td style={{ textAlign: 'center' }}>{item.deadlineSnapshot || '-'}</td>
                <td style={{ textAlign: 'center', fontWeight: item.isChecked ? 'bold' : 'normal' }}>
                  {item.isChecked ? 'ĐÃ KIỂM' : 'CHƯA KIỂM'}
                </td>
                <td>
                  {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString('vi-VN') + ' ' + new Date(item.checkedAt).toLocaleDateString('vi-VN') : ''}
                </td>
                <td>{item.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-signature-section">
          <div>
            <p><strong>NGƯỜI BÀN GIAO</strong></p>
            <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>(Ký và ghi rõ họ tên)</p>
            <div style={{ height: '80px' }}></div>
            <p>......................................................</p>
          </div>
          <div>
            <p><strong>NGƯỜI NHẬN BÀN GIAO</strong></p>
            <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>(Ký và ghi rõ họ tên)</p>
            <div style={{ height: '80px' }}></div>
            <p>......................................................</p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>Đang tải ca trực...</div>}>
      <ChecklistWorksheet />
    </Suspense>
  );
}
