'use client';

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
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
    <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <Download size={18} color="#10b981" />
            Yêu cầu tải báo cáo trực tiếp
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Chọn các báo cáo cần thiết để ra lệnh cho Bot tự động đăng nhập sở tải về.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSelectAllTargets}
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '6px 14px' }}
        >
          {downloadTargets.length === REPORT_OPTIONS.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
        {REPORT_OPTIONS.map((option) => {
          const isSelected = downloadTargets.includes(option.id);
          return (
            <div
              key={option.id}
              onClick={() => handleTargetToggle(option.id)}
              style={{
                padding: '12px',
                borderRadius: '8px',
                border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color)',
                backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-input)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                userSelect: 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={14} color={isSelected ? '#10b981' : 'var(--text-muted)'} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: isSelected ? 700 : 500 }}>{option.label}</span>
              </div>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={{ accentColor: '#10b981' }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Đang chọn <strong style={{ color: '#10b981' }}>{downloadTargets.length}</strong> / {REPORT_OPTIONS.length} loại báo cáo
        </span>
        <button
          type="button"
          onClick={handleTriggerDownload}
          disabled={triggeringDownload || downloadTargets.length === 0}
          className="btn btn-primary"
          style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', fontWeight: 700 }}
        >
          <Play size={16} />
          {triggeringDownload ? 'Đang gửi yêu cầu...' : 'Khởi chạy Bot tải báo cáo'}
        </button>
      </div>
    </div>
  );
}
