'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  Activity,
  Database,
  Sliders,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Play,
  Square,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  Terminal,
  Volume2,
  VolumeX,
  FileText,
  TrendingUp,
  Coins,
  Bot,
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  tradingOpsApi,
  ccpClearingApi,
  tradingBotApi,
  ConsoleSummaryData,
  TradingReconLogItem,
  CcpClearingLogItem,
  BotJobItem,
  ExchangeRatesData,
} from '@/features/trading';
import { getInitialTradingSessionDate } from '../trading-manager/utils/tradingDateUtils';

export default function TradingManagerV2Page() {
  const { token } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Selected Date (Mặc định phiên làm việc Việt Nam GMT+7)
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());

  // Top Tabs Navigation
  const [activeTab, setActiveTab] = useState<'RECON_OPS' | 'CCP_CLEARING' | 'BOT_BACKUP' | 'SYSTEM_CONFIG'>('RECON_OPS');

  // Audio Alerts State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Filter Checkboxes for Recon
  const [checkKlgd, setCheckKlgd] = useState<boolean>(true);
  const [checkTtm, setCheckTtm] = useState<boolean>(true);
  const [checkTttt, setCheckTttt] = useState<boolean>(true);

  // Discrepancy Tab Selector
  const [discrepancyTab, setDiscrepancyTab] = useState<'TRADE' | 'TTM' | 'TTTT'>('TRADE');

  // Loading & Triggering States
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Data States
  const [summaryData, setSummaryData] = useState<ConsoleSummaryData | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);

  // Modular V2 Log States
  const [reconLogs, setReconLogs] = useState<TradingReconLogItem[]>([]);
  const [loadingReconLogs, setLoadingReconLogs] = useState<boolean>(false);
  const [ccpLogs, setCcpLogs] = useState<CcpClearingLogItem[]>([]);
  const [loadingCcpLogs, setLoadingCcpLogs] = useState<boolean>(false);

  // CCP Tab States
  const [exchangeRates, setExchangeRates] = useState<ExchangeRatesData | null>(null);
  const [loadingRates, setLoadingRates] = useState<boolean>(false);

  // Bot & Backup Tab States
  const [botJobs, setBotJobs] = useState<BotJobItem[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [systemConfigs, setSystemConfigs] = useState<Record<string, any>>({});
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Sound Beeper Alert
  const playAlertSound = useCallback(() => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.3);
    } catch {}
  }, [soundEnabled]);

  // Fullscreen handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Fetch Console Summary via centralized tradingOpsApi
  const fetchConsoleSummary = useCallback(
    async (date?: string, silent: boolean = false, jobId?: string | null) => {
      if (!token) return;
      const qDate = date || selectedDate;
      if (!silent) setLoading(true);

      try {
        const data = await tradingOpsApi.getConsoleSummary(qDate, jobId, token);
        setSummaryData(data);

        if (data.shiftInfo?.nextScanInSeconds && data.shiftInfo.nextScanInSeconds > 0) {
          setCountdownSeconds(data.shiftInfo.nextScanInSeconds);
        }

        const differKlgd = data.klgd?.totals?.differ || 0;
        const differAcm = data.klgd?.totals?.differACM || 0;
        if (differKlgd > 0 || differAcm > 0) {
          playAlertSound();
        }
      } catch (err: any) {
        if (!silent) toast.error(`Không thể tải dữ liệu đối chiếu: ${err.message}`);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, selectedDate, playAlertSound],
  );

  // Fetch Modular V2 Logs via centralized tradingOpsApi
  const fetchReconLogs = useCallback(
    async (date?: string) => {
      if (!token) return;
      const qDate = date || selectedDate;
      setLoadingReconLogs(true);
      try {
        const res = await tradingOpsApi.getReconLogs(qDate, token);
        if (res.success && Array.isArray(res.data)) {
          setReconLogs(res.data);
        }
      } catch {
        // Fallback im lặng nếu CSDL chưa có log
      } finally {
        setLoadingReconLogs(false);
      }
    },
    [token, selectedDate],
  );

  // Fetch CCP Logs & Rates via centralized ccpClearingApi
  const fetchCcpData = useCallback(
    async (date?: string) => {
      if (!token) return;
      const qDate = date || selectedDate;
      setLoadingCcpLogs(true);
      setLoadingRates(true);
      try {
        const [logsRes, ratesRes] = await Promise.allSettled([
          ccpClearingApi.getCcpClearingLogs(qDate, token),
          ccpClearingApi.getExchangeRates(token),
        ]);
        if (logsRes.status === 'fulfilled' && logsRes.value.success) {
          setCcpLogs(logsRes.value.data);
        }
        if (ratesRes.status === 'fulfilled' && ratesRes.value.success) {
          setExchangeRates(ratesRes.value);
        }
      } finally {
        setLoadingCcpLogs(false);
        setLoadingRates(false);
      }
    },
    [token, selectedDate],
  );

  // Fetch Bot Jobs via centralized tradingBotApi
  const fetchBotJobs = useCallback(async () => {
    if (!token) return;
    setLoadingJobs(true);
    try {
      const TRADING_JOB_TYPES =
        'CHECK_KLGD,CHECK_PRE_EOD,CHECK_CQG_SYNC,SCAN_NEGATIVE_MARGIN,DOWNLOAD_CCP_REPORT,RUN_LOT_MACRO,RUN_VALUE_MACRO,RPA_DOWNLOAD_REPORTS,DOWNLOAD_CQG_BACKUP,TRIGGER_ACM_DOWNLOAD';
      const jobs = await tradingBotApi.getJobs({ jobTypes: TRADING_JOB_TYPES, limit: 15 }, token);
      if (Array.isArray(jobs)) {
        setBotJobs(jobs);
      }
    } catch {} finally {
      setLoadingJobs(false);
    }
  }, [token]);

  // Fetch System Settings via centralized tradingBotApi
  const fetchSettings = useCallback(async () => {
    if (!token) return;
    try {
      const cfg = await tradingBotApi.getSystemSettings(token);
      if (cfg) setSystemConfigs(cfg);
    } catch {}
  }, [token]);

  // Initial load and date change
  useEffect(() => {
    if (selectedDate) {
      setSelectedRunId(null);
      fetchConsoleSummary(selectedDate, false, null);
      if (activeTab === 'RECON_OPS') fetchReconLogs(selectedDate);
      if (activeTab === 'CCP_CLEARING') fetchCcpData(selectedDate);
      if (activeTab === 'BOT_BACKUP') fetchBotJobs();
      if (activeTab === 'SYSTEM_CONFIG') fetchSettings();
    }
  }, [selectedDate, activeTab, fetchConsoleSummary, fetchReconLogs, fetchCcpData, fetchBotJobs, fetchSettings]);

  // Polling countdown timer
  useEffect(() => {
    if (countdownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdownSeconds]);

  // Trigger manual check via centralized tradingOpsApi
  const handleTriggerRun = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang khởi chạy quét đối chiếu ngầm qua API Modular...');

    try {
      const res = await tradingOpsApi.triggerConsoleRun(
        {
          date: selectedDate,
          jobType: 'CHECK_KLGD',
          bypassCooldown: true,
          options: {
            checkKlgd,
            checkTtm,
            checkTttt,
          },
        },
        token,
      );

      if (res.jobId) {
        setActiveJobId(res.jobId);
        toast.success(`Đã xếp hàng tiến trình Bot (ID: ${res.jobId.slice(-6)})`, { id: toastId });
      } else {
        toast.success(res.message || 'Quét đối chiếu hoàn tất!', { id: toastId });
      }

      await fetchConsoleSummary(selectedDate, true);
      await fetchReconLogs(selectedDate);
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt đối chiếu: ${err.message}`, { id: toastId });
    } finally {
      setTriggering(false);
    }
  };

  // Emergency stop bot job via centralized tradingBotApi
  const handleEmergencyStop = async () => {
    if (!token || cancelling) return;
    const targetJobId = activeJobId || summaryData?.currentJobId;
    if (!targetJobId) {
      toast.error('Không tìm thấy Job đang chạy để dừng.');
      return;
    }

    setCancelling(true);
    try {
      const res = await tradingBotApi.cancelJob(targetJobId, token);
      toast.success(res.message || 'Đã gửi lệnh dừng tiến trình Bot.');
      setActiveJobId(null);
      await fetchConsoleSummary(selectedDate, true);
    } catch (err: any) {
      toast.error(`Không thể dừng tiến trình: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  // Calculations & Totals
  const klgdTotals = summaryData?.klgd?.totals;
  const differKlgd = klgdTotals?.differ || 0;
  const differAcm = klgdTotals?.differACM || 0;
  const totalDiffer = differKlgd + differAcm;
  const isDiffer = totalDiffer > 0;

  const mismatchedTrades = summaryData?.klgd?.mismatchedTrades || [];
  const mismatchedTTM = summaryData?.klgd?.mismatchedTTM || [];
  const mismatchedTTTT = summaryData?.klgd?.mismatchedTTTT || [];

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: isFullscreen ? '100vh' : 'auto',
          color: 'var(--text-primary)',
          padding: isFullscreen ? '24px' : '0',
          backgroundColor: isFullscreen ? 'var(--bg-app)' : 'transparent',
          position: 'relative',
          overflowY: isFullscreen ? 'auto' : 'visible',
          boxSizing: 'border-box',
        }}
        className="animate-fade-in"
      >
        {/* ========================================================================= */}
        {/* 1. PAGE HEADER & DUAL-UI SWITCHER */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <Activity color="#10b981" size={20} className="animate-pulse" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  GIÁM SÁT VẬN HÀNH GIAO DỊCH
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.18)',
                      color: '#60a5fa',
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    V2 MODULAR ARCHITECTURE
                  </span>
                </h1>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Phân hệ quản trị giao dịch tập trung với Typed API Client Services chuẩn Strangler Fig
                </p>
              </div>
            </div>
          </div>

          {/* Right Header Status & Navigation Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* System Status Pill */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '10px',
                border: !isDiffer ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                backgroundColor: !isDiffer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: !isDiffer ? '#34d399' : '#f87171',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: !isDiffer ? '#10b981' : '#ef4444',
                }}
                className="animate-pulse"
              />
              <span>{!isDiffer ? 'Dữ liệu: Khớp 100%' : `Lệch ${totalDiffer} lot`}</span>
            </div>

            {/* Audio Toggle Button */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn btn-secondary"
              style={{
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                color: soundEnabled ? '#10b981' : 'var(--text-muted)',
              }}
              title={soundEnabled ? 'Đang bật chuông báo' : 'Đã tắt chuông báo'}
            >
              {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>{soundEnabled ? 'Âm thanh' : 'Tắt âm'}</span>
            </button>

            {/* Switch to Legacy V1 Link */}
            <Link
              href="/trading-manager"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '8px 12px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
              title="Chuyển sang giao diện V1 để so sánh"
            >
              <ExternalLink size={14} />
              <span>Xem Bản V1 Cũ</span>
            </Link>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn btn-secondary"
              style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Dashboard Back Link */}
            <Link
              href="/dashboard"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '8px 14px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. TOP TAB BUTTONS BAR */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '4px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {/* Tab 1: Khớp Lệnh & Trạng Thái (Trading Ops) */}
          <button
            type="button"
            onClick={() => setActiveTab('RECON_OPS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'RECON_OPS' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'RECON_OPS' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'RECON_OPS' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} color={activeTab === 'RECON_OPS' ? '#10b981' : 'var(--text-muted)'} />
            <span>Đối Chiếu Giao Dịch (Trading Ops)</span>
          </button>

          {/* Tab 2: Báo Cáo & Thống Kê CoreCCP */}
          <button
            type="button"
            onClick={() => setActiveTab('CCP_CLEARING')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'CCP_CLEARING' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'CCP_CLEARING' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CCP_CLEARING' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FileSpreadsheet size={16} color={activeTab === 'CCP_CLEARING' ? '#10b981' : 'var(--text-muted)'} />
            <span>Bù Trừ & Thống Kê CoreCCP</span>
          </button>

          {/* Tab 3: Hạ Tầng Robot & Sao Lưu */}
          <button
            type="button"
            onClick={() => setActiveTab('BOT_BACKUP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'BOT_BACKUP' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'BOT_BACKUP' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'BOT_BACKUP' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Bot size={16} color={activeTab === 'BOT_BACKUP' ? '#10b981' : 'var(--text-muted)'} />
            <span>Hạ Tầng Robot & Backup</span>
          </button>

          {/* Tab 4: Cấu Hình Vận Hành */}
          <button
            type="button"
            onClick={() => setActiveTab('SYSTEM_CONFIG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'SYSTEM_CONFIG' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'SYSTEM_CONFIG' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'SYSTEM_CONFIG' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={16} color={activeTab === 'SYSTEM_CONFIG' ? '#10b981' : 'var(--text-muted)'} />
            <span>Cấu Hình Vận Hành</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 3. TAB 1: ĐỐI CHIẾU GIAO DỊCH (TRADING OPS) */}
        {/* ========================================================================= */}
        {activeTab === 'RECON_OPS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Control Toolbar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              {/* Date Input & Filters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#10b981" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>Phiên:</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }} />

                {/* Checkboxes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checkKlgd}
                      onChange={(e) => setCheckKlgd(e.target.checked)}
                      style={{ accentColor: '#10b981' }}
                    />
                    <span>Khớp Lệnh (KLGD)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checkTtm}
                      onChange={(e) => setCheckTtm(e.target.checked)}
                      style={{ accentColor: '#10b981' }}
                    />
                    <span>Trạng Thái Mở (TTM)</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={checkTttt}
                      onChange={(e) => setCheckTttt(e.target.checked)}
                      style={{ accentColor: '#10b981' }}
                    />
                    <span>Tất Toán (TTTT)</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons & Countdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {countdownSeconds > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      color: 'var(--text-secondary)',
                      fontFamily: 'monospace',
                    }}
                  >
                    <Clock size={14} color="#60a5fa" />
                    <span>
                      Quét lại sau: <strong style={{ color: '#60a5fa' }}>{countdownSeconds}s</strong>
                    </span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fetchConsoleSummary(selectedDate, false, null)}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>Tải lại</span>
                </button>

                <button
                  type="button"
                  onClick={handleTriggerRun}
                  disabled={triggering}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering ? 0.7 : 1,
                  }}
                >
                  <Play size={14} />
                  <span>{triggering ? 'Đang thực thi...' : 'Quét Đối Chiếu Ngay'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleEmergencyStop}
                  disabled={cancelling}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: cancelling ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Square size={13} />
                  <span>Dừng Bot</span>
                </button>
              </div>
            </div>

            {/* KPI Metric Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Card 1: Khớp Lệnh Thường MS vs CQG */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    KHỚP LỆNH THƯỜNG (MS vs CQG)
                  </span>
                  <Activity size={16} color="#3b82f6" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {klgdTotals?.totalMS || 0}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>vs {klgdTotals?.totalCQG || 0} lot</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Độ lệch:{' '}
                  <span
                    style={{
                      color: (klgdTotals?.differ || 0) > 0 ? '#ef4444' : '#10b981',
                      fontFamily: 'monospace',
                    }}
                  >
                    {klgdTotals?.differ || 0} lot
                  </span>
                </div>
              </div>

              {/* Card 2: Khớp Lệnh Tự Doanh ACM Straits */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    TỰ DOANH (MS vs STRAITS)
                  </span>
                  <TrendingUp size={16} color="#10b981" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {klgdTotals?.totalACM_MS || 0}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>vs {klgdTotals?.totalACM_Straits || 0} lot</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Độ lệch:{' '}
                  <span
                    style={{
                      color: (klgdTotals?.differACM || 0) > 0 ? '#ef4444' : '#10b981',
                      fontFamily: 'monospace',
                    }}
                  >
                    {klgdTotals?.differACM || 0} lot
                  </span>
                </div>
              </div>

              {/* Card 3: Trạng Thái Mở TTM vs OP */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    TRẠNG THÁI MỞ (TTM vs OP)
                  </span>
                  <Layers size={16} color="#f59e0b" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {mismatchedTTM.length}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>tài khoản lệch</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Tình trạng:{' '}
                  <span style={{ color: mismatchedTTM.length > 0 ? '#ef4444' : '#10b981' }}>
                    {mismatchedTTM.length > 0 ? 'Cần xử lý' : 'Khớp hoàn toàn'}
                  </span>
                </div>
              </div>

              {/* Card 4: Tất Toán TTTT vs PS */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    TẤT TOÁN (TTTT vs PS)
                  </span>
                  <CheckCircle2 size={16} color="#a855f7" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'monospace' }}>
                    {mismatchedTTTT.length}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>tài khoản lệch</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  Tình trạng:{' '}
                  <span style={{ color: mismatchedTTTT.length > 0 ? '#ef4444' : '#10b981' }}>
                    {mismatchedTTTT.length > 0 ? 'Cần xử lý' : 'Khớp hoàn toàn'}
                  </span>
                </div>
              </div>
            </div>

            {/* Discrepancies Details Table */}
            <div
              style={{
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
              }}
            >
              {/* Table Sub-tabs Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setDiscrepancyTab('TRADE')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: discrepancyTab === 'TRADE' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: discrepancyTab === 'TRADE' ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Chi tiết Lệch Khớp Lệnh ({mismatchedTrades.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscrepancyTab('TTM')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: discrepancyTab === 'TTM' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: discrepancyTab === 'TTM' ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Lệch Trạng Thái Mở TTM ({mismatchedTTM.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscrepancyTab('TTTT')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: 'none',
                      backgroundColor: discrepancyTab === 'TTTT' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                      color: discrepancyTab === 'TTTT' ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Lệch Tất Toán TTTT ({mismatchedTTTT.length})
                  </button>
                </div>

                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Cập nhật: {summaryData?.klgd?.executedAt ? new Date(summaryData.klgd.executedAt).toLocaleTimeString('vi-VN') : '--:--'}
                </span>
              </div>

              {/* Table Content */}
              <div style={{ padding: '16px', overflowX: 'auto' }}>
                {discrepancyTab === 'TRADE' ? (
                  mismatchedTrades.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>Khớp hoàn toàn 100%!</div>
                      <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                        Không có giao dịch nào bị lệch giữa M-System, CQG và Straits Financial.
                      </div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Nguồn</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Mã TKGD</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Mã HĐ</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Giá khớp</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Khối lượng</th>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Lý do lệch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mismatchedTrades.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '8px', fontWeight: 700 }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: m.source === 'MS' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                  color: m.source === 'MS' ? '#60a5fa' : '#34d399',
                                }}
                              >
                                {m.source}
                              </span>
                            </td>
                            <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 600 }}>{m.maTKGD}</td>
                            <td style={{ padding: '8px', fontFamily: 'monospace' }}>{m.maHD}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{m.giaKhop}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#f87171', fontWeight: 700 }}>
                              {m.klGiaoDich}
                            </td>
                            <td style={{ padding: '8px', color: '#f87171' }}>{m.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : discrepancyTab === 'TTM' ? (
                  mismatchedTTM.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>Trạng thái mở (TTM) khớp 100%!</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Tài khoản</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Giá trị MS (TTM)</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Giá trị CQG (OP)</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mismatchedTTM.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700 }}>{m.maTKGD}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{m.ttmValue}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{m.opValue}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444', fontWeight: 800 }}>
                              {m.differ}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  mismatchedTTTT.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                      <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, color: '#34d399', fontSize: '0.95rem' }}>Khớp lệnh thanh toán (TTTT) khớp 100%!</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ textAlign: 'left', padding: '8px' }}>Tài khoản</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Giá trị MS (TTTT)</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Giá trị CQG (PS)</th>
                          <th style={{ textAlign: 'right', padding: '8px' }}>Chênh lệch</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mismatchedTTTT.map((m, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                            <td style={{ padding: '8px', fontFamily: 'monospace', fontWeight: 700 }}>{m.maTKGD}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{m.ttttValue}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace' }}>{m.psValue}</td>
                            <td style={{ padding: '8px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444', fontWeight: 800 }}>
                              {m.differ}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </div>

            {/* Modular V2 Audit Logs Section */}
            <div
              style={{
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="#10b981" />
                  <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    Nhật Ký Kiểm Toán Đối Soát (Modular Monolith V2 Audit Logs)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchReconLogs(selectedDate)}
                  disabled={loadingReconLogs}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw size={12} className={loadingReconLogs ? 'animate-spin' : ''} />
                  <span>Làm mới log</span>
                </button>
              </div>

              {reconLogs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Chưa có bản ghi Audit Log nào được lưu trong CSDL Modular V2 cho ngày {selectedDate}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {reconLogs.slice(0, 5).map((log) => (
                    <div
                      key={log._id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            backgroundColor: log.status === 'PASSED' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: log.status === 'PASSED' ? '#34d399' : '#f87171',
                          }}
                        >
                          {log.status}
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{log.reconType}</span>
                        <span style={{ color: 'var(--text-muted)' }}>• {log.mismatchesCount} chênh lệch</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {new Date(log.createdAt).toLocaleString('vi-VN')} ({log.executionTimeMs || 0}ms)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. TAB 2: BÙ TRỪ & THỐNG KÊ CORECCP */}
        {/* ========================================================================= */}
        {activeTab === 'CCP_CLEARING' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Actions Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Coins size={18} color="#f59e0b" />
                <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>Bù Trừ & Thống Kê Khối Lượng CoreCCP (VNCLEAR)</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={async () => {
                    const tid = toast.loading('Đang tải và bóc tách dữ liệu CoreCCP...');
                    try {
                      const res = await ccpClearingApi.downloadCcpMetrics(selectedDate, token);
                      toast.success(res.message || 'Đã trích xuất số liệu CoreCCP!', { id: tid });
                    } catch (e: any) {
                      toast.error(`Lỗi: ${e.message}`, { id: tid });
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <FileSpreadsheet size={14} color="#10b981" />
                  <span>Bóc tách CoreCCP</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const tid = toast.loading('Đang khởi chạy Macro Thống kê Khối lượng...');
                    try {
                      const res = await ccpClearingApi.triggerLotMacro(token);
                      toast.success(res.message || 'Đã xếp hàng Lot Macro!', { id: tid });
                    } catch (e: any) {
                      toast.error(`Lỗi: ${e.message}`, { id: tid });
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <TrendingUp size={14} color="#3b82f6" />
                  <span>Macro Khối Lượng</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const tid = toast.loading('Đang đồng bộ tỷ giá từ M-System...');
                    try {
                      const res = await ccpClearingApi.syncExchangeRates(token);
                      setExchangeRates(res);
                      toast.success('Đã đồng bộ tỷ giá ngoại tệ thành công!', { id: tid });
                    } catch (e: any) {
                      toast.error(`Lỗi đồng bộ tỷ giá: ${e.message}`, { id: tid });
                    }
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Coins size={14} color="#f59e0b" />
                  <span>Đồng Bộ Tỷ Giá</span>
                </button>
              </div>
            </div>

            {/* Exchange Rates Grid */}
            <div
              style={{
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '16px',
              }}
            >
              <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={16} color="#f59e0b" />
                <span>Bảng Tỷ Giá Đa Tiền Tệ Ngoại Hối (Exchange Rates)</span>
              </div>

              {exchangeRates?.rates ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {Object.entries(exchangeRates.rates).map(([curr, rate]) => (
                    <div
                      key={curr}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                      }}
                    >
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-secondary)' }}>{curr} / VND</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'monospace', color: '#34d399' }}>
                        {Number(rate).toLocaleString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Chưa có dữ liệu tỷ giá. Nhấn nút "Đồng Bộ Tỷ Giá" để lấy trực tiếp từ M-System.
                </div>
              )}
            </div>

            {/* Modular V2 CCP Clearing Logs */}
            <div
              style={{
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
                  Nhật Ký Bù Trừ CCP (Modular V2 Clearing Logs)
                </span>
                <button
                  type="button"
                  onClick={() => fetchCcpData(selectedDate)}
                  disabled={loadingCcpLogs}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  Làm mới
                </button>
              </div>

              {ccpLogs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  Chưa có bản ghi Bù trừ CoreCCP nào trong ngày {selectedDate}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {ccpLogs.slice(0, 5).map((log) => (
                    <div
                      key={log._id}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.8rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            color: '#34d399',
                          }}
                        >
                          {log.status}
                        </span>
                        <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{log.clearingType}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {new Date(log.createdAt).toLocaleString('vi-VN')} ({log.executionTimeMs || 0}ms)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. TAB 3: HẠ TẦNG ROBOT & BACKUP */}
        {/* ========================================================================= */}
        {activeTab === 'BOT_BACKUP' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* 4 Crawler Source Cards */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '14px',
              }}
            >
              {/* Source 1: M-System */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Robot M-System</span>
                  <Bot size={18} color="#3b82f6" />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Crawler Playwright tự động tải 20 báo cáo cốt lõi từ cổng M-System
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kích hoạt Bot M-System...');
                      try {
                        await tradingBotApi.triggerMsDownload({ sessionDate: selectedDate }, token);
                        toast.success('Đã xếp hàng tải báo cáo M-System!', { id: tid });
                        fetchBotJobs();
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Tải ngay
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kiểm toán tệp tin Backup M-System...');
                      try {
                        const res = await tradingBotApi.auditMsBackup(selectedDate, token);
                        toast.success(`Audit MS: ${res.files.length - res.missingCount}/${res.totalExpected} file hợp lệ!`, { id: tid });
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Audit Files
                  </button>
                </div>
              </div>

              {/* Source 2: CQG */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Robot CQG Futures</span>
                  <Bot size={18} color="#10b981" />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Tải song song 2 tài khoản CQG (FR, PS, OP, OD) và tự động ghép nối file
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kích hoạt Bot CQG...');
                      try {
                        await tradingBotApi.triggerCqgDownload({ sessionDate: selectedDate }, token);
                        toast.success('Đã xếp hàng tải CQG!', { id: tid });
                        fetchBotJobs();
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Tải ngay
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kiểm toán tệp tin Backup CQG...');
                      try {
                        const res = await tradingBotApi.auditCqgBackup(selectedDate, token);
                        toast.success(`Audit CQG: ${res.files.length - res.missingCount}/${res.totalExpected} file!`, { id: tid });
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Audit Files
                  </button>
                </div>
              </div>

              {/* Source 3: Straits Financial ACM */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>Straits Financial (ACM)</span>
                  <Bot size={18} color="#f59e0b" />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Kết nối an toàn SFTP Client tải tự động file Straits CSV tự doanh
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kích hoạt tải ACM...');
                      try {
                        await tradingBotApi.triggerAcmDownload({ sessionDate: selectedDate }, token);
                        toast.success('Đã kích hoạt tải ACM SFTP!', { id: tid });
                        fetchBotJobs();
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Tải ngay
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kiểm toán ACM SFTP...');
                      try {
                        const res = await tradingBotApi.auditAcmBackup(selectedDate, token);
                        toast.success(`Audit ACM: ${res.missingCount === 0 ? 'Hợp lệ' : 'Thiếu file'}!`, { id: tid });
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Audit Files
                  </button>
                </div>
              </div>

              {/* Source 4: CoreCCP */}
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>CoreCCP (VNCLEAR)</span>
                  <Bot size={18} color="#a855f7" />
                </div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Crawler tự động tải 25 báo cáo bù trừ CoreCCP và bóc tách dữ liệu
                </p>
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kích hoạt Bot CCP...');
                      try {
                        await tradingBotApi.triggerCcpDownload({ sessionDate: selectedDate }, token);
                        toast.success('Đã xếp hàng tải CoreCCP!', { id: tid });
                        fetchBotJobs();
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Tải ngay
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const tid = toast.loading('Đang kiểm toán file Backup CCP...');
                      try {
                        const res = await tradingBotApi.auditCcpBackup(selectedDate, token);
                        toast.success(`Audit CCP: ${res.files.length - res.missingCount}/${res.totalExpected} file!`, { id: tid });
                      } catch (e: any) {
                        toast.error(e.message, { id: tid });
                      }
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, fontSize: '0.75rem', padding: '6px' }}
                  >
                    Audit Files
                  </button>
                </div>
              </div>
            </div>

            {/* Background Jobs Queue Monitor */}
            <div
              style={{
                borderRadius: '12px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} color="#60a5fa" />
                  <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    Hàng Đợi Tác Vụ Robot Real-Time (Background Job Queue)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchBotJobs}
                  disabled={loadingJobs}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                >
                  Làm mới hàng đợi
                </button>
              </div>

              {botJobs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                  Hiện không có tác vụ nào đang chạy trong hàng đợi.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Loại tác vụ</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Trạng thái</th>
                      <th style={{ textAlign: 'left', padding: '8px' }}>Thời gian</th>
                      <th style={{ textAlign: 'right', padding: '8px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {botJobs.map((job) => (
                      <tr key={job._id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '8px', fontWeight: 700, fontFamily: 'monospace' }}>{job.jobType}</td>
                        <td style={{ padding: '8px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor:
                                job.status === 'PROCESSING'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : job.status === 'COMPLETED'
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : job.status === 'FAILED'
                                  ? 'rgba(239, 68, 68, 0.2)'
                                  : 'rgba(255, 255, 255, 0.1)',
                              color:
                                job.status === 'PROCESSING'
                                  ? '#60a5fa'
                                  : job.status === 'COMPLETED'
                                  ? '#34d399'
                                  : job.status === 'FAILED'
                                  ? '#f87171'
                                  : 'var(--text-secondary)',
                            }}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {new Date(job.createdAt).toLocaleTimeString('vi-VN')}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right' }}>
                          {(job.status === 'PROCESSING' || job.status === 'PENDING') && (
                            <button
                              type="button"
                              onClick={async () => {
                                const tid = toast.loading('Đang hủy tác vụ...');
                                try {
                                  await tradingBotApi.cancelJob(job._id, token);
                                  toast.success('Đã hủy tác vụ!', { id: tid });
                                  fetchBotJobs();
                                } catch (e: any) {
                                  toast.error(e.message, { id: tid });
                                }
                              }}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Hủy
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 6. TAB 4: CẤU HÌNH VẬN HÀNH */}
        {/* ========================================================================= */}
        {activeTab === 'SYSTEM_CONFIG' && (
          <div
            style={{
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '800px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <Sliders size={20} color="#10b981" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Cấu Hình Tham Số & Đường Dẫn Thư Mục</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Lưu cấu hình hệ thống trực tiếp qua System Settings API chuẩn Data-Driven
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  Đường dẫn thư mục Backup M-System:
                </label>
                <input
                  type="text"
                  value={systemConfigs.bot_backup_path_ms || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures'}
                  onChange={(e) => setSystemConfigs({ ...systemConfigs, bot_backup_path_ms: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  Đường dẫn thư mục Backup CQG:
                </label>
                <input
                  type="text"
                  value={systemConfigs.bot_backup_path_cqg || 'M:\\Tailieuchung\\QLGD-IT\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures'}
                  onChange={(e) => setSystemConfigs({ ...systemConfigs, bot_backup_path_cqg: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' }}>
                  Giờ bắt đầu phiên (GMT+7):
                </label>
                <input
                  type="text"
                  value={systemConfigs.session_start_time || '05:00'}
                  onChange={(e) => setSystemConfigs({ ...systemConfigs, session_start_time: e.target.value })}
                  style={{
                    width: '120px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={async () => {
                    if (!token) return;
                    setSavingConfig(true);
                    const tid = toast.loading('Đang lưu cấu hình...');
                    try {
                      if (systemConfigs.bot_backup_path_ms) {
                        await tradingBotApi.saveSystemSetting('bot_backup_path_ms', systemConfigs.bot_backup_path_ms, token);
                      }
                      if (systemConfigs.bot_backup_path_cqg) {
                        await tradingBotApi.saveSystemSetting('bot_backup_path_cqg', systemConfigs.bot_backup_path_cqg, token);
                      }
                      if (systemConfigs.session_start_time) {
                        await tradingBotApi.saveSystemSetting('session_start_time', systemConfigs.session_start_time, token);
                      }
                      toast.success('Đã lưu cấu hình thành công!', { id: tid });
                    } catch (e: any) {
                      toast.error(`Lỗi: ${e.message}`, { id: tid });
                    } finally {
                      setSavingConfig(false);
                    }
                  }}
                  disabled={savingConfig}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: savingConfig ? 'not-allowed' : 'pointer',
                  }}
                >
                  {savingConfig ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 7. STATUS FOOTER */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <span
                style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span>Hệ thống: <strong style={{ color: 'var(--text-primary)' }}>Online (V2 Modular)</strong></span>
            </span>
            <span>•</span>
            <span>Phiên làm việc: <strong style={{ color: 'var(--text-primary)' }}>{selectedDate}</strong></span>
            <span>•</span>
            <span>
              Độ lệch:{' '}
              <strong style={{ color: isDiffer ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontWeight: 800 }}>
                {!isDiffer ? '0 lot (Khớp 100%)' : `${totalDiffer} lot`}
              </strong>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              API Architecture: Typed Client Layer
            </span>
            <Link
              href="/trading-manager"
              style={{
                color: '#60a5fa',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>Về bản V1</span>
              <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
