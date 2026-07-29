'use client';

import React, { useState, useMemo } from 'react';
import {
  Lock,
  Unlock,
  Clock,
  User as UserIcon,
  Link2,
  FileText,
  Cpu,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Save,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  XCircle,
  SkipForward,
  AlertTriangle,
  FileSpreadsheet,
  ShieldAlert,
  Bot,
  UserCheck,
  Copy
} from 'lucide-react';
import { TaskDetail, ShiftLog } from '../hooks/useChecklist';

const cleanAnsiText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\[\d+m/g, '')
    .replace(/\[\d+2m/g, '')
    .replace(/\[\d+22m/g, '')
    .replace(/\[2m/g, '')
    .replace(/\[22m/g, '')
    .trim();
};

const STATUS_CONFIGS = {
  PENDING: {
    label: 'Chưa thực hiện',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.2)',
    icon: Clock,
  },
  WAITING: {
    label: 'Đang kiểm tra',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.2)',
    icon: Cpu,
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

interface TaskTableProps {
  log: ShiftLog;
  filteredDetails: TaskDetail[];
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  isCompleted: boolean;
  savingTaskId: string | null;
  notesState: Record<string, string>;
  setNotesState: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  openStatusDropdownTaskId: string | null;
  setOpenStatusDropdownTaskId: (v: string | null) => void;
  isTaskLocked: (item: TaskDetail) => boolean;
  handleToggle: (taskId: string, currentStatus: boolean) => Promise<void>;
  handleStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  handleSaveNote: (taskId: string) => Promise<void>;
  setIsAdhocModalOpen: (v: boolean) => void;
  focusedTaskIdRef: React.MutableRefObject<string | null>;
  user: any;
  onOpenReconciliation: (taskId: string) => void;
  onOpenMarginChecker: () => void;
  onOpenCcpStatistics: () => void;
  onOpenTradingReport: () => void;
  onOpenOmsStatus: (taskId: string) => void;
  onOpenMaturityTemplates?: () => void;
  onOpenBotLogViewer?: (title: string, resultNote: string, status?: string, checkedAt?: string, taskId?: string) => void;
  togglingTaskIds: Set<string>;
}

export default function TaskTable({
  log,
  filteredDetails,
  searchQuery,
  setSearchQuery,
  priorityFilter,
  setPriorityFilter,
  statusFilter,
  setStatusFilter,
  isCompleted,
  savingTaskId,
  notesState,
  setNotesState,
  openStatusDropdownTaskId,
  setOpenStatusDropdownTaskId,
  isTaskLocked,
  handleToggle,
  handleStatusChange,
  handleSaveNote,
  setIsAdhocModalOpen,
  focusedTaskIdRef,
  user,
  onOpenReconciliation,
  onOpenMarginChecker,
  onOpenCcpStatistics,
  onOpenTradingReport,
  onOpenOmsStatus,
  onOpenMaturityTemplates,
  onOpenBotLogViewer,
  togglingTaskIds
}: TaskTableProps) {

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  // Build parent→children map from full log.details
  const childrenMap = useMemo(() => {
    const map: Record<string, TaskDetail[]> = {};
    (log.details || []).forEach(d => {
      const pid = (d as any).parentTaskIdSnapshot || (d as any).parentTaskId;
      if (pid) {
        if (!map[pid]) map[pid] = [];
        map[pid].push(d);
      }
    });
    return map;
  }, [log.details]);

  // IDs that are children (to skip rendering them standalone)
  const childIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(childrenMap).flat().forEach(d => ids.add(d.taskId));
    return ids;
  }, [childrenMap]);

  // Only show parent tasks (or standalone tasks without parentTaskId) in the main list
  const parentDetails = useMemo(() =>
    filteredDetails.filter(d => !childIds.has(d.taskId)),
    [filteredDetails, childIds]
  );

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return log.details.find(d => d.taskId === selectedTaskId) || null;
  }, [selectedTaskId, log.details]);

  // Auto-select first failed/needs_attention or incomplete parent task on mount
  const hasInitializedSelectionRef = React.useRef(false);
  React.useEffect(() => {
    if (parentDetails && parentDetails.length > 0 && !hasInitializedSelectionRef.current) {
      const firstUrgent = parentDetails.find(p => {
        if (p.status === 'FAILED' || p.status === 'NEEDS_ATTENTION' || !p.isChecked) {
          return true;
        }
        const children = childrenMap[p.taskId] || [];
        return children.some(c => !c.isChecked || c.status === 'FAILED' || c.status === 'NEEDS_ATTENTION');
      });
      
      if (firstUrgent) {
        setSelectedTaskId(firstUrgent.taskId);
      } else {
        setSelectedTaskId(parentDetails[0].taskId);
      }
      hasInitializedSelectionRef.current = true;
    }
  }, [parentDetails, childrenMap]);

  // If selected task is filtered out, select the first matching parent
  React.useEffect(() => {
    if (selectedTaskId && parentDetails.length > 0) {
      const exists = parentDetails.some(p => p.taskId === selectedTaskId);
      if (!exists) {
        setSelectedTaskId(parentDetails[0].taskId);
      }
    } else if (parentDetails.length > 0 && !selectedTaskId) {
      setSelectedTaskId(parentDetails[0].taskId);
    }
  }, [parentDetails, selectedTaskId]);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW': return <span className="badge badge-low">Thấp</span>;
      case 'MEDIUM': return <span className="badge badge-medium">Trung Bình</span>;
      case 'HIGH': return <span className="badge badge-high">Cao</span>;
      default: return <span className="badge badge-critical">Khẩn Cấp</span>;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <FileText size={18} color="var(--color-accent)" /> Checklist Nhiệm vụ ({filteredDetails.length} / {log.details?.length || 0})
        </h3>
        {!isCompleted && (
          <button
            onClick={() => setIsAdhocModalOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Thêm tác vụ phát sinh
          </button>
        )}
      </div>

      {/* Live Search and Filters group */}
      <div 
        className="flex flex-col sm:flex-row gap-3 mb-5 p-3 rounded-xl border border-[var(--border-color)] items-stretch sm:items-center sticky top-[74px] z-10 backdrop-blur-md"
        style={{
          background: 'rgba(var(--bg-card), 0.85)',
          backgroundColor: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Text search */}
        <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Tìm nội dung, mã tác vụ..."
            className="form-input"
            style={{ height: '38px', paddingLeft: '32px', fontSize: '0.82rem', width: '100%' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          {/* Priority Select */}
          <div className="flex-1 sm:flex-initial flex items-center gap-1.5">
            <Filter size={13} color="var(--text-muted)" className="hidden sm:inline" />
            <select
              className="form-input w-full sm:w-[130px]"
              style={{
                height: '38px',
                padding: '0 28px 0 12px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: 'var(--bg-input) url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e") no-repeat right 8px center/16px 16px',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none'
              }}
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
          <div className="flex-1 sm:flex-initial">
            <select
              className="form-input w-full sm:w-[130px]"
              style={{
                height: '38px',
                padding: '0 28px 0 12px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                background: 'var(--bg-input) url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e") no-repeat right 8px center/16px 16px',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none'
              }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Mọi trạng thái</option>
              <option value="CHECKED">Đã kiểm tra</option>
              <option value="UNCHECKED">Chưa kiểm tra</option>
              <option value="PENDING">Chưa thực hiện</option>
              <option value="WAITING">Đang kiểm tra</option>
              <option value="PASSED">Đạt</option>
              <option value="FAILED">Không đạt</option>
              <option value="SKIPPED">Bỏ qua</option>
              <option value="NEEDS_ATTENTION">Cần chú ý</option>
            </select>
          </div>
        </div>
      </div>

      {/* Master-Detail Grid Layout */}
      <div 
        className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr] gap-6" 
        style={{ marginTop: '12px', alignItems: 'start' }}
      >
        {/* Left Column: Parent Tasks List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '72vh', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
          {parentDetails.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
              Không tìm thấy tác vụ phù hợp với bộ lọc.
            </div>
          ) : (
            parentDetails.map((item, idx) => {
              const children = childrenMap[item.taskId] || [];
              const hasChildren = children.length > 0;
              const isBotOnly = item.isBotCheckSnapshot && !hasChildren;
              const currentStatus = item.status || 'PENDING';
              const currentStatusConfig = STATUS_CONFIGS[currentStatus] || STATUS_CONFIGS.PENDING;
              const StatusIcon = currentStatusConfig.icon;
              const isSelected = selectedTaskId === item.taskId;

              return (
                <div
                  key={`${item.taskId}-${idx}`}
                  className="glass-panel animate-fade-in"
                  onClick={() => setSelectedTaskId(item.taskId)}
                  onMouseEnter={() => setHoveredTaskId(item.taskId)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    background: isSelected
                      ? 'rgba(59, 130, 246, 0.05)'
                      : hoveredTaskId === item.taskId
                        ? 'rgba(255, 255, 255, 0.02)'
                        : isBotOnly
                          ? 'rgba(236,72,153,0.02)'
                          : item.isChecked
                            ? 'rgba(16, 185, 129, 0.01)'
                            : 'var(--bg-card)',
                    borderTop: isSelected
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--border-color)',
                    borderRight: isSelected
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--border-color)',
                    borderBottom: isSelected
                      ? '1px solid var(--color-accent)'
                      : '1px solid var(--border-color)',
                    borderLeft: isBotOnly
                      ? '4px solid #ec4899'
                      : hasChildren
                        ? '4px solid #8b5cf6'
                        : item.isChecked
                          ? '4px solid var(--color-primary)'
                          : isSelected
                            ? '1px solid var(--color-accent)'
                            : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    transform: hoveredTaskId === item.taskId && !isSelected
                      ? 'translateY(-2px)'
                      : 'translateY(0)',
                    boxShadow: isSelected
                      ? '0 0 0 1px var(--color-accent), 0 4px 12px rgba(59, 130, 246, 0.15)'
                      : hoveredTaskId === item.taskId
                        ? 'var(--shadow-md)'
                        : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      #{idx + 1}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: currentStatusConfig.color,
                        background: currentStatusConfig.bgColor,
                        padding: '2px 8px',
                        borderRadius: '5px',
                        border: `1px solid ${currentStatusConfig.borderColor}`,
                      }}
                    >
                      <StatusIcon size={11} className={item.status === 'WAITING' ? 'animate-pulse animate-spin-slow' : ''} />
                      {currentStatusConfig.label}
                    </span>
                  </div>

                  <p style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    lineHeight: '1.4',
                    margin: 0,
                    textDecoration: 'none',
                    opacity: item.isChecked ? 0.65 : 1,
                  }}>
                    [{item.taskId}] {item.taskNameSnapshot}
                  </p>

                  {item.dependsOnTaskIdsSnapshot && item.dependsOnTaskIdsSnapshot.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                      {item.dependsOnTaskIdsSnapshot.map(depId => {
                        const depTask = log.details.find(d => d.taskId === depId);
                        const isDepDone = depTask ? depTask.isChecked : false;
                        return (
                           <span key={depId} style={{
                            fontSize: '0.65rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: isDepDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            color: isDepDone ? '#10b981' : '#ef4444',
                            border: `1px solid ${isDepDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`,
                            fontWeight: 600
                          }}>
                            {isDepDone ? <Unlock size={9} /> : <Lock size={9} />}
                            Phụ thuộc: {depId} ({isDepDone ? 'Đạt' : 'Chưa'})
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {getPriorityBadge(item.prioritySnapshot)}
                      {item.timetableSnapshot && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }} title="Khung giờ">
                          <Clock size={10} /> {item.timetableSnapshot}
                        </span>
                      )}
                      {item.slaDeadlineSnapshot && !item.timetableSnapshot && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }} title="SLA">
                          <Clock size={10} /> SLA: {item.slaDeadlineSnapshot}{item.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? 'm' : ''}
                        </span>
                      )}
                      {item.deadlineSnapshot && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ef4444', fontWeight: 600 }} title="Hạn chót">
                          <Clock size={10} /> Hạn: {item.deadlineSnapshot}
                        </span>
                      )}
                    </div>
                    {hasChildren && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: 'rgba(139,92,246,0.08)', color: '#8b5cf6', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>
                        {children.filter(c => c.isChecked).length}/{children.length} con
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Detailed Workspace Panel */}
        <div 
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            padding: '24px',
            borderRadius: '16px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--glass-shadow)',
            position: 'sticky',
            top: '136px',
            alignSelf: 'start',
            maxHeight: '82vh',
            overflowY: 'auto',
          }} 
          className="custom-scrollbar"
        >
          {selectedTask ? (() => {
            const children = childrenMap[selectedTask.taskId] || [];
            const hasChildren = children.length > 0;
            const isBotOnly = selectedTask.isBotCheckSnapshot && !hasChildren;
            const currentStatus = selectedTask.status || 'PENDING';
            const currentStatusConfig = STATUS_CONFIGS[currentStatus] || STATUS_CONFIGS.PENDING;
            const StatusIcon = currentStatusConfig.icon;
            const locked = isTaskLocked(selectedTask);
            const isSaving = savingTaskId === selectedTask.taskId;
            const isToggling = togglingTaskIds.has(selectedTask.taskId);

            return (
              <div key={selectedTask.taskId} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                {/* Header Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                    {selectedTask.isBotCheckSnapshot && !hasChildren ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(236,72,153,0.12)', color: '#ec4899', borderRadius: '5px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                        <Cpu size={12} /> BOT TỰ ĐỘNG
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59,130,246,0.12)', color: '#3b82f6', borderRadius: '5px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700 }}>
                        <UserCheck size={12} /> CA TRỰC THỰC HIỆN
                      </span>
                    )}
                    {getPriorityBadge(selectedTask.prioritySnapshot)}
                  </div>

                  <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '6px 0 0 0', lineHeight: '1.4' }}>
                    [{selectedTask.taskId}] {selectedTask.taskNameSnapshot}
                  </h4>

                  {selectedTask.dependsOnTaskIdsSnapshot && selectedTask.dependsOnTaskIdsSnapshot.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {selectedTask.dependsOnTaskIdsSnapshot.map(depId => {
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
                </div>

                {/* Status and Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Trạng thái tác vụ:</span>
                    
                    <div style={{ position: 'relative' }}>
                      <button
                        onClick={() => {
                          if (isCompleted || locked || isSaving || isToggling) return;
                          setOpenStatusDropdownTaskId(openStatusDropdownTaskId === selectedTask.taskId ? null : selectedTask.taskId);
                        }}
                        disabled={isCompleted || locked || isSaving || isToggling}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          cursor: (isCompleted || locked || isSaving || isToggling) ? 'not-allowed' : 'pointer',
                          background: currentStatusConfig.bgColor,
                          color: currentStatusConfig.color,
                          border: `1px solid ${currentStatusConfig.borderColor}`,
                          transition: 'all 0.2s ease',
                          minWidth: '150px',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <StatusIcon
                             size={14}
                             className={selectedTask.status === 'WAITING' ? 'animate-pulse animate-spin-slow' : ''}
                          />
                          {currentStatusConfig.label}
                        </span>
                        {!isCompleted && !locked && <ChevronDown size={12} />}
                      </button>

                      {openStatusDropdownTaskId === selectedTask.taskId && (
                        <>
                          <div
                            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                            onClick={e => {
                              e.stopPropagation();
                              setOpenStatusDropdownTaskId(null);
                            }}
                          />
                          <div style={{
                            position: 'absolute',
                            right: 0,
                            top: '100%',
                            marginTop: '4px',
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '10px',
                            boxShadow: 'var(--glass-shadow)',
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
                                    handleStatusChange(selectedTask.taskId, statusKey);
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

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                    {/* Đối chiếu Excel */}
                    {(selectedTask.taskId.toUpperCase().includes('KLGD') ||
                      selectedTask.taskId.toUpperCase().includes('EOD') ||
                      selectedTask.taskId.toUpperCase().includes('CQG') ||
                      selectedTask.taskId.toUpperCase().includes('RECON') ||
                      selectedTask.taskId === 'ops_open_04' ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU MS') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU EOD') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU CQG') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('XỬ LÝ SAU EOD') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU KHỚP LỆNH')) && !isCompleted && (
                      <button
                        onClick={() => onOpenReconciliation(selectedTask.taskId)}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(59, 130, 246, 0.08)',
                          color: '#3b82f6',
                          border: '1px solid rgba(59, 130, 246, 0.2)',
                        }}
                      >
                        <FileSpreadsheet size={12} />
                        Đối chiếu Excel
                      </button>
                    )}

                    {/* Margin Checker */}
                    {(selectedTask.taskId.toUpperCase().includes('MARGIN') ||
                      selectedTask.taskId.toUpperCase().includes('KYQUY') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('MARGIN') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('KÝ QUỸ')) && !isCompleted && (
                      <button
                        onClick={onOpenMarginChecker}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                        }}
                      >
                        <ShieldAlert size={12} />
                        Margin Checker
                      </button>
                    )}

                    {/* Thống kê CCP */}
                    {(selectedTask.taskId.toUpperCase().includes('CCP') ||
                      selectedTask.taskId.toUpperCase().includes('STATISTICS') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('THỐNG KÊ CCP')) && !isCompleted && (
                      <button
                        onClick={onOpenCcpStatistics}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(52, 211, 153, 0.08)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.2)',
                        }}
                      >
                        <FileSpreadsheet size={12} />
                        Thống kê CCP
                      </button>
                    )}

                    {/* Báo cáo Giao dịch */}
                    {(selectedTask.taskId.toUpperCase().includes('REPORT') ||
                      selectedTask.taskId.toUpperCase().includes('TRADING') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('BÁO CÁO GIAO DỊCH') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('TRADING REPORT')) && !isCompleted && (
                      <button
                        onClick={onOpenTradingReport}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          color: '#38bdf8',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                        }}
                      >
                        <FileSpreadsheet size={12} />
                        Báo cáo Giao dịch
                      </button>
                    )}

                    {/* OMS Status / Xác minh Email */}
                    {(selectedTask.taskId === 'ops_open_02' ||
                      selectedTask.taskId === 'ops_open_07' ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('EOD OMS') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('OMS EOD') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('OMS STATUS')) && !isCompleted && (
                      <button
                        onClick={() => onOpenOmsStatus(selectedTask.taskId)}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: selectedTask.taskId === 'ops_open_07' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(236, 72, 153, 0.08)',
                          color: selectedTask.taskId === 'ops_open_07' ? '#3b82f6' : '#ec4899',
                          border: selectedTask.taskId === 'ops_open_07' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(236, 72, 153, 0.2)',
                        }}
                      >
                        {selectedTask.taskId === 'ops_open_07' ? (
                          <>
                            <MessageSquare size={12} />
                            Xác minh Email
                          </>
                        ) : (
                          <>
                            <Cpu size={12} />
                            OMS Status
                          </>
                        )}
                      </button>
                    )}

                    {/* Mẫu tin nhắn */}
                    {(selectedTask.taskId === 'ops_during_05' ||
                      selectedTask.taskId.toUpperCase().includes('MATURITY') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('TẤT TOÁN HỢP ĐỒNG') ||
                      selectedTask.taskNameSnapshot.toUpperCase().includes('THÔNG BÁO ĐÁO HẠN')) && !isCompleted && (
                      <button
                        onClick={onOpenMaturityTemplates}
                        className="btn btn-secondary animate-fade-in"
                        style={{
                          padding: '6px 12px',
                          fontSize: '0.75rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(99, 102, 241, 0.08)',
                          color: '#6366f1',
                          border: '1px solid rgba(99, 102, 241, 0.2)',
                        }}
                      >
                        <Copy size={12} />
                        Mẫu tin nhắn
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata Fields Grid */}
                {(selectedTask.deadlineSnapshot ||
                  selectedTask.slaDeadlineSnapshot ||
                  selectedTask.timetableSnapshot ||
                  selectedTask.urdReferenceSnapshot ||
                  selectedTask.fileLocationSnapshot ||
                  selectedTask.functionUrlSnapshot) && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    fontSize: '0.78rem'
                  }}>
                    {selectedTask.deadlineSnapshot && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(239, 68, 68, 0.05)',
                        color: '#ef4444',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        <Clock size={12} />
                        <span>Hạn chót: {selectedTask.deadlineSnapshot}</span>
                      </div>
                    )}
                    {selectedTask.slaDeadlineSnapshot && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(245, 158, 11, 0.05)',
                        color: '#f59e0b',
                        border: '1px solid rgba(245, 158, 11, 0.15)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        <Clock size={12} />
                        <span>Thời hạn cam kết (SLA): {selectedTask.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? 'Động' : 'Cố định'} ({selectedTask.slaDeadlineSnapshot}{selectedTask.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? ' phút' : ''})</span>
                      </div>
                    )}
                    {selectedTask.timetableSnapshot && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(59, 130, 246, 0.05)',
                        color: '#3b82f6',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        <Clock size={12} />
                        <span>Khung giờ: {selectedTask.timetableSnapshot}</span>
                      </div>
                    )}
                    {selectedTask.urdReferenceSnapshot && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(16, 185, 129, 0.05)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.15)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        <FileText size={12} />
                        <span>URD tham chiếu: {selectedTask.urdReferenceSnapshot}</span>
                      </div>
                    )}
                    {selectedTask.functionUrlSnapshot && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(139, 92, 246, 0.05)',
                        color: '#8b5cf6',
                        border: '1px solid rgba(139, 92, 246, 0.15)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        <Link2 size={12} />
                        <span>URL chức năng: </span>
                        <a href={selectedTask.functionUrlSnapshot} target="_blank" rel="noreferrer" style={{ color: '#8b5cf6', textDecoration: 'underline', wordBreak: 'break-all' }}>
                          {selectedTask.functionUrlSnapshot}
                        </a>
                      </div>
                    )}
                    {selectedTask.fileLocationSnapshot && (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        width: '100%',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        fontSize: '0.78rem'
                      }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 600 }}>Đường dẫn tệp:</span>
                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all', color: 'var(--text-secondary)' }}>
                          <FileText size={12} style={{ flexShrink: 0 }} /> {selectedTask.fileLocationSnapshot}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Bot Result Log */}
                {selectedTask.resultNote && (() => {
                  let parsedMessage = selectedTask.resultNote;
                  try {
                    const json = JSON.parse(selectedTask.resultNote);
                    parsedMessage = json.message || selectedTask.resultNote;
                  } catch (e) {}

                  const cleanedMsg = cleanAnsiText(parsedMessage);
                  if (!cleanedMsg) return null;

                  return (
                    <div style={{
                      background: 'var(--bg-input)',
                      padding: '12px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      borderLeft: selectedTask.status === 'FAILED' ? '4px solid #ef4444' : '4px solid #0284c7',
                      fontFamily: 'monospace',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#0284c7', fontWeight: 700, flexShrink: 0 }}>
                          <Bot size={13} /> Log kết quả Bot:
                        </span>
                        <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{cleanedMsg}</span>
                      </div>

                      <div style={{ marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={() => onOpenBotLogViewer?.(selectedTask.taskNameSnapshot, selectedTask.resultNote || '', selectedTask.status, selectedTask.checkedAt, selectedTask.taskId)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 10px',
                            background: 'rgba(2, 132, 199, 0.1)',
                            color: '#0284c7',
                            border: '1px solid rgba(2, 132, 199, 0.25)',
                            borderRadius: '5px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Search size={12} /> Xem đối chiếu chi tiết trực quan (Bảng số liệu & Lệch)
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Sub-tasks checklist */}
                {hasChildren && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                      Tác vụ con ({children.filter(c => c.isChecked).length}/{children.length} hoàn thành):
                    </span>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {children.sort((a,b) => ((a as any).sortOrder||0) - ((b as any).sortOrder||0)).map((child, cIdx) => {
                        const isBot = child.isBotCheckSnapshot;
                        const cStatus = child.status || 'PENDING';
                        const cConfig = STATUS_CONFIGS[cStatus] || STATUS_CONFIGS.PENDING;
                        const CIcon = cConfig.icon;
                        const cSaving = savingTaskId === child.taskId;
                        const cToggling = togglingTaskIds.has(child.taskId);
                        const isChildDropdownOpen = openStatusDropdownTaskId === child.taskId;
                        
                        return (
                          <div key={`${child.taskId}-${cIdx}`} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '8px 12px', borderRadius: '8px',
                            background: child.isChecked
                              ? 'rgba(16,185,129,0.05)'
                              : isBot ? 'rgba(236,72,153,0.04)' : 'rgba(255,255,255,0.03)',
                            border: child.isChecked
                              ? '1px solid rgba(16,185,129,0.15)'
                              : isBot ? '1px solid rgba(236,72,153,0.15)' : '1px solid var(--border-color)',
                            opacity: cToggling ? 0.6 : 1,
                            transition: 'all 0.2s',
                            position: 'relative',
                            zIndex: isChildDropdownOpen ? 50 : (children.length - cIdx)
                          }}>
                            <button
                               type="button"
                               onClick={() => handleToggle(child.taskId, child.isChecked)}
                               disabled={isCompleted || cSaving || cToggling}
                               title={isBot ? "Bot tự động check (Maker có thể can thiệp thủ công)" : "Đánh dấu hoàn thành"}
                               className="transition-transform duration-150 hover:scale-110 active:scale-95 flex items-center justify-center"
                               style={{
                                 background: 'transparent',
                                 border: 'none',
                                 padding: 0,
                                 cursor: (isCompleted || cToggling) ? 'not-allowed' : 'pointer',
                                 color: child.isChecked
                                   ? '#10b981'
                                   : isBot
                                     ? '#ec4899'
                                     : 'var(--text-muted)',
                                 flexShrink: 0,
                                 outline: 'none',
                               }}
                             >
                               {child.isChecked ? (
                                 <CheckCircle2 size={18} style={{ fill: 'rgba(16, 185, 129, 0.1)' }} />
                               ) : (
                                 <Circle size={18} />
                               )}
                             </button>
                            
                            <span style={{ flex: 1, fontSize: '0.83rem', color: 'var(--text-primary)', textDecoration: 'none', opacity: child.isChecked ? 0.6 : 1 }}>
                              {child.taskNameSnapshot}
                            </span>

                            {isBot ? (
                              <span style={{ display:'inline-flex',alignItems:'center',gap:'3px', background:'rgba(236,72,153,0.1)', color:'#ec4899', borderRadius:'4px', padding:'1px 6px', fontSize:'0.68rem', fontWeight:700, flexShrink:0 }}>
                                <Cpu size={9}/> Bot
                              </span>
                            ) : (
                              <span style={{ display:'inline-flex',alignItems:'center',gap:'3px', background:'rgba(59,130,246,0.1)', color:'#3b82f6', borderRadius:'4px', padding:'1px 6px', fontSize:'0.68rem', fontWeight:700, flexShrink:0 }}>
                                <UserCheck size={9}/> Maker
                              </span>
                            )}

                            <span
                              onClick={() => child.resultNote && onOpenBotLogViewer?.(child.taskNameSnapshot, child.resultNote || '', child.status, child.checkedAt, child.taskId)}
                              style={{
                                display:'inline-flex',alignItems:'center',gap:'4px', fontSize:'0.72rem', fontWeight:600,
                                color: cConfig.color, background: cConfig.bgColor, padding:'1px 7px', borderRadius:'5px',
                                border:`1px solid ${cConfig.borderColor}`, flexShrink:0,
                                cursor: child.resultNote ? 'pointer' : 'default'
                              }}
                              title={child.resultNote ? "Bấm để xem log chi tiết Bot" : undefined}
                            >
                              <CIcon size={11}/> {cConfig.label}
                            </span>

                            {child.resultNote && (
                              <button
                                type="button"
                                onClick={() => onOpenBotLogViewer?.(child.taskNameSnapshot, child.resultNote || '', child.status, child.checkedAt, child.taskId)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: child.status === 'FAILED' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(2, 132, 199, 0.1)',
                                  color: child.status === 'FAILED' ? '#ef4444' : '#0284c7',
                                  border: child.status === 'FAILED' ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(2, 132, 199, 0.25)',
                                  borderRadius: '5px',
                                  padding: '2px 7px',
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                                title="Xem chi tiết log Bot"
                              >
                                <Search size={10} /> Xem log
                              </button>
                            )}

                            {!isCompleted && (
                              <button
                                onClick={() => setOpenStatusDropdownTaskId(openStatusDropdownTaskId === child.taskId ? null : child.taskId)}
                                disabled={isCompleted || cSaving || cToggling}
                                style={{ background:'transparent', border:'1px solid var(--border-color)', borderRadius:'6px', padding:'2px 6px', cursor:'pointer', flexShrink:0 }}
                                title="Can thiệp / Đổi trạng thái thủ công"
                              >
                                <ChevronDown size={12} color="var(--text-muted)" />
                              </button>
                            )}
                            {openStatusDropdownTaskId === child.taskId && (
                              <>
                                <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:999 }} onClick={e => { e.stopPropagation(); setOpenStatusDropdownTaskId(null); }} />
                                <div style={{
                                  position:'absolute',
                                  right:0,
                                  top: '32px',
                                  background:'var(--bg-card)',
                                  border:'1px solid var(--border-color)',
                                  borderRadius:'10px',
                                  boxShadow:'0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                                  zIndex:1000,
                                  minWidth:'160px',
                                  padding:'4px',
                                  display:'flex',
                                  flexDirection:'column'
                                }}>
                                  {Object.entries(STATUS_CONFIGS).map(([sk, sc]) => {
                                    const OI = sc.icon;
                                    return (
                                      <button key={sk} onClick={() => { handleStatusChange(child.taskId, sk); setOpenStatusDropdownTaskId(null); }}
                                        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', fontSize:'0.76rem', fontWeight:600, color:sc.color, background:'transparent', border:'none', borderRadius:'6px', width:'100%', textAlign:'left', cursor:'pointer' }}
                                        className="status-option-hover">
                                        <OI size={13}/> {sc.label}
                                      </button>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes Input */}
                <div style={{
                  borderTop: '1px dashed var(--border-color)',
                  paddingTop: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={14} color="var(--text-muted)" /> Ghi chú vận hành:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea
                      className="form-input custom-scrollbar"
                      rows={3}
                      placeholder={isCompleted ? "Không thể ghi chú khi đã chốt ca" : "Nhập ghi chú kết quả vận hành..."}
                      value={notesState[selectedTask.taskId] || ''}
                      onChange={(e) => setNotesState({ ...notesState, [selectedTask.taskId]: e.target.value })}
                      onFocus={() => { focusedTaskIdRef.current = selectedTask.taskId; }}
                      onBlur={() => { focusedTaskIdRef.current = null; }}
                      disabled={isCompleted || isSaving}
                      style={{
                        padding: '10px 12px',
                        fontSize: '0.8rem',
                        minHeight: '70px',
                        resize: 'vertical',
                        lineHeight: '1.5',
                        width: '100%',
                        fontFamily: 'inherit'
                      }}
                    />
                    {!isCompleted && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleSaveNote(selectedTask.taskId)}
                          className="btn btn-secondary"
                          disabled={isSaving}
                          style={{
                            padding: '6px 14px',
                            fontSize: '0.78rem',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'rgba(59, 130, 246, 0.08)',
                            color: '#3b82f6',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title="Lưu ghi chú"
                        >
                          <Save size={12} />
                          Lưu ghi chú
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })() : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
              textAlign: 'center',
              height: '100%',
              minHeight: '240px'
            }}>
              <FileText size={36} color="var(--text-muted)" style={{ opacity: 0.4, marginBottom: '12px' }} />
              <p style={{ fontSize: '0.88rem', fontWeight: 500, margin: 0 }}>Chọn một tác vụ từ danh sách để xem chi tiết và xử lý</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
