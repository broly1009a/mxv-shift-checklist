'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE_URL } from '@/context/AuthContext';
import { io } from 'socket.io-client';
import {
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Bell,
  BellOff,
  CheckSquare,
  Square,
  Activity,
  ShieldCheck,
  Server,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Terminal,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  History,
  PauseCircle,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TradingManagerLogModal from '../shared/TradingManagerLogModal';
import { ReconLogSummaryModal } from './ReconLogSummaryModal';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';

export interface LegacyReconSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  onOpenGuide?: () => void;
  onStatusChange?: (status: { isDiffer: boolean; totalDifferLots: number; klgdStatus: string }) => void;
}

export default function LegacyReconSection({
  token,
  selectedDate,
  onSelectDate,
  onOpenGuide,
  onStatusChange,
}: LegacyReconSectionProps) {
  const setSelectedDate = onSelectDate || (() => {});
  // Checkbox selections in Table 1
  const [checkPeriodic, setCheckPeriodic] = useState<boolean>(true);
  const [intervalMinutes, setIntervalMinutes] = useState<number>(60);
  const [checkKlgd, setCheckKlgd] = useState<boolean>(true);
  const [checkTtm, setCheckTtm] = useState<boolean>(true);
  const [checkTttt, setCheckTttt] = useState<boolean>(true);

  // Sub Tabs in Discrepancy Section
  const [discrepancyTab, setDiscrepancyTab] = useState<'TRADE' | 'TTM'>('TRADE');

  // Date and Audio
  const [soundAlertEnabled, setSoundAlertEnabled] = useState<boolean>(true);

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [triggeringSection, setTriggeringSection] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeJobLogs, setActiveJobLogs] = useState<string[]>([]);
  const activeJobIdRef = useRef<string | null>(null);
  const activeJobTypeRef = useRef<string>('CHECK_KLGD');

  useEffect(() => {
    activeJobIdRef.current = activeJobId;
  }, [activeJobId]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [selectedRunJobId, setSelectedRunJobId] = useState<string | null>(null);
  const selectedRunJobIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedRunJobIdRef.current = selectedRunJobId;
  }, [selectedRunJobId]);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [showSummaryLogModal, setShowSummaryLogModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Master Switch: Tự động đối chiếu (bot_auto_recon_enabled)
  const [autoReconActive, setAutoReconActive] = useState<boolean>(true);
  const [updatingAutoRecon, setUpdatingAutoRecon] = useState<boolean>(false);
  const [cancellingBot, setCancellingBot] = useState<boolean>(false);


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



  // Initialize date to today (Vietnam GMT+7)
  useEffect(() => {
    const today = new Date();
    const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = vnTime.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  }, []);

  // Lưu cấu hình vào system_settings
  const saveSetting = useCallback(async (key: string, value: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, value }),
      });
    } catch (err: any) {
      console.warn(`Lỗi lưu setting ${key}:`, err);
    }
  }, [token]);

  const debouncedTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const debouncedSaveSetting = useCallback((key: string, value: string, delayMs = 600) => {
    if (debouncedTimersRef.current[key]) {
      clearTimeout(debouncedTimersRef.current[key]);
    }
    debouncedTimersRef.current[key] = setTimeout(() => {
      saveSetting(key, value);
    }, delayMs);
  }, [saveSetting]);

  // Fetch system settings (bot_auto_recon_enabled, bot_periodic_check_enabled, bot_periodic_check_frequency)
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/system-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const map = Object.fromEntries(data.map((item: any) => [item.key, item.value]));
          if (map.bot_auto_recon_enabled !== undefined) {
            setAutoReconActive(map.bot_auto_recon_enabled !== 'false');
          }
          if (map.bot_periodic_check_enabled !== undefined) {
            setCheckPeriodic(map.bot_periodic_check_enabled !== 'false');
          }
          if (map.bot_periodic_check_frequency !== undefined) {
            const freq = Number(map.bot_periodic_check_frequency);
            if (!isNaN(freq) && freq > 0) setIntervalMinutes(freq);
          }
        }
      })
      .catch(() => {});
  }, [token]);

  // Toggle bot_auto_recon_enabled
  const handleToggleAutoRecon = async () => {
    if (!token || updatingAutoRecon) return;
    const nextVal = !autoReconActive;
    setUpdatingAutoRecon(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          key: 'bot_auto_recon_enabled',
          value: nextVal ? 'true' : 'false',
        }),
      });
      if (res.ok) {
        setAutoReconActive(nextVal);
        if (nextVal) {
          toast.success('Đã BẬT tự động đối chiếu trong phiên!');
        } else {
          toast.error('Đã TẮT (DỪNG) tự động đối chiếu trong phiên!');
        }
      } else {
        toast.error('Không thể cập nhật cấu hình tự động đối chiếu.');
      }
    } catch (err: any) {
      toast.error(`Lỗi cập nhật tự động: ${err.message}`);
    } finally {
      setUpdatingAutoRecon(false);
    }
  };

  // Fetch Console Summary Data
  const fetchConsoleSummary = useCallback(async (date?: string, silent: boolean = false, jobId?: string | null) => {
    if (!token) return;
    const qDate = date || selectedDate;
    const targetJobId = jobId !== undefined ? jobId : selectedRunJobIdRef.current;
    if (!silent) setLoading(true);

    try {
      const url = targetJobId
        ? `${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${qDate}&jobId=${targetJobId}`
        : `${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${qDate}`;

      const res = await fetch(url, {
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
      if (data.shiftInfo?.nextScanInSeconds !== undefined && data.shiftInfo.nextScanInSeconds > 0) {
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
      selectedRunJobIdRef.current = null;
      setSelectedRunJobId(null);
      fetchConsoleSummary(selectedDate, false, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Điều hướng xem lại các lượt check trong ngày (Quá khứ / Mới nhất)
  const serverRuns = summaryData?.runs || [];
  const runs = useMemo(() => {
    if (serverRuns && serverRuns.length > 0) return serverRuns;
    // Fallback: nếu server chưa kịp trả về danh sách runs nhưng đã có lượt check hiển thị
    if (summaryData?.klgd?.executedAt || summaryData?.shiftInfo?.lastCheckedAt) {
      const execTime = summaryData?.klgd?.executedAt || summaryData?.shiftInfo?.lastCheckedAt || new Date().toISOString();
      const currentId = selectedRunJobId || summaryData?.currentJobId || summaryData?.klgd?.jobId || 'current-latest';
      const dateObj = new Date(execTime);
      let timePart = '--:--';
      let labelPart = 'Hiện tại';
      if (!isNaN(dateObj.getTime())) {
        const vnDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const day = String(vnDate.getDate()).padStart(2, '0');
        const month = String(vnDate.getMonth() + 1).padStart(2, '0');
        const hours = String(vnDate.getHours()).padStart(2, '0');
        const mins = String(vnDate.getMinutes()).padStart(2, '0');
        timePart = `${hours}:${mins}`;
        labelPart = `${day}/${month} ${timePart}`;
      }
      return [{
        id: currentId,
        jobId: currentId,
        time: timePart,
        label: labelPart,
        createdAt: execTime,
        status: summaryData?.klgd?.status || 'COMPLETED',
      }];
    }
    return [];
  }, [serverRuns, summaryData, selectedRunJobId]);

  // Format thời điểm check hiển thị (Đồng bộ theo lượt đang xem hoặc lượt mới nhất theo giờ Việt Nam)
  const lastCheckedFormatted = useMemo(() => {
    const selectedRun = selectedRunJobId ? runs.find((r: any) => r.id === selectedRunJobId) : runs[0];
    const d = selectedRun?.createdAt || summaryData?.klgd?.executedAt || summaryData?.shiftInfo?.lastCheckedAt;
    if (!d) return '--/-- --:--';
    const dateObj = new Date(d);
    if (isNaN(dateObj.getTime())) return '--/-- --:--';
    const vnDate = new Date(dateObj.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const day = String(vnDate.getDate()).padStart(2, '0');
    const month = String(vnDate.getMonth() + 1).padStart(2, '0');
    const hours = String(vnDate.getHours()).padStart(2, '0');
    const mins = String(vnDate.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  }, [runs, selectedRunJobId, summaryData]);
  const isViewingHistorical = summaryData?.isViewingHistorical || false;
  const currentRunIndex = useMemo(() => {
    if (!runs || runs.length === 0) return -1;
    const targetId = selectedRunJobId || summaryData?.currentJobId || runs[0]?.id;
    return runs.findIndex((r: any) => r.id === targetId);
  }, [runs, selectedRunJobId, summaryData?.currentJobId]);

  const hasPrevRun = currentRunIndex >= 0 && currentRunIndex < runs.length - 1; // Lượt cũ hơn
  const hasNextRun = currentRunIndex > 0; // Lượt mới hơn

  const handleSelectRun = useCallback((jobId: string | null, forceLatest: boolean = false) => {
    if (forceLatest || (runs.length > 0 && jobId === runs[0].id)) {
      selectedRunJobIdRef.current = null;
      setSelectedRunJobId(null);
      fetchConsoleSummary(selectedDate, false, null);
    } else {
      selectedRunJobIdRef.current = jobId;
      setSelectedRunJobId(jobId);
      fetchConsoleSummary(selectedDate, false, jobId);
    }
  }, [runs, selectedDate, fetchConsoleSummary]);

  const goToPrevRun = useCallback(() => {
    if (hasPrevRun && currentRunIndex >= 0 && runs[currentRunIndex + 1]) {
      handleSelectRun(runs[currentRunIndex + 1].id);
    }
  }, [hasPrevRun, currentRunIndex, runs, handleSelectRun]);

  const goToNextRun = useCallback(() => {
    if (hasNextRun && currentRunIndex > 0 && runs[currentRunIndex - 1]) {
      handleSelectRun(runs[currentRunIndex - 1].id);
    }
  }, [hasNextRun, currentRunIndex, runs, handleSelectRun]);

  // Periodic polling fallback (45s dự phòng khi mất kết nối WebSocket)
  useEffect(() => {
    if (!checkPeriodic) return;
    const interval = setInterval(() => {
      // Khi đang xem lượt quá khứ, không tự động refresh đè dữ liệu live
      if (!selectedRunJobIdRef.current) {
        fetchConsoleSummary(selectedDate, true);
      }
    }, 45000);
    return () => clearInterval(interval);
  }, [checkPeriodic, selectedDate, fetchConsoleSummary]);

  // Countdown Timer & Tính toán đếm ngược chu kỳ định kỳ
  useEffect(() => {
    const serverNextScan = summaryData?.shiftInfo?.nextScanInSeconds;
    if (serverNextScan !== undefined && serverNextScan > 0) {
      setCountdownSeconds(serverNextScan);
      return;
    }

    // Fallback tính toán từ thời điểm chạy gần nhất và intervalMinutes
    const execTime = runs[0]?.createdAt || summaryData?.klgd?.executedAt || summaryData?.shiftInfo?.lastCheckedAt;
    if (execTime) {
      const elapsedSeconds = Math.floor((Date.now() - new Date(execTime).getTime()) / 1000);
      const totalFrequencySeconds = (intervalMinutes || 60) * 60;
      const remainingSeconds = Math.max(0, totalFrequencySeconds - elapsedSeconds);
      setCountdownSeconds(remainingSeconds);
    } else {
      setCountdownSeconds((intervalMinutes || 60) * 60);
    }
  }, [summaryData, intervalMinutes, runs]);

  // Bộ đếm nhịp 1 giây giảm dần
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Trình xử lý hoàn tất bot job dùng chung cho cả WebSocket Real-time & Fallback Polling
  const handleJobFinished = useCallback(
    async (job: any, jobType: string = 'CHECK_KLGD') => {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('activeTriggerJobId');
      }
      setActiveJobId(null);
      activeJobIdRef.current = null;
      setTriggering(false);
      setTriggeringSection(null);
      toast.dismiss('bot-job-progress');

      if (Array.isArray(job.logs) && job.logs.length > 0) {
        setActiveJobLogs(job.logs);
      }

      if (job.status === 'COMPLETED') {
        const payloadResult = job.result || job.payload?.result;
        if (jobType === 'CHECK_KLGD') {
          const diffKLGD = payloadResult?.totals?.differ || 0;
          const diffACM = payloadResult?.totals?.differACM || 0;
          const mismatchTrades = payloadResult?.mismatchedTradesTotal || payloadResult?.mismatchedTrades?.length || 0;
          const pendingCount = payloadResult?.pendingSyncTrades?.length || 0;
          if (diffKLGD === 0 && diffACM === 0 && mismatchTrades === 0) {
            const note = pendingCount > 0 ? ` (Bảo lưu ${pendingCount} lệnh sau mốc cắt)` : '';
            toast.success(`Đối chiếu Khớp lệnh hoàn tất: Số liệu khớp hoàn toàn!${note}`, { duration: 5000 });
          } else {
            toast.error(`Đối chiếu Khớp lệnh: Lệch ${mismatchTrades} lệnh (Lệch CQG: ${diffKLGD}, ACM: ${diffACM})`, { duration: 6000 });
          }
        } else if (jobType === 'SCAN_NEGATIVE_MARGIN' || jobType === 'CHECK_EOD_MM') {
          const negAccs = payloadResult?.eodResult?.negativeIMRAcc?.length || payloadResult?.negativeIMRAcc?.length || 0;
          const mismatchEOD = payloadResult?.eodResult?.mismatchedEOD?.length || payloadResult?.mismatchedEOD?.length || 0;
          const mismatchCQG = payloadResult?.cqgResult?.length || 0;
          if (negAccs === 0 && mismatchEOD === 0 && mismatchCQG === 0) {
            toast.success('Đối chiếu EOD hoàn tất: Vị thế & Số dư khớp hoàn toàn, không có TK âm!', { duration: 5000 });
          } else {
            const parts = [];
            if (negAccs > 0) parts.push(`${negAccs} TK âm KQ`);
            if (mismatchEOD > 0) parts.push(`${mismatchEOD} TK lệch EOD`);
            if (mismatchCQG > 0) parts.push(`${mismatchCQG} TK lệch số dư CQG`);
            toast.error(`Hoàn tất EOD: Phát hiện ${parts.join(', ')}!`, { duration: 6000 });
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
      } else if (job.status === 'ABORTED') {
        const errDetail = job.error || 'Dịch vụ đối tác sàn ngoài tạm thời không khả dụng.';
        toast.error(`Tác vụ tạm dừng: ${errDetail}`, { duration: 6000 });
      } else if (job.status === 'CANCELLED') {
        const errDetail = job.error || 'Tác vụ đối chiếu đã bị hủy bỏ.';
        toast.error(`Tác vụ đã bị hủy: ${errDetail}`, { duration: 5000 });
      } else if (job.status === 'FAILED') {
        const errDetail = job.error || 'Có lỗi xảy ra trong quá trình đối chiếu của Bot.';
        toast.error(`Bot thất bại: ${errDetail}`, { duration: 6000 });
      }

      await fetchConsoleSummary(selectedDate, true);
    },
    [selectedDate, fetchConsoleSummary],
  );

  // Reusable Polling Fallback Function for Bot Job
  const pollJobProgress = useCallback(
    async (jobId: string, jobType: string = 'CHECK_KLGD') => {
      if (!token) return;
      setTriggering(true);
      setActiveJobId(jobId);
      activeJobIdRef.current = jobId;
      activeJobTypeRef.current = jobType;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('activeTriggerJobId', jobId);
      }

      const startTime = Date.now();
      const MAX_WAIT_MS = 180000;
      const POLL_INTERVAL_MS = 4000; // Polling an toàn 4s thay vì 2s vì đã có WebSocket
      let isDone = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        // Thoát ngay nếu WebSocket đã xử lý hoàn tất
        if (!activeJobIdRef.current || activeJobIdRef.current !== jobId) {
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        if (!activeJobIdRef.current || activeJobIdRef.current !== jobId) {
          return;
        }

        try {
          const jobRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const job = await jobRes.json();

          if (Array.isArray(job.logs) && job.logs.length > 0) {
            setActiveJobLogs(job.logs);
          }

          if (['COMPLETED', 'ABORTED', 'CANCELLED', 'FAILED'].includes(job.status)) {
            isDone = true;
            await handleJobFinished(job, jobType);
            break;
          }
        } catch {
          // Bỏ qua lỗi mạng chập chờn khi poll fallback
        }
      }

      if (!isDone && activeJobIdRef.current === jobId) {
        toast.dismiss('bot-job-progress');
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('activeTriggerJobId');
        }
        setActiveJobId(null);
        activeJobIdRef.current = null;
        setTriggering(false);
        setTriggeringSection(null);
        toast.success('Bot đã hoàn tất kiểm tra trạng thái.', { duration: 4000 });
        await fetchConsoleSummary(selectedDate, true);
      }
    },
    [token, selectedDate, fetchConsoleSummary, handleJobFinished],
  );

  // Hybrid WebSocket Real-time Synchronization for Trading Manager
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('[WS] Trading Manager connected to socket gateway');
    });

    // 1. Nhận sự kiện cập nhật Dashboard từ hệ thống
    socket.on('dashboard-updated', (payload: any) => {
      console.log('[WS] dashboard-updated received:', payload);
      // Khi đang xem lượt quá khứ, không tự động refresh đè dữ liệu live
      if (!selectedRunJobIdRef.current) {
        fetchConsoleSummary(selectedDate, true);
      }
    });

    // 2. Stream log thời gian thực định kỳ 1.5s
    socket.on('job-log-updated', (payload: { jobId: string; logs: string[]; status?: string }) => {
      if (activeJobIdRef.current && payload?.jobId === activeJobIdRef.current) {
        if (Array.isArray(payload.logs) && payload.logs.length > 0) {
          setActiveJobLogs(payload.logs);
        }
      }
    });

    // 3. Phản hồi hoàn tất / thất bại ngay tức thì (<100ms)
    socket.on('job-status-updated', (payload: any) => {
      if (activeJobIdRef.current && payload?.jobId === activeJobIdRef.current) {
        console.log('[WS] job-status-updated received for active job:', payload);
        handleJobFinished(payload, activeJobTypeRef.current);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedDate, fetchConsoleSummary, handleJobFinished]);

  // Khôi phục tiến trình khi F5 / Reload trang
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const persistedJobId = sessionStorage.getItem('activeTriggerJobId');
    if (persistedJobId && token) {
      setActiveJobId(persistedJobId);
      setTriggering(true);
      pollJobProgress(persistedJobId, 'CHECK_KLGD');
    }
  }, [token, pollJobProgress]);

  // Trigger Manual Check
  const handleTriggerRun = async (jobType: string = 'CHECK_KLGD', sectionId?: string) => {
    if (!token || triggering) return;
    setTriggering(true);
    if (sectionId) setTriggeringSection(sectionId);
    setActiveJobLogs(['[Khởi tạo] Đang kết nối hàng đợi bot...']);

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
        setTriggering(false);
        setTriggeringSection(null);
        return;
      }

      toast.loading('Bot đang thực thi đối chiếu ngầm, vui lòng chờ...', { id: 'bot-job-progress' });
      await pollJobProgress(jobId, jobType);
    } catch (err: any) {
      toast.dismiss('bot-job-progress');
      toast.error(`Không thể kích hoạt đối chiếu: ${err.message}`);
      setTriggering(false);
      setTriggeringSection(null);
    }
  };

  // Dừng khẩn cấp tiến trình bot đang chạy
  const handleEmergencyStopBot = async () => {
    if (!token || cancellingBot) return;

    let targetJobId = activeJobId || summaryData?.klgd?.jobId || summaryData?.currentJobId;

    if (!targetJobId) {
      try {
        const jobsRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=CHECK_KLGD,CHECK_PRE_EOD`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (jobsRes.ok) {
          const jobs = await jobsRes.json();
          const activeJob = Array.isArray(jobs)
            ? jobs.find((j: any) => j.status === 'PROCESSING' || j.status === 'PENDING')
            : null;
          if (activeJob) {
            targetJobId = activeJob._id;
          }
        }
      } catch (err) {
        console.warn('Lỗi tìm job đang chạy:', err);
      }
    }

    if (!targetJobId) {
      toast.error('Không tìm thấy mã tiến trình bot đang chạy để dừng.');
      return;
    }

    const confirmed = window.confirm('Bạn có chắc chắn muốn dừng khẩn cấp tiến trình đối soát của Bot không?');
    if (!confirmed) return;

    setCancellingBot(true);
    const toastId = toast.loading('Đang gửi lệnh dừng bot...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${targetJobId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: 'Dừng khẩn cấp bởi người vận hành qua nút Dừng tại Tab Đối soát' }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể dừng tiến trình bot');
      }

      toast.success('Đã dừng tiến trình đối soát thành công!', { id: toastId });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('activeTriggerJobId');
      }
      setActiveJobId(null);
      activeJobIdRef.current = null;
      setTriggering(false);
      setTriggeringSection(null);
      await fetchConsoleSummary(selectedDate, true);
    } catch (err: any) {
      toast.error(`Lỗi khi dừng bot: ${err.message}`, { id: toastId });
    } finally {
      setCancellingBot(false);
    }
  };

  // Trigger CoreCCP Playwright Download Job

  const totals = summaryData?.klgd?.totals || {};
  const msDSGD = totals.totalDSGD || 0;
  const cqgFR = totals.totalFR || 0;
  const acmStraits = totals.totalACM || 0;
  const nanoLots = totals.totalNano || 0;
  const isAcmAnomaly = totals.acmSessionAnomaly || summaryData?.klgd?.acmSessionAnomaly;
  const acmAnomalyNote = totals.acmAnomalyNote || summaryData?.klgd?.acmAnomalyNote;

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



  const klgdStatus = summaryData?.klgd?.status || 'IDLE';
  const klgdError = summaryData?.klgd?.error || null;
  const klgdLogs = summaryData?.klgd?.logs || [];
  const isWaitingFiles = !!summaryData?.klgd?.isWaitingFiles;
  const waitingMessage = summaryData?.klgd?.waitingMessage || '';

  const isTerminalStatus =
    klgdStatus === 'FAILED' ||
    klgdStatus === 'CANCELLED' ||
    klgdStatus === 'ABORTED' ||
    klgdStatus === 'COMPLETED';

  // Tự động dọn sạch session storage khi job đã hoàn tất hoặc bị hủy/lỗi
  useEffect(() => {
    if (isTerminalStatus && typeof window !== 'undefined') {
      const persisted = sessionStorage.getItem('activeTriggerJobId');
      if (persisted) {
        sessionStorage.removeItem('activeTriggerJobId');
        setActiveJobId(null);
        setTriggering(false);
      }
    }
  }, [isTerminalStatus]);

  const isBotRunning =
    (klgdStatus === 'PROCESSING' || klgdStatus === 'PENDING') ||
    (triggering && !isTerminalStatus);

  const displayLogs =
    (triggering || !!activeJobId) && activeJobLogs.length > 0
      ? activeJobLogs
      : klgdLogs;

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

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.({ isDiffer, totalDifferLots, klgdStatus });
  }, [isDiffer, totalDifferLots, klgdStatus, onStatusChange]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* BOT EXECUTION STATUS & ERROR ALERT BANNER */}
            {klgdStatus === 'FAILED' || klgdStatus === 'CANCELLED' || klgdStatus === 'ABORTED' ? (
              <div style={{
                background: klgdStatus === 'FAILED'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : klgdStatus === 'CANCELLED'
                    ? 'rgba(100, 116, 139, 0.08)'
                    : 'rgba(249, 115, 22, 0.08)',
                border: `1px solid ${klgdStatus === 'FAILED'
                    ? 'rgba(239, 68, 68, 0.3)'
                    : klgdStatus === 'CANCELLED'
                      ? 'rgba(100, 116, 139, 0.3)'
                      : 'rgba(249, 115, 22, 0.3)'
                  }`,
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: klgdStatus === 'FAILED' ? 'rgba(239, 68, 68, 0.15)' : klgdStatus === 'CANCELLED' ? 'rgba(100, 116, 139, 0.15)' : 'rgba(249, 115, 22, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: klgdStatus === 'FAILED' ? '#dc2626' : klgdStatus === 'CANCELLED' ? '#475569' : '#ea580c',
                    flexShrink: 0
                  }}>
                    <AlertTriangle size={22} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>
                        {klgdStatus === 'FAILED' ? 'Lần quét đối soát gần nhất thất bại' : klgdStatus === 'CANCELLED' ? 'Lần quét đối soát gần nhất đã bị hủy' : 'Lần quét đối soát gần nhất bị tạm dừng'}
                      </span>
                      <span style={{
                        fontSize: '0.72rem',
                        backgroundColor: klgdStatus === 'FAILED' ? '#dc2626' : klgdStatus === 'CANCELLED' ? '#64748b' : '#ea580c',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        color: '#ffffff',
                        fontWeight: 700
                      }}>
                        {klgdStatus}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '750px', wordBreak: 'break-word' }}>
                      {klgdError || (klgdStatus === 'CANCELLED' ? 'Tác vụ đối chiếu đã bị hủy bỏ trước khi hoàn thành.' : 'Gặp lỗi trong quá trình tải file M-System / CQG hoặc đối chiếu dữ liệu.')}
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
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
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
                      backgroundColor: klgdStatus === 'FAILED' ? '#dc2626' : klgdStatus === 'CANCELLED' ? '#2563eb' : '#ea580c',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: triggering ? 'not-allowed' : 'pointer',
                      opacity: triggering ? 0.7 : 1,
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)',
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
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#d97706',
                    flexShrink: 0
                  }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
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
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
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
                      backgroundColor: '#d97706',
                      color: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: triggering ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.12)'
                    }}
                  >
                    <RefreshCw size={14} className={triggering ? 'animate-spin' : ''} />
                    <span>{triggering ? 'Đang tải lại...' : 'Tải lại & Đối chiếu'}</span>
                  </button>
                </div>
              </div>
            ) : isBotRunning ? (
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '12px',
                padding: '14px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#2563eb',
                    flexShrink: 0
                  }}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      Bot đang thực hiện quy trình đối soát...
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Đang tự động tải báo cáo DSGD/TTM từ M-System, file CQG và đối chiếu khớp lệnh.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {(displayLogs.length > 0 || klgdLogs.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <Terminal size={14} />
                      <span>Xem Log tiến trình</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleEmergencyStopBot}
                    disabled={cancellingBot}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(220, 38, 38, 0.4)',
                      backgroundColor: 'rgba(220, 38, 38, 0.08)',
                      color: '#dc2626',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: cancellingBot ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 3px rgba(220, 38, 38, 0.1)',
                      transition: 'all 0.2s',
                    }}
                    title="Dừng khẩn cấp tiến trình đối soát của Bot"
                  >
                    <Square size={13} fill={cancellingBot ? 'none' : '#dc2626'} className={cancellingBot ? 'animate-pulse' : ''} />
                    <span>{cancellingBot ? 'Đang dừng...' : 'Stop'}</span>
                  </button>
                </div>
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
                  onClick={() => {
                    const nextVal = !checkPeriodic;
                    setCheckPeriodic(nextVal);
                    saveSetting('bot_periodic_check_enabled', nextVal ? 'true' : 'false');
                  }}
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
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    setIntervalMinutes(num);
                    debouncedSaveSetting('bot_periodic_check_frequency', String(num));
                  }}
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

                {checkPeriodic && (
                  !autoReconActive ? (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}>
                      <PauseCircle size={14} />
                      <span>Tự động đang tắt</span>
                    </span>
                  ) : countdownSeconds > 0 ? (
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
                  ) : (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(245, 158, 11, 0.12)',
                      color: '#d97706',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                    }}>
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Đến lịch quét định kỳ</span>
                    </span>
                  )
                )}
              </div>

              {/* Bên phải: Thời điểm check gần nhất (Giao diện cũ) + Bộ lọc xem lại lượt check bên cạnh */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Nút Xem Nhanh Log Tóm Tắt */}
                <button
                  type="button"
                  onClick={() => setShowSummaryLogModal(true)}
                  title="Xem tóm tắt tiến trình tải dữ liệu và kết quả đối soát của lượt này"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <FileText size={14} style={{ color: '#0ea5e9' }} />
                  <span>Nhật ký tóm tắt</span>
                </button>

                {/* 1. Giao diện gốc cũ: Thời điểm check gần nhất */}
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

                {/* 2. Bộ lọc lượt check nằm bên cạnh (luôn hiển thị, không ẩn) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  paddingLeft: '14px',
                  borderLeft: '1px solid var(--border-color)',
                }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <History size={14} /> Lượt:
                  </span>

                  {/* Nút lùi về lượt trước (<) */}
                  <button
                    type="button"
                    title="Xem lượt check trước đó"
                    disabled={!hasPrevRun}
                    onClick={goToPrevRun}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: hasPrevRun ? 'var(--bg-input)' : 'transparent',
                      color: hasPrevRun ? 'var(--text-primary)' : 'var(--text-secondary)',
                      opacity: hasPrevRun ? 1 : 0.35,
                      cursor: hasPrevRun ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Dropdown / Select chọn lượt */}
                  <select
                    value={selectedRunJobId || (runs[0]?.id || '')}
                    onChange={(e) => handleSelectRun(e.target.value)}
                    disabled={runs.length <= 1}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      backgroundColor: isViewingHistorical ? 'rgba(234, 88, 12, 0.1)' : 'var(--bg-input)',
                      color: isViewingHistorical ? '#ea580c' : 'var(--text-primary)',
                      border: isViewingHistorical ? '1px solid rgba(234, 88, 12, 0.4)' : '1px solid var(--border-color)',
                      cursor: runs.length > 1 ? 'pointer' : 'default',
                      outline: 'none',
                    }}
                  >
                    {runs.length === 0 ? (
                      <option value="">Lượt hiện tại</option>
                    ) : (
                      runs.map((r: any, idx: number) => {
                        const runNumber = runs.length - idx;
                        const date = new Date(r.createdAt || Date.now());
                        const timeStr = date.toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          timeZone: 'Asia/Ho_Chi_Minh',
                        });
                        const isLatest = idx === 0;
                        const labelText = `Lượt #${runNumber} (${timeStr})${isLatest ? ' - Mới nhất' : ''}`;
                        return (
                          <option key={r.id} value={r.id}>
                            {labelText}
                          </option>
                        );
                      })
                    )}
                  </select>

                  {/* Nút tiến tới lượt sau (>) */}
                  <button
                    type="button"
                    title="Xem lượt check mới hơn"
                    disabled={!hasNextRun}
                    onClick={goToNextRun}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: hasNextRun ? 'var(--bg-input)' : 'transparent',
                      color: hasNextRun ? 'var(--text-primary)' : 'var(--text-secondary)',
                      opacity: hasNextRun ? 1 : 0.35,
                      cursor: hasNextRun ? 'pointer' : 'not-allowed',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <ChevronRight size={16} />
                  </button>

                  {/* Nút quay về lượt Mới nhất khi đang xem quá khứ */}
                  {isViewingHistorical && (
                    <button
                      type="button"
                      onClick={() => handleSelectRun(runs[0]?.id, true)}
                      title="Quay lại lượt check mới nhất hiện tại"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(14, 165, 233, 0.12)',
                        color: '#0ea5e9',
                        border: '1px solid rgba(14, 165, 233, 0.3)',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={12} />
                      <span>Về hiện tại</span>
                    </button>
                  )}
                </div>
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
                        <FileSpreadsheet size={15} /> ACM (MS)
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
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: isAcmAnomaly ? '#10b981' : 'var(--text-muted)' }}>
                      <div>{fmt(nanoLots)}</div>
                      {isAcmAnomaly && (
                        <div
                          title={acmAnomalyNote || 'Sàn ACM chưa cắt phiên kế toán. Đã tự động đối soát theo Trade Date thực tế.'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            color: '#d97706',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                          }}
                        >
                          <AlertTriangle size={10} />
                          <span>Khớp Trade Date</span>
                        </div>
                      )}
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
              {/* Date Input with clear label and Today quick-select */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Phiên:
                </span>
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
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(getInitialTradingSessionDate());
                  }}
                  className="btn btn-secondary"
                  title="Đặt lại về phiên ngày hôm nay"
                  style={{
                    height: '42px',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Hôm nay
                </button>
              </div>

              {/* Master Switch: Tự động đối chiếu */}
              <button
                type="button"
                onClick={handleToggleAutoRecon}
                disabled={updatingAutoRecon}
                className="btn"
                style={{
                  height: '42px',
                  padding: '8px 14px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  backgroundColor: autoReconActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                  color: autoReconActive ? '#10b981' : '#ef4444',
                  border: autoReconActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                  cursor: 'pointer',
                }}
                title={autoReconActive ? 'Click để TẮT (DỪNG) tự động đối chiếu trong ca' : 'Click để BẬT lại tự động đối chiếu trong ca'}
              >
                {updatingAutoRecon ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: autoReconActive ? '#10b981' : '#ef4444',
                      display: 'inline-block',
                    }}
                    className={autoReconActive ? 'animate-pulse' : ''}
                  />
                )}
                <span>{autoReconActive ? 'Tự động: BẬT' : 'Tự động: ĐÃ DỪNG'}</span>
              </button>

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

      <TradingManagerLogModal
        isOpen={showLogModal}
        onClose={() => setShowLogModal(false)}
        jobId={summaryData?.klgd?.jobId}
        status={klgdStatus}
        logs={displayLogs}
        onRetry={() => {
          setShowLogModal(false);
          handleTriggerRun('CHECK_KLGD', 'TABLE1');
        }}
        isRetrying={triggering}
      />

      <ReconLogSummaryModal
        isOpen={showSummaryLogModal}
        onClose={() => setShowSummaryLogModal(false)}
        logs={displayLogs}
        runLabel={isViewingHistorical ? `Lượt đang xem (${lastCheckedFormatted})` : `Lượt mới nhất (${lastCheckedFormatted})`}
        runTime={lastCheckedFormatted}
        summaryData={summaryData}
      />
    </>
  );
}
