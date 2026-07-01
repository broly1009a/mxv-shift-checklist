'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface IncidentReportModalProps {
  resolvingIncident: any;
  setResolvingIncident: (inc: any) => void;
  rootCause: string;
  setRootCause: (v: string) => void;
  remediationAction: string;
  setRemediationAction: (v: string) => void;
  affectedAccountsInput: string;
  setAffectedAccountsInput: (v: string) => void;
  isResolving: boolean;
  handleResolveIncident: () => Promise<void>;
}

export default function IncidentReportModal({
  resolvingIncident,
  setResolvingIncident,
  rootCause,
  setRootCause,
  remediationAction,
  setRemediationAction,
  affectedAccountsInput,
  setAffectedAccountsInput,
  isResolving,
  handleResolveIncident
}: IncidentReportModalProps) {
  if (!resolvingIncident) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '500px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#ef4444" /> Giải quyết sự cố [{resolvingIncident.code}]
          </h3>
          <button
            onClick={() => setResolvingIncident(null)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}
          >
            &times;
          </button>
        </div>

        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
            <strong>Mã tác vụ lỗi:</strong> {resolvingIncident.taskId}<br />
            <strong>Yêu cầu khắc phục:</strong> {resolvingIncident.requiredAction}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Nguyên nhân gốc rễ (Root Cause)*</label>
              <select
                className="form-input"
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
              >
                <option value="MISSING_CONFIGURATION">MISSING_CONFIGURATION (Thiếu cấu hình)</option>
                <option value="MESSAGE_SYNC_LOSS">MESSAGE_SYNC_LOSS (Mất đồng bộ tin nhắn)</option>
                <option value="SOFTWARE_BUG">SOFTWARE_BUG (Lỗi phần mềm)</option>
                <option value="NETWORK_DISRUPTION">NETWORK_DISRUPTION (Sự cố đường truyền/mạng)</option>
                <option value="OTHER">OTHER (Nguyên nhân khác)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Giải pháp khắc phục (Remediation)*</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Mô tả chi tiết các bước xử lý khắc phục sự cố..."
                value={remediationAction}
                onChange={(e) => setRemediationAction(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tài khoản bị ảnh hưởng (Tùy chọn)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Nhập các tài khoản cách nhau bằng dấu phẩy, vd: TVKD01, TVKD02..."
                value={affectedAccountsInput}
                onChange={(e) => setAffectedAccountsInput(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem' }}
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          <button
            type="button"
            onClick={() => setResolvingIncident(null)}
            className="btn btn-secondary"
            disabled={isResolving}
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={handleResolveIncident}
            className="btn btn-primary"
            disabled={isResolving || !remediationAction.trim()}
            style={{ padding: '8px 16px', fontSize: '0.8rem' }}
          >
            {isResolving ? 'Đang lưu...' : 'Xác nhận khắc phục'}
          </button>
        </div>
      </div>
    </div>
  );
}
