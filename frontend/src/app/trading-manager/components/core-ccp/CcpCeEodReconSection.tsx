'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Clock,
  Search,
  Copy,
  FileText,
  Loader2,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  Database,
  Lock,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { useAppSocket } from '@/services/appSocket';
import { API_BASE_URL } from '@/context/AuthContext';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';

export interface CcpCeEodReconSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  onOpenGuide?: () => void;
  onStatusChange?: (status: {
    isDiffer: boolean;
    totalDifferLots: number;
    klgdStatus: string;
  }) => void;
  viewMode?: 'ALL' | 'MARGIN_ONLY' | 'EOD_ONLY';
  activeTab?: 'ALL' | 'EOD_RESULT' | 'NEGATIVE_MARGIN';
}

export default function CcpCeEodReconSection({
  token,
  selectedDate,
  onSelectDate,
  onOpenGuide,
  onStatusChange,
  viewMode = 'ALL',
  activeTab = 'ALL',
}: CcpCeEodReconSectionProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggeringSection, setTriggeringSection] = useState<'all' | 'margin' | 'eod_run' | null>(null);

  // Negative Margin state
  const [negativeMarginAccounts, setNegativeMarginAccounts] = useState<Array<{
    accountNumber: string;
    accountName?: string;
    marginRate?: number;
    cashBalance?: number;
    difference?: number;
  }>>([]);
  const [hasExecutedMargin, setHasExecutedMargin] = useState<boolean>(false);
  const [marginExecutedAt, setMarginExecutedAt] = useState<string | null>(null);
  const [marginDurationMs, setMarginDurationMs] = useState<number | null>(null);

  // EOD Run Result state (CoreCCP vs CoreEX)
  const [eodResults, setEodResults] = useState<Array<{
    account: string;
    qltkgd: number;
    eodResult: number;
    diff: number;
  }>>([]);
  const [hasExecutedEod, setHasExecutedEod] = useState<boolean>(false);
  const [eodExecutedAt, setEodExecutedAt] = useState<string | null>(null);
  const [eodDurationMs, setEodDurationMs] = useState<number | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Tính ngày phiên làm việc liền trước T-1 (bỏ qua Thứ Bảy, Chủ Nhật)
  const previousTradingDayFormatted = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const dt = new Date(selectedDate);
      dt.setDate(dt.getDate() - 1);
      if (dt.getDay() === 0) {
        dt.setDate(dt.getDate() - 2);
      } else if (dt.getDay() === 6) {
        dt.setDate(dt.getDate() - 1);
      }
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}/${m}/${y}`;
    } catch {
      return '';
    }
  }, [selectedDate]);

  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const dt = new Date(selectedDate);
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}/${m}/${y}`;
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  // Fetch summary data for selectedDate
  const fetchEodSummary = async (dateStr: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.tradingOps.getConsoleSummary(dateStr, undefined, token);
      if (data) {
        // 1. Tài khoản âm ký quỹ (EOD CoreCCP)
        const negJob = data?.negativeMargin;
        const ccpSummary = data?.ccpSummary;
        const ccpCheckJob = ccpSummary?.checkJob;
        const eodSource = data?.eodRun || data?.eod;

        const negExecuted = negJob?.executedAt || ccpCheckJob?.executedAt || eodSource?.executedAt;
        const negDuration = negJob?.durationMs ?? ccpCheckJob?.durationMs ?? eodSource?.durationMs ?? null;

        const rawAccs =
          (negJob?.accounts && negJob.accounts.length > 0 ? negJob.accounts : null) ||
          (negJob?.negativeIMRAcc && negJob.negativeIMRAcc.length > 0 ? negJob.negativeIMRAcc : null) ||
          (ccpSummary?.negativeIMRAcc && ccpSummary.negativeIMRAcc.length > 0 ? ccpSummary.negativeIMRAcc : null) ||
          (ccpSummary?.negativeBalanceAccs && ccpSummary.negativeBalanceAccs.length > 0 ? ccpSummary.negativeBalanceAccs : null) ||
          ccpCheckJob?.result?.negativeIMRAcc ||
          ccpCheckJob?.result?.negativeBalanceAccs ||
          eodSource?.negativeIMRAcc ||
          eodSource?.negativeBalanceAccs ||
          [];

        const isNegDone = !!(
          negExecuted ||
          (negJob && negJob.status === 'COMPLETED') ||
          (ccpCheckJob && ccpCheckJob.status === 'COMPLETED') ||
          (eodSource && eodSource.status === 'COMPLETED' && eodSource.jobType === 'CHECK_EOD_CCP')
        );

        if (isNegDone) {
          setHasExecutedMargin(true);
          setMarginExecutedAt(negExecuted || null);
          setMarginDurationMs(negDuration);
          setNegativeMarginAccounts(
            rawAccs.map((a: any) => (typeof a === 'string' ? { accountNumber: a } : a))
          );
        } else {
          setHasExecutedMargin(false);
          setMarginExecutedAt(null);
          setMarginDurationMs(null);
          setNegativeMarginAccounts([]);
        }

        // 2. Kết quả chạy EOD (CoreCCP ↔ CoreEX)
        const eodExecuted = eodSource?.executedAt || ccpCheckJob?.executedAt;
        const eodDuration = eodSource?.durationMs ?? ccpCheckJob?.durationMs ?? null;
        const isEodDone = !!(
          eodExecuted ||
          (eodSource && (eodSource.status === 'COMPLETED' || eodSource.jobId)) ||
          (ccpCheckJob && ccpCheckJob.status === 'COMPLETED')
        );

        if (isEodDone) {
          setHasExecutedEod(true);
          setEodExecutedAt(eodExecuted || null);
          setEodDurationMs(eodDuration);
          const rawResults =
            eodSource?.results ||
            eodSource?.mismatchedEOD ||
            ccpSummary?.mismatchedAccounts ||
            ccpCheckJob?.result?.mismatchedEOD ||
            [];
          setEodResults(
            rawResults.map((item: any) => ({
              account: item.account || item.maTKGD || '',
              qltkgd: item.qltkgd ?? item.calculatedBalance ?? 0,
              eodResult: item.eodResult ?? item.eodBalance ?? 0,
              diff: item.diff ?? item.differ ?? 0,
            }))
          );
        } else {
          setHasExecutedEod(false);
          setEodExecutedAt(null);
          setEodDurationMs(null);
          setEodResults([]);
        }

        // Tự động dừng polling khi tác vụ đã hoàn thành
        if (isNegDone && isEodDone && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setTriggering(false);
          setTriggeringSection(null);
        }
      }
    } catch {
      // Ignore network errors in polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && selectedDate) {
      fetchEodSummary(selectedDate);
    }
  }, [token, selectedDate]);

  const fetchEodSummaryRef = useRef(fetchEodSummary);
  useEffect(() => {
    fetchEodSummaryRef.current = fetchEodSummary;
  }, [fetchEodSummary]);

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Lắng nghe WebSocket để tự động refresh giao diện ngay khi có lượt chạy EOD / Dsgd-Before-EOD mới (AppSocket Singleton)
  useAppSocket(
    {
      'dashboard-updated': () => {
        if (selectedDateRef.current) {
          fetchEodSummaryRef.current?.(selectedDateRef.current);
        }
      },
      'job-status-updated': () => {
        if (selectedDateRef.current) {
          fetchEodSummaryRef.current?.(selectedDateRef.current);
        }
      },
    },
    Boolean(token && selectedDate),
  );

  // Formatter định dạng thời gian và thời lượng chuẩn tương tự GTT
  const formatRunTime = (isoString?: string | null) => {
    if (!isoString) return null;
    try {
      return new Date(isoString).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDuration = (ms?: number | null) => {
    if (!ms || ms <= 0) return null;
    const sec = Math.round(ms / 1000);
    if (sec >= 60) {
      return `${Math.floor(sec / 60)}p ${sec % 60}s`;
    }
    return `${sec}s`;
  };

  // Thời gian chạy gần nhất tổng thể cho phân hệ EOD
  const latestRunTime = eodExecutedAt || marginExecutedAt;
  const latestDurationMs = eodDurationMs || marginDurationMs;
  const formattedLatestRunTime = formatRunTime(latestRunTime);
  const formattedLatestDuration = formatDuration(latestDurationMs);

  // Trigger Action Handlers
  const handleTriggerCheck = async (type: 'margin' | 'eod_run') => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection(type);

    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const actionLabel =
      type === 'margin'
        ? `kiểm tra âm ký quỹ CoreCCP (Phiên T-1: ${previousTradingDayFormatted})`
        : `kiểm tra số dư EOD CoreCCP (Phiên T-1: ${previousTradingDayFormatted})`;

    const toastId = toast.loading(`Đang khởi chạy ${actionLabel}...`);

    try {
      let data: any;
      if (type === 'margin') {
        data = await api.tradingOps.checkNegativeMargin(selectedDate, token, { system: 'CCP', scope: 'CCP' });
      } else {
        data = await api.tradingOps.checkEodRun(selectedDate, token);
      }

      toast.success(
        data?.message || `Robot đang chạy ${actionLabel} ngầm. Kết quả sẽ tự động cập nhật!`,
        { id: toastId, duration: 4000 }
      );

      await fetchEodSummary(selectedDate);

      // Tự động thăm dò kết quả mỗi 2.5 giây cho đến khi hoàn thành
      let pollCount = 0;
      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        await fetchEodSummary(selectedDate);
        if (pollCount >= 12) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setTriggering(false);
          setTriggeringSection(null);
        }
      }, 2500);
    } catch (err: any) {
      toast.error(`Lỗi thực hiện: ${err.message}`, { id: toastId });
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ===== THANH ĐIỀU KHIỂN PHIÊN ĐỐI SOÁT EOD CCP & CE (ẨN KHI EOD_ONLY) ===== */}
      {viewMode !== 'EOD_ONLY' && (
        <div
          className="glass-panel"
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar size={18} color="#3b82f6" />
            <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Phiên đối soát EOD CCP & CE:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate?.(e.target.value)}
              className="form-input"
              style={{
                width: '150px',
                height: '36px',
                fontSize: '0.84rem',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            />
            <button
              type="button"
              onClick={() => onSelectDate?.(getInitialTradingSessionDate())}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
            >
              Hôm nay
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fetchEodSummary(selectedDate)}
              disabled={loading}
              className="btn btn-primary"
              style={{
                fontSize: '0.82rem',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới dữ liệu EOD</span>
            </button>
          </div>
        </div>
      )}

      {/* ===== NHÃN PHỤ TRỰC QUAN PHIÊN T-1 (EOD CHỐT SỔ) ===== */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Info size={16} color="#3b82f6" />
          <span style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 700 }}>
            Đối chiếu kết quả chốt sổ EOD phiên T-1: <strong>{previousTradingDayFormatted}</strong> (Phiên ca trực: <strong>{selectedDateFormatted}</strong>)
          </span>
        </div>
        {formattedLatestRunTime && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            (Lần chạy gần nhất: {formattedLatestRunTime} {formattedLatestDuration ? `• ${formattedLatestDuration}` : ''})
          </span>
        )}
      </div>

      {/* ===== KHUNG 2 CỘT SONG SONG: ÂM KÝ QUỸ & KẾT QUẢ CHẠY EOD ===== */}
      <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              activeTab === 'EOD_RESULT' || activeTab === 'NEGATIVE_MARGIN'
                ? '1fr'
                : 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '20px',
          }}
        >
          {/* CỘT TRÁI: Tài khoản âm ký quỹ mới (EOD CoreCCP) */}
          {(!activeTab || activeTab === 'ALL' || activeTab === 'NEGATIVE_MARGIN') && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Tài khoản âm ký quỹ mới (EOD CoreCCP)
                    </h5>
                    {hasExecutedMargin && marginExecutedAt && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        (Lần chạy gần nhất: {formatRunTime(marginExecutedAt)} {formatDuration(marginDurationMs) ? `• ${formatDuration(marginDurationMs)}` : ''})
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>
                    Đối chiếu phiên T-1: {previousTradingDayFormatted} (Phiên ca trực: {selectedDateFormatted})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerCheck('margin')}
                  disabled={triggering}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {triggering && triggeringSection === 'margin' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    'Check'
                  )}
                </button>
              </div>

              <div style={{ height: '180px', minHeight: '160px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
                    <tr
                      style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <th style={{ padding: '10px 16px' }}>
                        TKGD âm KQ mới ({hasExecutedMargin ? negativeMarginAccounts.length : 0})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasExecutedMargin ? (
                      <tr>
                        <td style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                          Chưa chạy kiểm tra tài khoản âm ký quỹ CoreCCP phiên T-1 ({previousTradingDayFormatted}). Bấm <b>Check</b> để thực hiện.
                        </td>
                      </tr>
                    ) : negativeMarginAccounts.length === 0 ? (
                      <tr>
                        <td style={{ padding: '36px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={36} color="#10b981" />
                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
                              An Toàn: Không có tài khoản âm ký quỹ mới (CoreCCP)
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                              Kiểm tra lúc: {formatRunTime(marginExecutedAt) || '--:--'} {formatDuration(marginDurationMs) ? `• ${formatDuration(marginDurationMs)}` : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      negativeMarginAccounts.map((acc, idx) => (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239, 68, 68, 0.08)',
                          }}
                        >
                          <td style={{ padding: '10px 16px', fontSize: '0.84rem', fontFamily: 'monospace', color: '#ef4444', fontWeight: 700 }}>
                            {acc.accountNumber} {acc.accountName ? `- ${acc.accountName}` : ''} {acc.difference !== undefined ? `(Âm: ${acc.difference.toLocaleString('en-US')} VND)` : ''}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CỘT PHẢI: Kết quả chạy EOD (CoreCCP ↔ CoreEX) */}
          {(!activeTab || activeTab === 'ALL' || activeTab === 'EOD_RESULT') && (
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Kết quả chạy EOD (Số dư QLTKGD ↔ Số dư EOD CoreCCP)
                    </h5>
                    {hasExecutedEod && eodExecutedAt && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                        (Lần chạy gần nhất: {formatRunTime(eodExecutedAt)} {formatDuration(eodDurationMs) ? `• ${formatDuration(eodDurationMs)}` : ''})
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#3b82f6', fontWeight: 700 }}>
                    Đối chiếu phiên T-1: {previousTradingDayFormatted} (Phiên ca trực: {selectedDateFormatted})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleTriggerCheck('eod_run')}
                  disabled={triggering}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {triggering && triggeringSection === 'eod_run' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    'Check'
                  )}
                </button>
              </div>

              <div style={{ height: '180px', minHeight: '160px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
                    <tr
                      style={{
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-color)',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>TKGD</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số dư QLTKGD</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Số dư EOD (Chốt sổ)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasExecutedEod ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa chạy kiểm tra số liệu EOD CoreCCP phiên T-1 ({previousTradingDayFormatted}). Bấm <b>Check</b> để thực hiện.
                        </td>
                      </tr>
                    ) : eodResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '36px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={36} color="#10b981" />
                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
                              Khớp 100%: Tất cả số dư tài khoản khớp hoàn toàn với kết quả chạy EOD CoreCCP
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>
                              Kiểm tra lúc: {formatRunTime(eodExecutedAt) || '--:--'} {formatDuration(eodDurationMs) ? `• ${formatDuration(eodDurationMs)}` : ''}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      eodResults.map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{row.account}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {row.qltkgd?.toLocaleString('en-US')}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {row.eodResult?.toLocaleString('en-US')}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'center',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              color: row.diff === 0 ? '#10b981' : '#ef4444',
                            }}
                          >
                            {row.diff === 0 ? 'Khớp' : row.diff?.toLocaleString('en-US')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
