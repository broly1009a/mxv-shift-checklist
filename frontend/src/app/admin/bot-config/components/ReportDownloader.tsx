'use client';

import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  Download,
  Play,
  FileText,
  Calendar,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Upload,
  Zap,
  Layers,
  Database,
} from 'lucide-react';

interface ReportDownloaderProps {
  token: string;
  apiBaseUrl: string;
  fetchJobs: () => Promise<void>;
  setTrackedJobs: React.Dispatch<React.SetStateAction<string[]>>;
}

const REPORT_OPTIONS = [
  { id: 'NKTTHT', label: 'Nhật ký thanh toán hỗ trợ (NKTTHT)', category: 'eod' },
  { id: 'DSTKGD-Futures', label: 'Danh sách tài khoản giao dịch - Futures', category: 'ms' },
  { id: 'DSTKGD-Spread', label: 'Danh sách tài khoản giao dịch - Spread', category: 'ms' },
  { id: 'DSTKGD-LME', label: 'Danh sách tài khoản giao dịch - LME', category: 'ms' },
  { id: 'DSTKGD-ACM', label: 'Danh sách tài khoản giao dịch - ACM', category: 'ms' },
  { id: 'QLTKGD', label: 'Quản lý tài khoản giao dịch (QLTKGD)', category: 'eod' },
  { id: 'QLTKGDAmKQ', label: 'Quản lý tài khoản giao dịch âm ký quỹ (QLTKGDAmKQ)', category: 'ms' },
  { id: 'TLKQHSKQ', label: 'Tỉ lệ ký quỹ và Hiệu số ký quỹ (TLKQHSKQ)', category: 'eod' },
  { id: 'NR', label: 'Báo cáo Net Position (NR)', category: 'eod' },
  { id: 'DSTrader', label: 'Danh sách Trader hoạt động (DSTrader)', category: 'ms' },
  { id: 'Markettruoc6h', label: 'Báo cáo Market trước 6h', category: 'eod' },
  { id: 'DSLDK', label: 'Danh sách lệnh đối kháng (DSLDK)', category: 'orders' },
  { id: 'DSLCK', label: 'Danh sách lệnh chờ khớp (DSLCK)', category: 'orders' },
  { id: 'DSLH', label: 'Danh sách lệnh hủy (DSLH)', category: 'orders' },
  { id: 'DSLK', label: 'Danh sách lệnh khớp (DSLK)', category: 'orders' },
  { id: 'DSGD', label: 'Danh sách giao dịch CoreCCP (DSGD)', category: 'ccp' },
  { id: 'DSQLKQ', label: 'Danh sách quản lý ký quỹ (DSQLKQ)', category: 'eod' },
  { id: 'TTM', label: 'Báo cáo Vị thế mở (TTM)', category: 'ccp' },
  { id: 'TTTT', label: 'Tình trạng thanh toán hỗ trợ (TTTT)', category: 'ccp' },
  { id: 'TTCDH', label: 'Trạng thái tất toán chờ đáo hạn LME (TTCDH)', category: 'ccp' },
];

function getPreviousWorkday(d: Date = new Date()): Date {
  const prev = new Date(d);
  do {
    prev.setDate(prev.getDate() - 1);
  } while (prev.getDay() === 0 || prev.getDay() === 6);
  return prev;
}

