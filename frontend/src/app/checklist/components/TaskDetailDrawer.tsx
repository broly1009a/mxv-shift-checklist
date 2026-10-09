'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Clock,
  UserCheck,
  Cpu,
  Lock,
  Unlock,
  Link2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  ChevronDown,
  Save,
  MessageSquare,
  Search,
  FileSpreadsheet,
  Copy,
  FolderOpen
} from 'lucide-react';
import { TaskDetail, ShiftLog } from '../hooks/useChecklist';

const STATUS_CONFIGS = {
  PENDING: {
    label: 'Chờ thực hiện',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
    icon: Clock,
  },
  WAITING: {
    label: 'Đang xử lý',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
    icon: Cpu,
  },
  PASSED: {
    label: 'Đạt',
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
    icon: CheckCircle2,
  },
  FAILED: {
    label: 'Không đạt',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    icon: XCircle,
  },
  SKIPPED: {
    label: 'Bỏ qua',
    color: '#60a5fa',
    bgColor: 'rgba(96, 165, 250, 0.1)',
    borderColor: 'rgba(96, 165, 250, 0.25)',
    icon: SkipForward,
  },
  NEEDS_ATTENTION: {
    label: 'Cần lưu ý',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    icon: AlertTriangle,
  },
};

interface TaskDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTask: TaskDetail | null;
  children: TaskDetail[];
  log: ShiftLog;
  isCompleted: boolean;
  savingTaskId: string | null;
  notesState: Record<string, string>;
  setNotesState: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  focusedTaskIdRef: React.MutableRefObject<string | null>;
  openStatusDropdownTaskId: string | null;
  setOpenStatusDropdownTaskId: (v: string | null) => void;
  isTaskLocked: (item: TaskDetail) => boolean;
  handleToggle: (taskId: string, currentStatus: boolean) => Promise<void>;
  handleStatusChange: (taskId: string, newStatus: string) => Promise<void>;
  handleSaveNote: (taskId: string) => Promise<void>;
  togglingTaskIds: Set<string>;
  showTechDetails?: boolean;
  onOpenReconciliation: (taskId: string) => void;
  onOpenMarginChecker: () => void;
  onOpenCcpStatistics: () => void;
  onOpenTradingReport: () => void;
  onOpenOmsStatus: (taskId: string) => void;
  onOpenMaturityTemplates?: () => void;
  onOpenBotLogViewer?: (title: string, resultNote: string, status?: string, checkedAt?: string, taskId?: string) => void;
}

