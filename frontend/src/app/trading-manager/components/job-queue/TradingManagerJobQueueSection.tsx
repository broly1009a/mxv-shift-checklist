'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  RefreshCw,
  Download,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Square,
  Search,
  Filter,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  UserCheck,
  Code2,
  Copy,
  FileText,
  ArrowRight,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

// Danh sách các tác vụ thuộc nghiệp vụ Trading Manager
export const TRADING_JOB_TYPES = [
  'CHECK_KLGD',
  'CHECK_PRE_EOD',
  'CHECK_CQG_SYNC',
  'SCAN_NEGATIVE_MARGIN',
  'DOWNLOAD_CCP_REPORT',
  'DOWNLOAD_CE_REPORT',
  'CHECK_EOD_CCP',
  'RUN_LOT_MACRO',
  'RUN_VALUE_MACRO',
  'RUN_MACRO',
];

export interface BotJob {
  _id: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CAPTCHA' | 'CANCELLED' | 'ABORTED';
  attempts: number;
  maxAttempts: number;
  logs?: string[];
  payload?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface TradingManagerJobQueueSectionProps {
  token: string | null;
  selectedDate?: string;
  onActiveCountChange?: (count: number) => void;
}

export default function TradingManagerJobQueueSection({
  token,
  selectedDate,
  onActiveCountChange,
}: TradingManagerJobQueueSectionProps) {
  const [jobs, setJobs] = useState<BotJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedJobDetail, setSelectedJobDetail] = useState<BotJob | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'PENDING'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [filterTodayOnly, setFilterTodayOnly] = useState<boolean>(false);

  // Chế độ xem: 'USER' (Người dùng / Nghiệp vụ) vs 'TECHNICAL' (Kỹ thuật / Console)
  const [viewMode, setViewMode] = useState<'USER' | 'TECHNICAL'>('USER');

  // Expand Payload/Result state
  const [showPayloadDetails, setShowPayloadDetails] = useState<boolean>(false);

  // Cancel Job Modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [jobToCancel, setJobToCancel] = useState<BotJob | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingJob, setCancellingJob] = useState(false);

  // Captcha Handling
  const [captchaText, setCaptchaText] = useState('');
  const [submittingCaptcha, setSubmittingCaptcha] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Fetch jobs list (chỉ lấy các tác vụ thuộc Trading Manager)
  const fetchJobs = useCallback(async (silent: boolean = false) => {
    if (!token) return;
    if (!silent) setLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=${TRADING_JOB_TYPES.join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const rawData: BotJob[] = await res.json();
        const data = Array.isArray(rawData) ? rawData.filter((j) => TRADING_JOB_TYPES.includes(j.jobType)) : [];
        setJobs(data);

        // Update active jobs count to parent
        const activeCount = data.filter(
          (j) => j.status === 'PROCESSING' || j.status === 'AWAITING_CAPTCHA' || j.status === 'PENDING',
        ).length;
        if (onActiveCountChange) {
          onActiveCountChange(activeCount);
        }
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách tác vụ:', err);
    } finally {
      if (!silent) setLoadingJobs(false);
    }
  }, [token, onActiveCountChange]);

