'use client';

import React from 'react';
import { Activity, UserCheck } from 'lucide-react';
import { AuditLog } from '../hooks/useChecklist';

interface AuditLogsPanelProps {
  auditLogs: AuditLog[];
}

export default function AuditLogsPanel({ auditLogs }: AuditLogsPanelProps) {
  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '420px', overflowY: 'auto' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
        <Activity size={16} color="var(--color-accent)" /> Nhật ký hoạt động (Audit)
      </h3>

      {auditLogs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Chưa có hoạt động nào được ghi nhận.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative' }}>
          {/* Visual vertical line for timeline */}
          <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '15px', width: '2px', background: 'var(--border-color)' }}></div>

          {auditLogs.map((audit) => {
            let badgeColor = 'rgba(255,255,255,0.02)';
            let dotColor = '#94a3b8';
            if (audit.action === 'CHECK' || audit.action === 'INCIDENT_RESOLVED') {
              badgeColor = 'rgba(16, 185, 129, 0.03)';
              dotColor = 'var(--color-primary)';
            } else if (audit.action === 'UNCHECK' || audit.action === 'INCIDENT_CREATED') {
              badgeColor = 'rgba(239, 68, 68, 0.03)';
              dotColor = '#ef4444';
            } else if (audit.action === 'NOTE_UPDATE') {
              badgeColor = 'rgba(245, 158, 11, 0.03)';
              dotColor = '#f59e0b';
            } else if (audit.action === 'ADD_TASK') {
              badgeColor = 'rgba(59, 130, 246, 0.03)';
              dotColor = '#3b82f6';
            }

            return (
              <div key={audit._id} style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
                {/* Custom timeline dot */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--bg-app)',
                  border: `2px solid ${dotColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <UserCheck size={14} style={{ color: dotColor }} />
                </div>

                <div style={{ flex: 1, padding: '10px', borderRadius: '8px', background: badgeColor, border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {audit.userId?.fullName || 'Hệ thống'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(audit.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: '1.4', margin: 0 }}>
                    <strong>{audit.taskId}</strong>: {audit.details}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
