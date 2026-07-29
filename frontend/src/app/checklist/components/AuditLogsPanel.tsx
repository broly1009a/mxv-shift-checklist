'use client';

import React, { useState, useMemo } from 'react';
import { Activity, UserCheck, Check, X, MessageSquare, Plus, AlertTriangle, Search } from 'lucide-react';
import { AuditLog } from '../hooks/useChecklist';

interface AuditLogsPanelProps {
  auditLogs: AuditLog[];
  showTechDetails?: boolean;
  taskNamesMap?: Record<string, string>;
}

export default function AuditLogsPanel({ 
  auditLogs, 
  showTechDetails = false, 
  taskNamesMap = {} 
}: AuditLogsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchesSearch = searchTerm.trim() === '' || 
        (log.taskId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.details || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.userId?.fullName || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (actionFilter === 'ALL') return matchesSearch;
      if (actionFilter === 'CHECK_UNCHECK') {
        return matchesSearch && (log.action === 'CHECK' || log.action === 'UNCHECK');
      }
      if (actionFilter === 'INCIDENT') {
        return matchesSearch && (log.action === 'INCIDENT_CREATED' || log.action === 'INCIDENT_RESOLVED');
      }
      return matchesSearch && log.action === actionFilter;
    });
  }, [auditLogs, searchTerm, actionFilter]);

  return (
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)', margin: 0 }}>
        <Activity size={16} color="var(--color-accent)" /> Nhật ký hoạt động (Audit)
      </h3>

      {/* Search and Action Type filter row */}
      {auditLogs.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm ID tác vụ, nội dung..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                height: '32px',
                paddingLeft: '28px',
                fontSize: '0.78rem',
                borderRadius: '6px'
              }}
            />
          </div>
          <select
            className="form-input"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              width: '135px',
              height: '32px',
              padding: '0 24px 0 10px',
              fontSize: '0.78rem',
              borderRadius: '6px',
              cursor: 'pointer',
              background: 'var(--bg-input) url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2394a3b8\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e") no-repeat right 6px center/14px 14px',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none'
            }}
          >
            <option value="ALL">Tất cả HĐ</option>
            <option value="CHECK_UNCHECK">Đạt / Bỏ đạt</option>
            <option value="NOTE_UPDATE">Ghi chú</option>
            <option value="INCIDENT">Sự cố</option>
            <option value="ADD_TASK">Tác vụ phát sinh</option>
          </select>
        </div>
      )}

      {auditLogs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Chưa có hoạt động nào được ghi nhận.
        </div>
      ) : filteredLogs.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '20px 0' }}>
          Không tìm thấy hoạt động phù hợp bộ lọc.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }} className="custom-scrollbar">
          {/* Visual vertical line for timeline */}
          <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '15px', width: '2px', background: 'var(--border-color)' }}></div>
          {filteredLogs.map((audit, idx) => {
            let badgeColor = 'rgba(255,255,255,0.02)';
            let dotColor = '#94a3b8';
            let ActionIcon = UserCheck;

            if (audit.action === 'CHECK' || audit.action === 'INCIDENT_RESOLVED') {
              badgeColor = 'rgba(16, 185, 129, 0.03)';
              dotColor = 'var(--color-primary)';
              ActionIcon = Check;
            } else if (audit.action === 'UNCHECK') {
              badgeColor = 'rgba(239, 68, 68, 0.03)';
              dotColor = '#ef4444';
              ActionIcon = X;
            } else if (audit.action === 'INCIDENT_CREATED') {
              badgeColor = 'rgba(239, 68, 68, 0.03)';
              dotColor = '#ef4444';
              ActionIcon = AlertTriangle;
            } else if (audit.action === 'NOTE_UPDATE') {
              badgeColor = 'rgba(245, 158, 11, 0.03)';
              dotColor = '#f59e0b';
              ActionIcon = MessageSquare;
            } else if (audit.action === 'ADD_TASK') {
              badgeColor = 'rgba(59, 130, 246, 0.03)';
              dotColor = '#3b82f6';
              ActionIcon = Plus;
            }

            return (
              <div key={`${audit._id}-${idx}`} style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
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
                  <ActionIcon size={14} style={{ color: dotColor }} />
                </div>

                <div 
                  className="transition-all duration-200 hover:border-[rgba(255,255,255,0.25)] hover:shadow-sm"
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', background: badgeColor, border: '1px solid var(--border-color)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {audit.userId?.fullName || 'Hệ thống'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                      {new Date(audit.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-word', lineHeight: '1.4', margin: 0 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>
                      {showTechDetails 
                        ? `${audit.taskId} (${taskNamesMap?.[audit.taskId] || ''})`
                        : (taskNamesMap?.[audit.taskId] || audit.taskId)
                      }
                    </strong>: {audit.details}
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
