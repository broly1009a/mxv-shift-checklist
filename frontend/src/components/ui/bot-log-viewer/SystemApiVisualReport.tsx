import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { MarginAccount } from './types';

interface SystemApiVisualReportProps {
  jsonResult: any;
  marginAccounts: MarginAccount[];
}

export const SystemApiVisualReport: React.FC<SystemApiVisualReportProps> = ({ jsonResult, marginAccounts }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Email Stats Cards */}
      {jsonResult && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>TỔNG SỐ EMAIL GỬI</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {jsonResult.totalCount || 0} email
            </div>
          </div>
          <div style={{ padding: '16px', background: (jsonResult.failedCount || 0) > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)', borderRadius: '10px', border: (jsonResult.failedCount || 0) > 0 ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ fontSize: '0.7rem', color: (jsonResult.failedCount || 0) > 0 ? '#f87171' : '#34d399', marginBottom: '4px', fontWeight: 600 }}>EMAIL GỬI THẤT BẠI</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: (jsonResult.failedCount || 0) > 0 ? '#f87171' : '#34d399' }}>
              {jsonResult.failedCount || 0} email
            </div>
          </div>
        </div>
      )}

      {jsonResult?.failedList && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px' }}>
          <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f87171', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} /> Danh sách email lỗi:
          </h4>
          <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.75rem', color: '#f87171', whiteSpace: 'pre-wrap', background: 'var(--bg-input)', padding: '10px', borderRadius: '6px' }}>
            {jsonResult.failedList}
          </pre>
        </div>
      )}

      {/* Negative Margin Accounts Grid */}
      {marginAccounts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px' }}>
            <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fbbf24', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={15} /> Phát hiện tài khoản âm ký quỹ ({marginAccounts.length} tài khoản)
            </h4>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
              Danh sách tài khoản âm ký quỹ đã được gửi cảnh báo đến các kênh vận hành tự động:
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {marginAccounts.map((acc, idx) => (
              <div key={idx} style={{ padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>{acc.account}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#f87171', fontWeight: 700 }}>
                  {acc.value !== 0 ? acc.value.toLocaleString('vi-VN') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {marginAccounts.length === 0 && !jsonResult && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', color: '#34d399' }}>
          <CheckCircle2 size={24} />
          <div>
            <strong style={{ fontSize: '0.82rem', display: 'block', marginBottom: '2px' }}>Trạng thái API & Email ổn định</strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hệ thống phản hồi bình thường, không phát hiện tài khoản âm ký quỹ hoặc lỗi kết nối.</span>
          </div>
        </div>
      )}
    </div>
  );
};
