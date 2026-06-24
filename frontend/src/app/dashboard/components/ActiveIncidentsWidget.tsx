import React, { useState, useEffect } from 'react';
import { GripVertical, AlertTriangle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { API_BASE_URL } from '@/context/AuthContext';

interface Incident {
  _id: string;
  shiftLogId: string;
  taskId: string;
  code: string;
  severity: string;
  requiredAction: string;
  status: string;
  slaDeadlineAt: string;
}

// SLA Countdown helper inside the widget
function DashboardSlaCountdown({ deadline }: { deadline: string }) {
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
        fontSize: '0.68rem',
        padding: '2px 8px',
        fontWeight: 'bold',
        backgroundColor: isOverdue ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
        color: isOverdue ? '#ef4444' : '#f59e0b',
        border: `1px solid ${isOverdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
        borderRadius: '4px'
      }}
    >
      {timeLeft}
    </span>
  );
}

export const ActiveIncidentsWidget: React.FC<{ token: string | null }> = ({ token }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchPendingIncidents = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/incidents/pending`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIncidents(data);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách sự cố chờ xử lý:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingIncidents();

    // Set up a local refresh interval (every 30 seconds) as a backup
    const timer = setInterval(fetchPendingIncidents, 30000);
    return () => clearInterval(timer);
  }, [token]);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>

      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0', margin: 0, paddingRight: '24px' }}>
        <AlertTriangle size={16} color="#ef4444" /> Sự cố & ngoại lệ chưa xử lý ({incidents.length})
      </h3>

      {loading ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
          Đang tải dữ liệu sự cố...
        </div>
      ) : incidents.length === 0 ? (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
          Không có sự cố nào cần xử lý.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }} className="custom-scrollbar">
          {incidents.map((inc) => (
            <div
              key={inc._id}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.04)',
                border: '1px solid rgba(239, 68, 68, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', fontFamily: 'monospace' }}>
                  [{inc.code}] {inc.taskId}
                </span>
                {inc.slaDeadlineAt && (
                  <DashboardSlaCountdown deadline={inc.slaDeadlineAt} />
                )}
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                {inc.requiredAction}
              </p>

              <Link
                href={`/checklist?id=${inc.shiftLogId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.72rem',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  textDecoration: 'none',
                  alignSelf: 'flex-end',
                  marginTop: '2px'
                }}
              >
                Tới ca trực <ArrowUpRight size={12} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
