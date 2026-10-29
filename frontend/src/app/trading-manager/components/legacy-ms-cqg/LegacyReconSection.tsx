'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { API_BASE_URL } from '@/context/AuthContext';
import { api } from '@/services/api';
import { useAppSocket } from '@/services/appSocket';
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
  FileText,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import TradingManagerLogModal from '../shared/TradingManagerLogModal';
import { ReconLogSummaryModal } from './ReconLogSummaryModal';
import LegacyGttCheckerSection from './LegacyGttCheckerSection';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';

export interface LegacyReconSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
  onOpenGuide?: () => void;
  onStatusChange?: (status: { isDiffer: boolean; totalDifferLots: number; klgdStatus: string }) => void;
  viewMode?: 'ALL' | 'KLGD_ONLY' | 'EOD_ONLY';
}

export default function LegacyReconSection({
  token,
  selectedDate,
  onSelectDate,
  onOpenGuide,
  onStatusChange,
  viewMode = 'ALL',
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
  const [dsgdBeforeEodLogModalOpen, setDsgdBeforeEodLogModalOpen] = useState<boolean>(false);
  const [showSummaryLogModal, setShowSummaryLogModal] = useState<boolean>(false);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  // Master Switch: Tự động đối chiếu (bot_auto_recon_enabled)
  const [autoReconActive, setAutoReconActive] = useState<boolean>(true);
  const [updatingAutoRecon, setUpdatingAutoRecon] = useState<boolean>(false);
  const [cancellingBot, setCancellingBot] = useState<boolean>(false);

  // Modal thông báo gián đoạn & Fallback về lần thành công gần nhất (Clean UI/UX)
  const [failedJobPrompt, setFailedJobPrompt] = useState<{
    jobId: string;
    error?: string;
    jobType: string;
  } | null>(null);
  const hasDismissedPromptRef = useRef<boolean>(false);


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
      await api.admin.saveSystemSetting(key, value, token);
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
    api.admin.getSystemSettings(token)
      .then((data: any) => {
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
      await api.admin.saveSystemSetting('bot_auto_recon_enabled', nextVal ? 'true' : 'false', token);
      setAutoReconActive(nextVal);
      if (nextVal) {
        toast.success('Đã bật tự động đối chiếu trong phiên!', { duration: 2000 });
      } else {
        toast('Đã tắt tự động đối chiếu trong phiên', { duration: 2000 });
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
      const data = await api.tradingOps.getConsoleSummary(qDate, targetJobId || undefined, token);
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
    // Defense-in-depth: Đảm bảo chỉ lấy các lượt check Trong phiên (CHECK_KLGD), tuyệt đối loại trừ CHECK_DSGD_BEFORE_EOD
    const klgdRuns = (serverRuns || []).filter((r: any) => !r.jobType || r.jobType === 'CHECK_KLGD');
    if (klgdRuns && klgdRuns.length > 0) return klgdRuns;
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
        setFailedJobPrompt(null);
        const payloadResult = job.result || job.payload?.result;
        if (jobType === 'CHECK_KLGD') {
          const diffKLGD = payloadResult?.totals?.differ || 0;
          const diffACM = payloadResult?.totals?.differACM || 0;
          const mismatchTrades = payloadResult?.mismatchedTradesTotal || payloadResult?.mismatchedTrades?.length || 0;
          const pendingCount = payloadResult?.pendingSyncTrades?.length || 0;
          if (diffKLGD === 0 && diffACM === 0 && mismatchTrades === 0) {
            const note = pendingCount > 0 ? ` (Bảo lưu ${pendingCount} lệnh)` : '';
            toast.success(`Đối chiếu Khớp lệnh hoàn tất: Khớp 100%!${note}`, { duration: 2500 });
          } else {
            toast(`Phát hiện chênh lệch đối chiếu (${mismatchTrades} lệnh lệch)`, { icon: '⚠️', duration: 3000 });
          }
        } else if (jobType === 'SCAN_NEGATIVE_MARGIN' || jobType === 'CHECK_EOD_MS') {
          const negAccs = payloadResult?.eodResult?.negativeIMRAcc?.length || payloadResult?.negativeIMRAcc?.length || 0;
          const mismatchEOD = payloadResult?.eodResult?.mismatchedEOD?.length || payloadResult?.mismatchedEOD?.length || 0;
          const mismatchCQG = payloadResult?.cqgResult?.length || 0;
          if (negAccs === 0 && mismatchEOD === 0 && mismatchCQG === 0) {
            toast.success('Đối chiếu EOD hoàn tất: Khớp 100%!', { duration: 2500 });
          } else {
            toast('Hoàn tất EOD: Phát hiện tài khoản cần kiểm tra', { icon: '⚠️', duration: 3000 });
          }
        } else if (jobType === 'CHECK_DSGD_BEFORE_EOD') {
          const misTrades = payloadResult?.mismatchedTradesTotal || payloadResult?.mismatchedTrades?.length || 0;
          const misPos = payloadResult?.mismatchedPositionsTotal || payloadResult?.mismatchedPositions?.length || 0;
          if (misTrades === 0 && misPos === 0) {
            toast.success('Đối chiếu Dsgd-Before-EOD: Khớp 100%!', { duration: 2500 });
          } else {
            toast('Đối chiếu Dsgd-Before-EOD: Phát hiện chênh lệch', { icon: '⚠️', duration: 3000 });
          }
        } else if (jobType === 'CHECK_EOD_CCP') {
          const totalMis = payloadResult?.mismatchedEOD?.length || 0;
          const totalNeg = (payloadResult?.negativeBalanceAccs?.length || 0) + (payloadResult?.negativeIMRAcc?.length || 0);
          if (totalMis === 0 && totalNeg === 0) {
            toast.success('Đối chiếu CoreCCP hoàn tất: Khớp 100%!', { duration: 2500 });
          } else {
            toast('Hoàn tất EOD CoreCCP: Phát hiện chênh lệch', { icon: '⚠️', duration: 3000 });
          }
        } else {
          toast.success('Tác vụ đối chiếu đã hoàn thành thành công!', { duration: 2500 });
        }
      } else if (job.status === 'CANCELLED') {
        setFailedJobPrompt(null);
        // Tự động giữ / lùi về lần chạy thành công gần nhất mà không văng popup lỗi
        const lastCompleted = (runs || []).find((r: any) => r.status === 'COMPLETED');
        if (lastCompleted && lastCompleted.id && lastCompleted.id !== selectedRunJobIdRef.current) {
          handleSelectRun(lastCompleted.id);
        }
      } else if (job.status === 'ABORTED' || job.status === 'FAILED') {
        setFailedJobPrompt({
          jobId: job._id || job.id,
          error: job.error || (job.status === 'ABORTED' ? 'Dịch vụ đối tác sàn ngoài tạm thời không khả dụng.' : 'Quá trình đối chiếu của Bot gặp sự cố.'),
          jobType,
        });
      }

      await fetchConsoleSummary(selectedDate, true);
    },
    [selectedDate, fetchConsoleSummary, runs, handleSelectRun],
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
          const job = await api.checklistHub.getJobDetail(jobId, token);
          if (!job) continue;

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
        toast.success('Bot đã hoàn tất kiểm tra trạng thái.', { duration: 2500 });
        await fetchConsoleSummary(selectedDate, true);
      }
    },
    [token, selectedDate, fetchConsoleSummary, handleJobFinished],
  );

  const fetchConsoleSummaryRef = useRef(fetchConsoleSummary);
  useEffect(() => {
    fetchConsoleSummaryRef.current = fetchConsoleSummary;
  }, [fetchConsoleSummary]);

  const handleJobFinishedRef = useRef(handleJobFinished);
  useEffect(() => {
    handleJobFinishedRef.current = handleJobFinished;
  }, [handleJobFinished]);

  const selectedDateRef = useRef(selectedDate);
  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  // Hybrid WebSocket Real-time Synchronization for Trading Manager (AppSocket Singleton)
  useAppSocket(
    {
      'connect': () => {
        console.log('[WS] Trading Manager connected to socket gateway');
      },
      // 1. Nhận sự kiện cập nhật Dashboard từ hệ thống
      'dashboard-updated': (payload: any) => {
        console.log('[WS] dashboard-updated received:', payload);
        // Khi đang xem lượt quá khứ, không tự động refresh đè dữ liệu live
        if (!selectedRunJobIdRef.current) {
          fetchConsoleSummaryRef.current?.(selectedDateRef.current, true);
        }
      },
      // 2. Stream log thời gian thực định kỳ 1.5s
      'job-log-updated': (payload: { jobId: string; logs: string[]; status?: string }) => {
        if (activeJobIdRef.current && payload?.jobId === activeJobIdRef.current) {
          if (Array.isArray(payload.logs) && payload.logs.length > 0) {
            setActiveJobLogs(payload.logs);
          }
        }
      },
      // 3. Phản hồi hoàn tất / thất bại ngay tức thì (<100ms)
      'job-status-updated': (payload: any) => {
        if (activeJobIdRef.current && payload?.jobId === activeJobIdRef.current) {
          console.log('[WS] job-status-updated received for active job:', payload);
          handleJobFinishedRef.current?.(payload, activeJobTypeRef.current);
        }
      },
    },
    Boolean(token),
  );

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
      const result = await api.tradingOps.triggerRun(
        jobType,
        selectedDate,
        {
          checkKlgd,
          checkTtm,
          checkTttt,
        },
        token,
      );

      const jobId = result.jobId;
      const isReused = Boolean(result.isReused);

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt quét đối soát thành công!');
        await fetchConsoleSummary(selectedDate, true);
        setTriggering(false);
        setTriggeringSection(null);
        return;
      }

      hasDismissedPromptRef.current = false;

      await pollJobProgress(jobId, jobType);
    } catch (err: any) {
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
        const jobs = await api.checklistHub.getJobs({ jobTypes: 'CHECK_KLGD,CHECK_DSGD_BEFORE_EOD' }, token);
        const activeJob = Array.isArray(jobs)
          ? jobs.find((j: any) => j.status === 'PROCESSING' || j.status === 'PENDING')
          : null;
        if (activeJob) {
          targetJobId = activeJob._id;
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
    try {
      await api.checklistHub.cancelJob(targetJobId, token);

      toast('Đã dừng tiến trình đối soát', { duration: 2000 });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('activeTriggerJobId');
      }
      setActiveJobId(null);
      activeJobIdRef.current = null;
      setTriggering(false);
      setTriggeringSection(null);
      await fetchConsoleSummary(selectedDate, true);
    } catch (err: any) {
      toast.error(`Lỗi khi dừng bot: ${err.message}`);
    } finally {
      setCancellingBot(false);
    }
  };

  // Handlers cho Failed Job Prompt (Clean UI / UX)
  const handleRetryFromPrompt = useCallback(async () => {
    const currentPrompt = failedJobPrompt;
    setFailedJobPrompt(null);
    hasDismissedPromptRef.current = false;
    if (currentPrompt?.jobType) {
      await handleTriggerRun(currentPrompt.jobType, 'TABLE1');
    } else {
      await handleTriggerRun('CHECK_KLGD', 'TABLE1');
    }
  }, [failedJobPrompt, handleTriggerRun]);

  const handleDismissFromPrompt = useCallback(() => {
    setFailedJobPrompt(null);
    hasDismissedPromptRef.current = true;
    const lastCompleted = (runs || []).find((r: any) => r.status === 'COMPLETED');
    if (lastCompleted && lastCompleted.id) {
      handleSelectRun(lastCompleted.id);
    } else {
      handleSelectRun(null, true);
    }
  }, [runs, handleSelectRun]);

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

  // Logic so sánh màu sắc theo rule chỉ đạo:
  // 1. KLGD, TTM, TTTT của CQG so với M-System => Cân: màu đen (var(--text-primary)), Không cân: màu đỏ (#ef4444)
  const isKlgdBalanced = msDSGD === cqgFR;
  const isTtmBalanced = msTTM === cqgTTM;
  const isTtttBalanced = msTTTT === cqgPS;

  // 2. Phần KLGD của ACM + CCP = Nano => Bằng (cân): màu đen, Không cân: màu đỏ
  // Đồng bộ với backend totals.differACM (đã tính mốc cutoff time và bù trừ pending trades)
  const isAcmNanoBalanced =
    totals.differACM !== undefined
      ? totals.differACM === 0
      : (acmStraits + (Number(ccpDSGD) || 0)) === nanoLots;

  const klgdMsCqgColor = isKlgdBalanced ? 'var(--text-primary)' : '#ef4444';
  const ttmMsCqgColor = isTtmBalanced ? 'var(--text-primary)' : '#ef4444';
  const ttttMsCqgColor = isTtttBalanced ? 'var(--text-primary)' : '#ef4444';
  const acmNanoCcpKlgdColor = isAcmNanoBalanced ? 'var(--text-primary)' : '#ef4444';



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

  // Stopwatch đếm thời gian thực thi (giây) khi Bot đang chạy
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const botStartTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let interval: any = null;
    if (isBotRunning) {
      if (!botStartTimeRef.current) {
        botStartTimeRef.current = Date.now();
      }
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - botStartTimeRef.current) / 1000)));

      interval = setInterval(() => {
        if (botStartTimeRef.current) {
          setElapsedSeconds(Math.max(0, Math.floor((Date.now() - botStartTimeRef.current) / 1000)));
        }
      }, 1000);
    } else {
      botStartTimeRef.current = null;
      setElapsedSeconds(0);
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isBotRunning]);

  const formatElapsed = (sec: number) => {
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    return `${mm}:${ss}s`;
  };

  // Tính toán phần trăm tiến độ (%) và giai đoạn chạy của Bot dựa trên stream log thực tế + elapsedSeconds
  const botProgressInfo = useMemo(() => {
    if (!isBotRunning) {
      return { percent: 0, stage: '', detail: '' };
    }

    const logs = displayLogs || [];
    const lastLogRaw = logs.length > 0 ? logs[logs.length - 1] : '';
    const cleanLog = lastLogRaw.replace(/^\[.*?\]\s*/, '').trim();
    const fullLogText = logs.join(' ').toLowerCase();

    // 1. Kiểm tra trạng thái hoàn tất
    const isCompleted =
      klgdStatus === 'COMPLETED' ||
      fullLogText.includes('hoàn thành đối chiếu khớp lệnh') ||
      fullLogText.includes('kết quả: khớp') ||
      fullLogText.includes('kết quả: lệch');

    if (isCompleted) {
      return {
        percent: 100,
        stage: 'Đã hoàn tất đối chiếu',
        detail: cleanLog || 'Đối chiếu khớp lệnh đã hoàn thành thành công.',
      };
    }

    // 2. Chặng 4: Đang so khớp & Kiểm tra chênh lệch (Matching Engine)
    // Nhận diện khi bắt đầu so khớp hoặc đã hoàn tất bước ghép file thô
    const isMatchingStage =
      fullLogText.includes('so khớp và kiểm tra') ||
      fullLogText.includes('bắt đầu so khớp') ||
      fullLogText.includes('khoảng thời gian lọc') ||
      fullLogText.includes('bảo lưu lệnh khớp muộn') ||
      fullLogText.includes('hoàn tất kiểm tra và ghép file thô') ||
      fullLogText.includes('ghép thành công ps') ||
      (fullLogText.includes('so khớp') && !fullLogText.includes('bắt đầu chạy đối chiếu khớp lệnh định kỳ'));

    if (isMatchingStage) {
      const stageBase = 72;
      const stageCap = 92;
      const dynamicPercent = Math.min(stageCap, stageBase + Math.floor(elapsedSeconds * 0.7));

      return {
        percent: Math.max(stageBase, dynamicPercent),
        stage: 'Đang so khớp & Kiểm tra chênh lệch',
        detail: cleanLog || 'Đang so khớp chi tiết từng giao dịch giữa MS, CQG, CoreCCP và Straits...',
      };
    }

    // 3. Chặng 3: Xử lý & Ghép file thô CQG
    const isMergingStage =
      fullLogText.includes('ghép nối các file thô') ||
      fullLogText.includes('ghép thành công fr') ||
      fullLogText.includes('ghép thành công op') ||
      fullLogText.includes('kiểm soát toàn vẹn');

    if (isMergingStage) {
      const stageBase = 55;
      const stageCap = 70;
      const dynamicPercent = Math.min(stageCap, stageBase + Math.floor(elapsedSeconds * 0.8));

      return {
        percent: Math.max(stageBase, dynamicPercent),
        stage: 'Xử lý & Ghép file thô CQG',
        detail: cleanLog || 'Ghép nối dữ liệu CQG và kiểm tra tính toàn vẹn 4 nguồn...',
      };
    }

    // 4. Chặng 2: Đang tải & Đồng bộ dữ liệu 4 nguồn (Ingress Barrier)
    const isIngressStage =
      fullLogText.includes('chuẩn bị và đồng bộ') ||
      fullLogText.includes('pre-flight') ||
      fullLogText.includes('rào cản') ||
      fullLogText.includes('tất cả các hệ thống') ||
      fullLogText.includes('ms') ||
      fullLogText.includes('cqg') ||
      fullLogText.includes('ccp') ||
      fullLogText.includes('straits') ||
      fullLogText.includes('tải');

    if (isIngressStage) {
      let sourceCount = 0;
      if (
        fullLogText.includes('ms') &&
        (fullLogText.includes('thành công') || fullLogText.includes('sẵn sàng') || fullLogText.includes('bỏ qua m-system'))
      ) sourceCount++;
      if (
        fullLogText.includes('ccp') &&
        (fullLogText.includes('hoàn tất') || fullLogText.includes('sẵn sàng') || fullLogText.includes('thành công'))
      ) sourceCount++;
      if (
        fullLogText.includes('cqg') &&
        (fullLogText.includes('thành công') || fullLogText.includes('sẵn sàng') || fullLogText.includes('đã lưu'))
      ) sourceCount++;
      if (
        fullLogText.includes('straits') ||
        (fullLogText.includes('acm') &&
          (fullLogText.includes('thành công') || fullLogText.includes('sẵn sàng') || fullLogText.includes('bỏ qua acm')))
      ) sourceCount++;

      const barrierTriggered =
        fullLogText.includes('tất cả các hệ thống') ||
        fullLogText.includes('bắt đầu đồng loạt xuất');

      const stageBase = barrierTriggered ? 45 : Math.min(48, 20 + sourceCount * 7);
      const stageCap = 54;
      const dynamicPercent = Math.min(stageCap, stageBase + Math.floor(elapsedSeconds * 0.5));

      return {
        percent: Math.max(stageBase, dynamicPercent),
        stage: 'Đang tải dữ liệu 4 nguồn',
        detail: cleanLog || 'Đang đồng bộ tải dữ liệu M-System, CoreCCP, CQG và Straits...',
      };
    }

    // 5. Chặng 1: Khởi tạo quy trình
    const initialBase = 12;
    const initialCap = 18;
    const dynamicPercent = Math.min(initialCap, initialBase + Math.floor(elapsedSeconds * 1.0));

    return {
      percent: dynamicPercent,
      stage: 'Khởi tạo quy trình',
      detail: cleanLog || 'Đang kết nối worker và kiểm tra rào cản dữ liệu...',
    };
  }, [isBotRunning, displayLogs, elapsedSeconds, klgdStatus]);

  // Discrepancy Trades
  const mismatchedTrades = summaryData?.klgd?.mismatchedTrades || [];
  const mismatchedTTM = summaryData?.klgd?.mismatchedTTM || [];

  // Negative Margin Accounts
  const negativeMarginAccounts: string[] = summaryData?.negativeMargin?.negativeIMRAcc || [];

  // Trạng thái đã thực thi phiên kiểm tra cho từng khối con (tránh hiển thị kết quả giả định / kết quả cũ)
  const hasExecutedMargin = !!(summaryData?.negativeMargin?.executedAt && summaryData?.negativeMargin?.status !== 'IDLE');
  const eodData = summaryData?.eod || (summaryData?.dsgdBeforeEod?.jobType === 'CHECK_EOD_MS' ? summaryData?.dsgdBeforeEod : null);
  const hasExecutedEod = !!(eodData?.executedAt && eodData?.status !== 'IDLE');
  const hasExecutedCqgSync = !!(summaryData?.cqgSync?.executedAt && summaryData?.cqgSync?.status !== 'IDLE');

  const formatSubCheckTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const vn = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const hh = String(vn.getHours()).padStart(2, '0');
      const mm = String(vn.getMinutes()).padStart(2, '0');
      const ss = String(vn.getSeconds()).padStart(2, '0');
      const dd = String(vn.getDate()).padStart(2, '0');
      const mo = String(vn.getMonth() + 1).padStart(2, '0');
      return `${hh}:${mm}:${ss} ${dd}/${mo}`;
    } catch {
      return '';
    }
  };

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

  // Tự động kích hoạt Modal khi lần quét mới nhất gặp sự cố và chưa bị người dùng đóng
  useEffect(() => {
    if (
      !isBotRunning &&
      (klgdStatus === 'FAILED' || klgdStatus === 'ABORTED') &&
      !failedJobPrompt &&
      !hasDismissedPromptRef.current &&
      summaryData?.klgd?.jobId &&
      !selectedRunJobId
    ) {
      setFailedJobPrompt({
        jobId: summaryData.klgd.jobId,
        error: klgdError || 'Lần quét mới nhất bị gián đoạn.',
        jobType: 'CHECK_KLGD',
      });
    }
  }, [isBotRunning, klgdStatus, failedJobPrompt, summaryData?.klgd?.jobId, selectedRunJobId, klgdError]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* TRẠNG THÁI CHỜ FILE DỮ LIỆU HOẶC TIẾN TRÌNH CHẠY CỦA BOT */}
            {isWaitingFiles ? (
              <div
                className="glass-panel"
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  borderLeft: '4px solid #f59e0b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Clock size={16} color="#d97706" />
                  <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
                    Chờ dữ liệu:
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {waitingMessage || 'Một số file dữ liệu từ M-System hoặc CQG chưa sẵn sàng để đối chiếu.'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {klgdLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLogModal(true)}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Terminal size={12} />
                      <span>Log</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_KLGD', 'TABLE1')}
                    disabled={triggering}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <RefreshCw size={12} className={triggering ? 'animate-spin' : ''} />
                    <span>{triggering ? 'Đang tải lại...' : 'Tải lại & Đối chiếu'}</span>
                  </button>
                </div>
              </div>
            ) : isBotRunning ? (
              <div
                style={{
                  background: 'var(--bg-card, #ffffff)',
                  border: '1px solid rgba(59, 130, 246, 0.28)',
                  borderRadius: '10px',
                  padding: '9px 16px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '7px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Hàng nội dung chính: Spinner + Tên bước + Badge % + Trích xuất Log + Nút hành động */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.12)',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Loader2 size={15} className="animate-spin" />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {botProgressInfo.stage}
                      </span>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          color: '#2563eb',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          padding: '1px 7px',
                          borderRadius: '10px',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {botProgressInfo.percent}%
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '460px',
                        }}
                        title={botProgressInfo.detail}
                      >
                        — {botProgressInfo.detail}
                      </span>
                    </div>
                  </div>

                  {/* Cụm nút thao tác bên phải: Đồng hồ bấm giờ + Nút Log + Nút Stop */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.04))',
                        color: 'var(--text-secondary)',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                      title="Thời gian thực thi của lượt đối soát này"
                    >
                      <Clock size={12} className="animate-pulse" style={{ color: '#0ea5e9' }} />
                      <span>{formatElapsed(elapsedSeconds)}</span>
                    </div>

                    {(displayLogs.length > 0 || klgdLogs.length > 0) && (
                      <button
                        type="button"
                        onClick={() => setShowLogModal(true)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                        }}
                      >
                        <Terminal size={13} />
                        <span>Log</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleEmergencyStopBot}
                      disabled={cancellingBot}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(220, 38, 38, 0.3)',
                        backgroundColor: 'rgba(220, 38, 38, 0.06)',
                        color: '#dc2626',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: cancellingBot ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Dừng khẩn cấp tiến trình đối soát của Bot"
                    >
                      <Square size={11} fill={cancellingBot ? 'none' : '#dc2626'} className={cancellingBot ? 'animate-pulse' : ''} />
                      <span>{cancellingBot ? 'Đang dừng...' : 'Stop'}</span>
                    </button>
                  </div>
                </div>

                {/* Hàng dưới: Thanh Progress Bar mượt mà */}
                <div
                  style={{
                    width: '100%',
                    height: '4px',
                    backgroundColor: 'rgba(226, 232, 240, 0.7)',
                    borderRadius: '999px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${botProgressInfo.percent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
                      borderRadius: '999px',
                      transition: 'width 0.4s ease-out',
                    }}
                  />
                </div>
              </div>
            ) : null}

          {(viewMode === 'ALL' || viewMode === 'KLGD_ONLY') && (
            <>
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
                  <span>Check định kỳ:</span>
                </button>

                <select
                  value={intervalMinutes}
                  onChange={(e) => {
                    const num = Number(e.target.value);
                    setIntervalMinutes(num);
                    debouncedSaveSetting('bot_periodic_check_frequency', String(num));
                  }}
                  className="form-select"
                  style={{
                    height: '38px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    padding: '0 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <option value={60}>60 phút (Tiêu chuẩn)</option>
                  <option value={30}>30 phút (Cao điểm)</option>
                  <option value={15}>15 phút (Biến động mạnh)</option>
                </select>

                {checkPeriodic && autoReconActive && (
                  countdownSeconds > 0 ? (
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
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                      }}>
                        KLGD
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: klgdMsCqgColor }}>
                      {fmt(msDSGD)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: klgdMsCqgColor }}>
                      {fmt(cqgFR)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: acmNanoCcpKlgdColor }}>
                      {fmt(acmStraits)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: acmNanoCcpKlgdColor }}>
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
                    <td style={{ padding: '16px 20px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: acmNanoCcpKlgdColor }}>
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
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: ttmMsCqgColor }}>
                      {fmt(msTTM)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: ttmMsCqgColor }}>
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
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: ttttMsCqgColor }}>
                      {fmt(msTTTT)}
                    </td>
                    <td style={{ padding: '16px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'center', fontFamily: 'monospace', fontWeight: 800, fontSize: '1.25rem', color: ttttMsCqgColor }}>
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
                className="btn btn-primary"
                style={{
                  height: '42px',
                  padding: '10px 24px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px 0 rgba(59, 130, 246, 0.4)',
                }}
              >
                <Play size={15} className={triggering && triggeringSection === 'manual' ? 'animate-spin' : ''} />
                <span>{triggering && triggeringSection === 'manual' ? 'Đang chạy...' : 'Check thủ công'}</span>
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
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
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
                          <td colSpan={6} style={{ padding: '24px 20px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '16px 32px',
                              borderRadius: '14px',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}>
                              <CheckCircle size={28} color="#10b981" />
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
                          <td colSpan={4} style={{ padding: '24px 20px', textAlign: 'center' }}>
                            <div style={{
                              display: 'inline-flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '16px 32px',
                              borderRadius: '14px',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                            }}>
                              <CheckCircle size={28} color="#10b981" />
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
            </>
          )}

          {/* THANH ĐIỀU KHIỂN RIÊNG CHO MÀN HÌNH EOD_ONLY */}
          {viewMode === 'EOD_ONLY' && (
            <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={18} color="#10b981" />
                <span style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Phiên đối soát EOD MS & CQG:
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                  style={{ width: '150px', height: '36px', fontSize: '0.84rem', fontFamily: 'monospace', fontWeight: 700 }}
                />
                <button
                  type="button"
                  onClick={() => setSelectedDate(getInitialTradingSessionDate())}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                >
                  Hôm nay
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => fetchConsoleSummary(selectedDate)}
                  disabled={loading}
                  className="btn btn-primary"
                  style={{ fontSize: '0.82rem', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  <span>Làm mới dữ liệu EOD</span>
                </button>
              </div>
            </div>
          )}

          {(viewMode === 'ALL' || viewMode === 'EOD_ONLY') && (
            <>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Tài khoản âm ký quỹ mới (EOD)
                    </h5>
                    {hasExecutedMargin && summaryData?.negativeMargin?.executedAt && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({formatSubCheckTime(summaryData.negativeMargin.executedAt)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_EOD_MS', 'dsgd')}
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
                        <th style={{ padding: '10px 16px' }}>TKGD âm KQ mới ({hasExecutedMargin ? negativeMarginAccounts.length : 0})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!hasExecutedMargin ? (
                        <tr>
                          <td style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Clock size={24} color="var(--text-muted)" />
                              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Chưa chạy kiểm tra tài khoản âm ký quỹ phiên này. Bấm “Check” để quét.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : summaryData?.negativeMargin?.isWaitingFiles ? (
                        <tr>
                          <td style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Clock size={24} color="#f59e0b" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
                                {summaryData?.negativeMargin?.waitingMessage || 'Đang chờ file dữ liệu đối chiếu...'}
                              </span>
                              {summaryData?.negativeMargin?.executedAt && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Kiểm tra lúc: {formatSubCheckTime(summaryData.negativeMargin.executedAt)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : summaryData?.negativeMargin?.status === 'FAILED' ? (
                        <tr>
                          <td style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <AlertTriangle size={24} color="#ef4444" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>
                                Lỗi kiểm tra ký quỹ: {summaryData?.negativeMargin?.error || 'Vui lòng kiểm tra log bot.'}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : negativeMarginAccounts.length > 0 ? (
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
                          <td style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <ShieldCheck size={28} color="#10b981" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                                An Toàn: Không có tài khoản âm ký quỹ mới
                              </span>
                              {summaryData?.negativeMargin?.executedAt && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Kiểm tra lúc: {formatSubCheckTime(summaryData.negativeMargin.executedAt)}
                                </span>
                              )}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Kết quả chạy EOD
                    </h5>
                    {hasExecutedEod && eodData?.executedAt && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        ({formatSubCheckTime(eodData.executedAt)})
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTriggerRun('CHECK_EOD_MS', 'eod')}
                    disabled={triggering}
                    className="btn btn-secondary"
                    title="Chạy đối chiếu EOD (Tự động tải file EOD từ mail Outlook nếu chưa có trong thư mục Backup MS)"
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
                      {!hasExecutedEod ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Clock size={24} color="var(--text-muted)" />
                              <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Chưa chạy đối chiếu EOD phiên này. Bấm “Check” để bắt đầu đối soát.
                              </span>
                            </div>
                          </td>
                        </tr>
                      ) : eodData?.isWaitingFiles ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <Clock size={24} color="#f59e0b" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>
                                {eodData.waitingMessage || 'Đang chờ file dữ liệu đối chiếu EOD...'}
                              </span>
                              {eodData.executedAt && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Kiểm tra lúc: {formatSubCheckTime(eodData.executedAt)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : eodData?.status === 'FAILED' ? (
                        <tr>
                          <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <AlertTriangle size={24} color="#ef4444" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>
                                Lỗi đối chiếu EOD: {eodData.error || 'Vui lòng kiểm tra log bot.'}
                              </span>
                              {eodData.executedAt && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Kiểm tra lúc: {formatSubCheckTime(eodData.executedAt)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (eodData?.mismatchedEOD && eodData.mismatchedEOD.length > 0) ? (
                        eodData.mismatchedEOD.map((p: any, idx: number) => (
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
                            <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>{fmt(p.calculatedBalance ?? 0)}</td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>{fmt(p.eodBalance ?? 0)} {p.differ !== undefined ? `(Lệch: ${fmt(p.differ)})` : ''}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle size={28} color="#10b981" />
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                                Tất cả số dư tài khoản khớp hoàn toàn với kết quả chạy EOD (MS & CCP)
                              </span>
                              {eodData?.executedAt && (
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                  Kiểm tra lúc: {formatSubCheckTime(eodData.executedAt)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ĐỐI CHIẾU GIÁ THANH TOÁN (GTT M-SYSTEM VS CQG) - CHUYỂN TỪ TAB 3 VỀ TAB 2 */}
            <div style={{ marginTop: '16px' }}>
              <LegacyGttCheckerSection token={token} selectedDate={selectedDate} />
            </div>
            </>
          )}
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

      <TradingManagerLogModal
        isOpen={dsgdBeforeEodLogModalOpen}
        onClose={() => setDsgdBeforeEodLogModalOpen(false)}
        jobId={summaryData?.dsgdBeforeEod?.jobId}
        status={summaryData?.dsgdBeforeEod?.status || 'COMPLETED'}
        logs={summaryData?.dsgdBeforeEod?.logs || []}
        onRetry={() => {
          setDsgdBeforeEodLogModalOpen(false);
          handleTriggerRun('CHECK_DSGD_BEFORE_EOD', 'dsgd-before-eod-diff');
        }}
        isRetrying={triggering}
      />

      {/* MODAL BÁO LỖI TINH GỌN (CLEAN UI / UX CHUẨN CCP) */}
      {failedJobPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#ef4444" />
                <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Tiến trình đối chiếu bị gián đoạn
                </span>
              </div>
              <button
                type="button"
                onClick={handleDismissFromPrompt}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Lần quét đối chiếu vừa qua gặp sự cố hoặc gián đoạn kết nối. Bạn có thể chọn <strong>Chạy lại ngay</strong> hoặc <strong>Đóng</strong> để tự động lùi về kết quả thành công gần nhất.
              </p>
              {failedJobPrompt.error && (
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-input, rgba(0, 0, 0, 0.03))',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontFamily: 'monospace',
                    maxHeight: '80px',
                    overflowY: 'auto',
                    wordBreak: 'break-word',
                  }}
                >
                  {failedJobPrompt.error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '12px 18px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-secondary, rgba(0, 0, 0, 0.02))',
                gap: '8px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowLogModal(true);
                }}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Terminal size={13} />
                <span>Xem Log</span>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleDismissFromPrompt}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 600 }}
                >
                  Đóng & Về lần gần nhất
                </button>
                <button
                  type="button"
                  onClick={handleRetryFromPrompt}
                  className="btn btn-primary"
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <RefreshCw size={13} />
                  <span>Chạy lại</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
