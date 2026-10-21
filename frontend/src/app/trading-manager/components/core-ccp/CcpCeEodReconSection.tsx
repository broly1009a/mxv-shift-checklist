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
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import { io } from 'socket.io-client';
import { API_BASE_URL } from '@/context/AuthContext';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import DsgdBeforeEodSection from '../shared/DsgdBeforeEodSection';

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
  viewMode?: 'ALL' | 'DSGD_BEFORE_EOD_ONLY' | 'EOD_ONLY';
  activeTab?: 'ALL' | 'EOD_RESULT' | 'NEGATIVE_MARGIN';
}

export interface CcpCeMismatchedTrade {
  source?: 'CoreCCP' | 'CoreEX' | string;
  maLenh?: string;
  maTKGD?: string;
  maHD?: string;
  giaKhop?: number | string;
  klGiaoDich?: number | string;
  ngayGio?: string;
  reason?: string;
}

export interface CcpCeMismatchedPosition {
  account?: string;
  symbol?: string;
  ccpPosition?: number;
  cePosition?: number;
  differ?: number;
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
  const [triggeringSection, setTriggeringSection] = useState<'all' | 'margin' | 'eod_run' | 'dsgd_before_eod' | null>(null);

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

  // Dsgd-Before-EOD Diff state (CoreCCP ↔ CoreEX)
  const [hasExecutedDsgdBeforeEod, setHasExecutedDsgdBeforeEod] = useState<boolean>(false);
  const [dsgdBeforeEodExecutedAt, setDsgdBeforeEodExecutedAt] = useState<string | null>(null);
  const [dsgdBeforeEodTotals, setDsgdBeforeEodTotals] = useState<{
    totalCcpVolume: number;
    totalCeVolume: number;
    differLots: number;
    mismatchedTradesCount: number;
    mismatchedPositionsCount: number;
  }>({
    totalCcpVolume: 0,
    totalCeVolume: 0,
    differLots: 0,
    mismatchedTradesCount: 0,
    mismatchedPositionsCount: 0,
  });

  const [mismatchedTrades, setMismatchedTrades] = useState<CcpCeMismatchedTrade[]>([]);
  const [mismatchedPositions, setMismatchedPositions] = useState<CcpCeMismatchedPosition[]>([]);

  // Subtabs & Filter
  const [activeSubTab, setActiveSubTab] = useState<'TRADES' | 'POSITIONS'>('TRADES');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CoreCCP' | 'CoreEX'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

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

