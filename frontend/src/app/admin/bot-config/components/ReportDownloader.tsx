'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  CheckCircle,
  Play,
  FileText,
} from 'lucide-react';

interface ReportDownloaderProps {
  token: string;
  apiBaseUrl: string;
  fetchJobs: () => Promise<void>;
  setTrackedJobs: React.Dispatch<React.SetStateAction<string[]>>;
}

const REPORT_OPTIONS = [
  { id: 'NKTTHT', label: 'Nhật ký thanh toán hỗ trợ (NKTTHT)' },
  { id: 'DSTKGD-Futures', label: 'Danh sách tài khoản giao dịch - Futures' },
  { id: 'DSTKGD-Spread', label: 'Danh sách tài khoản giao dịch - Spread' },
  { id: 'DSTKGD-LME', label: 'Danh sách tài khoản giao dịch - LME' },
  { id: 'DSTKGD-ACM', label: 'Danh sách tài khoản giao dịch - ACM' },
  { id: 'QLTKGD', label: 'Quản lý tài khoản giao dịch (QLTKGD)' },
  { id: 'QLTKGDAmKQ', label: 'Quản lý tài khoản giao dịch âm ký quỹ (QLTKGDAmKQ)' },
  { id: 'TLKQHSKQ', label: 'Tỉ lệ ký quỹ và Hiệu số ký quỹ (TLKQHSKQ)' },
  { id: 'NR', label: 'Báo cáo Net Position (NR)' },
  { id: 'DSTrader', label: 'Danh sách Trader hoạt động (DSTrader)' },
  { id: 'Markettruoc6h', label: 'Báo cáo Market trước 6h' },
  { id: 'DSLDK', label: 'Danh sách lệnh đối kháng (DSLDK)' },
  { id: 'DSLCK', label: 'Danh sách lệnh chờ khớp (DSLCK)' },
  { id: 'DSLH', label: 'Danh sách lệnh hủy (DSLH)' },
  { id: 'DSLK', label: 'Danh sách lệnh khớp (DSLK)' },
  { id: 'DSGD', label: 'Danh sách giao dịch (DSGD)' },
  { id: 'TTM', label: 'Báo cáo TTM' },
  { id: 'TTTT', label: 'Tình trạng thanh toán hỗ trợ (TTTT)' },
];

export default function ReportDownloader({
  token,
  apiBaseUrl,
  fetchJobs,
  setTrackedJobs,
}: ReportDownloaderProps) {
  const [downloadTargets, setDownloadTargets] = useState<string[]>(
    REPORT_OPTIONS.map((o) => o.id)
  );
  const [triggeringDownload, setTriggeringDownload] = useState(false);

  const handleTargetToggle = (target: string) => {
    setDownloadTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target]
    );
  };

  const handleSelectAllTargets = () => {
    if (downloadTargets.length === REPORT_OPTIONS.length) {
      setDownloadTargets([]);
    } else {
      setDownloadTargets(REPORT_OPTIONS.map((o) => o.id));
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
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targets: downloadTargets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng RPA tải báo cáo! Theo dõi logs ở tab Hàng Đợi.', { id: toastId });
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

  return (
    <div className="glass-panel p-6 flex flex-col gap-6 animate-fade-in">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4 flex-wrap gap-3">
        <div>
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Download size={18} className="text-emerald-500" />
            Yêu cầu tải báo cáo trực tiếp
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Chọn các báo cáo cần thiết để ra lệnh cho Bot tự động đăng nhập sở tải về.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSelectAllTargets}
          className="btn btn-secondary text-xs px-3.5 py-1.5"
        >
          {downloadTargets.length === REPORT_OPTIONS.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {REPORT_OPTIONS.map((option) => {
          const isSelected = downloadTargets.includes(option.id);
          return (
            <div
              key={option.id}
              onClick={() => handleTargetToggle(option.id)}
              className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between gap-3 select-none ${
                isSelected
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-white font-semibold'
                  : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText size={14} className={isSelected ? 'text-emerald-400' : 'text-zinc-500'} />
                <span className="text-xs leading-normal">{option.label}</span>
              </div>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}} // Controlled via parent div click
                className="rounded border-zinc-850 text-emerald-500 focus:ring-emerald-500 bg-zinc-950/60"
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-between items-center gap-4 mt-4 border-t border-zinc-800/60 pt-4 flex-wrap">
        <span className="text-xs text-zinc-400">
          Đang chọn <strong className="text-emerald-400">{downloadTargets.length}</strong> / {REPORT_OPTIONS.length} loại báo cáo
        </span>
        <button
          type="button"
          onClick={handleTriggerDownload}
          disabled={triggeringDownload || downloadTargets.length === 0}
          className="btn btn-primary px-8 py-3 flex items-center gap-2 text-sm font-bold shadow-lg"
        >
          <Play size={16} />
          {triggeringDownload ? 'Đang gửi yêu cầu...' : 'Khởi chạy Bot tải báo cáo'}
        </button>
      </div>
    </div>
  );
}
