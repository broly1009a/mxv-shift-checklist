'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Activity,
  RefreshCw,
  Sliders,
  Clock,
  Key,
  ArrowLeft,
  Server,
  CheckCircle2,
  Zap,
  Database,
  Bell,
  Save,
  X,
  ExternalLink,
  Layers,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

export type PartnerSubsystem = 'CORECCP' | 'COREEX' | 'MS' | 'CQG' | 'ACM';
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

export interface IPartnerHealthSummary {
  partner: PartnerSubsystem;
  health: HealthStatus;
  activeToken: boolean;
  tokenExpiresAt?: string | null;
  rpm: number;
  loginsLastMinute: number;
  consecutiveFailures: number;
  successRate: number;
  totalRequestsLastHour: number;
  lastSeenAt: string | null;
  lastError?: string;
}

export interface IPartnerTelemetryEvent {
  _id?: string;
  partner: PartnerSubsystem;
  eventType: 'LOGIN' | 'REFRESH_TOKEN' | 'API_REQUEST' | 'SFTP_CONNECT' | 'CIRCUIT_BREAKER';
  success: boolean;
  statusCode?: number;
  durationMs: number;
  account?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface IPartnerThresholds {
  maxLoginsPerMinute: number;
  consecutiveFailures: number;
  maxRpm: number;
}

export interface IPartnerMonitorConfig {
  enabled: boolean;
  recipients: string[];
  cooldownMinutes: number;
  thresholds: Record<PartnerSubsystem, IPartnerThresholds>;
}

const PARTNER_METADATA: Record<
  PartnerSubsystem,
  { name: string; description: string; protocol: string; authType: string }
> = {
  CORECCP: {
    name: 'CoreCCP (VNCLEAR)',
    description: 'Báo cáo Bù trừ & Ký quỹ Thanh toán Bù trừ',
    protocol: 'REST / Engine.IO v4',
    authType: 'OAuth2 4-Bước (AES Decrypt)',
  },
  COREEX: {
    name: 'CoreExchange',
    description: 'Báo cáo Giao dịch Khớp lệnh & Sổ lệnh Sở',
    protocol: 'REST JSON Inquiry',
    authType: 'OAuth2 Authorization Code',
  },
  MS: {
    name: 'M-System Newgen',
    description: 'Sao lưu Dữ liệu Giao dịch & Tỷ giá Quy đổi',
    protocol: 'REST API',
    authType: '2-Bước (Password + PIN -> JWT)',
  },
  CQG: {
    name: 'CQG Desktop Web',
    description: 'Báo cáo Khớp lệnh FR, Vị thế PS & Sổ lệnh Od',
    protocol: 'Chromium / Playwright',
    authType: 'Web UI Dual-State Router (Cache Profile)',
  },
  ACM: {
    name: 'ACM Straits SFTP',
    description: 'Đối chiếu Giao dịch Straits CSV Ngày Phiên T',
    protocol: 'SFTP (SSH2)',
    authType: 'SFTP Credentials (Port 22/2222)',
  },
};

export default function PartnerAuthMonitorPage() {
  const { token } = useAuth();

  // State dữ liệu
  const [healthSummaries, setHealthSummaries] = useState<IPartnerHealthSummary[]>([]);
  const [events, setEvents] = useState<IPartnerTelemetryEvent[]>([]);
  const [config, setConfig] = useState<IPartnerMonitorConfig | null>(null);

  // Filter & UI State
  const [selectedPartnerFilter, setSelectedPartnerFilter] = useState<string>('ALL');
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(5);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingConfig, setEditingConfig] = useState<IPartnerMonitorConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Fetch dữ liệu từ Backend
  const fetchData = useCallback(
    async (silent: boolean = false) => {
      if (!token) return;
      if (!silent) setIsRefreshing(true);

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const [healthRes, eventsRes, configRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/health`, { headers }),
          fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/events?limit=80`, { headers }),
          fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/config`, { headers }),
        ]);

        if (healthRes.ok) {
          const json = await healthRes.json();
          if (json.data) setHealthSummaries(json.data);
        }

        if (eventsRes.ok) {
          const json = await eventsRes.json();
          if (json.data) setEvents(json.data);
        }

        if (configRes.ok) {
          const json = await configRes.json();
          if (json.data) setConfig(json.data);
        }

        setLastUpdated(new Date());
      } catch (err: any) {
        if (!silent) {
          toast.error(`Không thể tải dữ liệu giám sát: ${err.message}`);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token],
  );

  // Polling tự động với AbortController
  useEffect(() => {
    fetchData();

    if (autoRefreshSec <= 0) return;

    const timer = setInterval(() => {
      fetchData(true);
    }, autoRefreshSec * 1000);

    return () => clearInterval(timer);
  }, [fetchData, autoRefreshSec]);

  // Lọc sự kiện theo đối tác
  const filteredEvents = useMemo(() => {
    if (selectedPartnerFilter === 'ALL') return events;
    return events.filter((e) => e.partner === selectedPartnerFilter);
  }, [events, selectedPartnerFilter]);

  // Mở modal cấu hình
  const handleOpenConfigModal = () => {
    if (config) {
      setEditingConfig(JSON.parse(JSON.stringify(config)));
    }
    setIsModalOpen(true);
  };

  // Lưu cấu hình
  const handleSaveConfig = async () => {
    if (!token || !editingConfig) return;
    setIsSavingConfig(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/config`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editingConfig),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json();
      setConfig(json.data);
      toast.success('Cập nhật ngưỡng giám sát & cảnh báo thành công!');
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(`Lỗi lưu cấu hình: ${err.message}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const renderHealthBadge = (health: HealthStatus) => {
    switch (health) {
      case 'HEALTHY':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            <ShieldCheck size={13} />
            Bình Thường
          </span>
        );
      case 'WARNING':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              color: '#f59e0b',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <AlertTriangle size={13} />
            Cảnh Báo
          </span>
        );
      case 'CRITICAL':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '9999px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.4)',
            }}
          >
            <XCircle size={13} />
            Nguy Hiểm
          </span>
        );
      default:
        return null;
    }
  };

  const renderEventTypeBadge = (type: string) => {
    const styleBase: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '3px 8px',
      borderRadius: '6px',
      fontSize: '0.72rem',
      fontWeight: 700,
    };
    switch (type) {
      case 'LOGIN':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <Key size={12} />
            LOGIN
          </span>
        );
      case 'REFRESH_TOKEN':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <RefreshCw size={12} />
            REFRESH
          </span>
        );
      case 'CIRCUIT_BREAKER':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <Zap size={12} />
            CIRCUIT BREAKER
          </span>
        );
      case 'SFTP_CONNECT':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(20, 184, 166, 0.12)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
            <Server size={12} />
            SFTP CONNECT
          </span>
        );
      default:
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            <Activity size={12} />
            API REQUEST
          </span>
        );
    }
  };

  return (
    <ProtectedRoute>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
        className="animate-fade-in"
      >
        {/* Header Bar */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            padding: '16px 20px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                href="/trading-manager"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#3b82f6')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)')}
              >
                <ArrowLeft size={14} />
                Quay lại Trading Manager
              </Link>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                Partner Auth Monitor
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Activity size={24} style={{ color: '#3b82f6' }} />
              Giám Sát Tần Suất Đăng Nhập & Yêu Cầu 5 Phân Hệ Đối Tác
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Kiểm soát lưu lượng xác thực thời gian thực, tự động phát hiện Login Storm và dập bão cảnh báo Email.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Auto-refresh Selector */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                backgroundColor: 'var(--bg-input, rgba(255,255,255,0.04))',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
              }}
            >
              <Clock size={14} style={{ color: 'var(--text-muted)' }} />
              <span>Tự động làm mới:</span>
              <select
                aria-label="Tự động làm mới dữ liệu"
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontWeight: 700,
                  color: '#3b82f6',
                  cursor: 'pointer',
                  outline: 'none',
                  fontSize: '0.78rem',
                }}
              >
                <option value={0} style={{ background: '#0f172a', color: '#fff' }}>Tắt</option>
                <option value={5} style={{ background: '#0f172a', color: '#fff' }}>5 giây</option>
                <option value={10} style={{ background: '#0f172a', color: '#fff' }}>10 giây</option>
                <option value={30} style={{ background: '#0f172a', color: '#fff' }}>30 giây</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={isRefreshing}
              className="btn btn-secondary"
              style={{
                fontSize: '0.78rem',
                padding: '7px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ color: isRefreshing ? '#3b82f6' : 'inherit' }} />
              Làm mới
            </button>

            {/* Settings Button */}
            <button
              onClick={handleOpenConfigModal}
              className="btn btn-primary"
              style={{
                fontSize: '0.78rem',
                padding: '7px 14px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
            >
              <Sliders size={14} />
              Cấu Hình Ngưỡng
            </button>
          </div>
        </div>

        {/* 5 Phân Hệ - Status KPI Cards Responsive Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '16px',
          }}
        >
          {(['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'] as PartnerSubsystem[]).map((partnerKey) => {
            const summary = healthSummaries.find((s) => s.partner === partnerKey);
            const meta = PARTNER_METADATA[partnerKey];
            const health = summary?.health || 'HEALTHY';

            const borderHighlight =
              health === 'CRITICAL'
                ? '1px solid rgba(239, 68, 68, 0.6)'
                : health === 'WARNING'
                ? '1px solid rgba(245, 158, 11, 0.6)'
                : '1px solid var(--border-color)';

            const bgHighlight =
              health === 'CRITICAL'
                ? 'rgba(239, 68, 68, 0.05)'
                : health === 'WARNING'
                ? 'rgba(245, 158, 11, 0.04)'
                : 'var(--bg-card)';

            return (
              <div
                key={partnerKey}
                className="glass-panel"
                style={{
                  padding: '16px',
                  borderRadius: '14px',
                  border: borderHighlight,
                  backgroundColor: bgHighlight,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                  transition: 'all 0.25s ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                    <div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {partnerKey}
                      </span>
                      <h3 style={{ margin: '2px 0 0 0', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {meta.name}
                      </h3>
                    </div>
                    {renderHealthBadge(health)}
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                    {meta.description}
                  </p>

                  {/* Metrics 2x2 Grid */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      padding: '10px',
                      backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Tần suất:</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {summary?.rpm || 0} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>RPM</span>
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Logins (60s):</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {summary?.loginsLastMinute || 0} <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>lượt</span>
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Tỷ lệ thành công:</span>
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color:
                            (summary?.successRate || 100) >= 90
                              ? '#10b981'
                              : (summary?.successRate || 100) >= 70
                              ? '#f59e0b'
                              : '#ef4444',
                        }}
                      >
                        {summary?.successRate ?? 100}%
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Lỗi liên tiếp:</span>
                      <span
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: (summary?.consecutiveFailures || 0) > 0 ? '#ef4444' : 'var(--text-primary)',
                        }}
                      >
                        {summary?.consecutiveFailures || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '8px',
                    fontSize: '0.72rem',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Xác thực:</span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '160px',
                      }}
                      title={meta.authType}
                    >
                      {meta.authType}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Tín hiệu cuối:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {summary?.lastSeenAt
                        ? new Date(summary.lastSeenAt).toLocaleTimeString('vi-VN')
                        : 'Chưa có'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Real-Time Telemetry Audit Log Stream */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header & Filter Tabs */}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Database size={18} style={{ color: '#3b82f6' }} />
                Nhật Ký Yêu Cầu & Xác Thực Thời Gian Thực (Audit Stream)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Hiển thị 80 sự kiện telemetry mới nhất từ In-Memory Ring Buffer & MongoDB. Tự động dọn sau 7 ngày.
              </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {['ALL', 'CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'].map((p) => {
                const isActive = selectedPartnerFilter === p;
                return (
                  <button
                    key={p}
                    onClick={() => setSelectedPartnerFilter(p)}
                    className={isActive ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.74rem',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {p === 'ALL' ? 'Tất cả phân hệ' : p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Table */}
          <div className="table-responsive-wrapper" style={{ margin: 0 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                    borderBottom: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <th style={{ padding: '12px 16px' }}>Thời Gian</th>
                  <th style={{ padding: '12px 16px' }}>Phân Hệ</th>
                  <th style={{ padding: '12px 16px' }}>Thao Tác</th>
                  <th style={{ padding: '12px 16px' }}>Trạng Thái</th>
                  <th style={{ padding: '12px 16px' }}>Độ Trễ</th>
                  <th style={{ padding: '12px 16px' }}>Tài Khoản / Người Dùng</th>
                  <th style={{ padding: '12px 16px' }}>Chi Tiết / Mã HTTP</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Chưa ghi nhận sự kiện nào trong bộ nhớ đệm.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((item, idx) => (
                    <tr
                      key={item._id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.04)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('vi-VN') : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {item.partner}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        {renderEventTypeBadge(item.eventType)}
                      </td>
                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                        {item.success ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 600 }}>
                            <CheckCircle2 size={14} />
                            Thành công
                          </span>
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontWeight: 600 }}>
                            <XCircle size={14} />
                            Thất bại
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {item.durationMs} ms
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {item.account || 'Hệ thống (Auto)'}
                      </td>
                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.errorMessage ? (
                          <span style={{ color: '#ef4444', fontWeight: 600 }} title={item.errorMessage}>
                            {item.errorMessage}
                          </span>
                        ) : item.statusCode ? (
                          <span style={{ color: 'var(--text-secondary)' }}>
                            HTTP {item.statusCode}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Cấu Hình Ngưỡng Cảnh Báo & Dập Bão Email */}
        {isModalOpen && editingConfig && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                borderRadius: '16px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Sliders size={20} style={{ color: '#3b82f6' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Cấu Hình Ngưỡng Giám Sát & Cảnh Báo Đối Tác
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Cơ chế Data-Driven 100%: Thay đổi tham số vận hành mà không cần sửa code.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '0.78rem' }}>
                {/* Master Switch & Cooldown */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '14px',
                    padding: '14px',
                    backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Bell size={14} style={{ color: '#3b82f6' }} />
                      Trạng thái Cảnh báo Email
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={editingConfig.enabled}
                        onChange={(e) =>
                          setEditingConfig({ ...editingConfig, enabled: e.target.checked })
                        }
                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 600, color: editingConfig.enabled ? '#10b981' : 'var(--text-muted)' }}>
                        {editingConfig.enabled ? 'Đang Bật (Enabled)' : 'Tạm Tắt (Disabled)'}
                      </span>
                    </label>
                  </div>

                  <div>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Clock size={14} style={{ color: '#3b82f6' }} />
                      Khoảng nghỉ Cooldown (Phút)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={editingConfig.cooldownMinutes}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          cooldownMinutes: Math.max(1, parseInt(e.target.value, 10) || 15),
                        })
                      }
                      className="form-input"
                      style={{ padding: '6px 10px', fontSize: '0.8rem', fontWeight: 700 }}
                    />
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Dập bão email: Khóa thông báo trùng lặp trong N phút.
                    </span>
                  </div>
                </div>

                {/* Email Recipients */}
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    Danh Sách Email Nhận Tin Cảnh Báo (Phân cách bởi dấu phẩy)
                  </label>
                  <input
                    type="text"
                    value={editingConfig.recipients.join(', ')}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        recipients: e.target.value
                          .split(',')
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.78rem', fontFamily: 'monospace' }}
                    placeholder="it.support@mxv.vn, trading.ops@mxv.vn"
                  />
                </div>

                {/* Thresholds Table */}
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                    Ngưỡng Giới Hạn Cụ Thể Từng Phân Hệ
                  </label>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '8px 12px' }}>Phân Hệ</th>
                          <th style={{ padding: '8px 12px' }}>Max Login / Phút</th>
                          <th style={{ padding: '8px 12px' }}>Lỗi Liên Tiếp</th>
                          <th style={{ padding: '8px 12px' }}>Max RPM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'] as PartnerSubsystem[]).map((pKey) => {
                          const thr =
                            editingConfig.thresholds[pKey] || {
                              maxLoginsPerMinute: 3,
                              consecutiveFailures: 3,
                              maxRpm: 60,
                            };
                          return (
                            <tr key={pKey} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {pKey}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={thr.maxLoginsPerMinute}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    setEditingConfig({
                                      ...editingConfig,
                                      thresholds: {
                                        ...editingConfig.thresholds,
                                        [pKey]: { ...thr, maxLoginsPerMinute: val },
                                      },
                                    });
                                  }}
                                  className="form-input"
                                  style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={thr.consecutiveFailures}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    setEditingConfig({
                                      ...editingConfig,
                                      thresholds: {
                                        ...editingConfig.thresholds,
                                        [pKey]: { ...thr, consecutiveFailures: val },
                                      },
                                    });
                                  }}
                                  className="form-input"
                                  style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  type="number"
                                  min={1}
                                  value={thr.maxRpm}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10) || 1;
                                    setEditingConfig({
                                      ...editingConfig,
                                      thresholds: {
                                        ...editingConfig.thresholds,
                                        [pKey]: { ...thr, maxRpm: val },
                                      },
                                    });
                                  }}
                                  className="form-input"
                                  style={{ width: '70px', padding: '4px 6px', textAlign: 'center', fontWeight: 700 }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '14px 20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                }}
              >
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '7px 16px' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="btn btn-primary"
                  style={{ fontSize: '0.78rem', padding: '7px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={14} />
                  {isSavingConfig ? 'Đang Lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

