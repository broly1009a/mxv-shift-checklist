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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            Bình Thường
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Cảnh Báo
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800 animate-pulse">
            <XCircle className="w-3.5 h-3.5" />
            Nguy Hiểm
          </span>
        );
      default:
        return null;
    }
  };

  const renderEventTypeBadge = (type: string) => {
    switch (type) {
      case 'LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800">
            <Key className="w-3 h-3" />
            LOGIN
          </span>
        );
      case 'REFRESH_TOKEN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800">
            <RefreshCw className="w-3 h-3" />
            REFRESH
          </span>
        );
      case 'CIRCUIT_BREAKER':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800">
            <Zap className="w-3 h-3" />
            CIRCUIT BREAKER
          </span>
        );
      case 'SFTP_CONNECT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-800">
            <Server className="w-3 h-3" />
            SFTP CONNECT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <Activity className="w-3 h-3" />
            API REQUEST
          </span>
        );
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/trading-manager"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Quay lại Trading Manager
              </Link>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                Partner Auth Monitor
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Giám Sát Tần Suất Đăng Nhập & Yêu Cầu 5 Phân Hệ Đối Tác
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Kiểm soát lưu lượng xác thực thời gian thực, tự động phát hiện Login Storm và dập bão cảnh báo Email.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            {/* Auto-refresh Selector */}
            <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Tự động làm mới:</span>
              <select
                aria-label="Tự động làm mới dữ liệu"
                value={autoRefreshSec}
                onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                className="bg-transparent font-semibold text-blue-600 dark:text-blue-400 focus:outline-none cursor-pointer"
              >
                <option value={0}>Tắt</option>
                <option value={5}>5 giây</option>
                <option value={10}>10 giây</option>
                <option value={30}>30 giây</option>
              </select>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
              Làm mới
            </button>

            {/* Settings Button */}
            <button
              onClick={handleOpenConfigModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all"
            >
              <Sliders className="w-3.5 h-3.5" />
              Cấu Hình Ngưỡng
            </button>
          </div>
        </div>

        {/* 5 Phân Hệ - Status KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {(['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'] as PartnerSubsystem[]).map((partnerKey) => {
            const summary = healthSummaries.find((s) => s.partner === partnerKey);
            const meta = PARTNER_METADATA[partnerKey];
            const health = summary?.health || 'HEALTHY';

            return (
              <div
                key={partnerKey}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md flex flex-col justify-between ${
                  health === 'CRITICAL'
                    ? 'border-rose-300 dark:border-rose-800 ring-2 ring-rose-500/20'
                    : health === 'WARNING'
                    ? 'border-amber-300 dark:border-amber-800 ring-2 ring-amber-500/10'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                        {partnerKey}
                      </span>
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        {meta.name}
                      </h3>
                    </div>
                    {renderHealthBadge(health)}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-3">
                    {meta.description}
                  </p>

                  <div className="space-y-2 py-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Tần suất hiện tại:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {summary?.rpm || 0} RPM
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Logins (60s qua):</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {summary?.loginsLastMinute || 0} lượt
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Tỷ lệ thành công (1h):</span>
                      <span
                        className={`font-semibold ${
                          (summary?.successRate || 100) >= 90
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : (summary?.successRate || 100) >= 70
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {summary?.successRate ?? 100}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400">Lỗi liên tiếp:</span>
                      <span
                        className={`font-semibold ${
                          (summary?.consecutiveFailures || 0) > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {summary?.consecutiveFailures || 0}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Xác thực:</span>
                    <span className="truncate max-w-[120px] font-medium text-slate-600 dark:text-slate-300" title={meta.authType}>
                      {meta.authType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Tín hiệu cuối:</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
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
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
          {/* Header & Filter Tabs */}
          <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="font-bold text-base sm:text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Nhật Ký Yêu Cầu & Xác Thực Thời Gian Thực (Audit Stream)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hiển thị 80 sự kiện telemetry mới nhất từ In-Memory Ring Buffer & MongoDB. Tự động dọn sau 7 ngày.
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['ALL', 'CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPartnerFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedPartnerFilter === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {p === 'ALL' ? 'Tất cả phân hệ' : p}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Thời Gian</th>
                  <th className="py-3 px-4">Phân Hệ</th>
                  <th className="py-3 px-4">Thao Tác</th>
                  <th className="py-3 px-4">Trạng Thái</th>
                  <th className="py-3 px-4">Độ Trễ</th>
                  <th className="py-3 px-4">Tài Khoản / Người Dùng</th>
                  <th className="py-3 px-4">Chi Tiết / Mã HTTP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500">
                      Chưa ghi nhận sự kiện nào trong bộ nhớ đệm.
                    </td>
                  </tr>
                ) : (
                  filteredEvents.map((item, idx) => (
                    <tr
                      key={item._id || idx}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('vi-VN') : 'N/A'}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {item.partner}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {renderEventTypeBadge(item.eventType)}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        {item.success ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Thành công
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <XCircle className="w-3.5 h-3.5" />
                            Thất bại
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {item.durationMs} ms
                      </td>
                      <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                        {item.account || 'Hệ thống (Auto)'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 dark:text-slate-400 max-w-md truncate">
                        {item.errorMessage ? (
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {item.errorMessage}
                          </span>
                        ) : item.statusCode ? (
                          <span className="text-slate-600 dark:text-slate-300">
                            HTTP {item.statusCode}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex items-center gap-2.5">
                  <Sliders className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                      Cấu Hình Ngưỡng Giám Sát & Cảnh Báo Đối Tác
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cơ chế Data-Driven 100%: Thay đổi tham số vận hành mà không cần sửa code.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-5 text-xs">
                {/* Master Switch & Cooldown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-blue-600" />
                      Trạng thái Cảnh báo Email
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="enabledToggle"
                        checked={editingConfig.enabled}
                        onChange={(e) =>
                          setEditingConfig({ ...editingConfig, enabled: e.target.checked })
                        }
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <label htmlFor="enabledToggle" className="cursor-pointer font-medium text-slate-600 dark:text-slate-300">
                        {editingConfig.enabled ? 'Đang Bật (Enabled)' : 'Tạm Tắt (Disabled)'}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
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
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400">
                      Dập bão email: Chỉ gửi 1 email và khóa thông báo trùng lặp trong N phút.
                    </p>
                  </div>
                </div>

                {/* Danh Sách Email Nhận Cảnh Báo */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
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
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    placeholder="it.support@mxv.vn, trading.ops@mxv.vn"
                  />
                </div>

                {/* Bảng Ngưỡng Chi Tiết Cho 5 Phân Hệ */}
                <div className="space-y-2">
                  <label className="font-semibold text-slate-700 dark:text-slate-200">
                    Ngưỡng Giới Hạn Cụ Thể Từng Phân Hệ
                  </label>
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-700/80 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                        <tr>
                          <th className="py-2.5 px-3">Phân Hệ</th>
                          <th className="py-2.5 px-3">Max Login / Phút</th>
                          <th className="py-2.5 px-3">Lỗi Liên Tiếp</th>
                          <th className="py-2.5 px-3">Max RPM</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {(['CORECCP', 'COREEX', 'MS', 'CQG', 'ACM'] as PartnerSubsystem[]).map(
                          (pKey) => {
                            const thr =
                              editingConfig.thresholds[pKey] || {
                                maxLoginsPerMinute: 3,
                                consecutiveFailures: 3,
                                maxRpm: 60,
                              };
                            return (
                              <tr key={pKey}>
                                <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200">
                                  {pKey}
                                </td>
                                <td className="py-2 px-3">
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
                                    className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-semibold"
                                  />
                                </td>
                                <td className="py-2 px-3">
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
                                    className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-semibold"
                                  />
                                </td>
                                <td className="py-2 px-3">
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
                                    className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-semibold"
                                  />
                                </td>
                              </tr>
                            );
                          },
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5 bg-slate-50/50 dark:bg-slate-800/40">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
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

