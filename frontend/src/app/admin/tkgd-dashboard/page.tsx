'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';
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
} from 'lucide-react';

interface CleanRecord {
  _id: string;
  batchDate: string;
  maTVKD: string;
  maTKGD?: string;
  maTKGDBase?: string;
  accountType?: 'FUTURES' | 'ACM' | 'LME' | 'SPREAD';
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
  ms?: {
    maTKGD?: string;
    tenTKGD?: string;
    hoVaTen?: string;
    soCMND_HoChieu?: string;
    ngaySinh?: string;
    trangThai?: string;
    isFoundOnMS?: boolean;
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
  const { user, token } = useAuth();

  const [records, setRecords] = useState<CleanRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'KHOP' | 'LECH' | 'FUTURES' | 'ACM' | 'LME' | 'SPREAD'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchRecords = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const url = `${API_BASE_URL}/api/v1/tkgd/records?limit=50&filter=${filter !== 'ALL' ? filter : ''}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || '',
        },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setTotal(data.total || 0);
      }
    } catch (err: any) {
      toast.error('Không thể tải dữ liệu đối soát: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [token, filter]);

  // Kích hoạt chạy đối soát
  const handleRunReconcile = async () => {
    setRunning(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/tkgd/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-user-email': user?.email || '',
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Đối soát thành công! Khớp: ${data.summary.khopCount}, Lệch: ${data.summary.lechCount}`);
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

  // Filter records by search term & active filter tab
  const filteredRecords = records.filter((r) => {
    // 1. Lọc theo tab phân hệ / trạng thái
    const targetCode = r.maTKGD || r.ms?.maTKGD || r.noiDungMail?.maTKGD_Futures || r.noiDungMail?.maTKGD_ACM || '';
    const detectedType = r.accountType || (targetCode.endsWith('-A') ? 'ACM' : targetCode.endsWith('-L') ? 'LME' : targetCode.endsWith('-S') ? 'SPREAD' : 'FUTURES');

    if (filter === 'KHOP' && r.ketLuan?.trangThai !== 'KHOP') return false;
    if (filter === 'LECH' && (r.ketLuan?.trangThai === 'KHOP' || r.ketLuan?.trangThai === 'CHUA_XU_LY')) return false;
    if (filter === 'FUTURES' && detectedType !== 'FUTURES') return false;
    if (filter === 'ACM' && detectedType !== 'ACM') return false;
    if (filter === 'LME' && detectedType !== 'LME') return false;
    if (filter === 'SPREAD' && detectedType !== 'SPREAD') return false;

    // 2. Tìm kiếm từ khóa
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const code = targetCode.toLowerCase();
    const nameMail = (r.noiDungMail?.tenTaiKhoan || '').toLowerCase();
    const nameMs = (r.ms?.hoVaTen || r.ms?.tenTKGD || '').toLowerCase();
    const cccd = (r.ms?.soCMND_HoChieu || '').toLowerCase();
    return code.includes(term) || nameMail.includes(term) || nameMs.includes(term) || cccd.includes(term);
  });

  const khopCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP').length;
  const lechCount = records.filter((r) => r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'CHUA_XU_LY').length;
  const chuaXuLyCount = records.length - khopCount - lechCount;

