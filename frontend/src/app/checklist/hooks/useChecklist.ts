'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { io } from 'socket.io-client';

export interface TaskDetail {
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
  status: 'PENDING' | 'WAITING' | 'PASSED' | 'FAILED' | 'SKIPPED' | 'NEEDS_ATTENTION';
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

export interface AuditLog {
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

export function useChecklist() {
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

  // Ad-hoc task modal states
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false);
  const [adhocTaskName, setAdhocTaskName] = useState('');
  const [adhocPriority, setAdhocPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [adhocDeadline, setAdhocDeadline] = useState('');
  const [isSubmittingAdhoc, setIsSubmittingAdhoc] = useState(false);

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

  const handleAddAdhocTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adhocTaskName.trim()) {
      setActionError('Tên tác vụ không được để trống');
      return;
    }
    if (!log || !token) return;

    setIsSubmittingAdhoc(true);
    setActionError('');
    setActionSuccess('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/${log._id}/add-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          taskName: adhocTaskName.trim(),
          priority: adhocPriority,
          deadline: adhocDeadline.trim() || undefined
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Thêm tác vụ phát sinh thất bại');
      }

      const updatedShift: ShiftLog = await res.json();
      setLog(updatedShift);
      // Sync noteState for any new task
      setNotesState(prev => {
        const notes = { ...prev };
        updatedShift.details.forEach(item => {
          if (!notes[item.taskId]) {
            notes[item.taskId] = item.note || '';
          }
        });
        return notes;
      });

      setActionSuccess('Đã thêm tác vụ phát sinh thành công!');
      setIsAdhocModalOpen(false);
      setAdhocTaskName('');
      setAdhocPriority('MEDIUM');
      setAdhocDeadline('');
    } catch (err: any) {
      setActionError(err.message || 'Lỗi xảy ra');
    } finally {
      setIsSubmittingAdhoc(false);
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

    const isChecked = newStatus === 'PASSED' || newStatus === 'SKIPPED';
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

  const exportToExcel = () => {
    if (!log) return;

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

  return {
    user,
    token,
    shiftLogId,
    activeLogs,
    log,
    setLog,
    auditLogs,
    setAuditLogs,
    incidents,
    setIncidents,
    resolvingIncident,
    setResolvingIncident,
    rootCause,
    setRootCause,
    remediationAction,
    setRemediationAction,
    affectedAccountsInput,
    setAffectedAccountsInput,
    isResolving,
    loading,
    savingTaskId,
    notesState,
    setNotesState,
    actionError,
    setActionError,
    actionSuccess,
    setActionSuccess,
    searchQuery,
    setSearchQuery,
    priorityFilter,
    setPriorityFilter,
    statusFilter,
    setStatusFilter,
    openStatusDropdownTaskId,
    setOpenStatusDropdownTaskId,
    isAdhocModalOpen,
    setIsAdhocModalOpen,
    adhocTaskName,
    setAdhocTaskName,
    adhocPriority,
    setAdhocPriority,
    adhocDeadline,
    setAdhocDeadline,
    isSubmittingAdhoc,
    loadActiveLogs,
    loadLogDetail,
    loadAuditLogs,
    loadIncidents,
    handleResolveIncident,
    handleAddAdhocTask,
    isTaskLocked,
    handleStatusChange,
    handleToggle,
    handleSaveNote,
    handleCloseShift,
    exportToExcel,
    triggerPrint,
    filteredDetails,
    focusedTaskIdRef,
  };
}
