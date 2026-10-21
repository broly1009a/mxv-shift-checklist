'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { io } from 'socket.io-client';
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

  // EOD Run Result state (CoreCCP vs CoreEX)
  const [eodResults, setEodResults] = useState<Array<{
    account: string;
    qltkgd: number;
    eodResult: number;
    diff: number;
  }>>([]);
  const [hasExecutedEod, setHasExecutedEod] = useState<boolean>(false);
  const [eodExecutedAt, setEodExecutedAt] = useState<string | null>(null);

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

  // Fetch summary data for selectedDate
  const fetchEodSummary = async (dateStr: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.tradingOps.getConsoleSummary(dateStr, undefined, token);
      if (data) {
        // 1. Tài khoản âm ký quỹ (EOD CoreCCP)
        const negJob = data?.negativeMargin;
        const ccpTotals = data?.ccpSummary?.totals;
        const negExecuted = negJob?.executedAt || data?.ccpSummary?.checkJob?.executedAt;
        if (negExecuted || (negJob?.negativeIMRAcc && negJob.negativeIMRAcc.length > 0) || (ccpTotals?.negativeIMRCount && ccpTotals.negativeIMRCount > 0)) {
          setHasExecutedMargin(true);
          setMarginExecutedAt(negExecuted || null);
          const rawAccs = negJob?.accounts || negJob?.negativeIMRAcc || negJob?.negativeBalanceAccs || ccpTotals?.negativeIMRAcc || [];
          setNegativeMarginAccounts(
            rawAccs.map((a: any) => (typeof a === 'string' ? { accountNumber: a } : a))
          );
        } else {
          setHasExecutedMargin(false);
          setMarginExecutedAt(null);
          setNegativeMarginAccounts([]);
        }

        // 2. Kết quả chạy EOD (CoreCCP ↔ CoreEX)
        const eodSource = data?.eodRun || data?.eod;
        const ccpCheckJob = data?.ccpSummary?.checkJob;
        const eodExecuted = eodSource?.executedAt || ccpCheckJob?.executedAt;
        if (eodExecuted || (eodSource && (eodSource.status === 'COMPLETED' || eodSource.jobId))) {
          setHasExecutedEod(true);
          setEodExecutedAt(eodExecuted || null);
          const rawResults = eodSource?.results || eodSource?.mismatchedEOD || ccpTotals?.mismatchedEOD || [];
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
          setEodResults([]);
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

  // Lắng nghe WebSocket để tự động refresh giao diện ngay khi có lượt chạy EOD / Dsgd-Before-EOD mới
  useEffect(() => {
    if (!token || !selectedDate) return;
    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('dashboard-updated', () => {
      fetchEodSummary(selectedDate);
    });

    socket.on('job-status-updated', () => {
      fetchEodSummary(selectedDate);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedDate]);

  // Trigger Action Handlers
  const handleTriggerCheck = async (type: 'margin' | 'eod_run') => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection(type);

    const actionLabel =
      type === 'margin'
        ? `kiểm tra âm ký quỹ CoreCCP (Phiên T-1: ${previousTradingDayFormatted})`
        : `kiểm tra số dư EOD CoreCCP (Phiên T-1: ${previousTradingDayFormatted})`;

    const toastId = toast.loading(`Đang thực hiện ${actionLabel}...`);

    try {
      let data: any;
      if (type === 'margin') {
        data = await api.tradingOps.checkNegativeMargin(selectedDate, token, { system: 'CCP', scope: 'CCP' });
      } else {
        data = await api.tradingOps.checkEodRun(selectedDate, token);
      }

      toast.success(data?.message || `Hoàn tất ${actionLabel}!`, { id: toastId });
      await fetchEodSummary(selectedDate);
    } catch (err: any) {
      toast.error(`Lỗi thực hiện: ${err.message}`, { id: toastId });
    } finally {
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
          gap: '10px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '8px',
        }}
      >
        <Info size={16} color="#3b82f6" />
        <span style={{ fontSize: '0.82rem', color: '#3b82f6', fontWeight: 700 }}>
          Đối chiếu kết quả chốt sổ EOD phiên T-1: <strong>{previousTradingDayFormatted}</strong> (Phiên ca trực: <strong>{selectedDateFormatted}</strong>)
        </span>
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
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({new Date(marginExecutedAt).toLocaleTimeString('vi-VN')})
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
                              Kiểm tra lúc: {marginExecutedAt ? new Date(marginExecutedAt).toLocaleTimeString('vi-VN') : '--:--'}
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
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({new Date(eodExecutedAt).toLocaleTimeString('vi-VN')})
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
                              Kiểm tra lúc: {eodExecutedAt ? new Date(eodExecutedAt).toLocaleTimeString('vi-VN') : '--:--'}
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
