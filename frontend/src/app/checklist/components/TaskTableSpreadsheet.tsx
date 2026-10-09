'use client';

import React, { useState, useMemo, useRef } from 'react';
import {
  Clock,
  Cpu,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Save,
  Check,
  ChevronDown,
  Lock,
  Unlock,
  MessageSquare,
  SlidersHorizontal,
  FolderOpen,
  Link2,
  ExternalLink,
  Bot
} from 'lucide-react';
import { TaskDetail, ShiftLog } from '../hooks/useChecklist';
import TaskDetailDrawer from './TaskDetailDrawer';

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
    label: 'Chờ thực hiện',
    shortLabel: 'Chưa làm',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    icon: Clock,
  },
  WAITING: {
    label: 'Đang xử lý',
    shortLabel: 'Đang xử lý',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.08)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    icon: Cpu,
  },
  PASSED: {
    label: 'Đạt',
    shortLabel: 'Đạt',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    icon: CheckCircle2,
  },
  FAILED: {
    label: 'Không đạt',
    shortLabel: 'Không đạt',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    icon: XCircle,
  },
  SKIPPED: {
    label: 'Bỏ qua',
    shortLabel: 'Bỏ qua',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.08)',
    borderColor: 'rgba(96, 165, 250, 0.25)',
    icon: SkipForward,
  },
  NEEDS_ATTENTION: {
    label: 'Cần lưu ý',
    shortLabel: 'Cần lưu ý',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.08)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    icon: AlertTriangle,
  },
};

interface TaskTableSpreadsheetProps {
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
  showTechDetails?: boolean;
}

