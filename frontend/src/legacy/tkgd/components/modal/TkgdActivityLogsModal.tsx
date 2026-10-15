'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  User,
  Layers,
  Mail,
  Server,
  Settings,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { tkgdApi } from '../../services/tkgd.api';

interface TkgdActivityLogItem {
  _id: string;
  action: string;
  title: string;
  details: string;
  status: 'SUCCESS' | 'FAILED' | 'WARNING' | 'INFO';
  userEmail: string;
  userName?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

interface TkgdActivityLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TkgdActivityLogsModal: React.FC<TkgdActivityLogsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState<TkgdActivityLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const res = await tkgdApi.getActivityLogs(
        {
          page,
          limit: 15,
          action: actionFilter,
          status: statusFilter,
          search: search.trim() || undefined,
        },
        token,
        user?.email
      );
      setLogs(res.data || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Lỗi khi tải nhật ký tác vụ TKGD:', err);
    } finally {
      setLoading(false);
    }
  }, [isOpen, page, actionFilter, statusFilter, search, token, user?.email]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'SYNC_MAIL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <Mail size={12} />
            Nạp Email
          </span>
        );
      case 'SYNC_MSYSTEM':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <Server size={12} />
            Cào M-System
          </span>
        );
      case 'RUN_PIPELINE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: '#6366f1',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <Layers size={12} />
            Chu Trình Toàn Bộ
          </span>
        );
      case 'REPARSE_ACCOUNT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(234, 88, 12, 0.12)',
              color: '#ea580c',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <RefreshCw size={12} />
            Bóc Tách Lại
          </span>
        );
      case 'MANUAL_APPROVE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#059669',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <ShieldCheck size={12} />
            Duyệt Tay
          </span>
        );
      case 'REVERT_APPROVE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            Hủy Duyệt Tay
          </span>
        );
      case 'CONFIG_UPDATE':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(147, 51, 234, 0.12)',
              color: '#9333ea',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            <Settings size={12} />
            Cấu Hình Bot
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              backgroundColor: 'rgba(100, 116, 139, 0.12)',
              color: 'var(--text-secondary)',
              fontSize: '0.72rem',
              fontWeight: 600,
            }}
          >
            {action}
          </span>
        );
    }
  };

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${day}/${month}/${year} ${h}:${m}:${s}`;
    } catch {
      return '-';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '950px',
          maxWidth: '100%',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                  }}
                >
                  Nhật Ký Tác Vụ TKGD (Audit Logs)
                </h3>
                <span
                  style={{
                    fontSize: '0.65rem',
                    padding: '1px 6px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    fontWeight: 700,
                  }}
                >
                  Độc Lập TTBT
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Truy vết toàn bộ lịch sử nạp email, cào M-System, đối soát và phê duyệt hồ sơ của phân hệ
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Làm mới danh sách log"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} className={loading ? 'animate-spin text-blue-500' : ''} />
            </button>
            <button
              onClick={onClose}
              title="Đóng cửa sổ"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Thanh tìm kiếm & Bộ lọc */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                width: '100%',
                maxWidth: '320px',
              }}
            >
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Tìm theo tiêu đề, tài khoản, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') fetchLogs();
                }}
                style={{
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '0.78rem',
                  color: 'var(--text-primary)',
                  width: '100%',
                }}
              />
            </div>

            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                fontSize: '0.76rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Tất cả hành động</option>
              <option value="SYNC_MAIL">Nạp Email Outlook</option>
              <option value="SYNC_MSYSTEM">Cào M-System</option>
              <option value="RUN_PIPELINE">Chu Trình Toàn Bộ</option>
              <option value="REPARSE_ACCOUNT">Bóc Tách Lại</option>
              <option value="MANUAL_APPROVE">Phê Duyệt Tay</option>
              <option value="REVERT_APPROVE">Hủy Duyệt Tay</option>
              <option value="CONFIG_UPDATE">Cập Nhật Cấu Hình</option>
            </select>
          </div>

          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Tổng cộng: <strong style={{ color: 'var(--text-primary)' }}>{total}</strong> bản ghi
          </div>
        </div>

        {/* Danh sách bản ghi Log */}
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '550px' }}>
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin text-blue-500" style={{ margin: '0 auto 10px' }} />
              <p style={{ margin: 0, fontSize: '0.8rem' }}>Đang tải nhật ký tác vụ TKGD...</p>
            </div>
          ) : logs.length === 0 ? (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <p style={{ margin: 0, fontSize: '0.82rem' }}>Chưa có bản ghi nhật ký tác vụ nào phù hợp.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-app)',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '10px 16px', width: '150px' }}>Thời Gian</th>
                  <th style={{ padding: '10px 16px', width: '140px' }}>Hành Động</th>
                  <th style={{ padding: '10px 16px' }}>Nội Dung Chi Tiết</th>
                  <th style={{ padding: '10px 16px', width: '170px' }}>Tài Khoản</th>
                  <th style={{ padding: '10px 16px', width: '90px', textAlign: 'center' }}>Trạng Thái</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === item._id ? null : item._id)}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        cursor: 'pointer',
                        backgroundColor:
                          expandedId === item._id ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(item.createdAt)}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{renderActionBadge(item.action)}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
                          {item.title}
                        </div>
                        <div
                          style={{
                            color: 'var(--text-secondary)',
                            fontSize: '0.74rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '380px',
                          }}
                        >
                          {item.details}
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontSize: '0.74rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} style={{ color: 'var(--text-muted)' }} />
                          <span>{item.userEmail || 'Hệ thống'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            backgroundColor:
                              item.status === 'SUCCESS'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : item.status === 'FAILED'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(245, 158, 11, 0.12)',
                            color:
                              item.status === 'SUCCESS'
                                ? '#10b981'
                                : item.status === 'FAILED'
                                ? '#ef4444'
                                : '#f59e0b',
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                    </tr>
                    {expandedId === item._id && item.metadata && Object.keys(item.metadata).length > 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          style={{
                            padding: '12px 24px',
                            backgroundColor: 'var(--bg-app)',
                            borderBottom: '1px solid var(--border-color)',
                          }}
                        >
                          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                            DỮ LIỆU ĐÍNH KÈM (METADATA):
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: '8px 12px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border-color)',
                              fontSize: '0.72rem',
                              fontFamily: 'monospace',
                              color: 'var(--text-secondary)',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(item.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer & Phân trang */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Trang {page} / {totalPages || 1}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '0.74rem',
                color: page <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={14} />
              Trước
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                fontSize: '0.74rem',
                color: page >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
              }}
            >
              Sau
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
