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
  const [uploadingGtt, setUploadingGtt] = useState(false);
  const [uploadingMarketCsv, setUploadingMarketCsv] = useState(false);
  const [runningGttCheck, setRunningGttCheck] = useState(false);
  const [downloadMarketCsv, setDownloadMarketCsv] = useState(false);
  const [gttReport, setGttReport] = useState<any>(null);
  const [loadingGttReport, setLoadingGttReport] = useState(false);
  const [gttFilter, setGttFilter] = useState<'ALL' | 'DIFF' | 'MATCH' | 'MISSING'>('ALL');

  // Queue state
  const [jobs, setJobs] = useState<BotJobs[]>([]);
  const [selectedJob, setSelectedJob] = useState<BotJobs | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

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
        // Refresh selected job reference if it is currently displayed
        if (selectedJob) {
          const updated = data.find((j: BotJobs) => j._id === selectedJob._id);
          if (updated) setSelectedJob(updated);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  }, [token, selectedJob]);

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
                    {jobs.map((job) => (
                      <div
                        key={job._id}
                        onClick={() => setSelectedJob(selectedJob?._id === job._id ? null : job)}
                        style={{
                          padding: '12px',
                          border: selectedJob?._id === job._id ? '1px solid var(--color-accent)' : '1px solid var(--border-color)',
                          borderRadius: '8px',
                          background: selectedJob?._id === job._id ? 'rgba(59, 130, 246, 0.03)' : 'transparent',
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
                    ))}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
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
                      <span style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ⚠️ Chênh lệch: {gttReport.diffCount}
                      </span>
                    )}
                    {(gttReport.msOnlyCount + gttReport.cqgOnlyCount) > 0 && (
                      <span style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                        ❓ Thiếu: {gttReport.msOnlyCount + gttReport.cqgOnlyCount}
                      </span>
                    )}
                  </div>
                </div>

                {gttReport.diffCount > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(239, 68, 68, 0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.1)', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Có {gttReport.diffCount} hợp đồng bị lệch giá. Bạn có thể tải file sửa giá để đẩy vào M-System:
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
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
                      background: gttFilter === 'DIFF' ? '#ef4444' : 'rgba(255, 255, 255, 0.05)',
                      color: gttFilter === 'DIFF' ? '#fff' : 'var(--text-secondary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Chênh lệch ({gttReport.rows.filter((r: any) => r.status === 'DIFF').length})
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
                      background: gttFilter === 'MISSING' ? '#f59e0b' : 'rgba(255, 255, 255, 0.05)',
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
                          if (gttFilter === 'MATCH') return row.status === 'MATCH';
                          if (gttFilter === 'MISSING') return row.status === 'MS_ONLY' || row.status === 'CQG_ONLY';
                          return true;
                        })
                        .map((row: any, idx: number) => {
                          const isMinorDiff = row.diff !== null && Math.abs(row.diff) <= 0.05;
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
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: row.diff && Math.abs(row.diff) > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                {row.diff !== null ? row.diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : '—'}
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                {row.status === 'MATCH' && <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>✅ Khớp</span>}
                                {row.status === 'DIFF' && (
                                  <span style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600 }}>
                                    ⚠️ {isMinorDiff ? 'Lệch nhỏ' : 'Lệch nhiều'}
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
                                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Lệch nhỏ (làm tròn). Kiểm tra kỹ trước khi sửa.</span>
                                  ) : (
                                    <span style={{ color: '#ef4444', fontWeight: 500 }}>Lệch lớn! Cần tải file sửa giá để đẩy lại M-System.</span>
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

      </div>
    </ProtectedRoute>
  );
}
