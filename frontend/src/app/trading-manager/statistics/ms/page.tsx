'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Calendar,
  Play,
  Loader2,
  RefreshCw,
  Folder,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/services/api';
import { io } from 'socket.io-client';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';

export default function MsStatisticsPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());

  const [lotMacroLoading, setLotMacroLoading] = useState<boolean>(false);
  const [valueMacroLoading, setValueMacroLoading] = useState<boolean>(false);
  const [allMacroLoading, setAllMacroLoading] = useState<boolean>(false);

  // Cấu hình đường dẫn output nạp từ system_settings
  const [lotStatPath, setLotStatPath] = useState<string>('');
  const [valueStatPath, setValueStatPath] = useState<string>('');
  const [loadingSettings, setLoadingSettings] = useState<boolean>(false);

  // Lịch sử / tiến trình các tác vụ Macro gần nhất
  const [macroJobs, setMacroJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);

  useEffect(() => {
    setSelectedDate(getInitialTradingSessionDate());
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Nạp cấu hình đường dẫn
  const fetchSettings = useCallback(async () => {
    if (!token) return;
    setLoadingSettings(true);
    try {
      const data = await api.admin.getSystemSettings(token);
      if (Array.isArray(data)) {
        const lotItem = data.find((s: any) => s.key === 'bot_ms_lot_stat_path' || s.key === 'bot_lot_macro_target_root');
        const valItem = data.find((s: any) => s.key === 'bot_ms_value_stat_path' || s.key === 'bot_macro_value_path');
        if (lotItem) setLotStatPath(lotItem.value || '');
        if (valItem) setValueStatPath(valItem.value || '');
      }
    } catch (err: any) {
      console.warn('Không thể nạp cấu hình tham số thống kê:', err.message);
    } finally {
      setLoadingSettings(false);
    }
  }, [token]);

  // Nạp danh sách các job macro
  const fetchMacroJobs = useCallback(async () => {
    if (!token) return;
    setLoadingJobs(true);
    try {
      const jobTypes = 'RUN_LOT_MACRO,RUN_VALUE_MACRO,RUN_MACRO,RUN_LOT_TVKD_MACRO,RUN_VALUE_TVKD_MACRO';
      const data = await api.checklistHub.getJobs({ jobTypes, limit: 10 }, token);
      if (Array.isArray(data)) {
        setMacroJobs(data);
      }
    } catch (err: any) {
      console.warn('Không thể nạp lịch sử job macro:', err.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [token]);

  useEffect(() => {
    fetchSettings();
    fetchMacroJobs();

    const socket = io(API_BASE_URL, { transports: ['websocket'] });
    socket.on('job-status-updated', () => fetchMacroJobs());
    return () => {
      socket.disconnect();
    };
  }, [fetchSettings, fetchMacroJobs]);

  // Kích hoạt Macro Thống kê Số Lot
  const handleLotMacro = async () => {
    if (!token || lotMacroLoading) return;
    setLotMacroLoading(true);
    const toastId = toast.loading(`Đang khởi chạy Excel Macro Thống kê số lot phiên ${selectedDate}...`);
    try {
      const data = await api.ccpClearing.triggerLotMacro({ targetDate: selectedDate }, token);
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro số lot vào hàng đợi xử lý!', { id: toastId });
      fetchMacroJobs();
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro số lot: ${err.message}`, { id: toastId });
    } finally {
      setLotMacroLoading(false);
    }
  };

  // Kích hoạt Macro Thống kê Giá Trị
  const handleValueMacro = async () => {
    if (!token || valueMacroLoading) return;
    setValueMacroLoading(true);
    const toastId = toast.loading(`Đang khởi chạy Excel Macro Thống kê giá trị phiên ${selectedDate}...`);
    try {
      const data = await api.ccpClearing.triggerValueMacro({ targetDate: selectedDate }, token);
      toast.success(data.message || 'Đã đưa yêu cầu chạy Macro giá trị vào hàng đợi xử lý!', { id: toastId });
      fetchMacroJobs();
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt Macro giá trị: ${err.message}`, { id: toastId });
    } finally {
      setValueMacroLoading(false);
    }
  };

  // Kích hoạt chạy cả 2 Macro
  const handleAllMacro = async () => {
    if (!token || allMacroLoading) return;
    setAllMacroLoading(true);
    const toastId = toast.loading(`Đang khởi chạy chuỗi Macro (Số lot & Giá trị) phiên ${selectedDate}...`);
    try {
      await api.ccpClearing.triggerLotMacro({ targetDate: selectedDate }, token);
      await api.ccpClearing.triggerValueMacro({ targetDate: selectedDate }, token);
      toast.success('Đã đưa cả 2 tác vụ Macro vào hàng đợi robot!', { id: toastId });
      fetchMacroJobs();
    } catch (err: any) {
      toast.error(`Lỗi kích hoạt chuỗi Macro: ${err.message}`, { id: toastId });
    } finally {
      setAllMacroLoading(false);
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.74rem', fontWeight: 700 }}>Hoàn thành</span>;
      case 'PROCESSING':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.74rem', fontWeight: 700 }}>Đang chạy</span>;
      case 'FAILED':
        return <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.74rem', fontWeight: 700 }}>Thất bại</span>;
      default:
        return <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          minHeight: '100%',
          backgroundColor: 'var(--bg-main)',
          padding: isFullscreen ? '20px' : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#60a5fa',
                }}
              >
                PHÂN HỆ M-SYSTEM & CQG (LEGACY)
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '4px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <FileSpreadsheet color="#3b82f6" size={24} />
              THỐNG KÊ M-SYSTEM (MACRO SỐ LOT & GIÁ TRỊ)
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Bộ chọn ngày giao dịch */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Calendar size={15} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Phiên:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn btn-secondary"
              style={{ padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Back to Dashboard */}
            <Link
              href="/trading-manager/dashboard"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '9px 16px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} />
              <span>Tổng quan QLGD</span>
            </Link>
          </div>
        </div>

        {/* Action Panel: Thao tác chạy Macro */}
        <div className="glass-panel" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Thực Thi Excel Macro Thống Kê
              </h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
                Khởi chạy tiến trình robot tự động trích xuất dữ liệu MS & CQG, nạp vào file Macro Excel mẫu và xuất báo cáo lũy kế.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAllMacro}
              disabled={allMacroLoading || lotMacroLoading || valueMacroLoading}
              className="btn btn-primary"
              style={{
                fontSize: '0.84rem',
                padding: '10px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                backgroundColor: '#3b82f6',
                borderColor: '#3b82f6',
              }}
            >
              {allMacroLoading ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              <span>Chạy Toàn Bộ Macro (Lot + Giá Trị)</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {/* Box 1: Macro Số Lot */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.04)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#3b82f6' }}>
                    1. Thống Kê Số Lot Giao Dịch
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontWeight: 700 }}>
                    RUN_LOT_MACRO
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Tổng hợp số lot giao dịch theo từng tài khoản, mặt hàng và thành viên kinh doanh từ file khớp lệnh M-System & CQG.
                </p>
              </div>

              <button
                type="button"
                onClick={handleLotMacro}
                disabled={lotMacroLoading}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  padding: '9px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                {lotMacroLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                <span>{lotMacroLoading ? 'Đang chạy Macro...' : 'Chạy Macro Số Lot'}</span>
              </button>
            </div>

            {/* Box 2: Macro Giá Trị */}
            <div
              style={{
                padding: '16px 20px',
                borderRadius: '10px',
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '14px',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#10b981' }}>
                    2. Thống Kê Giá Trị Giao Dịch
                  </span>
                  <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                    RUN_VALUE_MACRO
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  Tính toán tổng giá trị hợp đồng giao dịch, quy đổi theo ma trận tỷ giá USD/VND tương ứng cho từng nhóm mặt hàng.
                </p>
              </div>

              <button
                type="button"
                onClick={handleValueMacro}
                disabled={valueMacroLoading}
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  fontSize: '0.82rem',
                  padding: '9px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  borderColor: 'rgba(16, 185, 129, 0.4)',
                  color: '#10b981',
                }}
              >
                {valueMacroLoading ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                <span>{valueMacroLoading ? 'Đang chạy Macro...' : 'Chạy Macro Giá Trị'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Thông tin cấu hình đường dẫn đích */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Folder size={17} color="#f59e0b" />
              <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                Đường dẫn thư mục lưu trữ file kết quả Macro
              </strong>
            </div>
            <Link
              href="/trading-manager/settings/ms-cqg"
              style={{ fontSize: '0.78rem', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sliders size={13} />
              <span>Chỉnh sửa cấu hình tham số</span>
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: '180px' }}>
                Thư mục Thống kê số Lot:
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: lotStatPath ? 'var(--text-primary)' : 'var(--text-muted)', wordBreak: 'break-all' }}>
                {lotStatPath || '(Chưa thiết lập - Vui lòng vào Cấu hình tham số để cài đặt)'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--bg-input)' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', minWidth: '180px' }}>
                Thư mục Thống kê Giá trị:
              </span>
              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: valueStatPath ? 'var(--text-primary)' : 'var(--text-muted)', wordBreak: 'break-all' }}>
                {valueStatPath || '(Chưa thiết lập - Vui lòng vào Cấu hình tham số để cài đặt)'}
              </span>
            </div>
          </div>
        </div>

        {/* Lịch sử thực thi gần đây */}
        <div className="glass-panel" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} color="var(--text-muted)" />
              <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                Tiến trình chạy Macro gần nhất (Real-time)
              </strong>
            </div>
            <button
              type="button"
              onClick={fetchMacroJobs}
              disabled={loadingJobs}
              className="btn btn-secondary"
              style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={12} className={loadingJobs ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>
          </div>

          {macroJobs.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
              Chưa có tác vụ Macro nào được ghi nhận gần đây.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 12px' }}>Loại tác vụ</th>
                    <th style={{ padding: '8px 12px' }}>Trạng thái</th>
                    <th style={{ padding: '8px 12px' }}>Phiên</th>
                    <th style={{ padding: '8px 12px' }}>Khởi tạo lúc</th>
                    <th style={{ padding: '8px 12px' }}>Chi tiết kết quả</th>
                  </tr>
                </thead>
                <tbody>
                  {macroJobs.map((job) => (
                    <tr key={job._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace' }}>
                        {job.jobType}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {getJobStatusBadge(job.status)}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                        {job.payload?.targetDate || job.payload?.date || '--'}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {job.createdAt ? new Date(job.createdAt).toLocaleTimeString('vi-VN') : '--'}
                      </td>
                      <td style={{ padding: '10px 12px', color: job.status === 'FAILED' ? '#ef4444' : 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {job.error || job.payload?.resultSummary || (job.status === 'COMPLETED' ? 'Đã hoàn tất ghi file Excel' : 'Đang xử lý...')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
