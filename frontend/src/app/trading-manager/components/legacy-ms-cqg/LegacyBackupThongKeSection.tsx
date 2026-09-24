'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Download,
  Play,
  Server,
  Clock,
  Sliders,
  Loader2,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { API_BASE_URL } from '@/context/AuthContext';
import LegacyGttCheckerSection from './LegacyGttCheckerSection';
import BackupLogSummaryModal from './BackupLogSummaryModal';

// Danh sách 25 báo cáo VNCLEAR / CoreCCP theo chuẩn Ground Truth Maker
export const CORE_CCP_REPORTS_LIST: Array<{
  key: string;
  name: string;
  filename: string;
  group: 'ORDERS' | 'MM' | 'POSITION' | 'RISK' | 'CASH' | 'PRODUCT';
  groupLabel: string;
  phase: 1 | 2; // 1: Trước 16h20, 2: EOD cuối ngày
}> = [
  // 1. Sổ lệnh thường (5 file)
  { key: 'DSL', name: 'DSL CCP', filename: 'DSL CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLDK', name: 'DSLDK CCP', filename: 'DSLDK CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLCK', name: 'DSLCK CCP', filename: 'DSLCK CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSLDH', name: 'DSLDH CCP', filename: 'DSLDH CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },
  { key: 'DSGD', name: 'DSGD CCP', filename: 'DSGD CCP.xlsx', group: 'ORDERS', groupLabel: 'Sổ lệnh thường', phase: 2 },

  // 2. Sổ lệnh MM (5 file)
  { key: 'DSL_MM', name: 'DSL MM CCP', filename: 'DSL MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2 },
  { key: 'DSLDK_MM', name: 'DSLDK MM CCP', filename: 'DSLDK MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2 },
  { key: 'DSLCK_MM', name: 'DSLCK MM CCP', filename: 'DSLCK MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2 },
  { key: 'DSLDH_MM', name: 'DSLDH MM CCP', filename: 'DSLDH MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2 },
  { key: 'DSGD_MM', name: 'DSGD MM CCP', filename: 'DSGD MM CCP.xlsx', group: 'MM', groupLabel: 'Sổ lệnh MM', phase: 2 },

  // 3. Vị thế & Lãi lỗ (3 file)
  { key: 'TTM_PRE1620', name: 'TTM trước 4h20', filename: 'TTM truoc 4h20.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 1 },
  { key: 'TTM', name: 'TTM CCP', filename: 'TTM CCP.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 2 },
  { key: 'TTTT', name: 'TTTT', filename: 'TTTT.xlsx', group: 'POSITION', groupLabel: 'Vị thế & Lãi lỗ', phase: 2 },

  // 4. Rủi ro & Ký quỹ (6 file)
  { key: 'QLTTTKGD_PRE1620', name: 'QL TT TKGD trước 4h20', filename: 'QL TT TKGD truoc 4h20.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 1 },
  { key: 'QLTTTKGD', name: 'QL TT TKGD', filename: 'QL TT TKGD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'EOD', name: 'Kết quả EOD', filename: 'EOD.csv', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'QLTTTVKD', name: 'QL TT TVKD', filename: 'QL TT TVKD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'DSQLKQ_TKGD', name: 'DSQLKQ TKGD', filename: 'DSQLKQ TKGD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },
  { key: 'DSQLKQ_TVKD', name: 'DSQLKQ TVKD', filename: 'DSQLKQ TVKD.xlsx', group: 'RISK', groupLabel: 'Rủi ro & Ký quỹ', phase: 2 },

  // 5. Nộp rút tiền & Tài khoản (2 file)
  { key: 'NR', name: 'NR', filename: 'NR.xlsx', group: 'CASH', groupLabel: 'Nộp rút & TK', phase: 2 },
  { key: 'DSTKGD', name: 'DSTKGD ACM', filename: 'DSTKGD ACM.xlsx', group: 'CASH', groupLabel: 'Nộp rút & TK', phase: 2 },

  // 6. Hàng hóa & Hợp đồng (3 mục)
  { key: 'HH', name: 'HH', filename: 'HH.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
  { key: 'HD', name: 'Hợp đồng hàng hóa', filename: 'HĐ *.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
  { key: 'GTT', name: 'GTT CCP', filename: 'GTT CCP.xlsx', group: 'PRODUCT', groupLabel: 'Hàng hóa & Giá', phase: 2 },
];

export interface LegacyBackupThongKeSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function LegacyBackupThongKeSection({
  token,
  selectedDate,
  onSelectDate,
}: LegacyBackupThongKeSectionProps) {
  // Checkbox settings
  const [backupPeriodic, setBackupPeriodic] = useState<boolean>(true);
  const [backupPeriodicMinutes, setBackupPeriodicMinutes] = useState<number>(60);
  const [enableBackupTime, setEnableBackupTime] = useState<boolean>(true);
  const [backupTime, setBackupTime] = useState<string>('06:00');
  const [enableStatTime, setEnableStatTime] = useState<boolean>(true);
  const [statTime, setStatTime] = useState<string>('06:30');

  // Master Switch: Tự động tải backup & thống kê (bot_auto_backup_enabled)
  const [autoBackupActive, setAutoBackupActive] = useState<boolean>(true);
  const [updatingAutoBackup, setUpdatingAutoBackup] = useState<boolean>(false);

  // Helper lưu cài đặt vào CSDL MongoDB system_settings
  const saveSetting = useCallback(async (key: string, value: string) => {
    if (!token) return;
    try {
      await fetch(`${API_BASE_URL}/api/v1/system-settings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key, value }),
      });
    } catch (err: any) {
      console.error(`[SystemSettings] Lỗi lưu cấu hình ${key}:`, err.message);
    }
  }, [token]);

  // Debounce timer ref
  const debounceTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const debouncedSaveSetting = useCallback((key: string, value: string, delay = 600) => {
    if (debounceTimerRef.current[key]) {
      clearTimeout(debounceTimerRef.current[key]);
    }
    debounceTimerRef.current[key] = setTimeout(() => {
      saveSetting(key, value);
    }, delay);
  }, [saveSetting]);

  // Load toàn bộ cấu hình vận hành từ CSDL khi mở trang
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/system-settings`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((settingsList: Array<{ key: string; value: string }>) => {
        if (!Array.isArray(settingsList)) return;
        const map: Record<string, string> = {};
        settingsList.forEach((s) => {
          if (s?.key) map[s.key] = s.value;
        });

        if (map.bot_auto_backup_enabled !== undefined) {
          setAutoBackupActive(map.bot_auto_backup_enabled !== 'false');
        }
        if (map.bot_backup_periodic_enabled !== undefined) {
          setBackupPeriodic(map.bot_backup_periodic_enabled !== 'false');
        }
        if (map.bot_backup_periodic_minutes !== undefined) {
          const m = parseInt(map.bot_backup_periodic_minutes, 10);
          if (!isNaN(m) && m > 0) setBackupPeriodicMinutes(m);
        }
        if (map.bot_backup_time_enabled !== undefined) {
          setEnableBackupTime(map.bot_backup_time_enabled !== 'false');
        }
        if (map.bot_backup_time !== undefined && /^\d{2}:\d{2}$/.test(map.bot_backup_time)) {
          setBackupTime(map.bot_backup_time);
        }
        if (map.bot_stat_time_enabled !== undefined) {
          setEnableStatTime(map.bot_stat_time_enabled !== 'false');
        }
        if (map.bot_stat_time !== undefined && /^\d{2}:\d{2}$/.test(map.bot_stat_time)) {
          setStatTime(map.stat_time || map.bot_stat_time);
        }
      })
      .catch(() => {});
  }, [token]);

  // Toggle bot_auto_backup_enabled
  const handleToggleAutoBackup = async () => {
    if (!token || updatingAutoBackup) return;
    const nextVal = !autoBackupActive;
    setUpdatingAutoBackup(true);
    try {
      await saveSetting('bot_auto_backup_enabled', nextVal ? 'true' : 'false');
      setAutoBackupActive(nextVal);
      if (nextVal) {
        toast.success('Đã kích hoạt tự động tải backup & thống kê!');
      } else {
        toast('Đã tạm dừng tự động tải backup & thống kê', { icon: '⏸️' });
      }
    } catch (err: any) {
      toast.error('Lỗi khi cập nhật trạng thái: ' + err.message);
    } finally {
      setUpdatingAutoBackup(false);
    }
  };

  // MS Reports (20 checkboxes)
  const [msReports, setMsReports] = useState<Record<string, boolean>>({
    NKTTHT: true,
    'DSTKGD-Futures': true,
    'DSTKGD-Spread': true,
    'DSTKGD-LME': true,
    'DSTKGD-ACM': true,
    TLQHSKQ: true,
    NR: true,
    DSTrader: true,
    'market truoc 6h': true,
    DSLDK: true,
    DSLCK: true,
    DSLH: true,
    DSLK: true,
    DSGD: true,
    TTM: true,
    TTTT: true,
    TTCDH: true,
    DSQLKQ: true,
    QLTKGD: true,
    'QLTKGD âm KQ': true,
  });

  // CQG Reports (9 checkboxes)
  const [cqgReports, setCqgReports] = useState<Record<string, boolean>>({
    FR1: true,
    FR2: true,
    PS1: true,
    PS2: true,
    OP1: true,
    OP2: true,
    OD1: true,
    OD2: true,
    AS: true,
  });



  // CoreCCP Reports (25 checkboxes)
  const [ccpReports, setCcpReports] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, true]))
  );
  const [downloadingCcp, setDownloadingCcp] = useState<boolean>(false);
  const [auditingCcp, setAuditingCcp] = useState<boolean>(false);
  const [auditCcpResult, setAuditCcpResult] = useState<any>(null);

  // Execution states
  const [auditingMs, setAuditingMs] = useState<boolean>(false);
  const [auditingCqg, setAuditingCqg] = useState<boolean>(false);
  const [auditMsResult, setAuditMsResult] = useState<any>(null);
  const [auditCqgResult, setAuditCqgResult] = useState<any>(null);



  // IMR State
  const [imrLoading, setImrLoading] = useState<boolean>(false);
  const [imrResult, setImrResult] = useState<{
    g1: string[];
    g2: string[];
    g3: string[];
    g4: string[];
  } | null>(null);

  // Macro State
  const [lotMacroLoading, setLotMacroLoading] = useState<boolean>(false);
  const [valueMacroLoading, setValueMacroLoading] = useState<boolean>(false);
  const [downloadingMs, setDownloadingMs] = useState<boolean>(false);
  const [downloadingCqg, setDownloadingCqg] = useState<boolean>(false);

  // Modal xem nhanh nhật ký tóm tắt Backup MS / CQG
  const [showBackupModal, setShowBackupModal] = useState<boolean>(false);
  const [modalJobType, setModalJobType] = useState<'MS' | 'CQG'>('MS');
  const [lastMsJobId, setLastMsJobId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tm_last_ms_backup_job_id');
    }
    return null;
  });
  const [lastCqgJobId, setLastCqgJobId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tm_last_cqg_backup_job_id');
    }
    return null;
  });

  // Tự động load jobId gần nhất từ CSDL nếu state chưa có
  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=RPA_DOWNLOAD_REPORTS&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data[0]?._id) {
          setLastMsJobId((prev) => prev || data[0]._id);
        }
      })
      .catch(() => {});

    fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=CHECK_CQG_SYNC&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data[0]?._id) {
          setLastCqgJobId((prev) => prev || data[0]._id);
        }
      })
      .catch(() => {});
  }, [token]);

  // Trigger real Playwright RPA download for selected MS reports
  const handleDownloadMsBackup = async () => {
    if (!token || downloadingMs) return;
    const selected = Object.keys(msReports).filter((k) => msReports[k]);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo MS để tải!');
      return;
    }

    setDownloadingMs(true);
    const toastId = toast.loading(`Đang khởi động bot tải ${selected.length} báo cáo MS...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets: selected, sessionDay: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobId = data.jobId;

      if (!jobId) {
        toast.success(data.message || 'Đã đưa yêu cầu tải báo cáo vào hàng đợi!', { id: toastId });
        await handleAuditMsBackup();
        return;
      }

      setLastMsJobId(jobId);
      if (typeof window !== 'undefined') localStorage.setItem('tm_last_ms_backup_job_id', jobId);

      toast.loading(`Bot đang đăng nhập M-System và tải ${selected.length} báo cáo...`, { id: toastId });
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
            toast.success(`Đã tải xong ${selected.length} báo cáo MS về thư mục Backup!`, { id: toastId, duration: 5000 });
            await handleAuditMsBackup();
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Tải báo cáo MS kết thúc (${job.status}): ${job.error || ''}`, { id: toastId, duration: 6000 });
            await handleAuditMsBackup();
            return;
          }
        } catch { /* poll error */ }
      }
      toast.success('Tác vụ tải MS đang tiếp tục chạy ngầm trên server.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi tải MS: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingMs(false);
    }
  };

  // Trigger CQG sync & download
  const handleDownloadCqgBackup = async () => {
    if (!token || downloadingCqg) return;
    setDownloadingCqg(true);
    const toastId = toast.loading('Đang khởi động bot đồng bộ & tải báo cáo CQG...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, jobType: 'CHECK_CQG_SYNC' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobId = data.jobId;

      if (!jobId) {
        toast.success(data.message || 'Đã kích hoạt đồng bộ CQG!', { id: toastId });
        await handleAuditCqgBackup();
        return;
      }

      setLastCqgJobId(jobId);
      if (typeof window !== 'undefined') localStorage.setItem('tm_last_cqg_backup_job_id', jobId);

      toast.loading('Bot đang tải và ghép file báo cáo CQG...', { id: toastId });
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
            toast.success('Đã tải & đồng bộ toàn bộ file CQG về thư mục Backup!', { id: toastId, duration: 5000 });
            await handleAuditCqgBackup();
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Tải CQG kết thúc (${job.status}): ${job.error || ''}`, { id: toastId, duration: 6000 });
            await handleAuditCqgBackup();
            return;
          }
        } catch { /* poll error */ }
      }
      toast.success('Tác vụ tải CQG đang tiếp tục chạy ngầm.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi tải CQG: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingCqg(false);
    }
  };

  // Audit MS Backup
  const handleAuditMsBackup = async () => {
    if (!token || auditingMs) return;
    setAuditingMs(true);
    const toastId = toast.loading('Đang kiểm tra thư mục Backup M-System...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ms-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditMsResult(data);
      toast.success('Kiểm tra thư mục Backup M-System hoàn tất!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra MS: ${err.message}`, { id: toastId });
    } finally {
      setAuditingMs(false);
    }
  };

  // Audit CQG Backup
  const handleAuditCqgBackup = async () => {
    if (!token || auditingCqg) return;
    setAuditingCqg(true);
    const toastId = toast.loading('Đang kiểm tra và đồng bộ thư mục Backup CQG...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-cqg-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditCqgResult(data);
      toast.success('Kiểm tra thư mục Backup CQG hoàn tất!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra CQG: ${err.message}`, { id: toastId });
    } finally {
      setAuditingCqg(false);
    }
  };

  // Trigger Playwright RPA download for selected CoreCCP reports
  const handleDownloadCcpBackup = async (overrideReports?: string[]) => {
    if (!token || downloadingCcp) return;
    const selected = overrideReports || Object.keys(ccpReports).filter((k) => ccpReports[k]);
    if (selected.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 báo cáo CoreCCP để tải!');
      return;
    }

    setDownloadingCcp(true);
    const toastId = toast.loading(`Đang khởi động Robot tải ${selected.length} báo cáo CoreCCP...`);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-ccp-download`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          reports: selected,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const jobId = data.jobId;

      if (!jobId) {
        toast.success(data.message || 'Đã kích hoạt tải CoreCCP!', { id: toastId });
        await handleAuditCcpBackup();
        return;
      }

      toast.loading('Robot Playwright đang tải báo cáo CoreCCP VNCLEAR...', { id: toastId });
      const startTime = Date.now();
      const MAX_WAIT_MS = 300000;
      const POLL_INTERVAL_MS = 3000;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          if (job.status === 'COMPLETED') {
            toast.success('Đã tải xong toàn bộ báo cáo CoreCCP về thư mục Backup!', { id: toastId, duration: 5000 });
            await handleAuditCcpBackup();
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Tải CoreCCP kết thúc (${job.status}): ${job.error || ''}`, { id: toastId, duration: 6000 });
            await handleAuditCcpBackup();
            return;
          }
        } catch { /* poll error */ }
      }
      toast.success('Tác vụ tải CoreCCP đang tiếp tục chạy ngầm.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi tải CoreCCP: ${err.message}`, { id: toastId });
    } finally {
      setDownloadingCcp(false);
    }
  };

  // Audit CoreCCP Backup
  const handleAuditCcpBackup = async () => {
    if (!token || auditingCcp) return;
    setAuditingCcp(true);
    const toastId = toast.loading('Đang kiểm tra thư mục Backup CoreCCP...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ccp-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAuditCcpResult(data);
      toast.success('Kiểm tra thư mục Backup CoreCCP hoàn tất!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra CoreCCP: ${err.message}`, { id: toastId });
    } finally {
      setAuditingCcp(false);
    }
  };



  // Restore IMR result from localStorage on date change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`mxv_imr_result_${selectedDate}`);
        if (saved) {
          setImrResult(JSON.parse(saved));
        } else {
          setImrResult(null);
        }
      } catch {
        setImrResult(null);
      }
    }
  }, [selectedDate]);

  // Check IMR Negative Margin
  const handleCheckIMR = async () => {
    if (!token || imrLoading) return;
    setImrLoading(true);
    const toastId = toast.loading('Đang phân tích dữ liệu ký quỹ (QLTKGD, TTM, DSLCK)...');
    try {
      // 1. Thử gọi trực tiếp endpoint check-imr đồng bộ cực nhanh
      const fastRes = await fetch(`${API_BASE_URL}/api/v1/reconciliation/check-imr`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionDate: selectedDate }),
      });
      if (fastRes.ok) {
        const fastData = await fastRes.json();
        if (fastData && fastData.success) {
          const resObj = {
            g1: fastData.results?.group1 || [],
            g2: fastData.results?.group2 || [],
            g3: fastData.results?.group3 || [],
            g4: fastData.results?.group4 || [],
          };
          setImrResult(resObj);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`mxv_imr_result_${selectedDate}`, JSON.stringify(resObj));
          }
          toast.success(
            `Quét ký quỹ hoàn tất! G1: ${resObj.g1.length}, G2: ${resObj.g2.length}, G3: ${resObj.g3.length}, G4: ${resObj.g4.length}`,
            { id: toastId, duration: 5000 }
          );
          return;
        } else if (fastData && fastData.filesFound && !fastData.filesFound.qltkgd) {
          toast.error(`Không tìm thấy file QLTKGD.xlsx trong thư mục backup ngày ${selectedDate}! Vui lòng tải báo cáo MS trước.`, { id: toastId, duration: 6000 });
          return;
        }
      }

      // 2. Fallback: Kích hoạt background bot job
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, bypassCooldown: true, jobType: 'SCAN_NEGATIVE_MARGIN' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result = await res.json();
      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kích hoạt quét ký quỹ!', { id: toastId });
        return;
      }

      toast.loading('Bot đang phân tích file QLTKGD & TTM M-System...', { id: toastId });
      const start = Date.now();
      while (Date.now() - start < 120000) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const jr = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jr.ok) continue;
          const job = await jr.json();
          if (job.status === 'COMPLETED') {
            const r = job.payload?.result || job;
            const resObj = {
              g1: r.imrGroup1 || r.laiLoCoTTM || [],
              g2: r.imrGroup2 || r.kyQuyKhongTTM || [],
              g3: r.imrGroup3 || r.kqycttNeKqyc || [],
              g4: r.imrGroup4 || r.kqkdttNeKqkd || [],
            };
            setImrResult(resObj);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`mxv_imr_result_${selectedDate}`, JSON.stringify(resObj));
            }
            toast.success('Quét ký quỹ hoàn tất!', { id: toastId, duration: 5000 });
            return;
          }
          if (job.status === 'FAILED' || job.status === 'CANCELLED' || job.status === 'ABORTED') {
            toast.error(`Quét ký quỹ kết thúc (${job.status}): ${job.error || ''}`, { id: toastId, duration: 6000 });
            return;
          }
        } catch { /* poll error */ }
      }
      toast.success('Tác vụ đang chạy ngầm, sẽ hoàn thành sau.', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi quét ký quỹ: ${err.message}`, { id: toastId });
    } finally {
      setImrLoading(false);
    }
  };

  // Run Lot Macro
  const handleLotMacro = async () => {
    if (!token || lotMacroLoading) return;
    setLotMacroLoading(true);
    const toastId = toast.loading('Đang kích hoạt Excel Macro thống kê số lot...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-lot-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro số lot vào hàng đợi!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro số lot: ${err.message}`, { id: toastId });
    } finally {
      setLotMacroLoading(false);
    }
  };

  // Run Value Macro
  const handleValueMacro = async () => {
    if (!token || valueMacroLoading) return;
    setValueMacroLoading(true);
    const toastId = toast.loading('Đang kích hoạt Excel Macro thống kê giá trị giao dịch...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-value-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDate: selectedDate }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro giá trị vào hàng đợi!', { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro giá trị: ${err.message}`, { id: toastId });
    } finally {
      setValueMacroLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ===== HEADER BAR: NGÀY PHIÊN & THỜI ĐIỂM BACKUP ===== */}
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
              onChange={(e) => onSelectDate?.(e.target.value)}
              className="form-input"
              style={{ width: '150px', height: '34px', fontSize: '0.82rem', fontFamily: 'monospace', fontWeight: 700 }}
            />
            <button
              type="button"
              onClick={() => {
                const today = new Date();
                const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
                onSelectDate?.(vnTime.toISOString().split('T')[0]);
              }}
              className="btn btn-secondary"
              title="Đặt lại về phiên ngày hôm nay"
              style={{
                height: '34px',
                padding: '0 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              Hôm nay
            </button>
          </div>

          {/* Backup định kỳ (phút) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={backupPeriodic}
                onChange={(e) => {
                  const val = e.target.checked;
                  setBackupPeriodic(val);
                  saveSetting('bot_backup_periodic_enabled', val ? 'true' : 'false');
                }}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Backup định kỳ (phút)</span>
            </label>
            <input
              type="number"
              value={backupPeriodicMinutes}
              onChange={(e) => {
                const num = Number(e.target.value);
                setBackupPeriodicMinutes(num);
                debouncedSaveSetting('bot_backup_periodic_minutes', String(num));
              }}
              disabled={!backupPeriodic}
              className="form-input"
              style={{ width: '70px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center', fontWeight: 700 }}
            />
          </div>

          {/* Thời điểm backup */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={enableBackupTime}
                onChange={(e) => {
                  const val = e.target.checked;
                  setEnableBackupTime(val);
                  saveSetting('bot_backup_time_enabled', val ? 'true' : 'false');
                }}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Thời điểm backup</span>
            </label>
            <input
              type="time"
              value={backupTime}
              onChange={(e) => {
                const val = e.target.value;
                setBackupTime(val);
                debouncedSaveSetting('bot_backup_time', val);
              }}
              disabled={!enableBackupTime}
              className="form-input"
              style={{ width: '90px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
            />
          </div>

          {/* Thời điểm tạo thống kê */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              <input
                type="checkbox"
                checked={enableStatTime}
                onChange={(e) => {
                  const val = e.target.checked;
                  setEnableStatTime(val);
                  saveSetting('bot_stat_time_enabled', val ? 'true' : 'false');
                }}
                style={{ accentColor: '#10b981', width: '15px', height: '15px' }}
              />
              <span>Thời điểm tạo thống kê</span>
            </label>
            <input
              type="time"
              value={statTime}
              onChange={(e) => {
                const val = e.target.value;
                setStatTime(val);
                debouncedSaveSetting('bot_stat_time', val);
              }}
              disabled={!enableStatTime}
              className="form-input"
              style={{ width: '90px', height: '32px', fontSize: '0.82rem', fontFamily: 'monospace', textAlign: 'center' }}
            />
          </div>

          {/* Master Switch: Tự động Backup & Thống kê */}
          <div>
            <button
              type="button"
              onClick={handleToggleAutoBackup}
              disabled={updatingAutoBackup}
              className="btn"
              style={{
                height: '34px',
                padding: '0 14px',
                fontSize: '0.82rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                transition: 'all 0.2s',
                backgroundColor: autoBackupActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: autoBackupActive ? '#10b981' : '#ef4444',
                border: autoBackupActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                cursor: 'pointer',
              }}
              title={autoBackupActive ? 'Click để TẮT (DỪNG) tự động tải backup & thống kê' : 'Click để BẬT lại tự động tải backup & thống kê'}
            >
              {updatingAutoBackup ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: autoBackupActive ? '#10b981' : '#ef4444',
                    display: 'inline-block',
                  }}
                  className={autoBackupActive ? 'animate-pulse' : ''}
                />
              )}
              <span>{autoBackupActive ? 'Tự động Backup: BẬT' : 'Tự động Backup: ĐÃ DỪNG'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== SECTION 1: BACKUP MS, BACKUP CQG & BACKUP CORECCP (3 PHÂN HỆ) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          {/* CỘT 1: BACKUP MS (20 BÁO CÁO) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup MS</span>
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
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>20 báo cáo</span>
              </div>

              {/* 20 Checkboxes trong Grid 2 Cột */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 16px' }}>
                {Object.keys(msReports).map((reportKey) => (
                  <label key={reportKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!msReports[reportKey]}
                      onChange={() => setMsReports((prev) => ({ ...prev, [reportKey]: !prev[reportKey] }))}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{reportKey}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút Thao tác MS */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadMsBackup}
                  disabled={downloadingMs || auditingMs}
                  className="btn btn-primary"
                  style={{ flex: 1, maxWidth: '200px', fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {downloadingMs ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingMs ? 'Đang tải MS...' : 'Tải Báo Cáo Đã Chọn'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAuditMsBackup}
                  disabled={downloadingMs || auditingMs}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Kiểm tra trạng thái file trong thư mục backup"
                >
                  {auditingMs ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalJobType('MS');
                    setShowBackupModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Xem nhật ký tóm tắt tải báo cáo M-System"
                >
                  <FileText size={14} />
                  <span>Nhật ký</span>
                </button>
              </div>
              {auditMsResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditMsResult.summary ? `MS: ${auditMsResult.summary.ok}/${auditMsResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>

          {/* CỘT 2: BACKUP CQG (9 FILE) */}
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>Backup CQG</span>
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
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>9 file</span>
              </div>

              {/* 9 Checkboxes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px 12px' }}>
                {Object.keys(cqgReports).map((fileKey) => (
                  <label key={fileKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={!!cqgReports[fileKey]}
                      onChange={() => setCqgReports((prev) => ({ ...prev, [fileKey]: !prev[fileKey] }))}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.76rem' }}>{fileKey}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút Thao tác CQG */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadCqgBackup}
                  disabled={downloadingCqg || auditingCqg}
                  className="btn btn-primary"
                  style={{ flex: 1, maxWidth: '200px', fontSize: '0.82rem', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  {downloadingCqg ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingCqg ? 'Đang tải CQG...' : 'Tải Báo Cáo CQG'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAuditCqgBackup}
                  disabled={downloadingCqg || auditingCqg}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Kiểm tra trạng thái file trong thư mục backup"
                >
                  {auditingCqg ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalJobType('CQG');
                    setShowBackupModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Xem nhật ký tóm tắt đồng bộ CQG"
                >
                  <FileText size={14} />
                  <span>Nhật ký</span>
                </button>
              </div>
              {auditCqgResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: 'var(--text-secondary)', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditCqgResult.summary ? `CQG: ${auditCqgResult.summary.ok}/${auditCqgResult.summary.total} files OK` : 'Hoàn tất'}
                </div>
              )}
            </div>
          </div>

          {/* CỘT 3: BACKUP CORECCP (25 BÁO CÁO VNCLEAR MAKER) */}
          <div style={{ border: '1px solid rgba(16, 185, 129, 0.35)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: 'rgba(16, 185, 129, 0.02)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(16, 185, 129, 0.2)', paddingBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>Backup CoreCCP</span>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={Object.values(ccpReports).every(Boolean)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCcpReports(Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, checked])));
                      }}
                      style={{ accentColor: '#10b981', width: '13px', height: '13px' }}
                    />
                    <span>All</span>
                  </label>
                </div>

                {/* Nút lọc nhanh theo Đợt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, r.phase === 1]));
                      setCcpReports(next);
                    }}
                    style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', cursor: 'pointer', color: '#f59e0b', fontWeight: 700 }}
                    title="Chỉ chọn 2 file trước 16h20: QL TT TKGD truoc 4h20, TTM truoc 4h20"
                  >
                    Đợt 1 (16h20)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = Object.fromEntries(CORE_CCP_REPORTS_LIST.map((r) => [r.key, r.phase === 2]));
                      setCcpReports(next);
                    }}
                    style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', cursor: 'pointer', color: '#3b82f6', fontWeight: 700 }}
                    title="Chọn 23 file EOD cuối ngày"
                  >
                    Đợt 2 (EOD)
                  </button>
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>25 file</span>
                </div>
              </div>

              {/* 25 Checkboxes chia theo 2 Cột có nhóm */}
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px 8px', paddingRight: '4px' }}>
                {CORE_CCP_REPORTS_LIST.map((rep) => (
                  <label
                    key={rep.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                      fontSize: '0.74rem',
                      color: ccpReports[rep.key] ? 'var(--text-primary)' : 'var(--text-muted)',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      backgroundColor: ccpReports[rep.key] ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                    }}
                    title={`${rep.filename} (${rep.groupLabel})`}
                  >
                    <input
                      type="checkbox"
                      checked={!!ccpReports[rep.key]}
                      onChange={() => setCcpReports((prev) => ({ ...prev, [rep.key]: !prev[rep.key] }))}
                      style={{ accentColor: '#10b981', width: '12px', height: '12px' }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rep.name}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Nút Thao tác CoreCCP */}
            <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleDownloadCcpBackup()}
                  disabled={downloadingCcp || auditingCcp}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    maxWidth: '220px',
                    fontSize: '0.82rem',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                  }}
                >
                  {downloadingCcp ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  <span>{downloadingCcp ? 'Đang tải CoreCCP...' : 'Tải Báo Cáo CoreCCP'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleAuditCcpBackup}
                  disabled={downloadingCcp || auditingCcp}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  title="Kiểm tra trạng thái file CoreCCP trong thư mục backup ngày"
                >
                  {auditingCcp ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  <span>Kiểm tra</span>
                </button>
              </div>
              {auditCcpResult && (
                <div style={{ width: '100%', padding: '6px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)', fontSize: '0.74rem', color: '#10b981', fontFamily: 'monospace', textAlign: 'center' }}>
                  {auditCcpResult.summary ? `CoreCCP: ${auditCcpResult.summary.ok}/${auditCcpResult.summary.total} files OK` : 'Kiểm tra hoàn tất'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===== SECTION 2: GIÁ THANH TOÁN (GTT) ===== */}
      <LegacyGttCheckerSection token={token} selectedDate={selectedDate} />

      {/* ===== SECTION 3: KIỂM TRA KÝ QUỸ TKGD (4 BOXES C#) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Kiểm tra ký quỹ TKGD
          </span>
          <button
            type="button"
            onClick={handleCheckIMR}
            disabled={imrLoading}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '5px 16px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            {imrLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            <span>{imrLoading ? 'Đang check IMR...' : 'Check IMR'}</span>
          </button>
        </div>

        {/* 4 Boxes theo đúng layout C# FormMain */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            {
              key: 'g1',
              title: 'TK có lãi lỗ dự kiến nhưng không có TTM',
              color: '#f59e0b',
            },
            {
              key: 'g2',
              title: 'TK không có TTM nhưng có KQYC',
              color: '#ef4444',
            },
            {
              key: 'g3',
              title: 'TK có KQYCTT <> KQYC',
              color: '#8b5cf6',
            },
            {
              key: 'g4',
              title: 'TK có KQKDTT <> KQKD',
              color: '#3b82f6',
            },
          ].map(({ key, title, color }) => {
            const group = imrResult?.[key as keyof typeof imrResult] || [];
            return (
              <div
                key={key}
                style={{
                  border: `1px solid ${color}40`,
                  borderRadius: '6px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-input)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div style={{ fontSize: '0.74rem', fontWeight: 700, color, marginBottom: '6px', minHeight: '32px', lineHeight: 1.3, textAlign: 'center' }}>
                  {title}
                </div>
                <div
                  style={{
                    borderTop: `1px solid ${color}30`,
                    paddingTop: '6px',
                    minHeight: '60px',
                    maxHeight: '100px',
                    overflowY: 'auto',
                    fontSize: '0.76rem',
                    color: 'var(--text-primary)',
                    fontFamily: 'monospace',
                    lineHeight: 1.4,
                  }}
                >
                  {imrResult === null ? (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '12px' }}>— Chưa check —</div>
                  ) : group.length === 0 ? (
                    <div style={{ color: '#10b981', fontWeight: 700, textAlign: 'center', paddingTop: '12px' }}>Không có tài khoản</div>
                  ) : (
                    group.map((acc: string, i: number) => (
                      <div key={i} style={{ padding: '2px 0' }}>{acc}</div>
                    ))
                  )}
                </div>
                {group.length > 0 && (
                  <div style={{ marginTop: '6px', padding: '2px 6px', borderRadius: '4px', backgroundColor: `${color}20`, fontSize: '0.7rem', fontWeight: 800, color, textAlign: 'center' }}>
                    Phát hiện {group.length} tài khoản
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== SECTION 4: THỐNG KÊ (SỐ LOT & GIÁ TRỊ) ===== */}
      <div className="glass-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Thống kê
          </span>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleLotMacro}
            disabled={lotMacroLoading}
            className="btn btn-primary"
            style={{ minWidth: '180px', fontSize: '0.82rem', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {lotMacroLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            <span>{lotMacroLoading ? 'Đang chạy Macro...' : 'Thống kê số lot'}</span>
          </button>

          <button
            type="button"
            onClick={handleValueMacro}
            disabled={valueMacroLoading}
            className="btn btn-secondary"
            style={{ minWidth: '180px', fontSize: '0.82rem', padding: '9px 18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {valueMacroLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            <span>{valueMacroLoading ? 'Đang chạy Macro...' : 'Thống kê giá trị'}</span>
          </button>
        </div>
      </div>

      {/* ===== SECTION 5: SHORTCUT LINKS ===== */}
      <div className="glass-panel" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flexWrap: 'wrap' }}>
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

      {/* Modal Tóm Tắt Nhật Ký Tải Báo Cáo MS / CQG */}
      <BackupLogSummaryModal
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
        jobId={modalJobType === 'MS' ? lastMsJobId : lastCqgJobId}
        jobType={modalJobType}
        token={token}
        selectedDate={selectedDate}
      />
    </div>
  );
}
