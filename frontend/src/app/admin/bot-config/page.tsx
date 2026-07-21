'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  Cpu,
  Key,
  Database,
  FileText,
  Clock,
  Terminal,
  Download,
  FileSpreadsheet,
  TrendingUp,
  Sliders,
} from 'lucide-react';

import ConnectionSettings from './components/ConnectionSettings';
import SystemSchedulerSettings from './components/SystemSchedulerSettings';
import GttChecker from './components/GttChecker';
import ReconciliationPanel from './components/ReconciliationPanel';
import BackupAuditor from './components/BackupAuditor';
import JobQueuePanel from './components/JobQueuePanel';
import ReportDownloader from './components/ReportDownloader';
import LotStatisticsPanel from './components/LotStatisticsPanel';
import ValueStatisticsPanel from './components/ValueStatisticsPanel';

interface BotJob {
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

type TabType = 'credentials' | 'scheduler' | 'gtt' | 'reconciliation' | 'lot-statistics' | 'value-statistics' | 'backup' | 'downloader' | 'queue';

export default function AdminBotConfigPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Active tab state
  const [activeTab, setActiveTab] = useState<TabType>('credentials');

  // Background Job States
  const [jobs, setJobs] = useState<BotJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [trackedJobs, setTrackedJobs] = useState<string[]>([]);
  const [captchaText, setCaptchaText] = useState('');
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);
  const [agentStatus, setAgentStatus] = useState<{
    online: boolean;
    hostname?: string;
    platform?: string;
    version?: string;
  } | null>(null);

  // Redirect if user is not ADMIN
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Fetch agent status
  const fetchAgentStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/agent-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAgentStatus(data);
      }
    } catch (err) {
      console.error('Error fetching agent status:', err);
    }
  }, [token]);

  // Fetch background jobs list
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
      console.error('Error fetching bot jobs:', err);
    } finally {
      setLoadingJobs(false);
    }
  }, [token]);

  // Handle manual captcha submit
  const handleSubmitCaptcha = async () => {
    if (!token || !selectedJobId || !captchaText) return;
    setSubmittingCaptcha(true);
    const toastId = toast.loading('Đang gửi mã Captcha...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${selectedJobId}/submit-captcha`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ captchaText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gửi captcha thất bại');
      toast.success('Gửi mã captcha thành công! Vui lòng chờ bot tiếp tục xử lý.', { id: toastId });
      setCaptchaText('');
      fetchJobs();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi captcha', { id: toastId });
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  // Download reports zip
  const handleDownloadZip = async (jobId: string) => {
    if (!token) return;
    const toastId = toast.loading('Đang khởi tạo và nén file báo cáo...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}/download-zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Không thể tải xuống file nén');
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
      toast.success('Tải xuống file ZIP thành công!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải zip báo cáo', { id: toastId });
    }
  };

  // Fetch data once on mount
  useEffect(() => {
    fetchJobs();
    fetchAgentStatus();
  }, [fetchJobs, fetchAgentStatus]);

  // Auto-refresh list and status every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobs();
      fetchAgentStatus();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchJobs, fetchAgentStatus]);

  // Auto-download zipped reports for completed tracked jobs
  useEffect(() => {
    if (jobs.length === 0 || trackedJobs.length === 0) return;

    const completedJobs = jobs.filter(
      (job) => trackedJobs.includes(job._id) && job.status === 'COMPLETED'
    );

    if (completedJobs.length > 0) {
      completedJobs.forEach((job) => {
        toast.success(`Job ${job._id.substring(0, 8)} đã hoàn tất! Bắt đầu tải file ZIP...`);
        handleDownloadZip(job._id);
      });
      setTrackedJobs((prev) => prev.filter((id) => !completedJobs.some((cj) => cj._id === id)));
    }

    const terminatedJobs = jobs.filter(
      (job) =>
        trackedJobs.includes(job._id) &&
        (job.status === 'FAILED' || job.status === ('CANCELLED' as any))
    );
    if (terminatedJobs.length > 0) {
      setTrackedJobs((prev) => prev.filter((id) => !terminatedJobs.some((tj) => tj._id === id)));
    }
  }, [jobs, trackedJobs]);

  // Tab configurations
  const TABS = [
    { id: 'credentials', label: 'Tài khoản kết nối', icon: Key },
    { id: 'scheduler', label: 'Tham số & Lập lịch', icon: Sliders },
    { id: 'gtt', label: 'Kiểm tra GTT', icon: FileText },
    { id: 'reconciliation', label: 'Kiểm thử Đối chiếu', icon: Database },
    { id: 'lot-statistics', label: 'Thống kê số lot', icon: FileSpreadsheet },
    { id: 'value-statistics', label: 'Thống kê giá trị', icon: TrendingUp },
    { id: 'backup', label: 'Backup & Macro', icon: Clock },
    { id: 'downloader', label: 'Yêu cầu Tải báo cáo', icon: Download },
    { id: 'queue', label: 'Hàng đợi & Logs', icon: Terminal, count: jobs.filter(j => j.status === 'PROCESSING' || j.status === 'AWAITING_CAPTCHA').length },
  ];

  if (!token) {
    return (
      <ProtectedRoute>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '0.8rem' }}>Đang tải token xác thực...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '100vh', color: 'var(--text-primary)' }} className="animate-fade-in">
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Cpu color="#10b981" className="animate-pulse" size={26} />
              Cấu hình hệ thống RPA & Robot
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Quản lý tài khoản kết nối các hệ thống, theo dõi tiến trình chạy và cấu hình tự động hóa MXV.
            </p>
          </div>

          {/* Agent Status Badge */}
          {agentStatus ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '8px 16px',
              borderRadius: '12px',
              border: agentStatus.online ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(244, 63, 94, 0.4)',
              backgroundColor: agentStatus.online ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
              color: agentStatus.online ? '#34d399' : '#fb7185',
            }}>
              <div style={{ position: 'relative', width: '10px', height: '10px' }}>
                <span style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  backgroundColor: agentStatus.online ? '#10b981' : '#f43f5e',
                }}></span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Agent: {agentStatus.online ? 'Online' : 'Offline'}
                </span>
                {agentStatus.online && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {agentStatus.hostname} ({agentStatus.platform})
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-muted)',
            }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'var(--text-muted)' }} className="animate-spin" />
              <span style={{ fontSize: '0.7rem', fontWeight: 700 }}>Đang kiểm tra Agent...</span>
            </div>
          )}
        </div>

        {/* Tab Buttons bar */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', flexWrap: 'wrap' }}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: '8px 8px 0 0',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #10b981' : '2px solid transparent',
                  color: isActive ? '#10b981' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={15} color={isActive ? '#10b981' : 'var(--text-muted)'} />
                <span>{tab.label}</span>
                {!!tab.count && tab.count > 0 && (
                  <span style={{
                    marginLeft: '4px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    fontSize: '0.65rem',
                    backgroundColor: '#f59e0b',
                    color: '#000000',
                    fontWeight: 800,
                  }} className="animate-pulse">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content rendering */}
        <div style={{ flex: 1, marginTop: '8px' }}>
          {activeTab === 'credentials' && (
            <ConnectionSettings token={token} apiBaseUrl={API_BASE_URL} fetchJobs={fetchJobs} />
          )}

          {activeTab === 'scheduler' && (
            <SystemSchedulerSettings token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'gtt' && (
            <GttChecker token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'reconciliation' && (
            <ReconciliationPanel token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'lot-statistics' && (
            <LotStatisticsPanel token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'value-statistics' && (
            <ValueStatisticsPanel token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'backup' && (
            <BackupAuditor
              token={token}
              apiBaseUrl={API_BASE_URL}
              fetchJobs={fetchJobs}
              setTrackedJobs={setTrackedJobs}
            />
          )}

          {activeTab === 'downloader' && (
            <ReportDownloader
              token={token}
              apiBaseUrl={API_BASE_URL}
              fetchJobs={fetchJobs}
              setTrackedJobs={setTrackedJobs}
            />
          )}

          {activeTab === 'queue' && (
            <JobQueuePanel
              token={token}
              apiBaseUrl={API_BASE_URL}
              jobs={jobs}
              loadingJobs={loadingJobs}
              fetchJobs={fetchJobs}
              selectedJobId={selectedJobId}
              setSelectedJobId={setSelectedJobId}
              captchaText={captchaText}
              setCaptchaText={setCaptchaText}
              submittingCaptcha={submittingCaptcha}
              handleSubmitCaptcha={handleSubmitCaptcha}
              handleDownloadZip={handleDownloadZip}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
