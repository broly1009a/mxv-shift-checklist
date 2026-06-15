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
  UserCheck
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
}

interface ShiftLog {
  _id: string;
  shiftDate: string;
  status: 'PENDING' | 'COMPLETED';
  progressPercentage: number;
  templateId: {
    _id: string;
    title: string;
    sessionType: 'OPEN' | 'DURING' | 'CLOSE';
    departmentId?: {
      _id: string;
      name: string;
      code: string;
    };
  };
  userId: {
    _id: string;
    fullName: string;
    username: string;
  };
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
  action: 'CHECK' | 'UNCHECK' | 'NOTE_UPDATE';
  details: string;
  createdAt: string;
}

function ChecklistWorksheet() {
  const { user, token } = useAuth();
  const searchParams = useSearchParams();
  const shiftLogId = searchParams.get('id');

  const [activeLogs, setActiveLogs] = useState<ShiftLog[]>([]);
  const [log, setLog] = useState<ShiftLog | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

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

  // Load baseline data
  useEffect(() => {
    if (shiftLogId) {
      loadLogDetail(shiftLogId);
      loadAuditLogs(shiftLogId);
    } else {
      loadActiveLogs();
      setLoading(false);
    }
  }, [shiftLogId, loadLogDetail, loadActiveLogs, loadAuditLogs]);

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
        
        // Sync local input values
        const notes: Record<string, string> = {};
        data.shiftLog.details.forEach(item => {
          notes[item.taskId] = item.note || '';
        });
        setNotesState(notes);
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

  const handleToggle = async (taskId: string, currentStatus: boolean) => {
    if (!log || log.status === 'COMPLETED' || !token) return;
    setSavingTaskId(taskId);
    setActionError('');
    setActionSuccess('');
    
    const isChecked = !currentStatus;
    const note = notesState[taskId] || '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/items/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shiftLogId: log._id,
          taskId,
          isChecked,
          note
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Cập nhật tác vụ thất bại');
      }

      const updated: ShiftLog = await res.json();
      setLog(updated);
      setActionSuccess('Cập nhật trạng thái tác vụ thành công.');
    } catch (err: any) {
      setActionError(err.message || 'Có lỗi xảy ra');
    } finally {
      setSavingTaskId(null);
    }
  };

  const handleSaveNote = async (taskId: string) => {
    if (!log || log.status === 'COMPLETED' || !token) return;
    setSavingTaskId(taskId);
    setActionError('');
    setActionSuccess('');

    const targetItem = log.details.find(d => d.taskId === taskId);
    const isChecked = targetItem ? targetItem.isChecked : false;
    const note = notesState[taskId] || '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/items/toggle`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          shiftLogId: log._id,
          taskId,
          isChecked,
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
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Bảng Vận Hành Ca Trực
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Chọn một ca trực đang mở dưới đây hoặc quay lại <Link href="/dashboard" style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>Bảng điều khiển</Link> để bắt đầu ca mới.
            </p>
          </div>

          <div className="glass-panel" style={{ padding: '28px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                {activeLogs.map(item => (
                  <div key={item._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '6px' }}>
                        {item.templateId.title}
                      </h4>
                      <span className="badge badge-medium">{item.templateId.sessionType}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <div>Trực ngày: <strong>{item.shiftDate}</strong></div>
                      <div>Phòng ban: <strong>{item.templateId.departmentId?.name}</strong></div>
                      <div>Người trực: <strong>{item.userId.fullName}</strong></div>
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
          <p style={{ color: '#fff', fontWeight: 700 }}>Lỗi tải ca trực</p>
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
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body, html, main, #__next, .app-layout-content {
            background: #fff !important;
            color: #000 !important;
          }
          .sidebar, .no-print {
            display: none !important;
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
      <div className="animate-fade-in no-print" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Navigation Breadcrumb */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Link href="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Bảng điều khiển</Link>
            <span style={{ margin: '0 8px' }}>/</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>Chi tiết ca trực</span>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={exportToExcel} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              <Download size={14} /> Xuất file Excel
            </button>
            <button onClick={triggerPrint} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              <Printer size={14} /> In Biên Bản (PDF)
            </button>
          </div>
        </div>

        {/* Shift log state banner */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              {log.templateId?.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> Ngày trực: <strong style={{ color: '#fff' }}>{log.shiftDate}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserIcon size={16} /> Trực chính: <strong style={{ color: '#fff' }}>{log.userId?.fullName}</strong>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isCompleted ? <Lock size={16} color="var(--color-primary)" /> : <Unlock size={16} color="var(--color-accent)" />}
                Trạng thái: 
                {isCompleted ? (
                  <strong style={{ color: 'var(--color-primary)' }}>ĐÃ CHỐT</strong>
                ) : (
                  <strong style={{ color: 'var(--color-accent)' }}>ĐANG TRỰC</strong>
                )}
              </span>
              {isCompleted && log.closedBy && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={16} color="var(--color-primary)" /> Người chốt: <strong style={{ color: '#fff' }}>{log.closedBy.fullName}</strong>
                </span>
              )}
              {isCompleted && log.closedAt && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="var(--color-primary)" /> Giờ chốt: <strong style={{ color: '#fff' }}>{new Date(log.closedAt).toLocaleTimeString('vi-VN')} {new Date(log.closedAt).toLocaleDateString('vi-VN')}</strong>
                </span>
              )}
            </div>
            {isCompleted && log.handoverNote && (
              <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)', maxWidth: '700px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 700 }}>Biên bản bàn giao ca trực:</span>
                <p style={{ margin: 0, color: '#fff', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: '1.4' }}>"{log.handoverNote}"</p>
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
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: isCompleted ? 'var(--color-primary)' : '#fff' }}>
                  {log.progressPercentage}%
                </span>
              </div>
            </div>

            {!isCompleted && (
              <button onClick={handleCloseShift} className="btn btn-success" style={{ padding: '12px 20px' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>
          
          {/* Left Panel: Checklist Tasks */}
          <div className="glass-panel" style={{ padding: '24px', overflow: 'visible' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--color-accent)" /> Danh sách tác vụ kiểm tra ({log.details?.length || 0} tác vụ)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {log.details?.map((item, index) => {
                const isSaving = savingTaskId === item.taskId;
                return (
                  <div key={item.taskId} className="glass-panel" style={{
                    padding: '20px',
                    borderRadius: '12px',
                    background: item.isChecked ? 'rgba(16, 185, 129, 0.02)' : 'rgba(255,255,255,0.008)',
                    borderLeft: item.isChecked ? '4px solid var(--color-primary)' : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    transition: 'all 0.2s ease'
                  }}>
                    {/* Task details bar */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <input
                          type="checkbox"
                          checked={item.isChecked}
                          onChange={() => handleToggle(item.taskId, item.isChecked)}
                          disabled={isCompleted || isSaving}
                          style={{
                            width: '20px',
                            height: '20px',
                            marginTop: '3px',
                            cursor: isCompleted ? 'not-allowed' : 'pointer',
                            accentColor: 'var(--color-primary)'
                          }}
                        />
                        <div>
                          <p style={{
                            fontSize: '1rem',
                            fontWeight: 600,
                            color: '#fff',
                            lineHeight: '1.4',
                            textDecoration: item.isChecked ? 'line-through' : 'none',
                            opacity: item.isChecked ? 0.7 : 1
                          }}>
                            {index + 1}. {item.taskNameSnapshot}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {getPriorityBadge(item.prioritySnapshot)}
                            {item.deadlineSnapshot && (
                              <span style={{ 
                                fontSize: '0.75rem', 
                                color: '#ef4444', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                background: 'rgba(239, 68, 68, 0.1)', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                fontWeight: 600 
                              }}>
                                <Clock size={12} /> Hạn chót: {item.deadlineSnapshot}
                              </span>
                            )}
                            {item.isChecked && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} /> Đã kiểm: {item.checkedAt ? new Date(item.checkedAt).toLocaleTimeString('vi-VN') : ''}
                              </span>
                            )}
                            {item.isChecked && item.updatedBy && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <UserIcon size={12} /> Bàn giao: {item.updatedBy.fullName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Comment & Notes form */}
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                      paddingTop: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <MessageSquare size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <input
                        type="text"
                        className="form-input"
                        placeholder={isCompleted ? "Không thể ghi chú khi đã chốt ca" : "Nhập ghi chú hoặc kết quả kiểm tra..."}
                        value={notesState[item.taskId] || ''}
                        onChange={(e) => setNotesState({ ...notesState, [item.taskId]: e.target.value })}
                        disabled={isCompleted || isSaving}
                        style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                      />
                      {!isCompleted && (
                        <button
                          onClick={() => handleSaveNote(item.taskId)}
                          className="btn btn-secondary"
                          disabled={isSaving}
                          style={{ padding: '8px 14px', flexShrink: 0 }}
                        >
                          <Save size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Audit Trail Timeline */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '800px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <Activity size={18} color="var(--color-accent)" /> Nhật ký hoạt động (Audit)
            </h3>
            
            {auditLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                Chưa có hoạt động nào được ghi nhận.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
                {/* Visual vertical line for timeline */}
                <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '15px', width: '2px', background: 'rgba(255,255,255,0.06)' }}></div>
                
                {auditLogs.map((audit) => {
                  let badgeColor = 'rgba(255,255,255,0.2)';
                  let dotColor = '#94a3b8';
                  if (audit.action === 'CHECK') {
                    badgeColor = 'rgba(16, 185, 129, 0.1)';
                    dotColor = 'var(--color-primary)';
                  } else if (audit.action === 'UNCHECK') {
                    badgeColor = 'rgba(239, 68, 68, 0.1)';
                    dotColor = '#ef4444';
                  } else if (audit.action === 'NOTE_UPDATE') {
                    badgeColor = 'rgba(245, 158, 11, 0.1)';
                    dotColor = '#f59e0b';
                  }

                  return (
                    <div key={audit._id} style={{ display: 'flex', gap: '14px', position: 'relative', zIndex: 1 }}>
                      {/* Custom timeline dot */}
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: '#0d1326',
                        border: `2px solid ${dotColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <UserCheck size={14} style={{ color: dotColor }} />
                      </div>
                      
                      <div style={{ flex: 1, padding: '12px', borderRadius: '8px', background: badgeColor, border: '1px solid rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff' }}>
                            {audit.userId?.fullName || 'Nhân sự Sở'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(audit.createdAt).toLocaleTimeString('vi-VN')}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: '1.4' }}>
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
