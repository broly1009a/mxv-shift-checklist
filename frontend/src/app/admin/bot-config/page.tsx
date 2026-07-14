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
} from 'lucide-react';

import ConnectionSettings from './components/ConnectionSettings';
import GttChecker from './components/GttChecker';
import ReconciliationPanel from './components/ReconciliationPanel';
import BackupAuditor from './components/BackupAuditor';
import JobQueuePanel from './components/JobQueuePanel';
import ReportDownloader from './components/ReportDownloader';

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

type TabType = 'credentials' | 'gtt' | 'reconciliation' | 'backup' | 'downloader' | 'queue';

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

  // Redirect if user is not ADMIN
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [user, router]);

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

  // Fetch jobs once on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh jobs list every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobs();
    }, 8000);
    return () => clearInterval(timer);
  }, [fetchJobs]);

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
    { id: 'credentials', label: 'Tài khoản & Lập lịch', icon: Key },
    { id: 'gtt', label: 'Kiểm tra GTT', icon: FileText },
    { id: 'reconciliation', label: 'Kiểm thử Đối chiếu', icon: Database },
    { id: 'backup', label: 'Backup & Macro', icon: Clock },
    { id: 'downloader', label: 'Yêu cầu Tải báo cáo', icon: Download },
    { id: 'queue', label: 'Hàng đợi & Logs', icon: Terminal, count: jobs.filter(j => j.status === 'PROCESSING' || j.status === 'AWAITING_CAPTCHA').length },
  ];

  if (!token) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-zinc-500 text-xs">Đang tải token xác thực...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col gap-6 animate-fade-in text-zinc-300 min-h-screen">
        {/* Page Header */}
        <div className="flex justify-between items-center flex-wrap gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <Cpu className="text-emerald-500 animate-pulse" size={24} />
              Cấu hình hệ thống RPA & Robot
            </h1>
            <p className="text-xs text-zinc-400 mt-1">
              Quản lý tài khoản kết nối các hệ thống, theo dõi tiến trình chạy và cấu hình tự động hóa MXV.
            </p>
          </div>
        </div>

        {/* Tab Buttons bar */}
        <div className="flex gap-2 border-b border-zinc-800 pb-1 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-lg transition relative ${
                  isActive
                    ? 'bg-zinc-800/80 text-white border-b-2 border-emerald-500'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/30'
                }`}
              >
                <Icon size={14} className={isActive ? 'text-emerald-400' : 'text-zinc-500'} />
                <span>{tab.label}</span>
                {!!tab.count && tab.count > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-black font-bold animate-pulse">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content rendering */}
        <div className="flex-1 mt-2">
          {activeTab === 'credentials' && (
            <ConnectionSettings token={token} apiBaseUrl={API_BASE_URL} fetchJobs={fetchJobs} />
          )}

          {activeTab === 'gtt' && (
            <GttChecker token={token} apiBaseUrl={API_BASE_URL} />
          )}

          {activeTab === 'reconciliation' && (
            <ReconciliationPanel token={token} apiBaseUrl={API_BASE_URL} />
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
