'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  Search,
  Server,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  MinusCircle,
} from 'lucide-react';
import { parseReconJobLogs } from '../../utils/reconLogParser';

interface ReconLogSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: string[];
  runLabel?: string;
  runTime?: string;
  summaryData?: any;
}

export const ReconLogSummaryModal: React.FC<ReconLogSummaryModalProps> = ({
  isOpen,
  onClose,
  logs = [],
  runLabel,
  runTime,
  summaryData,
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'raw'>('summary');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => {
    return parseReconJobLogs(logs, summaryData);
  }, [logs, summaryData]);

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter((l) => l.toLowerCase().includes(term));
  }, [logs, searchTerm]);

  const handleCopyLogs = () => {
    if (logs.length === 0) return;
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const isPassed = parsed.reconResult.status === 'PASSED';
  const isFailed = parsed.reconResult.status === 'FAILED';
  const isWaiting = parsed.reconResult.status === 'WAITING';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card, #18181b)',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #27272a)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #f4f4f5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color, #27272a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card-header, rgba(255, 255, 255, 0.02))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(14, 165, 233, 0.15)',
                color: '#0ea5e9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Nhật Ký Tóm Tắt Đối Chiếu
                </h3>
                {runLabel && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-secondary, #a1a1aa)',
                    }}
                  >
                    {runLabel}
                  </span>
                )}
              </div>
              <p
                style={{
                  margin: '2px 0 0',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary, #a1a1aa)',
                }}
              >
                Mốc thời gian tải dữ liệu và kết quả thẩm định đối soát
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Tab switchers */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-input, #27272a)',
                borderRadius: '8px',
                padding: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'summary' ? '#0ea5e9' : 'transparent',
                  color: activeTab === 'summary' ? '#ffffff' : 'var(--text-secondary, #a1a1aa)',
                  transition: 'all 0.15s ease',
                }}
              >
                Tóm tắt
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'raw' ? '#0ea5e9' : 'transparent',
                  color: activeTab === 'raw' ? '#ffffff' : 'var(--text-secondary, #a1a1aa)',
                  transition: 'all 0.15s ease',
                }}
              >
                Log gốc ({logs.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary, #a1a1aa)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'summary' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Verdict Banner */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: isPassed
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : isFailed
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(245, 158, 11, 0.3)',
                  backgroundColor: isPassed
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isFailed
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'rgba(245, 158, 11, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isPassed ? (
                    <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                  ) : isFailed ? (
                    <XCircle size={24} style={{ color: '#ef4444' }} />
                  ) : (
                    <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: isPassed ? '#10b981' : isFailed ? '#ef4444' : '#f59e0b',
                      }}
                    >
                      {parsed.reconResult.verdictText}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #a1a1aa)', marginTop: '2px' }}>
                      {isPassed
                        ? 'Khối lượng giao dịch khớp 100% giữa tất cả các hệ thống'
                        : isFailed
                          ? `Lệch MS vs CQG: ${parsed.reconResult.differKlgd || 0} lots | Lệch ACM vs Nano: ${parsed.reconResult.differAcm || 0} lots`
                          : 'Đang trong tiến trình thu thập và đồng bộ'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                  {parsed.startTime && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                        Bắt đầu
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, fontFamily: 'monospace' }}>
                        {parsed.startTime}
                      </div>
                    </div>
                  )}
                  {parsed.durationSeconds !== undefined && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                        Thời lượng
                      </div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0ea5e9' }}>
                        {parsed.durationSeconds}s
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Anomaly Alert Notice (Nếu có) */}
              {parsed.anomaly?.hasAnomaly && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b' }}>
                      Phát hiện bất thường: Sàn ACM chưa cắt phiên kế toán
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary, #d4d4d8)', marginTop: '2px' }}>
                      {parsed.anomaly.note ||
                        'Hệ thống đã tự động kích hoạt bộ phòng vệ đối soát phụ theo Trade Date thực tế để bảo vệ dữ liệu.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Data Sources Download Grid (4 Nguồn) */}
              <div>
                <div
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: 'var(--text-secondary, #a1a1aa)',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Tiến Trình Tải Dữ Liệu Tươi 4 Nguồn (Đồng Bộ 2 Pha)
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {/* M-System */}
                  <SourceStatusCard milestone={parsed.downloads.ms} label="M-System" defaultFile="DSGD.xlsx" />

                  {/* CQG */}
                  <SourceStatusCard milestone={parsed.downloads.cqg} label="CQG" defaultFile="FR, OP, PS" />

                  {/* ACM Nano */}
                  <SourceStatusCard milestone={parsed.downloads.acm} label="ACM Nano" defaultFile="Straits.csv / Fill.xlsx" />

                  {/* CoreCCP */}
                  <SourceStatusCard milestone={parsed.downloads.ccp} label="CoreCCP" defaultFile="Báo cáo CCP" />
                </div>
              </div>

              {/* Additional Context Rows */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-input, rgba(255, 255, 255, 0.03))',
                  border: '1px solid var(--border-color, #27272a)',
                  fontSize: '0.82rem',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-secondary, #a1a1aa)', fontWeight: 600 }}>
                    Rào cản đồng bộ 4 nguồn:
                  </span>{' '}
                  <span style={{ fontWeight: 800, color: parsed.barrierStatus === 'SYNCED' ? '#10b981' : '#f59e0b' }}>
                    {parsed.barrierStatus === 'SYNCED'
                      ? `Đồng bộ hoàn tất ${parsed.barrierTime ? `(${parsed.barrierTime})` : ''}`
                      : parsed.barrierStatus === 'TIMEOUT'
                        ? 'Timeout (70s) - Xuất dữ liệu sẵn sàng'
                        : 'Đang chờ xử lý'}
                  </span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary, #a1a1aa)', fontWeight: 600 }}>
                    Khung thời gian lọc lệnh:
                  </span>{' '}
                  <span style={{ fontWeight: 800, fontFamily: 'monospace' }}>
                    {parsed.filterWindow ? `${parsed.filterWindow.start} - ${parsed.filterWindow.end}` : 'Theo ca'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Tab Raw Logs */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div
                  style={{
                    position: 'relative',
                    flex: 1,
                  }}
                >
                  <Search
                    size={14}
                    style={{
                      position: 'absolute',
                      left: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-secondary, #71717a)',
                    }}
                  />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm kiếm trong log (vd: ACM, MS, lỗi, thành công...)..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      borderRadius: '8px',
                      backgroundColor: 'var(--bg-input, #27272a)',
                      border: '1px solid var(--border-color, #3f3f46)',
                      color: 'var(--text-primary, #f4f4f5)',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyLogs}
                  disabled={logs.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input, #27272a)',
                    border: '1px solid var(--border-color, #3f3f46)',
                    color: 'var(--text-primary, #f4f4f5)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: logs.length > 0 ? 'pointer' : 'not-allowed',
                    opacity: logs.length > 0 ? 1 : 0.5,
                  }}
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép toàn bộ'}</span>
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#09090b',
                  borderRadius: '10px',
                  border: '1px solid #27272a',
                  padding: '14px',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  lineHeight: '1.6',
                  maxHeight: '460px',
                  overflowY: 'auto',
                  color: '#d4d4d8',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {filteredLogs.length === 0 ? (
                  <div style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>
                    {logs.length === 0 ? 'Chưa có dữ liệu nhật ký cho lượt này' : 'Không tìm thấy dòng log phù hợp'}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => {
                    const isError = log.includes('Lỗi') || log.includes('error') || log.includes('Thất bại');
                    const isWarn = log.includes('') || log.includes('CẢNH BÁO') || log.includes('ACM CHƯA CẮT');
                    const isSuccess = log.includes('thành công') || log.includes('Hoàn tất') || log.includes('KHỚP');

                    return (
                      <div
                        key={index}
                        style={{
                          color: isError ? '#f87171' : isWarn ? '#fbbf24' : isSuccess ? '#34d399' : '#d4d4d8',
                          padding: '1px 0',
                        }}
                      >
                        {log}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color, #27272a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-secondary, #71717a)',
          }}
        >
          <div>Dữ liệu đối soát tự động từ bot engine</div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input, #27272a)',
              border: '1px solid var(--border-color, #3f3f46)',
              color: 'var(--text-primary, #f4f4f5)',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

interface SourceStatusCardProps {
  milestone: {
    source: string;
    title: string;
    status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'SKIPPED' | 'PENDING';
    timestamp?: string;
    details?: string;
  };
  label: string;
  defaultFile: string;
}

const SourceStatusCard: React.FC<SourceStatusCardProps> = ({ milestone, label, defaultFile }) => {
  const isSuccess = milestone.status === 'SUCCESS';
  const isError = milestone.status === 'ERROR';
  const isSkipped = milestone.status === 'SKIPPED';

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-input, rgba(255, 255, 255, 0.02))',
        border: isSuccess
          ? '1px solid rgba(16, 185, 129, 0.3)'
          : isError
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : '1px solid var(--border-color, #27272a)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 800 }}>{label}</span>
        {isSuccess ? (
          <CheckCircle2 size={16} style={{ color: '#10b981' }} />
        ) : isError ? (
          <XCircle size={16} style={{ color: '#ef4444' }} />
        ) : isSkipped ? (
          <MinusCircle size={16} style={{ color: '#71717a' }} />
        ) : (
          <Clock size={16} style={{ color: '#f59e0b' }} />
        )}
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #a1a1aa)' }}>
        {defaultFile}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: isSuccess
              ? 'rgba(16, 185, 129, 0.15)'
              : isError
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(255, 255, 255, 0.06)',
            color: isSuccess ? '#10b981' : isError ? '#ef4444' : 'var(--text-secondary, #a1a1aa)',
          }}
        >
          {isSuccess ? 'Tải thành công' : isError ? 'Thất bại' : isSkipped ? 'Bỏ qua' : 'Đang xử lý'}
        </span>

        {milestone.timestamp && (
          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary, #f4f4f5)' }}>
            {milestone.timestamp}
          </span>
        )}
      </div>
    </div>
  );
};
