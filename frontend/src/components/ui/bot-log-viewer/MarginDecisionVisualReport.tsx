import React from 'react';
import { FileCheck, ShieldCheck, FolderCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface MarginDecisionVisualReportProps {
  jsonResult: any;
  rawText: string;
}

export const MarginDecisionVisualReport: React.FC<MarginDecisionVisualReportProps> = ({ jsonResult, rawText }) => {
  const isNoFileFound = rawText.includes('Không tìm thấy file Quyết định') || rawText.includes('Mức ký quỹ giữ nguyên');
  const hasDecision = rawText.includes('Phát hiện Quyết định') || (jsonResult && jsonResult.totalExtracted > 0);

  const fileNameMatch = rawText.match(/Quyết định\s*"([^"]+)"/i) || rawText.match(/phát hiện file:\s*([^\n]+)/i);
  const fileName = fileNameMatch ? fileNameMatch[1] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Top Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
            Trạng thái Quyết định Ký quỹ
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: hasDecision ? '#f59e0b' : '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hasDecision ? (
              <>
                <AlertCircle size={18} color="#f59e0b" /> Có Quyết định Mới
              </>
            ) : (
              <>
                <CheckCircle2 size={18} color="#34d399" /> Không Có Quyết Định Mới
              </>
            )}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {hasDecision ? `Tệp: ${fileName || 'Có thông báo mới'}` : 'Đã quét thư mục ngày hiện tại'}
          </div>
        </div>

        <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase' }}>
            Mức Ký Quỹ Áp Dụng
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {hasDecision ? 'Cần điều chỉnh' : 'Giữ nguyên mức cũ'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {hasDecision ? 'Yêu cầu Maker/Checker xem xét' : 'Không có biến động ký quỹ trong phiên'}
          </div>
        </div>
      </div>

      {/* Main Status Panel */}
      <div style={{
        padding: '20px',
        background: hasDecision ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
        border: hasDecision ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {hasDecision ? <FileCheck size={22} color="#f59e0b" /> : <ShieldCheck size={22} color="#34d399" />}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: hasDecision ? '#fbbf24' : '#34d399', margin: 0 }}>
              {hasDecision ? 'Phát hiện văn bản ban hành mức ký quỹ mới' : 'Kết quả kiểm tra tự động thư mục Quyết định'}
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Giám sát tự động từ thư mục Quyết định - Thông báo
            </span>
          </div>
        </div>

        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.78rem',
          color: 'var(--text-primary)',
          lineHeight: '1.5'
        }}>
          {rawText || '[Bot quét tự động]: Đã hoàn thành kiểm tra thư mục Quyết định.'}
        </div>
      </div>

      {/* Folder Info */}
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '0.75rem',
        color: 'var(--text-secondary)'
      }}>
        <FolderCheck size={16} color="var(--color-accent)" />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Thư mục giám sát: </strong>
          <span style={{ fontFamily: 'monospace' }}>...\Quyết định - Thông báo\2. QĐ ban hành mức ký quỹ</span>
        </div>
      </div>
    </div>
  );
};
