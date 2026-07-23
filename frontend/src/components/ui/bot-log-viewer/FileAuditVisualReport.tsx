import React from 'react';
import { FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { FileAuditItem } from './types';

interface FileAuditVisualReportProps {
  fileItems: FileAuditItem[];
}

export const FileAuditVisualReport: React.FC<FileAuditVisualReportProps> = ({ fileItems }) => {
  const missingCount = fileItems.filter(f => f.status === 'MISSING').length;
  const downloadedCount = fileItems.filter(f => f.status === 'OK' || f.status === 'DOWNLOADED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div
          style={{
            padding: '16px',
            background: 'var(--bg-input)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>
            TỔNG SỐ FILE BÁO CÁO
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {fileItems.length} tệp
          </div>
        </div>

        <div
          style={{
            padding: '16px',
            background: 'rgba(16, 185, 129, 0.05)',
            borderRadius: '10px',
            border: '1px solid rgba(16, 185, 129, 0.2)'
          }}
        >
          <div style={{ fontSize: '0.7rem', color: '#34d399', marginBottom: '4px', fontWeight: 600 }}>
            FILE ĐÃ TẢI THÀNH CÔNG
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>
            {downloadedCount} tệp
          </div>
        </div>

        {missingCount > 0 && (
          <div
            style={{
              padding: '16px',
              background: 'rgba(239, 68, 68, 0.05)',
              borderRadius: '10px',
              border: '1px solid rgba(239, 68, 68, 0.2)'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>
              FILE THIẾU / CHƯA TẢI
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f87171' }}>
              {missingCount} tệp
            </div>
          </div>
        )}
      </div>

      {/* File List */}
      <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '10px 14px' }}>Tên tệp báo cáo</th>
              <th style={{ padding: '10px 14px' }}>Trạng thái</th>
              <th style={{ padding: '10px 14px' }}>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {fileItems.map((item) => {
              const isMissing = item.status === 'MISSING';
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', background: isMissing ? 'rgba(239, 68, 68, 0.02)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={15} color={isMissing ? '#f87171' : 'var(--color-accent)'} />
                    {item.filename}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {isMissing ? (
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 700 }}>
                        🚨 CHƯA CÓ FILE
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', fontWeight: 700 }}>
                        ✓ ĐÃ TẢI FILE
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px', color: isMissing ? '#f87171' : 'var(--text-secondary)' }}>
                    {item.detail || (isMissing ? 'Chưa tìm thấy báo cáo trong thư mục lưu trữ' : 'Đã xác minh sự tồn tại của tệp')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
