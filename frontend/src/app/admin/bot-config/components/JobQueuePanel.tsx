'use client';

import React from 'react';
import {
  Activity,
  RefreshCw,
  Download,
  Terminal,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Square,
} from 'lucide-react';

interface BotJob {
  _id: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CAPTCHA' | 'CANCELLED' | 'ABORTED';
  attempts: number;
  maxAttempts: number;
  logs: string[];
  payload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface JobQueuePanelProps {
  token: string;
  apiBaseUrl: string;
  jobs: BotJob[];
  loadingJobs: boolean;
  fetchJobs: () => Promise<void>;
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  captchaText: string;
  setCaptchaText: (text: string) => void;
  submittingCaptcha: boolean;
  handleSubmitCaptcha: () => void;
  handleDownloadZip: (jobId: string) => void;
}

export default function JobQueuePanel({
  token,
  apiBaseUrl,
  jobs,
  loadingJobs,
  fetchJobs,
  selectedJobId,
  setSelectedJobId,
  captchaText,
  setCaptchaText,
  submittingCaptcha,
  handleSubmitCaptcha,
  handleDownloadZip,
}: JobQueuePanelProps) {
  const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;

  const [selectedJobDetail, setSelectedJobDetail] = React.useState<BotJob | null>(null);
  const [loadingLogs, setLoadingLogs] = React.useState(false);
  const [cancellingJob, setCancellingJob] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState('');
  const [jobToCancel, setJobToCancel] = React.useState<BotJob | null>(null);

  const handleCancelJob = async () => {
    if (!jobToCancel) return;
    try {
      setCancellingJob(true);
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/jobs/${jobToCancel._id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: cancelReason || 'Hủy thủ công bởi Admin qua giao diện' }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Không thể hủy tác vụ');
      }

      setShowCancelModal(false);
      setJobToCancel(null);
      setCancelReason('');
      await fetchJobs();
    } catch (err: any) {
      alert(`Lỗi khi dừng/hủy tác vụ: ${err.message}`);
    } finally {
      setCancellingJob(false);
    }
  };

