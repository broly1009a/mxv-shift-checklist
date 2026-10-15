'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { Terminal, X, RefreshCw } from 'lucide-react';

export interface TradingManagerLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId?: string | null;
  status?: string | null;
  logs: string[];
  onRetry?: () => void;
  isRetrying?: boolean;
}

export default function TradingManagerLogModal({
  isOpen,
  onClose,
  jobId,
  status,
  logs,
  onRetry,
  isRetrying = false,
}: TradingManagerLogModalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  const currentStatus = status || 'UNKNOWN';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          maxWidth: '920px',
          width: '100%',
          maxHeight: '88vh',
          height: 'auto',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 'var(--glass-shadow, 0 20px 45px -10px rgba(0, 0, 0, 0.15))',
          color: 'var(--text-primary)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Terminal size={19} color="var(--color-accent, #3b82f6)" />
            <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
              Nhật ký thực thi Bot Đối Soát (Job ID: {jobId ? String(jobId).slice(-8) : 'N/A'})
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                backgroundColor:
                  currentStatus === 'FAILED'
                    ? 'rgba(239, 68, 68, 0.12)'
                    : currentStatus === 'CANCELLED'
                    ? 'rgba(100, 116, 139, 0.15)'
                    : currentStatus === 'COMPLETED'
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(59, 130, 246, 0.12)',
                color:
                  currentStatus === 'FAILED'
                    ? '#ef4444'
                    : currentStatus === 'CANCELLED'
                    ? '#94a3b8'
                    : currentStatus === 'COMPLETED'
                    ? '#10b981'
                    : '#3b82f6',
                border: `1px solid ${
                  currentStatus === 'FAILED'
                    ? 'rgba(239, 68, 68, 0.25)'
                    : currentStatus === 'CANCELLED'
                    ? 'rgba(100, 116, 139, 0.3)'
                    : currentStatus === 'COMPLETED'
                    ? 'rgba(16, 185, 129, 0.25)'
                    : 'rgba(59, 130, 246, 0.25)'
                }`,
              }}
            >
              {currentStatus}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            title="Đóng (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '18px 22px',
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: '220px',
            maxHeight: 'calc(88vh - 145px)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div
            style={{
              padding: '16px',
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.82rem',
              lineHeight: '1.65',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {logs.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                Chưa có nhật ký ghi nhận cho phiên chạy này.
              </div>
            ) : (
              logs.map((logLine: string, idx: number) => {
                const lower = logLine.toLowerCase();
                const isErr =
                  lower.includes('lỗi') ||
                  lower.includes('fail') ||
                  lower.includes('error') ||
                  lower.includes('thất bại');
                const isSuccess =
                  lower.includes('thành công') || lower.includes('khớp hoàn toàn');
                const isWarn =
                  lower.includes('timeout') ||
                  lower.includes('bỏ qua') ||
                  lower.includes('cảnh báo') ||
                  lower.includes('warn') ||
                  lower.includes('429');

                return (
                  <div
                    key={idx}
                    style={{
                      color: isErr
                        ? '#ef4444'
                        : isSuccess
                        ? '#10b981'
                        : isWarn
                        ? '#f59e0b'
                        : 'var(--text-primary)',
                      fontWeight: isErr || isSuccess || isWarn ? 600 : 400,
                      wordBreak: 'break-word',
                      padding: '2px 0',
                      borderBottom: '1px dashed var(--border-color)',
                    }}
                  >
                    {logLine}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Đóng
          </button>
          {onRetry && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onRetry();
              }}
              disabled={isRetrying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--color-accent, #3b82f6)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                opacity: isRetrying ? 0.7 : 1,
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={14} className={isRetrying ? 'animate-spin' : ''} />
              <span>Chạy lại đối soát</span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
