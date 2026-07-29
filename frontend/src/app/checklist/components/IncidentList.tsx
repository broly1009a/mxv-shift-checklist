'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Download, Clock, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface IncidentSlaCountdownProps {
  deadline: string;
}

function IncidentSlaCountdown({ deadline }: IncidentSlaCountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isOverdue, setIsOverdue] = useState<boolean>(false);

  useEffect(() => {
    const target = new Date(deadline).getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = target - now;

      if (diff <= 0) {
        setIsOverdue(true);
        const absDiff = Math.abs(diff);
        const mins = Math.floor(absDiff / 60000);
        const secs = Math.floor((absDiff % 60000) / 1000);
        setTimeLeft(`Trễ SLA ${mins}m ${secs}s`);
      } else {
        setIsOverdue(false);
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  return (
    <span
      className="badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.7rem',
        padding: '3px 8px',
        fontWeight: 'bold',
        backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
        color: isOverdue ? '#ef4444' : '#f59e0b',
        border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '5px'
      }}
    >
      <Clock size={11} className={isOverdue ? 'animate-pulse' : ''} />
      {timeLeft}
    </span>
  );
}

interface IncidentListProps {
  incidents: any[];
  isCompleted: boolean;
  setRootCause: (cause: string) => void;
  setRemediationAction: (action: string) => void;
  setAffectedAccountsInput: (accounts: string) => void;
  setResolvingIncident: (inc: any) => void;
}

export default function IncidentList({
  incidents,
  isCompleted,
  setRootCause,
  setRemediationAction,
  setAffectedAccountsInput,
  setResolvingIncident
}: IncidentListProps) {
  const { token } = useAuth();
  const activeCount = incidents.filter(inc => inc.status === 'PENDING').length;

  const handleExportReport = async (inc: any) => {
    if (!token) {
      toast.error('Bạn cần đăng nhập để thực hiện tác vụ này.');
      return;
    }
    const loadToast = toast.loading('Đang khởi tạo file báo cáo...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/${inc._id}/export`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error('Lỗi khi tải file báo cáo từ server.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_cao_su_co_01_QT_TVH_${inc.code || inc._id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Tải báo cáo sự cố thành công!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Không thể xuất báo cáo.');
    } finally {
      toast.dismiss(loadToast);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
        <AlertTriangle size={16} color="#ef4444" /> Sự cố & Ngoại lệ ({activeCount})
      </h3>

      {incidents.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Không có ngoại lệ hay sự cố trễ SLA nào trong ca.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto' }} className="custom-scrollbar">
          {incidents.map((inc) => {
            const isPending = inc.status === 'PENDING';
            return (
              <div
                key={inc._id}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: isPending ? 'rgba(239, 68, 68, 0.04)' : 'rgba(16, 185, 129, 0.02)',
                  borderTop: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`,
                  borderRight: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`,
                  borderBottom: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`,
                  borderLeft: isPending ? '4px solid #ef4444' : '4px solid #10b981',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: isPending ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
                    {isPending ? <ShieldAlert size={13} /> : <CheckCircle2 size={13} />}
                    [{inc.code}] {inc.taskId}
                  </span>
                  {isPending && inc.slaDeadlineAt && (
                    <IncidentSlaCountdown deadline={inc.slaDeadlineAt} />
                  )}
                  {!isPending && (
                    <span
                      className="badge"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        padding: '3px 8px',
                        fontWeight: 'bold',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '5px'
                      }}
                    >
                      <CheckCircle2 size={11} />
                      Đã khắc phục
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  <strong>Yêu cầu SOP:</strong> {inc.requiredAction}
                </p>

                {!isPending && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>
                        <strong>Nguyên nhân:</strong>{' '}
                        {(() => {
                          switch (inc.rootCause) {
                            case 'MISSING_CONFIGURATION': return 'Thiếu cấu hình';
                            case 'MESSAGE_SYNC_LOSS': return 'Mất đồng bộ tin nhắn';
                            case 'SOFTWARE_BUG': return 'Lỗi phần mềm';
                            case 'NETWORK_DISRUPTION': return 'Sự cố đường truyền/mạng';
                            case 'DATA_FILE_ERROR': return 'Lỗi tệp tin / Dữ liệu';
                            case 'THIRD_PARTY_ERROR': return 'Sự cố hệ thống liên kết / Bên thứ 3';
                            case 'OTHER': return 'Nguyên nhân khác';
                            default: return inc.rootCause || 'Chưa xác định';
                          }
                        })()}
                      </div>
                      <div><strong>Giải quyết:</strong> {inc.remediationAction}</div>
                      {inc.affectedAccounts && inc.affectedAccounts.length > 0 && (
                        <div><strong>Tài khoản ảnh hưởng:</strong> {inc.affectedAccounts.join(', ')}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleExportReport(inc)}
                      style={{
                        padding: '5px 12px',
                        fontSize: '0.72rem',
                        alignSelf: 'flex-end',
                        height: 'auto',
                        marginTop: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: '#10b981',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        borderRadius: '6px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      className="hover:bg-[#10b981] hover:text-white"
                    >
                      <Download size={12} /> Xuất mẫu 01/QT/TVH
                    </button>
                  </div>
                )}

                {isPending && (
                  <button
                    onClick={() => {
                      setRootCause('MISSING_CONFIGURATION');
                      setRemediationAction('');
                      setAffectedAccountsInput('');
                      setResolvingIncident(inc);
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.72rem',
                      alignSelf: 'flex-end',
                      height: 'auto',
                      marginTop: '4px'
                    }}
                  >
                    Xử lý
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
