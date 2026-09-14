'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import {
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Calendar,
  Bell,
  BellOff,
  CheckSquare,
  Square,
  Maximize2,
  Minimize2,
  Sliders,
  Database,
  ExternalLink,
  Activity,
  ShieldCheck,
  Server,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  FileText,
  Loader2,
  Terminal,
  X,
  Download,
  BookOpen,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import CcpLotStatisticsSection from './components/CcpLotStatisticsSection';
import TradingManagerGuideModal from './components/TradingManagerGuideModal';

export default function TradingManagerPage() {
  const { token } = useAuth();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Top Tabs (1:1 Khung C# Desktop + Màn hình đối chiếu CoreCCP)
  const [topTab, setTopTab] = useState<'CHECK_GD_EOD_SYNC' | 'BACKUP_THONG_KE_GTT' | 'CAU_HINH_DUONG_DAN' | 'CORE_CCP_VNCLEAR'>('CHECK_GD_EOD_SYNC');
  const [ccpSubTab, setCcpSubTab] = useState<'EOD_RECON' | 'LOT_STATS'>('EOD_RECON');

  // Checkbox selections in Table 1
  const [checkPeriodic, setCheckPeriodic] = useState<boolean>(true);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [checkKlgd, setCheckKlgd] = useState<boolean>(true);
  const [checkTtm, setCheckTtm] = useState<boolean>(true);
  const [checkTttt, setCheckTttt] = useState<boolean>(true);

  // Sub Tabs in Discrepancy Section
  const [discrepancyTab, setDiscrepancyTab] = useState<'TRADE' | 'TTM'>('TRADE');

  // Date and Audio
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(true);

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggeringSection, setTriggeringSection] = useState<string | null>(null);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // ========= BACKUP TAB STATE =========
  // MS Report checkboxes (mirror BackupService.RunBackup MSReports)
  const [msReports, setMsReports] = useState<Record<string, boolean>>({
    NKTTHT: true, 'DSTKGD-Futures': true, 'DSTKGD-Spread': true,
    'DSTKGD-LME': true, 'DSTKGD-ACM': true, TLQHSKQ: true,
    NR: true, DSTrader: true, 'market-truoc-6h': true,
    DSLDK: true, DSLCK: true, DSLH: true, DSLK: true,
    DSGD: true, TTM: true, TTTT: true, TTCDH: true,
    DSQLKQ: true, QLTKGD: true, 'QLTKGD-am-KQ': true,
  });
  // CQG Report checkboxes
  const [cqgReports, setCqgReports] = useState<Record<string, boolean>>({
    FR1: true, FR2: true, PS1: true, PS2: true,
    OP1: true, OP2: true, OD1: true, OD2: true, AS: true,
  });
  // IMR check result (4 groups from CheckIMR)
  // IMR check result (4 groups from CheckIMR)
  const [imrResult, setImrResult] = useState<{ g1: string[]; g2: string[]; g3: string[]; g4: string[] } | null>(null);
  const [imrLoading, setImrLoading] = useState<boolean>(false);
  // Audit results
  const [auditMsResult, setAuditMsResult] = useState<any>(null);
  const [auditCqgResult, setAuditCqgResult] = useState<any>(null);
  // Macro dates
  const [lotMacroDate, setLotMacroDate] = useState<string>('');
  const [valueMacroDate, setValueMacroDate] = useState<string>('');
  const [macroRunning, setMacroRunning] = useState<'LOT' | 'VALUE' | null>(null);

  // Backup periodic & timing settings (1:1 C# FormMain)
  const [backupPeriodic, setBackupPeriodic] = useState<boolean>(true);
  const [backupPeriodicMinutes, setBackupPeriodicMinutes] = useState<number>(240);
  const [enableBackupTime, setEnableBackupTime] = useState<boolean>(false);
  const [backupTime, setBackupTime] = useState<string>('04:30');
  const [enableStatTime, setEnableStatTime] = useState<boolean>(false);
  const [statTime, setStatTime] = useState<string>('04:45');

  // GTT states & rows (1:1 C# FormMain Table)
  const [gttRows, setGttRows] = useState<Array<{ symbol: string; gttMs: number | null; gttCqg: number | null; diff?: number | null }>>([]);
  const [gttLoading, setGttLoading] = useState<boolean>(false);
  const [gttExporting, setGttExporting] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLogModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sound Beeper
  const playAlertSound = useCallback(() => {
    if (!soundAlertEnabled || typeof window === 'undefined') return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }, [soundAlertEnabled]);

  // Fullscreen toggle handler
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
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Initialize date to today (Vietnam GMT+7)
  useEffect(() => {
    const today = new Date();
    const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = vnTime.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  }, []);

  // Fetch Console Summary Data
  const fetchConsoleSummary = useCallback(async (date?: string, silent: boolean = false) => {
    if (!token) return;
    const qDate = date || selectedDate;
    if (!silent) setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${qDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const data = await res.json();
      setSummaryData(data);
      if (data.shiftInfo?.nextScanInSeconds !== undefined) {
        setCountdownSeconds(data.shiftInfo.nextScanInSeconds);
      }

      const differKlgd = data.klgd?.totals?.differ || 0;
      const differACM = data.klgd?.totals?.differACM || 0;
      if (differKlgd > 0 || differACM > 0) {
        playAlertSound();
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(`Không thể tải dữ liệu: ${err.message}`);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, selectedDate, playAlertSound]);

  // Load when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchConsoleSummary(selectedDate);
    }
  }, [selectedDate, fetchConsoleSummary]);

  // Periodic polling (20s)
  useEffect(() => {
    if (!checkPeriodic) return;
    const interval = setInterval(() => {
      fetchConsoleSummary(selectedDate, true);
    }, 20000);
    return () => clearInterval(interval);
  }, [checkPeriodic, selectedDate, fetchConsoleSummary]);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trigger Manual Check
  const handleTriggerRun = async (jobType: string = 'CHECK_KLGD', sectionId?: string) => {
    if (!token || triggering) return;
    setTriggering(true);
    if (sectionId) setTriggeringSection(sectionId);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          bypassCooldown: true,
          jobType,
          options: {
            checkKlgd,
            checkTtm,
            checkTttt,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`Lỗi khởi chạy: ${res.status}`);
      }

      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt quét đối soát thành công!');
        await fetchConsoleSummary(selectedDate, true);
        return;
      }

      toast.loading('Bot đang thực thi đối chiếu ngầm, vui lòng chờ...', { id: 'bot-job-progress' });

      // Vòng lặp polling theo dõi jobId từ bot_jobs
      const startTime = Date.now();
      const MAX_WAIT_MS = 120000; // Tối đa 2 phút
      const POLL_INTERVAL_MS = 2000; // 2 giây
      let isDone = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const jobRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const job = await jobRes.json();

          if (job.status === 'COMPLETED') {
            isDone = true;
            toast.dismiss('bot-job-progress');

            const payloadResult = job.payload?.result;
            if (jobType === 'CHECK_KLGD') {
              const diffKLGD = payloadResult?.totals?.differ || 0;
              const diffACM = payloadResult?.totals?.differACM || 0;
              const mismatchTrades = payloadResult?.mismatchedTradesTotal || payloadResult?.mismatchedTrades?.length || 0;
              if (diffKLGD === 0 && diffACM === 0 && mismatchTrades === 0) {
                toast.success('✅ Đối chiếu Khớp lệnh hoàn tất: Toàn bộ số liệu khớp hoàn toàn!', { duration: 5000 });
              } else {
                toast.error(`⚠️ Đối chiếu Khớp lệnh: Lệch ${mismatchTrades} lệnh (Lệch CQG: ${diffKLGD}, ACM: ${diffACM})`, { duration: 6000 });
              }
            } else if (jobType === 'SCAN_NEGATIVE_MARGIN' || jobType === 'CHECK_EOD_MM') {
              const negAccs = payloadResult?.eodResult?.negativeIMRAcc?.length || payloadResult?.negativeIMRAcc?.length || 0;
              const mismatchEOD = payloadResult?.eodResult?.mismatchedEOD?.length || payloadResult?.mismatchedEOD?.length || 0;
              const mismatchCQG = payloadResult?.cqgResult?.length || 0;
              if (negAccs === 0 && mismatchEOD === 0 && mismatchCQG === 0) {
                toast.success('✅ Đối chiếu EOD hoàn tất: Vị thế & Số dư khớp hoàn toàn, không có TK âm!', { duration: 5000 });
              } else {
                const parts = [];
                if (negAccs > 0) parts.push(`${negAccs} TK âm KQ`);
                if (mismatchEOD > 0) parts.push(`${mismatchEOD} TK lệch EOD`);
                if (mismatchCQG > 0) parts.push(`${mismatchCQG} TK lệch số dư CQG`);
                toast.error(`⚠️ Hoàn tất EOD: Phát hiện ${parts.join(', ')}!`, { duration: 6000 });
              }
            } else if (jobType === 'CHECK_PRE_EOD') {
              const misTrades = payloadResult?.mismatchedTradesTotal || payloadResult?.mismatchedTrades?.length || 0;
              const misPos = payloadResult?.mismatchedPositionsTotal || payloadResult?.mismatchedPositions?.length || 0;
              if (misTrades === 0 && misPos === 0) {
                toast.success('Đối chiếu Pre-EOD hoàn tất: Khớp lệnh & vị thế trùng khớp 100%!', { duration: 5000 });
              } else {
                toast.error(`Đối chiếu Pre-EOD: Phát hiện ${misTrades} lệnh lệch, ${misPos} vị thế lệch!`, { duration: 6000 });
              }
            } else if (jobType === 'CHECK_EOD_CCP') {
              const totalMis = payloadResult?.mismatchedEOD?.length || 0;
              const totalNeg = (payloadResult?.negativeBalanceAccs?.length || 0) + (payloadResult?.negativeIMRAcc?.length || 0);
              if (totalMis === 0 && totalNeg === 0) {
                toast.success('Đối chiếu CoreCCP hoàn tất: Toàn bộ tài khoản khớp 100% công thức EOD!', { duration: 5000 });
              } else {
                toast.error(`Hoàn tất EOD CoreCCP: Phát hiện ${totalMis} TK lệch công thức, ${totalNeg} TK âm ký quỹ!`, { duration: 6000 });
              }
            } else {
              toast.success('Tác vụ đối chiếu đã hoàn thành thành công!', { duration: 5000 });
            }

            await fetchConsoleSummary(selectedDate, true);
            break;
          } else if (job.status === 'FAILED') {
            isDone = true;
            toast.dismiss('bot-job-progress');
            const errDetail = job.error || 'Có lỗi xảy ra trong quá trình đối chiếu của Bot.';
            toast.error(`Bot thất bại: ${errDetail}`, { duration: 6000 });
            await fetchConsoleSummary(selectedDate, true);
            break;
          }
        } catch {
          // Bỏ qua lỗi mạng chập chờn khi poll
        }
      }

      if (!isDone) {
        toast.dismiss('bot-job-progress');
        toast.success('Bot đã nhận lệnh và đang tiếp tục xử lý ngầm.', { duration: 4000 });
        await fetchConsoleSummary(selectedDate, true);
      }
    } catch (err: any) {
      toast.dismiss('bot-job-progress');
      toast.error(`Không thể kích hoạt đối chiếu: ${err.message}`);
    } finally {
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  // Trigger CoreCCP Playwright Download Job
  const handleTriggerCcpDownload = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    setTriggeringSection('ccp-download');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ccp-download`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: selectedDate,
          reports: ['QLTTTKGD', 'EOD', 'NR', 'TTTT'],
        }),
      });

      if (!res.ok) {
        throw new Error(`Lỗi khởi chạy tải CoreCCP: ${res.status}`);
      }

      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt tải báo cáo CoreCCP!');
        await fetchConsoleSummary(selectedDate, true);
        return;
      }

      toast.loading('Robot Playwright đang tải báo cáo CoreCCP, vui lòng chờ...', { id: 'ccp-job-progress' });

      const startTime = Date.now();
      const MAX_WAIT_MS = 180000;
      const POLL_INTERVAL_MS = 2500;
      let isDone = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const jobRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const job = await jobRes.json();

          if (job.status === 'COMPLETED') {
            isDone = true;
            toast.dismiss('ccp-job-progress');
            toast.success('Đã tải xong toàn bộ báo cáo CoreCCP về thư mục backup!', { duration: 5000 });
            await fetchConsoleSummary(selectedDate, true);
            break;
          } else if (job.status === 'FAILED') {
            isDone = true;
            toast.dismiss('ccp-job-progress');
            toast.error(`Tải báo cáo CoreCCP thất bại: ${job.error || 'Xem log để biết thêm'}`, { duration: 6000 });
            await fetchConsoleSummary(selectedDate, true);
            break;
          }
        } catch {
          // Bỏ qua lỗi mạng chập chờn khi poll
        }
      }

      if (!isDone) {
        toast.dismiss('ccp-job-progress');
        toast.success('Quá trình tải báo cáo CoreCCP đang tiếp tục chạy ngầm.');
      }
    } catch (err: any) {
      toast.dismiss('ccp-job-progress');
      toast.error(err.message || 'Lỗi khi kích hoạt tải báo cáo CoreCCP');
    } finally {
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  // ========= BACKUP TAB HANDLERS =========

  // Generic bot job trigger + polling (shared pattern identical to handleTriggerRun)
  const triggerBotJobAndPoll = async (
    endpoint: string,
    body: Record<string, any>,
    toastId: string,
    loadingMsg: string,
    onCompleted: (job: any) => void,
    onFailed: (job: any) => void,
    maxWaitMs = 180000,
  ) => {
    const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/${endpoint}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    const jobId = result.jobId;
    if (!jobId) { onCompleted(result); return; }
    toast.loading(loadingMsg, { id: toastId });
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!jr.ok) continue;
        const job = await jr.json();
        if (job.status === 'COMPLETED') { toast.dismiss(toastId); onCompleted(job); return; }
        if (job.status === 'FAILED') { toast.dismiss(toastId); onFailed(job); return; }
      } catch { /* bỏ qua lỗi mạng chập chờn */ }
    }
    toast.dismiss(toastId);
    toast.success('Tác vụ đang chạy ngầm, sẽ hoàn thành sau.');
  };

  // Kiểm tra ký quỹ (CheckIMR – BackupService.cs:150)
  const handleCheckIMR = async () => {
    if (!token || imrLoading) return;
    setImrLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, bypassCooldown: true, jobType: 'SCAN_NEGATIVE_MARGIN' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt quét ký quỹ!');
        return;
      }
      toast.loading('Bot đang quét tài khoản âm ký quỹ TKGD...', { id: 'imr-check' });
      const start = Date.now();
      while (Date.now() - start < 180000) {
        await new Promise((r) => setTimeout(r, 2500));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          if (job.status === 'COMPLETED') {
            toast.dismiss('imr-check');
            const r = job.payload?.result || job;
            setImrResult({
              g1: r.imrGroup1 || r.laiLoCoTTM || [],
              g2: r.imrGroup2 || r.kyQuyKhongTTM || [],
              g3: r.imrGroup3 || r.kqycttNeKqyc || [],
              g4: r.imrGroup4 || r.kqkdttNeKqkd || [],
            });
            toast.success('Quét ký quỹ TKGD hoàn tất!', { duration: 5000 });
            return;
          }
          if (job.status === 'FAILED') {
            toast.dismiss('imr-check');
            toast.error(`Quét ký quỹ thất bại: ${job.error || 'Lỗi không xác định'}`, { duration: 6000 });
            return;
          }
        } catch { /* poll error */ }
      }
      toast.dismiss('imr-check');
      toast.success('Tác vụ đang chạy ngầm, sẽ hoàn thành sau.');
    } catch (err: any) {
      toast.error(`Lỗi quét ký quỹ: ${err.message}`);
    } finally {
      setImrLoading(false);
    }
  };

  // Check GTT (Giá thanh toán - C# BackupService.CreateGTT & RunGttCheck)
  const handleCheckGtt = async () => {
    if (!token || gttLoading) return;
    setGttLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/run-gtt-check`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadMarketCsv: true }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.report?.rows) {
        setGttRows(data.report.rows);
        toast.success(`Đối chiếu GTT hoàn tất: ${data.report.rows.length} mã hợp đồng`, { duration: 5000 });
      } else {
        toast.success('Đã chạy kiểm tra GTT!');
      }
    } catch (err: any) {
      toast.error(`Kiểm tra GTT thất bại: ${err.message}`);
    } finally {
      setGttLoading(false);
    }
  };

  // Tạo file nhập GTT (Export Correction Excel)
  const handleExportGttCorrection = async () => {
    if (!token || gttExporting) return;
    setGttExporting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report/export-correction?type=settlement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `GTT_Nhap_${selectedDate || 'today'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất và tải xuống file nhập GTT!');
    } catch (err: any) {
      toast.error(`Tải file nhập GTT thất bại: ${err.message}`);
    } finally {
      setGttExporting(false);
    }
  };

  // Audit Backup MS (kiểm tra thư mục backup MS)
  const handleAuditMsBackup = async () => {
    if (!token || triggeringSection === 'audit-ms') return;
    setTriggeringSection('audit-ms');
    try {
      await triggerBotJobAndPoll(
        'audit-ms-backup',
        { date: selectedDate, reports: Object.entries(msReports).filter(([, v]) => v).map(([k]) => k) },
        'audit-ms',
        'Đang kiểm tra thư mục Backup MS...',
        (job) => {
          setAuditMsResult(job.payload?.result || job);
          toast.success('Kiểm tra Backup MS hoàn tất!', { duration: 5000 });
        },
        (job) => { toast.error(`Kiểm tra Backup MS thất bại: ${job.error || ''}`, { duration: 6000 }); },
        60000,
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTriggeringSection(null);
    }
  };

  // Audit Backup CQG
  const handleAuditCqgBackup = async () => {
    if (!token || triggeringSection === 'audit-cqg') return;
    setTriggeringSection('audit-cqg');
    try {
      await triggerBotJobAndPoll(
        'audit-cqg-backup',
        { date: selectedDate, reports: Object.entries(cqgReports).filter(([, v]) => v).map(([k]) => k) },
        'audit-cqg',
        'Đang kiểm tra thư mục Backup CQG...',
        (job) => {
          setAuditCqgResult(job.payload?.result || job);
          toast.success('Kiểm tra Backup CQG hoàn tất!', { duration: 5000 });
        },
        (job) => { toast.error(`Kiểm tra Backup CQG thất bại: ${job.error || ''}`, { duration: 6000 }); },
        60000,
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setTriggeringSection(null);
    }
  };

  // Thống kê số lô (RUN_LOT_MACRO – BackupService.cs ValueStatics)
  const handleLotMacro = async () => {
    if (!token || macroRunning) return;
    setMacroRunning('LOT');
    try {
      await triggerBotJobAndPoll(
        'trigger-lot-macro',
        { targetDate: lotMacroDate || selectedDate },
        'lot-macro',
        'Đang chạy macro thống kê số lô giao dịch...',
        (_job) => { toast.success('Thống kê số lô hoàn tất! Kiểm tra file Excel kết quả.', { duration: 5000 }); },
        (job) => { toast.error(`Macro số lô thất bại: ${job.error || ''}`, { duration: 6000 }); },
        300000,
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMacroRunning(null);
    }
  };

  // Thống kê giá trị (RUN_VALUE_MACRO – BackupService.cs NewsTradingStatics)
  const handleValueMacro = async () => {
    if (!token || macroRunning) return;
    setMacroRunning('VALUE');
    try {
      await triggerBotJobAndPoll(
        'trigger-value-macro',
        { targetDate: valueMacroDate || selectedDate },
        'value-macro',
        'Đang chạy macro thống kê giá trị giao dịch...',
        (_job) => { toast.success('Thống kê giá trị hoàn tất! Kiểm tra file Excel kết quả.', { duration: 5000 }); },
        (job) => { toast.error(`Macro giá trị thất bại: ${job.error || ''}`, { duration: 6000 }); },
        300000,
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setMacroRunning(null);
    }
  };

  // Extract totals for Table 1 Matrix
  const totals = summaryData?.klgd?.totals || {};
  const msDSGD = totals.totalDSGD || 0;
  const cqgFR = totals.totalFR || 0;
  const acmStraits = totals.totalACM || 0;
  const nanoLots = totals.totalNano || 0;

  const msTTM = totals.totalTTM_MS || totals.totalTTM || 0;
  const cqgTTM = totals.totalTTM_CQG || totals.totalOP || 0;
  const acmTTM = totals.totalTTM_ACM || totals.totalACM_TTM || 0;
  const nanoTTM = 0;

  const msTTTT = totals.totalTTTT || totals.totalTTTT_MS || 0;
  const cqgPS = totals.totalPS || totals.totalPS_CQG || 0;
  const acmTTTT = totals.totalTTTT_ACM || totals.totalACM_TTTT || 0;
  const nanoTTTT = 0;

  // CoreCCP extractions
  const ccpDSGD = totals.totalCCP_DSGD;
  const ccpTTM = totals.totalCCP_TTM;
  const ccpTTTT = totals.totalCCP_TTTT;
  const ccpStatus = totals.ccpStatus || (ccpDSGD !== undefined ? 'COMPLETED' : 'IDLE');

  // Format last checked time (e.g., "08/09 14:00")
  const lastCheckedFormatted = useMemo(() => {
    const d = summaryData?.shiftInfo?.lastCheckedAt || summaryData?.klgd?.executedAt;
    if (!d) return '--/-- --:--';
    const dateObj = new Date(d);
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const mins = String(dateObj.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  }, [summaryData]);

  const klgdStatus = summaryData?.klgd?.status || 'IDLE';
  const klgdError = summaryData?.klgd?.error || null;
  const klgdLogs = summaryData?.klgd?.logs || [];
  const isWaitingFiles = !!summaryData?.klgd?.isWaitingFiles;
  const waitingMessage = summaryData?.klgd?.waitingMessage || '';

  // Discrepancy Trades
  const mismatchedTrades = summaryData?.klgd?.mismatchedTrades || [];
  const mismatchedTTM = summaryData?.klgd?.mismatchedTTM || [];

  // Negative Margin Accounts
  const negativeMarginAccounts: string[] = summaryData?.negativeMargin?.negativeIMRAcc || [];

  // Format number
  const fmt = (n: number) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('en-US');
  };

  const totalDifferLots = (totals.differ || 0) + (totals.differACM || 0);
  const isDiffer =
    totalDifferLots > 0 ||
    (totals.differTTM || 0) > 0 ||
    (totals.differTTTT || 0) > 0 ||
    (totals.differCCP_KLGD !== undefined && totals.differCCP_KLGD > 0) ||
    (totals.differCCP_TTM !== undefined && totals.differCCP_TTM > 0) ||
    (totals.differCCP_TTTT !== undefined && totals.differCCP_TTTT > 0) ||
    (mismatchedTrades?.length || 0) > 0 ||
    (mismatchedTTM?.length || 0) > 0;

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: isFullscreen ? '100vh' : 'auto',
          height: isFullscreen ? '100vh' : 'auto',
          color: 'var(--text-primary)',
          padding: isFullscreen ? '24px' : '0',
          backgroundColor: isFullscreen ? 'var(--bg-app)' : 'transparent',
          position: 'relative',
          overflowY: isFullscreen ? 'auto' : 'visible',
          boxSizing: 'border-box',
        }}
        className="animate-fade-in"
      >
        {/* PAGE HEADER (Chuẩn theo phong cách Bot Config) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px',
          flexShrink: 0,
        }}>
          <div>
            <h1 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Activity color="#10b981" className="animate-pulse" size={26} />
              Trading Manager — Bàn Giám Sát Đối Soát Nghiệp Vụ
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Trung tâm kiểm soát, đối chiếu giao dịch trong phiên & Pre-EOD (M-System vs CQG & ACM).
            </p>
          </div>

          {/* Right Header Status Badges & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* System Online Badge (Giống Agent Status Badge của Bot Config) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 16px',
              borderRadius: '12px',
              border: !isDiffer ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              backgroundColor: !isDiffer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: !isDiffer ? '#34d399' : '#f87171',
            }}>
              <div style={{ position: 'relative', width: '10px', height: '10px' }}>
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundColor: !isDiffer ? '#10b981' : '#ef4444',
                }} className="animate-ping" />
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundColor: !isDiffer ? '#10b981' : '#ef4444',
                }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Hệ thống: Online
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Độ lệch: {!isDiffer ? '0 lot (Khớp 100%)' : `${totalDifferLots > 0 ? totalDifferLots : (mismatchedTrades.length || 1)} lot lệch`}
                </span>
              </div>
            </div>

            {/* Fullscreen Toggle */}
            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Thu nhỏ giao diện' : 'Phóng to toàn màn hình'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* In-App Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                cursor: 'pointer',
              }}
              title="Xem tài liệu hướng dẫn thiết kế & quy trình vận hành"
            >
              <BookOpen size={15} />
              <span>Hướng Dẫn Nghiệp Vụ</span>
            </button>

            {/* Back to Dashboard */}
            <Link
              href="/dashboard"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '9px 16px', textDecoration: 'none' }}
            >
              <ArrowLeft size={15} />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        {/* TAB BUTTONS BAR (Chuẩn 1:1 theo Bot Config lines 308-350) */}
        <div style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '4px',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          minHeight: '44px',
        }} className="table-responsive-wrapper">
          <button
            type="button"
            onClick={() => setTopTab('CHECK_GD_EOD_SYNC')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CHECK_GD_EOD_SYNC' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CHECK_GD_EOD_SYNC' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CHECK_GD_EOD_SYNC' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} color={topTab === 'CHECK_GD_EOD_SYNC' ? '#10b981' : 'var(--text-muted)'} />
            <span>Check GD - EOD - Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('BACKUP_THONG_KE_GTT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'BACKUP_THONG_KE_GTT' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'BACKUP_THONG_KE_GTT' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'BACKUP_THONG_KE_GTT' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={16} color={topTab === 'BACKUP_THONG_KE_GTT' ? '#10b981' : 'var(--text-muted)'} />
            <span>Backup – Thống kê – GTT</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('CAU_HINH_DUONG_DAN')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CAU_HINH_DUONG_DAN' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CAU_HINH_DUONG_DAN' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CAU_HINH_DUONG_DAN' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={16} color={topTab === 'CAU_HINH_DUONG_DAN' ? '#10b981' : 'var(--text-muted)'} />
            <span>Cấu hình – Đường dẫn</span>
          </button>

          <button
            type="button"
            onClick={() => setTopTab('CORE_CCP_VNCLEAR')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CORE_CCP_VNCLEAR' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CORE_CCP_VNCLEAR' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CORE_CCP_VNCLEAR' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FileSpreadsheet size={16} color={topTab === 'CORE_CCP_VNCLEAR' ? '#10b981' : 'var(--text-muted)'} />
            <span>Báo Cáo & Đối Chiếu CoreCCP</span>
          </button>
        </div>

        {/* TAB 1: NỘI DUNG CHÍNH (CHECK GD - EOD - SYNC) */}
        {topTab === 'CHECK_GD_EOD_SYNC' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* BOT EXECUTION STATUS & ERROR ALERT BANNER */}
            {klgdStatus === 'FAILED' ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(185, 28, 28, 0.2))',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f87171',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fca5a5', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Lần quét đối soát gần nhất thất bại</span>
                      <span style={{ fontSize: '0.72rem', backgroundColor: 'rgba(239, 68, 68, 0.35)', padding: '2px 8px', borderRadius: '4px', color: '#fecaca', fontWeight: 700 }}>FAILED</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '750px', wordBreak: 'break-word' }}>
                      {klgdError || 'Gặp lỗi trong quá trình tải file M-System / CQG hoặc đối chiếu dữ liệu.'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {klgdLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Terminal size={14} />
                      <span>Xem chi tiết Log</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_KLGD', 'TABLE1')}
                    disabled={triggering}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: triggering ? 'not-allowed' : 'pointer',
                      opacity: triggering ? 0.7 : 1,
                      transition: 'all 0.2s'
                    }}
                  >
                    <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
                    <span>{triggering ? 'Đang chạy lại...' : 'Chạy lại ngay'}</span>
                  </button>
                </div>
              </div>
            ) : isWaitingFiles ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(217, 119, 6, 0.15))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fbbf24',
                    flexShrink: 0
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#fde68a' }}>
                      Chờ dữ liệu báo cáo đối soát
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {waitingMessage || 'Một số file dữ liệu từ M-System hoặc CQG chưa sẵn sàng để đối chiếu.'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {klgdLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      <Terminal size={14} />
                      <span>Xem Log</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_KLGD', 'TABLE1')}
                    disabled={triggering}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: '#f59e0b',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: triggering ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
                    <span>{triggering ? 'Đang tải lại...' : 'Tải lại & Đối chiếu'}</span>
                  </button>
                </div>
              </div>
            ) : (klgdStatus === 'PROCESSING' || triggering) ? (
              <div style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(37, 99, 235, 0.2))',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#60a5fa',
                    flexShrink: 0
                  }}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#93c5fd' }}>
                      Bot đang thực hiện quy trình đối soát...
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Đang tự động tải báo cáo DSGD/TTM từ M-System, file CQG và đối chiếu khớp lệnh.
                    </div>
                  </div>
                </div>
                {klgdLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLogModal(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Terminal size={14} />
                    <span>Xem Log tiến trình</span>
                  </button>
                )}
              </div>
            ) : null}

            {/* ROW 1: TOOLBAR KIỂM SOÁT ĐỊNH KỲ & THỜI ĐIỂM CHECK */}
            <div className="glass-panel" style={{
              padding: '16px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              {/* Bên trái: Check định kỳ */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setCheckPeriodic(!checkPeriodic)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {checkPeriodic ? (
                    <CheckSquare size={20} color="#10b981" />
                  ) : (
                    <Square size={20} color="var(--text-muted)" />
                  )}
                  <span>Check định kỳ (phút):</span>
                </button>

                <input
                  type="number"
                  min={1}
                  max={180}
                  value={intervalMinutes}
                  onChange={(e) => setIntervalMinutes(Number(e.target.value))}
                  className="form-input"
                  style={{
                    width: '80px',
                    height: '38px',
                    textAlign: 'center',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                  }}
                />

                {checkPeriodic && countdownSeconds > 0 && (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(2, 132, 199, 0.12)',
                    color: '#0284c7',
                    border: '1px solid rgba(2, 132, 199, 0.3)',
                  }}>
                    <Clock size={14} />
                    <span>Quét lại sau: <strong>{Math.floor(countdownSeconds / 60)}p {countdownSeconds % 60}s</strong></span>
                  </span>
                )}
              </div>

              {/* Bên phải: Thời điểm check gần nhất */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                  Thời điểm check gần nhất:
                </span>
                <span style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  letterSpacing: '0.05em',
                }}>
                  {lastCheckedFormatted}
                </span>
              </div>
            </div>

            {/* BẢNG MA TRẬN 3 DÒNG x 4 CỘT (To rõ, font đẹp, không rớt dòng Dữ liệu) */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    borderBottom: '1px solid var(--border-color)',
                  }}>
                    <th style={{ width: '60px', padding: '14px', textAlign: 'center', borderRight: '1px solid var(--border-color)' }}>
                      <button
                        type="button"
                        onClick={() => {
                          const allChecked = checkKlgd && checkTtm && checkTttt;
                          setCheckKlgd(!allChecked);
                          setCheckTtm(!allChecked);
                          setCheckTttt(!allChecked);
                        }}
                        title={checkKlgd && checkTtm && checkTttt ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}
                      >
                        {checkKlgd && checkTtm && checkTttt ? (
                          <CheckSquare size={18} color="#10b981" />
                        ) : checkKlgd || checkTtm || checkTttt ? (
                          <CheckSquare size={18} color="#10b981" style={{ opacity: 0.5 }} />
                        ) : (
                          <Square size={18} color="var(--text-muted)" />
                        )}
                      </button>
                    </th>
                    <th style={{ width: '160px', padding: '14px 20px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', textAlign: 'center' }}>
                      Dữ liệu
                    </th>
                    <th style={{ width: '18%', padding: '14px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#0284c7', fontWeight: 800 }}>
                        <Server size={15} /> M-System
                      </span>
                    </th>
                    <th style={{ width: '18%', padding: '14px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 800 }}>
                        <Activity size={15} /> CQG
                      </span>
                    </th>
                    <th style={{ width: '18%', padding: '14px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#f59e0b', fontWeight: 800 }}>
                        <FileSpreadsheet size={15} /> ACM (Straits)
                      </span>
                    </th>
                    <th style={{ width: '18%', padding: '14px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 800 }}>
                      Nano
                    </th>
                    <th style={{ width: '18%', padding: '14px 20px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#8b5cf6', fontWeight: 800 }}>
                        <ShieldCheck size={15} /> CCP
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* DÒNG 1: KLGD */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '16px', textAlign: 'center', borderRight: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <button type="button" onClick={() => setCheckKlgd(!checkKlgd)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        {checkKlgd ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="var(--text-muted)" />}
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        backgroundColor: 'rgba(2, 132, 199, 0.12)',
                        color: '#0284c7',
                        border: '1px solid rgba(2, 132, 199, 0.3)',
                      }}>
                        KLGD
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: '#0284c7' }}>
                      {fmt(msDSGD)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: '#10b981' }}>
                      {fmt(cqgFR)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: '#f59e0b' }}>
                      {fmt(acmStraits)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                      {fmt(nanoLots)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: '#8b5cf6' }}>
                      {ccpStatus === 'LOADING' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#a78bfa' }}>
                          <Loader2 size={14} className="animate-spin" /> Đang tải...
                        </span>
                      ) : ccpDSGD !== undefined ? (
                        fmt(ccpDSGD)
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>

                  {/* DÒNG 2: TTM */}
                  <tr style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '16px', textAlign: 'center', borderRight: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <button type="button" onClick={() => setCheckTtm(!checkTtm)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        {checkTtm ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="var(--text-muted)" />}
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}>
                        TTM
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(msTTM)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(cqgTTM)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(acmTTM)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                      {fmt(nanoTTM)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {ccpStatus === 'LOADING' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#a78bfa' }}>
                          <Loader2 size={14} className="animate-spin" /> Đang tải...
                        </span>
                      ) : ccpTTM !== undefined ? (
                        fmt(ccpTTM)
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>

                  {/* DÒNG 3: TTTT */}
                  <tr style={{ transition: 'background-color 0.15s' }}>
                    <td style={{ padding: '16px', textAlign: 'center', borderRight: '1px solid var(--border-color)', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <button type="button" onClick={() => setCheckTttt(!checkTttt)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        {checkTttt ? <CheckSquare size={18} color="#10b981" /> : <Square size={18} color="var(--text-muted)" />}
                      </button>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', whiteSpace: 'nowrap', backgroundColor: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}>
                        TTTT
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(msTTTT)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(cqgPS)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {fmt(acmTTTT)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-muted)' }}>
                      {fmt(nanoTTTT)}
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {ccpStatus === 'LOADING' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#a78bfa' }}>
                          <Loader2 size={14} className="animate-spin" /> Đang tải...
                        </span>
                      ) : ccpTTTT !== undefined ? (
                        fmt(ccpTTTT)
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ACTION BAR: DATE PICKER | CHECK THỦ CÔNG | CHECK | CHUÔNG (Nút bấm to rõ theo chuẩn Bot Config) */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
              {/* Date Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                  style={{
                    height: '42px',
                    padding: '8px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    width: '160px',
                    cursor: 'pointer',
                  }}
                />
              </div>

              {/* Check thủ công */}
              <button
                type="button"
                onClick={() => handleTriggerRun('CHECK_KLGD', 'manual')}
                disabled={triggering}
                className="btn btn-secondary"
                style={{
                  height: '42px',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                <Play size={15} className={triggering && triggeringSection === 'manual' ? 'animate-spin' : ''} />
                <span>{triggering && triggeringSection === 'manual' ? 'Đang chạy...' : 'Check thủ công'}</span>
              </button>

              {/* Check (Làm mới) */}
              <button
                type="button"
                onClick={() => fetchConsoleSummary(selectedDate)}
                disabled={loading}
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '10px 24px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                <span>Check</span>
              </button>

              {/* Chuông thông báo âm thanh */}
              <button
                type="button"
                onClick={() => {
                  const next = !soundAlertEnabled;
                  setSoundAlertEnabled(next);
                  if (next) {
                    toast.success('Đã bật âm báo khi phát hiện lệch');
                    playAlertSound();
                  } else {
                    toast('Đã tắt âm báo', { icon: '🔕' });
                  }
                }}
                title={soundAlertEnabled ? 'Chuông cảnh báo: Đang BẬT' : 'Chuông cảnh báo: Đang TẮT'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '42px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: soundAlertEnabled ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)',
                  backgroundColor: soundAlertEnabled ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-input)',
                  color: soundAlertEnabled ? '#f59e0b' : 'var(--text-muted)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  transition: 'all 0.2s',
                }}
              >
                {soundAlertEnabled ? (
                  <>
                    <Bell size={16} className="animate-bounce" />
                    <span>Âm báo: Bật</span>
                  </>
                ) : (
                  <>
                    <BellOff size={16} />
                    <span>Âm báo: Tắt</span>
                  </>
                )}
              </button>
            </div>

            {/* KHUNG CHI TIẾT GIAO DỊCH CHÊNH LỆCH / CHI TIẾT TTM CHÊNH LỆCH */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              {/* Sub-Tabs Header */}
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 16px 0 16px',
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <button
                  type="button"
                  onClick={() => setDiscrepancyTab('TRADE')}
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: discrepancyTab === 'TRADE' ? '2px solid #10b981' : '2px solid transparent',
                    color: discrepancyTab === 'TRADE' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: discrepancyTab === 'TRADE' ? 'var(--bg-card)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Chi tiết giao dịch chênh lệch ({summaryData?.klgd?.mismatchedTradesTotal && summaryData.klgd.mismatchedTradesTotal > mismatchedTrades.length ? `${mismatchedTrades.length}/${summaryData.klgd.mismatchedTradesTotal}` : mismatchedTrades.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDiscrepancyTab('TTM')}
                  style={{
                    padding: '10px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    border: 'none',
                    borderBottom: discrepancyTab === 'TTM' ? '2px solid #10b981' : '2px solid transparent',
                    color: discrepancyTab === 'TTM' ? '#10b981' : 'var(--text-secondary)',
                    backgroundColor: discrepancyTab === 'TTM' ? 'var(--bg-card)' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  Chi tiết TTM chênh lệch ({mismatchedTTM.length})
                </button>
              </div>

              {/* DataGrid View: Dynamic columns matching C# IT Tool (dgvOrderInfo: 6 cols, dgvTTMInfo: 4 cols) */}
              <div style={{ height: '220px', minHeight: '200px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 10 }}>
                    {discrepancyTab === 'TRADE' ? (
                      <tr style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <th style={{ width: '17%', padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>Mã lệnh</th>
                        <th style={{ width: '17%', padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>Mã TKGD</th>
                        <th style={{ width: '16%', padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>Mã HĐ</th>
                        <th style={{ width: '16%', padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Giá khớp</th>
                        <th style={{ width: '16%', padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Khối lượng</th>
                        <th style={{ width: '18%', padding: '12px 16px', textAlign: 'center' }}>Thời gian khớp</th>
                      </tr>
                    ) : (
                      <tr style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <th style={{ width: '25%', padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>Mã TKGD</th>
                        <th style={{ width: '25%', padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>MS</th>
                        <th style={{ width: '25%', padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>CQG</th>
                        <th style={{ width: '25%', padding: '12px 16px', textAlign: 'right' }}>Chênh lệch</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {discrepancyTab === 'TRADE' ? (
                      mismatchedTrades.length > 0 ? (
                        mismatchedTrades.map((item: any, idx: number) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            color: '#ef4444',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                          }}>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>{item.maLenh || item.orderId || item.code || '--'}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>{item.maTKGD || item.account || item.accountCode || '--'}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)' }}>{item.maHD || item.symbol || item.commodity || '--'}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>{fmt(item.giaKhop ?? item.price ?? 0)}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem' }}>{fmt(item.klGiaoDich ?? item.qty ?? item.lot ?? 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>{item.ngayGio || item.time || item.tradeTime || '--'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '24px 36px',
                              borderRadius: '16px',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}>
                              <CheckCircle size={32} color="#10b981" />
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                                Số Liệu Khớp Hoàn Toàn Tuyệt Đối (Độ lệch: 0 lot)
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Không có giao dịch hoặc mã lệnh nào bị lệch giữa M-System, CQG và ACM.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    ) : (
                      mismatchedTTM.length > 0 ? (
                        mismatchedTTM.map((item: any, idx: number) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(245, 158, 11, 0.05)',
                            color: '#f59e0b',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                          }}>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>{item.maTKGD || item.account || '--'}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>{fmt(item.ttmValue ?? item.msPosition ?? item.ms ?? 0)}</td>
                            <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>{fmt(item.opValue ?? item.cqgPosition ?? item.cqg ?? 0)}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: '#ef4444' }}>{fmt(item.differ ?? Math.abs((item.ttmValue || 0) - (item.opValue || 0)))}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} style={{ padding: '40px 20px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '24px 36px',
                              borderRadius: '16px',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}>
                              <CheckCircle size={32} color="#10b981" />
                              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                                Khớp Lệnh TTM Hoàn Toàn (0 Lệnh Lệch)
                              </span>
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Không phát hiện chênh lệch Trạng Thái Mở (TTM) giữa M-System và CQG.
                              </span>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* KHUNG 2 CỘT SONG SONG: CHECK DSGD TRƯỚC EOD & KẾT QUẢ CHẠY EOD */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>

              {/* CỘT TRÁI: Check DSGD trước EOD (~40%) */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Tài khoản âm ký quỹ mới (EOD)
                  </h5>
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_EOD_MM', 'dsgd')}
                    disabled={triggering}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: triggering ? 'not-allowed' : 'pointer',
                      opacity: triggering && triggeringSection !== 'dsgd' ? 0.6 : 1,
                    }}
                  >
                    {triggering && triggeringSection === 'dsgd' ? (
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
                      <tr style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <th style={{ padding: '10px 16px' }}>TKGD âm KQ mới ({negativeMarginAccounts.length})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {negativeMarginAccounts.length > 0 ? (
                        negativeMarginAccounts.map((acc, idx) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            color: '#ef4444',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            fontWeight: 800,
                          }}>
                            <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <AlertTriangle size={15} color="#ef4444" />
                              <span>{acc}</span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={{ padding: '40px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <ShieldCheck size={28} color="#10b981" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                                An Toàn: Không có tài khoản âm ký quỹ mới
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CỘT PHẢI: Kết quả chạy EOD (~60%) */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Kết quả chạy EOD
                  </h5>
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_EOD_MM', 'eod')}
                    disabled={triggering}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.75rem',
                      padding: '6px 14px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: triggering ? 'not-allowed' : 'pointer',
                      opacity: triggering && triggeringSection !== 'eod' ? 0.6 : 1,
                    }}
                  >
                    {triggering && triggeringSection === 'eod' ? (
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
                      <tr style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        borderBottom: '1px solid var(--border-color)',
                      }}>
                        <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>TKGD</th>
                        <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>QLTKGD</th>
                        <th style={{ width: '34%', padding: '10px 16px' }}>EOD result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((summaryData?.preEod?.mismatchedEOD && summaryData.preEod.mismatchedEOD.length > 0) ||
                        (summaryData?.preEod?.mismatchedPositions && summaryData.preEod.mismatchedPositions.length > 0)) ? (
                        (summaryData?.preEod?.mismatchedEOD?.length > 0
                          ? summaryData.preEod.mismatchedEOD
                          : summaryData.preEod.mismatchedPositions
                        ).map((p: any, idx: number) => (
                          <tr key={idx} style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(239, 68, 68, 0.05)',
                            color: '#ef4444',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                          }}>
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>
                              {p.system && (
                                <span style={{
                                  display: 'inline-block',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  marginRight: '6px',
                                  backgroundColor: p.system === 'CCP' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                  color: p.system === 'CCP' ? '#a855f7' : '#3b82f6',
                                  border: `1px solid ${p.system === 'CCP' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`,
                                }}>
                                  [{p.system}]
                                </span>
                              )}
                              {p.maTKGD || p.account || '--'}
                            </td>
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>{fmt(p.calculatedBalance ?? p.msPosition ?? 0)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(p.eodBalance ?? p.cqgPosition ?? 0)} {p.differ !== undefined ? `(Lệch: ${fmt(p.differ)})` : ''}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '40px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle size={28} color="#10b981" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                                Tất cả vị thế và kết quả EOD khớp hoàn toàn (MS & CCP)
                              </span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* KHUNG DƯỚI CÙNG: KẾT QUẢ ĐỒNG BỘ SỐ DƯ CQG */}
            <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 20px',
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
              }}>
                <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Kết quả đồng bộ số dư CQG
                </h5>
                <button
                  type="button"
                  onClick={() => handleTriggerRun('CHECK_CQG_SYNC', 'balance')}
                  disabled={triggering}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering && triggeringSection !== 'balance' ? 0.6 : 1,
                  }}
                >
                  {triggering && triggeringSection === 'balance' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Checking...</span>
                    </>
                  ) : (
                    'Check'
                  )}
                </button>
              </div>

              <div style={{ height: '160px', minHeight: '140px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
                    <tr style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      borderBottom: '1px solid var(--border-color)',
                    }}>
                      <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>TKGD</th>
                      <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Balance MS</th>
                      <th style={{ width: '34%', padding: '10px 16px', textAlign: 'right' }}>Balance CQG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData?.preEod?.cqgResult && summaryData.preEod.cqgResult.length > 0 ? (
                      summaryData.preEod.cqgResult.map((item: any, idx: number) => (
                        <tr key={idx} style={{
                          borderBottom: '1px solid var(--border-color)',
                          backgroundColor: 'rgba(239, 68, 68, 0.05)',
                          color: '#ef4444',
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                        }}>
                          <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>{item.maTKGD || item.account || '--'}</td>
                          <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>${fmt(item.calculatedBalance ?? item.balanceMS ?? 0)}</td>
                          <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                            ${fmt(item.cqgBalance ?? item.balanceCQG ?? 0)} {item.differ !== undefined && item.differ > 0 ? `(Lệch: $${fmt(item.differ)})` : ''}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <CheckCircle size={28} color="#10b981" />
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                              Số dư tài khoản đồng bộ khớp hoàn toàn giữa MS và CQG
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : topTab === 'CORE_CCP_VNCLEAR' ? (
          /* TAB 4: BÁO CÁO & ĐỐI CHIẾU CORECCP (VNCLEAR) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* SUB-TABS NAVIGATION: EOD RECONCILIATION vs LOT & GTGD STATISTICS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <button
                type="button"
                onClick={() => setCcpSubTab('EOD_RECON')}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: ccpSubTab === 'EOD_RECON' ? '2px solid #10b981' : '2px solid transparent',
                  color: ccpSubTab === 'EOD_RECON' ? '#10b981' : 'var(--text-secondary)',
                  backgroundColor: ccpSubTab === 'EOD_RECON' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                }}
              >
                <ShieldCheck size={16} color={ccpSubTab === 'EOD_RECON' ? '#10b981' : 'var(--text-muted)'} />
                <span>1. Đối Soát Ký Quỹ & EOD (VNCLEAR)</span>
              </button>

              <button
                type="button"
                onClick={() => setCcpSubTab('LOT_STATS')}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderBottom: ccpSubTab === 'LOT_STATS' ? '2px solid #10b981' : '2px solid transparent',
                  color: ccpSubTab === 'LOT_STATS' ? '#10b981' : 'var(--text-secondary)',
                  backgroundColor: ccpSubTab === 'LOT_STATS' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                }}
              >
                <FileSpreadsheet size={16} color={ccpSubTab === 'LOT_STATS' ? '#10b981' : 'var(--text-muted)'} />
                <span>2. Thống Kê Số Lot & GTGD (Thay Thế Macro)</span>
              </button>
            </div>

            {ccpSubTab === 'EOD_RECON' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* CORECCP CONTROL & ACTION HEADER */}
                <div className="glass-panel" style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    color: '#10b981',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    VNCLEAR Automation
                  </span>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Đối Soát & Báo Cáo CoreCCP (VNCLEAR)
                  </h3>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Thu thập tự động báo cáo QLTTTKGD, EOD, NR, TTTT qua Playwright và đối chiếu số dư EOD công thức 4 thành phần.
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleTriggerCcpDownload}
                  disabled={triggering}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '8px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    borderColor: 'rgba(59, 130, 246, 0.3)',
                    color: '#60a5fa',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                  }}
                >
                  {triggering && triggeringSection === 'ccp-download' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang tải báo cáo...</span>
                    </>
                  ) : (
                    <>
                      <Download size={15} />
                      <span>Tải Báo Cáo CoreCCP</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleTriggerRun('CHECK_EOD_CCP', 'ccp-check')}
                  disabled={triggering}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '8px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: triggering ? 'not-allowed' : 'pointer',
                  }}
                >
                  {triggering && triggeringSection === 'ccp-check' ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang đối chiếu...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>Kiểm Tra Đối Chiếu CCP</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setShowLogModal(true)}
                  className="btn btn-secondary"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  title="Mở toàn màn hình xem nhật ký bot"
                >
                  <Terminal size={15} />
                  <span>Log Modal</span>
                </button>
              </div>
            </div>

            {/* KPI STATS CARDS */}
            {(() => {
              const ccp = summaryData?.ccpSummary;
              const filesPresent = ccp?.filesPresent;
              const filesCount = [
                filesPresent?.qltkgd,
                filesPresent?.eod,
                filesPresent?.nr,
                filesPresent?.tttt,
              ].filter(Boolean).length;
              const totalAccounts = ccp?.totals?.totalAccounts || 0;
              const totalNegative = ccp?.totals?.totalNegative || 0;
              const totalMismatched = ccp?.totals?.totalMismatched || 0;

              return (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  {/* Card 1 */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Tổng Tài Khoản CCP
                      </span>
                      <Database size={18} color="#3b82f6" />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {fmt(totalAccounts)} <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>TK</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Ghi nhận trong file EOD
                    </span>
                  </div>

                  {/* Card 2 */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        File Báo Cáo Sẵn Sàng
                      </span>
                      <FileSpreadsheet size={18} color={filesCount === 4 ? '#10b981' : '#f59e0b'} />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: filesCount === 4 ? '#10b981' : '#f59e0b' }}>
                      {filesCount}/4 <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Tệp</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      QLTTTKGD, EOD, NR, TTTT
                    </span>
                  </div>

                  {/* Card 3 */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Tài Khoản Âm Ký Quỹ
                      </span>
                      <AlertTriangle size={18} color={totalNegative > 0 ? '#ef4444' : '#10b981'} />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalNegative > 0 ? '#ef4444' : '#10b981' }}>
                      {totalNegative} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TK</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {totalNegative > 0 ? 'Cần xử lý nộp ký quỹ gấp' : 'An toàn: Không có TK âm'}
                    </span>
                  </div>

                  {/* Card 4 */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                        Lệch Công Thức EOD
                      </span>
                      <ShieldCheck size={18} color={totalMismatched > 0 ? '#ef4444' : '#10b981'} />
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: totalMismatched > 0 ? '#ef4444' : '#10b981' }}>
                      {totalMismatched} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>TK</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {totalMismatched > 0 ? 'Phát hiện chênh lệch số dư' : 'Khớp 100% công thức chuẩn'}
                    </span>
                  </div>
                </div>
              );
            })()}

            {/* 2-COLUMN MAIN VIEW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 45%) 1fr', gap: '20px' }}>
              {/* CỘT TRÁI: DANH SÁCH FILE NGUỒN & TERMINAL LOGS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* File Status Box */}
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                  <div style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      File Báo Cáo Tại Thư Mục Backup
                    </h5>
                    <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {summaryData?.ccpSummary?.folderPath ? summaryData.ccpSummary.folderPath.split(/[\\/]/).pop() : 'CoreCCP'}
                    </span>
                  </div>

                  <div style={{ padding: '16px' }}>
                    {(() => {
                      const files = summaryData?.ccpSummary?.filesPresent;
                      const fileItems = [
                        {
                          code: 'QLTTTKGD',
                          name: 'Báo cáo Quản lý Thông tin TKGD & Số dư',
                          present: !!files?.qltkgd,
                          filename: files?.qltkgdName || 'QLTTTKGD*.csv',
                          size: files?.qltkgdSize || 0,
                        },
                        {
                          code: 'EOD',
                          name: 'Báo cáo Ký quỹ & Số dư cuối ngày',
                          present: !!files?.eod,
                          filename: files?.eodName || 'EOD*.csv',
                          size: files?.eodSize || 0,
                        },
                        {
                          code: 'NR',
                          name: 'Báo cáo Nộp / Rút tiền ký quỹ trong phiên',
                          present: !!files?.nr,
                          filename: files?.nrName || 'NR*.csv',
                          size: files?.nrSize || 0,
                        },
                        {
                          code: 'TTTT',
                          name: 'Báo cáo Thông tin Tiền Thanh toán',
                          present: !!files?.tttt,
                          filename: files?.ttttName || 'TTTT*.csv',
                          size: files?.ttttSize || 0,
                        },
                      ];

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {fileItems.map((f, i) => (
                            <div
                              key={i}
                              style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: f.present ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '12px',
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                    {f.code}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {f.name}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                  {f.present ? `${f.filename} (${(f.size / 1024).toFixed(1)} KB)` : 'Chưa tải file'}
                                </span>
                              </div>

                              <span style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                backgroundColor: f.present ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: f.present ? '#10b981' : '#ef4444',
                              }}>
                                {f.present ? 'ĐÃ CÓ' : 'CHƯA CÓ'}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Live Terminal Log Box */}
                <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={14} color="#10b981" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        Nhật Ký Tải & Đối Chiếu Robot CoreCCP
                      </span>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Live Output
                    </span>
                  </div>

                  <div style={{
                    padding: '14px 16px',
                    backgroundColor: '#050b14',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    height: '240px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    {(() => {
                      const downloadLogs = summaryData?.ccpSummary?.downloadJob?.logs || [];
                      const checkLogs = summaryData?.ccpSummary?.checkJob?.logs || [];
                      const combinedLogs = [...downloadLogs, ...checkLogs];

                      if (combinedLogs.length === 0) {
                        return (
                          <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
                            Chưa có nhật ký ghi nhận. Bấm "Tải Báo Cáo CoreCCP" hoặc "Kiểm Tra Đối Chiếu CCP" để chạy.
                          </div>
                        );
                      }

                      return combinedLogs.map((log: string, idx: number) => {
                        const isErr = log.includes('LỖI') || log.includes('Error') || log.includes('bất thường') || log.includes('failed');
                        const isSuccess = log.includes('THÀNH CÔNG') || log.includes('Hoàn thành');
                        return (
                          <div
                            key={idx}
                            style={{
                              color: isErr ? '#f87171' : isSuccess ? '#34d399' : '#94a3b8',
                              lineHeight: 1.5,
                              wordBreak: 'break-all',
                            }}
                          >
                            {log}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>

              {/* CỘT PHẢI: BẢNG CHI TIẾT KẾT QUẢ ĐỐI CHIẾU EOD CORECCP */}
              <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Chi Tiết Chênh Lệch Công Thức EOD CoreCCP
                    </h5>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      backgroundColor: (summaryData?.ccpSummary?.totals?.totalMismatched || 0) > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: (summaryData?.ccpSummary?.totals?.totalMismatched || 0) > 0 ? '#ef4444' : '#10b981',
                    }}>
                      {summaryData?.ccpSummary?.totals?.totalMismatched || 0} Tài Khoản
                    </span>
                  </div>
                </div>

                <div style={{ minHeight: '320px', maxHeight: '580px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
                      <tr style={{
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input)',
                      }}>
                        <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', width: '150px' }}>
                          Mã TKGD
                        </th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                          Số Dư Tính Toán (VND)
                        </th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                          Số Dư Báo Cáo EOD (VND)
                        </th>
                        <th style={{ padding: '10px 16px', fontWeight: 700, textAlign: 'right', width: '180px' }}>
                          Chênh Lệch (VND)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const mismatched = summaryData?.ccpSummary?.mismatchedAccounts || [];
                        if (mismatched.length === 0) {
                          return (
                            <tr>
                              <td colSpan={4} style={{ padding: '60px 20px', textAlign: 'center' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                                  <ShieldCheck size={36} color="#10b981" />
                                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#10b981' }}>
                                    Số Dư Khớp Hoàn Toàn 100%
                                  </span>
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Không phát hiện bất kỳ sai lệch nào giữa công thức tính toán và số dư EOD CoreCCP
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return mismatched.map((item: any, idx: number) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid var(--border-color)',
                              backgroundColor: 'rgba(239, 68, 68, 0.04)',
                              fontFamily: 'monospace',
                              fontSize: '0.82rem',
                            }}
                          >
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800, color: '#f87171' }}>
                              {item.maTKGD}
                            </td>
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                              {fmt(item.calculatedBalance)}
                            </td>
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                              {fmt(item.eodBalance)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                              {fmt(item.differ)}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
              </div>
            ) : (
              <CcpLotStatisticsSection
                token={token}
                selectedDate={selectedDate}
                onOpenGuide={() => setShowGuideModal(true)}
              />
            )}
          </div>
        ) : topTab === 'BACKUP_THONG_KE_GTT' ? (
          /* TAB 2: BACKUP – THỐNG KÊ – GTT (Khớp 1:1 FormMain.cs của C# Desktop App) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* ===== HEADER BAR: NGÀY PHIÊN & THỜI ĐIỂM BACKUP (1:1 C# FormMain Top Row) ===== */}
            <div className="glass-panel" style={{ padding: '14px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                {/* Ngày phiên hiện tại */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Calendar size={16} color="#10b981" />
                  <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Ngày phiên hiện tại:
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="form-input"
                    style={{ width: '150px', height: '34px', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700 }}
                  />
                </div>

                {/* Backup định kỳ (phút) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={backupPeriodic}
                      onChange={(e) => setBackupPeriodic(e.target.checked)}
                      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
                    />
                    <span>Backup định kỳ (phút)</span>
                  </label>
                  <input
                    type="number"
                    value={backupPeriodicMinutes}
                    onChange={(e) => setBackupPeriodicMinutes(Number(e.target.value))}
                    disabled={!backupPeriodic}
                    className="form-input"
                    style={{ width: '75px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700 }}
                  />
                </div>

                {/* Thời điểm backup */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={enableBackupTime}
                      onChange={(e) => setEnableBackupTime(e.target.checked)}
                      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
                    />
                    <span>Thời điểm backup</span>
                  </label>
                  <input
                    type="time"
                    value={backupTime}
                    onChange={(e) => setBackupTime(e.target.value)}
                    disabled={!enableBackupTime}
                    className="form-input"
                    style={{ width: '95px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
                  />
                </div>

                {/* Thời điểm tạo thống kê */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={enableStatTime}
                      onChange={(e) => setEnableStatTime(e.target.checked)}
                      style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
                    />
                    <span>Thời điểm tạo thống kê</span>
                  </label>
                  <input
                    type="time"
                    value={statTime}
                    onChange={(e) => setStatTime(e.target.value)}
                    disabled={!enableStatTime}
                    className="form-input"
                    style={{ width: '95px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
                  />
                </div>
              </div>
            </div>

            {/* ===== SECTION 1: BACKUP MS & BACKUP CQG (1:1 Layout C# FormMain) ===== */}
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '24px' }}>
                
                {/* --- BACKUP MS (3 CỘT) --- */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup MS</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={Object.values(msReports).every(Boolean)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setMsReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                            }}
                            style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                          />
                          <span>All</span>
                        </label>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>20 báo cáo</span>
                    </div>

                    {/* 3 Cột Checkbox chuẩn C# */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 12px' }}>
                      {/* Cột 1 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {['NKTTHT', 'DSTKGD-Futures', 'DSTKGD-Spread', 'DSTKGD-LME', 'DSTKGD-ACM', 'TLQHSKQ', 'NR', 'DSTrader', 'market-truoc-6h'].map((key) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={!!msReports[key]}
                              onChange={() => setMsReports((prev) => ({ ...prev, [key]: !prev[key] }))}
                              style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{key === 'market-truoc-6h' ? 'market truoc 6h' : key}</span>
                          </label>
                        ))}
                      </div>

                      {/* Cột 2 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {['DSLDK', 'DSLCK', 'DSLH', 'DSLK', 'DSGD', 'TTM', 'TTTT', 'TTCDH', 'DSQLKQ'].map((key) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={!!msReports[key]}
                              onChange={() => setMsReports((prev) => ({ ...prev, [key]: !prev[key] }))}
                              style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{key}</span>
                          </label>
                        ))}
                      </div>

                      {/* Cột 3 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {['QLTKGD', 'QLTKGD-am-KQ'].map((key) => (
                          <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            <input
                              type="checkbox"
                              checked={!!msReports[key]}
                              onChange={() => setMsReports((prev) => ({ ...prev, [key]: !prev[key] }))}
                              style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                            />
                            <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{key === 'QLTKGD-am-KQ' ? 'QLTKGD âm KQ' : key}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Nút Backup MS */}
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAuditMsBackup}
                      disabled={triggeringSection === 'audit-ms'}
                      className="btn btn-primary"
                      style={{ width: '180px', fontSize: '0.84rem', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {triggeringSection === 'audit-ms' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {triggeringSection === 'audit-ms' ? 'Đang backup...' : 'Backup'}
                    </button>
                    {auditMsResult && (
                      <div style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                        {auditMsResult.message || 'Kiểm tra hoàn tất'}
                      </div>
                    )}
                  </div>
                </div>

                {/* --- BACKUP CQG (1 CỘT) --- */}
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup CQG</span>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                          <input
                            type="checkbox"
                            checked={Object.values(cqgReports).every(Boolean)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setCqgReports((prev) => Object.fromEntries(Object.keys(prev).map((k) => [k, checked])));
                            }}
                            style={{ accentColor: '#10b981', width: '14px', height: '14px' }}
                          />
                          <span>All</span>
                        </label>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>9 file</span>
                    </div>

                    {/* Danh sách 9 file CQG */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 12px' }}>
                      {['FR1', 'FR2', 'PS1', 'PS2', 'OP1', 'OP2', 'OD1', 'OD2', 'AS'].map((key) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={!!cqgReports[key]}
                            onChange={() => setCqgReports((prev) => ({ ...prev, [key]: !prev[key] }))}
                            style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                          />
                          <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{key}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Nút Backup CQG */}
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleAuditCqgBackup}
                      disabled={triggeringSection === 'audit-cqg'}
                      className="btn btn-primary"
                      style={{ width: '180px', fontSize: '0.84rem', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      {triggeringSection === 'audit-cqg' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                      {triggeringSection === 'audit-cqg' ? 'Đang backup...' : 'Backup'}
                    </button>
                    {auditCqgResult && (
                      <div style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.76rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                        {auditCqgResult.message || 'Kiểm tra hoàn tất'}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* ===== SECTION 2: GIÁ THANH TOÁN (GTT) (1:1 C# FormMain Middle Section) ===== */}
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Giá thanh toán
                  </span>
                  <Link
                    href="/admin/bot-config?tab=gtt"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Sliders size={13} />
                    <span>Tạo file</span>
                  </Link>
                  <button
                    type="button"
                    onClick={handleCheckGtt}
                    disabled={gttLoading}
                    className="btn btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {gttLoading ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    <span>{gttLoading ? 'Đang check...' : 'Check'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleExportGttCorrection}
                    disabled={gttExporting}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {gttExporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                    <span>{gttExporting ? 'Đang xuất file...' : 'Tạo file nhập'}</span>
                  </button>
                </div>
                {gttRows.length > 0 && (
                  <span style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>
                    Đã tải {gttRows.length} mã hợp đồng
                  </span>
                )}
              </div>

              {/* Bảng GTT: Mã HĐ | GTT MS | GTT CQG */}
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', fontWeight: 800 }}>
                      <th style={{ padding: '8px 16px', borderRight: '1px solid var(--border-color)', width: '30%' }}>Mã HĐ</th>
                      <th style={{ padding: '8px 16px', borderRight: '1px solid var(--border-color)', width: '35%', textAlign: 'right' }}>GTT MS</th>
                      <th style={{ padding: '8px 16px', width: '35%', textAlign: 'right' }}>GTT CQG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gttRows.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Chưa có dữ liệu đối chiếu giá thanh toán. Bấm &ldquo;Check&rdquo; để chạy hoặc vào &ldquo;Tạo file&rdquo; để cấu hình GTT.
                        </td>
                      </tr>
                    ) : (
                      gttRows.map((row, idx) => {
                        const isDiff = row.gttMs !== null && row.gttCqg !== null && row.gttMs !== row.gttCqg;
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isDiff ? 'rgba(239, 68, 68, 0.06)' : 'transparent', fontFamily: 'monospace' }}>
                            <td style={{ padding: '7px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 700, color: isDiff ? '#ef4444' : 'var(--text-primary)' }}>
                              {row.symbol}
                            </td>
                            <td style={{ padding: '7px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                              {row.gttMs !== null ? row.gttMs.toLocaleString('vi-VN') : '—'}
                            </td>
                            <td style={{ padding: '7px 16px', textAlign: 'right', fontWeight: isDiff ? 800 : 400, color: isDiff ? '#ef4444' : 'inherit' }}>
                              {row.gttCqg !== null ? row.gttCqg.toLocaleString('vi-VN') : '—'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== SECTION 3: KIỂM TRA KÝ QUỸ TKGD (1:1 C# CheckIMR 4 boxes) ===== */}
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Kiểm tra ký quỹ TKGD
                </span>
                <button
                  type="button"
                  onClick={handleCheckIMR}
                  disabled={imrLoading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '6px 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {imrLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>{imrLoading ? 'Đang check...' : 'Check'}</span>
                </button>
              </div>

              {/* 4 Nhóm IMR chuẩn 1:1 C# */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                {[
                  {
                    key: 'g1',
                    title: 'TK có lãi lỗ dự kiến nhưng không có TTM',
                    color: '#f59e0b',
                    bg: 'rgba(245, 158, 11, 0.05)',
                  },
                  {
                    key: 'g2',
                    title: 'TK không có TTM và lệnh chờ nhưng có KQTT',
                    color: '#ef4444',
                    bg: 'rgba(239, 68, 68, 0.05)',
                  },
                  {
                    key: 'g3',
                    title: 'TKGD có TTM, không có lệnh chờ nhưng KQYCTT = KQYC',
                    color: '#8b5cf6',
                    bg: 'rgba(139, 92, 246, 0.05)',
                  },
                  {
                    key: 'g4',
                    title: 'TK không có lệnh chờ nhưng KQKĐTT = KQKĐ',
                    color: '#3b82f6',
                    bg: 'rgba(59, 130, 246, 0.05)',
                  },
                ].map(({ key, title, color, bg }) => {
                  const group = imrResult?.[key as keyof typeof imrResult] || [];
                  return (
                    <div
                      key={key}
                      style={{
                        border: `1px solid ${color}35`,
                        borderRadius: '8px',
                        padding: '12px',
                        backgroundColor: bg,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color, marginBottom: '8px', minHeight: '36px', lineHeight: 1.35, textAlign: 'center' }}>
                        {title}
                      </div>
                      <div
                        style={{
                          borderTop: `1px solid ${color}20`,
                          paddingTop: '8px',
                          minHeight: '70px',
                          maxHeight: '120px',
                          overflowY: 'auto',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          fontFamily: 'monospace',
                          lineHeight: 1.5,
                        }}
                      >
                        {imrResult === null ? (
                          <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '16px' }}>— Chưa check —</div>
                        ) : group.length === 0 ? (
                          <div style={{ color: '#10b981', fontWeight: 700, textAlign: 'center', paddingTop: '16px' }}>Không có tài khoản</div>
                        ) : (
                          group.map((acc: string, i: number) => (
                            <div key={i} style={{ padding: '2px 0' }}>{acc}</div>
                          ))
                        )}
                      </div>
                      {group.length > 0 && (
                        <div style={{ marginTop: '8px', padding: '3px 8px', borderRadius: '4px', backgroundColor: `${color}20`, fontSize: '0.72rem', fontWeight: 800, color, textAlign: 'center' }}>
                          Phát hiện {group.length} tài khoản
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ===== SECTION 4: THỐNG KÊ GIAO DỊCH (1:1 C# FormMain Bottom) ===== */}
            <div className="glass-panel" style={{ padding: '18px 22px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Thống kê số lot giao dịch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Thống kê số lot giao dịch
                    </span>
                    <input
                      type="date"
                      value={lotMacroDate || selectedDate}
                      onChange={(e) => setLotMacroDate(e.target.value)}
                      className="form-input"
                      style={{ width: '145px', height: '32px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLotMacro}
                    disabled={!!macroRunning}
                    className="btn btn-primary"
                    style={{ width: '160px', fontSize: '0.8rem', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    {macroRunning === 'LOT' ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>{macroRunning === 'LOT' ? 'Đang chạy...' : 'Chạy thống kê'}</span>
                  </button>
                </div>

                {/* Thống kê giá trị giao dịch */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Thống kê giá trị giao dịch
                    </span>
                    <input
                      type="date"
                      value={valueMacroDate || selectedDate}
                      onChange={(e) => setValueMacroDate(e.target.value)}
                      className="form-input"
                      style={{ width: '145px', height: '32px', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleValueMacro}
                    disabled={!!macroRunning}
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: '0.83rem', padding: '9px', background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {macroRunning === 'VALUE' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                    {macroRunning === 'VALUE' ? 'Đang chạy Macro Giá Trị...' : 'Chạy Thống Kê Giá Trị'}
                  </button>
                  <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Tương ứng: <code style={{ color: '#6366f1' }}>BackupService.NewsTradingStatics()</code> /
                    NestJS: <code style={{ color: '#6366f1' }}>trigger-value-macro</code>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== SECTION 5: LINK TẮT ===== */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Link
                href="/admin/upload-backup"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <Server size={15} />
                Mở Thư Mục Backup
              </Link>
              <Link
                href="/history"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <Clock size={15} />
                Lịch Sử Ca Trực
              </Link>
              <Link
                href="/admin/bot-config"
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '9px 18px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '7px' }}
              >
                <Sliders size={15} />
                Cấu Hình Bot Toàn Diện
              </Link>
            </div>
          </div>
        ) : topTab === 'CAU_HINH_DUONG_DAN' ? (
          /* TAB 3: CẤU HÌNH - ĐƯỜNG DẪN */
          <div className="glass-panel" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <h3 style={{
              fontSize: '1.1rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <Sliders size={20} color="#10b981" />
              <span>Cấu Hình Đường Dẫn Hệ Thống Đối Soát</span>
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Đường dẫn Backup M-System:
                </label>
                <input
                  readOnly
                  value="/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup MS/Futures"
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace', padding: '10px 14px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Đường dẫn Backup CQG:
                </label>
                <input
                  readOnly
                  value="/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup CQG/Futures"
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace', padding: '10px 14px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Đường dẫn Backup ACM Straits CSV:
                </label>
                <input
                  readOnly
                  value="/mnt/qlgd-it/Quanlygiaodich/Tai lieu hoat dong/Backup ACM"
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace', padding: '10px 14px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Mốc giờ bắt đầu phiên (Session Start):
                </label>
                <input
                  readOnly
                  value="05:00 AM (Lọc loại trừ lệnh xuyên đêm T-1)"
                  className="form-input"
                  style={{ fontSize: '0.8rem', fontFamily: 'monospace', padding: '10px 14px', color: '#10b981', fontWeight: 700 }}
                />
              </div>
            </div>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <Link
                href="/admin/bot-config"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: '#10b981',
                  textDecoration: 'none',
                }}
              >
                <span>Cấu Hình Tham Số Bot Toàn Diện</span>
                <ExternalLink size={14} />
              </Link>
            </div>
          </div>
        ) : null}

        {/* STATUS FOOTER (Chuẩn hóa thanh trạng thái) */}
        <div style={{
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
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} className="animate-pulse" />
              <span>Hệ thống: <strong style={{ color: 'var(--text-primary)' }}>Online</strong></span>
            </span>
            <span>•</span>
            <span>Phiên làm việc: <strong style={{ color: 'var(--text-primary)' }}>{selectedDate || 'Hôm nay'}</strong></span>
            <span>•</span>
            <span>
              Độ lệch: <strong style={{ color: isDiffer ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontWeight: 800 }}>
                {!isDiffer ? '0 lot (Khớp 100%)' : `${totalDifferLots > 0 ? totalDifferLots : (mismatchedTrades.length || 1)} lot`}
              </strong>
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Server: 10.0.0.26:3001
          </div>
        </div>

        {/* IN-APP GUIDE MODAL */}
        <TradingManagerGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
        />

        {/* LOG VIEWER MODAL (Adaptive Theme via CSS Variables & createPortal) */}
        {showLogModal && mounted && typeof document !== 'undefined' && createPortal(
          <div
            onClick={() => setShowLogModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 999999,
              padding: '24px',
              boxSizing: 'border-box',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                maxWidth: '920px',
                width: '100%',
                maxHeight: '88vh',
                height: 'auto',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: 'var(--glass-shadow, 0 20px 45px -10px rgba(0, 0, 0, 0.15))',
                color: 'var(--text-primary)',
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '16px 22px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card)',
                flexShrink: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Terminal size={19} color="var(--color-accent, #3b82f6)" />
                  <span style={{ fontWeight: 800, fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                    Nhật ký thực thi Bot Đối Soát (Job ID: {summaryData?.klgd?.jobId ? String(summaryData.klgd.jobId).slice(-8) : 'N/A'})
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    backgroundColor: klgdStatus === 'FAILED' ? 'rgba(239, 68, 68, 0.12)' : klgdStatus === 'COMPLETED' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                    color: klgdStatus === 'FAILED' ? '#ef4444' : klgdStatus === 'COMPLETED' ? '#10b981' : '#3b82f6',
                    border: `1px solid ${klgdStatus === 'FAILED' ? 'rgba(239, 68, 68, 0.25)' : klgdStatus === 'COMPLETED' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
                  }}>
                    {klgdStatus}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    padding: '6px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                  }}
                  title="Đóng (Esc)"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body: Monospace Logs Container */}
              <div style={{
                padding: '18px 22px',
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: '220px',
                maxHeight: 'calc(88vh - 145px)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
              }}>
                <div style={{
                  padding: '16px',
                  overflowY: 'auto',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '0.82rem',
                  lineHeight: '1.65',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}>
                  {klgdLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
                      Chưa có nhật ký ghi nhận cho phiên chạy này.
                    </div>
                  ) : (
                    klgdLogs.map((logLine: string, idx: number) => {
                      const isErr = logLine.includes('❌') || logLine.toLowerCase().includes('lỗi') || logLine.toLowerCase().includes('fail');
                      const isSuccess = logLine.includes('✅') || logLine.includes('thành công') || logLine.includes('khớp');
                      const isWarn = logLine.includes('') || logLine.toLowerCase().includes('timeout') || logLine.includes('bỏ qua');

                      return (
                        <div
                          key={idx}
                          style={{
                            color: isErr ? '#dc2626' : isSuccess ? '#16a34a' : isWarn ? '#d97706' : 'var(--text-primary)',
                            fontWeight: (isErr || isSuccess || isWarn) ? 600 : 400,
                            wordBreak: 'break-word',
                            padding: '2px 0',
                            borderBottom: '1px dashed var(--border-color)',
                          }}
                        >
                          {logLine}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '14px 22px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card)',
                flexShrink: 0,
              }}>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLogModal(false);
                    handleTriggerRun('CHECK_KLGD', 'TABLE1');
                  }}
                  disabled={triggering}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'var(--color-accent, #3b82f6)',
                    color: '#ffffff',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: triggering ? 'not-allowed' : 'pointer',
                    opacity: triggering ? 0.7 : 1,
                    transition: 'all 0.2s',
                  }}
                >
                  <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
                  <span>Chạy lại đối soát</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </ProtectedRoute>
  );
}
