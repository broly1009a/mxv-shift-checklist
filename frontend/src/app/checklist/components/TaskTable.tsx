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
  XCircle,
  SkipForward,
  AlertTriangle,
  FileSpreadsheet,
  ShieldAlert,
  Bot,
  UserCheck
} from 'lucide-react';
import { TaskDetail, ShiftLog } from '../hooks/useChecklist';

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
  togglingTaskIds
}: TaskTableProps) {

  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  const toggleParent = (taskId: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  // Build parent→children map from full log.details
  const childrenMap = useMemo(() => {
    const map: Record<string, TaskDetail[]> = {};
    (log.details || []).forEach(d => {
      const pid = (d as any).parentTaskIdSnapshot;
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
            <option value="WAITING">Đang kiểm tra</option>
            <option value="PASSED">Đạt</option>
            <option value="FAILED">Không đạt</option>
            <option value="SKIPPED">Bỏ qua</option>
            <option value="NEEDS_ATTENTION">Cần chú ý</option>
          </select>
        </div>
      </div>

      {/* Checklist tasks mapping */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {parentDetails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            Không tìm thấy tác vụ phù hợp với bộ lọc.
          </div>
        ) : (
          parentDetails.map((item) => {
            const children = childrenMap[item.taskId] || [];
            const hasChildren = children.length > 0;
            const isExpanded = expandedParents.has(item.taskId);
            const isBotOnly = item.isBotCheckSnapshot && !hasChildren;
            const isSaving = savingTaskId === item.taskId;
            const isToggling = togglingTaskIds.has(item.taskId);
            const currentStatus = item.status || 'PENDING';
            const currentStatusConfig = STATUS_CONFIGS[currentStatus] || STATUS_CONFIGS.PENDING;
            const StatusIcon = currentStatusConfig.icon;
            const locked = isTaskLocked(item);
            return (
              <div key={item.taskId} className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="glass-panel" style={{
                padding: '16px',
                borderRadius: hasChildren ? '12px 12px 0 0' : '12px',
                background: isBotOnly
                  ? 'rgba(236,72,153,0.03)'
                  : item.isChecked ? 'rgba(16, 185, 129, 0.012)' : 'var(--bg-app)',
                borderLeft: isBotOnly
                  ? '4px solid #ec4899'
                  : hasChildren
                    ? '4px solid #8b5cf6'
                    : item.isChecked ? '4px solid var(--color-primary)' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
                opacity: isToggling ? 0.6 : 1,
                pointerEvents: isToggling ? 'none' : 'auto',
                cursor: hasChildren ? 'pointer' : 'default',
              }}
              onClick={hasChildren ? () => toggleParent(item.taskId) : undefined}
              >

                {/* Checkbox and task information row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }} onClick={e => hasChildren && e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    {/* Expand arrow for parent tasks */}
                    {hasChildren ? (
                      <span style={{ marginTop: '3px', flexShrink: 0, color: '#8b5cf6' }}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                    ) : locked ? (
                      <span title="Bị khóa do phụ thuộc tác vụ chưa hoàn thành">
                        <Lock size={18} color="#ef4444" style={{ marginTop: '3px', flexShrink: 0 }} />
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={item.isChecked}
                        onChange={() => handleToggle(item.taskId, item.isChecked)}
                        disabled={isCompleted || isSaving || isToggling}
                        onClick={e => e.stopPropagation()}
                        style={{
                          width: '18px', height: '18px', marginTop: '3px',
                          cursor: (isCompleted || isToggling) ? 'not-allowed' : 'pointer',
                          accentColor: 'var(--color-primary)'
                        }}
                      />
                    )}
                    <div>
                      <p style={{
                        fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-primary)',
                        lineHeight: '1.4', textDecoration: item.isChecked ? 'line-through' : 'none',
                        opacity: item.isChecked ? 0.65 : 1, margin: 0,
                        display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
                      }}>
                        {/* Bot 100% badge */}
                        {isBotOnly && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(236,72,153,0.12)', color: '#ec4899', borderRadius: '5px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                            <Cpu size={10} /> BOT 100%
                          </span>
                        )}
                        {/* Has-children badge */}
                        {hasChildren && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', borderRadius: '5px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>
                            <ChevronDown size={10} /> {children.length} tác vụ con
                          </span>
                        )}
                        <span>[{item.taskId}] {item.taskNameSnapshot}</span>
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
                        {item.slaDeadlineSnapshot && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(245, 158, 11, 0.06)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            <Clock size={12} /> SLA: {item.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? 'Động' : 'Cố định'} ({item.slaDeadlineSnapshot}{item.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? ' phút' : ''})
                          </span>
                        )}
                      </div>
                      {item.actionDescriptionSnapshot && (
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic', lineHeight: 1.4, opacity: item.isChecked ? 0.6 : 1 }}>
                          <strong>Hướng dẫn:</strong> {item.actionDescriptionSnapshot}
                        </p>
                      )}

                      {/* Reconciliation Button */}
                      {(item.taskId.toUpperCase().includes('KLGD') ||
                        item.taskId.toUpperCase().includes('EOD') ||
                        item.taskId.toUpperCase().includes('CQG') ||
                        item.taskId.toUpperCase().includes('RECON') ||
                        item.taskId === 'ops_open_04' ||
                        item.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU MS') ||
                        item.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU EOD') ||
                        item.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU CQG') ||
                        item.taskNameSnapshot.toUpperCase().includes('XỬ LÝ SAU EOD') ||
                        item.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU KHỚP LỆNH')) && !isCompleted && (

                        <button
                          onClick={() => onOpenReconciliation(item.taskId)}
                          className="btn btn-secondary animate-fade-in"
                          style={{
                            marginTop: '8px',
                            padding: '4px 10px',
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

                      {/* Margin Checker Button */}
                      {(item.taskId.toUpperCase().includes('MARGIN') ||
                        item.taskId.toUpperCase().includes('KYQUY') ||
                        item.taskNameSnapshot.toUpperCase().includes('MARGIN') ||
                        item.taskNameSnapshot.toUpperCase().includes('KÝ QUỸ')) && !isCompleted && (

                        <button
                          onClick={onOpenMarginChecker}
                          className="btn btn-secondary animate-fade-in"
                          style={{
                            marginTop: '8px',
                            padding: '4px 10px',
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

                      {/* CCP Statistics Button */}
                      {(item.taskId.toUpperCase().includes('CCP') ||
                        item.taskId.toUpperCase().includes('STATISTICS') ||
                        item.taskNameSnapshot.toUpperCase().includes('THỐNG KÊ CCP')) && !isCompleted && (

                        <button
                          onClick={onOpenCcpStatistics}
                          className="btn btn-secondary animate-fade-in"
                          style={{
                            marginTop: '8px',
                            padding: '4px 10px',
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

                      {/* Trading Report Button */}
                      {(item.taskId.toUpperCase().includes('REPORT') ||
                        item.taskId.toUpperCase().includes('TRADING') ||
                        item.taskNameSnapshot.toUpperCase().includes('BÁO CÁO GIAO DỊCH') ||
                        item.taskNameSnapshot.toUpperCase().includes('TRADING REPORT')) && !isCompleted && (

                        <button
                          onClick={onOpenTradingReport}
                          className="btn btn-secondary animate-fade-in"
                          style={{
                            marginTop: '8px',
                            padding: '4px 10px',
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

                      {/* OMS Status & Email Status Button */}
                      {(item.taskId === 'ops_open_02' ||
                        item.taskId === 'ops_open_07' ||
                        item.taskNameSnapshot.toUpperCase().includes('EOD OMS') ||
                        item.taskNameSnapshot.toUpperCase().includes('OMS EOD') ||
                        item.taskNameSnapshot.toUpperCase().includes('OMS STATUS')) && !isCompleted && (
                        <button
                          onClick={() => onOpenOmsStatus(item.taskId)}
                          className="btn btn-secondary animate-fade-in"
                          style={{
                            marginTop: '8px',
                            marginLeft: '4px',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: item.taskId === 'ops_open_07' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(236, 72, 153, 0.08)',
                            color: item.taskId === 'ops_open_07' ? '#3b82f6' : '#ec4899',
                            border: item.taskId === 'ops_open_07' ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(236, 72, 153, 0.2)',
                          }}
                        >
                          {item.taskId === 'ops_open_07' ? (
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
                    </div>
                  </div>

                  {/* Status Selector Dropdown */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => {
                        if (isCompleted || locked || isSaving || isToggling) return;
                        setOpenStatusDropdownTaskId(openStatusDropdownTaskId === item.taskId ? null : item.taskId);
                      }}
                      disabled={isCompleted || locked || isSaving || isToggling}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: (isCompleted || locked || isSaving || isToggling) ? 'not-allowed' : 'pointer',
                        background: currentStatusConfig.bgColor,
                        color: currentStatusConfig.color,
                        border: `1px solid ${currentStatusConfig.borderColor}`,
                        transition: 'all 0.2s ease',
                        minWidth: '140px',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <StatusIcon
                           size={14}
                           className={item.status === 'WAITING' ? 'animate-pulse animate-spin-slow' : ''}
                        />
                        {currentStatusConfig.label}
                      </span>
                      {!isCompleted && !locked && <ChevronDown size={12} />}
                    </button>

                    {/* Dropdown Options List */}
                    {openStatusDropdownTaskId === item.taskId && (
                      <>
                        <div
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                          onClick={() => setOpenStatusDropdownTaskId(null)}
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

              {/* Sub-tasks accordion */}
              {hasChildren && isExpanded && (
                <div style={{
                  display: 'flex', flexDirection: 'column', gap: '6px',
                  background: 'rgba(139,92,246,0.03)', borderRadius: '0 0 12px 12px',
                  border: '1px solid rgba(139,92,246,0.15)', borderTop: 'none',
                  padding: '8px 12px 12px 12px'
                }}>
                  {children.sort((a,b) => ((a as any).sortOrder||0) - ((b as any).sortOrder||0)).map(child => {
                    const isBot = child.isBotCheckSnapshot;
                    const cStatus = child.status || 'PENDING';
                    const cConfig = STATUS_CONFIGS[cStatus] || STATUS_CONFIGS.PENDING;
                    const CIcon = cConfig.icon;
                    const cSaving = savingTaskId === child.taskId;
                    const cToggling = togglingTaskIds.has(child.taskId);
                    return (
                      <div key={child.taskId} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 12px', borderRadius: '8px',
                        background: child.isChecked
                          ? 'rgba(16,185,129,0.05)'
                          : isBot ? 'rgba(236,72,153,0.04)' : 'rgba(255,255,255,0.03)',
                        border: child.isChecked
                          ? '1px solid rgba(16,185,129,0.15)'
                          : isBot ? '1px solid rgba(236,72,153,0.15)' : '1px solid var(--border-color)',
                        opacity: cToggling ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}>
                        {/* Bot or Maker indicator */}
                        {isBot ? (
                          <span title="Bot tự động check" style={{ flexShrink: 0 }}>
                            <Cpu size={15} color={child.isChecked ? '#10b981' : '#ec4899'} />
                          </span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={child.isChecked}
                            onChange={() => handleToggle(child.taskId, child.isChecked)}
                            disabled={isCompleted || cSaving || cToggling}
                            style={{
                              width: '16px', height: '16px', flexShrink: 0,
                              cursor: (isCompleted || cToggling) ? 'not-allowed' : 'pointer',
                              accentColor: 'var(--color-primary)'
                            }}
                          />
                        )}
                        <span style={{ flex: 1, fontSize: '0.83rem', color: 'var(--text-primary)', textDecoration: child.isChecked ? 'line-through' : 'none', opacity: child.isChecked ? 0.6 : 1 }}>
                          {child.taskNameSnapshot}
                        </span>
                        {/* Bot/Maker role badge */}
                        {isBot ? (
                          <span style={{ display:'inline-flex',alignItems:'center',gap:'3px', background:'rgba(236,72,153,0.1)', color:'#ec4899', borderRadius:'4px', padding:'1px 6px', fontSize:'0.68rem', fontWeight:700, flexShrink:0 }}>
                            <Cpu size={9}/> Bot
                          </span>
                        ) : (
                          <span style={{ display:'inline-flex',alignItems:'center',gap:'3px', background:'rgba(59,130,246,0.1)', color:'#3b82f6', borderRadius:'4px', padding:'1px 6px', fontSize:'0.68rem', fontWeight:700, flexShrink:0 }}>
                            <UserCheck size={9}/> Maker
                          </span>
                        )}
                        {/* Sub-task status */}
                        <span style={{ display:'inline-flex',alignItems:'center',gap:'4px', fontSize:'0.72rem', fontWeight:600, color: cConfig.color, background: cConfig.bgColor, padding:'1px 7px', borderRadius:'5px', border:`1px solid ${cConfig.borderColor}`, flexShrink:0 }}>
                          <CIcon size={11}/> {cConfig.label}
                        </span>
                        {/* Status dropdown for Maker sub-tasks */}
                        {!isBot && !isCompleted && (
                          <button
                            onClick={() => setOpenStatusDropdownTaskId(openStatusDropdownTaskId === child.taskId ? null : child.taskId)}
                            disabled={isCompleted || cSaving || cToggling}
                            style={{ background:'transparent', border:'1px solid var(--border-color)', borderRadius:'6px', padding:'2px 6px', cursor:'pointer', flexShrink:0 }}
                            title="Đổi trạng thái"
                          >
                            <ChevronDown size={12} color="var(--text-muted)" />
                          </button>
                        )}
                        {openStatusDropdownTaskId === child.taskId && (
                          <>
                            <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:999 }} onClick={() => setOpenStatusDropdownTaskId(null)} />
                            <div style={{ position:'absolute', right:0, background:'var(--bg-card)', border:'1px solid var(--border-color)', borderRadius:'10px', boxShadow:'var(--glass-shadow)', zIndex:1000, minWidth:'160px', padding:'4px', display:'flex', flexDirection:'column' }}>
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
              )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
