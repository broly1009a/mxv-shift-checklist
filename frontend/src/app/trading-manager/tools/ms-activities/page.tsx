'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Download,
  Save,
  CheckCircle2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowLeft,
  Filter,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ingressApi } from '@/services/api/ingress.api';
import { API_ENDPOINTS } from '@/services/api/endpoints';

interface ActivityItem {
  _id: string;
  memberCode?: string;
  memberName?: string;
  username: string;
  ipAddress?: string;
  action: string;
  datetime: number;
  description?: string;
  sessionDate?: string;
  note?: string;
}

export default function MsActivitiesPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helper khởi tạo ngày VN hôm nay
  const getTodayVn = () => {
    const d = new Date();
    const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    return vnDate.toISOString().split('T')[0];
  };

  const [startDate, setStartDate] = useState<string>(getTodayVn);
  const [endDate, setEndDate] = useState<string>(getTodayVn);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [syncingBackup, setSyncingBackup] = useState<boolean>(false);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [totalRows, setTotalRows] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fullscreen handlers
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

  // Format timestamp epoch sang chuỗi ngày giờ VN
  const formatDateTime = (epochMs?: number) => {
    if (!epochMs) return '-';
    const d = new Date(epochMs);
    if (isNaN(d.getTime())) return '-';
    const vnDate = new Date(d.getTime() + 7 * 60 * 60 * 1000);
    const day = String(vnDate.getUTCDate()).padStart(2, '0');
    const month = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    const year = vnDate.getUTCFullYear();
    const hours = String(vnDate.getUTCHours()).padStart(2, '0');
    const mins = String(vnDate.getUTCMinutes()).padStart(2, '0');
    const secs = String(vnDate.getUTCSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}:${secs}`;
  };

  // Tải dữ liệu từ API
  const fetchActivities = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      setNotification(null);
      try {
        const res = await ingressApi.getMsActivities(
          {
            startDate,
            endDate,
            page: targetPage,
            limit,
            search: searchTerm,
          },
          token,
        );

        if (res?.success) {
          setActivities(res.data || []);
          setTotalRows(res.pagination?.totalRows || 0);
          setTotalPages(res.pagination?.totalPages || 1);
          setPage(res.pagination?.page || targetPage);
        } else {
          setNotification({ type: 'error', message: res?.message || 'Không thể tải nhật ký thao tác.' });
        }
      } catch (err: any) {
        setNotification({ type: 'error', message: err.message || 'Lỗi kết nối tới máy chủ.' });
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate, page, limit, searchTerm, token],
  );

  useEffect(() => {
    fetchActivities(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  // Xử lý Submit tìm kiếm
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities(1);
  };

  // Tải file Excel trực tiếp về máy
  const handleExportExcel = async () => {
    setExporting(true);
    setNotification(null);
    try {
      const query = new URLSearchParams();
      if (startDate) query.append('startDate', startDate);
      if (endDate) query.append('endDate', endDate);
      if (searchTerm) query.append('search', searchTerm);

      const downloadUrl = `${API_ENDPOINTS.INGRESS.MS_ACTIVITIES_EXPORT}?${query.toString()}`;

      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Lỗi tải file Excel từ máy chủ`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NKTTHT_${startDate}_${endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setNotification({
        type: 'success',
        message: 'Đã xuất và tải file Excel NKTTHT thành công!',
      });
    } catch (err: any) {
      setNotification({ type: 'error', message: `Lỗi xuất file: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  // Lưu file vào thư mục Backup Ca trực
  const handleSyncToBackup = async () => {
    setSyncingBackup(true);
    setNotification(null);
    try {
      const res = await ingressApi.syncMsActivitiesToBackup(
        {
          startDate,
          endDate,
          sessionDate: endDate,
        },
        token,
      );

      if (res?.success) {
        setNotification({
          type: 'success',
          message: res.message || 'Đã lưu file NKTTHT.xlsx thành công vào thư mục Backup ca trực!',
        });
      } else {
        setNotification({ type: 'error', message: res?.message || 'Lỗi lưu file vào thư mục Backup.' });
      }
    } catch (err: any) {
      setNotification({ type: 'error', message: `Lỗi đồng bộ Backup: ${err.message}` });
    } finally {
      setSyncingBackup(false);
    }
  };

  const startRecord = totalRows === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, totalRows);

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          minHeight: '100%',
          backgroundColor: isFullscreen ? 'var(--bg-app)' : 'transparent',
          padding: isFullscreen ? '20px' : '0',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: 'var(--text-primary)',
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
                  color: '#3b82f6',
                }}
              >
                CÔNG CỤ ĐỘC LẬP (M-SYSTEM REST API)
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
              Nhật ký thao tác hệ thống (NKTTHT)
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={handleExportExcel}
              disabled={exporting || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                cursor: exporting || loading ? 'not-allowed' : 'pointer',
                opacity: exporting || loading ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={15} />
              <span>{exporting ? 'Đang xuất Excel...' : 'Tải File Excel (Đầy đủ)'}</span>
            </button>

            <button
              onClick={handleSyncToBackup}
              disabled={syncingBackup || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: syncingBackup || loading ? 'not-allowed' : 'pointer',
                opacity: syncingBackup || loading ? 0.6 : 1,
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              title="Lưu file NKTTHT.xlsx trực tiếp vào thư mục Backup M-System trên máy chủ"
            >
              <Save size={15} />
              <span>{syncingBackup ? 'Đang lưu vào Server...' : 'Lưu vào thư mục Backup'}</span>
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <Link
              href="/trading-manager/backup/ms-cqg"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={15} />
              <span>Backup MS – CQG</span>
            </Link>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              border: notification.type === 'success' ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
              backgroundColor: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: notification.type === 'success' ? '#10b981' : '#ef4444',
              fontWeight: 600,
            }}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
            ) : (
              <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0 }} />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <form
          onSubmit={handleSearch}
          className="glass-panel"
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Thời gian thực hiện:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: '7px 12px',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 320px', maxWidth: '520px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm người thực hiện, thao tác, mô tả, IP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 12px 7px 32px',
                  fontSize: '0.82rem',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              <Filter size={14} />
              <span>Lọc</span>
            </button>

            <button
              type="button"
              onClick={() => fetchActivities(1)}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '7px 10px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-secondary)',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              title="Làm mới dữ liệu"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </form>

        {/* Data Table */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 310px)', minHeight: '380px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.74rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <th style={{ padding: '12px 14px', width: '60px', textAlign: 'center' }}>STT</th>
                  <th style={{ padding: '12px 14px', width: '180px' }}>Người thực hiện</th>
                  <th style={{ padding: '12px 14px', width: '220px' }}>Thao tác</th>
                  <th style={{ padding: '12px 14px', minWidth: '280px', color: '#3b82f6' }}>Mô tả (Bổ sung)</th>
                  <th style={{ padding: '12px 14px', width: '180px', textAlign: 'center' }}>Thời gian thực hiện</th>
                  <th style={{ padding: '12px 14px', width: '180px' }}>Ghi chú / IP</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={18} className="animate-spin" color="#3b82f6" />
                        <span>Đang tải nhật ký thao tác từ M-System...</span>
                      </div>
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy bản ghi thao tác nào trong khoảng thời gian đã chọn.
                    </td>
                  </tr>
                ) : (
                  activities.map((item, idx) => {
                    const rowNumber = (page - 1) * limit + idx + 1;
                    return (
                      <tr
                        key={item._id || idx}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.04)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td
                          style={{
                            padding: '11px 14px',
                            textAlign: 'center',
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                          }}
                        >
                          {rowNumber}
                        </td>
                        <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                color: '#3b82f6',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              {item.username.charAt(0).toUpperCase()}
                            </span>
                            <span>{item.username}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.76rem',
                              fontWeight: 600,
                              backgroundColor: 'rgba(255, 255, 255, 0.04)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            {item.action}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                          {item.description || '-'}
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            textAlign: 'center',
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDateTime(item.datetime)}
                        </td>
                        <td
                          style={{
                            padding: '11px 14px',
                            fontFamily: 'monospace',
                            fontSize: '0.78rem',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {item.note ? item.note : item.ipAddress ? `IP: ${item.ipAddress}` : '-'}
                          {item.memberName && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'inherit' }}>
                              {item.memberName}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div
            style={{
              padding: '12px 18px',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Số dòng mỗi trang:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  outline: 'none',
                }}
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                {totalRows > 0 ? (
                  <>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{startRecord.toLocaleString()}</span> to{' '}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{endRecord.toLocaleString()}</span> of{' '}
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalRows.toLocaleString()}</span>
                  </>
                ) : (
                  '0 to 0 of 0'
                )}
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  onClick={() => fetchActivities(1)}
                  disabled={page <= 1 || loading}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 || loading ? 0.35 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Trang đầu"
                >
                  <ChevronsLeft size={14} />
                </button>

                <button
                  onClick={() => fetchActivities(page - 1)}
                  disabled={page <= 1 || loading}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: page <= 1 || loading ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 || loading ? 0.35 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Trang trước"
                >
                  <ChevronLeft size={14} />
                </button>

                <span style={{ padding: '0 8px', fontWeight: 600 }}>
                  Page <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{page}</span> of{' '}
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{totalPages}</span>
                </span>

                <button
                  onClick={() => fetchActivities(page + 1)}
                  disabled={page >= totalPages || loading}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages || loading ? 0.35 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Trang sau"
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  onClick={() => fetchActivities(totalPages)}
                  disabled={page >= totalPages || loading}
                  style={{
                    padding: '5px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: page >= totalPages || loading ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages || loading ? 0.35 : 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  title="Trang cuối"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
