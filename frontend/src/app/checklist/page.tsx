'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePermissions } from '@/hooks/usePermissions';
import {
  Clock,
  User as UserIcon,
  Lock,
  Unlock,
  UserCheck,
  CheckCircle2,
  Download,
  Printer,
  AlertCircle,
  FileSpreadsheet,
  Cpu
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
import CcpStatisticsModal from './components/CcpStatisticsModal';
import TradingReportModal from './components/TradingReportModal';
import OmsStatusModal from './components/OmsStatusModal';
import MaturityTemplateModal from './components/MaturityTemplateModal';
import BotLogViewerModal from '@/components/ui/BotLogViewerModal';
import CloseShiftModal from './components/CloseShiftModal';

function ChecklistWorksheet() {
  const { canViewChecklist } = usePermissions();
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
    togglingTaskIds,
    loadLogDetail,
  } = useChecklist();

  const [isReconModalOpen, setIsReconModalOpen] = React.useState(false);
  const [isMarginModalOpen, setIsMarginModalOpen] = React.useState(false);
  const [isCcpModalOpen, setIsCcpModalOpen] = React.useState(false);
  const [isTradingReportModalOpen, setIsTradingReportModalOpen] = React.useState(false);
  const [isOmsModalOpen, setIsOmsModalOpen] = React.useState(false);
  const [isMaturityModalOpen, setIsMaturityModalOpen] = React.useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = React.useState(false);
  const [reconTaskId, setReconTaskId] = React.useState('');
  const [omsTaskId, setOmsTaskId] = React.useState('');
  const [viewingBotLog, setViewingBotLog] = React.useState<{ title: string; resultNote: string; status?: string; checkedAt?: string; taskId?: string } | null>(null);
  const [showTechDetails, setShowTechDetails] = React.useState(false);
  const [printTemplate] = React.useState<'OLD'>('OLD');

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const openQlgdPrint = () => {
    if (shiftLogId) {
      window.open(`/checklist/print?id=${shiftLogId}`, '_blank');
    }
  };

  const router = useRouter();
  const searchParams = useSearchParams();

  const taskNamesMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    if (log && log.details) {
      log.details.forEach((task: any) => {
        map[task.taskId] = task.taskNameSnapshot;
      });
    }
    return map;
  }, [log]);

  React.useEffect(() => {
    const bypassRedirect = searchParams.get('redirect') === 'false';
    if (!shiftLogId && activeLogs.length > 0 && !bypassRedirect) {
      const pending = activeLogs.find((item) => item.status !== 'COMPLETED');
      if (pending) {
        router.push(`/checklist?id=${pending._id}`);
      } else {
        router.push(`/checklist?id=${activeLogs[0]._id}`);
      }
    }
  }, [shiftLogId, activeLogs, router, searchParams]);

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Má»Ÿ Cá»­a</span>;
      case 'DURING': return <span className="badge badge-medium">Trong PhiÃªn</span>;
      default: return <span className="badge badge-high">ÄÃ³ng Cá»­a</span>;
    }
  };

  // Render permission check
  if (!canViewChecklist) {
    return (
      <div className="glass-panel no-print" style={{
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <AlertCircle size={40} color="var(--color-critical)" />
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>KhÃ´ng cÃ³ quyá»n truy cáº­p</p>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>TÃ i khoáº£n cá»§a báº¡n khÃ´ng cÃ³ quyá»n xem checklist ca trá»±c.</p>
        <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '8px' }}>
          Quay láº¡i báº£ng Ä‘iá»u khiá»ƒn
        </Link>
      </div>
    );
  }

  // Render loading skeleton
  if ((loading || (shiftLogId && !loadError)) && !log) {
    const isGrid = !shiftLogId;
    return (
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes skeleton-shimmer {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.25; }
          }
          .skeleton-pulse {
            animation: skeleton-shimmer 1.8s ease-in-out infinite;
            background-color: var(--border-color);
            opacity: 0.8;
            border-radius: 6px;
          }
          `
        }} />
        {isGrid ? (
          // Card Grid Skeleton
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="skeleton-pulse" style={{ width: '220px', height: '28px' }}></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton-pulse" style={{ width: '120px', height: '24px' }}></div>
                    <div className="skeleton-pulse" style={{ width: '80px', height: '20px' }}></div>
                  </div>
                  <div className="skeleton-pulse" style={{ width: '100%', height: '16px' }}></div>
                  <div className="skeleton-pulse" style={{ width: '60%', height: '16px' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                    <div className="skeleton-pulse" style={{ width: '80px', height: '24px' }}></div>
                    <div className="skeleton-pulse" style={{ width: '100px', height: '36px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          // Worksheet Skeleton
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Navigation Breadcrumb Skeleton */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="skeleton-pulse" style={{ width: '180px', height: '18px' }}></div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <div className="skeleton-pulse" style={{ width: '120px', height: '36px' }}></div>
                <div className="skeleton-pulse" style={{ width: '120px', height: '36px' }}></div>
              </div>
            </div>

            {/* Shift Banner Skeleton */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="skeleton-pulse" style={{ width: '320px', height: '32px' }}></div>
                <div className="skeleton-pulse" style={{ width: '80px', height: '24px' }}></div>
              </div>
              <div style={{ display: 'flex', gap: '24px' }}>
                <div className="skeleton-pulse" style={{ width: '150px', height: '18px' }}></div>
                <div className="skeleton-pulse" style={{ width: '150px', height: '18px' }}></div>
                <div className="skeleton-pulse" style={{ width: '150px', height: '18px' }}></div>
              </div>
            </div>

            {/* Task Grid Skeleton */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skeleton-pulse" style={{ width: '200px', height: '32px' }}></div>
                <div className="skeleton-pulse" style={{ width: '150px', height: '32px' }}></div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="skeleton-pulse" style={{ width: '24px', height: '24px', borderRadius: '4px' }}></div>
                    <div className="skeleton-pulse" style={{ flex: 1, height: '20px' }}></div>
                    <div className="skeleton-pulse" style={{ width: '80px', height: '20px' }}></div>
                    <div className="skeleton-pulse" style={{ width: '100px', height: '20px' }}></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
      <div className="glass-panel no-print" style={{
        padding: '40px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px'
      }}>
        <AlertCircle size={40} color="var(--color-critical)" />
        <p style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>Lá»—i táº£i ca trá»±c</p>
        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{loadError || 'Vui lÃ²ng kiá»ƒm tra láº¡i Ä‘Æ°á»ng dáº«n.'}</p>
        <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '8px' }}>
          Quay láº¡i báº£ng Ä‘iá»u khiá»ƒn
        </Link>
      </div>
    );
  }

  const isCompleted = log.status === 'COMPLETED';

  return (
    <>
      {loading && log && <div className="loading-bar" />}
      {/* Dynamic Print Stylesheet injection & Custom Keyframes */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes loading-bar-shim {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .loading-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--color-accent) 0%, #10b981 50%, var(--color-accent) 100%);
          background-size: 200% 100%;
          animation: loading-bar-shim 1.5s infinite linear;
          z-index: 9999;
        }
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
          .print-container-qlgd {
            font-family: "Times New Roman", Times, serif, sans-serif;
            color: #000 !important;
            padding: 15px;
            background: #fff !important;
            line-height: 1.3;
          }
          .print-page-front {
            page-break-after: always;
            break-after: page;
          }
          .print-page-back {
            page-break-inside: avoid;
          }
          .qlgd-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            margin-bottom: 15px;
            font-size: 0.82rem;
          }
          .qlgd-table th, .qlgd-table td {
            border: 1px solid #000 !important;
            padding: 4px 6px;
            text-align: left;
            color: #000 !important;
            vertical-align: middle;
          }
          .qlgd-table th {
            background-color: #f3f4f6 !important;
            font-weight: bold;
            text-align: center;
          }
          .print-signature-section-3 {
            margin-top: 25px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            text-align: center;
            font-size: 0.9rem;
          }
          .qlgd-section-title {
            font-size: 0.92rem;
            font-weight: bold;
            margin-top: 15px;
            margin-bottom: 6px;
            text-transform: uppercase;
            border-bottom: 1px solid #000;
            padding-bottom: 2px;
            color: #000 !important;
          }
          .crossed-out {
            background: linear-gradient(to top right, transparent 49.5%, #000 49.5%, #000 50.5%, transparent 50.5%),
                        linear-gradient(to bottom right, transparent 49.5%, #000 49.5%, #000 50.5%, transparent 50.5%) !important;
            position: relative;
          }
          .cursive-signature {
            font-family: 'Courier New', Courier, monospace;
            font-style: italic;
            font-weight: bold;
            font-size: 1.1rem;
            color: #1e3a8a;
          }
        }
        .print-only {
          display: none;
        }
      `}} />

      {/* Screen view wrapper (hidden on print via no-print class) */}
      <div className="animate-fade-in no-print" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '24px',
        opacity: loading ? 0.6 : 1,
        transition: 'opacity 0.25s ease-in-out',
        pointerEvents: loading ? 'none' : 'auto'
      }}>

        {/* Navigation Breadcrumb & Live Socket status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Báº£ng Ä‘iá»u khiá»ƒn</Link>
              <span style={{ margin: '0 8px' }}>/</span>
              {shiftLogId ? (
                <>
                  <Link href="/checklist?redirect=false" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Danh sÃ¡ch ca trá»±c</Link>
                  <span style={{ margin: '0 8px' }}>/</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Chi tiáº¿t ca trá»±c</span>
                </>
              ) : (
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Danh sÃ¡ch ca trá»±c</span>
              )}
            </div>

            {activeLogs.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>| Chuyá»ƒn nhanh ca:</span>
                <select
                  value={shiftLogId || ''}
                  onChange={(e) => router.push(`/checklist?id=${e.target.value}`)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {activeLogs.map((item, idx) => (
                    <option key={`${item._id}-${idx}`} value={item._id}>
                      {item.templateId?.title} ({item.shiftDate}) {item.status === 'COMPLETED' ? '[ÄÃ£ chá»‘t]' : '[Äang cháº¡y]'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setShowTechDetails(!showTechDetails)} 
              className={`btn ${showTechDetails ? 'btn-primary' : 'btn-secondary'}`} 
              style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Cpu size={14} />
              {showTechDetails ? 'áº¨n mÃ£ ká»¹ thuáº­t' : 'Xem mÃ£ ká»¹ thuáº­t'}
            </button>
            <button onClick={() => setIsTradingReportModalOpen(true)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={14} /> BÃ¡o cÃ¡o Giao dá»‹ch
            </button>
            <button onClick={exportToExcel} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px' }}>
              <Download size={14} /> Xuáº¥t file Excel
            </button>
            <button onClick={() => handlePrint()} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Printer size={14} /> In BiÃªn Báº£n (PDF)
            </button>
            <button onClick={openQlgdPrint} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem', height: '36px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0d9488', color: '#fff', border: 'none' }}>
              <Printer size={14} /> In Phiáº¿u QLGD (PDF)
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
                <Clock size={15} /> NgÃ y trá»±c: <strong style={{ color: 'var(--text-primary)' }}>{log.shiftDate}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={15} /> Trá»±c chÃ­nh: <strong style={{ color: 'var(--text-primary)' }}>{log.userId?.fullName}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isCompleted ? <Lock size={15} color="var(--color-primary)" /> : <Unlock size={15} color="var(--color-accent)" />}
                Tráº¡ng thÃ¡i:
                {isCompleted ? (
                  <strong style={{ color: 'var(--color-primary)' }}>ÄÃƒ CHá»T</strong>
                ) : (
                  <strong style={{ color: 'var(--color-accent)' }}>ÄANG TRá»°C</strong>
                )}
              </span>
              {isCompleted && log.closedBy && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} color="var(--color-primary)" /> NgÆ°á»i chá»‘t: <strong style={{ color: 'var(--text-primary)' }}>{log.closedBy.fullName}</strong>
                </span>
              )}
            </div>
            {isCompleted && log.handoverNote && (
              <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '10px', borderLeft: '4px solid var(--color-primary)', maxWidth: '700px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>BiÃªn báº£n bÃ n giao ca trá»±c:</span>
                <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.88rem', fontStyle: 'italic', lineHeight: '1.4' }}>"{log.handoverNote}"</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Tiáº¿n Ä‘á»™ ca trá»±c</div>
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
              <button onClick={() => setIsCloseShiftModalOpen(true)} className="btn btn-success" style={{ padding: '10px 18px', height: '40px', fontSize: '0.85rem' }}>
                <CheckCircle2 size={16} /> Chá»‘t Ca Trá»±c
              </button>
            )}
          </div>
        </div>



        {/* Workspace Layout: Full width checklist, bottom side-by-side widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Top Panel: Checklist Tasks */}
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
            togglingTaskIds={togglingTaskIds}
            onOpenReconciliation={(tid) => {
              setReconTaskId(tid);
              setIsReconModalOpen(true);
            }}
            onOpenMarginChecker={() => setIsMarginModalOpen(true)}
            onOpenCcpStatistics={() => setIsCcpModalOpen(true)}
            onOpenTradingReport={() => setIsTradingReportModalOpen(true)}
            onOpenOmsStatus={(tid) => {
              setOmsTaskId(tid);
              setIsOmsModalOpen(true);
            }}
            onOpenMaturityTemplates={() => setIsMaturityModalOpen(true)}
            onOpenBotLogViewer={(title, resultNote, status, checkedAt, taskId) => {
              if (taskId === 'ops_open_02' || taskId === 'ops_open_07') {
                setOmsTaskId(taskId);
                setIsOmsModalOpen(true);
              } else {
                setViewingBotLog({ title, resultNote, status, checkedAt, taskId });
              }
            }}
            showTechDetails={showTechDetails}
          />

          {/* Bottom Layout Grid: Incident Manager & Audit Trail */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Incident Manager Panel */}
            <IncidentList
              incidents={incidents}
              isCompleted={isCompleted}
              setRootCause={setRootCause}
              setRemediationAction={setRemediationAction}
              setAffectedAccountsInput={setAffectedAccountsInput}
              setResolvingIncident={setResolvingIncident}
              showTechDetails={showTechDetails}
              taskNamesMap={taskNamesMap}
            />

            {/* Audit Trail Timeline */}
            <AuditLogsPanel 
              auditLogs={auditLogs} 
              showTechDetails={showTechDetails}
              taskNamesMap={taskNamesMap}
            />

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
        showTechDetails={showTechDetails}
        taskNamesMap={taskNamesMap}
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

      {isCcpModalOpen && (
        <CcpStatisticsModal
          isOpen={isCcpModalOpen}
          onClose={() => setIsCcpModalOpen(false)}
          token={token || ''}
        />
      )}

      {isTradingReportModalOpen && (
        <TradingReportModal
          isOpen={isTradingReportModalOpen}
          onClose={() => setIsTradingReportModalOpen(false)}
          token={token || ''}
        />
      )}

      {isOmsModalOpen && log && (
        <OmsStatusModal
          isOpen={isOmsModalOpen}
          onClose={() => setIsOmsModalOpen(false)}
          token={token || ''}
          shiftLogId={log._id}
          taskId={omsTaskId}
          taskName={log.details?.find(d => d.taskId === omsTaskId)?.taskNameSnapshot || ''}
          resultNote={log.details?.find(d => d.taskId === omsTaskId)?.resultNote || ''}
          status={log.details?.find(d => d.taskId === omsTaskId)?.status || 'PENDING'}
          onTaskUpdated={() => {
            loadLogDetail(log._id);
          }}
        />
      )}

      {isCloseShiftModalOpen && (
        <CloseShiftModal
          isOpen={isCloseShiftModalOpen}
          onClose={() => setIsCloseShiftModalOpen(false)}
          onSubmit={handleCloseShift}
          isSubmitting={loading}
        />
      )}

      {isMaturityModalOpen && log && (
        <MaturityTemplateModal
          isOpen={isMaturityModalOpen}
          onClose={() => setIsMaturityModalOpen(false)}
          token={token || ''}
          shiftLogId={log._id}
          taskId="ops_during_05"
        />
      )}

      {/* PDF PRINT ONLY CONTAINER (Normally hidden, shown only in media print mode) */}
      {printTemplate === 'OLD' && (
        <div className="print-only print-container">
          <div className="print-header">
            <h1>Sá»ž GIAO Dá»ŠCH HÃ€NG HÃ“A VIá»†T NAM (MXV)</h1>
            <h2>BIÃŠN Báº¢N BÃ€N GIAO CA TRá»°C Váº¬N HÃ€NH</h2>
            <div style={{ width: '150px', height: '1px', background: '#000', margin: '0 auto 16px auto' }}></div>
          </div>

          <div className="print-meta-grid">
            <div><strong>BiÃªn báº£n ca:</strong> {log.templateId?.title}</div>
            <div><strong>NgÃ y trá»±c:</strong> {log.shiftDate}</div>
            <div><strong>PhÃ²ng ban:</strong> {log.templateId?.departmentId?.name || 'Váº­n HÃ nh Nghiá»‡p Vá»¥'}</div>
            <div><strong>Trá»±c chÃ­nh:</strong> {log.userId?.fullName}</div>
            <div><strong>Tiáº¿n Ä‘á»™ ca trá»±c:</strong> {log.progressPercentage}%</div>
            <div><strong>Tráº¡ng thÃ¡i:</strong> {log.status === 'COMPLETED' ? 'ÄÃƒ CHá»T CA' : 'ÄANG Váº¬N HÃ€NH'}</div>
            {log.handoverNote && (
              <div style={{ gridColumn: 'span 2', marginTop: '10px', padding: '8px', border: '1px dashed #000' }}>
                <strong>BiÃªn báº£n bÃ n giao ca trá»±c:</strong> <i>"{log.handoverNote}"</i>
              </div>
            )}
          </div>

          <table className="print-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>STT</th>
                <th style={{ width: '100px' }}>MÃ£ TÃ¡c Vá»¥</th>
                <th>Ná»™i Dung TÃ¡c Vá»¥</th>
                <th style={{ width: '80px' }}>Æ¯u TiÃªn</th>
                <th style={{ width: '80px' }}>Háº¡n ChÃ³t</th>
                <th style={{ width: '90px' }}>Tráº¡ng ThÃ¡i</th>
                <th style={{ width: '120px' }}>Thá»i Gian Kiá»ƒm</th>
                <th>Ghi ChÃº</th>
              </tr>
            </thead>
            <tbody>
              {log.details?.map((item, idx) => (
                <tr key={item.taskId}>
                  <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                  <td>{item.taskId}</td>
                  <td>{item.taskNameSnapshot}</td>
                  <td style={{ textAlign: 'center' }}>
                    {item.prioritySnapshot === 'LOW' && 'Tháº¥p'}
                    {item.prioritySnapshot === 'MEDIUM' && 'Trung BÃ¬nh'}
                    {item.prioritySnapshot === 'HIGH' && 'Cao'}
                    {item.prioritySnapshot === 'CRITICAL' && 'Kháº©n Cáº¥p'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{item.deadlineSnapshot || '-'}</td>
                  <td style={{ textAlign: 'center', fontWeight: item.isChecked ? 'bold' : 'normal' }}>
                    {item.isChecked ? 'ÄÃƒ KIá»‚M' : 'CHÆ¯A KIá»‚M'}
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
              <p><strong>NGÆ¯á»œI BÃ€N GIAO</strong></p>
              <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>(KÃ½ vÃ  ghi rÃµ há» tÃªn)</p>
              <div style={{ height: '80px' }}></div>
              <p>......................................................</p>
            </div>
            <div>
              <p><strong>NGÆ¯á»œI NHáº¬N BÃ€N GIAO</strong></p>
              <p style={{ fontSize: '0.8rem', fontStyle: 'italic', marginTop: '4px' }}>(KÃ½ vÃ  ghi rÃµ há» tÃªn)</p>
              <div style={{ height: '80px' }}></div>
              <p>......................................................</p>
            </div>
          </div>
        </div>
      )}


      {/* Bot Structured Log Viewer Modal */}
      {viewingBotLog && (
        <BotLogViewerModal
          isOpen={!!viewingBotLog}
          onClose={() => setViewingBotLog(null)}
          taskTitle={viewingBotLog.title}
          taskId={viewingBotLog.taskId}
          resultNote={viewingBotLog.resultNote}
          status={viewingBotLog.status}
          checkedAt={viewingBotLog.checkedAt}
          shiftLogId={shiftLogId}
        />
      )}
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>Äang táº£i ca trá»±c...</div>}>
      <ProtectedRoute>
        <ChecklistWorksheet />
      </ProtectedRoute>
    </Suspense>
  );
}
