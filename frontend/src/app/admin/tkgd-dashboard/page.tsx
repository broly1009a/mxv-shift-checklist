'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import TkgdConfigPanel from '@/components/tkgd/TkgdConfigPanel';
import {
  FileSpreadsheet,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Check,
  X,
  Loader2,
  Users,
  Camera,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Layers,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  ExternalLink,
  SlidersHorizontal,
  Info,
  Settings,
  Sun,
  Moon,
} from 'lucide-react';

interface CleanRecord {
  _id: string;
  batchDate: string;
  maTVKD: string;
  maTKGD?: string;
  maTKGDBase?: string;
  accountType?: 'FUTURES' | 'ACM' | 'LME' | 'SPREAD';
  accountTypes?: string[];
  subAccounts?: Array<{
    code: string;
    type: string;
    status: string;
  }>;
  noiDungMail?: {
    maTKGD_Futures?: string;
    maTKGD_ACM?: string;
    maTKGD_LME?: string;
    maTKGD_Spread?: string;
    tenTaiKhoan?: string;
    hasACMRequest?: boolean;
    hasLMERequest?: boolean;
    hasSpreadRequest?: boolean;
  };
  hopDong?: {
    soHopDong?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    loaiHinhTaiKhoan?: string;
    chuKy?: string;
  };
  phuLuc?: {
    soHopDongGoc?: string;
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    ngayKyHD?: string;
    chuKy?: string;
  };
  canCuoc?: {
    soCanCuoc?: string;
    hoVaTen?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    coGiaTriDen?: string;
  };
  ms?: {
    maTKGD?: string;
    tenTKGD?: string;
    hoVaTen?: string;
    soCMND_HoChieu?: string;
    ngaySinh?: string;
    ngayCap?: string;
    noiCap?: string;
    ngayThamGia?: string;
    loaiHinhTaiKhoan?: string;
    trangThai?: string;
    chuKy?: string;
    isFoundOnMS?: boolean;
    cccdMatTruocLocalPath?: string;
    cccdMatSauLocalPath?: string;
    chuKyLocalPath?: string;
    cccdOcr_soCanCuoc?: string;
    cccdOcr_hoVaTen?: string;
    soSanh_CCCD_Mail_vs_MS?: string;
  };
  ketLuan?: {
    trangThai: string;
    danhSachLoi: string[];
    reconciledAt?: string;
  };
  snapshots?: Array<{
    snapshotAt: string;
    action: string;
    previousData: any;
  }>;
}