export default function ReportDownloader({
  token,
  apiBaseUrl,
  fetchJobs,
  setTrackedJobs,
}: ReportDownloaderProps) {
  // Session date selection
  const [sessionDate, setSessionDate] = useState(() => {
    const prev = getPreviousWorkday();
    return prev.toISOString().split('T')[0];
  });

  const [downloadTargets, setDownloadTargets] = useState<string[]>([
    'DSGD',
    'TTM',
    'TTTT',
    'QLTKGD',
    'NR',
    'NKTTHT',
  ]);
  const [triggeringDownload, setTriggeringDownload] = useState(false);
  const [triggeringPipeline, setTriggeringPipeline] = useState(false);

  // File readiness matrix states
  const [matrixData, setMatrixData] = useState<any>(null);
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Direct upload states
  const [uploadingFile, setUploadingFile] = useState(false);

  // Fetch File Readiness Matrix
  const fetchMatrix = useCallback(async () => {
    if (!token) return;
    setLoadingMatrix(true);
    try {
      const res = await fetch(
        `${apiBaseUrl}/api/v1/bot-engine/files/readiness-matrix?date=${sessionDate}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMatrixData(data);
      }
    } catch (err: any) {
      console.error('Error fetching file readiness matrix:', err);
    } finally {
      setLoadingMatrix(false);
    }
  }, [token, apiBaseUrl, sessionDate]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  const handleTargetToggle = (target: string) => {
    setDownloadTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target]
    );
  };

  // Preset selectors
  const applyPreset = (preset: 'ccp' | 'eod' | 'orders' | 'all' | 'none') => {
    if (preset === 'ccp') {
      setDownloadTargets(['DSGD', 'TTM', 'TTTT']);
    } else if (preset === 'eod') {
      setDownloadTargets(['NKTTHT', 'QLTKGD', 'NR', 'TTTT', 'TLKQHSKQ', 'Markettruoc6h']);
    } else if (preset === 'orders') {
      setDownloadTargets(['DSLK', 'DSLCK', 'DSLH', 'DSLDK']);
    } else if (preset === 'all') {
      setDownloadTargets(REPORT_OPTIONS.map((o) => o.id));
    } else {
      setDownloadTargets([]);
    }
  };

  // Trigger standard RPA download
  const handleTriggerDownload = async () => {
    if (!token) return;
    if (downloadTargets.length === 0) {
      toast.error('Vui lòng chọn ít nhất một báo cáo để tải!');
      return;
    }
    setTriggeringDownload(true);
    const toastId = toast.loading(`Đang gửi yêu cầu Bot tải báo cáo cho ngày ${sessionDate}...`);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targets: downloadTargets,
          sessionDay: sessionDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã xếp hàng RPA tải báo cáo! Theo dõi logs ở tab Hàng Đợi.', { id: toastId });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
      // Refetch matrix after a short delay
      setTimeout(fetchMatrix, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi kết nối máy chủ', { id: toastId });
    } finally {
      setTriggeringDownload(false);
    }
  };

  // 1-Click Pipeline: Download CoreCCP Reports & Run Lot Statistics
  const handleTriggerPipeline = async () => {
    if (!token) return;
    setTriggeringPipeline(true);
    const toastId = toast.loading(`Bắt đầu Pipeline: Xếp hàng tải CoreCCP & Tự động Thống kê...`);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/trigger-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targets: ['DSGD', 'TTM', 'TTTT'],
          sessionDay: sessionDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Khởi chạy thất bại');
      toast.success('Đã đưa bot tải file CoreCCP vào hàng đợi! Hệ thống sẽ tự cập nhật ma trận.', {
        id: toastId,
      });
      if (data.jobId) {
        setTrackedJobs((prev) => [...prev, data.jobId]);
      }
      fetchJobs();
      setTimeout(fetchMatrix, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi pipeline', { id: toastId });
    } finally {
      setTriggeringPipeline(false);
    }
  };

  // Upload missing file directly to daily folder
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, targetType?: string) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    setUploadingFile(true);
    const toastId = toast.loading(`Đang tải file ${file.name} vào thư mục ngày ${sessionDate}...`);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('date', sessionDate);
      if (targetType) formData.append('targetType', targetType);

      const res = await fetch(`${apiBaseUrl}/api/v1/bot-engine/files/upload-daily`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Upload thất bại');
      toast.success(data.message || `Đã nạp file ${file.name} thành công!`, { id: toastId });
      fetchMatrix();
    } catch (err: any) {
      toast.error(err.message || 'Lỗi tải file lên thư mục', { id: toastId });
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const ccpMatrix = matrixData?.matrix?.ccp;
  const cqgMatrix = matrixData?.matrix?.cqg;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
      {/* 1. Header Toolbar: Session Date & 1-Click Pipeline Button */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#10b981" />
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Ngày Phiên Vận Hành:
            </label>
          </div>
          <input
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            style={{
              padding: '8px 14px',
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
          <button
            type="button"
            onClick={fetchMatrix}
            disabled={loadingMatrix}
            className="btn btn-secondary"
            style={{ padding: '8px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Quét lại ma trận file ngày"
          >
            <RefreshCw size={14} className={loadingMatrix ? 'animate-spin' : ''} />
            <span>Quét lại thư mục</span>
          </button>
        </div>

        {/* 1-Click Pipeline Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={handleTriggerPipeline}
            disabled={triggeringPipeline}
            style={{
              padding: '10px 20px',
              fontSize: '0.82rem',
              fontWeight: 800,
              backgroundColor: '#3b82f6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
              transition: 'opacity 0.2s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Zap size={16} />
            <span>{triggeringPipeline ? 'Đang kích hoạt...' : 'Tải Báo Cáo & Thống Kê CoreCCP'}</span>
          </button>
        </div>
      </div>

      {/* 2. Daily File Readiness Matrix Section */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h4
              style={{
                fontSize: '0.9rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Database size={16} color="#10b981" />
              Ma Trận Tính Sẵn Sàng Của File Trong Thư Mục Ngày
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
              Thư mục MS: {matrixData?.msDailyFolder || 'Đang xác định...'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: matrixData?.readiness?.lotStatistics
                  ? 'rgba(16, 185, 129, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                color: matrixData?.readiness?.lotStatistics ? '#10b981' : '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {matrixData?.readiness?.lotStatistics ? (
                <>
                  <CheckCircle2 size={13} />
                  <span>ĐỦ FILE THỐNG KÊ LOT</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={13} />
                  <span>THIẾU FILE DSGD</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* Grid of File Matrix Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '12px',
          }}
        >
          {/* File 1: DSGD */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: ccpMatrix?.dsgd?.exists ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${ccpMatrix?.dsgd?.exists ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>1. DSGD CoreCCP (*)</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: ccpMatrix?.dsgd?.exists ? '#10b981' : '#ef4444',
                  color: '#000',
                }}
              >
                {ccpMatrix?.dsgd?.exists ? 'ĐÃ CÓ' : 'CHƯA CÓ'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: ccpMatrix?.dsgd?.exists ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {ccpMatrix?.dsgd?.exists
                ? `${ccpMatrix.dsgd.filename} (${(ccpMatrix.dsgd.sizeBytes / 1024).toFixed(1)} KB)`
                : 'Chưa có file trong thư mục ngày'}
            </span>
            {!ccpMatrix?.dsgd?.exists && (
              <label
                style={{
                  fontSize: '0.7rem',
                  color: '#10b981',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: 700,
                }}
              >
                <Upload size={12} />
                <span>Upload file DSGD ngay</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleUploadFile(e, 'DSGD')}
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                />
              </label>
            )}
          </div>

          {/* File 2: TTM */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: ccpMatrix?.ttm?.exists ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ccpMatrix?.ttm?.exists ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>2. TTM (Vị Thế Mở)</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: ccpMatrix?.ttm?.exists ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  color: ccpMatrix?.ttm?.exists ? '#000' : 'var(--text-muted)',
                }}
              >
                {ccpMatrix?.ttm?.exists ? 'ĐÃ CÓ' : 'TÙY CHỌN'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: ccpMatrix?.ttm?.exists ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {ccpMatrix?.ttm?.exists
                ? `${ccpMatrix.ttm.filename} (${(ccpMatrix.ttm.sizeBytes / 1024).toFixed(1)} KB)`
                : 'Chưa có (sẽ tính vị thế = 0)'}
            </span>
            {!ccpMatrix?.ttm?.exists && (
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: 600,
                }}
              >
                <Upload size={12} />
                <span>Upload file TTM</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleUploadFile(e, 'TTM')}
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                />
              </label>
            )}
          </div>

          {/* File 3: TTTT */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: ccpMatrix?.tttt?.exists ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ccpMatrix?.tttt?.exists ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>3. TTTT (Tất Toán)</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: ccpMatrix?.tttt?.exists ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  color: ccpMatrix?.tttt?.exists ? '#000' : 'var(--text-muted)',
                }}
              >
                {ccpMatrix?.tttt?.exists ? 'ĐÃ CÓ' : 'TÙY CHỌN'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: ccpMatrix?.tttt?.exists ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {ccpMatrix?.tttt?.exists
                ? `${ccpMatrix.tttt.filename} (${(ccpMatrix.tttt.sizeBytes / 1024).toFixed(1)} KB)`
                : 'Chưa có (sẽ tính tất toán = 0)'}
            </span>
            {!ccpMatrix?.tttt?.exists && (
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: 600,
                }}
              >
                <Upload size={12} />
                <span>Upload file TTTT</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => handleUploadFile(e, 'TTTT')}
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                />
              </label>
            )}
          </div>

          {/* File 4: Tỷ giá */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: ccpMatrix?.tyGia?.exists ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${ccpMatrix?.tyGia?.exists ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>4. Tỷ Giá CCP</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: ccpMatrix?.tyGia?.exists ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
                  color: ccpMatrix?.tyGia?.exists ? '#000' : 'var(--text-muted)',
                }}
              >
                {ccpMatrix?.tyGia?.exists ? 'ĐÃ CÓ' : 'DÙNG MẶC ĐỊNH'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: ccpMatrix?.tyGia?.exists ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {ccpMatrix?.tyGia?.exists
                ? `${ccpMatrix.tyGia.filename} (${(ccpMatrix.tyGia.sizeBytes / 1024).toFixed(1)} KB)`
                : 'Mặc định: 1 USD = 25.920 đ'}
            </span>
            {!ccpMatrix?.tyGia?.exists && (
              <label
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: 600,
                }}
              >
                <Upload size={12} />
                <span>Upload file Tỷ giá</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleUploadFile(e, 'EXCHANGE_RATE')}
                  style={{ display: 'none' }}
                  disabled={uploadingFile}
                />
              </label>
            )}
          </div>
        </div>

        {/* CQG Mini Status Strip */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '6px',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Tình trạng file CQG:
            </span>
            <span style={{ fontSize: '0.72rem', color: cqgMatrix?.fr?.exists ? '#10b981' : '#f59e0b' }}>
              FR: {cqgMatrix?.fr?.exists ? 'Đã có' : 'Chưa có'}
            </span>
            <span style={{ color: 'var(--border-color)' }}>•</span>
            <span style={{ fontSize: '0.72rem', color: cqgMatrix?.ps?.exists ? '#10b981' : '#f59e0b' }}>
              PS: {cqgMatrix?.ps?.exists ? 'Đã có' : 'Chưa có'}
            </span>
            <span style={{ color: 'var(--border-color)' }}>•</span>
            <span style={{ fontSize: '0.72rem', color: cqgMatrix?.op?.exists ? '#10b981' : '#f59e0b' }}>
              OP: {cqgMatrix?.op?.exists ? 'Đã có' : 'Chưa có'}
            </span>
          </div>

          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            CQG: {matrixData?.cqgDailyFolder || 'Đang xác định...'}
          </span>
        </div>
      </div>

      {/* 3. Report Downloader Preset & Trigger Section */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', color: 'var(--text-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <Download size={18} color="#10b981" />
              Chọn Báo Cáo Cần Robot Tải Về Thư Mục Ngày
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
              Tất cả các báo cáo sau khi tải sẽ được tự động lưu vào cây thư mục: <strong style={{ color: '#10b981' }}>{sessionDate.replace(/-/g, '/')}</strong>.
            </p>
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => applyPreset('ccp')}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            >
              Gói CoreCCP (3)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('eod')}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            >
              Gói Đối Soát (6)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('orders')}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            >
              Gói Sổ Lệnh (4)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={() => applyPreset('none')}
              className="btn btn-secondary"
              style={{ fontSize: '0.72rem', padding: '5px 10px' }}
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        {/* Report Options Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
          {REPORT_OPTIONS.map((option) => {
            const isSelected = downloadTargets.includes(option.id);
            return (
              <div
                key={option.id}
                onClick={() => handleTargetToggle(option.id)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: isSelected ? '1px solid #10b981' : '1px solid var(--border-color)',
                  backgroundColor: isSelected ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-input)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  userSelect: 'none',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <FileText size={14} color={isSelected ? '#10b981' : 'var(--text-muted)'} />
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {option.label}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                />
              </div>
            );
          })}
        </div>

        {/* Bottom Trigger Action Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            Đang chọn <strong style={{ color: '#10b981' }}>{downloadTargets.length}</strong> / {REPORT_OPTIONS.length} loại báo cáo
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handleTriggerDownload}
              disabled={triggeringDownload || downloadTargets.length === 0}
              className="btn btn-primary"
              style={{
                padding: '10px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.85rem',
                fontWeight: 700,
              }}
            >
              <Play size={16} />
              {triggeringDownload ? 'Đang gửi lệnh Bot...' : 'Khởi chạy Bot tải báo cáo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