        // 3. Đối soát Dsgd-Before-EOD (CoreCCP ↔ CoreEX)
        if (data?.dsgdBeforeEod) {
          setHasExecutedDsgdBeforeEod(!!data.dsgdBeforeEod.executedAt);
          setDsgdBeforeEodExecutedAt(data.dsgdBeforeEod.executedAt || null);
          setDsgdBeforeEodTotals({
            totalCcpVolume: data.dsgdBeforeEod.ccpVolume || data.dsgdBeforeEod.totals?.totalACM_MS || 0,
            totalCeVolume: data.dsgdBeforeEod.ceVolume || data.dsgdBeforeEod.totals?.totalACM_Straits || 0,
            differLots: data.dsgdBeforeEod.differLots || data.dsgdBeforeEod.totals?.differACM || 0,
            mismatchedTradesCount: data.dsgdBeforeEod.mismatchedTradesCount || (data.dsgdBeforeEod.mismatchedTrades || []).length,
            mismatchedPositionsCount: data.dsgdBeforeEod.mismatchedPositionsCount || (data.dsgdBeforeEod.mismatchedPositions || []).length,
          });
          setMismatchedTrades(data.dsgdBeforeEod.mismatchedTrades || []);
          setMismatchedPositions(data.dsgdBeforeEod.mismatchedPositions || []);
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
  const handleTriggerCheck = async (type: 'margin' | 'eod_run' | 'dsgd_before_eod') => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection(type);

    const actionLabel =
      type === 'margin'
        ? 'kiểm tra âm ký quỹ CoreCCP'
        : type === 'eod_run'
        ? 'kiểm tra số dư EOD CoreCCP vs CoreEX'
        : 'đối soát Dsgd-Before-EOD CoreCCP ↔ CoreEX';

    const toastId = toast.loading(`Đang thực hiện ${actionLabel}...`);

    try {
      let data: any;
      if (type === 'margin') {
        data = await api.tradingOps.checkNegativeMargin(selectedDate, token, { system: 'CCP', scope: 'CCP' });
      } else if (type === 'eod_run') {
        data = await api.tradingOps.checkEodRun(selectedDate, token);
      } else {
        data = await api.tradingOps.runCheckDsgdBeforeEod(selectedDate, token);
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

  // Copy report
  const handleCopyReport = () => {
    const reportText = `[ĐỐI SOÁT DSGD-BEFORE-EOD CORECCP ↔ COREEX]
Phiên: ${selectedDate}
CoreCCP / Maker: ${dsgdBeforeEodTotals.totalCcpVolume.toLocaleString('en-US')} lot
CoreEX: ${dsgdBeforeEodTotals.totalCeVolume.toLocaleString('en-US')} lot
Lệch khối lượng: ${dsgdBeforeEodTotals.differLots} lot
Lệnh khớp lệch: ${dsgdBeforeEodTotals.mismatchedTradesCount}
Vị thế ròng lệch: ${dsgdBeforeEodTotals.mismatchedPositionsCount}
Trạng thái: ${dsgdBeforeEodTotals.differLots === 0 ? 'KHỚP 100%' : 'CHÊNH LỆCH'}`;

    navigator.clipboard.writeText(reportText);
    toast.success('Đã sao chép báo cáo Dsgd-Before-EOD CoreCCP ↔ CoreEX vào clipboard!');
  };

  // Filtered lists
  const filteredTrades = useMemo(() => {
    return mismatchedTrades.filter((t) => {
      const matchSrc = sourceFilter === 'ALL' || t.source === sourceFilter;
      const matchQ =
        !searchQuery ||
        (t.maLenh && t.maLenh.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.maTKGD && t.maTKGD.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.maHD && t.maHD.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSrc && matchQ;
    });
  }, [mismatchedTrades, sourceFilter, searchQuery]);

  const filteredPositions = useMemo(() => {
    return mismatchedPositions.filter((p) => {
      const matchQ =
        !searchQuery ||
        (p.account && p.account.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.symbol && p.symbol.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchQ;
    });
  }, [mismatchedPositions, searchQuery]);

  if (!mounted) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ===== THANH ĐIỀU KHIỂN PHIÊN ĐỐI SOÁT EOD CCP & CE (ẨN KHI DSGD_BEFORE_EOD_ONLY HOẶC EOD_ONLY) ===== */}
      {viewMode !== 'DSGD_BEFORE_EOD_ONLY' && viewMode !== 'EOD_ONLY' && (
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

      {/* ===== KHUNG 2 CỘT SONG SONG: ÂM KÝ QUỸ & KẾT QUẢ CHẠY EOD (ẨN KHI DSGD_BEFORE_EOD_ONLY) ===== */}
      {viewMode !== 'DSGD_BEFORE_EOD_ONLY' && (
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
                          Chưa chạy kiểm tra tài khoản âm ký quỹ CoreCCP. Bấm <b>Check</b> để thực hiện.
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Kết quả chạy EOD (CoreCCP ↔ CoreEX)
                  </h5>
                  {hasExecutedEod && eodExecutedAt && (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      ({new Date(eodExecutedAt).toLocaleTimeString('vi-VN')})
                    </span>
                  )}
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
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>CoreCCP</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>CoreEX (EOD result)</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>Lệch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!hasExecutedEod ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          Chưa chạy kiểm tra số liệu EOD CoreCCP vs CoreEX. Bấm <b>Check</b> để thực hiện.
                        </td>
                      </tr>
                    ) : eodResults.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: '36px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle2 size={36} color="#10b981" />
                            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.88rem' }}>
                              Khớp 100%: Số dư tài khoản giữa CoreCCP và CoreEX hoàn toàn trùng khớp
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
      )}

      {/* ===== KHUNG LỚN: CHI TIẾT ĐỐI CHIẾU DSGD-BEFORE-EOD (CORECCP ↔ COREEX) ===== */}
      {viewMode !== 'EOD_ONLY' && (
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Header Dsgd-Before-EOD */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Chi tiết đối chiếu Dsgd-Before-EOD (CoreCCP ↔ CoreEX)
              </h4>
              {dsgdBeforeEodExecutedAt && (
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  ({new Date(dsgdBeforeEodExecutedAt).toLocaleString('vi-VN')})
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Kiểm tra 2 phân hệ mới: Đối chiếu tổng số lot khớp, danh sách lệnh chi tiết và vị thế tất toán ròng.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasExecutedDsgdBeforeEod && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  backgroundColor: dsgdBeforeEodTotals.differLots === 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: dsgdBeforeEodTotals.differLots === 0 ? '#10b981' : '#ef4444',
                }}
              >
                {dsgdBeforeEodTotals.differLots === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                <span>{dsgdBeforeEodTotals.differLots === 0 ? 'Khớp hoàn toàn' : 'Có chênh lệch'}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyReport}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Sao chép báo cáo Dsgd-Before-EOD"
            >
              <Copy size={13} />
              <span>Sao chép</span>
            </button>
            <button
              type="button"
              onClick={() => handleTriggerCheck('dsgd_before_eod')}
              disabled={triggering}
              className="btn btn-primary"
              style={{ fontSize: '0.82rem', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {triggering && triggeringSection === 'dsgd_before_eod' ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Checking Dsgd-Before-EOD...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Check Dsgd-Before-EOD</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Thẻ Metrics Card */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {/* Card 1: CoreCCP */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                CoreCCP / Maker (VNCLEAR)
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: dsgdBeforeEodTotals.differLots === 0 ? '#10b981' : '#ef4444',
                }}
              >
                Lệch: {dsgdBeforeEodTotals.differLots} lot
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#10b981' }}>
                {dsgdBeforeEodTotals.totalCcpVolume.toLocaleString('en-US')}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>lot</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tổng khối lượng Maker VNCLEAR</span>
          </div>

          {/* Card 2: CoreEX */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                CoreEX / Sàn CE
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: dsgdBeforeEodTotals.differLots === 0 ? '#10b981' : '#ef4444',
                }}
              >
                Lệch: {dsgdBeforeEodTotals.differLots} lot
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 900, fontFamily: 'monospace', color: '#3b82f6' }}>
                {dsgdBeforeEodTotals.totalCeVolume.toLocaleString('en-US')}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>lot</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tổng khối lượng khớp sàn CE</span>
          </div>

          {/* Card 3: Trades Diff */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                LỆNH KHỚP LỆNH (TRADES)
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: dsgdBeforeEodTotals.mismatchedTradesCount === 0 ? '#10b981' : '#ef4444',
                }}
              >
                {dsgdBeforeEodTotals.mismatchedTradesCount === 0 ? 'Khớp 100%' : 'Chênh lệch'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: dsgdBeforeEodTotals.mismatchedTradesCount === 0 ? '#10b981' : '#ef4444',
                }}
              >
                {dsgdBeforeEodTotals.mismatchedTradesCount}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>lệnh chênh lệch</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lệnh thiếu/lệch giữa CCP và CE</span>
          </div>

          {/* Card 4: Positions Diff */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-secondary)' }}>
                VỊ THẾ NET LỆCH (POSITIONS)
              </span>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: dsgdBeforeEodTotals.mismatchedPositionsCount === 0 ? '#10b981' : '#ef4444',
                }}
              >
                {dsgdBeforeEodTotals.mismatchedPositionsCount === 0 ? 'Khớp 100%' : 'Chênh lệch'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span
                style={{
                  fontSize: '1.4rem',
                  fontWeight: 900,
                  fontFamily: 'monospace',
                  color: dsgdBeforeEodTotals.mismatchedPositionsCount === 0 ? '#10b981' : '#ef4444',
                }}
              >
                {dsgdBeforeEodTotals.mismatchedPositionsCount}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>vị thế ròng lệch</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Vị thế tất toán ròng TTTT vs Positions</span>
          </div>
        </div>

        {/* Subtabs & Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('TRADES')}
              className="btn"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                fontWeight: 700,
                backgroundColor: activeSubTab === 'TRADES' ? '#3b82f6' : 'var(--bg-input)',
                color: activeSubTab === 'TRADES' ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
              }}
            >
              Chi tiết lệnh lệch khớp lệnh ({dsgdBeforeEodTotals.mismatchedTradesCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('POSITIONS')}
              className="btn"
              style={{
                fontSize: '0.8rem',
                padding: '6px 14px',
                fontWeight: 700,
                backgroundColor: activeSubTab === 'POSITIONS' ? '#3b82f6' : 'var(--bg-input)',
                color: activeSubTab === 'POSITIONS' ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
              }}
            >
              Chi tiết lệch vị thế tất toán net ({dsgdBeforeEodTotals.mismatchedPositionsCount})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-input)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
              {(['ALL', 'CoreEX', 'CoreCCP'] as const).map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setSourceFilter(src)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: sourceFilter === src ? '#3b82f6' : 'transparent',
                    color: sourceFilter === src ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {src === 'ALL' ? 'Tất cả' : src}
                </button>
              ))}
            </div>

            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Lọc TK, HĐ, Mã lệnh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  width: '180px',
                  height: '32px',
                  paddingLeft: '28px',
                  fontSize: '0.78rem',
                }}
              />
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Content Table / Empty State */}
        {activeSubTab === 'TRADES' ? (
          filteredTrades.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <CheckCircle2 size={36} color="#10b981" />
              <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.92rem' }}>
                OK! Khớp 100%: Không có lệnh lệch nào giữa CoreCCP và CoreEX.
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                Tất cả các giao dịch khớp lệnh trong phiên đã được đối chiếu toàn vẹn.
              </span>
            </div>
          ) : (
            <div
              style={{
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                maxHeight: '280px',
                minHeight: '160px',
                overflowY: 'auto',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 5 }}>
                  <tr style={{ color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '8px 12px' }}>Nguồn</th>
                    <th style={{ padding: '8px 12px' }}>Mã lệnh</th>
                    <th style={{ padding: '8px 12px' }}>Mã TKGD</th>
                    <th style={{ padding: '8px 12px' }}>Mã HĐ</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Giá khớp</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Khối lượng</th>
                    <th style={{ padding: '8px 12px' }}>Thời gian khớp</th>
                    <th style={{ padding: '8px 12px' }}>Lý do lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((t, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: t.source === 'CoreCCP' ? '#10b981' : '#3b82f6' }}>
                        {t.source}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{t.maLenh}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{t.maTKGD}</td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{t.maHD}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{t.giaKhop}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700 }}>
                        {t.klGiaoDich}
                      </td>
                      <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '0.74rem' }}>{t.ngayGio}</td>
                      <td style={{ padding: '8px 12px', color: '#ef4444', fontWeight: 700 }}>{t.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filteredPositions.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.04)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle2 size={36} color="#10b981" />
            <span style={{ color: '#10b981', fontWeight: 800, fontSize: '0.92rem' }}>
              OK! Khớp 100%: Không có vị thế ròng lệch nào giữa CoreCCP và CoreEX.
            </span>
          </div>
        ) : (
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              maxHeight: '280px',
              minHeight: '160px',
              overflowY: 'auto',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 5 }}>
                <tr style={{ color: 'var(--text-secondary)', fontWeight: 700, borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px 12px' }}>Mã TKGD</th>
                  <th style={{ padding: '8px 12px' }}>Mã Hợp Đồng</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vị thế CoreCCP</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Vị thế CoreEX</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Lệch Ròng</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((p, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: idx % 2 === 1 ? 'rgba(255, 255, 255, 0.015)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 700 }}>{p.account}</td>
                    <td style={{ padding: '8px 12px', fontFamily: 'monospace' }}>{p.symbol}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{p.ccpPosition}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{p.cePosition}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#ef4444' }}>
                      {p.differ}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ===== KIỂM TRA DSGD TRƯỚC EOD (CheckDSGDBeforeEOD - CHỈ HIỂN THỊ KHI viewMode === 'ALL') ===== */}
      {viewMode === 'ALL' && (
        <DsgdBeforeEodSection token={token} selectedDate={selectedDate} />
      )}
    </div>
  );
}
