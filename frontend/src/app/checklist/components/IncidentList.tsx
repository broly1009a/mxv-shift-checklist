'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

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
        fontSize: '0.7rem',
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
  const activeCount = incidents.filter(inc => inc.status === 'PENDING').length;

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
                  border: `1px solid ${isPending ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isPending ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>
                    [{inc.code}] {inc.taskId}
                  </span>
                  {isPending && inc.slaDeadlineAt && (
                    <IncidentSlaCountdown deadline={inc.slaDeadlineAt} />
                  )}
                  {!isPending && (
                    <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '2px 6px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '4px' }}>Đã khắc phục</span>
                  )}
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                  <strong>Yêu cầu SOP:</strong> {inc.requiredAction}
                </p>

                {!isPending && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border-color)', paddingTop: '6px', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div><strong>Nguyên nhân:</strong> {inc.rootCause}</div>
                    <div><strong>Giải quyết:</strong> {inc.remediationAction}</div>
                    {inc.affectedAccounts && inc.affectedAccounts.length > 0 && (
                      <div><strong>Tài khoản ảnh hưởng:</strong> {inc.affectedAccounts.join(', ')}</div>
                    )}
                  </div>
                )}

                {isPending && !isCompleted && (
                  <button
                    onClick={() => {
                      setRootCause('MISSING_CONFIGURATION');
                      setRemediationAction('');
                      setAffectedAccountsInput('');
                      setResolvingIncident(inc);
                    }}
                    className="btn btn-primary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      alignSelf: 'flex-end',
                      height: 'auto',
                      marginTop: '4px'
                    }}
                  >
                    Khắc phục sự cố
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