export default function TaskTableSpreadsheet({
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
  togglingTaskIds,
  showTechDetails = false,
}: TaskTableSpreadsheetProps) {
  // Drawer state for deep inspection
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);
  const [savedNoteTaskId, setSavedNoteTaskId] = useState<string | null>(null);

  // Build parent→children map
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

  // Children IDs set
  const childIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(childrenMap).flat().forEach(d => ids.add(d.taskId));
    return ids;
  }, [childrenMap]);

  // Main parent details list
  const parentDetails = useMemo(() =>
    filteredDetails.filter(d => !childIds.has(d.taskId)),
    [filteredDetails, childIds]
  );

  const selectedDrawerTask = useMemo(() => {
    if (!drawerTaskId) return null;
    return log.details?.find(d => d.taskId === drawerTaskId) || null;
  }, [drawerTaskId, log.details]);

  const selectedDrawerChildren = useMemo(() => {
    if (!drawerTaskId) return [];
    return childrenMap[drawerTaskId] || [];
  }, [drawerTaskId, childrenMap]);

  // Quick single-click toggle
  const handleQuickClickStatus = async (item: TaskDetail) => {
    if (isCompleted || isTaskLocked(item) || togglingTaskIds.has(item.taskId)) return;

    if (item.status === 'PASSED') {
      // Toggle back to PENDING
      await handleStatusChange(item.taskId, 'PENDING');
    } else {
      // 1-touch pass!
      await handleStatusChange(item.taskId, 'PASSED');
    }
  };

  // Inline note save on blur or enter
  const handleInlineNoteBlur = async (taskId: string) => {
    if (isCompleted || savingTaskId === taskId) return;
    await handleSaveNote(taskId);
    setSavedNoteTaskId(taskId);
    setTimeout(() => setSavedNoteTaskId(null), 2000);
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW':
        return <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8', border: '1px solid rgba(148, 163, 184, 0.2)', fontWeight: 600 }}>Thấp</span>;
      case 'MEDIUM':
        return <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', fontWeight: 600 }}>TB</span>;
      case 'HIGH':
        return <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)', fontWeight: 600 }}>Cao</span>;
      default:
        return <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', fontWeight: 700 }}>Khẩn</span>;
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Danh sách công việc
          </h3>
          <span style={{ fontSize: '0.74rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            {parentDetails.filter(p => p.isChecked || p.status === 'PASSED').length} / {parentDetails.length} hoàn thành
          </span>
        </div>

        {!isCompleted && (
          <button
            onClick={() => setIsAdhocModalOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '5px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={13} /> Thêm việc phát sinh
          </button>
        )}
      </div>

      {/* Filter and Search Bar: 1 clean horizontal row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'nowrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Tìm theo mã hoặc tên công việc..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              height: '34px',
              fontSize: '0.8rem',
              paddingLeft: '32px',
              paddingRight: '10px',
              borderRadius: '6px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              outline: 'none',
            }}
          />
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{
            height: '34px',
            fontSize: '0.8rem',
            padding: '0 10px',
            borderRadius: '6px',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            width: 'auto',
            minWidth: '140px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <option value="ALL">Tất cả mức ưu tiên</option>
          <option value="CRITICAL">Khẩn cấp</option>
          <option value="HIGH">Ưu tiên cao</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="LOW">Thấp</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: '34px',
            fontSize: '0.8rem',
            padding: '0 10px',
            borderRadius: '6px',
            background: 'var(--bg-card)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            width: 'auto',
            minWidth: '140px',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING">Chờ thực hiện</option>
          <option value="PASSED">Đạt</option>
          <option value="FAILED">Không đạt</option>
          <option value="NEEDS_ATTENTION">Cần lưu ý</option>
        </select>

        {(searchQuery || priorityFilter !== 'ALL' || statusFilter !== 'ALL') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setPriorityFilter('ALL');
              setStatusFilter('ALL');
            }}
            className="btn btn-secondary"
            style={{ height: '34px', padding: '0 12px', fontSize: '0.78rem', whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            Đặt lại
          </button>
        )}
      </div>

      {/* Spreadsheet Table View */}
      {parentDetails.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 0', border: '1px dashed var(--border-color)', borderRadius: '10px', color: 'var(--text-muted)' }}>
          <Search size={24} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
          <div style={{ fontSize: '0.85rem' }}>Không tìm thấy công việc phù hợp với bộ lọc.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }} className="custom-scrollbar">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '10px 12px', width: '44px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px 12px', width: '140px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Khung giờ & Hạn chót</th>
                <th style={{ padding: '10px 12px', minWidth: '260px', color: 'var(--text-secondary)', fontWeight: 600 }}>Nội dung công việc</th>
                <th style={{ padding: '10px 12px', width: '130px', color: 'var(--text-secondary)', fontWeight: 600 }}>Trạng thái</th>
                <th style={{ padding: '10px 12px', width: '140px', color: 'var(--text-secondary)', fontWeight: 600 }}>Kiểm tra tự động</th>
                <th style={{ padding: '10px 12px', width: '110px', color: 'var(--text-secondary)', fontWeight: 600 }}>Tác vụ</th>
                <th style={{ padding: '10px 12px', minWidth: '200px', color: 'var(--text-secondary)', fontWeight: 600 }}>Ghi chú</th>
                <th style={{ padding: '10px 8px', width: '64px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {parentDetails.map((item, idx) => {
                const children = childrenMap[item.taskId] || [];
                const hasChildren = children.length > 0;
                const isBotOnly = item.isBotCheckSnapshot && !hasChildren;
                const currentStatus = item.status || 'PENDING';
                const currentStatusConfig = STATUS_CONFIGS[currentStatus as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS.PENDING;
                const StatusIcon = currentStatusConfig.icon;
                const locked = isTaskLocked(item);
                const isSaving = savingTaskId === item.taskId;
                const isToggling = togglingTaskIds.has(item.taskId);
                const isDropdownOpen = openStatusDropdownTaskId === item.taskId;

                // Identify bot child if any
                const botChild = hasChildren
                  ? children.find(c => (c as any).isBotCheckSnapshot || (c as any).botCheckTypeSnapshot || (c.resultNote && c.resultNote.includes('{')))
                  : null;
                const effectiveResultNote = (item.resultNote && item.resultNote.includes('{'))
                  ? item.resultNote
                  : botChild?.resultNote || item.resultNote || '';
                const effectiveBotTaskId = botChild?.taskId || item.taskId;

                // Parse bot message clean
                let botShortSummary: string | null = null;
                let botStatusKind: 'success' | 'failed' | 'waiting' | null = null;

                if (effectiveResultNote || isBotOnly || botChild) {
                  if (item.status === 'WAITING' || botChild?.status === 'WAITING') {
                    botStatusKind = 'waiting';
                    botShortSummary = 'Đang kiểm tra...';
                  } else if (effectiveResultNote) {
                    try {
                      const json = JSON.parse(effectiveResultNote);
                      const rawMsg = json.message || effectiveResultNote;
                      botShortSummary = cleanAnsiText(rawMsg);
                    } catch {
                      botShortSummary = cleanAnsiText(effectiveResultNote);
                    }
                    botStatusKind = (item.status === 'FAILED' || botChild?.status === 'FAILED') ? 'failed' : 'success';
                  } else if (item.status === 'PASSED' || botChild?.status === 'PASSED') {
                    botStatusKind = 'success';
                    botShortSummary = 'Đã hoàn tất';
                  }
                }

                // Check dependencies
                const deps = item.dependsOnTaskIdsSnapshot || [];
                const hasUnmetDep = deps.some(depId => {
                  const depTask = log.details.find(d => d.taskId === depId);
                  return depTask ? !depTask.isChecked : false;
                });

                return (
                  <tr
                    key={item.taskId}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      background: item.status === 'PASSED'
                        ? 'rgba(16, 185, 129, 0.015)'
                        : item.status === 'FAILED'
                          ? 'rgba(239, 68, 68, 0.025)'
                          : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    className="hover:bg-white/[0.02]"
                  >
                    {/* STT */}
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                      #{idx + 1}
                    </td>

                    {/* Time & SLA */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {item.timetableSnapshot && (
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={11} color="var(--color-accent)" /> {item.timetableSnapshot}
                          </span>
                        )}

                        {item.slaDeadlineSnapshot && (
                          <span style={{ fontSize: '0.68rem', color: '#f59e0b', fontWeight: 600 }}>
                            Hạn chót: {item.slaDeadlineSnapshot}{item.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? ' phút' : ''}
                          </span>
                        )}

                        {!item.timetableSnapshot && !item.slaDeadlineSnapshot && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Task Name & Metadata */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            onClick={() => setDrawerTaskId(item.taskId)}
                            style={{
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              color: item.status === 'PASSED' ? 'var(--text-secondary)' : 'var(--text-primary)',
                              cursor: 'pointer',
                              textDecoration: 'none',
                              lineHeight: '1.35',
                            }}
                            className="hover:text-blue-400"
                            title="Click để xem chi tiết tác vụ"
                          >
                            {showTechDetails ? `[${item.taskId}] ` : ''}{item.taskNameSnapshot}
                          </span>

                          {getPriorityBadge(item.prioritySnapshot)}
                        </div>

                        {/* Subtasks summary & lock indicator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {hasChildren && (
                            <span
                              onClick={() => setDrawerTaskId(item.taskId)}
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                background: 'rgba(139, 92, 246, 0.08)',
                                color: '#8b5cf6',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {children.filter(c => c.isChecked).length}/{children.length} mục con
                            </span>
                          )}

                          {hasUnmetDep && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Lock size={9} /> Bị khóa bởi task trước
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status Button with Dropdown */}
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'inline-block', position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isCompleted || locked || isSaving || isToggling) return;
                            setOpenStatusDropdownTaskId(isDropdownOpen ? null : item.taskId);
                          }}
                          disabled={isCompleted || locked || isSaving || isToggling}
                          title="Nhấp để đổi trạng thái"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: (isCompleted || locked || isSaving || isToggling) ? 'not-allowed' : 'pointer',
                            background: currentStatusConfig.bgColor,
                            color: currentStatusConfig.color,
                            border: `1px solid ${currentStatusConfig.borderColor}`,
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                          }}
                          className="hover:opacity-85"
                        >
                          <StatusIcon size={13} className={item.status === 'WAITING' ? 'animate-spin-slow' : ''} />
                          <span>{currentStatusConfig.shortLabel}</span>
                          <ChevronDown size={11} style={{ opacity: 0.6 }} />
                        </button>

                        {/* Status Dropdown Popover */}
                        {isDropdownOpen && (
                          <>
                            <div
                              style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                              onClick={() => setOpenStatusDropdownTaskId(null)}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: '100%',
                                marginTop: '4px',
                                background: 'var(--bg-card)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                boxShadow: 'var(--glass-shadow)',
                                zIndex: 1000,
                                minWidth: '150px',
                                padding: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                              }}
                            >
                              {Object.entries(STATUS_CONFIGS).map(([statusKey, cfg]) => {
                                const OptIcon = cfg.icon;
                                return (
                                  <button
                                    key={statusKey}
                                    type="button"
                                    onClick={() => {
                                      handleStatusChange(item.taskId, statusKey);
                                      setOpenStatusDropdownTaskId(null);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '7px',
                                      padding: '6px 10px',
                                      fontSize: '0.74rem',
                                      fontWeight: 600,
                                      color: cfg.color,
                                      background: 'transparent',
                                      border: 'none',
                                      borderRadius: '4px',
                                      width: '100%',
                                      textAlign: 'left',
                                      cursor: 'pointer',
                                    }}
                                    className="status-option-hover"
                                  >
                                    <OptIcon size={12} />
                                    {cfg.label}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Clean Bot Result Mini Badge */}
                    <td style={{ padding: '10px 12px' }}>
                      {botStatusKind === 'waiting' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#3b82f6', fontWeight: 600 }}>
                          <Cpu size={12} className="animate-spin-slow" /> Đang chạy...
                        </span>
                      )}

                      {botStatusKind === 'success' && (
                        <button
                          type="button"
                          onClick={() => onOpenBotLogViewer?.(item.taskNameSnapshot, effectiveResultNote, item.status, item.checkedAt, effectiveBotTaskId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: 'rgba(16, 185, 129, 0.08)',
                            color: '#10b981',
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            cursor: 'pointer',
                          }}
                          title="Click để xem chi tiết kết quả Bot"
                        >
                          <CheckCircle2 size={11} /> Khớp 100%
                        </button>
                      )}

                      {botStatusKind === 'failed' && (
                        <button
                          type="button"
                          onClick={() => onOpenBotLogViewer?.(item.taskNameSnapshot, effectiveResultNote, item.status, item.checkedAt, effectiveBotTaskId)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '5px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#ef4444',
                            border: '1px solid rgba(239, 68, 68, 0.25)',
                            cursor: 'pointer',
                          }}
                          title="Click để xem chi tiết lỗi/lệch"
                        >
                          <AlertTriangle size={11} /> Lệch / Lỗi
                        </button>
                      )}

                      {!botStatusKind && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                      )}
                    </td>

                    {/* Quick Action Buttons */}
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        {/* Reconciliation Action */}
                        {(item.taskId.toUpperCase().includes('KLGD') ||
                          item.taskId.toUpperCase().includes('EOD') ||
                          item.taskId.toUpperCase().includes('CQG') ||
                          item.taskId.toUpperCase().includes('RECON') ||
                          item.taskId === 'ops_open_04' ||
                          item.taskNameSnapshot.toUpperCase().includes('ĐỐI CHIẾU')) && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => onOpenReconciliation(item.taskId)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              background: 'rgba(59, 130, 246, 0.08)',
                              color: '#3b82f6',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Search size={10} /> Đối soát
                          </button>
                        )}

                        {/* Trading Report Action */}
                        {(item.taskId.toUpperCase().includes('BCGD') ||
                          item.taskId.toUpperCase().includes('REPORT') ||
                          item.taskNameSnapshot.toUpperCase().includes('BÁO CÁO GIAO DỊCH')) && !isCompleted && (
                          <button
                            type="button"
                            onClick={onOpenTradingReport}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              background: 'rgba(56, 189, 248, 0.08)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.2)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <FileSpreadsheet size={10} /> Báo cáo
                          </button>
                        )}

                        {/* OMS Status Action */}
                        {(item.taskId === 'ops_open_02' ||
                          item.taskId === 'ops_open_07' ||
                          item.taskNameSnapshot.toUpperCase().includes('OMS')) && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => onOpenOmsStatus(item.taskId)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              borderRadius: '4px',
                              background: 'rgba(236, 72, 153, 0.08)',
                              color: '#ec4899',
                              border: '1px solid rgba(236, 72, 153, 0.2)',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Cpu size={10} /> OMS
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Inline Editable Note Cell (Auto-save on blur) */}
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder={isCompleted ? "" : "Click để ghi chú..."}
                          value={notesState[item.taskId] || ''}
                          onChange={(e) => setNotesState({ ...notesState, [item.taskId]: e.target.value })}
                          onFocus={() => { focusedTaskIdRef.current = item.taskId; }}
                          onBlur={() => {
                            focusedTaskIdRef.current = null;
                            handleInlineNoteBlur(item.taskId);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          disabled={isCompleted || isSaving}
                          style={{
                            width: '100%',
                            fontSize: '0.76rem',
                            padding: '4px 24px 4px 6px',
                            borderRadius: '4px',
                            background: 'transparent',
                            color: 'var(--text-primary)',
                            border: '1px solid transparent',
                            outline: 'none',
                            transition: 'all 0.15s ease',
                          }}
                          className="hover:border-white/10 focus:border-blue-500/40 focus:bg-white/[0.02]"
                        />

                        {/* Saved Checkmark Indicator */}
                        {savedNoteTaskId === item.taskId && (
                          <Check size={12} color="#10b981" style={{ position: 'absolute', right: '6px', pointerEvents: 'none' }} />
                        )}
                        {isSaving && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', position: 'absolute', right: '6px' }}>...</span>
                        )}
                      </div>
                    </td>

                    {/* Open Detail Drawer Button */}
                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => setDrawerTaskId(item.taskId)}
                        title="Xem chi tiết công việc"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-secondary)',
                          padding: '4px 8px',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.74rem',
                          fontWeight: 500,
                          transition: 'all 0.15s ease',
                        }}
                        className="hover:text-white hover:bg-white/10"
                      >
                        <ExternalLink size={12} />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Drawer for full task details */}
      <TaskDetailDrawer
        isOpen={Boolean(drawerTaskId)}
        onClose={() => setDrawerTaskId(null)}
        selectedTask={selectedDrawerTask}
        children={selectedDrawerChildren}
        log={log}
        isCompleted={isCompleted}
        savingTaskId={savingTaskId}
        notesState={notesState}
        setNotesState={setNotesState}
        focusedTaskIdRef={focusedTaskIdRef}
        openStatusDropdownTaskId={openStatusDropdownTaskId}
        setOpenStatusDropdownTaskId={setOpenStatusDropdownTaskId}
        isTaskLocked={isTaskLocked}
        handleToggle={handleToggle}
        handleStatusChange={handleStatusChange}
        handleSaveNote={handleSaveNote}
        togglingTaskIds={togglingTaskIds}
        showTechDetails={showTechDetails}
        onOpenReconciliation={onOpenReconciliation}
        onOpenMarginChecker={onOpenMarginChecker}
        onOpenCcpStatistics={onOpenCcpStatistics}
        onOpenTradingReport={onOpenTradingReport}
        onOpenOmsStatus={onOpenOmsStatus}
        onOpenMaturityTemplates={onOpenMaturityTemplates}
        onOpenBotLogViewer={onOpenBotLogViewer}
      />
    </div>
  );
}