  return (
    <ProtectedRoute>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          minHeight: '100vh',
          color: 'var(--text-primary)',
          padding: '24px 32px',
        }}
        className="animate-fade-in"
      >
        {/* Page Header */}
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
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
            </div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <FileSpreadsheet color="#10b981" size={26} />
              Giám sát & Đối soát mở tài khoản giao dịch
            </h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              So khớp tự động 3 chiều giữa <strong>Email yêu cầu</strong>, <strong>Hồ sơ M-System</strong> (Futures, ACM, LME, Spread) và xuất file Excel chuẩn template <code>Auto Data mail.xlsm</code>.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={fetchRecords}
              disabled={loading}
              title="Làm mới dữ liệu"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>

            <button
              onClick={handleRunReconcile}
              disabled={running}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                cursor: running ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              {running ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
              <span>{running ? 'Đang đối soát...' : 'Chạy Đối Soát Ngay'}</span>
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Card 1: Tổng */}
          <div
            className="glass-panel"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '14px',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Tổng Hồ Sơ
              </span>
              <Users size={18} color="#3b82f6" />
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 2px 0' }}>
              {records.length}
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Đã lưu trong MongoDB</span>
          </div>

          {/* Card 2: Khớp */}
          <div
            className="glass-panel"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '14px',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
                Khớp Hoàn Toàn
              </span>
              <CheckCircle2 size={18} color="#10b981" />
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', margin: '8px 0 2px 0' }}>
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
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>
                Có Sai Lệch
              </span>
              <AlertTriangle size={18} color="#ef4444" />
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', margin: '8px 0 2px 0' }}>
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
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                Chờ Đối Soát
              </span>
              <Clock size={18} color="#f59e0b" />
            </div>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f59e0b', margin: '8px 0 2px 0' }}>
              {chuaXuLyCount}
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cần bấm chạy đối soát</span>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
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
          {/* Tab buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            {[
              { id: 'ALL', label: `Tất Cả (${records.length})` },
              { id: 'KHOP', label: `Khớp 100% (${khopCount})`, color: '#10b981' },
              { id: 'LECH', label: `Sai Lệch (${lechCount})`, color: '#ef4444' },
            ].map((t) => {
              const active = filter === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id as any)}
                  style={{
                    padding: '6px 12px',
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
                  onClick={() => setFilter(t.id as any)}
                  style={{
                    padding: '6px 12px',
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

          {/* Search Input */}
          <div style={{ position: 'relative', width: '280px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm mã TK, tên KH, số CCCD..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                fontSize: '0.8rem',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Data Table */}
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
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '14px 16px', width: '50px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '14px 16px' }}>Mã TKGD</th>
                  <th style={{ padding: '14px 16px' }}>Phân Hệ Sàn</th>
                  <th style={{ padding: '14px 16px' }}>Tên Trên Mail</th>
                  <th style={{ padding: '14px 16px' }}>Họ & Tên Trên MS</th>
                  <th style={{ padding: '14px 16px' }}>Số CCCD / CMT</th>
                  <th style={{ padding: '14px 16px' }}>Trạng Thái MS</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Lịch Sử Snapshot</th>
                  <th style={{ padding: '14px 16px', textAlign: 'center' }}>Kết Luận Đối Soát</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Loader2 size={24} className="animate-spin text-emerald-500" style={{ margin: '0 auto 8px auto' }} />
                      <span>Đang tải danh sách hồ sơ...</span>
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy hồ sơ đối soát nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((r, index) => {
                    const isKhop = r.ketLuan?.trangThai === 'KHOP';
                    const isLech = r.ketLuan?.trangThai && r.ketLuan?.trangThai !== 'KHOP' && r.ketLuan?.trangThai !== 'CHUA_XU_LY';
                    const targetCode = r.maTKGD || r.ms?.maTKGD || r.noiDungMail?.maTKGD_Futures || r.noiDungMail?.maTKGD_ACM || '-';
                    const accountType = r.accountType || (targetCode.endsWith('-A') ? 'ACM' : targetCode.endsWith('-L') ? 'LME' : targetCode.endsWith('-S') ? 'SPREAD' : 'FUTURES');

                    const getBadge = (type: string) => {
                      switch (type) {
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
                    const badge = getBadge(accountType);

                    return (
                      <tr
                        key={r._id}
                        style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {index + 1}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#3b82f6' }}>
                          {targetCode}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>
                          {r.noiDungMail?.tenTaiKhoan || '-'}
                        </td>
                        <td style={{ padding: '14px 16px', color: r.ms?.hoVaTen ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {r.ms?.hoVaTen || <em>Chưa cào MS</em>}
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          {r.ms?.soCMND_HoChieu || '-'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {r.ms?.trangThai ? (
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.7rem',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {r.ms.trangThai}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {r.snapshots && r.snapshots.length > 0 ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                color: '#8b5cf6',
                                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                                border: '1px solid rgba(139, 92, 246, 0.25)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                              }}
                              title={`Đã chụp ${r.snapshots.length} lần snapshot`}
                            >
                              <Camera size={12} /> {r.snapshots.length} bản
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          {isKhop ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.3)',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <Check size={13} strokeWidth={3} /> KHỚP 100%
                            </span>
                          ) : isLech ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              <X size={13} strokeWidth={3} /> LỆCH DỮ LIỆU
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '3px 10px',
                                borderRadius: '20px',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                color: '#f59e0b',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                fontWeight: 700,
                                fontSize: '0.72rem',
                              }}
                            >
                              CHỜ ĐỐI SOÁT
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
