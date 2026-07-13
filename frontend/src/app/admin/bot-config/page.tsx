'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Cpu,
  Key,
  Globe,
  RefreshCw,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Save,
  Server,
  Terminal,
  Activity,
  Upload,
  FileText,
  AlertTriangle,
  BarChart2,
  Download,
  Settings,
  Clock,
} from 'lucide-react';

interface BotConfig {
  url: string;
  username: string;
  password?: string;
  pin?: string;
}

interface BotJobs {
  _id: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CAPTCHA';
  attempts: number;
  maxAttempts: number;
  logs: string[];
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function AdminBotConfigPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Settings state
  const [msystemUrl, setMsystemUrl] = useState('https://msystem.mxv.vn/');
  const [msystemUsername, setMsystemUsername] = useState('');
  const [msystemPassword, setMsystemPassword] = useState('');
  const [msystemPin, setMsystemPin] = useState('');

  const [cqgUrl, setCqgUrl] = useState('https://m.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUsername, setCqgUsername] = useState('');
  const [cqgPassword, setCqgPassword] = useState('');

  const [acmUrl, setAcmUrl] = useState('https://acm.member-url.vn/login');
  const [acmUsername, setAcmUsername] = useState('');
  const [acmPassword, setAcmPassword] = useState('');
  const [acmGeminiApiKey, setAcmGeminiApiKey] = useState('');
  const [acmDownloadUrl, setAcmDownloadUrl] = useState('');
  const [acmDownloadBtnSelector, setAcmDownloadBtnSelector] = useState('');
  const [acmSftpHost, setAcmSftpHost] = useState('sftp.mxv.com.vn');
  const [acmSftpPort, setAcmSftpPort] = useState('2231');
  const [acmSftpUsername, setAcmSftpUsername] = useState('');
  const [acmSftpPassword, setAcmSftpPassword] = useState('');
  const [acmSftpRemoteDir, setAcmSftpRemoteDir] = useState('/data/');
  const [showAcmSftpPassword, setShowAcmSftpPassword] = useState(false);

  // CQG CAST credentials
  const [castUrl, setCastUrl] = useState('https://www.cqgtrader.com/CAST/Logon/Logon.asp');
  const [castUsername, setCastUsername] = useState('');
  const [castPassword, setCastPassword] = useState('');
  const [showCastPassword, setShowCastPassword] = useState(false);

  // CPP credentials
  const [cppUrl, setCppUrl] = useState('');
  const [cppUsername, setCppUsername] = useState('');
  const [cppPassword, setCppPassword] = useState('');
  const [showCppPassword, setShowCppPassword] = useState(false);

  // CE credentials
  const [ceUrl, setCeUrl] = useState('');
  const [ceUsername, setCeUsername] = useState('');
  const [cePassword, setCePassword] = useState('');
  const [showCePassword, setShowCePassword] = useState(false);

  // Scheduler state
  const [schedulerConfig, setSchedulerConfig] = useState<any[]>([]);

  // UI state
  const [showMsystemPassword, setShowMsystemPassword] = useState(false);
  const [showMsystemPin, setShowMsystemPin] = useState(false);
  const [showCqgPassword, setShowCqgPassword] = useState(false);
  const [showAcmPassword, setShowAcmPassword] = useState(false);
  const [showAcmGeminiApiKey, setShowAcmGeminiApiKey] = useState(false);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingCqgConnection, setTestingCqgConnection] = useState(false);
  const [testingAcmConnection, setTestingAcmConnection] = useState(false);

  // GTT Check state
  const [gttFile, setGttFile] = useState<File | null>(null);
  const [marketCsvFile, setMarketCsvFile] = useState<File | null>(null);
  const [commodityFile, setCommodityFile] = useState<File | null>(null);
  const [uploadingGtt, setUploadingGtt] = useState(false);
  const [uploadingMarketCsv, setUploadingMarketCsv] = useState(false);
  const [uploadingCommodity, setUploadingCommodity] = useState(false);
  const [runningGttCheck, setRunningGttCheck] = useState(false);
  const [downloadMarketCsv, setDownloadMarketCsv] = useState(true);
  const [gttReport, setGttReport] = useState<any>(null);
  const [loadingGttReport, setLoadingGttReport] = useState(false);
  const [gttFilter, setGttFilter] = useState<'ALL' | 'DIFF' | 'DIFF_MINOR' | 'DIFF_MAJOR' | 'MATCH' | 'MISSING'>('ALL');
  const [pushingToMs, setPushingToMs] = useState(false);

  // Reconciliation Test state
  const [reconSampleDates, setReconSampleDates] = useState<any[]>([]);
  const [reconSelectedPath, setReconSelectedPath] = useState('');
  const [reconUsdRate, setReconUsdRate] = useState(25220);
  const [reconRunning, setReconRunning] = useState(false);
  const [reconResult, setReconResult] = useState<any>(null);
  const [reconAutoRunning, setReconAutoRunning] = useState(false);
  const [reconAutoResult, setReconAutoResult] = useState<any>(null);
  const [reconTab, setReconTab] = useState<'sample' | 'upload'>('sample');
  const [manualFiles, setManualFiles] = useState<{
    dsgd?: File | null;
    fr1?: File | null;
    fr2?: File | null;
    nano?: File | null;
    ttm?: File | null;
    op1?: File | null;
    op2?: File | null;
    qltkgd?: File | null;
    eod?: File | null;
    tttt?: File | null;
    accountsBalances?: File | null;
  }>({});
  const [reconUploadRunning, setReconUploadRunning] = useState(false);

  // Queue state
  const [jobs, setJobs] = useState<BotJobs[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  // Download reports state
  const [downloadTargets, setDownloadTargets] = useState<string[]>([
    'NKTTHT',
    'DSTKGD-Futures',
    'DSTKGD-Spread',
    'DSTKGD-LME',
    'DSTKGD-ACM',
    'QLTKGD',
    'QLTKGDAmKQ',
    'TLKQHSKQ',
    'NR',
    'DSTrader',
    'Markettruoc6h',
    'DSLDK',
    'DSLCK',
    'DSLH',
    'DSLK',
    'DSGD',
    'TTM',
    'TTTT',
  ]);
  const [triggeringDownload, setTriggeringDownload] = useState(false);
  const [trackedJobs, setTrackedJobs] = useState<string[]>([]);

  // Backup MS Audit state
  const [backupPathMs, setBackupPathMs] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const [savingBackupPathMs, setSavingBackupPathMs] = useState(false);
  const [auditingMs, setAuditingMs] = useState(false);
  const [auditMsResults, setAuditMsResults] = useState<any>(null);
  const [triggeringAuditMs, setTriggeringAuditMs] = useState(false);

  // Backup CQG Audit state
  const [backupPathCqg, setBackupPathCqg] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup CQG\\Futures');
  const [savingBackupPathCqg, setSavingBackupPathCqg] = useState(false);
  const [auditingCqg, setAuditingCqg] = useState(false);
  const [auditCqgResults, setAuditCqgResults] = useState<any>(null);
  const [triggeringAuditCqg, setTriggeringAuditCqg] = useState(false);

  // Backup ACM Audit state
  const [backupPathAcm, setBackupPathAcm] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup ACM\\Futures');
  const [savingBackupPathAcm, setSavingBackupPathAcm] = useState(false);
  const [auditingAcm, setAuditingAcm] = useState(false);
  const [auditAcmResults, setAuditAcmResults] = useState<any>(null);
  const [triggeringAuditAcm, setTriggeringAuditAcm] = useState(false);
  const [captchaText, setCaptchaText] = useState('');
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);

  // Excel Macro Lot Consolidation state
  const [macroLotPath, setMacroLotPath] = useState('');
  const [macroLotScriptPath, setMacroLotScriptPath] = useState('');
  const [pythonExe, setPythonExe] = useState('python');
  const [targetRoot, setTargetRoot] = useState('M:\\Quanlygiaodich\\Tai lieu hoat dong');
  const [savingMacroConfig, setSavingMacroConfig] = useState(false);
  const [triggeringMacroLot, setTriggeringMacroLot] = useState(false);

  const [macroValuePath, setMacroValuePath] = useState('');
  const [macroValueScriptPath, setMacroValueScriptPath] = useState('');
  const [savingValueMacroConfig, setSavingValueMacroConfig] = useState(false);
  const [triggeringMacroValue, setTriggeringMacroValue] = useState(false);

  // CQG CAST download trigger state
  const [backupPathCast, setBackupPathCast] = useState('C:\\Quanlygiaodich\\Tai lieu hoat dong\\Backup MS\\Futures');
  const [triggeringCastDownload, setTriggeringCastDownload] = useState(false);

  // Derived selected job
  const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch configs
  const fetchConfig = useCallback(async () => {
    if (!token) return;
    setLoadingConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.msystem) {
          setMsystemUrl(data.msystem.url || 'https://msystem.mxv.vn/');
          setMsystemUsername(data.msystem.username || '');
          setMsystemPassword(data.msystem.password || '');
          setMsystemPin(data.msystem.pin || '');
        }
        if (data.cqg) {
          setCqgUrl(data.cqg.url || 'https://m.cqg.com/cqg/desktop/logon?ref=forced');
          setCqgUsername(data.cqg.username || '');
          setCqgPassword(data.cqg.password || '');
        }
        if (data.acm) {
          setAcmUrl(data.acm.url || 'https://acm.member-url.vn/login');
          setAcmUsername(data.acm.username || '');
          setAcmPassword(data.acm.password || '');
          setAcmGeminiApiKey(data.acm.geminiApiKey || '');
          setAcmDownloadUrl(data.acm.downloadUrl || '');
          setAcmDownloadBtnSelector(data.acm.downloadBtnSelector || '');
          setAcmSftpHost(data.acm.sftpHost || 'sftp.mxv.com.vn');
          setAcmSftpPort(data.acm.sftpPort || '2231');
          setAcmSftpUsername(data.acm.sftpUsername || '');
          setAcmSftpPassword(data.acm.sftpPassword || '');
          setAcmSftpRemoteDir(data.acm.sftpRemoteDir || '/data/');
        }
        if (data.cast) {
          setCastUrl(data.cast.url || 'https://www.cqgtrader.com/CAST/Logon/Logon.asp');
          setCastUsername(data.cast.username || '');
          setCastPassword(data.cast.password || '');
        }
        if (data.cpp) {
          setCppUrl(data.cpp.url || '');
          setCppUsername(data.cpp.username || '');
          setCppPassword(data.cpp.password || '');
        }
        if (data.ce) {
          setCeUrl(data.ce.url || '');
          setCeUsername(data.ce.username || '');
          setCePassword(data.ce.password || '');
        }
        if (data.schedulerConfig) {
          setSchedulerConfig(data.schedulerConfig);
        }
      }

