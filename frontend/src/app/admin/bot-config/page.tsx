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
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
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

  // UI state
  const [showMsystemPassword, setShowMsystemPassword] = useState(false);
  const [showMsystemPin, setShowMsystemPin] = useState(false);
  const [showCqgPassword, setShowCqgPassword] = useState(false);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingCqgConnection, setTestingCqgConnection] = useState(false);

  // GTT Check state
  const [gttFile, setGttFile] = useState<File | null>(null);
  const [marketCsvFile, setMarketCsvFile] = useState<File | null>(null);
  const [commodityFile, setCommodityFile] = useState<File | null>(null);
  const [uploadingGtt, setUploadingGtt] = useState(false);
  const [uploadingMarketCsv, setUploadingMarketCsv] = useState(false);
  const [uploadingCommodity, setUploadingCommodity] = useState(false);
  const [runningGttCheck, setRunningGttCheck] = useState(false);
  const [downloadMarketCsv, setDownloadMarketCsv] = useState(false);
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
              disabled={testingConnection || testingCqgConnection || loadingConfig}
              className="btn btn-secondary"
              style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Play size={16} /> Test Đăng Nhập M-System
            </button>
            <button
              type="button"
              onClick={handleTestCqgConnection}
              disabled={testingConnection || testingCqgConnection || loadingConfig}
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
          </div>
        </div>

        {loadingConfig ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Đang tải thông tin cấu hình...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-8 items-start">
            
            {/* Left: Forms */}
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
                              {job.jobType === 'RPA_DOWNLOAD_REPORTS' ? 'Tải Báo Cáo RPA' : job.jobType}
                            </span>
                            {getStatusBadge(job.status)}
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
                {gttReport.diffCount > 0 && (() => {
                  const majorDiffRows = gttReport.rows.filter(
                    (r: any) => r.status === 'DIFF' && !(r.isMinorDiff ?? (r.diff !== null && Math.abs(r.diff) <= (r.tickSize ?? 0.05)))
                  );
                  if (majorDiffRows.length === 0) return null;
                  
                  const csvHeaders = 'contractCode,settlePrice';
                  const csvRows = majorDiffRows.map((r: any) => `${r.symbol},${r.gttCqg}`);
                  const csvContent = [csvHeaders, ...csvRows].join('\n');
                  
                  return (
                    <div style={{ marginBottom: '20px', background: 'rgba(30, 41, 59, 0.4)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <FileText size={14} color="var(--color-accent)" />
                          Nội Dung File Sửa Giá M-System (CSV Xem Trước - Chỉ Hợp Đồng Lệch Nhiều)
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(csvContent);
                            toast.success('Đã copy nội dung CSV vào clipboard!');
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.7rem', height: 'auto', display: 'flex', alignItems: 'center' }}
                        >
                          Copy CSV
                        </button>
                      </div>
                      <pre style={{ margin: 0, padding: '12px', background: '#0f172a', borderRadius: '6px', color: '#38bdf8', fontSize: '0.8rem', fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '180px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        {csvContent}
                      </pre>
                    </div>
                  );
                })()}

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
                    {[
                      { label: 'Tổng MS', value: `${reconResult.results.klgd.totals?.totalDSGD ?? '—'} lot`, color: '#60a5fa' },
                      { label: 'Tổng CQG', value: `${reconResult.results.klgd.totals?.totalFR ?? '—'} lot`, color: '#60a5fa' },
                      { label: 'Chênh lệch', value: `${reconResult.results.klgd.totals?.differ ?? '—'} lot`, color: reconResult.results.klgd.totals?.differ > 0 ? '#ef4444' : '#10b981' },
                      { label: 'GD lệch chi tiết', value: `${reconResult.results.klgd.mismatchedTrades?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTrades?.length > 0 ? '#ef4444' : '#10b981' },
                      { label: 'TK lệch TTM', value: `${reconResult.results.klgd.mismatchedTTM?.length ?? 0}`, color: reconResult.results.klgd.mismatchedTTM?.length > 0 ? '#f59e0b' : '#10b981' },
                    ].map((stat, i) => (
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
                    {[
                      { label: 'TK lệch số dư (≥1,000đ)', value: `${reconResult.results.eod.mismatchedEOD?.length ?? 0}`, color: reconResult.results.eod.mismatchedEOD?.length > 0 ? '#ef4444' : '#10b981' },
                      { label: 'TK âm ký quỹ', value: `${reconResult.results.eod.negativeIMRAcc?.length ?? 0}`, color: reconResult.results.eod.negativeIMRAcc?.length > 0 ? '#ef4444' : '#10b981' },
                    ].map((stat, i) => (
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
