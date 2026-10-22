'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sliders,
  RefreshCw,
  Copy,
  FileSpreadsheet,
  Check,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseWindowsStoragePath } from '@/config/storage-path.config';
import { tradingOpsApi } from '@/features/trading/services/trading-ops.api';
import CheckDsgdBeforeEodModal from '@/features/trading/components/CheckDsgdBeforeEodModal';

export interface DsgdBeforeEodSectionProps {
  token?: string | null;
  selectedDate: string;
  onStatusChange?: (status: { passed: boolean; differTotal: number }) => void;
  system?: 'MS' | 'CCP';
}

export interface CheckDsgdResult {
  passed: boolean;
  system?: 'MS' | 'CCP';
  totalOriginal: number;
  totalTemp: number;
  totalACMMS: number;
  totalACMSFTP: number;
  differTotal: number;
  differACM: number;
  messages: string[];
  sessionDate: string;
  timeSuffix?: string;
  isSnapshotMissing?: boolean;
  warning?: string;
  filesFound?: {
    dsgdOriginal?: string;
    dsgdTemp?: string;
    acmTrades?: string;
  };
}

export default function DsgdBeforeEodSection({
  token,
  selectedDate,
  onStatusChange,
  system = 'MS',
}: DsgdBeforeEodSectionProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<CheckDsgdResult | null>(null);
  const [hasChecked, setHasChecked] = useState<boolean>(false);
  const [executedAt, setExecutedAt] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [showAdvancedModal, setShowAdvancedModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);

  // Format helper
  const fmtNum = (v?: number) => (v !== undefined && v !== null ? v.toLocaleString('en-US') : '0');

  const formatRunTime = (isoString?: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  };

  const formatDuration = (ms?: number | null) => {
    if (ms === null || ms === undefined || ms < 0) return '';
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) return `${minutes}p ${seconds}s`;
    return `${seconds}s`;
  };

  // Chuyển đổi đường dẫn Linux mount sang đường dẫn Windows ổ M:\Tailieuchung\QLGD-IT
  const toWindowsDisplayPath = (rawPath?: string) => {
    if (!rawPath) return '';
    const parsed = parseWindowsStoragePath(rawPath);
    return parsed?.suggestedPath || rawPath.replace(/\//g, '\\');
  };

  const handleCopyPath = (pathText?: string, label = 'đường dẫn') => {
    if (!pathText) return;
    const winPath = toWindowsDisplayPath(pathText);
    navigator.clipboard.writeText(winPath);
    toast.success(`Đã sao chép ${label} Windows!`);
  };

  // Load state on mount or date/system change
  useEffect(() => {
    let isCancelled = false;
    const cacheKey = `dsgd_before_eod_${system}_${selectedDate}`;

    // 1. Phục hồi nhanh từ cache để UI không bị giật / mất dữ liệu khi chuyển tab
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.result) {
          setResult(parsed.result);
          setHasChecked(true);
          setExecutedAt(parsed.executedAt || null);
          setDurationMs(parsed.durationMs || null);
        }
      } else {
        setResult(null);
        setHasChecked(false);
        setExecutedAt(null);
        setDurationMs(null);
      }
    } catch {
      setResult(null);
      setHasChecked(false);
      setExecutedAt(null);
      setDurationMs(null);
    }

    // 2. Fetch kết quả đối chiếu gần nhất từ máy chủ backend
    if (token) {
      tradingOpsApi
        .getLatestDsgdBeforeEod({ system, tradingDate: selectedDate }, token)
        .then((res) => {
          if (isCancelled) return;
          if (res && res.success && res.result) {
            setResult(res.result);
            setHasChecked(true);
            setExecutedAt(res.executedAt || null);
            setDurationMs(res.durationMs || null);

            try {
              sessionStorage.setItem(
                cacheKey,
                JSON.stringify({
                  result: res.result,
                  executedAt: res.executedAt,
                  durationMs: res.durationMs,
                }),
              );
            } catch {}

            if (onStatusChange) {
              onStatusChange({
                passed: res.result.passed,
                differTotal: res.result.differTotal || 0,
              });
            }
          }
        })
        .catch(() => {});
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedDate, system, token]);

  // Quick check handler
  const handleRunQuickCheck = async () => {
    if (!token || loading) return;
    setLoading(true);
    const startTime = Date.now();
    const toastId = toast.loading(`Đang quét và đối chiếu DSGD trước EOD (${system})...`);

    try {
      const res = await tradingOpsApi.checkDsgdBeforeEod(
        {
          system,
          tradingDate: selectedDate,
          exactDate: false,
          triggerDownload: true,
        },
        token,
      );

      if (res && res.result) {
        const data: CheckDsgdResult = res.result;
        const dur = res.durationMs ?? (Date.now() - startTime);
        const execAt = res.executedAt ?? new Date().toISOString();

        setResult(data);
        setHasChecked(true);
        setExecutedAt(execAt);
        setDurationMs(dur);

        try {
          const cacheKey = `dsgd_before_eod_${system}_${selectedDate}`;
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              result: data,
              executedAt: execAt,
              durationMs: dur,
            }),
          );
        } catch {}

        if (onStatusChange) {
          onStatusChange({
            passed: data.passed,
            differTotal: data.differTotal || 0,
          });
        }

        if (data.passed) {
          toast.success('Đối chiếu DSGD trước EOD: KHỚP 100%!', { id: toastId });
        } else if (data.isSnapshotMissing) {
          toast.error('CẢNH BÁO AN TOÀN: Thiếu file snapshot DSGD trước EOD!', { id: toastId });
        } else {
          toast.error(`Phát hiện chênh lệch: ${data.differTotal} lot!`, { id: toastId });
        }
      } else {
        toast.error(res?.message || 'Không nhận được kết quả từ máy chủ', { id: toastId });
      }
    } catch (err: any) {
      console.error('Lỗi khi gọi checkDsgdBeforeEod:', err);
      toast.error(err.message || 'Lỗi khi gọi API kiểm tra DSGD trước EOD', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Sync result from modal
  const handleModalSuccess = (modalResult: any) => {
    if (modalResult) {
      setResult(modalResult);
      setHasChecked(true);
      const execAt = new Date().toISOString();
      setExecutedAt(execAt);
      try {
        const cacheKey = `dsgd_before_eod_${system}_${selectedDate}`;
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            result: modalResult,
            executedAt: execAt,
            durationMs,
          }),
        );
      } catch {}
      if (onStatusChange) {
        onStatusChange({
          passed: modalResult.passed,
          differTotal: modalResult.differTotal || 0,
        });
      }
    }
  };

  // Copy report to clipboard
  const handleCopyReport = () => {
    if (!result) return;
    const reportText = `[KIỂM TRA DSGD TRƯỚC EOD (${system}) (CheckDSGDBeforeEOD)]
Phiên đối chiếu: ${result.sessionDate || selectedDate}
Phân hệ: ${system === 'CCP' ? 'CoreCCP' : 'M-System'}
Thời gian kiểm tra: ${formatRunTime(executedAt) || 'N/A'}${durationMs ? ` (${formatDuration(durationMs)})` : ''}
- DSGD gốc / backup T-1 (${system}): ${result.totalOriginal?.toLocaleString('en-US')} lot
- DSGD snapshot / tươi API T-1 (${system}): ${result.totalTemp?.toLocaleString('en-US')} lot
- Chênh lệch tổng: ${result.differTotal} lot
- ACM ${system}: ${result.totalACMMS?.toLocaleString('en-US')} lot
- ACM Straits SFTP: ${result.totalACMSFTP?.toLocaleString('en-US')} lot
- Chênh lệch tự doanh ACM: ${result.differACM} lot
Trạng thái: ${result.passed ? 'KHỚP 100%' : result.isSnapshotMissing ? 'THIẾU FILE SNAPSHOT / TƯƠI API' : 'CHÊNH LỆCH'}`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    toast.success('Đã sao chép báo cáo DSGD trước EOD vào clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
            }}
          >
            <ShieldCheck size={18} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Kiểm tra DSGD trước EOD - Phân hệ {system === 'CCP' ? 'CoreCCP' : 'M-System'} (CheckDSGDBeforeEOD)
            </h4>

            {/* Hover Tooltip Chú thích tệp tin & công thức */}
            <div
              style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <span
                style={{
                  cursor: 'help',
                  color: showTooltip ? '#3b82f6' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  backgroundColor: showTooltip ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <Info size={15} />
              </span>

              {showTooltip && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: '0',
                    zIndex: 9999,
                    width: '390px',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.35)',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    color: 'var(--text-primary)',
                    pointerEvents: 'none',
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#3b82f6', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileSpreadsheet size={14} />
                    <span>Các tệp tin đầu vào bắt buộc ({system}):</span>
                  </div>
                  <ul style={{ margin: '0 0 8px 0', paddingLeft: '18px', color: 'var(--text-secondary)' }}>
                    {system === 'CCP' ? (
                      <>
                        <li>
                          <strong>DSGD CCP / DSGD_&#123;date&#125;.xlsx</strong>: File backup T-1 lưu tại Backup CCP\Futures.
                        </li>
                        <li>
                          <strong>Báo cáo tươi gọi API</strong>: ORDERMATCH_DETAIL gọi qua API CoreCCP với ngày T-1.
                        </li>
                        <li>
                          <strong>Straits CSV</strong>: File giao dịch từ SFTP Straits (<code>EOD FO trades_PT Straits...csv</code>).
                        </li>
                      </>
                    ) : (
                      <>
                        <li>
                          <strong>DSGD.xlsx</strong>: Bản gốc đầu ngày lưu tại Backup MS\Futures hoặc TradingCheck.
                        </li>
                        <li>
                          <strong>DSGD&#123;timeSuffix&#125;.xlsx</strong>: Bản snapshot chốt phiên chiều (ví dụ: <code>DSGD172842.xlsx</code>).
                        </li>
                        <li>
                          <strong>Straits CSV</strong>: File giao dịch từ SFTP Straits (<code>EOD FO trades_PT Straits...csv</code>).
                        </li>
                      </>
                    )}
                  </ul>
                  <div style={{ paddingTop: '6px', borderTop: '1px dashed var(--border-color)', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    <strong>Công thức đối chiếu core:</strong>
                    <div>• Tổng KLGD: |TotalOriginal - TotalTemp| &le; 0.0001 lot</div>
                    <div>• Khớp ACM tự doanh: |TotalACM_{system} - TotalACM_Straits| &le; 0.0001 lot</div>
                  </div>
                </div>
              )}
            </div>

            {hasChecked && executedAt && (
              <span
                style={{
                  fontSize: '0.74rem',
                  color: result?.passed ? '#10b981' : '#f59e0b',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginLeft: '4px',
                }}
              >
                (Lần chạy gần nhất: {formatRunTime(executedAt)}
                {durationMs !== null && durationMs !== undefined ? ` • ${formatDuration(durationMs)}` : ''})
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          {!hasChecked ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Clock size={13} />
              <span>Chưa kiểm tra phiên này</span>
            </span>
          ) : result?.passed ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={13} />
              <span>Khớp hoàn toàn</span>
            </span>
          ) : result?.isSnapshotMissing ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Thiếu snapshot</span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Phát hiện chênh lệch ({result?.differTotal} lot)</span>
            </span>
          )}

          {/* Button Options */}
          <button
            type="button"
            onClick={() => setShowAdvancedModal(true)}
            className="btn btn-secondary"
            title="Mở hộp thoại cấu hình chi tiết (timeSuffix, tải file)"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Sliders size={13} />
            <span>Tùy chọn...</span>
          </button>

          {/* Button Copy Report */}
          <button
            type="button"
            onClick={handleCopyReport}
            disabled={!hasChecked}
            className="btn btn-secondary"
            title="Sao chép toàn bộ kết quả kiểm tra vào clipboard"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              opacity: !hasChecked ? 0.6 : 1,
            }}
          >
            {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
            <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
          </button>

          {/* Button Check Quick */}
          <button
            type="button"
            onClick={handleRunQuickCheck}
            disabled={loading}
            className="btn btn-primary"
            style={{
              fontSize: '0.75rem',
              padding: '6px 16px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Đang quét...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={13} />
                <span>Check DSGD Trước EOD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Row: 4 Metric Cards (Matching LegacyDsgdBeforeEodDiffSection Part 1) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Card 1: ACM / Tự Doanh */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              ACM / Tự Doanh ({system === 'CCP' ? 'CCP' : 'MS'} vs Straits)
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: (result?.differACM ?? 0) === 0 ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              Lệch: {fmtNum(result?.differACM)} lot
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {fmtNum(result?.totalACMMS)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
              {fmtNum(result?.totalACMSFTP)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lot</span>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {system === 'CCP' ? 'CoreCCP (đuôi A) vs Straits CSV' : 'M-System (đuôi A) vs Straits CSV'}
          </span>
        </div>

        {/* Card 2: DSGD Gốc vs Snapshot Chiều */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              {system === 'CCP' ? 'DSGD Backup T-1 vs Gọi API T-1 (CCP)' : 'DSGD Gốc vs Snapshot (MS)'}
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: (result?.differTotal ?? 0) === 0 && !result?.isSnapshotMissing ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              Lệch: {fmtNum(result?.differTotal)} lot
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {fmtNum(result?.totalOriginal)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>vs</span>
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
              {result?.isSnapshotMissing ? '0' : fmtNum(result?.totalTemp)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lot</span>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {system === 'CCP' ? 'File Backup T-1 vs Gọi API CoreCCP T-1' : 'M-System gốc vs Snapshot chốt chiều'}
          </span>
        </div>

        {/* Card 3: LỆNH KHỚP LỆCH (TRADES) */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Lệnh khớp lệch (Trades)
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: (result?.differTotal ?? 0) === 0 && !result?.isSnapshotMissing ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              {result?.passed ? 'Khớp 100%' : hasChecked ? 'Chênh lệch' : '0 lệnh'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: (result?.differTotal ?? 0) === 0 && !result?.isSnapshotMissing ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              {fmtNum(result?.differTotal)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lệnh chênh lệch</span>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Lệnh thiếu/lệch giữa gốc và snapshot
          </span>
        </div>

        {/* Card 4: TRẠNG THÁI SNAPSHOT & AN TOÀN */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Trạng thái Snapshot & An toàn
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: result?.isSnapshotMissing ? '#f59e0b' : hasChecked ? '#10b981' : 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {result?.isSnapshotMissing ? 'Thiếu file' : hasChecked ? 'Đạt chuẩn' : 'Chờ kiểm tra'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <span
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: result?.isSnapshotMissing ? '#f59e0b' : hasChecked ? '#10b981' : 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              {result?.isSnapshotMissing ? 'Thiếu snapshot' : hasChecked ? 'An toàn' : '0 cảnh báo'}
            </span>
          </div>

          <span
            style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              cursor: result?.filesFound?.dsgdTemp ? 'pointer' : 'default',
            }}
            title={result?.filesFound?.dsgdTemp ? `Bấm để sao chép đường dẫn Windows:\n${toWindowsDisplayPath(result.filesFound.dsgdTemp)}` : undefined}
            onClick={() => result?.filesFound?.dsgdTemp && handleCopyPath(result.filesFound.dsgdTemp, 'DSGD Snapshot')}
          >
            {result?.filesFound?.dsgdTemp ? `Tệp: ${toWindowsDisplayPath(result.filesFound.dsgdTemp)}` : 'Kiểm tra tệp snapshot DSGD chiều'}
          </span>
        </div>
      </div>

      {/* 3. Subtabs Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px 0 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <div
            style={{
              padding: '10px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: '2px solid #3b82f6',
              color: '#3b82f6',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Chi tiết đối soát</span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: (result?.messages?.length ?? 0) > 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: (result?.messages?.length ?? 0) > 0 ? '#3b82f6' : 'var(--text-muted)',
              }}
            >
              {result?.messages?.length ?? 0}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Content Area (Fixed Height with Internal Scroll) */}
      <div style={{ maxHeight: '240px', minHeight: '160px', overflowY: 'auto', padding: '16px 20px' }}>
        {!hasChecked ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Clock size={30} color="var(--text-muted)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Chưa chạy kiểm tra DSGD trước EOD phiên này. Nhấn &ldquo;Check DSGD Trước EOD&rdquo; để quét.
            </span>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              {system === 'CCP'
                ? 'Hệ thống sẽ đối chiếu file DSGD backup T-1 với file tươi gọi qua API CoreCCP T-1 và khớp lệnh tự doanh ACM (CCP vs Straits CSV).'
                : 'Hệ thống sẽ đối chiếu file DSGD gốc với snapshot chốt chiều và khớp lệnh tự doanh ACM (MS vs Straits CSV).'}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Missing Snapshot Alert */}
            {result?.isSnapshotMissing && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', display: 'block' }}>
                    CẢNH BÁO AN TOÀN DỮ LIỆU: THIẾU FILE SNAPSHOT TRƯỚC EOD!
                  </span>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', display: 'block', marginTop: '2px' }}>
                    Không tìm thấy file snapshot <code>DSGD*.xlsx</code> chụp trong khung giờ chiều. Hệ thống đã chặn so sánh với chính file gốc để chống báo thành công ảo.
                  </span>
                </div>
              </div>
            )}

            {/* Danh sách 3 tệp tin đã nạp */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '10px',
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: result?.filesFound?.dsgdOriginal ? 'pointer' : 'default',
                  transition: 'background-color 0.15s ease',
                }}
                title={result?.filesFound?.dsgdOriginal ? `Bấm để sao chép đường dẫn Windows:\n${toWindowsDisplayPath(result.filesFound.dsgdOriginal)}` : undefined}
                onClick={() => result?.filesFound?.dsgdOriginal && handleCopyPath(result.filesFound.dsgdOriginal, 'DSGD Gốc')}
              >
                <FileSpreadsheet size={16} color="#3b82f6" />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DSGD Gốc:</span>
                    {result?.filesFound?.dsgdOriginal && <Copy size={11} color="var(--text-muted)" />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: result?.filesFound?.dsgdOriginal ? '#10b981' : '#ef4444',
                      wordBreak: 'break-all',
                    }}
                  >
                    {result?.filesFound?.dsgdOriginal ? toWindowsDisplayPath(result.filesFound.dsgdOriginal) : 'Chưa tìm thấy'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: result?.filesFound?.dsgdTemp ? 'pointer' : 'default',
                  transition: 'background-color 0.15s ease',
                }}
                title={result?.filesFound?.dsgdTemp ? `Bấm để sao chép đường dẫn Windows:\n${toWindowsDisplayPath(result.filesFound.dsgdTemp)}` : undefined}
                onClick={() => result?.filesFound?.dsgdTemp && handleCopyPath(result.filesFound.dsgdTemp, 'DSGD Snapshot')}
              >
                <FileSpreadsheet size={16} color="#10b981" />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>DSGD Snapshot:</span>
                    {result?.filesFound?.dsgdTemp && <Copy size={11} color="var(--text-muted)" />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: result?.filesFound?.dsgdTemp ? '#10b981' : '#f59e0b',
                      wordBreak: 'break-all',
                    }}
                  >
                    {result?.filesFound?.dsgdTemp ? toWindowsDisplayPath(result.filesFound.dsgdTemp) : 'Không tìm thấy snapshot'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: result?.filesFound?.acmTrades ? 'pointer' : 'default',
                  transition: 'background-color 0.15s ease',
                }}
                title={result?.filesFound?.acmTrades ? `Bấm để sao chép đường dẫn Windows:\n${toWindowsDisplayPath(result.filesFound.acmTrades)}` : undefined}
                onClick={() => result?.filesFound?.acmTrades && handleCopyPath(result.filesFound.acmTrades, 'Straits CSV')}
              >
                <FileSpreadsheet size={16} color="#a855f7" />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Straits CSV:</span>
                    {result?.filesFound?.acmTrades && <Copy size={11} color="var(--text-muted)" />}
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: result?.filesFound?.acmTrades ? '#10b981' : '#ef4444',
                      wordBreak: 'break-all',
                    }}
                  >
                    {result?.filesFound?.acmTrades ? toWindowsDisplayPath(result.filesFound.acmTrades) : 'Chưa tìm thấy'}
                  </span>
                </div>
              </div>
            </div>

            {/* Thông báo phân tích chi tiết */}
            {result?.messages && result.messages.length > 0 && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontFamily: 'monospace',
                  fontSize: '0.74rem',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Nhật ký đối soát chi tiết:
                </span>
                {result.messages.map((msg, idx) => (
                  <div key={idx} style={{ color: msg.includes('FAIL') || msg.includes('CẢNH BÁO') ? '#ef4444' : 'var(--text-primary)' }}>
                    • {msg}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CheckDsgdBeforeEodModal
        isOpen={showAdvancedModal}
        onClose={() => setShowAdvancedModal(false)}
        defaultDate={selectedDate}
        system={system}
        onSuccess={handleModalSuccess}
      />
    </div>
  );
}
