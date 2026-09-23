'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  Search,
  Folder,
  Download,
  Layers,
} from 'lucide-react';
import { API_BASE_URL } from '@/context/AuthContext';

export interface BackupLogSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string | null;
  jobType: 'MS' | 'CQG';
  token: string | null;
  selectedDate?: string;
}

interface ParsedBackupTarget {
  target: string;
  filename: string;
  status: 'SUCCESS' | 'ERROR' | 'DOWNLOADING' | 'PENDING';
  time?: string;
  error?: string;
  savedPath?: string;
}

export const BackupLogSummaryModal: React.FC<BackupLogSummaryModalProps> = ({
  isOpen,
  onClose,
  jobId,
  jobType,
  token,
  selectedDate,
}) => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'raw'>('summary');
  const [jobData, setJobData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch job details
  useEffect(() => {
    if (!isOpen || !jobId || !token) return;

    let isMounted = true;
    setLoading(true);

    const fetchJob = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setJobData(data);
          setLoading(false);
        }
      } catch {
        if (isMounted) setLoading(false);
      }
    };

    fetchJob();

    // Polling if job is PROCESSING or PENDING
    const interval = setInterval(() => {
      if (jobData?.status === 'PROCESSING' || jobData?.status === 'PENDING' || !jobData) {
        fetchJob();
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, jobId, token, jobData?.status]);

  const logs: string[] = useMemo(() => {
    return Array.isArray(jobData?.logs) ? jobData.logs : [];
  }, [jobData?.logs]);

  // Parse logs into structured summary
  const parsed = useMemo(() => {
    const targetsMap: Record<string, ParsedBackupTarget> = {};
    let destFolder = '';
    let startTime = '';
    let endTime = '';

    if (logs.length > 0) {
      for (const line of logs) {
        if (!line || typeof line !== 'string') continue;

        // Timestamp
        const timeMatch = line.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\]]*)\]/);
        let timeStr = '';
        if (timeMatch) {
          const d = new Date(timeMatch[1]);
          if (!isNaN(d.getTime())) {
            timeStr = d.toLocaleTimeString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZone: 'Asia/Ho_Chi_Minh',
            });
            if (!startTime) startTime = timeStr;
            endTime = timeStr;
          }
        }

        // Backup folder path
        if (line.includes('Backup MS folder:') || line.includes('Target Backup MS folder:')) {
          const match = line.match(/folder:\s*(.*)$/i);
          if (match) destFolder = match[1].trim();
        }

        // Downloading report: TARGET (as FILENAME)
        const dlMatch = line.match(/Downloading report:\s*([^\s(]+)\s*(?:\(as\s*([^)]+)\))?/i);
        if (dlMatch) {
          const target = dlMatch[1];
          const filename = dlMatch[2] || `${target}.xlsx`;
          if (!targetsMap[target]) {
            targetsMap[target] = {
              target,
              filename,
              status: 'DOWNLOADING',
              time: timeStr,
            };
          }
        }

        // Downloaded report: TARGET successfully
        const okMatch = line.match(/Downloaded report:\s*([^\s]+)\s*successfully/i);
        if (okMatch) {
          const target = okMatch[1];
          if (targetsMap[target]) {
            targetsMap[target].status = 'SUCCESS';
            targetsMap[target].time = timeStr;
          } else {
            targetsMap[target] = {
              target,
              filename: `${target}.xlsx`,
              status: 'SUCCESS',
              time: timeStr,
            };
          }
        }

        // Copied FILENAME to DEST
        const copyMatch = line.match(/Copied\s+([^\s]+)\s+to\s+(.*)$/i);
        if (copyMatch) {
          const filename = copyMatch[1];
          const savedPath = copyMatch[2].trim();
          for (const k of Object.keys(targetsMap)) {
            if (targetsMap[k].filename === filename || targetsMap[k].target === filename.replace(/\.xlsx$/i, '')) {
              targetsMap[k].savedPath = savedPath;
              targetsMap[k].status = 'SUCCESS';
            }
          }
        }

        // ERROR downloading TARGET: MSG
        const errMatch = line.match(/ERROR downloading\s+([^\s:]+)[:\s]+(.*)$/i);
        if (errMatch) {
          const target = errMatch[1];
          const error = errMatch[2].trim();
          if (targetsMap[target]) {
            targetsMap[target].status = 'ERROR';
            targetsMap[target].error = error;
            targetsMap[target].time = timeStr;
          } else {
            targetsMap[target] = {
              target,
              filename: `${target}.xlsx`,
              status: 'ERROR',
              error,
              time: timeStr,
            };
          }
        }
      }
    }

    // CQG Sync specific parsing
    if (jobType === 'CQG') {
      const cqgPairs = ['FR', 'PS', 'OP', 'OD', 'AS'];
      for (const pair of cqgPairs) {
        const hasPair = logs.some((l) => l.includes(`${pair}.xlsx`) || l.includes(`${pair}1`) || l.includes(`${pair}2`));
        if (hasPair && !targetsMap[pair]) {
          const isMerged = logs.some((l) => l.includes(`Đã ghép`) && l.includes(`${pair}.xlsx`));
          const isErr = logs.some((l) => l.includes(`Lỗi ghép`) && l.includes(`${pair}`));
          targetsMap[pair] = {
            target: pair,
            filename: `${pair}.xlsx`,
            status: isMerged ? 'SUCCESS' : isErr ? 'ERROR' : 'DOWNLOADING',
          };
        }
      }
    }

    const targetsList = Object.values(targetsMap);
    const successCount = targetsList.filter((t) => t.status === 'SUCCESS').length;
    const errorCount = targetsList.filter((t) => t.status === 'ERROR').length;
    const totalCount = targetsList.length;

    return {
      targetsList,
      destFolder,
      startTime,
      endTime,
      successCount,
      errorCount,
      totalCount,
    };
  }, [logs, jobType]);

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

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const isCompleted = jobData?.status === 'COMPLETED';
  const isFailed = jobData?.status === 'FAILED';
  const isProcessing = jobData?.status === 'PROCESSING' || jobData?.status === 'PENDING';

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
        backgroundColor: 'rgba(9, 14, 26, 0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '88vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--glass-shadow)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
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
                backgroundColor: jobType === 'MS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: jobType === 'MS' ? '#3b82f6' : '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {jobType === 'MS' ? <Download size={18} /> : <Layers size={18} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Nhật Ký Tải Báo Cáo {jobType === 'MS' ? 'M-System' : 'CQG'}
                </h3>
                {selectedDate && (
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-secondary, #a1a1aa)',
                    }}
                  >
                    Phiên {selectedDate}
                  </span>
                )}
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary, #a1a1aa)' }}>
                {jobType === 'MS'
                  ? 'Theo dõi tiến trình tải và lưu trữ 20 báo cáo vận hành M-System'
                  : 'Theo dõi tiến trình tải và đồng bộ các cặp file thô CQG'}
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
                Log chi tiết ({logs.length})
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

        {/* Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {!jobId ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary, #a1a1aa)' }}>
              <FileText size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: '0.85rem' }}>Chưa có lượt tải nào được ghi nhận trong phiên hiện tại.</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', opacity: 0.7 }}>
                Hãy bấm &quot;Tải Báo Cáo Đã Chọn&quot; để khởi động tiến trình tải tự động.
              </p>
            </div>
          ) : activeTab === 'summary' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Status Banner */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: isCompleted
                    ? '1px solid rgba(16, 185, 129, 0.3)'
                    : isFailed
                      ? '1px solid rgba(239, 68, 68, 0.3)'
                      : '1px solid rgba(14, 165, 233, 0.3)',
                  backgroundColor: isCompleted
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isFailed
                      ? 'rgba(239, 68, 68, 0.08)'
                      : 'rgba(14, 165, 233, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {isCompleted ? (
                    <CheckCircle2 size={24} style={{ color: '#10b981' }} />
                  ) : isFailed ? (
                    <XCircle size={24} style={{ color: '#ef4444' }} />
                  ) : (
                    <RefreshCw size={24} className="animate-spin" style={{ color: '#0ea5e9' }} />
                  )}
                  <div>
                    <div
                      style={{
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        color: isCompleted ? '#10b981' : isFailed ? '#ef4444' : '#0ea5e9',
                      }}
                    >
                      {isCompleted
                        ? 'HOÀN TẤT TẢI BÁO CÁO'
                        : isFailed
                          ? 'TIẾN TRÌNH KẾT THÚC CÓ CẢNH BÁO'
                          : 'ĐANG TẢI VÀ LƯU TRỮ DỮ LIỆU...'}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #a1a1aa)', marginTop: '2px' }}>
                      {parsed.totalCount > 0
                        ? `Đã xử lý: ${parsed.successCount}/${parsed.totalCount} file thành công${
                            parsed.errorCount > 0 ? ` (${parsed.errorCount} file lỗi)` : ''
                          }`
                        : isProcessing
                          ? 'Robot Playwright đang khởi động trình duyệt và đăng nhập...'
                          : 'Đã hoàn tất tiến trình'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
                  {parsed.startTime && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #a1a1aa)' }}>Khởi động</div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, fontFamily: 'monospace' }}>
                        {parsed.startTime}
                      </div>
                    </div>
                  )}
                  {parsed.endTime && (
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #a1a1aa)' }}>Cập nhật cuối</div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 800, fontFamily: 'monospace', color: '#0ea5e9' }}>
                        {parsed.endTime}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Folder Row */}
              {parsed.destFolder && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-input, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border-color, #27272a)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Folder size={16} style={{ color: '#0ea5e9', flexShrink: 0 }} />
                    <span style={{ color: 'var(--text-secondary, #a1a1aa)', fontWeight: 600, flexShrink: 0 }}>
                      Thư mục lưu trữ:
                    </span>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={parsed.destFolder}
                    >
                      {parsed.destFolder}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(parsed.destFolder);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color, #3f3f46)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      color: 'var(--text-primary, #f4f4f5)',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      flexShrink: 0,
                    }}
                  >
                    {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                    <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              )}

              {/* Targets Grid */}
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
                  Danh Sách Báo Cáo Trong Lượt Tải
                </div>

                {parsed.targetsList.length === 0 ? (
                  <div
                    style={{
                      padding: '24px',
                      borderRadius: '10px',
                      border: '1px dashed var(--border-color, #27272a)',
                      textAlign: 'center',
                      fontSize: '0.82rem',
                      color: 'var(--text-secondary, #a1a1aa)',
                    }}
                  >
                    {isProcessing ? 'Đang phân tích danh sách file tải về...' : 'Chưa có file nào được tải về.'}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                      gap: '10px',
                    }}
                  >
                    {parsed.targetsList.map((item) => {
                      const isOk = item.status === 'SUCCESS';
                      const isErr = item.status === 'ERROR';

                      return (
                        <div
                          key={item.target}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            backgroundColor: 'var(--bg-input, rgba(255, 255, 255, 0.02))',
                            border: isOk
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : isErr
                                ? '1px solid rgba(239, 68, 68, 0.3)'
                                : '1px solid var(--border-color, #27272a)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, fontFamily: 'monospace' }}>
                              {item.target}
                            </div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--text-secondary, #a1a1aa)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={item.filename}
                            >
                              {item.filename}
                            </div>
                            {item.error && (
                              <div
                                style={{
                                  fontSize: '0.7rem',
                                  color: '#ef4444',
                                  marginTop: '2px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={item.error}
                              >
                                {item.error}
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {item.time && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #71717a)', fontFamily: 'monospace' }}>
                                {item.time}
                              </span>
                            )}
                            {isOk ? (
                              <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                            ) : isErr ? (
                              <XCircle size={16} style={{ color: '#ef4444' }} />
                            ) : (
                              <RefreshCw size={14} className="animate-spin" style={{ color: '#0ea5e9' }} />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Tab Raw Logs */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
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
                    placeholder="Tìm kiếm trong log (vd: tải thành công, lỗi, tên file...)..."
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
                  {copied ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Đã sao chép' : 'Sao chép toàn bộ log'}</span>
                </button>
              </div>

              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  backgroundColor: '#09090b',
                  border: '1px solid #27272a',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  lineHeight: '1.6',
                  maxHeight: '450px',
                  overflowY: 'auto',
                }}
              >
                {filteredLogs.length === 0 ? (
                  <div style={{ color: '#71717a', textAlign: 'center', padding: '20px' }}>
                    {logs.length === 0 ? 'Chưa có dòng log nào được ghi nhận.' : 'Không tìm thấy log khớp từ khóa.'}
                  </div>
                ) : (
                  filteredLogs.map((line, idx) => {
                    const isErr = line.toLowerCase().includes('lỗi') || line.toLowerCase().includes('error');
                    const isOk = line.toLowerCase().includes('thành công') || line.toLowerCase().includes('copied');
                    return (
                      <div
                        key={idx}
                        style={{
                          color: isErr ? '#ef4444' : isOk ? '#10b981' : '#d4d4d8',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {line}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(255, 255, 255, 0.01)',
          }}
        >
          <div>
            {isProcessing ? 'Robot đang thực thi tác vụ ngầm...' : 'Dữ liệu được lưu trữ tự động trên ổ đĩa mạng'}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              padding: '7px 18px',
              fontSize: '0.82rem',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default BackupLogSummaryModal;