  React.useEffect(() => {
    if (!selectedJobId) {
      setSelectedJobDetail(null);
      return;
    }

    let isMounted = true;
    const fetchJobDetail = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/jobs/${selectedJobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSelectedJobDetail(data);
          }
        }
      } catch (err) {
        console.error('Error fetching job detail:', err);
      }
    };

    setLoadingLogs(true);
    fetchJobDetail().finally(() => {
      if (isMounted) setLoadingLogs(false);
    });

    // Tự động làm mới log mỗi 4 giây nếu job đang chạy
    const currentJob = jobs.find((j) => j._id === selectedJobId);
    let interval: NodeJS.Timeout | null = null;
    if (currentJob && (currentJob.status === 'PROCESSING' || currentJob.status === 'PENDING')) {
      interval = setInterval(fetchJobDetail, 4000);
    }

    return () => {
      isMounted = false;
      if (interval) clearInterval(interval);
    };
  }, [selectedJobId, token, apiBaseUrl, jobs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle size={10} /> Thành công
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <XCircle size={10} /> Lỗi
          </span>
        );
      case 'CANCELLED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <XCircle size={10} /> Đã hủy
          </span>
        );
      case 'ABORTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <AlertTriangle size={10} /> Tạm dừng (Sàn ngoài)
          </span>
        );
      case 'PROCESSING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', border: '1px solid rgba(2, 132, 199, 0.3)' }} className="animate-pulse">
            <RefreshCw size={10} className="animate-spin" /> Đang chạy
          </span>
        );
      case 'AWAITING_CAPTCHA':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }} className="animate-pulse">
            <Activity size={10} /> Chờ Captcha
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: 700, backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
            <Activity size={10} /> Đang chờ
          </span>
        );
    }
  };

  const getJobLabel = (jobType: string) => {
    switch (jobType) {
      case 'RPA_DOWNLOAD_REPORTS':
        return 'Tải Báo Cáo RPA';
      case 'FILE_AUDIT_MS':
        return 'Kiểm Tra & Tải Bổ Sung MS';
      case 'FILE_AUDIT_CQG':
        return 'Kiểm Tra & Ghép File CQG';
      case 'FILE_AUDIT_ACM':
        return ' Tải Báo Cáo Tự Doanh ACM';
      case 'RUN_LOT_MACRO':
        return ' Chạy Excel Macro Số Lot';
      case 'RUN_VALUE_MACRO':
        return ' Chạy Excel Macro Giá Trị';
      default:
        return jobType;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 animate-fade-in" style={{ color: 'var(--text-primary)' }}>
      {/* Left: Job Logs & Console Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {selectedJob ? (
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Terminal size={18} color="#10b981" />
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace', margin: 0 }}>
                  Console Output - Job {selectedJob._id.substring(0, 8)}
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}
                </span>
                {getStatusBadge(selectedJob.status)}

                {/* Nút Dừng Tác Vụ */}
                {['PENDING', 'PROCESSING', 'AWAITING_CAPTCHA'].includes(selectedJob.status) && (
                  <button
                    type="button"
                    onClick={() => {
                      setJobToCancel(selectedJob);
                      setShowCancelModal(true);
                    }}
                    disabled={cancellingJob}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    title="Dừng khẩn cấp hoặc hủy tác vụ này"
                  >
                    <Square size={10} fill="#ef4444" />
                    {selectedJob.status === 'PENDING' ? 'Hủy Khỏi Hàng Đợi' : 'Dừng Tác Vụ'}
                  </button>
                )}
              </div>
            </div>

            {/* Captcha Handling */}
            {selectedJob.status === 'AWAITING_CAPTCHA' && (
              <div style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={14} />
                  Yêu cầu giải Captcha thủ công
                </span>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {(selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage) ? (
                    <div style={{ backgroundColor: '#ffffff', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                      <img
                        src={selectedJobDetail?.payload?.captchaImage || selectedJob.payload?.captchaImage}
                        alt="Captcha Code"
                        style={{ height: '40px', objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>Không tìm thấy ảnh Captcha</span>
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
                      style={{ fontSize: '0.75rem', padding: '8px 12px' }}
                      disabled={submittingCaptcha}
                    />
                    <button
                      type="button"
                      onClick={handleSubmitCaptcha}
                      disabled={submittingCaptcha || !captchaText}
                      className="btn btn-primary"
                      style={{ fontSize: '0.75rem', fontWeight: 700, padding: '8px 16px', flexShrink: 0 }}
                    >
                      {submittingCaptcha ? 'Đang gửi...' : 'Gửi mã'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Logs Area */}
            <div style={{ backgroundColor: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontFamily: 'monospace', fontSize: '0.7rem', color: '#34d399', lineHeight: 1.6, maxHeight: '350px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {loadingLogs && !selectedJobDetail ? (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '16px 0' }}>Đang tải logs từ máy chủ...</div>
              ) : selectedJobDetail?.logs && selectedJobDetail.logs.length > 0 ? (
                selectedJobDetail.logs.map((logLine, idx) => <div key={idx}>{logLine}</div>)
              ) : (
                <div style={{ color: '#64748b', textAlign: 'center', padding: '16px 0' }}>Chưa có dòng log nào được ghi.</div>
              )}
            </div>

            {/* ZIP Download Button */}
            {selectedJob.status === 'COMPLETED' && selectedJob.jobType === 'RPA_DOWNLOAD_REPORTS' && (
              <button
                type="button"
                onClick={() => handleDownloadZip(selectedJob._id)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 700, fontSize: '0.875rem' }}
              >
                <Download size={16} />
                Tải file nén ZIP báo cáo
              </button>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <Terminal size={32} color="var(--text-muted)" />
            <p style={{ fontSize: '0.75rem', margin: 0 }}>Vui lòng chọn một tác vụ trong hàng đợi ở cột bên phải để xem logs và giải captcha.</p>
          </div>
        )}
      </div>

      {/* Right: Job Queue List */}
      <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
            <Activity size={14} color="#0284c7" />
            Hàng đợi RPA ngầm
          </h3>
          <button
            onClick={fetchJobs}
            disabled={loadingJobs}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <RefreshCw size={12} className={loadingJobs ? 'animate-spin' : ''} />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa có background job nào được tạo.</div>
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
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #0284c7' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(2, 132, 199, 0.1)' : 'var(--bg-input)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {getJobLabel(job.jobType)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {getStatusBadge(job.status)}
                      {['PENDING', 'PROCESSING', 'AWAITING_CAPTCHA'].includes(job.status) && (
                        <button
                          type="button"
                          title="Hủy/Dừng tác vụ này"
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
                          <Square size={11} fill="#ef4444" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    <span>Lần thử: {job.attempts}/{job.maxAttempts}</span>
                    <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showCancelModal && jobToCancel && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
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
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
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
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {jobToCancel.status === 'PENDING' ? 'Xác nhận hủy tác vụ' : 'Xác nhận dừng khẩn cấp'}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Mã Job: {jobToCancel._id.substring(0, 8)} ({getJobLabel(jobToCancel.jobType)})
                </span>
              </div>
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {jobToCancel.status === 'PROCESSING'
                ? 'Tác vụ đang chạy thực tế trên hệ thống. Nếu dừng ngay bây giờ, tiến trình cào dữ liệu sẽ bị ngắt, trình duyệt Playwright sẽ đóng lại và giải phóng phiên an toàn.'
                : 'Tác vụ đang nằm trong hàng đợi. Thao tác này sẽ gạch bỏ tác vụ khỏi hàng đợi thực thi ngay lập tức.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Lý do dừng / hủy:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Kẹt phiên, user cần thao tác tay, trigger nhầm..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.75rem', padding: '8px 12px' }}
                disabled={cancellingJob}
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
                Quay lại
              </button>
              <button
                type="button"
                onClick={handleCancelJob}
                disabled={cancellingJob}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {cancellingJob ? <RefreshCw size={13} className="animate-spin" /> : <Square size={13} fill="#ffffff" />}
                {cancellingJob ? 'Đang xử lý...' : 'Xác nhận Dừng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
