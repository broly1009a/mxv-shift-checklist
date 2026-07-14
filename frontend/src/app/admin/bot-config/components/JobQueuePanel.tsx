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
  Play,
} from 'lucide-react';

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle size={10} /> Thành công
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={10} /> Lỗi
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse">
            <RefreshCw size={10} className="animate-spin" /> Đang chạy
          </span>
        );
      case 'AWAITING_CAPTCHA':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
            <Activity size={10} /> Chờ Captcha
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
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
        return '🤖 Tải Báo Cáo Tự Doanh ACM';
      case 'RUN_LOT_MACRO':
        return '📊 Chạy Excel Macro Số Lot';
      case 'RUN_VALUE_MACRO':
        return '📊 Chạy Excel Macro Giá Trị';
      default:
        return jobType;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 animate-fade-in text-zinc-300">
      {/* Left: Job Logs & Console Details */}
      <div className="flex flex-col gap-4">
        {selectedJob ? (
          <div className="glass-panel p-6 flex flex-col gap-4 bg-zinc-950/40 border border-zinc-800">
            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Terminal size={18} className="text-emerald-400" />
                <h4 className="text-sm font-bold text-white font-mono">
                  Console Output - Job {selectedJob._id.substring(0, 8)}
                </h4>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-zinc-500 font-mono">
                  {new Date(selectedJob.createdAt).toLocaleString('vi-VN')}
                </span>
                {getStatusBadge(selectedJob.status)}
              </div>
            </div>

            {/* Captcha Handling */}
            {selectedJob.status === 'AWAITING_CAPTCHA' && (
              <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-lg flex flex-col gap-3">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Yêu cầu giải Captcha thủ công
                </span>
                <div className="flex gap-4 items-center flex-wrap">
                  {selectedJob.payload?.captchaImage ? (
                    <div className="bg-white p-1 rounded border border-zinc-700">
                      <img
                        src={selectedJob.payload.captchaImage}
                        alt="Captcha Code"
                        className="h-10 object-contain block"
                      />
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-500 font-mono">Không tìm thấy ảnh Captcha</span>
                  )}
                  <div className="flex-1 min-w-[200px] flex gap-2">
                    <input
                      type="text"
                      placeholder="Nhập mã Captcha..."
                      value={captchaText}
                      onChange={(e) => setCaptchaText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubmitCaptcha();
                      }}
                      className="form-input text-xs py-2 px-3 border-amber-500/40 focus:border-amber-500 bg-zinc-900 text-white"
                      disabled={submittingCaptcha}
                    />
                    <button
                      type="button"
                      onClick={handleSubmitCaptcha}
                      disabled={submittingCaptcha || !captchaText}
                      className="btn bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold px-4 py-2 rounded shrink-0 transition"
                    >
                      {submittingCaptcha ? 'Đang gửi...' : 'Gửi mã'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Logs Area */}
            <div className="bg-black/60 p-4 rounded-lg border border-zinc-900 font-mono text-[11px] text-emerald-400/90 leading-relaxed max-h-[350px] overflow-y-auto flex flex-col gap-1.5">
              {selectedJob.logs && selectedJob.logs.length > 0 ? (
                selectedJob.logs.map((logLine, idx) => <div key={idx}>{logLine}</div>)
              ) : (
                <div className="text-zinc-600 text-center py-4">Chưa có dòng log nào được ghi.</div>
              )}
            </div>

            {/* ZIP Download Button */}
            {selectedJob.status === 'COMPLETED' && selectedJob.jobType === 'RPA_DOWNLOAD_REPORTS' && (
              <button
                type="button"
                onClick={() => handleDownloadZip(selectedJob._id)}
                className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 font-bold text-sm"
              >
                <Download size={16} />
                Tải file nén ZIP báo cáo
              </button>
            )}
          </div>
        ) : (
          <div className="glass-panel p-12 text-center text-zinc-500 border border-zinc-800/80 flex flex-col items-center justify-center gap-2">
            <Terminal size={32} className="text-zinc-700" />
            <p className="text-xs">Vui lòng chọn một tác vụ trong hàng đợi ở cột bên phải để xem logs và giải captcha.</p>
          </div>
        )}
      </div>

      {/* Right: Job Queue List */}
      <div className="glass-panel p-5 flex flex-col gap-4 border border-zinc-800 max-h-[550px] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-zinc-800/80 pb-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
            <Activity size={14} className="text-sky-400" />
            Hàng đợi RPA ngầm
          </h3>
          <button
            onClick={fetchJobs}
            disabled={loadingJobs}
            className="text-zinc-500 hover:text-white transition"
          >
            <RefreshCw size={12} className={loadingJobs ? 'animate-spin' : ''} />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">Chưa có background job nào được tạo.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {jobs.map((job) => {
              const isSelected = selectedJobId === job._id;
              return (
                <div
                  key={job._id}
                  onClick={() => setSelectedJobId(isSelected ? null : job._id)}
                  className={`p-3 rounded-lg border cursor-pointer transition flex flex-col gap-2 ${
                    isSelected
                      ? 'bg-sky-500/5 border-sky-500/40'
                      : 'bg-zinc-900/20 border-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-[11px] font-bold text-zinc-200">
                      {getJobLabel(job.jobType)}
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono">
                    <span>Lần thử: {job.attempts}/{job.maxAttempts}</span>
                    <span>{new Date(job.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
