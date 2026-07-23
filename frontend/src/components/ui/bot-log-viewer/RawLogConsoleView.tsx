import React from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface RawLogConsoleViewProps {
  rawText: string;
}

export const RawLogConsoleView: React.FC<RawLogConsoleViewProps> = ({ rawText }) => {
  const handleCopyLog = () => {
    navigator.clipboard.writeText(rawText);
    toast.success('Đã sao chép log gốc!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
          CONSOLE LOG OUTPUT
        </span>
        <button
          type="button"
          onClick={handleCopyLog}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '0.72rem',
            color: 'var(--text-primary)',
            cursor: 'pointer'
          }}
        >
          <Copy size={12} /> Sao chép log
        </button>
      </div>
      <pre
        style={{
          flex: 1,
          margin: 0,
          backgroundColor: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          padding: '16px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '0.75rem',
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          overflowY: 'auto',
          lineHeight: 1.6
        }}
      >
        {rawText}
      </pre>
    </div>
  );
};
