'use client';

import React from 'react';
import {
  Lock,
  Unlock,
  Clock,
  User as UserIcon,
  Link2,
  FileText,
  Cpu,
  ChevronDown,
  MessageSquare,
  Save,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  SkipForward,
  AlertTriangle
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
  user
}: TaskTableProps) {

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
        {filteredDetails.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px', color: 'var(--text-muted)' }}>
            Không tìm thấy tác vụ phù hợp với bộ lọc.
          </div>
        ) : (
          filteredDetails.map((item) => {
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
            );
          })
        )}
      </div>
    </div>
  );
}