      // Fetch Backup MS path
      const backupRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-ms/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupRes.ok) {
        const backupData = await backupRes.json();
        if (backupData.backupPath) {
          setBackupPathMs(backupData.backupPath);
          setBackupPathCast(backupData.backupPath);
        }
      }

      // Fetch Backup CQG path
      const backupCqgRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-cqg/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupCqgRes.ok) {
        const backupCqgData = await backupCqgRes.json();
        if (backupCqgData.backupPath) {
          setBackupPathCqg(backupCqgData.backupPath);
        }
      }

      // Fetch Backup ACM path
      const backupAcmRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-acm/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (backupAcmRes.ok) {
        const backupAcmData = await backupAcmRes.json();
        if (backupAcmData.backupPath) {
          setBackupPathAcm(backupAcmData.backupPath);
        }
      }

      // Fetch Macro Lot config
      const macroRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/macro-lot/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (macroRes.ok) {
        const macroData = await macroRes.json();
        if (macroData.macroPath) setMacroLotPath(macroData.macroPath);
        if (macroData.scriptPath) setMacroLotScriptPath(macroData.scriptPath);
        if (macroData.pythonExe) setPythonExe(macroData.pythonExe);
        if (macroData.targetRoot) setTargetRoot(macroData.targetRoot);
      }

      // Fetch Macro Value config
      const macroValueRes = await fetch(`${API_BASE_URL}/api/v1/bot-engine/macro-value/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (macroValueRes.ok) {
        const macroValueData = await macroValueRes.json();
        if (macroValueData.macroPath) setMacroValuePath(macroValueData.macroPath);
        if (macroValueData.scriptPath) setMacroValueScriptPath(macroValueData.scriptPath);
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể tải cấu hình Bot từ máy chủ');
    } finally {
      setLoadingConfig(false);
    }
  }, [token]);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    if (!token) return;
    setLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  }, [token]);

  useEffect(() => {
    Promise.resolve().then(() => {
      fetchConfig();
      fetchJobs();
    });
  }, [fetchConfig, fetchJobs]);

  // Auto-refresh jobs every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobs();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

  // Auto-download completed tracked jobs
  useEffect(() => {
    if (jobs.length === 0 || trackedJobs.length === 0) return;

    const completedJobs = jobs.filter(
      (job) => trackedJobs.includes(job._id) && job.status === 'COMPLETED'
    );

    if (completedJobs.length > 0) {
      completedJobs.forEach((job) => {
        toast.success(`Job ${job._id} hoàn tất! Tự động tải file nén...`);
        handleDownloadZip(job._id);
      });
      setTrackedJobs((prev) => prev.filter((id) => !completedJobs.some((cj) => cj._id === id)));
    }

    const terminatedJobs = jobs.filter(
      (job) => trackedJobs.includes(job._id) && (job.status === 'FAILED' || job.status === 'CANCELLED' as any)
    );
    if (terminatedJobs.length > 0) {
      setTrackedJobs((prev) => prev.filter((id) => !terminatedJobs.some((tj) => tj._id === id)));
    }
  }, [jobs, trackedJobs]);

  // Save configurations
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingConfig(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          msystem: {
            url: msystemUrl.trim(),
            username: msystemUsername.trim(),
            password: msystemPassword,
            pin: msystemPin,
          },
          cqg: {
            url: cqgUrl.trim(),
            username: cqgUsername.trim(),
            password: cqgPassword,
          },
          acm: {
            url: acmUrl.trim(),
            username: acmUsername.trim(),
            password: acmPassword,
            geminiApiKey: acmGeminiApiKey,
            downloadUrl: acmDownloadUrl.trim(),
            downloadBtnSelector: acmDownloadBtnSelector.trim(),
            sftpHost: acmSftpHost.trim(),
            sftpPort: acmSftpPort.trim(),
            sftpUsername: acmSftpUsername.trim(),
            sftpPassword: acmSftpPassword,
            sftpRemoteDir: acmSftpRemoteDir.trim(),
          },
          cast: {
            url: castUrl.trim(),
            username: castUsername.trim(),
            password: castPassword,
          },
          cpp: {
            url: cppUrl.trim(),
            username: cppUsername.trim(),
            password: cppPassword,
          },
          ce: {
            url: ceUrl.trim(),
            username: ceUsername.trim(),
            password: cePassword,
          },
          schedulerConfig,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi khi cập nhật cấu hình');
      }

      toast.success('Lưu cấu hình tài khoản Bot thành công!');
      fetchConfig();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ');
    } finally {
      setSavingConfig(false);
    }
  };

  // Save Backup MS Path
  const handleSaveBackupMsConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingBackupPathMs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-ms/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathMs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu đường dẫn backup MS thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingBackupPathMs(false);
    }
  };

  // Run quick scan audit
  const handleAuditMsBackup = async () => {
    if (!token) return;
    setAuditingMs(true);
    setAuditMsResults(null);
    const toastId = toast.loading('Đang scan thư mục backup MS...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-ms-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup');
      setAuditMsResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup', { id: toastId });
    } finally {
      setAuditingMs(false);
    }
  };

  // Trigger Playwright backup recovery job
  const handleTriggerAuditMs = async () => {
    if (!token) return;
    setTriggeringAuditMs(true);
    const toastId = toast.loading('Đang khởi tạo job tải bổ sung file thiếu...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-audit-ms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job kiểm tra & tải bổ sung file MS thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot recovery', { id: toastId });
    } finally {
      setTriggeringAuditMs(false);
    }
  };

  // Save Macro Lot config
  const handleSaveMacroLotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingMacroConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/macro-lot/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ macroPath: macroLotPath, scriptPath: macroLotScriptPath, pythonExe, targetRoot }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu cấu hình macro Excel thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingMacroConfig(false);
    }
  };

  // Trigger Excel Macro execution
  const handleTriggerLotMacro = async () => {
    if (!token) return;
    setTriggeringMacroLot(true);
    const toastId = toast.loading('Đang khởi tạo job chạy Excel Macro...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-lot-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job chạy Excel Macro thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy macro', { id: toastId });
    } finally {
      setTriggeringMacroLot(false);
    }
  };

  // Save Macro Value config
  const handleSaveMacroValueConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingValueMacroConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/macro-value/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ macroPath: macroValuePath, scriptPath: macroValueScriptPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu cấu hình macro Excel giá trị thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingValueMacroConfig(false);
    }
  };

  // Trigger Excel Macro Value execution
  const handleTriggerValueMacro = async () => {
    if (!token) return;
    setTriggeringMacroValue(true);
    const toastId = toast.loading('Đang khởi tạo job chạy Excel Macro Giá trị...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-value-macro`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job chạy Excel Macro Giá trị thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy macro', { id: toastId });
    } finally {
      setTriggeringMacroValue(false);
    }
  };

  // Save Backup CQG Path
  const handleSaveBackupCqgConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingBackupPathCqg(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-cqg/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathCqg }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu đường dẫn backup CQG thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingBackupPathCqg(false);
    }
  };

  // Run quick scan audit CQG
  const handleAuditCqgBackup = async () => {
    if (!token) return;
    setAuditingCqg(true);
    setAuditCqgResults(null);
    const toastId = toast.loading('Đang scan thư mục backup CQG...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-cqg-backup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup CQG');
      setAuditCqgResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup CQG', { id: toastId });
    } finally {
      setAuditingCqg(false);
    }
  };

  // Trigger CQG backup auto-merge job
  const handleTriggerAuditCqg = async () => {
    if (!token) return;
    setTriggeringAuditCqg(true);
    const toastId = toast.loading('Đang khởi tạo job ghép file backup CQG...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-audit-cqg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động ghép file CQG thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot CQG merge', { id: toastId });
    } finally {
      setTriggeringAuditCqg(false);
    }
  };

  // Save Backup ACM Path
  const handleSaveBackupAcmConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingBackupPathAcm(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/backup-acm/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ backupPath: backupPathAcm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi khi lưu cấu hình');
      toast.success(data.message || 'Đã lưu đường dẫn backup ACM thành công!');
    } catch (err: any) {
      toast.error(err.message || 'Lỗi lưu cấu hình');
    } finally {
      setSavingBackupPathAcm(false);
    }
  };

  // Run quick scan audit ACM
  const handleAuditAcmBackup = async () => {
    if (!token) return;
    setAuditingAcm(true);
    setAuditAcmResults(null);
    const toastId = toast.loading('Đang scan thư mục backup ACM...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/audit-acm-backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi quét thư mục backup ACM');
      setAuditAcmResults(data);
      const { ok, missing, outdated } = data.summary;
      toast.success(`Quét xong! OK: ${ok}, Thiếu: ${missing}, Cũ: ${outdated}`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra backup ACM', { id: toastId });
    } finally {
      setAuditingAcm(false);
    }
  };

  // Trigger ACM backup download job
  const handleTriggerAuditAcm = async () => {
    if (!token) return;
    setTriggeringAuditAcm(true);
    const toastId = toast.loading('Đang khởi tạo job tải file backup ACM...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-audit-acm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động tải file ACM thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot ACM', { id: toastId });
    } finally {
      setTriggeringAuditAcm(false);
    }
  };

  // Submit Captcha for selected job
  const handleSubmitCaptcha = async () => {
    if (!token || !selectedJob || !captchaText) return;
    setSubmittingCaptcha(true);
    const toastId = toast.loading('Đang gửi mã Captcha...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${selectedJob._id}/submit-captcha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ captchaText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gửi captcha thất bại');
      toast.success('Gửi mã captcha thành công! Vui lòng đợi bot xử lý.', { id: toastId });
      setCaptchaText('');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi captcha', { id: toastId });
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  // Trigger CQG CAST report download
  const handleTriggerCastDownload = async () => {
    if (!token) return;
    setTriggeringCastDownload(true);
    const toastId = toast.loading('Đang khởi tạo job tải báo cáo CQG CAST...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-cast-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ backupPath: backupPathCast }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng job tự động tải báo cáo CQG CAST thành công!', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khởi chạy bot CQG CAST', { id: toastId });
    } finally {
      setTriggeringCastDownload(false);
    }
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!token) return;
    setTestingConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập M-System...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/test-connection`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm thất bại');
      }

      toast.success(data.message || 'Kết nối thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm thất bại', { id: toastId });
    } finally {
      setTestingConnection(false);
    }
  };

  // Test CQG connection
  const handleTestCqgConnection = async () => {
    if (!token) return;
    setTestingCqgConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập CQG...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/test-connection-cqg`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm CQG thất bại');
      }

      toast.success(data.message || 'Kết nối CQG thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm CQG thất bại', { id: toastId });
    } finally {
      setTestingCqgConnection(false);
    }
  };

  // Test ACM connection
  const handleTestAcmConnection = async () => {
    if (!token) return;
    setTestingAcmConnection(true);
    const toastId = toast.loading('Đang khởi chạy Browser Headless và chạy thử đăng nhập ACM...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/test-connection-acm`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Đăng nhập thử nghiệm ACM thất bại');
      }

      toast.success(data.message || 'Kết nối ACM thành công!', { id: toastId });
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Thử nghiệm ACM thất bại', { id: toastId });
    } finally {
      setTestingAcmConnection(false);
    }
  };

  // Upload GTT.xlsx file
  const handleUploadGtt = async () => {
    if (!token || !gttFile) return;
    setUploadingGtt(true);
    const toastId = toast.loading('Đang tải lên file GTT.xlsx...');
    try {
      const buffer = await gttFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: gttFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload GTT.xlsx thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingGtt(false);
    }
  };

  // Upload market.csv file
  const handleUploadMarketCsv = async () => {
    if (!token || !marketCsvFile) return;
    setUploadingMarketCsv(true);
    const toastId = toast.loading('Đang tải lên file market.csv...');
    try {
      const buffer = await marketCsvFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/market-csv-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: marketCsvFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload market.csv thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingMarketCsv(false);
    }
  };

  // Upload hang_hoa.xlsx file (Commodity list)
  const handleUploadCommodity = async () => {
    if (!token || !commodityFile) return;
    setUploadingCommodity(true);
    const toastId = toast.loading('Đang tải lên file hàng hóa...');
    try {
      const buffer = await commodityFile.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/commodity-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, filename: commodityFile.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success('Upload file hàng hóa thành công!', { id: toastId });
      // Reload report to refresh data
      handleLoadGttReport();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi upload', { id: toastId });
    } finally {
      setUploadingCommodity(false);
    }
  };

  // Run GTT check pipeline
  const handleRunGttCheck = async () => {
    if (!token) return;
    setRunningGttCheck(true);
    const toastId = toast.loading('Đang chạy pipeline kiểm tra GTT... (có thể mất 2-3 phút)');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/run-gtt-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ downloadMarketCsv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Kiểm tra GTT thất bại');
      setGttReport(data.report);
      const { matched, diffCount, msOnlyCount, cqgOnlyCount } = data.report;
      toast.success(`GTT Check hoàn tất! ✅ ${matched} khớp, ⚠️ ${diffCount} chênh lệch, ${msOnlyCount + cqgOnlyCount} thiếu`, { id: toastId, duration: 8000 });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm tra GTT', { id: toastId });
    } finally {
      setRunningGttCheck(false);
    }
  };

  // Load existing GTT report
  const handleLoadGttReport = async () => {
    if (!token) return;
    setLoadingGttReport(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setGttReport(data.report);
        toast.success('Đã tải báo cáo GTT gần nhất');
      } else {
        toast.error(data.message || 'Chưa có báo cáo GTT');
      }
    } catch (err: any) {
      toast.error('Lỗi tải báo cáo GTT');
    } finally {
      setLoadingGttReport(false);
    }
  };

  // Load sample dates for reconciliation test
  const handleLoadReconSampleDates = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/reconciliation/sample-dates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReconSampleDates(data.dates || []);
        if (data.dates?.length > 0 && !reconSelectedPath) {
          setReconSelectedPath(data.dates[0].samplePath);
        }
      } else {
        toast.error(data.message || 'Không tải được danh sách ngày mẫu');
      }
    } catch (err: any) {
      toast.error('Lỗi tải danh sách ngày mẫu');
    }
  };

  // Run reconciliation test using local sample files
  const handleRunReconTest = async () => {
    if (!token || !reconSelectedPath) return;
    setReconRunning(true);
    setReconResult(null);
    const toastId = toast.loading('Đang chạy kiểm thử đối chiếu từ file mẫu...');
    try {
      const res = await fetch(`${API_BASE_URL}/reconciliation/run-test-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ samplePath: reconSelectedPath, usdRate: reconUsdRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi chạy kiểm thử');
      setReconResult(data);
      const hasErrors = Object.keys(data.errors || {}).length > 0;
      if (data.success) {
        toast.success('Kiểm thử hoàn thành: Tất cả đối chiếu khớp!', { id: toastId, duration: 6000 });
      } else if (hasErrors) {
        toast.error(`Kiểm thử xong có lỗi: ${Object.values(data.errors || {}).join(', ')}`, { id: toastId, duration: 6000 });
      } else {
        toast('Kiểm thử hoàn thành: Phát hiện chênh lệch dữ liệu', { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kiểm thử', { id: toastId });
    } finally {
      setReconRunning(false);
    }
  };

  // Run auto reconciliation via RPA bot
  const handleRunAutoRecon = async () => {
    if (!token) return;
    setReconAutoRunning(true);
    setReconAutoResult(null);
    const toastId = toast.loading('Bot đang đăng nhập M-System và tải file đối chiếu... (2-5 phút)');
    try {
      const res = await fetch(`${API_BASE_URL}/reconciliation/run-auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ usdRate: reconUsdRate }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Bot đối chiếu thất bại');
      setReconAutoResult(data);
      toast.success(data.message || 'Bot đối chiếu hoàn thành!', { id: toastId, duration: 6000 });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi bot đối chiếu', { id: toastId });
    } finally {
      setReconAutoRunning(false);
    }
  };

  // Run reconciliation test by uploading manual files
  const handleRunUploadReconTest = async () => {
    if (!token) return;

    const hasKlgd = !!manualFiles.dsgd;
    const hasEod = !!(manualFiles.qltkgd && manualFiles.eod && manualFiles.tttt);
    const hasCqg = !!(manualFiles.qltkgd && manualFiles.accountsBalances);

    if (!hasKlgd && !hasEod && !hasCqg) {
      toast.error('Vui lòng chọn tối thiểu file DSGD (cho KLGD), hoặc QLTKGD+EOD+TTTT (cho EOD), hoặc QLTKGD+Accounts_Balances (cho CQG).');
      return;
    }

    setReconUploadRunning(true);
    setReconResult(null);
    const toastId = toast.loading('Đang upload files và chạy đối chiếu...');

    try {
      const formData = new FormData();
      Object.entries(manualFiles).forEach(([key, file]) => {
        if (file) {
          formData.append(key, file);
        }
      });
      formData.append('usdRate', String(reconUsdRate));

      const res = await fetch(`${API_BASE_URL}/reconciliation/test-upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Lỗi upload chạy đối chiếu');

      setReconResult(data);
      const hasErrors = Object.keys(data.errors || {}).length > 0;
      if (data.success) {
        toast.success('Đối chiếu thành công: Tất cả dữ liệu khớp!', { id: toastId, duration: 6000 });
      } else if (hasErrors) {
        toast.error(`Đối chiếu xong có lỗi: ${Object.values(data.errors || {}).join(', ')}`, { id: toastId, duration: 6000 });
      } else {
        toast('Đối chiếu thành công: Phát hiện chênh lệch dữ liệu', { id: toastId, duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi đối chiếu', { id: toastId });
    } finally {
      setReconUploadRunning(false);
    }
  };

  // Download correction file for M-System
  const handleDownloadCorrection = async (type: 'settlement' | 'first_match') => {
    if (!token) return;
    const toastId = toast.loading('Đang khởi tạo file sửa giá...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report/export-correction?type=${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.json().catch(() => ({ message: 'Không thể xuất file' }));
        throw new Error(errorText.message || 'Xuất file thất bại');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sua-gia-${type === 'settlement' ? 'gtt' : 'first-match'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Tải xuống file sửa giá thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải xuống file sửa giá', { id: toastId });
    }
  };

  // Push GTT corrections directly to M-System
  const handlePushToMSystem = async () => {
    if (!token) return;
    if (!window.confirm('Bạn có chắc chắn muốn đẩy trực tiếp giá sửa đổi của các hợp đồng lệch nhiều lên M-System không?')) {
      return;
    }
    setPushingToMs(true);
    const toastId = toast.loading('Đang gửi yêu cầu cập nhật giá lên M-System...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report/push-to-ms`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi không rõ từ M-System');
      }
      toast.success(data.message || 'Cập nhật giá lên M-System thành công!', { id: toastId, duration: 5000 });
    } catch (err: any) {
      toast.error(err.message || 'Gửi yêu cầu cập nhật giá thất bại', { id: toastId, duration: 6000 });
    } finally {
      setPushingToMs(false);
    }
  };

  const handleTargetToggle = (target: string) => {
    setDownloadTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target]
    );
  };

  const handleSelectAllTargets = () => {
    const all = [
      'NKTTHT',
      'DSTKGD-Futures',
      'DSTKGD-Spread',
      'DSTKGD-LME',
      'DSTKGD-ACM',
      'QLTKGD',
      'QLTKGDAmKQ',
      'TLKQHSKQ',
      'NR',
      'DSTrader',
      'Markettruoc6h',
      'DSLDK',
      'DSLCK',
      'DSLH',
      'DSLK',
      'DSGD',
      'TTM',
      'TTTT',
    ];
    if (downloadTargets.length === all.length) {
      setDownloadTargets([]);
    } else {
      setDownloadTargets(all);
    }
  };

  const handleTriggerDownload = async () => {
    if (!token) return;
    if (downloadTargets.length === 0) {
      toast.error('Vui lòng chọn ít nhất một báo cáo để tải!');
      return;
    }
    setTriggeringDownload(true);
    const toastId = toast.loading('Đang gửi yêu cầu khởi chạy robot tải báo cáo...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/trigger-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targets: downloadTargets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã gửi yêu cầu chạy RPA tải báo cáo! Theo dõi logs ở góc phải.', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setTriggeringDownload(false);
    }
  };

  const handleDownloadZip = async (jobId: string) => {
    if (!token) return;
    const toastId = toast.loading('Đang chuẩn bị và tạo file ZIP báo cáo...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}/download-zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Không thể tải file nén');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BaoCao_MXV_${jobId}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Tải file ZIP thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi tải file', { id: toastId });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
            }}
          >
            <CheckCircle size={12} /> Thành công
          </span>
        );
      case 'FAILED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
            }}
          >
            <XCircle size={12} /> Lỗi
          </span>
        );
      case 'PROCESSING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              animation: 'pulse 2s infinite',
            }}
          >
            <RefreshCw size={12} className="animate-spin" /> Đang chạy
          </span>
        );
      case 'AWAITING_CAPTCHA':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.15)',
              color: '#f59e0b',
              animation: 'pulse 1.5s infinite',
            }}
          >
            <Activity size={12} /> Chờ Captcha
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
            }}
          >
            <Activity size={12} /> Đang chờ
          </span>
        );
    }
  };

  // Pre-calculate GTT CSV preview content
  let gttCsvContent = '';
  if (gttReport && gttReport.diffCount > 0) {
    const majorDiffRows = gttReport.rows.filter(
      (r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))
    );
    if (majorDiffRows.length > 0) {
      const csvHeaders = 'contractCode,settlePrice';
      const csvRows = majorDiffRows.map((r: any) => `${r.symbol},${r.gttCqg}`);
      gttCsvContent = [csvHeaders, ...csvRows].join('\n');
    }
  }

  // Pre-calculate KLGD and EOD stats for rendering to avoid TSX compiler bugs
  let klgdStats: any[] = [];
  let eodStats: any[] = [];
  if (reconResult) {
    if (reconResult.results?.klgd) {
      klgdStats = [
        { label: 'Tổng MS', value: `${reconResult.results.klgd.totals?.totalDSGD ?? '—'} lot`, color: '#60a5fa' },
        { label: 'Tổng CQG', value: `${reconResult.results.klgd.totals?.totalFR ?? '—'} lot`, color: '#60a5fa' },
        { label: 'Chênh lệch', value: `${reconResult.results.klgd.totals?.differ ?? '—'} lot`, color: reconResult.results.klgd.totals?.differ > 0 ? '#ef4444' : '#10b981' },
        { label: 'GD lệch chi tiết', value: `${reconResult.results.klgd.mismatchedTrades?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTrades?.length > 0 ? '#ef4444' : '#10b981' },
        { label: 'TK lệch TTM', value: `${reconResult.results.klgd.mismatchedTTM?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTTM?.length > 0 ? '#f59e0b' : '#10b981' },
      ];
    }
    if (reconResult.results?.eod) {
      eodStats = [
        { label: 'TK lệch số dư (≥1,000đ)', value: `${reconResult.results.eod.mismatchedEOD?.length ?? 0}`, color: reconResult.results.eod.mismatchedEOD?.length > 0 ? '#ef4444' : '#10b981' },
        { label: 'TK âm ký quỹ', value: `${reconResult.results.eod.negativeIMRAcc?.length ?? 0}`, color: reconResult.results.eod.negativeIMRAcc?.length > 0 ? '#ef4444' : '#10b981' },
      ];
    }
  }

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Cấu Hình Hệ Thống RPA & Robot
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Quản lý tài khoản đăng nhập M-System/CQG và theo dõi hoạt động tải báo cáo tự động chạy ngầm.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection || testingCqgConnection || testingAcmConnection || loadingConfig}
              className="btn btn-secondary"
              style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={16} /> Test Đăng Nhập M-System
            </button>
            <button
              type="button"
              onClick={handleTestCqgConnection}
              disabled={testingConnection || testingCqgConnection || testingAcmConnection || loadingConfig}
              className="btn btn-secondary"
              style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <Play size={16} /> Test Đăng Nhập CQG
            </button>
            <button
              type="button"
              onClick={handleTestAcmConnection}
              disabled={testingConnection || testingCqgConnection || testingAcmConnection || loadingConfig}
              className="btn btn-secondary"
              style={{
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)'
              }}
            >
              <Play size={16} /> Test Đăng Nhập ACM
            </button>
          </div>
        </div>

        {loadingConfig ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải thông tin cấu hình...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-8 items-start">

            {/* Left: Forms & Tools */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                {/* M-System Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Server size={20} color="var(--color-primary)" />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản Kết Nối M-System</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Đường dẫn URL đăng nhập M-System
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://msystem.mxv.vn/"
                          value={msystemUrl}
                          onChange={(e) => setMsystemUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Tên đăng nhập (Username)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nhập username..."
                          value={msystemUsername}
                          onChange={(e) => setMsystemUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Mã PIN ảo M-System
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showMsystemPin ? 'text' : 'password'}
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Mã PIN..."
                            value={msystemPin}
                            onChange={(e) => setMsystemPin(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowMsystemPin(!showMsystemPin)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showMsystemPin ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Mật khẩu (Password)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Key size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type={showMsystemPassword ? 'text' : 'password'}
                          className="form-input"
                          style={{ paddingLeft: '40px', paddingRight: '40px' }}
                          placeholder="Mật khẩu..."
                          value={msystemPassword}
                          onChange={(e) => setMsystemPassword(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowMsystemPassword(!showMsystemPassword)}
                          style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          {showMsystemPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CQG Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Cpu size={20} color="var(--color-primary)" />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản Kết Nối CQG Desktop</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Đường dẫn URL CQG Desktop
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://m.cqg.com/cqg/desktop/logon?ref=forced"
                          value={cqgUrl}
                          onChange={(e) => setCqgUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Tên đăng nhập CQG
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="CQG Username..."
                          value={cqgUsername}
                          onChange={(e) => setCqgUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Mật khẩu CQG
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showCqgPassword ? 'text' : 'password'}
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="CQG Password..."
                            value={cqgPassword}
                            onChange={(e) => setCqgPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCqgPassword(!showCqgPassword)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showCqgPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACM Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Server size={20} color="var(--color-primary)" />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản Đăng Nhập ACM</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Đường dẫn URL cổng ACM
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://acm.member-url.vn/login"
                          value={acmUrl}
                          onChange={(e) => setAcmUrl(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Tên đăng nhập ACM
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Nhập tên đăng nhập..."
                          value={acmUsername}
                          onChange={(e) => setAcmUsername(e.target.value)}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Mật khẩu đăng nhập ACM
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showAcmPassword ? 'text' : 'password'}
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Nhập mật khẩu..."
                            value={acmPassword}
                            onChange={(e) => setAcmPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowAcmPassword(!showAcmPassword)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showAcmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        API Key giải Captcha (Google Gemini API Key)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Key size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type={showAcmGeminiApiKey ? 'text' : 'password'}
                          className="form-input"
                          style={{ paddingLeft: '40px', paddingRight: '40px' }}
                          placeholder="AI API Key (Không bắt buộc, nếu có sẽ tự giải Captcha)..."
                          value={acmGeminiApiKey}
                          onChange={(e) => setAcmGeminiApiKey(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAcmGeminiApiKey(!showAcmGeminiApiKey)}
                          style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                        >
                          {showAcmGeminiApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          URL Tải Báo Cáo ACM (Download URL)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ví dụ: /acm/report/nano/download"
                          value={acmDownloadUrl}
                          onChange={(e) => setAcmDownloadUrl(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Selector nút tải (Download Button Selector)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ví dụ: #btnExportExcel"
                          value={acmDownloadBtnSelector}
                          onChange={(e) => setAcmDownloadBtnSelector(e.target.value)}
                        />
                      </div>
                    </div>

                    {/* SFTP CONFIGURATION */}
                    <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Server size={16} /> Cấu hình đồng bộ SFTP (WinSCP)
                      </h4>

                      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            SFTP Host
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Ví dụ: sftp.mxv.com.vn"
                            value={acmSftpHost}
                            onChange={(e) => setAcmSftpHost(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            SFTP Port
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="2231"
                            value={acmSftpPort}
                            onChange={(e) => setAcmSftpPort(e.target.value)}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            SFTP Username
                          </label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="Tên đăng nhập SFTP..."
                            value={acmSftpUsername}
                            onChange={(e) => setAcmSftpUsername(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                            SFTP Password
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showAcmSftpPassword ? 'text' : 'password'}
                              className="form-input"
                              placeholder="Mật khẩu SFTP..."
                              value={acmSftpPassword}
                              onChange={(e) => setAcmSftpPassword(e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => setShowAcmSftpPassword(!showAcmSftpPassword)}
                              style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            >
                              {showAcmSftpPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                          Thư mục từ xa (Remote Directory)
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Ví dụ: /data/"
                          value={acmSftpRemoteDir}
                          onChange={(e) => setAcmSftpRemoteDir(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CQG CAST Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Globe size={20} color="#f59e0b" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản CQG CAST</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Dùng để tự động tải Accounts_Balances.xlsx phục vụ kiểm tra SOD</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>URL CQG CAST</label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          id="cast-url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://www.cqgtrader.com/CAST/Logon/Logon.asp"
                          value={castUrl}
                          onChange={(e) => setCastUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tên đăng nhập CAST</label>
                        <input
                          type="text"
                          id="cast-username"
                          className="form-input"
                          placeholder="Nhập username CAST..."
                          value={castUsername}
                          onChange={(e) => setCastUsername(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mật khẩu CAST</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showCastPassword ? 'text' : 'password'}
                            id="cast-password"
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Nhập mật khẩu..."
                            value={castPassword}
                            onChange={(e) => setCastPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCastPassword(!showCastPassword)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showCastPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)', fontSize: '0.8rem', color: '#f59e0b' }}>
                      💡 Script sẽ tự bypass cảnh báo IE Mode bằng cách inject mock <code>localeinfoproviderObj</code> + IE11 User-Agent
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Thư mục Backup MS để lưu file (Accounts_Balances.xlsx)</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nhập đường dẫn thư mục backup MS..."
                        value={backupPathCast}
                        onChange={(e) => setBackupPathCast(e.target.value)}
                        style={{ marginBottom: '12px' }}
                      />
                      <button
                        type="button"
                        onClick={handleTriggerCastDownload}
                        disabled={triggeringCastDownload}
                        className="btn"
                        style={{
                          width: '100%',
                          padding: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                          border: 'none',
                          color: '#fff',
                          boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)',
                          cursor: 'pointer',
                          borderRadius: '8px',
                        }}
                      >
                        <Download size={16} /> {triggeringCastDownload ? 'Đang chạy Bot tải...' : 'Tải Báo Cáo & Đổi Tên'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* CPP Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Globe size={20} color="#8b5cf6" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản CPP</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Dùng để đăng nhập và thực hiện kiểm tra MM / CPP tự động</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>URL CPP</label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          id="cpp-url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://cpp.mxv.com.vn/..."
                          value={cppUrl}
                          onChange={(e) => setCppUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tên đăng nhập CPP</label>
                        <input
                          type="text"
                          id="cpp-username"
                          className="form-input"
                          placeholder="Nhập username CPP..."
                          value={cppUsername}
                          onChange={(e) => setCppUsername(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mật khẩu CPP</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showCppPassword ? 'text' : 'password'}
                            id="cpp-password"
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Nhập mật khẩu..."
                            value={cppPassword}
                            onChange={(e) => setCppPassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCppPassword(!showCppPassword)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showCppPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CE Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Globe size={20} color="#06b6d4" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tài Khoản CE</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Dùng để đăng nhập và thực hiện kiểm tra CE / EOD tự động</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>URL CE</label>
                      <div style={{ position: 'relative' }}>
                        <Globe size={16} style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }} />
                        <input
                          type="url"
                          id="ce-url"
                          className="form-input"
                          style={{ paddingLeft: '40px' }}
                          placeholder="https://ce.mxv.com.vn/..."
                          value={ceUrl}
                          onChange={(e) => setCeUrl(e.target.value)}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Tên đăng nhập CE</label>
                        <input
                          type="text"
                          id="ce-username"
                          className="form-input"
                          placeholder="Nhập username CE..."
                          value={ceUsername}
                          onChange={(e) => setCeUsername(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Mật khẩu CE</label>
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showCePassword ? 'text' : 'password'}
                            id="ce-password"
                            className="form-input"
                            style={{ paddingRight: '40px' }}
                            placeholder="Nhập mật khẩu..."
                            value={cePassword}
                            onChange={(e) => setCePassword(e.target.value)}
                          />
                          <button
                            type="button"
                            onClick={() => setShowCePassword(!showCePassword)}
                            style={{ position: 'absolute', right: '12px', top: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          >
                            {showCePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scheduler Config Box */}
                <div className="glass-panel" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <Clock size={20} color="var(--color-primary)" />
                    <div>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Lập Lịch Tự Động (Scheduler)</h3>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>Cấu hình thời gian kích hoạt tự động các tác vụ check ngầm trong ngày</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {schedulerConfig.map((task, idx) => (
                      <div
                        key={task.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid var(--border-color)',
                          padding: '16px',
                          borderRadius: '8px',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: '200px' }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{task.name}</h4>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Mã Job: <code>{task.jobType}</code></span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Giờ chạy:</span>
                            <input
                              type="time"
                              className="form-input"
                              style={{ width: '120px', padding: '6px 10px', fontSize: '0.85rem' }}
                              value={task.time}
                              onChange={(e) => {
                                const updated = [...schedulerConfig];
                                updated[idx] = { ...updated[idx], time: e.target.value };
                                setSchedulerConfig(updated);
                              }}
                            />
                          </div>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            <input
                              type="checkbox"
                              checked={task.enabled}
                              onChange={(e) => {
                                const updated = [...schedulerConfig];
                                updated[idx] = { ...updated[idx], enabled: e.target.checked };
                                setSchedulerConfig(updated);
                              }}
                            />
                            Kích hoạt
                          </label>
                        </div>
                      </div>
                    ))}
                    
                    {schedulerConfig.length === 0 && (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '12px' }}>
                        Không có tác vụ lập lịch nào được cấu hình.
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="btn btn-primary"
                    style={{ padding: '14px 28px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Save size={18} /> Lưu Cấu Hình Credentials
                  </button>
                </div>
              </form>

              {/* Kiểm Tra File Backup MS Box */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <Settings size={20} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Kiểm Tra & Đồng Bộ File Backup MS</h3>
                </div>

                {/* Form config path */}
                <form onSubmit={handleSaveBackupMsConfig} style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Đường dẫn thư mục backup MS của IT Tool
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup MS\Futures"
                      value={backupPathMs}
                      onChange={(e) => setBackupPathMs(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingBackupPathMs}
                    className="btn btn-secondary"
                    style={{ padding: '12px 20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {savingBackupPathMs ? 'Đang lưu...' : 'Lưu đường dẫn'}
                  </button>
                </form>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAuditMsBackup}
                    disabled={auditingMs || triggeringAuditMs}
                    className="btn btn-secondary"
                    style={{
                      padding: '12px 20px',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <RefreshCw size={16} className={auditingMs ? 'animate-spin' : ''} /> Quét Thư Mục Backup
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerAuditMs}
                    disabled={auditingMs || triggeringAuditMs}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Cpu size={16} className={triggeringAuditMs ? 'animate-pulse' : ''} />
                    {triggeringAuditMs ? 'Đang gửi lệnh...' : '🤖 Tải Bổ Sung File Thiếu'}
                  </button>
                </div>

                {/* Audit results */}
                {auditMsResults && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Tổng số file: {auditMsResults.summary.total}
                      </span>
                      <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Đầy đủ (Hôm nay): {auditMsResults.summary.ok}
                      </span>
                      {auditMsResults.summary.missing > 0 && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Thiếu: {auditMsResults.summary.missing}
                        </span>
                      )}
                      {auditMsResults.summary.outdated > 0 && (
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Cũ (Không phải hôm nay): {auditMsResults.summary.outdated}
                        </span>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tên File</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '120px' }}>Trạng Thái</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '160px' }}>Thời Gian Thay Đổi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditMsResults.files.map((file: any) => (
                            <tr key={file.key} style={{ borderBottom: '1px solid var(--border-color)', background: 'transparent' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{file.filename}</td>
                              <td style={{ padding: '10px 12px' }}>
                                {file.status === 'OK' ? (
                                  <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>OK</span>
                                ) : file.status === 'OUTDATED' ? (
                                  <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>FILE CŨ</span>
                                ) : (
                                  <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>THIẾU</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {file.lastModified ? new Date(file.lastModified).toLocaleString('vi-VN') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Kiểm Tra File Backup CQG Box */}
              <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <Settings size={20} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Kiểm Tra & Đồng Bộ File Backup CQG</h3>
                </div>

                {/* Form config path */}
                <form onSubmit={handleSaveBackupCqgConfig} style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '280px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                      Đường dẫn thư mục backup CQG của IT Tool
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="M:\Quanlygiaodich\Tai lieu hoat dong\Backup CQG\Futures"
                      value={backupPathCqg}
                      onChange={(e) => setBackupPathCqg(e.target.value)}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingBackupPathCqg}
                    className="btn btn-secondary"
                    style={{ padding: '12px 20px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                  >
                    {savingBackupPathCqg ? 'Đang lưu...' : 'Lưu đường dẫn'}
                  </button>
                </form>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAuditCqgBackup}
                    disabled={auditingCqg || triggeringAuditCqg}
                    className="btn btn-secondary"
                    style={{
                      padding: '12px 20px',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <RefreshCw size={16} className={auditingCqg ? 'animate-spin' : ''} /> Quét Thư Mục Backup
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerAuditCqg}
                    disabled={auditingCqg || triggeringAuditCqg}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Cpu size={16} className={triggeringAuditCqg ? 'animate-pulse' : ''} />
                    {triggeringAuditCqg ? 'Đang gửi lệnh...' : '🤖 Tự Động Ghép File Thiếu'}
                  </button>
                </div>

                {/* Audit results */}
                {auditCqgResults && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Tổng số file: {auditCqgResults.summary.total}
                      </span>
                      <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Đầy đủ (Hôm nay): {auditCqgResults.summary.ok}
                      </span>
                      {auditCqgResults.summary.missing > 0 && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Thiếu: {auditCqgResults.summary.missing}
                        </span>
                      )}
                      {auditCqgResults.summary.outdated > 0 && (
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Cũ (Không phải hôm nay): {auditCqgResults.summary.outdated}
                        </span>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tên File</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '120px' }}>Trạng Thái</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '160px' }}>Loại File</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '160px' }}>Thời Gian Thay Đổi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditCqgResults.files.map((file: any) => (
                            <tr key={file.key} style={{ borderBottom: '1px solid var(--border-color)', background: 'transparent' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{file.filename}</td>
                              <td style={{ padding: '10px 12px' }}>
                                {file.status === 'OK' ? (
                                  <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>OK</span>
                                ) : file.status === 'OUTDATED' ? (
                                  <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>FILE CŨ</span>
                                ) : (
                                  <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>THIẾU</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {file.type === 'RAW' ? (
                                  <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>File thô</span>
                                ) : file.type === 'CONSOLIDATED' ? (
                                  <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 500 }}>Tự động gộp</span>
                                ) : (
                                  <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>⚠️ Thủ công (AS)</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {file.lastModified ? new Date(file.lastModified).toLocaleString('vi-VN') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Kiểm Tra File Backup ACM Box */}
              <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <Settings size={20} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Kiểm Tra & Đồng Bộ File Backup ACM (Web & SFTP)</h3>
                </div>

                {/* Form config path (Read-only) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Đường dẫn thư mục backup ACM (Tự động đồng bộ theo cấu hình Backup MS)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={backupPathAcm}
                    readOnly
                    disabled
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      color: 'var(--text-secondary)',
                      cursor: 'not-allowed',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '12px'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-primary)', opacity: 0.8, marginTop: '2px' }}>
                    * Hệ thống tự động lưu vào thư mục ACM nằm song song với thư mục Futures được cấu hình ở phần Backup MS.
                  </span>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAuditAcmBackup}
                    disabled={auditingAcm || triggeringAuditAcm}
                    className="btn btn-secondary"
                    style={{
                      padding: '12px 20px',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <RefreshCw size={16} className={auditingAcm ? 'animate-spin' : ''} /> Quét Thư Mục Backup
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerAuditAcm}
                    disabled={auditingAcm || triggeringAuditAcm}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Cpu size={16} className={triggeringAuditAcm ? 'animate-pulse' : ''} />
                    {triggeringAuditAcm ? 'Đang gửi lệnh...' : '🤖 Chạy Đồng Bộ Backup ACM'}
                  </button>
                </div>

                {/* Audit results */}
                {auditAcmResults && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Tổng số file: {auditAcmResults.summary.total}
                      </span>
                      <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        Đầy đủ (Hôm nay): {auditAcmResults.summary.ok}
                      </span>
                      {auditAcmResults.summary.missing > 0 && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Thiếu: {auditAcmResults.summary.missing}
                        </span>
                      )}
                      {auditAcmResults.summary.outdated > 0 && (
                        <span style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          Cũ (Không phải hôm nay): {auditAcmResults.summary.outdated}
                        </span>
                      )}
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                        <thead>
                          <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tên File</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '120px' }}>Trạng Thái</th>
                            <th style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)', width: '160px' }}>Thời Gian Thay Đổi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditAcmResults.files.map((file: any) => (
                            <tr key={file.key} style={{ borderBottom: '1px solid var(--border-color)', background: 'transparent' }}>
                              <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{file.filename}</td>
                              <td style={{ padding: '10px 12px' }}>
                                {file.status === 'OK' ? (
                                  <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>OK</span>
                                ) : file.status === 'OUTDATED' ? (
                                  <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>FILE CŨ</span>
                                ) : (
                                  <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600 }}>THIẾU</span>
                                )}
                              </td>
                              <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                                {file.lastModified ? new Date(file.lastModified).toLocaleString('vi-VN') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Chạy Excel Macro Thống Kê Số Lot Box */}
              <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <BarChart2 size={20} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Chạy Excel Macro Thống Kê Số Lot</h3>
                </div>

                <form onSubmit={handleSaveMacroLotConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Đường dẫn file Excel Macro (.xlsm)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={macroLotPath}
                      onChange={(e) => setMacroLotPath(e.target.value)}
                      placeholder="C:\...\Macro thong ke so lot giao dich có ACM.xlsm"
                      style={{ padding: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Đường dẫn script Python (.py)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={macroLotScriptPath}
                      onChange={(e) => setMacroLotScriptPath(e.target.value)}
                      placeholder="C:\POC\scripts\run_lot_macro.py"
                      style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Hệ thống sẽ tự động tìm trong thư mục project nếu để trống.
                    </span>
                  </div>

                  {/* <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Đường dẫn executable Python (Mặc định: python)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={pythonExe}
                      onChange={(e) => setPythonExe(e.target.value)}
                      placeholder="python hoặc C:\...\python.exe"
                      style={{ padding: '12px' }}
                    />
                  </div> */}

                  {/* <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Thư mục đích lưu trữ báo cáo (Mặc định: M:\Quanlygiaodich\Tai lieu hoat dong)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={targetRoot}
                      onChange={(e) => setTargetRoot(e.target.value)}
                      placeholder="M:\Quanlygiaodich\Tai lieu hoat dong"
                      style={{ padding: '12px' }}
                    />
                  </div> */}

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={savingMacroConfig}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px 20px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <Save size={14} /> {savingMacroConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Macro'}
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Chạy thống kê số lot giao dịch</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Sau khi hoàn thành tải backup MS Futures, CQG Futures và ACM, chạy macro để tự động tổng hợp số lot giao dịch LME, Options, ACM và tạo báo cáo xuất ra Excel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerLotMacro}
                    disabled={triggeringMacroLot}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                  >
                    <Play size={16} className={triggeringMacroLot ? 'animate-pulse' : ''} />
                    {triggeringMacroLot ? 'Đang chạy Macro...' : '🤖 Chạy Excel Macro'}
                  </button>
                </div>
              </div>

              {/* Chạy Excel Macro Thống Kê Giá Trị Box */}
              <div className="glass-panel" style={{ padding: '24px', marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <BarChart2 size={20} color="var(--color-primary)" />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>Chạy Excel Macro Thống Kê Giá Trị</h3>
                </div>

                <form onSubmit={handleSaveMacroValueConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Đường dẫn file Excel Macro (.xlsm)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={macroValuePath}
                      onChange={(e) => setMacroValuePath(e.target.value)}
                      placeholder="C:\...\Macro thong ke gia tri giao dich có ACM.xlsm"
                      style={{ padding: '12px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Đường dẫn script Python (.py)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={macroValueScriptPath}
                      onChange={(e) => setMacroValueScriptPath(e.target.value)}
                      placeholder="C:\POC\scripts\run_value_macro.py"
                      style={{ padding: '12px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Hệ thống sẽ tự động tìm trong thư mục project nếu để trống.
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="submit"
                      disabled={savingValueMacroConfig}
                      className="btn btn-secondary"
                      style={{
                        padding: '10px 20px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      <Save size={14} /> {savingValueMacroConfig ? 'Đang lưu...' : 'Lưu Cấu Hình Macro'}
                    </button>
                  </div>
                </form>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '8px', border: '1px dashed rgba(255, 255, 255, 0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Chạy thống kê giá trị giao dịch</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Sau khi hoàn thành tải backup MS Futures, CQG Futures, ACM và chạy số lot, chạy macro giá trị để tự động tổng hợp giá trị giao dịch LME, Spread, Options, ACM và tạo báo cáo xuất ra Excel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleTriggerValueMacro}
                    disabled={triggeringMacroValue}
                    className="btn btn-primary"
                    style={{ padding: '12px 24px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
                  >
                    <Play size={16} className={triggeringMacroValue ? 'animate-pulse' : ''} />
                    {triggeringMacroValue ? 'Đang chạy Macro...' : '🤖 Chạy Excel Macro'}
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Job Queue Logs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Jobs list */}
              <div className="glass-panel" style={{ padding: '24px', maxHeight: '550px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Activity size={18} color="var(--color-accent)" /> Hàng Đợi RPA Ngầm
                  </h3>
                  <button
                    onClick={fetchJobs}
                    disabled={loadingJobs}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    <RefreshCw size={14} className={loadingJobs ? 'animate-spin' : ''} />
                  </button>
                </div>

                {jobs.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                    Chưa có background job nào được tạo.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {jobs.map((job) => {
                      const isSelected = selectedJobId === job._id;
                      return (
                        <div
                          key={job._id}
                          onClick={() => setSelectedJobId(isSelected ? null : job._id)}
                          style={{
                            padding: '12px',
                            border: isSelected ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {job.jobType === 'RPA_DOWNLOAD_REPORTS'
                                ? 'Tải Báo Cáo RPA'
                                : job.jobType === 'FILE_AUDIT_MS'
                                  ? 'Kiểm Tra & Tải Bổ Sung MS'
                                  : job.jobType === 'FILE_AUDIT_CQG'
                                    ? 'Kiểm Tra & Ghép File CQG'
                                    : job.jobType === 'FILE_AUDIT_ACM'
                                      ? '🤖 Tải Báo Cáo Tự Doanh ACM'
                                      : job.jobType === 'RUN_LOT_MACRO'
                                        ? '📊 Chạy Excel Macro Số Lot'
                                        : job.jobType === 'RUN_VALUE_MACRO'
                                          ? '📊 Chạy Excel Macro Giá Trị'
                                          : job.jobType}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {job.status === 'COMPLETED' && job.jobType === 'RPA_DOWNLOAD_REPORTS' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDownloadZip(job._id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '2px',
                                  }}
                                  title="Tải file ZIP"
                                >
                                  <Download size={14} />
                                </button>
                              )}
                              {getStatusBadge(job.status)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            <span>Thử: {job.attempts}/{job.maxAttempts}</span>
                            <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Job Console Details */}
              {selectedJob && (
                <div className="glass-panel" style={{ padding: '20px', background: '#0a0b10', border: '1px solid #1a1e2a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Terminal size={16} color="#10b981" />
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#10b981', fontFamily: 'monospace' }}>
                      Console Output - Job {selectedJob._id.substring(0, 8)}
                    </h4>
                  </div>
                  <div
                    style={{
                      maxHeight: '200px',
                      overflowY: 'auto',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      color: '#a7f3d0',
                      background: 'rgba(0,0,0,0.4)',
                      padding: '12px',
                      borderRadius: '6px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    {selectedJob.logs.map((logLine, idx) => (
                      <div key={idx}>{logLine}</div>
                    ))}
                  </div>
                  {selectedJob.status === 'AWAITING_CAPTCHA' && (
                    <div
                      style={{
                        marginTop: '16px',
                        padding: '16px',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid #f59e0b',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      <div style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
                        ⚠️ Yêu cầu giải Captcha thủ công
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        {selectedJob.payload?.captchaImage ? (
                          <div style={{ background: '#fff', padding: '6px', borderRadius: '4px', display: 'inline-block' }}>
                            <img
                              src={selectedJob.payload.captchaImage}
                              alt="Captcha Code"
                              style={{ height: '40px', display: 'block' }}
                            />
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Không tìm thấy ảnh Captcha</span>
                        )}
                        <input
                          type="text"
                          placeholder="Nhập mã Captcha..."
                          value={captchaText}
                          onChange={(e) => setCaptchaText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSubmitCaptcha();
                            }
                          }}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #f59e0b',
                            background: '#1a1d24',
                            color: '#fff',
                            fontSize: '0.85rem',
                          }}
                          disabled={submittingCaptcha}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmitCaptcha}
                        disabled={submittingCaptcha || !captchaText}
                        className="btn"
                        style={{
                          background: '#f59e0b',
                          color: '#000',
                          fontWeight: 700,
                          padding: '10px',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {submittingCaptcha ? 'Đang gửi...' : 'Gửi mã xác nhận'}
                      </button>
                    </div>
                  )}
                  {selectedJob.status === 'COMPLETED' && selectedJob.jobType === 'RPA_DOWNLOAD_REPORTS' && (
                    <button
                      type="button"
                      onClick={() => handleDownloadZip(selectedJob._id)}
                      className="btn btn-primary"
                      style={{
                        marginTop: '16px',
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        fontWeight: 600,
                      }}
                    >
                      <Download size={18} /> Tải File ZIP Báo Cáo
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ============================================================ */}
        {/* GTT CHECK SECTION */}
        {/* ============================================================ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <BarChart2 size={24} color="var(--color-accent)" /> Kiểm Tra Giá Thanh Toán (GTT)
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  So sánh GTT giữa M-System (market.csv) và CQG Desktop Quote Spreadsheet tự động.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleLoadGttReport}
                  disabled={loadingGttReport}
                  className="btn btn-secondary"
                  style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <RefreshCw size={14} className={loadingGttReport ? 'animate-spin' : ''} />
                  Tải Báo Cáo Gần Nhất
                </button>
                <button
                  type="button"
                  onClick={handleRunGttCheck}
                  disabled={runningGttCheck || uploadingGtt || uploadingMarketCsv}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}
                >
                  <Play size={16} />
                  {runningGttCheck ? 'Đang chạy pipeline...' : 'Chạy Kiểm Tra GTT'}
                </button>
              </div>
            </div>

            {/* File Upload Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '24px' }}>
              {/* GTT.xlsx Upload */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <FileText size={18} color="var(--color-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>File GTT.xlsx</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Upload file GTT.xlsx đã được tạo bằng VBA macro (chứa danh sách hợp đồng mở cần kiểm tra).
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    id="gtt-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setGttFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleUploadGtt}
                    disabled={!gttFile || uploadingGtt}
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    <Upload size={14} />
                    {uploadingGtt ? 'Đang tải...' : 'Upload'}
                  </button>
                </div>
              </div>

              {/* market.csv Upload */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Download size={18} color="var(--color-accent)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>File market.csv (Bảng Giá MS)</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Upload thủ công market.csv đã export từ M-System, HOẶC bật tùy chọn để bot tự động tải.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <input
                      type="checkbox"
                      checked={downloadMarketCsv}
                      onChange={(e) => setDownloadMarketCsv(e.target.checked)}
                    />
                    Bot tự động tải market.csv từ M-System
                  </label>
                  {!downloadMarketCsv && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <input
                        id="market-csv-input"
                        type="file"
                        accept=".csv"
                        onChange={(e) => setMarketCsvFile(e.target.files?.[0] || null)}
                        style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={handleUploadMarketCsv}
                        disabled={!marketCsvFile || uploadingMarketCsv}
                        className="btn btn-secondary"
                        style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                      >
                        <Upload size={14} />
                        {uploadingMarketCsv ? 'Đang tải...' : 'Upload'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* hang_hoa.xlsx Upload */}
              <div className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Settings size={18} color="var(--color-primary)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>File Hàng Hóa (hang_hoa.xlsx)</h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Upload file hang_hoa.xlsx để lấy Bước giá tối thiểu của từng mặt hàng phục vụ đối chiếu.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    id="commodity-file-input"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setCommodityFile(e.target.files?.[0] || null)}
                    style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleUploadCommodity}
                    disabled={!commodityFile || uploadingCommodity}
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                  >
                    <Upload size={14} />
                    {uploadingCommodity ? 'Đang tải...' : 'Upload'}
                  </button>
                </div>
              </div>
            </div>

            {/* GTT Report Table */}
            {gttReport && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart2 size={18} color="var(--color-accent)" />
                    Kết Quả Đối Chiếu GTT
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
                      {new Date(gttReport.runAt).toLocaleString('vi-VN')}
                    </span>
                  </h3>
                  {/* Summary badges */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                      ✅ Khớp: {gttReport.matched}
                    </span>
                    {gttReport.diffCount > 0 && (
                      <>
                        <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          ⚠️ Lệch ít: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                        </span>
                        <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                          🚨 Lệch nhiều: {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length}
                        </span>
                      </>
                    )}
                    {(gttReport.msOnlyCount + gttReport.cqgOnlyCount) > 0 && (
                      <span style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ❓ Thiếu: {gttReport.msOnlyCount + gttReport.cqgOnlyCount}
                      </span>
                    )}
                  </div>
                </div>

                {gttReport.diffCount > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Có {gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length} hợp đồng bị lệch nhiều. Bạn có thể tải file sửa giá hoặc click đẩy trực tiếp lên M-System:
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={handlePushToMSystem}
                        disabled={pushingToMs}
                        className="btn"
                        style={{
                          padding: '6px 12.5px',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          whiteSpace: 'nowrap',
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          color: '#60a5fa',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          fontWeight: 600,
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                      >
                        <Upload size={12} /> {pushingToMs ? 'Đang đẩy...' : 'Đẩy Giá Lên M-System'}
                      </button>
                      <button
                        onClick={() => handleDownloadCorrection('settlement')}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        <Download size={12} /> Tải File Sửa GTT
                      </button>
                      <button
                        onClick={() => handleDownloadCorrection('first_match')}
                        className="btn btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                      >
                        <Download size={12} /> Tải File Sửa Giá Khớp Đầu
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview CSV block */}
                {gttCsvContent && (
                  <div style={{ marginBottom: '20px', background: 'rgba(30, 41, 59, 0.4)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="var(--color-accent)" />
                        Nội Dung File Sửa Giá M-System (CSV Xem Trước - Chỉ Hợp Đồng Lệch Nhiều)
                      </span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(gttCsvContent);
                          toast.success('Đã copy nội dung CSV vào clipboard!');
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.7rem', height: 'auto', display: 'flex', alignItems: 'center' }}
                      >
                        Copy CSV
                      </button>
                    </div>
                    <pre style={{ margin: 0, padding: '12px', background: '#0f172a', borderRadius: '6px', color: '#38bdf8', fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '180px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      {gttCsvContent}
                    </pre>
                  </div>
                )}

                {/* GTT Filter Tabs */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setGttFilter('ALL')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'ALL' ? 'var(--color-accent)' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'ALL' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Tất cả ({gttReport.rows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGttFilter('DIFF')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'DIFF' ? '#6b7280' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'DIFF' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Tổng Chênh lệch ({gttReport.rows.filter((r: any) => r.status === 'DIFF').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGttFilter('DIFF_MINOR')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'DIFF_MINOR' ? '#d97706' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'DIFF_MINOR' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    ⚠️ Lệch ít ({gttReport.rows.filter((r: any) => r.status === 'DIFF' && (r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGttFilter('DIFF_MAJOR')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'DIFF_MAJOR' ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'DIFF_MAJOR' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    🚨 Lệch nhiều ({gttReport.rows.filter((r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGttFilter('MATCH')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'MATCH' ? '#10b981' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'MATCH' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Khớp ({gttReport.rows.filter((r: any) => r.status === 'MATCH').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGttFilter('MISSING')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: gttFilter === 'MISSING' ? '#3b82f6' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'MISSING' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Thiếu/Chỉ có 1 bên ({gttReport.rows.filter((r: any) => r.status === 'MS_ONLY' || r.status === 'CQG_ONLY').length})
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Mã HĐ</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>GTT M-System</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>GTT CQG</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Bước giá</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>Chênh lệch</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>Trạng thái</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gttReport.rows
                        .filter((row: any) => {
                          if (gttFilter === 'ALL') return true;
                          if (gttFilter === 'DIFF') return row.status === 'DIFF';
                          if (gttFilter === 'DIFF_MINOR') return row.status === 'DIFF' && (row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05)));
                          if (gttFilter === 'DIFF_MAJOR') return row.status === 'DIFF' && !(row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05)));
                          if (gttFilter === 'MATCH') return row.status === 'MATCH';
                          if (gttFilter === 'MISSING') return row.status === 'MS_ONLY' || row.status === 'CQG_ONLY';
                          return true;
                        })
                        .map((row: any, idx: number) => {
                          const isMinorDiff = row.isMinorDiff ?? (row.diff !== null && Math.abs(row.diff) <= (row.tickSize ?? 0.05));
                          return (
                            <tr
                              key={row.symbol}
                              style={{
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                              }}
                            >
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{row.symbol}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                {row.gttMs !== null ? row.gttMs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                                {row.gttCqg !== null ? row.gttCqg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                {row.tickSize !== undefined && row.tickSize !== null ? row.tickSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 5 }) : '0.05'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: row.diff && Math.abs(row.diff) > 0 ? (isMinorDiff ? '#d97706' : '#ef4444') : 'var(--text-muted)' }}>
                                {row.diff !== null ? row.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {row.status === 'MATCH' && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>✅ Khớp</span>}
                                {row.status === 'DIFF' && (
                                  <span style={{ color: isMinorDiff ? '#d97706' : '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                                    {isMinorDiff ? '⚠️ Lệch ít' : '🚨 Lệch nhiều'}
                                  </span>
                                )}
                                {row.status === 'MS_ONLY' && <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>📋 Chỉ có MS</span>}
                                {row.status === 'CQG_ONLY' && <span style={{ color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>📊 Chỉ có CQG</span>}
                                {row.status === 'NO_PRICE' && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>❓ Không có giá</span>}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                                {row.status === 'MATCH' && <span style={{ color: 'var(--text-muted)' }}>Khớp hoàn toàn.</span>}
                                {row.status === 'DIFF' && (
                                  isMinorDiff ? (
                                    <span style={{ color: '#d97706', fontWeight: 500 }}>Chênh lệch bằng hoặc nhỏ hơn bước giá tối thiểu ({row.tickSize ?? 0.05}). Lệch nhỏ (làm tròn).</span>
                                  ) : (
                                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Chênh lệch lớn hơn bước giá tối thiểu ({row.tickSize ?? 0.05}). Lệch nhiều! Cần sửa.</span>
                                  )
                                )}
                                {row.status === 'MS_ONLY' && <span style={{ color: '#f59e0b', fontWeight: 500 }}>Chỉ có trên MS. Kiểm tra xem hợp đồng đã hoạt động bên CQG chưa.</span>}
                                {row.status === 'CQG_ONLY' && <span style={{ color: '#3b82f6' }}>Chỉ có trên CQG. Kiểm tra cấu hình hợp đồng trên MS.</span>}
                                {row.status === 'NO_PRICE' && <span style={{ color: 'var(--text-muted)' }}>Không tìm thấy giá ở cả 2 bên.</span>}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* RECONCILIATION TEST SECTION */}
        {/* ============================================================ */}
        <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <FileText size={24} color="var(--color-primary)" /> Kiểm Thử Đối Chiếu Dữ Liệu
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Chọn bộ file mẫu có sẵn hoặc để Bot tự tải từ M-System, rồi chạy đối chiếu KLGD / EOD / CQG.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                id="btn-load-recon-dates"
                type="button"
                onClick={handleLoadReconSampleDates}
                className="btn btn-secondary"
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
              >
                <RefreshCw size={14} /> Tải danh sách ngày
              </button>
              <button
                id="btn-run-auto-recon"
                type="button"
                onClick={handleRunAutoRecon}
                disabled={reconAutoRunning}
                className="btn btn-primary"
                style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', opacity: reconAutoRunning ? 0.7 : 1 }}
              >
                <Activity size={14} className={reconAutoRunning ? 'animate-spin' : ''} />
                {reconAutoRunning ? 'Bot đang tải file...' : '🤖 Bot tự động tải & Đối chiếu'}
              </button>
            </div>
          </div>

          {/* Tab selector */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button
              type="button"
              onClick={() => { setReconTab('sample'); setReconResult(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: reconTab === 'sample' ? 'var(--color-primary)' : 'transparent',
                color: reconTab === 'sample' ? '#fff' : 'var(--text-secondary)',
                border: reconTab === 'sample' ? 'none' : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📂 Chạy từ file mẫu local
            </button>
            <button
              type="button"
              onClick={() => { setReconTab('upload'); setReconResult(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: reconTab === 'upload' ? 'var(--color-primary)' : 'transparent',
                color: reconTab === 'upload' ? '#fff' : 'var(--text-secondary)',
                border: reconTab === 'upload' ? 'none' : '1px solid var(--border-color)',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              📤 Upload file thủ công
            </button>
          </div>

          {reconTab === 'sample' ? (
            /* Sample date selector */
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-primary)' }}>📂 Chọn bộ file mẫu từ BackupMS</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1', minWidth: '200px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Ngày giao dịch</label>
                  <select
                    id="recon-sample-date-select"
                    value={reconSelectedPath}
                    onChange={e => setReconSelectedPath(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  >
                    {reconSampleDates.length === 0 && <option value="">-- Nhấn "Tải danh sách ngày" trước --</option>}
                    {reconSampleDates.map((d, i) => (
                      <option key={i} value={d.samplePath}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>Tỷ giá USD/VND</label>
                  <input
                    id="recon-usd-rate"
                    type="number"
                    value={reconUsdRate}
                    onChange={e => setReconUsdRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>
                <button
                  id="btn-run-recon-test"
                  type="button"
                  onClick={handleRunReconTest}
                  disabled={reconRunning || !reconSelectedPath}
                  className="btn btn-primary"
                  style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem', opacity: reconRunning || !reconSelectedPath ? 0.6 : 1 }}
                >
                  <Play size={14} className={reconRunning ? 'animate-spin' : ''} />
                  {reconRunning ? 'Đang chạy...' : 'Chạy kiểm thử'}
                </button>
              </div>
              {reconSelectedPath && (
                <p style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  📁 {reconSelectedPath}
                </p>
              )}
            </div>
          ) : (
            /* Manual Uploader Card */
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>📤 Tải lên các file báo cáo cần đối chiếu</h3>
                <div style={{ width: '140px' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 600 }}>Tỷ giá USD/VND</label>
                  <input
                    id="recon-usd-rate-upload"
                    type="number"
                    value={reconUsdRate}
                    onChange={e => setReconUsdRate(Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* 1. KLGD Files */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} color="var(--color-primary)" /> Đối chiếu Khớp lệnh (KLGD)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File DSGD.xlsx (MS) <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, dsgd: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File FR1.xlsx (CQG)</label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr1: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File FR2.xlsx (CQG)</label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, fr2: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File TTM.xlsx (Optional)</label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, ttm: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                  </div>
                </div>

                {/* 2. EOD & CQG Files */}
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} color="var(--color-primary)" /> Đối chiếu Số dư EOD & CQG
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File QLTKGD.xlsx (MS Balance) <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, qltkgd: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File TTTT.xlsx (MS Closed Positions) <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, tttt: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File eod.csv (MS EOD Report) <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="file" accept=".csv" onChange={e => setManualFiles(prev => ({ ...prev, eod: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>File Accounts_Balances.xlsx (CQG Balance)</label>
                      <input type="file" accept=".xlsx,.xls" onChange={e => setManualFiles(prev => ({ ...prev, accountsBalances: e.target.files?.[0] || null }))} style={{ fontSize: '0.75rem', width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setManualFiles({})}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Xóa hết file đã chọn
                </button>
                <button
                  type="button"
                  onClick={handleRunUploadReconTest}
                  disabled={reconUploadRunning}
                  className="btn btn-primary"
                  style={{ padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', opacity: reconUploadRunning ? 0.6 : 1 }}
                >
                  <Upload size={14} className={reconUploadRunning ? 'animate-spin' : ''} />
                  {reconUploadRunning ? 'Đang chạy đối chiếu...' : 'Chạy đối chiếu file đã chọn'}
                </button>
              </div>
            </div>
          )}

          {/* Results display */}
          {reconResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KLGD Result */}
              {reconResult.errors?.klgd ? (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: 700, marginBottom: '8px' }}>❌ KLGD - Lỗi: {reconResult.errors.klgd}</h4>
                </div>
              ) : reconResult.results?.klgd ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>📊 Đối chiếu Khớp lệnh (KLGD)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                    {klgdStats.map((stat, i) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{stat.label}</p>
                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: stat.color, fontFamily: 'monospace' }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* EOD Result */}
              {reconResult.errors?.eod ? (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: 700 }}>❌ EOD - Lỗi: {reconResult.errors.eod}</h4>
                </div>
              ) : reconResult.results?.eod ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>💰 Đối chiếu Số dư EOD</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    {eodStats.map((stat, i) => (
                      <div key={i} style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>{stat.label}</p>
                        <p style={{ fontSize: '1.2rem', fontWeight: 700, color: stat.color, fontFamily: 'monospace' }}>{stat.value}</p>
                      </div>
                    ))}
                  </div>
                  {reconResult.results.eod.negativeIMRAcc?.length > 0 && (
                    <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(239,68,68,0.08)', borderRadius: '8px', borderLeft: '3px solid #ef4444' }}>
                      <p style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>🚨 TK âm ký quỹ: {reconResult.results.eod.negativeIMRAcc.join(', ')}</p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* CQG Result */}
              {reconResult.errors?.cqg ? (
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ color: '#ef4444', fontWeight: 700 }}>❌ CQG - Lỗi: {reconResult.errors.cqg}</h4>
                </div>
              ) : reconResult.results?.cqg !== undefined ? (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>🔵 Đối chiếu Số dư CQG</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>TK lệch số dư CQG (&gt;100 USD)</p>
                      <p style={{ fontSize: '1.2rem', fontWeight: 700, color: reconResult.results.cqg.length > 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>{reconResult.results.cqg.length}</p>
                    </div>
                  </div>
                  {reconResult.results.cqg.length > 0 && (
                    <div style={{ marginTop: '12px', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-secondary)' }}>
                            {['Mã TKGD', 'MS (USD)', 'CQG (USD)', 'Chênh lệch', 'Trạng thái'].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 600 }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reconResult.results.cqg.slice(0, 20).map((r: any, i: number) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, fontFamily: 'monospace' }}>{r.maTKGD}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.calculatedBalance?.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>{r.cqgBalance?.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: '#ef4444' }}>{r.differ?.toFixed(2)}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.75rem' }}>
                                {!r.inCQG ? '⚠️ Không có trên CQG' : !r.inMS ? '⚠️ Không có trên MS' : '⚠️ Lệch'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reconResult.results.cqg.length > 20 && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>... và {reconResult.results.cqg.length - 20} tài khoản khác</p>}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Auto reconciliation result */}
          {reconAutoResult && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' }}>
              <h4 style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>🤖 Kết quả Bot Tự Động</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '12px', fontFamily: 'monospace' }}>📁 {reconAutoResult.downloadDir}</p>
              {reconAutoResult.results?.eod && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TK lệch EOD</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: reconAutoResult.results.eod.mismatchedEOD?.length > 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>{reconAutoResult.results.eod.mismatchedEOD?.length ?? 0}</p>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>TK âm ký quỹ</p>
                    <p style={{ fontSize: '1.2rem', fontWeight: 700, color: reconAutoResult.results.eod.negativeIMRAcc?.length > 0 ? '#ef4444' : '#10b981', fontFamily: 'monospace' }}>{reconAutoResult.results.eod.negativeIMRAcc?.length ?? 0}</p>
                  </div>
                </div>
              )}
              {Object.entries(reconAutoResult.errors || {}).map(([k, v]) => (
                <p key={k} style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '8px' }}>❌ {k}: {String(v)}</p>
              ))}
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}
