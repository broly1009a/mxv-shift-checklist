'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
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
  ChevronDown,
  Globe,
  FileText,
  ScanLine,
  Scale,
  UserCheck,
  Database,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { tkgdApi } from '../../services/tkgd.api';
import { ExtractionLogItem } from '../../types/tkgd.types';

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
  const [activeTab, setActiveTab] = useState<'EXTRACTION' | 'ACTIVITY'>('EXTRACTION');

  // State cho Tab Bóc Tách & M-System
  const [extractionLogs, setExtractionLogs] = useState<ExtractionLogItem[]>([]);
  const [extLoading, setExtLoading] = useState(false);
  const [extPage, setExtPage] = useState(1);
  const [extTotalPages, setExtTotalPages] = useState(1);
  const [extTotal, setExtTotal] = useState(0);
  const [stageFilter, setStageFilter] = useState('ALL');
  const [extStatusFilter, setExtStatusFilter] = useState('ALL');
  const [extSearch, setExtSearch] = useState('');
  const [expandedExtId, setExpandedExtId] = useState<string | null>(null);

  // State cho Tab Thao Tác Người Dùng
  const [activityLogs, setActivityLogs] = useState<TkgdActivityLogItem[]>([]);
  const [actLoading, setActLoading] = useState(false);
  const [actPage, setActPage] = useState(1);
  const [actTotalPages, setActTotalPages] = useState(1);
  const [actTotal, setActTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [actStatusFilter, setActStatusFilter] = useState('ALL');
  const [actSearch, setActSearch] = useState('');
  const [expandedActId, setExpandedActId] = useState<string | null>(null);

  // 1. Tải log bóc tách & cào M-System
  const fetchExtractionLogs = useCallback(async () => {
    if (!isOpen) return;
    setExtLoading(true);
    try {
      const res = await tkgdApi.getAllExtractionLogs(
        {
          page: extPage,
          limit: 15,
          stage: stageFilter,
          status: extStatusFilter,
          search: extSearch.trim() || undefined,
        },
        token,
        user?.email
      );
      setExtractionLogs(res.data || []);
      setExtTotal(res.total || 0);
      setExtTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Lỗi khi tải nhật ký bóc tách:', err);
    } finally {
      setExtLoading(false);
    }
  }, [isOpen, extPage, stageFilter, extStatusFilter, extSearch, token, user?.email]);

  // 2. Tải log thao tác hệ thống
  const fetchActivityLogs = useCallback(async () => {
    if (!isOpen) return;
    setActLoading(true);
    try {
      const res = await tkgdApi.getActivityLogs(
        {
          page: actPage,
          limit: 15,
          action: actionFilter,
          status: actStatusFilter,
          search: actSearch.trim() || undefined,
        },
        token,
        user?.email
      );
      setActivityLogs(res.data || []);
      setActTotal(res.total || 0);
      setActTotalPages(res.pages || 1);
    } catch (err) {
      console.error('Lỗi khi tải nhật ký tác vụ:', err);
    } finally {
      setActLoading(false);
    }
  }, [isOpen, actPage, actionFilter, actStatusFilter, actSearch, token, user?.email]);

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'EXTRACTION') {
        fetchExtractionLogs();
      } else {
        fetchActivityLogs();
      }
    }
  }, [isOpen, activeTab, fetchExtractionLogs, fetchActivityLogs]);

  // Đóng bằng phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '-';
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
    } catch {
      return '-';
    }
  };

  const renderStageIcon = (stage: string) => {
    switch (stage) {
      case 'MAIL_INGEST':
        return <Mail size={15} className="text-blue-400" />;
      case 'EXTRACT_CONTRACT':
        return <FileText size={15} className="text-purple-400" />;
      case 'EXTRACT_CCCD':
        return <ScanLine size={15} className="text-cyan-400" />;
      case 'SCRAPE_MSYSTEM':
        return <Globe size={15} className="text-indigo-400" />;
      case 'RECONCILE':
        return <Scale size={15} className="text-amber-400" />;
      case 'MANUAL_OVERRIDE':
        return <UserCheck size={15} className="text-emerald-400" />;
      default:
        return <Database size={15} className="text-slate-400" />;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.25)',
            }}
          >
            <CheckCircle2 size={12} />
            THÀNH CÔNG
          </span>
        );
      case 'WARNING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <AlertTriangle size={12} />
            CẢNH BÁO
          </span>
        );
      case 'ERROR':
      case 'FAILED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
            }}
          >
            <AlertCircle size={12} />
            LỖI
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
              borderRadius: '9999px',
              fontSize: '0.65rem',
              fontWeight: 700,
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.25)',
            }}
          >
            <Info size={12} />
            THÔNG TIN
          </span>
        );
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
          width: '1050px',
          maxWidth: '100%',
          maxHeight: '92vh',
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
                  Trung Tâm Kiểm Toán & Nhật Ký TKGD (Audit Logs)
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
                  Enterprise Audit
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Truy vết toàn diện lịch sử nạp email, trích xuất HĐ, bóc tách CCCD, cào M-System và phê duyệt hồ sơ
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={activeTab === 'EXTRACTION' ? fetchExtractionLogs : fetchActivityLogs}
              disabled={activeTab === 'EXTRACTION' ? extLoading : actLoading}
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
              <RefreshCw size={14} className={(activeTab === 'EXTRACTION' ? extLoading : actLoading) ? 'animate-spin text-blue-500' : ''} />
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

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          <button
            onClick={() => setActiveTab('EXTRACTION')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'EXTRACTION' ? 700 : 500,
              backgroundColor: activeTab === 'EXTRACTION' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'EXTRACTION' ? '#3b82f6' : 'var(--text-secondary)',
              border: activeTab === 'EXTRACTION' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <Layers size={14} />
            Bóc Tách & Cào M-System ({extTotal})
          </button>
          <button
            onClick={() => setActiveTab('ACTIVITY')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: activeTab === 'ACTIVITY' ? 700 : 500,
              backgroundColor: activeTab === 'ACTIVITY' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: activeTab === 'ACTIVITY' ? '#3b82f6' : 'var(--text-secondary)',
              border: activeTab === 'ACTIVITY' ? '1px solid #3b82f6' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            <User size={14} />
            Thao Tác Người Dùng ({actTotal})
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* NỘI DUNG TAB 1: BÓC TÁCH & M-SYSTEM                      */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'EXTRACTION' && (
          <>
            {/* Bộ lọc Tab Bóc Tách */}
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
                    maxWidth: '340px',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Tìm theo mã TKGD, tiêu đề, TVKD..."
                    value={extSearch}
                    onChange={(e) => setExtSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchExtractionLogs();
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
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value);
                    setExtPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">Tất cả các chặng</option>
                  <option value="SCRAPE_MSYSTEM">Cào M-System</option>
                  <option value="MAIL_INGEST">Nạp Email</option>
                  <option value="EXTRACT_CONTRACT">Trích xuất HĐ</option>
                  <option value="EXTRACT_CCCD">OCR CCCD</option>
                  <option value="RECONCILE">Đối soát 3 bên</option>
                  <option value="MANUAL_OVERRIDE">Phê duyệt tay</option>
                </select>

                <select
                  value={extStatusFilter}
                  onChange={(e) => {
                    setExtStatusFilter(e.target.value);
                    setExtPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="WARNING">Cảnh báo</option>
                  <option value="ERROR">Lỗi</option>
                </select>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tổng cộng: <strong style={{ color: 'var(--text-primary)' }}>{extTotal}</strong> sự kiện
              </div>
            </div>

            {/* Danh sách Log Bóc Tách */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
              }}
            >
              {extLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin text-blue-500" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải nhật ký bóc tách & cào M-System...</p>
                </div>
              ) : extractionLogs.length === 0 ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy bản ghi bóc tách nào phù hợp với bộ lọc hiện tại.
                  </p>
                </div>
              ) : (
                extractionLogs.map((log, index) => {
                  const logId = log.id || log._id || String(index);
                  const isExpanded = expandedExtId === logId;

                  return (
                    <div
                      key={logId}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Dòng tóm tắt */}
                      <div
                        onClick={() => setExpandedExtId(isExpanded ? null : logId)}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          gap: '12px',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-input)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {renderStageIcon(log.stage)}
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                  color: '#3b82f6',
                                  fontFamily: 'monospace',
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                }}
                              >
                                {log.maTKGD}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: 700,
                                  color: 'var(--text-primary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {log.title}
                              </span>
                              {renderStatusBadge(log.status)}
                            </div>

                            {log.details && (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {formatDate(log.createdAt)}
                            </div>
                            {log.performer && (
                              <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                                Bởi: {log.performer}
                              </div>
                            )}
                          </div>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>

                      {/* Chi tiết khi mở rộng */}
                      {isExpanded && (
                        <div
                          style={{
                            padding: '14px 16px',
                            borderTop: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                          }}
                        >
                          {/* 10 Thẻ Chip DOM M-System thực tế */}
                          {log.rawInputsLog && log.rawInputsLog.length > 0 && (
                            <div>
                              <span style={{ fontWeight: 700, color: '#38bdf8', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>
                                Toàn bộ các trường DOM đọc trực tiếp từ màn hình M-System ({log.rawInputsLog.length} trường):
                              </span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {log.rawInputsLog.map((inp, iIdx) => (
                                  <div
                                    key={iIdx}
                                    style={{
                                      padding: '4px 8px',
                                      borderRadius: '6px',
                                      backgroundColor: 'rgba(56, 189, 248, 0.08)',
                                      border: '1px solid rgba(56, 189, 248, 0.25)',
                                      color: 'var(--text-primary)',
                                      fontFamily: 'monospace',
                                      fontSize: '0.7rem',
                                    }}
                                  >
                                    {inp}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Dữ liệu trích xuất có cấu trúc */}
                          {log.extractedData && Object.keys(log.extractedData).length > 0 && (
                            <div>
                              <span style={{ fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '6px' }}>
                                Dữ liệu bóc tách có cấu trúc (Structured Payload):
                              </span>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: '12px',
                                  borderRadius: '8px',
                                  backgroundColor: 'var(--bg-surface)',
                                  border: '1px solid var(--border-color)',
                                  fontSize: '0.7rem',
                                  color: 'var(--text-secondary)',
                                  overflowX: 'auto',
                                  maxHeight: '220px',
                                }}
                              >
                                {JSON.stringify(log.extractedData, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Phân trang Tab Bóc Tách */}
            <div
              style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Trang {extPage} / {extTotalPages}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={extPage <= 1}
                  onClick={() => setExtPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: extPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: extPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={extPage >= extTotalPages}
                  onClick={() => setExtPage((p) => Math.min(extTotalPages, p + 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: extPage >= extTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: extPage >= extTotalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════ */}
        {/* NỘI DUNG TAB 2: THAO TÁC NGƯỜI DÙNG                      */}
        {/* ══════════════════════════════════════════════════════════ */}
        {activeTab === 'ACTIVITY' && (
          <>
            {/* Bộ lọc Tab Thao Tác */}
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
                    maxWidth: '340px',
                  }}
                >
                  <Search size={14} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Tìm theo hành động, người dùng, chi tiết..."
                    value={actSearch}
                    onChange={(e) => setActSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchActivityLogs();
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
                    setActPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">Tất cả hành động</option>
                  <option value="SYNC_MAIL">Nạp Email</option>
                  <option value="SYNC_MSYSTEM">Đồng bộ M-System</option>
                  <option value="RUN_RECONCILIATION">Chạy Đối Soát</option>
                  <option value="MANUAL_APPROVE">Duyệt Tay</option>
                  <option value="REPARSE_ACCOUNT">Quét Lại Hồ Sơ</option>
                </select>

                <select
                  value={actStatusFilter}
                  onChange={(e) => {
                    setActStatusFilter(e.target.value);
                    setActPage(1);
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.78rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="SUCCESS">Thành công</option>
                  <option value="WARNING">Cảnh báo</option>
                  <option value="FAILED">Thất bại</option>
                </select>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tổng cộng: <strong style={{ color: 'var(--text-primary)' }}>{actTotal}</strong> bản ghi
              </div>
            </div>

            {/* Danh sách Activity Logs */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                backgroundColor: 'var(--bg-app)',
              }}
            >
              {actLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={24} className="animate-spin text-blue-500" style={{ margin: '0 auto 12px' }} />
                  <p style={{ margin: 0, fontSize: '0.85rem' }}>Đang tải nhật ký thao tác...</p>
                </div>
              ) : activityLogs.length === 0 ? (
                <div
                  style={{
                    padding: '40px',
                    textAlign: 'center',
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '12px',
                    border: '1px dashed var(--border-color)',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy nhật ký thao tác nào.
                  </p>
                </div>
              ) : (
                activityLogs.map((log) => {
                  const isExpanded = expandedActId === log._id;

                  return (
                    <div
                      key={log._id}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        borderRadius: '10px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        onClick={() => setExpandedActId(isExpanded ? null : log._id)}
                        style={{
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          gap: '12px',
                          userSelect: 'none',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--bg-input)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <User size={15} className="text-slate-400" />
                          </div>

                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {log.title}
                              </span>
                              {renderStatusBadge(log.status)}
                            </div>
                            {log.details && (
                              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {log.details}
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                              {formatDate(log.createdAt)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: '#64748b' }}>
                              {log.userEmail}
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </div>
                      </div>

                      {isExpanded && log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div
                          style={{
                            padding: '12px 16px',
                            borderTop: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                          }}
                        >
                          <pre
                            style={{
                              margin: 0,
                              fontSize: '0.7rem',
                              color: 'var(--text-secondary)',
                              overflowX: 'auto',
                              maxHeight: '180px',
                            }}
                          >
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Phân trang Tab Thao Tác */}
            <div
              style={{
                padding: '12px 24px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Trang {actPage} / {actTotalPages}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  disabled={actPage <= 1}
                  onClick={() => setActPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: actPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: actPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  disabled={actPage >= actTotalPages}
                  onClick={() => setActPage((p) => Math.min(actTotalPages, p + 1))}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    color: actPage >= actTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: actPage >= actTotalPages ? 'not-allowed' : 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
