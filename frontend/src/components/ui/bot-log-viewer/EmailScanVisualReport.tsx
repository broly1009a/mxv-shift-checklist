import React from 'react';
import { Mail, CheckCircle2, XCircle, FolderOpen, Tag, Clock } from 'lucide-react';

interface EmailScanVisualReportProps {
  emailScanResult: {
    found: boolean;
    subject?: string;
    sender?: string;
    downloadDir?: string;
    downloadedFiles?: string[];
    keyword?: string;
    scannedAt?: string;
  } | null | undefined;
  rawText: string;
}

export const EmailScanVisualReport: React.FC<EmailScanVisualReportProps> = ({ emailScanResult, rawText }) => {
  if (!emailScanResult) {
    return (
      <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
        Không thể phân tích dữ liệu quét email.
      </div>
    );
  }

  const { found, subject, downloadDir, downloadedFiles = [], keyword, scannedAt } = emailScanResult;

  // If we couldn't parse the subject from text, try scanning rawText for it:
  let displaySubject = subject;
  const isExplicitlyEmpty = rawText.includes('khớp tiêu đề ""') || rawText.includes('tiêu đề ""');
  
  if (isExplicitlyEmpty) {
    displaySubject = 'Bất kỳ tiêu đề nào (Không giới hạn)';
  } else if (!displaySubject) {
    const match = rawText.match(/khớp tiêu đề\s*["']([^"']+)["']/i) || rawText.match(/email khớp:\s*["']([^"']+)["']/i);
    if (match) displaySubject = match[1];
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Status Alert Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px',
          borderRadius: '10px',
          background: found ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: found ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
        }}
      >
        {found ? (
          <CheckCircle2 color="#10b981" size={24} style={{ flexShrink: 0 }} />
        ) : (
          <XCircle color="#ef4444" size={24} style={{ flexShrink: 0 }} />
        )}
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 850, color: found ? '#10b981' : '#ef4444' }}>
            {found ? 'TÌM THẤY EMAIL HỢP LỆ' : 'KHÔNG TÌM THẤY EMAIL KHỚP'}
          </h4>
          <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            {found
              ? 'Hệ thống đã nhận diện được email kết quả EOD từ hòm thư của đối tác.'
              : 'Bot đã kiểm tra hòm thư nhưng không tìm thấy email nào phù hợp với các bộ lọc tiêu chí.'}
          </p>
        </div>
      </div>

      {/* Grid Information Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {/* Scanned At */}
        <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Clock size={18} color="var(--text-muted)" />
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>THỜI GIAN THỰC HIỆN</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {scannedAt || 'Định kỳ ca trực'}
            </div>
          </div>
        </div>

        {/* Verification Keyword */}
        <div style={{ padding: '14px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Tag size={18} color="var(--text-muted)" />
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600 }}>ĐIỀU KIỆN NỘI DUNG (KEYWORD)</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', marginTop: '2px', fontFamily: 'monospace' }}>
              {keyword ? `"${keyword}"` : 'Thành công / Success'}
            </div>
          </div>
        </div>
      </div>

      {/* Target Email Filter Settings */}
      <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <h5 style={{ margin: '0 0 10px 0', fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mail size={14} /> Tiêu chí tìm kiếm email
        </h5>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.72rem' }}>
          <div style={{ display: 'flex', borderBottom: '1px dashed var(--border-color)', paddingBottom: '6px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)', fontWeight: 500 }}>Tiêu đề tìm kiếm:</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
              {displaySubject || 'Không xác định'}
            </span>
          </div>
          <div style={{ display: 'flex', paddingTop: '2px' }}>
            <span style={{ width: '120px', color: 'var(--text-muted)', fontWeight: 500 }}>Người gửi (Sender):</span>
            <span style={{ flex: 1, color: 'var(--text-primary)', fontWeight: 600 }}>
              {emailScanResult.sender || 'Mặc định hệ thống'}
            </span>
          </div>
        </div>
      </div>

      {/* Download File Attachments Section */}
      {found && (
        <div style={{ padding: '16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h5 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FolderOpen size={14} /> Tệp tin đính kèm đã tải về
          </h5>
          
          {/* List of files */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {downloadedFiles.length > 0 ? (
              downloadedFiles.map((file, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--bg-app)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'monospace' }}>
                    {file}
                  </span>
                  <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: '4px' }}>
                    ĐÃ TẢI
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Không có file đính kèm hoặc file tự động được tích hợp
              </div>
            )}
          </div>

          {/* Directory location */}
          {downloadDir && (
            <div style={{ marginTop: '4px', fontSize: '0.68rem', color: 'var(--text-secondary)', display: 'flex', gap: '4px' }}>
              <span style={{ fontWeight: 600 }}>Thư mục lưu trữ:</span>
              <span style={{ fontFamily: 'monospace', color: 'var(--color-accent)' }}>{downloadDir}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