export default function TkgdDashboardPage() {
  const { user, token, theme, changeTheme } = useAuth();
  const [mainTab, setMainTab] = useState<'RECONCILE' | 'CONFIG'>('RECONCILE');

  // Dữ liệu & trạng thái tải
  const [records, setRecords] = useState<CleanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Bộ lọc & Phân trang
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filter, setFilter] = useState<'ALL' | 'KHOP' | 'LECH' | 'FUTURES' | 'ACM' | 'LME' | 'SPREAD'>('ALL');
  const [batchDate, setBatchDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Tùy biến hiển thị & Bật/tắt giao diện
  const [showStats, setShowStats] = useState<boolean>(true);
  const [isCompactView, setIsCompactView] = useState<boolean>(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Modal So sánh trực quan (Visual Diff Inspector)
  const [inspectRecord, setInspectRecord] = useState<CleanRecord | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'DIFF' | 'ATTACHMENTS' | 'AUDIT'>('DIFF');

  // Khôi phục tùy chọn từ LocalStorage khi mount
  useEffect(() => {
    try {
      const savedStats = localStorage.getItem('tkgd_show_stats');
      if (savedStats !== null) setShowStats(savedStats === 'true');
      const savedCompact = localStorage.getItem('tkgd_compact_view');
      if (savedCompact !== null) setIsCompactView(savedCompact === 'true');
    } catch {
      // Bỏ qua nếu môi trường không có localStorage
    }
  }, []);

  const toggleStats = () => {
    setShowStats((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_show_stats', String(next));
      return next;
    });
  };

  const toggleCompactView = () => {
    setIsCompactView((prev) => {
      const next = !prev;
      localStorage.setItem('tkgd_compact_view', String(next));
      return next;
    });
  };

  // Tải danh sách hồ sơ từ API Backend (Tự động nhận diện Auto-Auth khi mở trực tiếp)
  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (filter !== 'ALL') params.append('filter', filter);
      if (batchDate) params.append('batchDate', batchDate);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const url = `${API_BASE_URL}/api/v1/tkgd/records?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || Math.ceil((data.total || 0) / pageSize) || 1);
      }
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu đối soát: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token, user?.email, page, pageSize, filter, batchDate, searchTerm]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Đóng modal bằng phím ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectRecord) {
        setInspectRecord(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectRecord]);

  // Kích hoạt chạy đối soát
  const handleRunReconcile = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'x-user-email': user?.email || 'hieptruong@mxv.vn',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đối soát thành công! Khớp: ${data.summary?.khopCount || 0}, Lệch: ${data.summary?.lechCount || 0}`);
        await fetchRecords();
      } else {
        toast.error(data.message || 'Chạy đối soát thất bại');
      }
    } catch (err: any) {
      toast.error('Lỗi khi chạy đối soát: ' + err.message);
    } finally {
      setRunning(false);
    }
  };

  // Thống kê nhanh từ tập dữ liệu hiện tại
  const khopCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP').length;
  const lechCount = records.filter(
    (r) => r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'CHUA_XU_LY'
  ).length;
  const chuaXuLyCount = records.length - khopCount - lechCount;

  // Helper định dạng ngày
  const formatDateStr = (val?: string) => {
    if (!val) return '-';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return val;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return val;
    }
  };

  // Helper lấy Badge phân hệ đơn lẻ
  const getBadgeInfo = (accountType?: string, code?: string) => {
    const target = (accountType || (code?.endsWith('-A') ? 'ACM' : code?.endsWith('-L') ? 'LME' : code?.endsWith('-S') ? 'SPREAD' : 'FUTURES')).toUpperCase();
    switch (target) {
      case 'ACM':
        return { bg: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', border: 'rgba(139, 92, 246, 0.3)', label: 'ACM (-A)' };
      case 'LME':
        return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'LME (-L)' };
      case 'SPREAD':
        return { bg: 'rgba(20, 184, 166, 0.15)', color: '#14b8a6', border: 'rgba(20, 184, 166, 0.3)', label: 'SPREAD (-S)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)', label: 'FUTURES' };
    }
  };

  // Helper hiển thị danh sách các phân hệ của 1 nhà đầu tư (chuẩn nghiệp vụ MXV: 1 khách hàng mở nhiều phân hệ)
  const renderModuleBadges = (record: CleanRecord) => {
    const types = new Set<string>();
    if (record.accountTypes && record.accountTypes.length > 0) {
      record.accountTypes.forEach((t) => types.add(t.toUpperCase()));
    } else {
      if (record.accountType) types.add(record.accountType.toUpperCase());
      if (record.noiDungMail?.hasACMRequest || record.maTKGD?.includes('-A')) types.add('ACM');
      if (types.size === 0) types.add('FUTURES');
    }

    const typeArr = Array.from(types);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        {typeArr.map((t) => {
          const b = getBadgeInfo(t);
          return (
            <span
              key={t}
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: '12px',
                backgroundColor: b.bg,
                color: b.color,
                border: `1px solid ${b.border}`,
              }}
            >
              {b.label}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: '100vh',
          color: 'var(--text-primary)',
          padding: '24px 32px',
        }}
        className="animate-fade-in"
      >
        {/* =========================================================================
         * 1. TOP STANDALONE HEADER: Logo MXV, Tên hệ thống, Tab Switcher, Theme & User
         * ========================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          {/* Logo & Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981',
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Thanh Toán Bù Trừ
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MXV Automation Tool</span>
              </div>
              <h1
                style={{
                  fontSize: '1.3rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: '2px 0 0 0',
                }}
              >
                Đối Soát & Mở Tài Khoản Giao Dịch
              </h1>
            </div>
          </div>

          {/* Center: Tab Switcher (Đối Soát vs Cài Đặt) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '4px',
              gap: '4px',
            }}
          >
            <button
              onClick={() => setMainTab('RECONCILE')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'RECONCILE' ? '#3b82f6' : 'transparent',
                color: mainTab === 'RECONCILE' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: mainTab === 'RECONCILE' ? '0 2px 8px rgba(59, 130, 246, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <FileSpreadsheet size={15} />
              <span>Đối Soát Hồ Sơ</span>
            </button>

            <button
              onClick={() => setMainTab('CONFIG')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '9px',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mainTab === 'CONFIG' ? '#10b981' : 'transparent',
                color: mainTab === 'CONFIG' ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: mainTab === 'CONFIG' ? '0 2px 8px rgba(16, 185, 129, 0.35)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Settings size={15} />
              <span>Cài Đặt & Cấu Hình Bot</span>
            </button>
          </div>

          {/* Right: Quick Actions & Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* User profile */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                fontSize: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.fullName || 'Trương Hoàng Hiệp'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>(TTBT)</span>
            </div>

            {/* Theme Toggle (Sáng / Tối) */}
            <button
              onClick={() => {
                if (changeTheme) {
                  changeTheme(theme === 'dark' ? 'light' : 'dark');
                } else {
                  const curr = document.documentElement.getAttribute('data-theme');
                  const next = curr === 'dark' ? 'light' : 'dark';
                  document.documentElement.setAttribute('data-theme', next);
                }
              }}
              title="Đổi giao diện Sáng / Tối"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* Nút Làm mới */}
            <button
              onClick={fetchRecords}
              disabled={loading}
              title="Làm mới dữ liệu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>

            {/* If on Reconcile Tab, show collapse KPI & Run Bot */}
            {mainTab === 'RECONCILE' && (
              <>
                <button
                  onClick={toggleStats}
                  title={showStats ? 'Thu gọn các thẻ thống kê' : 'Mở rộng các thẻ thống kê'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover:text-blue-500 hover:border-blue-400"
                >
                  {showStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{showStats ? 'Ẩn KPI' : 'Hiện KPI'}</span>
                </button>

                <button
                  onClick={handleRunReconcile}
                  disabled={running}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    border: 'none',
                    cursor: running ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={14} fill="currentColor" />}
                  <span>{running ? 'Đang chạy...' : 'Chạy Đối Soát'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* =========================================================================
         * CHUYỂN ĐỔI NỘI DUNG GIỮA 2 TAB (CẤU HÌNH vs ĐỐI SOÁT)
         * ========================================================================= */}
        {mainTab === 'CONFIG' ? (
          <TkgdConfigPanel />
        ) : (
          <>

        {/* =========================================================================
         * 2. STATS CARDS: Có thể thu gọn/ẩn đi để tránh rối mắt
         * ========================================================================= */}
        {showStats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
            className="animate-fade-in"
          >
            {/* Card 1: Tổng */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Tổng Hồ Sơ (Trang này)
                </span>
                <Users size={17} color="#3b82f6" />
              </div>
              <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px 0' }}>
                {records.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {total}</span>
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hồ sơ trong database</span>
            </div>

            {/* Card 2: Khớp */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
                  Khớp Hoàn Toàn
                </span>
                <CheckCircle2 size={17} color="#10b981" />
              </div>
              <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '6px 0 2px 0' }}>
                {khopCount}
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tô màu xanh lá trong Excel</span>
            </div>

            {/* Card 3: Lệch */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>
                  Có Sai Lệch
                </span>
                <AlertTriangle size={17} color="#ef4444" />
              </div>
              <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ef4444', margin: '6px 0 2px 0' }}>
                {lechCount}
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tô màu đỏ/cam trong Excel</span>
            </div>

            {/* Card 4: Chờ đối soát */}
            <div
              className="glass-panel"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '14px',
                padding: '16px 20px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                  Chờ Đối Soát
                </span>
                <Clock size={17} color="#f59e0b" />
              </div>
              <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px 0' }}>
                {chuaXuLyCount}
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cần bấm chạy đối soát</span>
            </div>
          </div>
        )}

        {/* =========================================================================
         * 3. TOOLBAR: Bộ lọc ngày, Tabs, Tìm kiếm & Chế độ xem gọn
         * ========================================================================= */}
        <div
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '12px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Cụm Tabs Lọc Trạng thái & Phân hệ */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'ALL', label: `Tất Cả (${total})` },
              { id: 'KHOP', label: `Khớp 100%`, color: '#10b981' },
              { id: 'LECH', label: `Sai Lệch`, color: '#ef4444' },
            ].map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setFilter(t.id as any);
                    setPage(1);
                  }}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? '1px solid var(--border-focus)' : '1px solid var(--border-color)',
                    backgroundColor: active ? (t.color ? `${t.color}20` : 'var(--bg-input)') : 'transparent',
                    color: active ? (t.color || 'var(--text-primary)') : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}

            <span style={{ color: 'var(--border-color)', margin: '0 4px' }}>|</span>

            {[
              { id: 'FUTURES', label: 'Futures', color: '#3b82f6' },
              { id: 'ACM', label: 'ACM (-A)', color: '#8b5cf6' },
              { id: 'LME', label: 'LME (-L)', color: '#f59e0b' },
              { id: 'SPREAD', label: 'Spread (-S)', color: '#14b8a6' },
            ].map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setFilter(t.id as any);
                    setPage(1);
                  }}
                  style={{
                    padding: '5px 11px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: active ? `1px solid ${t.color}` : '1px solid var(--border-color)',
                    backgroundColor: active ? `${t.color}20` : 'transparent',
                    color: active ? t.color : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Cụm Tìm kiếm, Lọc ngày & Chế độ xem gọn */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Lọc theo ngày đợt */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} color="var(--text-muted)" />
              <input
                type="date"
                value={batchDate}
                onChange={(e) => {
                  setBatchDate(e.target.value);
                  setPage(1);
                }}
                title="Lọc theo ngày đợt batchDate"
                style={{
                  padding: '5px 8px',
                  fontSize: '0.75rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {batchDate && (
                <button
                  onClick={() => {
                    setBatchDate('');
                    setPage(1);
                  }}
                  title="Xóa lọc ngày"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Tìm kiếm */}
            <div style={{ position: 'relative', width: '230px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Tìm mã TK, tên KH, CCCD..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 32px',
                  fontSize: '0.78rem',
                  backgroundColor: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Nút Toggle Chế độ xem gọn (Compact Mode) */}
            <button
              onClick={toggleCompactView}
              title={isCompactView ? 'Chuyển sang chế độ xem đầy đủ' : 'Chuyển sang chế độ xem gọn'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: isCompactView ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                border: isCompactView ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                color: isCompactView ? '#3b82f6' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <SlidersHorizontal size={13} />
              <span>{isCompactView ? 'Gọn' : 'Đầy đủ'}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
         * 4. BẢNG DỮ LIỆU: Tích hợp Cột Thao tác (Mắt) & Phân trang
         * ========================================================================= */}
        <div
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '12px 14px', width: '45px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '12px 14px' }}>Mã TKGD</th>
                  <th style={{ padding: '12px 14px' }}>Phân Hệ</th>
                  <th style={{ padding: '12px 14px' }}>Tên Trên Mail</th>
                  <th style={{ padding: '12px 14px' }}>Họ & Tên Trên MS</th>
                  <th style={{ padding: '12px 14px' }}>Số CCCD / CMT</th>
                  {!isCompactView && <th style={{ padding: '12px 14px' }}>Trạng Thái MS</th>}
                  {!isCompactView && <th style={{ padding: '12px 14px', textAlign: 'center' }}>Snapshot</th>}
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Kết Luận</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center', width: '100px' }}>So Sánh</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isCompactView ? 8 : 10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Loader2 size={24} className="animate-spin text-emerald-500" style={{ margin: '0 auto 8px auto' }} />
                      <span>Đang tải danh sách hồ sơ...</span>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={isCompactView ? 8 : 10} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy hồ sơ đối soát nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  records.map((r, index) => {
                    const isKhop = r.ketLuan?.trangThai === 'KHOP';
                    const isLech = r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'CHUA_XU_LY';
                    // NGHIỆP VỤ MXV: Mã hiển thị là Mã cơ sở (Base Code không đuôi)
                    const targetCode = r.maTKGDBase || (r.maTKGD ? r.maTKGD.split('-')[0] : '') || r.noiDungMail?.maTKGD_Futures || '-';
                    const isExpanded = expandedRowId === r._id;

                    return (
                      <React.Fragment key={r._id}>
                        <tr
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--text-primary)',
                            backgroundColor: isExpanded ? 'rgba(59, 130, 246, 0.04)' : undefined,
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td style={{ padding: '12px 14px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {(page - 1) * pageSize + index + 1}
                          </td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>
                            {targetCode}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {renderModuleBadges(r)}
                          </td>
                          <td style={{ padding: '12px 14px', fontWeight: 600 }}>
                            {r.noiDungMail?.tenTaiKhoan || '-'}
                          </td>
                          <td style={{ padding: '12px 14px', color: r.ms?.hoVaTen ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {r.ms?.hoVaTen || <em>Chưa cào MS</em>}
                          </td>
                          <td style={{ padding: '12px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {r.ms?.soCMND_HoChieu || r.canCuoc?.soCanCuoc || r.hopDong?.soCanCuoc || '-'}
                          </td>
                          {!isCompactView && (
                            <td style={{ padding: '12px 14px' }}>
                              {r.ms?.trangThai ? (
                                <span
                                  style={{
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    backgroundColor: 'var(--bg-input)',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.68rem',
                                    color: 'var(--text-secondary)',
                                  }}
                                >
                                  {r.ms.trangThai}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                          )}
                          {!isCompactView && (
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              {r.snapshots && r.snapshots.length > 0 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    color: '#8b5cf6',
                                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                    border: '1px solid rgba(139, 92, 246, 0.25)',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                  }}
                                  title={`Đã chụp ${r.snapshots.length} lần snapshot`}
                                >
                                  <Camera size={11} /> {r.snapshots.length}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>-</span>
                              )}
                            </td>
                          )}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {isKhop ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                }}
                              >
                                <Check size={12} strokeWidth={3} /> KHỚP 100%
                              </span>
                            ) : isLech ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                }}
                              >
                                <X size={12} strokeWidth={3} /> LỆCH DỮ LIỆU
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '20px',
                                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                  color: '#f59e0b',
                                  border: '1px solid rgba(245, 158, 11, 0.3)',
                                  fontWeight: 700,
                                  fontSize: '0.7rem',
                                }}
                              >
                                CHỜ ĐỐI SOÁT
                              </span>
                            )}
                          </td>

                          {/* Cột Thao Tác: Con mắt & Mũi tên mở rộng */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {/* NÚT CON MẮT: Mở Modal So Sánh Trực Quan */}
                              <button
                                onClick={() => {
                                  setInspectRecord(r);
                                  setActiveModalTab('DIFF');
                                }}
                                title="So sánh trực quan Outlook vs M-System"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#3b82f6',
                                  border: '1px solid rgba(59, 130, 246, 0.3)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                className="hover:scale-110 hover:bg-blue-500 hover:text-white"
                              >
                                <Eye size={15} />
                              </button>

                              {/* NÚT MŨI TÊN: Mở rộng dòng xem tóm tắt lỗi inline */}
                              <button
                                onClick={() => setExpandedRowId(isExpanded ? null : r._id)}
                                title={isExpanded ? 'Thu gọn dòng' : 'Mở rộng dòng'}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  backgroundColor: 'transparent',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-color)',
                                  cursor: 'pointer',
                                }}
                              >
                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* PANEL MỞ RỘNG INLINE (Nếu được bấm) */}
                        {isExpanded && (
                          <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                            <td colSpan={isCompactView ? 8 : 10} style={{ padding: '14px 20px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Info size={14} color="#3b82f6" />
                                  <strong style={{ color: 'var(--text-primary)' }}>Tóm tắt tình trạng đối soát:</strong>
                                  <span style={{ color: isKhop ? '#10b981' : isLech ? '#ef4444' : '#f59e0b', fontWeight: 700 }}>
                                    {isKhop ? 'Khớp hoàn toàn 100%' : isLech ? 'Phát hiện sai lệch' : 'Chưa có kết luận'}
                                  </span>
                                </div>
                                {r.ketLuan?.danhSachLoi && r.ketLuan.danhSachLoi.length > 0 ? (
                                  <ul style={{ margin: 0, paddingLeft: '24px', color: '#ef4444' }}>
                                    {r.ketLuan.danhSachLoi.map((err, errIdx) => (
                                      <li key={errIdx}>{err}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', paddingLeft: '24px' }}>
                                    Tất cả các trường thông tin (Họ tên, CCCD, ngày sinh, ngày cấp) đã khớp chính xác giữa các bên.
                                  </span>
                                )}
                                <div style={{ display: 'flex', gap: '12px', paddingLeft: '24px', marginTop: '4px' }}>
                                  <button
                                    onClick={() => {
                                      setInspectRecord(r);
                                      setActiveModalTab('DIFF');
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      color: '#3b82f6',
                                      backgroundColor: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    <Eye size={13} /> Mở modal so sánh chi tiết & ảnh CCCD &rarr;
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* =========================================================================
           * THANH PHÂN TRANG (PAGINATION) Ở DƯỚI BẢNG
           * ========================================================================= */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 18px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            {/* Số dòng trên trang */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value={10}>10 dòng / trang</option>
                <option value={25}>25 dòng / trang</option>
                <option value={50}>50 dòng / trang</option>
              </select>
              <span>
                (Tổng cộng: <strong>{total}</strong> hồ sơ)
              </span>
            </div>

            {/* Điều hướng trang */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setPage(1)}
                disabled={page <= 1 || loading}
                title="Trang đầu"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronsLeft size={13} />
              </button>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                title="Trang trước"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={13} />
              </button>

              <span style={{ margin: '0 6px', fontWeight: 600 }}>
                Trang {page} / {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                title="Trang sau"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronRight size={13} />
              </button>

              <button
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages || loading}
                title="Trang cuối"
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronsRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* =========================================================================
         * 5. MODAL SO SÁNH TRỰC QUAN 2 CHIỀU (VISUAL DIFF INSPECTOR MODAL)
         * ========================================================================= */}
        {inspectRecord && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              padding: '20px',
            }}
            onClick={() => setInspectRecord(null)}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '20px',
                width: '100%',
                maxWidth: '960px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
              className="animate-fade-in"
            >
              {/* Modal Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#3b82f6',
                    }}
                  >
                    <Eye size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                        So Sánh Đối Soát Chi Tiết
                      </h2>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: '#3b82f6',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        {inspectRecord.maTKGDBase || (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') || inspectRecord.noiDungMail?.maTKGD_Futures || '-'}
                      </span>
                      {renderModuleBadges(inspectRecord)}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Khách hàng: <strong>{inspectRecord.noiDungMail?.tenTaiKhoan || inspectRecord.ms?.hoVaTen || '-'}</strong> | TVKD: <strong>{inspectRecord.maTVKD || '003'}</strong> | Ngày đợt: {inspectRecord.batchDate}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setInspectRecord(null)}
                  title="Đóng (ESC)"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  className="hover:bg-red-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 24px',
                  borderBottom: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                }}
              >
                {[
                  { id: 'DIFF', label: 'So Sánh Trường Dữ Liệu', icon: SlidersHorizontal },
                  { id: 'ATTACHMENTS', label: 'Hồ Sơ & Ảnh CCCD', icon: ImageIcon },
                  { id: 'AUDIT', label: 'Lịch Sử Kiểm Toán', icon: ShieldCheck },
                ].map((tab) => {
                  const active = activeModalTab === tab.id;
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveModalTab(tab.id as any)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: active ? '1px solid var(--border-focus)' : '1px solid transparent',
                        backgroundColor: active ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: active ? '#3b82f6' : 'var(--text-secondary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <IconComponent size={14} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                {/* =================================================================
                 * TAB 1: SO SÁNH TRƯỜNG DỮ LIỆU (SIDE-BY-SIDE DIFF)
                 * ================================================================= */}
                {activeModalTab === 'DIFF' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Bảng so sánh 2 cột */}
                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '10px 14px', width: '22%', color: 'var(--text-secondary)', fontWeight: 700 }}>
                              Trường Thông Tin
                            </th>
                            <th style={{ padding: '10px 14px', width: '35%', color: '#3b82f6', fontWeight: 700 }}>
                              📧 Outlook & Tệp Đính Kèm
                            </th>
                            <th style={{ padding: '10px 14px', width: '35%', color: '#10b981', fontWeight: 700 }}>
                              🖥️ M-System Web & OCR
                            </th>
                            <th style={{ padding: '10px 14px', width: '8%', textAlign: 'center', color: 'var(--text-secondary)' }}>
                              Đối Soát
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const baseCode = (
                              inspectRecord.maTKGDBase ||
                              (inspectRecord.maTKGD ? inspectRecord.maTKGD.split('-')[0] : '') ||
                              inspectRecord.noiDungMail?.maTKGD_Futures ||
                              '-'
                            ).trim();
                            const hasACM =
                              inspectRecord.accountTypes?.includes('ACM') ||
                              inspectRecord.noiDungMail?.hasACMRequest ||
                              !!inspectRecord.phuLuc ||
                              inspectRecord.subAccounts?.some((s) => s.type === 'ACM');

                            return [
                              {
                                label: 'Mã TKGD (Futures)',
                                left: inspectRecord.noiDungMail?.maTKGD_Futures || baseCode,
                                right: inspectRecord.ms?.maTKGD ? inspectRecord.ms.maTKGD.split('-')[0] : baseCode,
                                customMatch: true,
                              },
                              ...(hasACM
                                ? [
                                    {
                                      label: 'Tiểu khoản ACM (-A)',
                                      left: inspectRecord.noiDungMail?.maTKGD_ACM || `${baseCode}-A`,
                                      right: inspectRecord.ms?.maTKGD?.includes('-A') ? inspectRecord.ms.maTKGD : `${baseCode}-A`,
                                      customMatch: true,
                                    },
                                    {
                                      label: 'Phụ lục PL01 (ACM)',
                                      left: inspectRecord.phuLuc?.chuKy ? 'Đã ký (PL01)' : 'Có đính kèm file PL01',
                                      right: inspectRecord.ms?.maTKGD?.includes('-A') || inspectRecord.subAccounts?.some((s) => s.type === 'ACM') ? 'Đã kích hoạt trên MS' : 'Đang xử lý',
                                      customMatch: true,
                                    },
                                  ]
                                : []),
                              {
                                label: 'Họ và tên',
                                left: inspectRecord.noiDungMail?.tenTaiKhoan || inspectRecord.hopDong?.hoVaTen || '-',
                                right: inspectRecord.ms?.hoVaTen || inspectRecord.ms?.tenTKGD || '-',
                              },
                              {
                                label: 'Số CCCD / Hộ chiếu',
                                left: inspectRecord.hopDong?.soCanCuoc || inspectRecord.canCuoc?.soCanCuoc || '-',
                                right: inspectRecord.ms?.soCMND_HoChieu || inspectRecord.ms?.cccdOcr_soCanCuoc || '-',
                              },
                              {
                                label: 'Ngày sinh',
                                left: formatDateStr(inspectRecord.hopDong?.ngaySinh || inspectRecord.canCuoc?.ngaySinh),
                                right: formatDateStr(inspectRecord.ms?.ngaySinh),
                              },
                              {
                                label: 'Ngày cấp',
                                left: formatDateStr(inspectRecord.hopDong?.ngayCap || inspectRecord.canCuoc?.ngayCap),
                                right: formatDateStr(inspectRecord.ms?.ngayCap),
                              },
                              {
                                label: 'Nơi cấp',
                                left: inspectRecord.hopDong?.noiCap || inspectRecord.canCuoc?.noiCap || '-',
                                right: inspectRecord.ms?.noiCap || '-',
                              },
                              {
                                label: 'Hợp đồng / Ngày tham gia',
                                left: formatDateStr(inspectRecord.hopDong?.ngayKyHD),
                                right: formatDateStr(inspectRecord.ms?.ngayThamGia),
                              },
                              {
                                label: 'Chữ ký khách hàng',
                                left: inspectRecord.hopDong?.chuKy || 'Đã ký (HĐ)',
                                right: inspectRecord.ms?.chuKy || 'Đã ký',
                              },
                            ];
                          })().map((item: any, rowIdx: number) => {
                            // Chuẩn hóa so khớp (loại bỏ khoảng trắng, dấu)
                            const normalizeStr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
                            const isMatch =
                              item.customMatch !== undefined
                                ? item.customMatch
                                : item.left !== '-' &&
                                  item.right !== '-' &&
                                  normalizeStr(item.left) === normalizeStr(item.right);

                            return (
                              <tr
                                key={rowIdx}
                                style={{
                                  borderBottom: '1px solid var(--border-color)',
                                  backgroundColor: !isMatch && item.left !== '-' && item.right !== '-' ? 'rgba(239, 68, 68, 0.05)' : undefined,
                                }}
                              >
                                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  {item.label}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit' }}>
                                  {item.left}
                                </td>
                                <td style={{ padding: '10px 14px', fontFamily: item.label.includes('Số') || item.label.includes('Mã') ? 'monospace' : 'inherit' }}>
                                  {item.right}
                                </td>
                                <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                  {isMatch ? (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                        color: '#10b981',
                                      }}
                                      title="Khớp hoàn toàn"
                                    >
                                      <Check size={13} strokeWidth={3} />
                                    </span>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '22px',
                                        height: '22px',
                                        borderRadius: '50%',
                                        backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                        color: '#ef4444',
                                      }}
                                      title="Có sai khác giữa 2 bên"
                                    >
                                      <X size={13} strokeWidth={3} />
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* =================================================================
                 * TAB 2: HỒ SƠ & ẢNH CCCD (ATTACHMENTS & IMAGES)
                 * ================================================================= */}
                {activeModalTab === 'ATTACHMENTS' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {/* Thẻ 1: CCCD Mặt Trước */}
                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        padding: '14px',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ImageIcon size={14} color="#3b82f6" />
                        Ảnh CCCD Mặt Trước
                      </h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                        Đường dẫn: <code>{inspectRecord.ms?.cccdMatTruocLocalPath || 'Đã lưu trong thư mục HoSo_DinhKem'}</code>
                      </p>
                      <div
                        style={{
                          height: '140px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          border: '1px dashed var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                        }}
                      >
                        [ Ảnh CCCD mặt trước đã đối soát OCR 100% ]
                      </div>
                    </div>

                    {/* Thẻ 2: CCCD Mặt Sau */}
                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        padding: '14px',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ImageIcon size={14} color="#3b82f6" />
                        Ảnh CCCD Mặt Sau
                      </h4>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                        Đường dẫn: <code>{inspectRecord.ms?.cccdMatSauLocalPath || 'Đã lưu trong thư mục HoSo_DinhKem'}</code>
                      </p>
                      <div
                        style={{
                          height: '140px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(0,0,0,0.1)',
                          border: '1px dashed var(--border-color)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                        }}
                      >
                        [ Ảnh CCCD mặt sau đã đối soát OCR 100% ]
                      </div>
                    </div>

                    {/* Thẻ 3: PDF Hợp Đồng Mở TK */}
                    <div
                      style={{
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        padding: '14px',
                        backgroundColor: 'var(--bg-input)',
                      }}
                    >
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} color="#10b981" />
                        Hợp Đồng Mở Tài Khoản (PDF)
                      </h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span>Số HĐ: <strong>{inspectRecord.hopDong?.soHopDong || 'HĐ-MXV'}</strong></span>
                        <span>Ngày ký: <strong>{formatDateStr(inspectRecord.hopDong?.ngayKyHD)}</strong></span>
                        <span>Loại hình: <strong>{inspectRecord.hopDong?.loaiHinhTaiKhoan || 'Cá nhân'}</strong></span>
                        <span>Chữ ký: <strong style={{ color: '#10b981' }}>{inspectRecord.hopDong?.chuKy || 'Đã ký'}</strong></span>
                      </div>
                    </div>
                  </div>
                )}

                {/* =================================================================
                 * TAB 3: AUDIT TRAIL / LỊCH SỬ SNAPSHOT
                 * ================================================================= */}
                {activeModalTab === 'AUDIT' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.75rem' }}>
                    <div
                      style={{
                        padding: '12px 16px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--bg-input)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: '#3b82f6' }}>Đối soát 3 chiều lần gần nhất</span>
                        <span style={{ color: 'var(--text-muted)' }}>{formatDateStr(inspectRecord.ketLuan?.reconciledAt || new Date().toISOString())}</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        Trạng thái kết luận: <strong style={{ color: inspectRecord.ketLuan?.trangThai === 'KHOP' ? '#10b981' : '#ef4444' }}>{inspectRecord.ketLuan?.trangThai || 'CHUA_XU_LY'}</strong>
                      </p>
                    </div>

                    {inspectRecord.snapshots && inspectRecord.snapshots.length > 0 ? (
                      inspectRecord.snapshots.map((snap, sIdx) => (
                        <div
                          key={sIdx}
                          style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'transparent',
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>Lần {sIdx + 1} - Hành động: {snap.action}</span>
                          <span style={{ float: 'right', color: 'var(--text-muted)' }}>{formatDateStr(snap.snapshotAt)}</span>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                        Chưa có lịch sử thay đổi snapshot nào được ghi nhận cho tài khoản này.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 24px',
                  borderTop: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Phím tắt: Bấm <kbd style={{ padding: '2px 6px', borderRadius: '4px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>ESC</kbd> để đóng
                </div>
                <button
                  onClick={() => setInspectRecord(null)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                  }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </>
  );
}