  // Fetch job detail (logs & payload)
  const fetchJobDetail = useCallback(async (jobId: string, silent: boolean = false) => {
    if (!token || !jobId) return;
    if (!silent) setLoadingLogs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: BotJob = await res.json();
        setSelectedJobDetail(data);
      }
    } catch (err) {
      console.error('Lỗi khi tải chi tiết tác vụ:', err);
    } finally {
      if (!silent) setLoadingLogs(false);
    }
  }, [token]);

  // Polling danh sách tác vụ ngầm mỗi 4 giây
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(() => {
      fetchJobs(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // Khi chọn 1 job, tải chi tiết ngay lập tức và polling logs mỗi 3s nếu job đang chạy
  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }

    fetchJobDetail(selectedJobId);

    const currentJob = jobs.find((j) => j._id === selectedJobId);
    let interval: NodeJS.Timeout | null = null;
    if (currentJob && (currentJob.status === 'PROCESSING' || currentJob.status === 'PENDING' || currentJob.status === 'AWAITING_CAPTCHA')) {
      interval = setInterval(() => {
        fetchJobDetail(selectedJobId, true);
      }, 2500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedJobId, jobs, fetchJobDetail]);

  // Auto scroll terminal to bottom when new logs arrive
  useEffect(() => {
    if (selectedJobDetail?.logs && selectedJobDetail.logs.length > 0) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedJobDetail?.logs]);

  // Xử lý dừng tác vụ
  const handleCancelJob = async () => {
    if (!jobToCancel || !token) return;
    try {
      setCancellingJob(true);
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobToCancel._id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason || 'Dừng thủ công bởi người vận hành qua Trading Manager' }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể hủy tác vụ');
      }

      toast.success(`Đã dừng tác vụ ${jobToCancel._id.substring(0, 8)} thành công!`);
      setShowCancelModal(false);
      setJobToCancel(null);
      setCancelReason('');
      await fetchJobs();
      if (selectedJobId === jobToCancel._id) {
        await fetchJobDetail(jobToCancel._id);
      }
    } catch (err: any) {
      toast.error(`Lỗi khi dừng tác vụ: ${err.message}`);
    } finally {
      setCancellingJob(false);
    }
  };

  // Xử lý giải Captcha thủ công
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
      toast.success('Gửi mã captcha thành công! Robot đang tiếp tục xử lý...', { id: toastId });
      setCaptchaText('');
      await fetchJobs();
      await fetchJobDetail(selectedJobId);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi gửi captcha', { id: toastId });
    } finally {
      setSubmittingCaptcha(false);
    }
  };

  // Tải file nén ZIP báo cáo
  const handleDownloadZip = async (jobId: string) => {
    if (!token) return;
    const toastId = toast.loading('Đang nén và tải file báo cáo...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs/${jobId}/download-zip`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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
      toast.error(err.message || 'Lỗi tải file nén', { id: toastId });
    }
  };

  // Sao chép toàn bộ nhật ký
  const handleCopyLogs = () => {
    if (!selectedJobDetail?.logs || selectedJobDetail.logs.length === 0) {
      toast.error('Chưa có nhật ký nào để sao chép');
      return;
    }
    navigator.clipboard.writeText(selectedJobDetail.logs.join('\n'));
    toast.success('Đã sao chép nhật ký vào bộ nhớ tạm!');
  };

  // Tải tệp nhật ký (.txt)
  const handleDownloadLogFile = () => {
    if (!selectedJobDetail?.logs || selectedJobDetail.logs.length === 0) {
      toast.error('Chưa có nhật ký nào để tải về');
      return;
    }
    const blob = new Blob([selectedJobDetail.logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Log_MXV_${selectedJobDetail._id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast.success('Đã tải tệp nhật ký (.txt) thành công!');
  };

  // Label nghiệp vụ chuẩn hóa tiếng Việt
  const getJobLabel = (jobType: string) => {
    switch (jobType) {
      case 'CHECK_KLGD':
        return 'Đối Chiếu Khớp Lệnh (Trong Phiên)';
      case 'CHECK_PRE_EOD':
        return 'Đối Chiếu Pre-EOD (Cuối Ngày)';
      case 'CHECK_CQG_SYNC':
        return 'Đồng Bộ & Ghép File CQG';
      case 'DOWNLOAD_CCP_REPORT':
        return 'Tải Báo Cáo CoreCCP (VNCLEAR)';
      case 'CHECK_EOD_CCP':
        return 'Đối Chiếu EOD CoreCCP';
      case 'RUN_LOT_MACRO':
        return 'Chạy Excel Macro Số Lot';
      case 'RUN_VALUE_MACRO':
        return 'Chạy Excel Macro Giá Trị';
      case 'SCAN_NEGATIVE_MARGIN':
        return 'Quét Ký Quỹ Âm MM';
      case 'RPA_DOWNLOAD_REPORTS':
        return 'Tải Báo Cáo M-System (RPA)';
      case 'FILE_AUDIT_MS':
        return 'Kiểm Tra & Tải Bổ Sung MS';
      case 'FILE_AUDIT_CQG':
        return 'Kiểm Tra & Ghép File CQG';
      case 'FILE_AUDIT_ACM':
        return 'Tải Báo Cáo Tự Doanh ACM';
      default:
        return jobType;
    }
  };

  // Status Badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle2 size={11} /> Thành công
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <XCircle size={11} /> Thất bại
          </span>
        );
      case 'CANCELLED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <XCircle size={11} /> Đã hủy
          </span>
        );
      case 'ABORTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <AlertTriangle size={11} /> Tạm dừng
          </span>
        );
      case 'PROCESSING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)' }} className="animate-pulse">
            <RefreshCw size={11} className="animate-spin" /> Đang chạy
          </span>
        );
      case 'AWAITING_CAPTCHA':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }} className="animate-pulse">
            <Activity size={11} /> Chờ Captcha
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 700, backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
            <Clock size={11} /> Đang chờ
          </span>
        );
    }
  };

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    // Chỉ hiển thị tác vụ thuộc Trading Manager
    if (!TRADING_JOB_TYPES.includes(job.jobType)) return false;

    // Status Filter
    if (statusFilter === 'PROCESSING' && job.status !== 'PROCESSING' && job.status !== 'AWAITING_CAPTCHA') return false;
    if (statusFilter === 'COMPLETED' && job.status !== 'COMPLETED') return false;
    if (statusFilter === 'FAILED' && job.status !== 'FAILED' && job.status !== 'CANCELLED' && job.status !== 'ABORTED') return false;
    if (statusFilter === 'PENDING' && job.status !== 'PENDING') return false;

    // Search Keyword
    if (searchKeyword.trim()) {
      const kw = searchKeyword.toLowerCase();
      const matchType = job.jobType.toLowerCase().includes(kw);
      const matchLabel = getJobLabel(job.jobType).toLowerCase().includes(kw);
      const matchId = job._id.toLowerCase().includes(kw);
      if (!matchType && !matchLabel && !matchId) return false;
    }

    // Filter Today Only
    if (filterTodayOnly && selectedDate) {
      const jobDate = new Date(job.createdAt).toISOString().split('T')[0];
      if (jobDate !== selectedDate) return false;
    }

    return true;
  });

  const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;

  // Counter stats (chỉ tính các job thuộc Trading Manager)
  const tradingJobs = jobs.filter((j) => TRADING_JOB_TYPES.includes(j.jobType));
  const processingCount = tradingJobs.filter((j) => j.status === 'PROCESSING' || j.status === 'AWAITING_CAPTCHA').length;
  const completedCount = tradingJobs.filter((j) => j.status === 'COMPLETED').length;
  const failedCount = tradingJobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELLED' || j.status === 'ABORTED').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="animate-fade-in">
      {/* TOOLBAR FILTER */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Nút lọc Status */}
          {[
            { id: 'ALL', label: `Tất cả (${jobs.length})` },
            { id: 'PROCESSING', label: `Đang chạy (${processingCount})`, color: '#0284c7' },
            { id: 'COMPLETED', label: `Thành công (${completedCount})`, color: '#10b981' },
            { id: 'FAILED', label: `Lỗi / Hủy (${failedCount})`, color: '#ef4444' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id as any)}
              className="btn"
              style={{
                fontSize: '0.75rem',
                padding: '5px 12px',
                height: '30px',
                fontWeight: statusFilter === item.id ? 800 : 500,
                borderRadius: '6px',
                border: statusFilter === item.id ? '1px solid var(--text-primary)' : '1px solid var(--border-color)',
                backgroundColor: statusFilter === item.id ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                color: item.color || 'var(--text-primary)',
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Checkbox lọc ngày hiện tại */}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)', marginLeft: '8px' }}>
            <input
              type="checkbox"
              checked={filterTodayOnly}
              onChange={(e) => setFilterTodayOnly(e.target.checked)}
            />
            <span>Chỉ ngày làm việc ({selectedDate || 'Hôm nay'})</span>
          </label>
        </div>

        {/* BỘ CHUYỂN ĐỔI CHẾ ĐỘ XEM: NGƯỜI DÙNG vs KỸ THUẬT */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-input, #0f172a)',
            border: '1px solid var(--border-color)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.1)',
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('USER')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: viewMode === 'USER' ? 800 : 500,
              border: 'none',
              backgroundColor: viewMode === 'USER' ? '#10b981' : 'transparent',
              color: viewMode === 'USER' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <UserCheck size={14} />
            <span>Chế độ Người dùng</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('TECHNICAL')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '5px 14px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: viewMode === 'TECHNICAL' ? 800 : 500,
              border: 'none',
              backgroundColor: viewMode === 'TECHNICAL' ? '#0284c7' : 'transparent',
              color: viewMode === 'TECHNICAL' ? '#ffffff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Terminal size={14} />
            <span>Chế độ Kỹ thuật (Console)</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Ô tìm kiếm */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Tìm theo mã job, tên..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '30px', height: '32px', fontSize: '0.75rem' }}
            />
          </div>

          {/* Nút Làm Mới */}
          <button
            type="button"
            onClick={() => fetchJobs()}
            disabled={loadingJobs}
            className="btn btn-secondary"
            style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={12} className={loadingJobs ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>

          {/* Nút Xem Toàn Bộ Hàng Đợi Hệ Thống (admin/bot-config) */}
          <a
            href="/admin/bot-config"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            title="Mở Cấu hình Bot để quản lý toàn bộ tác vụ hệ thống (Checklist ca trực, RPA Crawler, GTT...)"
            style={{
              height: '32px',
              padding: '0 12px',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              color: 'var(--text-secondary)',
            }}
          >
            <ExternalLink size={12} />
            <span>Toàn bộ Bot & Hàng đợi</span>
          </a>
        </div>
      </div>

      {/* 2-COLUMN LAYOUT: TERMINAL LOGS (LEFT) & JOBS QUEUE (RIGHT) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '16px', alignItems: 'start' }}>
        {/* LEFT COLUMN: EITHER BUSINESS VIEW (USER) OR TECHNICAL CONSOLE (TECH) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {viewMode === 'USER' ? (
            /* ========================================================== */
            /* GIAO DIỆN CHẾ ĐỘ NGƯỜI DÙNG (BUSINESS / OPERATIONS VIEW)   */
            /* ========================================================== */
            selectedJob ? (
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Header Tác Vụ */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={20} color="#10b981" />
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {getJobLabel(selectedJob.jobType)}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      <Clock size={12} />
                      <span>Khởi tạo: {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}</span>
                      <span>•</span>
                      <span>Lần thử: {selectedJob.attempts}/{selectedJob.maxAttempts}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getStatusBadge(selectedJob.status)}

                    {/* Nút Dừng Tác Vụ nếu đang chạy */}
                    {['PENDING', 'PROCESSING', 'AWAITING_CAPTCHA'].includes(selectedJob.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setJobToCancel(selectedJob);
                          setShowCancelModal(true);
                        }}
                        disabled={cancellingJob}
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Square size={12} fill="#ef4444" />
                        <span>{selectedJob.status === 'PENDING' ? 'Hủy Khỏi Hàng Đợi' : 'Dừng Tác Vụ'}</span>
                      </button>
                    )}

                    {/* Nút Tải ZIP nếu hoàn thành */}
                    {selectedJob.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadZip(selectedJob._id)}
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 14px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={14} />
                        <span>Tải Báo Cáo (ZIP)</span>
                      </button>
                    )}

                    {/* Nút Chuyển nhanh sang Console */}
                    <button
                      type="button"
                      onClick={() => setViewMode('TECHNICAL')}
                      className="btn btn-secondary"
                      style={{ height: '32px', padding: '0 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      title="Chuyển sang chế độ kỹ thuật để xem toàn bộ log thực thi"
                    >
                      <Code2 size={13} />
                      <span>Xem Log Kỹ Thuật</span>
                    </button>
                  </div>
                </div>

                {/* Khung Giải Captcha nếu cần */}
                {selectedJob.status === 'AWAITING_CAPTCHA' && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={16} />
                      Robot yêu cầu giải mã Captcha thủ công để tiếp tục
                    </span>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage) ? (
                        <div style={{ backgroundColor: '#ffffff', padding: '6px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                          <img
                            src={selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage}
                            alt="Captcha Code"
                            style={{ height: '42px', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa nhận diện được ảnh Captcha</span>
                      )}
                      <div style={{ flex: 1, minWidth: '220px', display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Nhập mã Captcha tại đây..."
                          value={captchaText}
                          onChange={(e) => setCaptchaText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitCaptcha();
                          }}
                          className="form-input"
                          style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                          disabled={submittingCaptcha}
                        />
                        <button
                          type="button"
                          onClick={handleSubmitCaptcha}
                          disabled={submittingCaptcha || !captchaText}
                          className="btn btn-primary"
                          style={{ fontSize: '0.8rem', fontWeight: 700, padding: '8px 18px', flexShrink: 0 }}
                        >
                          {submittingCaptcha ? 'Đang gửi...' : 'Gửi mã'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Thẻ Tóm Tắt Nghiệp Vụ (Business Result Summary) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Trạng thái thực thi</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedJob.status === 'COMPLETED' ? 'Hoàn thành tốt' : selectedJob.status === 'PROCESSING' ? 'Đang tự động xử lý' : selectedJob.status === 'FAILED' ? 'Cần kiểm tra lại' : selectedJob.status}
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Thời điểm hoàn tất</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedJob.updatedAt ? new Date(selectedJob.updatedAt).toLocaleTimeString('vi-VN') : 'Đang xử lý'}
                    </div>
                  </div>

                  <div style={{ padding: '14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Gói tệp đính kèm</div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                      {selectedJob.status === 'COMPLETED' ? 'Đã sẵn sàng tải ZIP' : 'Chưa có gói tệp'}
                    </div>
                  </div>
                </div>

                {/* Tiến Trình Thực Hiện Nghiệp Vụ (4 Bước) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Tiến trình thực hiện nghiệp vụ:
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[
                      { step: 1, name: 'Khởi tạo tác vụ & nạp cấu hình hệ thống', done: true },
                      { step: 2, name: 'Kết nối nguồn dữ liệu (M-System / CQG / CoreCCP)', done: selectedJob.status !== 'PENDING' },
                      { step: 3, name: 'Thu thập, tải tệp hoặc đối chiếu số liệu', done: selectedJob.status === 'COMPLETED' || selectedJob.status === 'FAILED' },
                      { step: 4, name: 'Đóng gói tệp kết xuất & cập nhật trạng thái ca trực', done: selectedJob.status === 'COMPLETED' },
                    ].map((st) => (
                      <div
                        key={st.step}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          backgroundColor: st.done ? 'rgba(16, 185, 129, 0.06)' : 'var(--bg-input)',
                          border: st.done ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-color)',
                        }}
                      >
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: st.done ? '#10b981' : 'var(--border-color)',
                            color: st.done ? '#ffffff' : 'var(--text-muted)',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                          }}
                        >
                          {st.done ? <CheckCircle2 size={14} /> : st.step}
                        </div>
                        <span style={{ fontSize: '0.78rem', fontWeight: st.done ? 700 : 500, color: st.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {st.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tóm tắt log gần nhất dạng thẻ tin nhắn */}
                {selectedJobDetail?.logs && selectedJobDetail.logs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        Thông báo gần nhất từ robot:
                      </span>
                      <button
                        type="button"
                        onClick={() => setViewMode('TECHNICAL')}
                        style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: '#0284c7', cursor: 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Mở toàn bộ log ({selectedJobDetail.logs.length} dòng)</span>
                        <ArrowRight size={12} />
                      </button>
                    </div>
                    <div style={{ padding: '12px 16px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {selectedJobDetail.logs.slice(-3).map((l, i) => (
                        <div key={i} style={{ marginBottom: i < 2 ? '4px' : 0 }}>
                          • {l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* DASHBOARD TỔNG QUAN KHI CHƯA CHỌN TÁC VỤ (CHẾ ĐỘ NGƯỜI DÙNG) */
              <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UserCheck size={18} color="#10b981" />
                      Tổng Quan Vận Hành Robot Ca Trực
                    </h3>
                    <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Theo dõi trạng thái các robot đối chiếu, tải tệp M-System, CQG và CoreCCP trong ca làm việc.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewMode('TECHNICAL')}
                    className="btn btn-secondary"
                    style={{ height: '30px', padding: '0 12px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Terminal size={13} />
                    <span>Màn hình Console Kỹ thuật</span>
                  </button>
                </div>

                {/* 4 KPI CARDS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tổng tác vụ</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>{jobs.length}</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>Thành công</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#10b981', marginTop: '4px' }}>{completedCount}</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 700 }}>Đang xử lý</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', marginTop: '4px' }}>{processingCount}</div>
                  </div>
                  <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 700 }}>Lỗi / Đã hủy</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444', marginTop: '4px' }}>{failedCount}</div>
                  </div>
                </div>

                {/* Hướng Dẫn Vận Hành Ca Trực */}
                <div style={{ padding: '16px', borderRadius: '10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Info size={14} color="#0284c7" />
                    Lưu ý vận hành cho chuyên viên ca trực:
                  </span>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li>Nhấp chuột vào một tác vụ ở <strong>cột Hàng đợi bên phải</strong> để xem chi tiết tiến trình hoặc bấm <strong>"Tải ZIP"</strong> để lấy file báo cáo.</li>
                    <li>Tác vụ đối chiếu khớp lệnh (KLGD) tự động kiểm tra định kỳ 1 giờ/lần và cập nhật trực tiếp tại Tab 1.</li>
                    <li>Khi bot tải báo cáo M-System yêu cầu giải Captcha, hệ thống sẽ tự động bật thông báo và khung nhập mã ngay trên màn hình.</li>
                    <li>Chuyên viên có thể bấm <strong>"Chế độ Kỹ thuật (Console)"</strong> ở thanh công cụ phía trên để theo dõi chi tiết dòng lệnh realtime hoặc sao chép log gửi đội ngũ IT.</li>
                  </ul>
                </div>
              </div>
            )
          ) : (
            /* ========================================================== */
            /* GIAO DIỆN CHẾ ĐỘ KỸ THUẬT (TECHNICAL / TERMINAL CONSOLE)   */
            /* ========================================================== */
            selectedJob ? (
              <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Header Tác vụ Kỹ thuật */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Terminal size={18} color="#10b981" />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {getJobLabel(selectedJob.jobType)}
                      </h4>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '4px' }}>
                      <span>ID: {selectedJob._id}</span>
                      <span>•</span>
                      <span>Bắt đầu: {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}</span>
                      <span>•</span>
                      <span>Lần thử: {selectedJob.attempts}/{selectedJob.maxAttempts}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getStatusBadge(selectedJob.status)}

                    {/* Nút Sao chép Log */}
                    <button
                      type="button"
                      onClick={handleCopyLogs}
                      className="btn btn-secondary"
                      style={{ height: '28px', padding: '0 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Sao chép toàn bộ nội dung log"
                    >
                      <Copy size={12} />
                      <span>Sao chép Log</span>
                    </button>

                    {/* Nút Tải file Log .txt */}
                    <button
                      type="button"
                      onClick={handleDownloadLogFile}
                      className="btn btn-secondary"
                      style={{ height: '28px', padding: '0 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Tải tệp nhật ký dạng .txt"
                    >
                      <FileText size={12} />
                      <span>Tải .txt</span>
                    </button>

                    {/* Nút Dừng Tác Vụ */}
                    {['PENDING', 'PROCESSING', 'AWAITING_CAPTCHA'].includes(selectedJob.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setJobToCancel(selectedJob);
                          setShowCancelModal(true);
                        }}
                        disabled={cancellingJob}
                        className="btn"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 12px',
                          height: '28px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                          border: '1px solid #ef4444',
                          borderRadius: '6px',
                          cursor: 'pointer',
                        }}
                        title="Dừng khẩn cấp hoặc hủy tác vụ này"
                      >
                        <Square size={10} fill="#ef4444" />
                        <span>{selectedJob.status === 'PENDING' ? 'Hủy Khỏi Hàng Đợi' : 'Dừng Tác Vụ'}</span>
                      </button>
                    )}

                    {/* Nút Tải ZIP nếu có */}
                    {selectedJob.status === 'COMPLETED' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadZip(selectedJob._id)}
                        className="btn btn-secondary"
                        style={{ height: '28px', padding: '0 10px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        title="Tải gói file kết xuất nén ZIP"
                      >
                        <Download size={12} />
                        <span>Tải ZIP</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Giải Captcha Nếu Cần */}
                {selectedJob.status === 'AWAITING_CAPTCHA' && (
                  <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '14px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} />
                      Robot yêu cầu giải mã Captcha thủ công
                    </span>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                      {(selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage) ? (
                        <div style={{ backgroundColor: '#ffffff', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                          <img
                            src={selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage}
                            alt="Captcha Code"
                            style={{ height: '36px', objectFit: 'contain', display: 'block' }}
                          />
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa nhận diện được ảnh Captcha</span>
                      )}
                      <div style={{ flex: 1, minWidth: '200px', display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Nhập mã Captcha..."
                          value={captchaText}
                          onChange={(e) => setCaptchaText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSubmitCaptcha();
                          }}
                          className="form-input"
                          style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                          disabled={submittingCaptcha}
                        />
                        <button
                          type="button"
                          onClick={handleSubmitCaptcha}
                          disabled={submittingCaptcha || !captchaText}
                          className="btn btn-primary"
                          style={{ fontSize: '0.75rem', fontWeight: 700, padding: '6px 14px', flexShrink: 0 }}
                        >
                          {submittingCaptcha ? 'Đang gửi...' : 'Gửi mã'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* LIVE TERMINAL CONSOLE */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    padding: '16px 18px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: '#34d399',
                    lineHeight: 1.6,
                    maxHeight: '440px',
                    minHeight: '260px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  {loadingLogs && !selectedJobDetail ? (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>
                      <RefreshCw size={18} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                      Đang tải nhật ký tác vụ...
                    </div>
                  ) : selectedJobDetail?.logs && selectedJobDetail.logs.length > 0 ? (
                    <>
                      {selectedJobDetail.logs.map((line, idx) => (
                        <div key={idx} style={{ wordBreak: 'break-word' }}>
                          {line}
                        </div>
                      ))}
                      <div ref={terminalEndRef} />
                    </>
                  ) : (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: '32px 0' }}>
                      Chưa có nhật ký (log) nào được ghi lại cho tác vụ này.
                    </div>
                  )}
                </div>

                {/* TOGGLE XEM THÔNG SỐ CHI TIẾT (PAYLOAD / RESULT) */}
                {selectedJobDetail?.payload && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setShowPayloadDetails(!showPayloadDetails)}
                      style={{
                        background: 'none',
                        border: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {showPayloadDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>Thông số kỹ thuật & Kết quả đầu ra (Payload / Result)</span>
                    </button>

                    {showPayloadDetails && (
                      <pre
                        style={{
                          backgroundColor: 'var(--bg-input)',
                          padding: '12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          fontSize: '0.7rem',
                          fontFamily: 'monospace',
                          color: 'var(--text-secondary)',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(selectedJobDetail.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* CHƯA CHỌN TÁC VỤ (CHẾ ĐỘ KỸ THUẬT) */
              <div
                className="glass-panel"
                style={{
                  padding: '60px 24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  minHeight: '380px',
                }}
              >
                <Terminal size={40} color="var(--text-muted)" />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
                  Chưa chọn tác vụ nào
                </p>
                <p style={{ fontSize: '0.75rem', margin: 0, maxWidth: '380px' }}>
                  Vui lòng nhấp chuột chọn một tác vụ từ danh sách hàng đợi ở cột bên phải để xem console output trực tiếp, nhật ký thực thi và các tùy chọn điều khiển kỹ thuật.
                </p>
              </div>
            )
          )}
        </div>

        {/* RIGHT COLUMN: JOB QUEUE LIST */}
        <div
          className="glass-panel"
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            maxHeight: '680px',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={14} color="#0284c7" />
              Hàng đợi tác vụ ({filteredJobs.length})
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Tự động cập nhật 4s
            </span>
          </div>

          {filteredJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Không có tác vụ nào thỏa mãn bộ lọc.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredJobs.map((job) => {
                const isSelected = selectedJobId === job._id;
                return (
                  <div
                    key={job._id}
                    onClick={() => setSelectedJobId(isSelected ? null : job._id)}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px',
                      border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: isSelected ? '#10b981' : 'var(--text-primary)', lineHeight: 1.3 }}>
                        {getJobLabel(job.jobType)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {getStatusBadge(job.status)}
                        {['PENDING', 'PROCESSING', 'AWAITING_CAPTCHA'].includes(job.status) && (
                          <button
                            type="button"
                            title="Dừng tác vụ này"
                            onClick={(e) => {
                              e.stopPropagation();
                              setJobToCancel(job);
                              setShowCancelModal(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '2px',
                              display: 'inline-flex',
                              alignItems: 'center',
                            }}
                          >
                            <Square size={12} fill="#ef4444" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      <span>Lần thử: {job.attempts}/{job.maxAttempts}</span>
                      <span>{new Date(job.createdAt).toLocaleTimeString('vi-VN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* MODAL XÁC NHẬN DỪNG TÁC VỤ */}
      {showCancelModal && jobToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '460px',
              backgroundColor: 'var(--bg-card, #1e293b)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0,
                }}
              >
                <Square size={18} fill="#ef4444" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Xác nhận dừng tác vụ
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  ID: {jobToCancel._id}
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Bạn có chắc chắn muốn dừng tác vụ <strong>{getJobLabel(jobToCancel.jobType)}</strong>? Tiến trình đang chạy trên máy chủ sẽ bị chấm dứt an toàn.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Lý do dừng tác vụ (tùy chọn):
              </label>
              <textarea
                rows={2}
                placeholder="Ví dụ: Tác vụ bị kẹt phiên, hủy để chạy lại..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.75rem', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  setJobToCancel(null);
                  setCancelReason('');
                }}
                disabled={cancellingJob}
                className="btn btn-secondary"
                style={{ fontSize: '0.75rem', padding: '8px 16px' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={cancellingJob}
                className="btn"
                style={{
                  fontSize: '0.75rem',
                  padding: '8px 16px',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 700,
                }}
              >
                {cancellingJob ? 'Đang dừng...' : 'Xác nhận dừng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
