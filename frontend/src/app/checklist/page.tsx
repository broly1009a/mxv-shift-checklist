'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Clock,
  User as UserIcon,
  Lock,
  Unlock,
  UserCheck,
  CheckCircle2,
  Download,
  Printer,
  AlertCircle
} from 'lucide-react';

import { useChecklist } from './hooks/useChecklist';
import ShiftCardGrid from './components/ShiftCardGrid';
import TaskTable from './components/TaskTable';
import IncidentList from './components/IncidentList';
import AuditLogsPanel from './components/AuditLogsPanel';
import IncidentReportModal from './components/IncidentReportModal';
import AdhocTaskModal from './components/AdhocTaskModal';
import ReconciliationModal from './components/ReconciliationModal';
import MarginCheckerModal from './components/MarginCheckerModal';

function ChecklistWorksheet() {
  const {
    user,
    token,
    shiftLogId,
    activeLogs,
    log,
    auditLogs,
    incidents,
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
  } = useChecklist();

  const [isReconModalOpen, setIsReconModalOpen] = React.useState(false);
  const [isMarginModalOpen, setIsMarginModalOpen] = React.useState(false);
  const [reconTaskId, setReconTaskId] = React.useState('');

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
      case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
      default: return <span className="badge badge-high">Đóng Cửa</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>
        Đang tải thông tin ca trực...
      </div>
    );
  }

  // View: No Shift ID specified
  if (!shiftLogId) {
    return <ShiftCardGrid activeLogs={activeLogs} />;
  }

  // View: Shift Worksheet details not found
  if (!log) {
    return (
      <div className="glass-panel no-print" style={{ padding: '40px', textAlign: 'center' }}>
        <AlertCircle size={40} color="var(--color-critical)" style={{ marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Lỗi tải ca trực</p>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{loadError || 'Vui lòng kiểm tra lại đường dẫn.'}</p>
        <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '20px' }}>
          Quay lại bảng điều khiển
        </Link>
      </div>
    );
  }

  const isCompleted = log.status === 'COMPLETED';

  return (
    <>
      {/* Dynamic Print Stylesheet injection & Custom Keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes pulse-dot {
          0% { transform: scale(0.9); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.9); opacity: 0.5; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .live-pulse-dot {
          width: 8px;
          height: 8px;
          background: #10b981;
          border-radius: 50%;
          display: inline-block;
          animation: pulse-dot 2s infinite ease-in-out;
        }
        .status-option-hover:hover {
          background: var(--border-color) !important;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
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
      `}} />

      {/* Screen view wrapper (hidden on print via no-print class) */}
      <div className="animate-fade-in no-print" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Navigation Breadcrumb & Live Socket status */}
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
              
              {/* Realtime Live Pulse */}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.08)',
                color: '#10b981',
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.15)',
                marginLeft: '8px'
              }}>
                <span className="live-pulse-dot"></span>
                LIVE
              </span>
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



        {/* Workspace Layout Grid: Left Checklist, Right Audit Logs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="lg:grid-cols-[1fr_360px]">

          {/* Left Panel: Checklist Tasks */}
          <TaskTable
            log={log}
            filteredDetails={filteredDetails}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            isCompleted={isCompleted}
            savingTaskId={savingTaskId}
            notesState={notesState}
            setNotesState={setNotesState}
            openStatusDropdownTaskId={openStatusDropdownTaskId}
            setOpenStatusDropdownTaskId={setOpenStatusDropdownTaskId}
            isTaskLocked={isTaskLocked}
            handleToggle={handleToggle}
            handleStatusChange={handleStatusChange}
            handleSaveNote={handleSaveNote}
            setIsAdhocModalOpen={setIsAdhocModalOpen}
            focusedTaskIdRef={focusedTaskIdRef}
            user={user}
            onOpenReconciliation={(taskId) => {
              setReconTaskId(taskId);
              setIsReconModalOpen(true);
            }}
            onOpenMarginChecker={() => setIsMarginModalOpen(true)}
          />

          {/* Right Column Layout: Incident Manager & Audit Trail */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Incident Manager Panel */}
            <IncidentList
              incidents={incidents}
              isCompleted={isCompleted}
              setRootCause={setRootCause}
              setRemediationAction={setRemediationAction}
              setAffectedAccountsInput={setAffectedAccountsInput}
              setResolvingIncident={setResolvingIncident}
            />

            {/* Audit Trail Timeline */}
            <AuditLogsPanel auditLogs={auditLogs} />

          </div>

        </div>

      </div>

      {/* Incident Resolution Modal */}
      <IncidentReportModal
        resolvingIncident={resolvingIncident}
        setResolvingIncident={setResolvingIncident}
        rootCause={rootCause}
        setRootCause={setRootCause}
        remediationAction={remediationAction}
        setRemediationAction={setRemediationAction}
        affectedAccountsInput={affectedAccountsInput}
        setAffectedAccountsInput={setAffectedAccountsInput}
        isResolving={isResolving}
        handleResolveIncident={handleResolveIncident}
      />

      {/* Ad-hoc Task Modal */}
      <AdhocTaskModal
        isAdhocModalOpen={isAdhocModalOpen}
        setIsAdhocModalOpen={setIsAdhocModalOpen}
        adhocTaskName={adhocTaskName}
        setAdhocTaskName={setAdhocTaskName}
        adhocPriority={adhocPriority}
        setAdhocPriority={setAdhocPriority}
        adhocDeadline={adhocDeadline}
        setAdhocDeadline={setAdhocDeadline}
        isSubmittingAdhoc={isSubmittingAdhoc}
        handleAddAdhocTask={handleAddAdhocTask}
      />

      {/* Reconciliation Modal */}
      {isReconModalOpen && (
        <ReconciliationModal
          isOpen={isReconModalOpen}
          onClose={() => setIsReconModalOpen(false)}
          shiftLogId={log._id}
          taskId={reconTaskId}
          taskName={log.details?.find(d => d.taskId === reconTaskId)?.taskNameSnapshot || ''}
          token={token || ''}
          onSuccess={() => {}}
        />
      )}

      {/* Margin Checker Modal */}
      {isMarginModalOpen && (
        <MarginCheckerModal
          isOpen={isMarginModalOpen}
          onClose={() => setIsMarginModalOpen(false)}
          shiftLogId={log._id}
          token={token || ''}
        />
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
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>Đang tải ca trực...</div>}>
      <ProtectedRoute>
        <ChecklistWorksheet />
      </ProtectedRoute>
    </Suspense>
  );
}
