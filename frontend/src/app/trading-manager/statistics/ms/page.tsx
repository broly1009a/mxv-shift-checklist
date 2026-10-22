'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Layers,
  DollarSign,
  Info,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api } from '@/services/api';
import { useAppSocket } from '@/services/appSocket';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import { parseWindowsStoragePath } from '@/config/storage-path.config';

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
  const [showPaths, setShowPaths] = useState<boolean>(false);

  // Lịch sử / tiến trình các tác vụ Macro gần nhất
  const [macroJobs, setMacroJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PROCESSING' | 'FAILED'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 5; // Số dòng mỗi trang để giữ giao diện luôn gọn gàng, không bị kéo dài

  const filteredJobs = useMemo(() => {
    if (statusFilter === 'ALL') return macroJobs;
    if (statusFilter === 'PROCESSING') {
      return macroJobs.filter((j) => j.status === 'PROCESSING' || j.status === 'PENDING');
    }
    return macroJobs.filter((j) => j.status === statusFilter);
  }, [macroJobs, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / pageSize));
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredJobs.slice(start, start + pageSize);
  }, [filteredJobs, currentPage, pageSize]);

  // Bộ đếm theo từng nhóm trạng thái
  const jobCounts = useMemo(() => {
    const total = macroJobs.length;
    const completed = macroJobs.filter((j) => j.status === 'COMPLETED').length;
    const processing = macroJobs.filter((j) => j.status === 'PROCESSING' || j.status === 'PENDING').length;
    const failed = macroJobs.filter((j) => j.status === 'FAILED').length;
    return { total, completed, processing, failed };
  }, [macroJobs]);

  // Kiểm tra phiên đang chọn đã có lượt hoàn tất nào chưa
  const latestJobForSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    return (
      macroJobs.find(
        (j) =>
          (j.payload?.targetDate === selectedDate || j.payload?.date === selectedDate) &&
          j.status === 'COMPLETED',
      ) || null
    );
  }, [macroJobs, selectedDate]);

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

  const fetchMacroJobsRef = useRef(fetchMacroJobs);
  useEffect(() => {
    fetchMacroJobsRef.current = fetchMacroJobs;
  }, [fetchMacroJobs]);

  useEffect(() => {
    fetchSettings();
    fetchMacroJobs();
  }, [fetchSettings, fetchMacroJobs]);

  // Đồng bộ hoàn tất Macro Job tức thời (AppSocket Singleton)
  useAppSocket(
    {
      'job-status-updated': () => {
        fetchMacroJobsRef.current?.();
      },
    },
    Boolean(token),
  );

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

  const getJobDisplayName = (jobType: string) => {
    switch (jobType) {
      case 'RUN_LOT_MACRO':
        return { label: 'Macro Số Lot', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.3)' };
      case 'RUN_VALUE_MACRO':
        return { label: 'Macro Giá Trị', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.3)' };
      case 'RUN_MACRO':
        return { label: 'Macro Tổng Hợp', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)' };
      case 'RUN_LOT_TVKD_MACRO':
        return { label: 'Lot theo TVKD', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)' };
      case 'RUN_VALUE_TVKD_MACRO':
        return { label: 'Giá Trị theo TVKD', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { label: jobType, color: 'var(--text-secondary)', bg: 'var(--bg-input)', border: 'var(--border-color)' };
    }
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.74rem', fontWeight: 700 }}>
            <CheckCircle2 size={12} />
            Hoàn thành
          </span>
        );
      case 'PROCESSING':
      case 'PENDING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.74rem', fontWeight: 700 }}>
            <Loader2 size={12} className="animate-spin" />
            Đang chạy
          </span>
        );
      case 'FAILED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontSize: '0.74rem', fontWeight: 700 }}>
            <AlertTriangle size={12} />
            Thất bại
          </span>
        );
      default:
        return <span style={{ padding: '2px 8px', borderRadius: '4px', backgroundColor: 'rgba(156, 163, 175, 0.15)', color: 'var(--text-muted)', fontSize: '0.74rem', fontWeight: 700 }}>{status}</span>;
    }
  };

  const parsedLot = lotStatPath ? parseWindowsStoragePath(lotStatPath) : null;
  const lotDisplay = parsedLot?.suggestedPath || lotStatPath;
  const isLotFile = lotStatPath.toLowerCase().endsWith('.xlsm') || lotStatPath.toLowerCase().endsWith('.xlsx');

  const parsedVal = valueStatPath ? parseWindowsStoragePath(valueStatPath) : null;
  const valDisplay = parsedVal?.suggestedPath || valueStatPath;
  const isValueFile = valueStatPath.toLowerCase().endsWith('.xlsm') || valueStatPath.toLowerCase().endsWith('.xlsx');

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

        {/* ── BỐ CỤC TINH GỌN MỚI (CHUẨN OPERATOR UX: SẠCH CHỮ, TRỰC QUAN, TINH TẾ) ── */}
        <div
          className="glass-panel"
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            borderLeft: '4px solid #3b82f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#3b82f6',
                fontSize: '0.72rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              M-System & CQG
            </span>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Thống Kê
            </h3>
          </div>

          {/* Thanh công cụ hành động trực quan */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Nút 1: Tổng Hợp Toàn Bộ (Lot & Giá Trị) */}
            <button
              type="button"
              onClick={handleAllMacro}
              disabled={allMacroLoading || lotMacroLoading || valueMacroLoading}
              className="btn btn-primary"
              style={{
                fontSize: '0.84rem',
                fontWeight: 800,
                padding: '9px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)',
                backgroundColor: '#8b5cf6',
                cursor: allMacroLoading || lotMacroLoading || valueMacroLoading ? 'not-allowed' : 'pointer',
              }}
              title="Tổng hợp tự động cả Số Lot và Giá Trị Giao Dịch MS & CQG"
            >
              {allMacroLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Chạy Macro...</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Tổng Hợp Toàn Bộ</span>
                </>
              )}
            </button>

            {/* Nút 2: Thống Kê Số Lot */}
            <button
              type="button"
              onClick={handleLotMacro}
              disabled={allMacroLoading || lotMacroLoading || valueMacroLoading}
              className="btn btn-primary"
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                backgroundColor: '#3b82f6',
                cursor: allMacroLoading || lotMacroLoading || valueMacroLoading ? 'not-allowed' : 'pointer',
              }}
              title="Khởi chạy Excel Macro Thống kê Số Lot"
            >
              {lotMacroLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Chạy...</span>
                </>
              ) : (
                <>
                  <Layers size={16} />
                  <span>Thống kê Số Lot</span>
                </>
              )}
            </button>

            {/* Nút 3: Thống Kê Giá Trị */}
            <button
              type="button"
              onClick={handleValueMacro}
              disabled={allMacroLoading || lotMacroLoading || valueMacroLoading}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                fontWeight: 700,
                padding: '9px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                borderRadius: '8px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                borderColor: 'rgba(245, 158, 11, 0.4)',
                color: '#f59e0b',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.2)',
                cursor: allMacroLoading || lotMacroLoading || valueMacroLoading ? 'not-allowed' : 'pointer',
              }}
              title="Khởi chạy Excel Macro Thống kê Giá Trị"
            >
              {valueMacroLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Đang Chạy...</span>
                </>
              ) : (
                <>
                  <DollarSign size={16} />
                  <span>Thống kê Giá Trị</span>
                </>
              )}
            </button>

            {/* Nút 4: Đường dẫn tệp (Drawer) */}
            <button
              type="button"
              onClick={() => setShowPaths(!showPaths)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                fontWeight: 600,
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                borderRadius: '8px',
                color: showPaths ? '#3b82f6' : 'var(--text-secondary)',
                borderColor: showPaths ? '#3b82f6' : 'var(--border-color)',
                backgroundColor: showPaths ? 'rgba(59, 130, 246, 0.1)' : undefined,
                cursor: 'pointer',
              }}
              title="Xem thông tin đường dẫn sổ sách và tệp Excel Macro"
            >
              <Folder size={15} color={showPaths ? '#3b82f6' : '#f59e0b'} />
              <span style={{ fontSize: '0.78rem' }}>Đường dẫn tệp</span>
            </button>

            {/* Nút 5: Làm mới */}
            <button
              type="button"
              onClick={fetchMacroJobs}
              disabled={loadingJobs}
              className="btn btn-secondary"
              style={{
                padding: '9px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '8px',
                color: 'var(--text-muted)',
                cursor: loadingJobs ? 'not-allowed' : 'pointer',
              }}
              title="Làm mới tiến trình"
            >
              <RefreshCw size={15} className={loadingJobs ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Thông báo nếu phiên đang chọn đã có kết quả hoàn tất */}
        {latestJobForSelectedDate && (
          <div
            style={{
              padding: '12px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Info size={18} color="#3b82f6" />
              <div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Phiên {selectedDate} đã có kết quả Macro hoàn tất
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                  ({getJobDisplayName(latestJobForSelectedDate.jobType).label} — {latestJobForSelectedDate.createdAt ? new Date(latestJobForSelectedDate.createdAt).toLocaleTimeString('vi-VN') : '--'})
                </span>
              </div>
            </div>
            <span style={{ fontSize: '0.76rem', color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={14} /> Đã ghi tệp Excel thành công
            </span>
          </div>
        )}

        {/* Thông tin cấu hình đường dẫn đích & Tệp Macro (Drawer thu gọn) */}
        {showPaths && (
          <div className="glass-panel" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Folder size={17} color="#f59e0b" />
                <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  Đường dẫn Sổ sách & Tệp Macro Thống kê MS - CQG
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
              {/* Hàng 1: Thống kê số Lot */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                  {isLotFile ? <FileSpreadsheet size={15} color="#10b981" /> : <Folder size={15} color="#f59e0b" />}
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {isLotFile ? 'Tệp Macro Thống kê Số Lot:' : 'Thư mục Sổ sách Số Lot:'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', wordBreak: 'break-all' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: lotDisplay ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {lotDisplay || '(Chưa thiết lập - Vui lòng vào Cấu hình tham số để cài đặt)'}
                  </span>
                  {lotStatPath && lotStatPath !== lotDisplay && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Mount máy chủ: {lotStatPath}
                    </span>
                  )}
                </div>
              </div>

              {/* Hàng 2: Thống kê Giá trị */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 14px', borderRadius: '8px', backgroundColor: 'var(--bg-input)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                  {isValueFile ? <FileSpreadsheet size={15} color="#10b981" /> : <Folder size={15} color="#f59e0b" />}
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {isValueFile ? 'Tệp Macro Thống kê Giá Trị (.xlsm):' : 'Thư mục Thống kê Giá Trị:'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', wordBreak: 'break-all' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: valDisplay ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {valDisplay || '(Chưa thiết lập - Vui lòng vào Cấu hình tham số để cài đặt)'}
                  </span>
                  {valueStatPath && valueStatPath !== valDisplay && (
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Mount máy chủ: {valueStatPath}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lịch sử thực thi gần đây */}
        <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header & Bộ lọc nhanh trạng thái */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--text-muted)" />
                <strong style={{ fontSize: '0.86rem', color: 'var(--text-primary)' }}>
                  Tiến trình chạy Thống kê gần nhất
                </strong>
              </div>

              {/* Status Filter Chips */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: statusFilter === 'ALL' ? '#3b82f6' : 'var(--border-color)',
                    backgroundColor: statusFilter === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    color: statusFilter === 'ALL' ? '#3b82f6' : 'var(--text-secondary)',
                    fontWeight: statusFilter === 'ALL' ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Tất cả ({jobCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('COMPLETED')}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: statusFilter === 'COMPLETED' ? '#10b981' : 'var(--border-color)',
                    backgroundColor: statusFilter === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    color: statusFilter === 'COMPLETED' ? '#10b981' : 'var(--text-secondary)',
                    fontWeight: statusFilter === 'COMPLETED' ? 700 : 500,
                    cursor: 'pointer',
                  }}
                >
                  Hoàn thành ({jobCounts.completed})
                </button>
                {jobCounts.processing > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('PROCESSING')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid #3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    className="animate-pulse"
                  >
                    Đang chạy ({jobCounts.processing})
                  </button>
                )}
                {jobCounts.failed > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter('FAILED')}
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: statusFilter === 'FAILED' ? '#ef4444' : 'var(--border-color)',
                      backgroundColor: statusFilter === 'FAILED' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      color: statusFilter === 'FAILED' ? '#ef4444' : 'var(--text-secondary)',
                      fontWeight: statusFilter === 'FAILED' ? 700 : 500,
                      cursor: 'pointer',
                    }}
                  >
                    Lỗi ({jobCounts.failed})
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={fetchMacroJobs}
                disabled={loadingJobs}
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px', height: '26px' }}
                title="Làm mới danh sách tiến trình"
              >
                <RefreshCw size={11} className={loadingJobs ? 'animate-spin' : ''} />
                <span>Làm mới</span>
              </button>
              <Link
                href="/trading-manager/job-queue"
                className="btn btn-secondary"
                style={{ fontSize: '0.72rem', padding: '3px 9px', display: 'flex', alignItems: 'center', gap: '4px', height: '26px', textDecoration: 'none' }}
                title="Mở toàn bộ trang quản trị Hàng Đợi & Nhật Ký Robot"
              >
                <span>Hàng đợi logs</span>
                <ExternalLink size={11} />
              </Link>
            </div>
          </div>

          {filteredJobs.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              {statusFilter === 'ALL'
                ? 'Chưa có tác vụ Macro nào được ghi nhận gần đây.'
                : 'Không có tác vụ nào khớp với bộ lọc đã chọn.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Bảng cuộn mượt có giới hạn chiều cao & Sticky Header */}
              <div
                style={{
                  maxHeight: '230px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
                  <thead>
                    <tr style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '7px 10px', minWidth: '150px' }}>Loại tác vụ</th>
                      <th style={{ padding: '7px 10px', minWidth: '105px' }}>Trạng thái</th>
                      <th style={{ padding: '7px 10px', minWidth: '95px' }}>Phiên</th>
                      <th style={{ padding: '7px 10px', minWidth: '110px' }}>Thời gian</th>
                      <th style={{ padding: '7px 10px' }}>Chi tiết kết quả / Lỗi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedJobs.map((job) => {
                      const display = getJobDisplayName(job.jobType);
                      return (
                        <tr
                          key={job._id}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            transition: 'background-color 0.15s ease',
                          }}
                          className="hover-row"
                        >
                          <td style={{ padding: '7px 10px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor: display.bg,
                                color: display.color,
                                border: `1px solid ${display.border}`,
                              }}
                            >
                              {display.label}
                            </span>
                          </td>
                          <td style={{ padding: '7px 10px' }}>
                            {getJobStatusBadge(job.status)}
                          </td>
                          <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 600 }}>
                            {job.payload?.targetDate || job.payload?.date || '--'}
                          </td>
                          <td style={{ padding: '7px 10px', color: 'var(--text-secondary)' }}>
                            {job.createdAt ? new Date(job.createdAt).toLocaleTimeString('vi-VN') : '--'}
                          </td>
                          <td
                            style={{
                              padding: '7px 10px',
                              color: job.status === 'FAILED' ? '#ef4444' : 'var(--text-secondary)',
                              fontSize: '0.73rem',
                              maxWidth: '350px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={job.error || job.payload?.resultSummary || (job.status === 'COMPLETED' ? 'Đã hoàn tất ghi file Excel' : 'Đang xử lý...')}
                          >
                            {job.error || job.payload?.resultSummary || (job.status === 'COMPLETED' ? 'Đã hoàn tất ghi file Excel' : 'Đang xử lý...')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Thanh phân trang nhỏ gọn & đếm số lượng */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <span>
                  Hiển thị {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredJobs.length)} trên tổng số {filteredJobs.length} tác vụ
                </span>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="btn btn-secondary"
                      style={{ padding: '2px 6px', height: '22px', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}
                      title="Trang trước"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="btn btn-secondary"
                      style={{ padding: '2px 6px', height: '22px', fontSize: '0.7rem', display: 'flex', alignItems: 'center' }}
                      title="Trang tiếp theo"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
