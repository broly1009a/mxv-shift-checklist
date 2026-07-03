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

  const [cqgUrl, setCqgUrl] = useState('https://desktop.cqg.com/cqg/desktop/logon?ref=forced');
  const [cqgUsername, setCqgUsername] = useState('');
  const [cqgPassword, setCqgPassword] = useState('');

  // UI state
  const [showMsystemPassword, setShowMsystemPassword] = useState(false);
  const [showMsystemPin, setShowMsystemPin] = useState(false);
  const [showCqgPassword, setShowCqgPassword] = useState(false);

  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

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
          setCqgUrl(data.cqg.url || 'https://desktop.cqg.com/cqg/desktop/logon?ref=forced');
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
          <button
            onClick={handleTestConnection}
            disabled={testingConnection || loadingConfig}
            className="btn btn-secondary"
            style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Play size={16} /> Test Đăng Nhập M-System
          </button>
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
                        placeholder="https://desktop.cqg.com/cqg/desktop/logon?ref=forced"
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
      </div>
    </ProtectedRoute>
  );
}