export default function TaskDetailDrawer({
  isOpen,
  onClose,
  selectedTask,
  children,
  log,
  isCompleted,
  savingTaskId,
  notesState,
  setNotesState,
  focusedTaskIdRef,
  openStatusDropdownTaskId,
  setOpenStatusDropdownTaskId,
  isTaskLocked,
  handleToggle,
  handleStatusChange,
  handleSaveNote,
  togglingTaskIds,
  showTechDetails = false,
  onOpenReconciliation,
  onOpenMarginChecker,
  onOpenCcpStatistics,
  onOpenTradingReport,
  onOpenOmsStatus,
  onOpenMaturityTemplates,
  onOpenBotLogViewer,
}: TaskDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !selectedTask || !mounted) return null;

  const hasChildren = children.length > 0;
  const isBotOnly = selectedTask.isBotCheckSnapshot && !hasChildren;
  const currentStatus = selectedTask.status || 'PENDING';
  const currentStatusConfig = STATUS_CONFIGS[currentStatus as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS.PENDING;
  const StatusIcon = currentStatusConfig.icon;
  const locked = isTaskLocked(selectedTask);
  const isSaving = savingTaskId === selectedTask.taskId;
  const isToggling = togglingTaskIds.has(selectedTask.taskId);

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW':
        return <span className="badge badge-low">Ưu tiên Thấp</span>;
      case 'MEDIUM':
        return <span className="badge badge-medium">Ưu tiên Trung Bình</span>;
      case 'HIGH':
        return <span className="badge badge-high">Ưu tiên Cao</span>;
      default:
        return <span className="badge badge-critical">Khẩn Cấp</span>;
    }
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(4px)',
          zIndex: 9998,
          transition: 'opacity 0.2s ease',
        }}
      />

      {/* Slide-over Drawer Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '560px',
          background: 'var(--bg-card)',
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.45)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--border-color)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes slideInRight {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `
        }} />

        {/* Drawer Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 600 }}>
                #{selectedTask.taskId}
              </span>
              {getPriorityBadge(selectedTask.prioritySnapshot)}
              {isBotOnly && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '5px', padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                  <Cpu size={12} /> Tự động hóa
                </span>
              )}
            </div>

            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0', lineHeight: '1.4' }}>
              {selectedTask.taskNameSnapshot}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng ngăn chi tiết"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            className="hover:bg-white/5"
          >
            <X size={20} />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          {/* Quick Status Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: currentStatusConfig.bgColor,
              border: `1px solid ${currentStatusConfig.borderColor}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <StatusIcon size={16} color={currentStatusConfig.color} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: currentStatusConfig.color }}>
                Trạng thái: {currentStatusConfig.label}
              </span>
            </div>

            {/* Status Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  if (isCompleted || locked || isSaving || isToggling) return;
                  setOpenStatusDropdownTaskId(openStatusDropdownTaskId === selectedTask.taskId ? null : selectedTask.taskId);
                }}
                disabled={isCompleted || locked || isSaving || isToggling}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: (isCompleted || locked || isSaving || isToggling) ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <span>Đổi trạng thái</span>
                <ChevronDown size={12} />
              </button>

              {openStatusDropdownTaskId === selectedTask.taskId && (
                <>
                  <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1099 }}
                    onClick={() => setOpenStatusDropdownTaskId(null)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: '100%',
                      marginTop: '4px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      boxShadow: 'var(--glass-shadow)',
                      zIndex: 1100,
                      minWidth: '160px',
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
                          onClick={() => {
                            handleStatusChange(selectedTask.taskId, statusKey);
                            setOpenStatusDropdownTaskId(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: cfg.color,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '5px',
                            width: '100%',
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                          className="status-option-hover"
                        >
                          <OptIcon size={14} />
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons for this task */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {/* Reconciliation */}
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
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.25)', background: 'rgba(59, 130, 246, 0.08)' }}
              >
                <Search size={12} /> Mở bảng đối soát MS / CQG
              </button>
            )}

            {/* Trading Report */}
            {(selectedTask.taskId.toUpperCase().includes('BCGD') ||
              selectedTask.taskId.toUpperCase().includes('REPORT') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('BÁO CÁO GIAO DỊCH') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('BÁO CÁO BAN GIÁM SÁT')) && !isCompleted && (
              <button
                onClick={onOpenTradingReport}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.25)', background: 'rgba(56, 189, 248, 0.08)' }}
              >
                <FileSpreadsheet size={12} /> Báo cáo Giao dịch
              </button>
            )}

            {/* OMS Status */}
            {(selectedTask.taskId === 'ops_open_02' ||
              selectedTask.taskId === 'ops_open_07' ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('EOD OMS') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('OMS EOD') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('OMS STATUS')) && !isCompleted && (
              <button
                onClick={() => onOpenOmsStatus(selectedTask.taskId)}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#ec4899', border: '1px solid rgba(236, 72, 153, 0.25)', background: 'rgba(236, 72, 153, 0.08)' }}
              >
                <Cpu size={12} /> Kiểm tra OMS Status
              </button>
            )}

            {/* Maturity Template */}
            {(selectedTask.taskId === 'ops_during_05' ||
              selectedTask.taskId.toUpperCase().includes('MATURITY') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('TẤT TOÁN HỢP ĐỒNG') ||
              selectedTask.taskNameSnapshot.toUpperCase().includes('THÔNG BÁO ĐÁO HẠN')) && !isCompleted && (
              <button
                onClick={onOpenMaturityTemplates}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.25)', background: 'rgba(99, 102, 241, 0.08)' }}
              >
                <Copy size={12} /> Mẫu tin nhắn đáo hạn
              </button>
            )}
          </div>

          {/* Dependencies */}
          {selectedTask.dependsOnTaskIdsSnapshot && selectedTask.dependsOnTaskIdsSnapshot.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tác vụ phụ thuộc ràng buộc:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedTask.dependsOnTaskIdsSnapshot.map(depId => {
                  const depTask = log.details.find(d => d.taskId === depId);
                  const isDepDone = depTask ? depTask.isChecked : false;
                  return (
                    <span
                      key={depId}
                      style={{
                        fontSize: '0.74rem',
                        padding: '3px 8px',
                        borderRadius: '5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: isDepDone ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        color: isDepDone ? '#10b981' : '#ef4444',
                        border: `1px solid ${isDepDone ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                        fontWeight: 600,
                      }}
                    >
                      {isDepDone ? <Unlock size={11} /> : <Lock size={11} />}
                      Phụ thuộc: {showTechDetails ? depId : (depTask?.taskNameSnapshot || depId)} ({isDepDone ? 'Đã đạt' : 'Chưa đạt'})
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Metadata Grid (SLA, Timetable, File Path, Function URL) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Thông tin thực hiện
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              {selectedTask.timetableSnapshot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', fontSize: '0.76rem' }}>
                  <Clock size={13} color="var(--color-accent)" />
                  <span style={{ color: 'var(--text-muted)' }}>Khung giờ:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTask.timetableSnapshot}</span>
                </div>
              )}

              {selectedTask.slaDeadlineSnapshot && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', fontSize: '0.76rem' }}>
                  <Clock size={13} color="#f59e0b" />
                  <span style={{ color: 'var(--text-muted)' }}>Hạn hoàn thành:</span>
                  <span style={{ fontWeight: 600, color: '#f59e0b' }}>
                    {selectedTask.slaDeadlineSnapshot} {selectedTask.slaTypeSnapshot === 'DYNAMIC_AFTER_TASK' ? 'phút' : ''}
                  </span>
                </div>
              )}

              {selectedTask.fileLocationSnapshot && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', fontSize: '0.74rem', wordBreak: 'break-all' }}>
                  <FolderOpen size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Thư mục dữ liệu:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{selectedTask.fileLocationSnapshot}</span>
                </div>
              )}

              {selectedTask.functionUrlSnapshot && (
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-color)', fontSize: '0.74rem', wordBreak: 'break-all' }}>
                  <Link2 size={13} color="var(--color-accent)" style={{ flexShrink: 0 }} />
                  <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>Hệ thống liên kết:</span>
                  <a href={selectedTask.functionUrlSnapshot} target="_blank" rel="noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>
                    {selectedTask.functionUrlSnapshot}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Sub-tasks Section */}
          {hasChildren && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Đầu mục công việc con ({children.filter(c => c.isChecked).length} / {children.length} hoàn thành):
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {children
                  .sort((a, b) => ((a as any).sortOrder || 0) - ((b as any).sortOrder || 0))
                  .map((child, cIdx) => {
                    const isBot = child.isBotCheckSnapshot;
                    const cStatus = child.status || 'PENDING';
                    const cConfig = STATUS_CONFIGS[cStatus as keyof typeof STATUS_CONFIGS] || STATUS_CONFIGS.PENDING;
                    const CIcon = cConfig.icon;
                    const cLocked = isTaskLocked(child);

                    return (
                      <div
                        key={`${child.taskId}-${cIdx}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          background: child.isChecked ? 'rgba(16, 185, 129, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${child.isChecked ? 'rgba(16, 185, 129, 0.15)' : 'var(--border-color)'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={child.isChecked}
                            onChange={() => handleToggle(child.taskId, child.isChecked)}
                            disabled={isCompleted || cLocked}
                            style={{ width: '16px', height: '16px', cursor: (isCompleted || cLocked) ? 'not-allowed' : 'pointer' }}
                          />

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: child.isChecked ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: child.isChecked ? 'line-through' : 'none' }}>
                              {showTechDetails ? `[${child.taskId}] ` : ''}{child.taskNameSnapshot}
                            </span>
                            {isBot && (
                              <span style={{ fontSize: '0.68rem', color: '#ec4899', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <Cpu size={10} /> Bot tự động kiểm tra
                              </span>
                            )}
                          </div>
                        </div>

                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: cConfig.color,
                            background: cConfig.bgColor,
                            padding: '2px 8px',
                            borderRadius: '5px',
                            border: `1px solid ${cConfig.borderColor}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0,
                          }}
                        >
                          <CIcon size={11} />
                          {cConfig.label}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Notes Section */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MessageSquare size={13} color="var(--text-muted)" /> Ghi chú ca trực:
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <textarea
                className="form-input custom-scrollbar"
                rows={3}
                placeholder={isCompleted ? "Không thể ghi chú khi đã chốt ca" : "Nhập nội dung ghi chú..."}
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
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      background: 'rgba(59, 130, 246, 0.08)',
                      borderRadius: '6px',
                      fontWeight: 600,
                    }}
                  >
                    <Save size={12} />
                    {isSaving ? 'Đang lưu...' : 'Lưu ghi chú'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
