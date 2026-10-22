'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { api, TaskDetail, ShiftLog, AuditLog, Incident } from '@/services/api';
import { getAppSocket } from '@/services/appSocket';
import toast from 'react-hot-toast';
import { MOCK_ACTIVE_LOGS, MOCK_AUDIT_LOGS } from '../mockChecklistData';
import { resolveShiftStatus } from '@/utils/shift-status.helper';

export type { TaskDetail, ShiftLog, AuditLog, Incident };


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
  const [loadError, setLoadError] = useState('');

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

  const togglingTaskIdsRef = useRef<Set<string>>(new Set());
  const [togglingTaskIds, setTogglingTaskIds] = useState<Set<string>>(new Set());
  const focusedTaskIdRef = useRef<string | null>(null);

  const activeLogsSeqRef = useRef(0);
  const logDetailSeqRef = useRef(0);
  const auditLogsSeqRef = useRef(0);
  const incidentsSeqRef = useRef(0);

  const loadActiveLogs = useCallback(async () => {
    const isMock = searchParams.get('mock') === 'true';
    if (isMock) {
      setActiveLogs(MOCK_ACTIVE_LOGS);
      setLoading(false);
      return;
    }

    if (!token) return;
    const seq = ++activeLogsSeqRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const deptId = user?.role === 'ADMIN' ? null : (user?.department?.id || user?.department?._id || null);
      const data = await api.checklistHub.getActiveShifts(deptId, token);
      if (seq === activeLogsSeqRef.current) {
        setActiveLogs(Array.from(new Map(data.map((item: any) => [item._id, item])).values()) as ShiftLog[]);
      }
    } catch (err) {
      console.warn(err);
    } finally {
      if (seq === activeLogsSeqRef.current) {
        setLoading(false);
      }
    }
  }, [token, user, searchParams]);

  const loadLogDetail = useCallback(async (id: string) => {
    const isMock = searchParams.get('mock') === 'true' || id.startsWith('shift_mock');
    if (isMock) {
      const target = MOCK_ACTIVE_LOGS.find(s => s._id === id) || MOCK_ACTIVE_LOGS[0];
      setLog(target);
      const notes: Record<string, string> = {};
      target.details.forEach(item => {
        notes[item.taskId] = item.note || '';
      });
      setNotesState(notes);
      setLoading(false);
      return;
    }

    if (!token) return;
    const seq = ++logDetailSeqRef.current;
    setLoading(true);
    setLoadError('');
    try {
      const target: ShiftLog = await api.checklistHub.getShiftDetail(id, token);
      if (seq === logDetailSeqRef.current) {
        setLog(target);
        // Pre-fill notesState
        const notes: Record<string, string> = {};
        target.details.forEach(item => {
          notes[item.taskId] = item.note || '';
        });
        setNotesState(notes);
      }
    } catch (err: any) {
      console.warn(err);
      if (seq === logDetailSeqRef.current) {
        setLoadError(err.message || 'Lỗi kết nối máy chủ.');
      }
    } finally {
      if (seq === logDetailSeqRef.current) {
        setLoading(false);
      }
    }
  }, [token, searchParams]);

  const loadAuditLogs = useCallback(async (id: string) => {
    const isMock = searchParams.get('mock') === 'true' || id.startsWith('shift_mock');
    if (isMock) {
      setAuditLogs(MOCK_AUDIT_LOGS);
      return;
    }

    if (!token) return;
    const seq = ++auditLogsSeqRef.current;
    try {
      const data = await api.checklistHub.getShiftAuditLogs(id, token);
      const uniqueAudits = Array.from(new Map(data.map((item: any) => [item._id, item])).values());
      if (seq === auditLogsSeqRef.current) {
        setAuditLogs(uniqueAudits as AuditLog[]);
      }
    } catch (err) {
      console.warn('Lỗi tải nhật ký kiểm toán:', err);
    }
  }, [token, searchParams]);

  const loadIncidents = useCallback(async (id: string) => {
    const isMock = searchParams.get('mock') === 'true' || id.startsWith('shift_mock');
    if (isMock) {
      setIncidents([]);
      return;
    }

    if (!token) return;
    const seq = ++incidentsSeqRef.current;
    try {
      const data = await api.checklistHub.getIncidents(id, token);
      const uniqueIncidents = Array.from(new Map(data.map((item: any) => [item._id, item])).values());
      if (seq === incidentsSeqRef.current) {
        setIncidents(uniqueIncidents);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách sự cố:', err);
    }
  }, [token, searchParams]);

  const handleResolveIncident = async () => {
    if (!resolvingIncident || !token) return;
    if (!remediationAction.trim()) {
      toast.error('Vui lòng nhập giải pháp khắc phục (Remediation Action)!');
      return;
    }
    setIsResolving(true);

    try {
      const accounts = affectedAccountsInput.split(',').map(s => s.trim()).filter(Boolean);
      const updated = await api.checklistHub.resolveIncident(
        resolvingIncident._id,
        {
          rootCause,
          remediationAction,
          affectedAccounts: accounts,
        },
        token,
      );

      setIncidents(prev => prev.map(inc => inc._id === updated._id ? updated : inc));
      setResolvingIncident(null);
      setRootCause('MISSING_CONFIGURATION');
      setRemediationAction('');
      setAffectedAccountsInput('');
      toast.success('Đã xử lý giải quyết sự cố thành công!');
    } catch (err: any) {
      console.warn(err);
      toast.error(err.message || 'Không thể cập nhật sự cố.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleAddAdhocTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adhocTaskName.trim()) {
      toast.error('Tên tác vụ không được để trống');
      return;
    }
    if (!log || !token) return;

    setIsSubmittingAdhoc(true);

    try {
      const updatedShift: ShiftLog = await api.checklistHub.addTask(
        log._id,
        {
          taskName: adhocTaskName.trim(),
          priority: adhocPriority,
          deadline: adhocDeadline.trim() || undefined,
        },
        token,
      );
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

      toast.success('Đã thêm tác vụ phát sinh thành công!');
      setIsAdhocModalOpen(false);
      setAdhocTaskName('');
      setAdhocPriority('MEDIUM');
      setAdhocDeadline('');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xảy ra');
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
    }
  }, [shiftLogId, loadLogDetail, loadActiveLogs, loadAuditLogs, loadIncidents]);

  // WebSockets Real-time Synchronization
  useEffect(() => {
    if (!shiftLogId || !token) return;

    // Establish WebSocket Connection via AppSocket Singleton
    const socket = getAppSocket();
    if (!socket) return;

    socket.emit('joinRoom', { shiftLogId });

    // Listen for shift update events
    const handleShiftUpdated = (data: { shiftLog: ShiftLog; auditLog?: AuditLog }) => {
      console.log('Real-time sync update received:', data);
      if (data?.shiftLog) {
        setLog(prevLog => {
          if (!prevLog) return data.shiftLog;
          
          // Merge in-flight status/checked states from local state to prevent overwrite by stale broadcast
          const mergedDetails = data.shiftLog.details.map(item => {
            if (togglingTaskIdsRef.current.has(item.taskId)) {
              const localItem = prevLog.details.find(d => d.taskId === item.taskId);
              if (localItem) {
                return {
                  ...item,
                  status: localItem.status,
                  isChecked: localItem.isChecked,
                  checkedAt: localItem.checkedAt,
                  updatedBy: localItem.updatedBy
                };
              }
            }
            return item;
          });

          return {
            ...data.shiftLog,
            details: mergedDetails
          };
        });

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
        setAuditLogs(prev => {
          if (prev.some(a => a._id === data.auditLog!._id)) return prev;
          return [data.auditLog!, ...prev].slice(0, 100);
        });
      }
    };

    // Listen for incident update events
    const handleIncidentUpdated = (data: { incident: any; auditLog?: any }) => {
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
        setAuditLogs(prev => {
          if (prev.some(a => a._id === data.auditLog!._id)) return prev;
          return [data.auditLog!, ...prev].slice(0, 100);
        });
      }
    };

    socket.on('shift-updated', handleShiftUpdated);
    socket.on('incident-updated', handleIncidentUpdated);

    return () => {
      socket.emit('leaveRoom', { shiftLogId });
      socket.off('shift-updated', handleShiftUpdated);
      socket.off('incident-updated', handleIncidentUpdated);
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
    if (togglingTaskIdsRef.current.has(taskId)) return;

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
        toast.error(`Không thể thay đổi trạng thái. Tác vụ này phụ thuộc vào tác vụ chưa hoàn thành: ${listStr}`);
        return;
      }
    }

    togglingTaskIdsRef.current.add(taskId);
    setTogglingTaskIds(new Set(togglingTaskIdsRef.current));

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

    if (log._id.startsWith('shift_mock')) {
      toast.success('Cập nhật trạng thái tác vụ thành công.');
      togglingTaskIdsRef.current.delete(taskId);
      setTogglingTaskIds(new Set(togglingTaskIdsRef.current));
      return;
    }

    try {
      const updated: ShiftLog = await api.checklistHub.updateItemStatus(
        {
          shiftLogId: log._id,
          taskId,
          status: newStatus,
          note,
        },
        token,
      );
      setLog(updated);
      toast.success('Cập nhật trạng thái tác vụ thành công.');
    } catch (err: any) {
      setLog(previousLog);
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      togglingTaskIdsRef.current.delete(taskId);
      setTogglingTaskIds(new Set(togglingTaskIdsRef.current));
    }
  };

  const handleToggle = async (taskId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus ? 'PASSED' : 'PENDING';
    await handleStatusChange(taskId, newStatus);
  };

  const handleSaveNote = async (taskId: string) => {
    if (!log || log.status === 'COMPLETED' || !token) return;
    setSavingTaskId(taskId);

    const targetItem = log.details.find(d => d.taskId === taskId);
    const status = targetItem ? (targetItem.status || (targetItem.isChecked ? 'PASSED' : 'PENDING')) : 'PENDING';
    const note = notesState[taskId] || '';

    if (log._id.startsWith('shift_mock')) {
      setLog(prev => {
        if (!prev) return null;
        return {
          ...prev,
          details: prev.details.map(item => item.taskId === taskId ? { ...item, note } : item),
        };
      });
      toast.success('Ghi chú đã được cập nhật.');
      setSavingTaskId(null);
      return;
    }

    try {
      const updated: ShiftLog = await api.checklistHub.updateItemStatus(
        {
          shiftLogId: log._id,
          taskId,
          status,
          note,
        },
        token,
      );
      setLog(updated);
      toast.success('Ghi chú đã được cập nhật.');
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleCloseShift = async (noteInput: string) => {
    if (!log || !token) return;

    setLoading(true);
    try {
      const updated: ShiftLog = await api.checklistHub.closeShift(
        {
          shiftLogId: log._id,
          handoverNote: noteInput,
        },
        token,
      );
      setLog(updated);
      toast.success('Đã CHỐT ca trực vận hành thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Có lỗi xảy ra');
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

    const statusDesc = resolveShiftStatus(log);

    const csvContent = [
      'SỞ GIAO DỊCH HÀNG HÓA VIỆT NAM (MXV)',
      `BIÊN BẢN VẬN HÀNH: ${log.templateId?.title}`,
      `Ngày trực: ${log.shiftDate}`,
      `Người trực chính: ${log.userId?.fullName}`,
      `Phòng ban: ${log.templateId?.departmentId?.name || 'ADMIN Portal'}`,
      `Trạng thái vận hành: ${statusDesc.operationalLabel}`,
      `Đánh giá chất lượng: ${statusDesc.label}`,
      `Tiến độ hoàn thành: ${log.progressPercentage}%`,
      ...(log.handoverNote ? [`Biên bản bàn giao: "${log.handoverNote.replace(/"/g, '""')}"`] : []),
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
    loadError,
    setLoadError,
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
    togglingTaskIds,
  };
}
