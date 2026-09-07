import React from 'react';
import { FileText, Download, X } from 'lucide-react';
import { PreviewPdfState } from '../../types/tkgd.types';

interface PdfPreviewFrameProps {
  previewPdf: PreviewPdfState;
  onClose: () => void;
}

export const PdfPreviewFrame: React.FC<PdfPreviewFrameProps> = ({ previewPdf, onClose }) => {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw',
          height: '92vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--bg-input)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} color="#ef4444" />
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{previewPdf.title}</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <a
              href={previewPdf.url}
              download
              target="_blank"
              rel="noreferrer"
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                fontSize: '0.78rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Download size={14} /> Tải file gốc
            </a>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body: Embedded iframe */}
        <div style={{ flex: 1, backgroundColor: '#525659' }}>
          <iframe
            src={`${previewPdf.url}#toolbar=1`}
            width="100%"
            height="100%"
            style={{ border: 'none' }}
            title={previewPdf.title}
          />
        </div>
      </div>
    </div>
  );
};
