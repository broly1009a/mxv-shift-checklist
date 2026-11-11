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
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Search,
  Filter,
  RotateCcw,
  Eye,
  Copy,
  Check,
  Code2,
  Send,
  Inbox,
  FileText,
  Download,
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
  configuredAccount?: string; // Tài khoản cấu hình trong CSDL
  totalRequestsToday?: number; // Tổng yêu cầu trong ngày đã chọn
  totalLoginsToday?: number; // Số lượt đăng nhập trong ngày đã chọn
  failedRequestsToday?: number; // Số lượt lỗi trong ngày đã chọn
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
    protocol: 'REST API & Socket',
    authType: 'Tự động (OAuth2)',
  },
  COREEX: {
    name: 'CoreExchange',
    description: 'Báo cáo Giao dịch Khớp lệnh & Sổ lệnh Sở',
    protocol: 'REST API',
    authType: 'Tự động (OAuth2)',
  },
  MS: {
    name: 'M-System Newgen',
    description: 'Sao lưu Dữ liệu Giao dịch & Tỷ giá Quy đổi',
    protocol: 'REST API',
    authType: 'Tài khoản hệ thống (API)',
  },
  CQG: {
    name: 'CQG Desktop Web',
    description: 'Báo cáo Khớp lệnh FR, Vị thế PS & Sổ lệnh Od',
    protocol: 'Tự động hóa Web',
    authType: 'Phiên làm việc lưu trữ',
  },
  ACM: {
    name: 'ACM Straits SFTP',
    description: 'Báo cáo Đối chiếu Straits CSV',
    protocol: 'SFTP',
    authType: 'Khóa bảo mật SFTP',
  },
};

export default function PartnerAuthMonitorPage() {
  const { token } = useAuth();

  // State dữ liệu tổng quan & cấu hình
  const [healthSummaries, setHealthSummaries] = useState<IPartnerHealthSummary[]>([]);
  const [events, setEvents] = useState<IPartnerTelemetryEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [config, setConfig] = useState<IPartnerMonitorConfig | null>(null);

  // Bộ lọc bảng (Filters State)
  const [filterPartner, setFilterPartner] = useState<string>('ALL');
  const [filterDate, setFilterDate] = useState<string>(''); // YYYY-MM-DD
  const [filterStatus, setFilterStatus] = useState<string>('ALL'); // ALL | SUCCESS | FAILED
  const [filterEventType, setFilterEventType] = useState<string>('ALL'); // ALL | LOGIN | REFRESH_TOKEN | API_REQUEST | SFTP_CONNECT | CIRCUIT_BREAKER
  const [filterSearch, setFilterSearch] = useState<string>('');

  // Phân trang (Pagination State)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Trạng thái vận hành
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(5);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingConfig, setEditingConfig] = useState<IPartnerMonitorConfig | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);

  // Modal Chi Tiết Yêu Cầu & Phản Hồi (Request / Response Inspector)
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<IPartnerTelemetryEvent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Đã sao chép ${label} vào bộ nhớ tạm!`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatJsonSafe = (data: any): string => {
    if (data === null || data === undefined) return 'Không có dữ liệu';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    return JSON.stringify(data, null, 2);
  };

  // Fetch dữ liệu sự kiện (kèm bộ lọc & phân trang)
  const fetchEvents = useCallback(
    async (silent: boolean = false) => {
      if (!token) return;
      if (!silent) setIsRefreshing(true);

      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const params = new URLSearchParams();
        if (filterPartner && filterPartner !== 'ALL') params.append('partner', filterPartner);
        if (filterDate) params.append('date', filterDate);
        if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
        if (filterEventType && filterEventType !== 'ALL') params.append('eventType', filterEventType);
        if (filterSearch.trim()) params.append('search', filterSearch.trim());
        params.append('page', String(currentPage));
        params.append('limit', String(pageSize));

        const res = await fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/events?${params.toString()}`, { headers });
        if (res.ok) {
          const json = await res.json();
          if (json.data) {
            setEvents(json.data);
            setTotalEvents(json.total ?? json.count ?? json.data.length);
            setTotalPages(json.totalPages ?? Math.max(1, Math.ceil((json.total ?? json.data.length) / pageSize)));
          }
        }
      } catch (err: any) {
        if (!silent) toast.error(`Không thể tải nhật ký kết nối: ${err.message}`);
      } finally {
        if (!silent) setIsRefreshing(false);
      }
    },
    [token, filterPartner, filterDate, filterStatus, filterEventType, filterSearch, currentPage, pageSize],
  );

  // Fetch dữ liệu tổng quan (Health Cards & Config có bộ lọc theo ngày)
  const fetchOverview = useCallback(
    async (silent: boolean = false, dateOverride?: string) => {
      if (!token) return;
      try {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        const targetDate = dateOverride !== undefined ? dateOverride : filterDate;
        const healthUrl = targetDate
          ? `${API_BASE_URL}/api/v1/ingress/auth-monitor/health?date=${targetDate}`
          : `${API_BASE_URL}/api/v1/ingress/auth-monitor/health`;

        const [healthRes, configRes] = await Promise.all([
          fetch(healthUrl, { headers }),
          fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/config`, { headers }),
        ]);

        if (healthRes.ok) {
          const json = await healthRes.json();
          if (json.data) setHealthSummaries(json.data);
        }

        if (configRes.ok) {
          const json = await configRes.json();
          if (json.data) setConfig(json.data);
        }

        setLastUpdated(new Date());
      } catch (err: any) {
        if (!silent) toast.error(`Không thể tải trạng thái hệ thống: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    },
    [token, filterDate],
  );

  // Lấy tên tài khoản hiển thị chuẩn từ CSDL
  const getDisplayAccount = (item: IPartnerTelemetryEvent) => {
    if (
      item.account &&
      item.account !== 'SYSTEM' &&
      item.account !== 'auto' &&
      !item.account.includes('(Tự động)')
    ) {
      return item.account;
    }
    const matched = healthSummaries.find((s) => s.partner === item.partner);
    if (matched?.configuredAccount) {
      return matched.configuredAccount;
    }
    return 'Tài khoản CSDL';
  };

  // Lần đầu tải trang hoặc khi đổi bộ lọc / trang
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Tải trạng thái ban đầu hoặc khi đổi ngày
  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Polling tự động làm mới
  useEffect(() => {
    if (autoRefreshSec <= 0) return;

    const timer = setInterval(() => {
      fetchOverview(true);
      fetchEvents(true);
    }, autoRefreshSec * 1000);

    return () => clearInterval(timer);
  }, [fetchOverview, fetchEvents, autoRefreshSec]);

  // Nút tiện ích ngày: Hôm nay / Hôm qua / Tất cả
  const handleSetQuickDate = (type: 'TODAY' | 'YESTERDAY' | 'ALL') => {
    setCurrentPage(1);
    if (type === 'ALL') {
      setFilterDate('');
      fetchOverview(true, '');
      return;
    }
    const d = new Date();
    if (type === 'YESTERDAY') {
      d.setDate(d.getDate() - 1);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    setFilterDate(dateStr);
    fetchOverview(true, dateStr);
  };

  // Đặt lại toàn bộ bộ lọc
  const handleResetFilters = () => {
    setFilterPartner('ALL');
    setFilterDate('');
    setFilterStatus('ALL');
    setFilterEventType('ALL');
    setFilterSearch('');
    setCurrentPage(1);
    fetchOverview(true, '');
  };

  // Bật/tắt nhanh bộ lọc chỉ xem sự cố (1-Click Incident Triage)
  const toggleFailedOnly = () => {
    if (filterStatus === 'FAILED') {
      setFilterStatus('ALL');
    } else {
      setFilterStatus('FAILED');
    }
    setCurrentPage(1);
  };

  // Xuất file CSV/Excel nhật ký kiểm toán (UTF-8 BOM hỗ trợ tiếng Việt có dấu trong Excel)
  const handleExportCsv = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập để thực hiện xuất dữ liệu');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('Đang chuẩn bị file xuất nhật ký...');

    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const params = new URLSearchParams();
      if (filterPartner && filterPartner !== 'ALL') params.append('partner', filterPartner);
      if (filterDate) params.append('date', filterDate);
      if (filterStatus && filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterEventType && filterEventType !== 'ALL') params.append('eventType', filterEventType);
      if (filterSearch.trim()) params.append('search', filterSearch.trim());
      params.append('page', '1');
      params.append('limit', '1000');

      const res = await fetch(`${API_BASE_URL}/api/v1/ingress/auth-monitor/events?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('Không thể tải dữ liệu để xuất file');

      const json = await res.json();
      const exportList: IPartnerTelemetryEvent[] = json.data || events;

      if (!exportList || exportList.length === 0) {
        toast.dismiss(toastId);
        toast.error('Không tìm thấy bản ghi nào để xuất');
        return;
      }

      const csvHeaders = [
        'Thời Gian',
        'Hệ Thống',
        'Thao Tác',
        'Phương Thức',
        'Đường Dẫn / API',
        'Mã HTTP',
        'Độ Trễ (ms)',
        'Trạng Thái',
        'Tài Khoản',
        'Thông Điệp / Chi Tiết Lỗi',
      ];

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const rows = exportList.map((e) => {
        const timeStr = e.timestamp ? new Date(e.timestamp).toLocaleString('vi-VN') : '';
        const partnerName = PARTNER_METADATA[e.partner]?.name || e.partner;
        const eventName =
          e.eventType === 'LOGIN'
            ? 'Đăng nhập'
            : e.eventType === 'REFRESH_TOKEN'
            ? 'Gia hạn phiên'
            : e.eventType === 'CIRCUIT_BREAKER'
            ? 'Tạm ngắt bảo vệ'
            : e.eventType === 'SFTP_CONNECT'
            ? 'Kết nối SFTP'
            : 'Truy vấn dữ liệu';
        const method = e.metadata?.method || (e.eventType === 'SFTP_CONNECT' ? 'SFTP' : e.eventType === 'LOGIN' ? 'AUTH' : 'API');
        const endpoint = e.metadata?.endpoint || (e.eventType === 'SFTP_CONNECT' ? 'sftp://host:port' : '-');
        const statusCode = e.statusCode ?? (e.success ? 200 : 500);
        const latency = e.durationMs ?? 0;
        const statusText = e.success ? 'Thành công' : 'Thất bại';
        const accountName = getDisplayAccount(e);
        const errorMsg = e.errorMessage || (e.success ? 'Thành công' : 'Không có thông báo lỗi');

        return [
          escapeCsv(timeStr),
          escapeCsv(partnerName),
          escapeCsv(eventName),
          escapeCsv(method),
          escapeCsv(endpoint),
          escapeCsv(statusCode),
          escapeCsv(latency),
          escapeCsv(statusText),
          escapeCsv(accountName),
          escapeCsv(errorMsg),
        ];
      });

      const csvContent = '\uFEFF' + [csvHeaders.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const datePart = filterDate || 'tat_ca';
      const partnerPart = filterPartner !== 'ALL' ? `_${filterPartner.toLowerCase()}` : '';
      link.href = url;
      link.setAttribute('download', `Nhat_ky_giam_sat_doi_tac_${datePart}${partnerPart}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`Đã xuất thành công ${exportList.length} bản ghi nhật ký!`);
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`Lỗi khi xuất file: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

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
      toast.success('Cập nhật cấu hình giám sát thành công!');
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
            Đăng nhập
          </span>
        );
      case 'REFRESH_TOKEN':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            <RefreshCw size={12} />
            Gia hạn phiên
          </span>
        );
      case 'CIRCUIT_BREAKER':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <Zap size={12} />
            Tạm ngắt bảo vệ
          </span>
        );
      case 'SFTP_CONNECT':
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(20, 184, 166, 0.12)', color: '#14b8a6', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
            <Server size={12} />
            Kết nối SFTP
          </span>
        );
      default:
        return (
          <span style={{ ...styleBase, backgroundColor: 'rgba(148, 163, 184, 0.12)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
            <Activity size={12} />
            Truy vấn dữ liệu
          </span>
        );
    }
  };

  const renderHttpStatusBadge = (statusCode?: number, success?: boolean) => {
    if (statusCode) {
      let color = '#10b981';
      let bg = 'rgba(16, 185, 129, 0.12)';
      let border = 'rgba(16, 185, 129, 0.3)';

      if (statusCode >= 400 && statusCode < 500) {
        color = '#f59e0b';
        bg = 'rgba(245, 158, 11, 0.12)';
        border = 'rgba(245, 158, 11, 0.3)';
      } else if (statusCode >= 500) {
        color = '#ef4444';
        bg = 'rgba(239, 68, 68, 0.12)';
        border = 'rgba(239, 68, 68, 0.3)';
      }

      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 700,
            fontFamily: 'monospace',
            color,
            backgroundColor: bg,
            border: `1px solid ${border}`,
          }}
        >
          {statusCode}
        </span>
      );
    }

    if (success !== undefined) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: success ? '#10b981' : '#ef4444',
            backgroundColor: success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          }}
        >
          {success ? 'OK' : 'Lỗi'}
        </span>
      );
    }

    return <span style={{ color: 'var(--text-muted)' }}>-</span>;
  };

  const renderEndpointCell = (event: IPartnerTelemetryEvent) => {
    const method = event.metadata?.method || (event.eventType === 'SFTP_CONNECT' ? 'SFTP' : event.eventType === 'LOGIN' ? 'AUTH' : 'API');
    const endpoint = event.metadata?.endpoint || (event.eventType === 'SFTP_CONNECT' ? 'sftp://host:port' : '-');

    const getMethodStyle = (m: string) => {
      const upper = m.toUpperCase();
      if (upper.includes('GET')) return { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' };
      if (upper.includes('POST')) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' };
      if (upper.includes('SFTP')) return { color: '#14b8a6', bg: 'rgba(20, 184, 166, 0.15)' };
      if (upper.includes('RPA')) return { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' };
      return { color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.08)' };
    };

    const style = getMethodStyle(method);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '280px' }}>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.68rem',
            fontWeight: 800,
            padding: '1px 5px',
            borderRadius: '4px',
            color: style.color,
            backgroundColor: style.bg,
            flexShrink: 0,
          }}
        >
          {method.replace('RPA_', '')}
        </span>
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: '0.74rem',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={endpoint}
        >
          {endpoint}
        </span>
      </div>
    );
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
                Quay lại Bàn Quản Lý
              </Link>
              <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6' }}>
                Giám Sát Đối Tác
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
              Giám Sát Kết Nối & Xác Thực Đối Tác
            </h1>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Theo dõi trạng thái kết nối, phiên làm việc và kiểm soát lưu lượng 5 hệ thống giao dịch.
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
              <span>Làm mới:</span>
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
              onClick={() => {
                fetchOverview();
                fetchEvents();
              }}
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

                  {/* Metrics 2x2 Grid - Thống kê chính xác từ CSDL theo ngày */}
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
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Yêu cầu (ngày):</span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {summary?.totalRequestsToday ?? 0}{' '}
                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>lượt</span>
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Đăng nhập (ngày):</span>
                      <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {summary?.totalLoginsToday ?? 0}{' '}
                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>lần</span>
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Tỷ lệ thành công:</span>
                      <span
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
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
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>Số lượt lỗi:</span>
                      <span
                        style={{
                          fontSize: '0.92rem',
                          fontWeight: 800,
                          color: (summary?.failedRequestsToday || 0) > 0 ? '#ef4444' : 'var(--text-primary)',
                        }}
                      >
                        {summary?.failedRequestsToday ?? 0}{' '}
                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-muted)' }}>lần</span>
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
                    <span>Tài khoản bot:</span>
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '160px',
                      }}
                      title={summary?.configuredAccount || 'Tài khoản bot cấu hình trong CSDL'}
                    >
                      {summary?.configuredAccount || 'Đang kết nối'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Lần kết nối cuối:</span>
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

        {/* Real-Time Telemetry Audit Log Stream with Filters & Pagination */}
        <div
          className="glass-panel"
          style={{
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '0',
          }}
        >
          {/* Section Header */}
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
                Nhật Ký Kết Nối & Xác Thực
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Lịch sử các phiên đăng nhập, kết nối và truy vấn dữ liệu từ các hệ thống đối tác.
              </p>
            </div>

            {/* Quick Actions & Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Nút lọc nhanh sự cố 1-Click */}
              <button
                type="button"
                onClick={toggleFailedOnly}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  backgroundColor: filterStatus === 'FAILED' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-input, rgba(255,255,255,0.03))',
                  border: filterStatus === 'FAILED' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-color)',
                  color: filterStatus === 'FAILED' ? '#ef4444' : 'var(--text-secondary)',
                }}
                title={filterStatus === 'FAILED' ? 'Đang lọc các sự cố / lỗi (Nhấn để xem tất cả)' : 'Lọc nhanh các bản ghi bị lỗi hoặc thất bại'}
              >
                <AlertTriangle size={14} style={{ color: filterStatus === 'FAILED' ? '#ef4444' : '#f59e0b' }} />
                {filterStatus === 'FAILED' ? 'Đang lọc: Chỉ xem sự cố' : 'Chỉ xem sự cố'}
              </button>

              {/* Nút Xuất Excel */}
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                  opacity: isExporting ? 0.7 : 1,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                  color: 'var(--text-primary)',
                }}
                title="Tải về file Excel/CSV nhật ký kiểm toán theo bộ lọc hiện tại"
              >
                <Download size={14} style={{ color: '#10b981' }} />
                {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
              </button>

              {/* Tổng số bản ghi */}
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                }}
              >
                Tổng số bản ghi: <strong style={{ color: 'var(--text-primary)' }}>{totalEvents}</strong>
              </div>
            </div>
          </div>

          {/* Filter Toolbar (Bộ Lọc Toàn Diện) */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input, rgba(255,255,255,0.01))',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {/* Hàng 1: Tabs chọn Phân Hệ */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '6px' }}>
                Hệ thống:
              </span>
              {[
                { key: 'ALL', label: 'Tất cả' },
                { key: 'CORECCP', label: 'CoreCCP' },
                { key: 'COREEX', label: 'CoreExchange' },
                { key: 'MS', label: 'M-System' },
                { key: 'CQG', label: 'CQG' },
                { key: 'ACM', label: 'ACM Straits' },
              ].map((p) => {
                const isActive = filterPartner === p.key;
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setFilterPartner(p.key);
                      setCurrentPage(1);
                    }}
                    className={isActive ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{
                      padding: '5px 12px',
                      fontSize: '0.75rem',
                      fontWeight: isActive ? 700 : 500,
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>

            {/* Hàng 2: Bộ lọc Ngày, Trạng thái, Thao tác & Tìm kiếm */}
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {/* Filter theo Ngày */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '4px 8px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                }}
              >
                <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Ngày:</span>
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    const newD = e.target.value;
                    setFilterDate(newD);
                    setCurrentPage(1);
                    fetchOverview(true, newD);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                />
                <button
                  onClick={() => handleSetQuickDate('TODAY')}
                  style={{
                    background: filterDate === new Date().toISOString().slice(0, 10) ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: 'none',
                    color: '#3b82f6',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Hôm nay
                </button>
                <button
                  onClick={() => handleSetQuickDate('YESTERDAY')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Hôm qua
                </button>
                {filterDate && (
                  <button
                    onClick={() => handleSetQuickDate('ALL')}
                    title="Xóa lọc ngày"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                    }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Trạng thái */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Kết quả:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL" style={{ background: '#0f172a', color: '#fff' }}>Tất cả</option>
                  <option value="SUCCESS" style={{ background: '#0f172a', color: '#fff' }}>Thành công</option>
                  <option value="FAILED" style={{ background: '#0f172a', color: '#fff' }}>Thất bại</option>
                </select>
              </div>

              {/* Filter Loại Thao Tác */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>Thao tác:</span>
                <select
                  value={filterEventType}
                  onChange={(e) => {
                    setFilterEventType(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="ALL" style={{ background: '#0f172a', color: '#fff' }}>Tất cả thao tác</option>
                  <option value="LOGIN" style={{ background: '#0f172a', color: '#fff' }}>Đăng nhập</option>
                  <option value="REFRESH_TOKEN" style={{ background: '#0f172a', color: '#fff' }}>Gia hạn phiên</option>
                  <option value="API_REQUEST" style={{ background: '#0f172a', color: '#fff' }}>Truy vấn dữ liệu</option>
                  <option value="SFTP_CONNECT" style={{ background: '#0f172a', color: '#fff' }}>Kết nối SFTP</option>
                  <option value="CIRCUIT_BREAKER" style={{ background: '#0f172a', color: '#fff' }}>Tạm ngắt bảo vệ</option>
                </select>
              </div>

              {/* Search Box */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--bg-card)',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  flex: '1 1 200px',
                  maxWidth: '320px',
                }}
              >
                <Search size={14} style={{ color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Tìm tài khoản, thông điệp lỗi..."
                  value={filterSearch}
                  onChange={(e) => {
                    setFilterSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-primary)',
                    fontSize: '0.75rem',
                    outline: 'none',
                    width: '100%',
                  }}
                />
                {filterSearch && (
                  <button
                    onClick={() => {
                      setFilterSearch('');
                      setCurrentPage(1);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Reset Filter Button */}
              {(filterPartner !== 'ALL' || filterDate || filterStatus !== 'ALL' || filterEventType !== 'ALL' || filterSearch) && (
                <button
                  onClick={handleResetFilters}
                  className="btn btn-secondary"
                  style={{
                    padding: '5px 10px',
                    fontSize: '0.72rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                  }}
                  title="Đặt lại toàn bộ bộ lọc"
                >
                  <RotateCcw size={12} />
                  Đặt lại
                </button>
              )}
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
                  <th style={{ padding: '12px 14px' }}>Thời Gian</th>
                  <th style={{ padding: '12px 14px' }}>Hệ Thống</th>
                  <th style={{ padding: '12px 14px' }}>Thao Tác</th>
                  <th style={{ padding: '12px 14px' }}>Đường Dẫn / API</th>
                  <th style={{ padding: '12px 14px' }}>Mã HTTP</th>
                  <th style={{ padding: '12px 14px' }}>Độ Trễ</th>
                  <th style={{ padding: '12px 14px' }}>Tài Khoản</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Chi Tiết</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      Không tìm thấy sự kiện kết nối nào phù hợp với bộ lọc đã chọn.
                    </td>
                  </tr>
                ) : (
                  events.map((item, idx) => (
                    <tr
                      key={item._id || idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.04)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString('vi-VN') : 'N/A'}
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block' }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleDateString('vi-VN') : ''}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {item.partner}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {renderEventTypeBadge(item.eventType)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {renderEndpointCell(item)}
                      </td>
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        {renderHttpStatusBadge(item.statusCode, item.success)}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {item.durationMs} ms
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={getDisplayAccount(item)}>
                        {getDisplayAccount(item)}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => setSelectedDetailEvent(item)}
                          className="btn btn-secondary"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-card)',
                          }}
                          title="Xem chi tiết Yêu Cầu & Phản Hồi"
                        >
                          <Eye size={13} style={{ color: '#3b82f6' }} />
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Toolbar (Thanh Phân Trang) */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Rows per page & Range info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              <span>
                Hiển thị{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {totalEvents === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </strong>{' '}
                -{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {Math.min(currentPage * pageSize, totalEvents)}
                </strong>{' '}
                / <strong style={{ color: 'var(--text-primary)' }}>{totalEvents}</strong> bản ghi
              </span>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Mỗi trang:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value={10} style={{ background: '#0f172a', color: '#fff' }}>10</option>
                  <option value={20} style={{ background: '#0f172a', color: '#fff' }}>20</option>
                  <option value={50} style={{ background: '#0f172a', color: '#fff' }}>50</option>
                  <option value={100} style={{ background: '#0f172a', color: '#fff' }}>100</option>
                </select>
              </div>
            </div>

            {/* Pagination Page Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                className="btn btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.72rem', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
                title="Về trang đầu"
              >
                <ChevronsLeft size={14} />
              </button>

              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="btn btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.72rem', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer', opacity: currentPage <= 1 ? 0.4 : 1 }}
                title="Trang trước"
              >
                <ChevronLeft size={14} />
              </button>

              <span
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                Trang {currentPage} / {totalPages || 1}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.72rem', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                title="Trang tiếp theo"
              >
                <ChevronRight size={14} />
              </button>

              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                className="btn btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.72rem', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer', opacity: currentPage >= totalPages ? 0.4 : 1 }}
                title="Đến trang cuối"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Cấu Hình Ngưỡng & Cảnh Báo (Đồng bộ chuẩn giao diện Enterprise) */}
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
              backgroundColor: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(8px)',
            }}
            onClick={() => setIsModalOpen(false)}
          >
            <div
              className="glass-panel animate-fade-in"
              style={{
                borderRadius: '16px',
                width: '100%',
                maxWidth: '720px',
                maxHeight: '90vh',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(59, 130, 246, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Sliders size={20} style={{ color: '#3b82f6' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Cấu Hình Ngưỡng Giám Sát & Cảnh Báo
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      Thiết lập giới hạn lưu lượng và thời gian giãn cách gửi thông báo email.
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
                    padding: '6px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px', fontSize: '0.8rem' }}>
                {/* Switch Bật/Tắt & Thời gian giãn cách */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                    gap: '16px',
                    padding: '16px',
                    backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      <Bell size={15} style={{ color: '#3b82f6' }} />
                      Thông báo qua Email:
                    </label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={editingConfig.enabled}
                      onClick={() => setEditingConfig({ ...editingConfig, enabled: !editingConfig.enabled })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: '44px',
                          height: '24px',
                          borderRadius: '12px',
                          backgroundColor: editingConfig.enabled ? '#10b981' : '#475569',
                          transition: 'background-color 0.2s',
                          padding: '2px',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            transform: editingConfig.enabled ? 'translateX(20px)' : 'translateX(0px)',
                            transition: 'transform 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: editingConfig.enabled ? '#10b981' : 'var(--text-muted)' }}>
                        {editingConfig.enabled ? 'Đang bật nhận email' : 'Đang tạm tắt'}
                      </span>
                    </button>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                      Tự động gửi email tới danh sách vận hành khi phát hiện sự cố đăng nhập hoặc quá tải.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Clock size={15} style={{ color: '#3b82f6' }} />
                      Thời gian giãn cách thông báo (phút):
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
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-card)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>
                      Khoảng cách tối thiểu giữa các lần gửi email khi hệ thống phát hiện lỗi liên tục.
                    </span>
                  </div>
                </div>

                {/* Email Recipients */}
                <div>
                  <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px', fontSize: '0.8rem' }}>
                    Danh sách email nhận cảnh báo (phân cách bởi dấu phẩy):
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
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    placeholder="it.support@mxv.vn, trading.ops@mxv.vn"
                  />
                </div>

                {/* Thresholds Table */}
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', fontSize: '0.82rem' }}>
                      Ngưỡng cảnh báo theo từng phân hệ:
                    </label>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Hệ thống tự động kích hoạt cảnh báo khi vượt quá ngưỡng đăng nhập hoặc lưu lượng cho phép.
                    </span>
                  </div>
                  <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.76rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                          <th style={{ padding: '10px 14px' }}>Hệ Thống</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>Đăng nhập tối đa (lần/phút)</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>Số lỗi liên tiếp tối đa</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center' }}>Lưu lượng tối đa (lượt/phút)</th>
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
                          const meta = PARTNER_METADATA[pKey];
                          return (
                            <tr
                              key={pKey}
                              style={{
                                borderBottom: '1px solid var(--border-color)',
                                transition: 'background-color 0.15s',
                              }}
                            >
                              <td style={{ padding: '10px 14px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <strong style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                                    {meta?.name || pKey}
                                  </strong>
                                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                    {pKey}
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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
                                  style={{
                                    width: '75px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.84rem',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    textAlign: 'center',
                                    outline: 'none',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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
                                  style={{
                                    width: '75px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.84rem',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    textAlign: 'center',
                                    outline: 'none',
                                  }}
                                />
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'center' }}>
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
                                  style={{
                                    width: '75px',
                                    padding: '6px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--bg-card)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.84rem',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    textAlign: 'center',
                                    outline: 'none',
                                  }}
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
                  style={{ fontSize: '0.8rem', padding: '8px 20px', cursor: 'pointer' }}
                >
                  Hủy Bỏ
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig}
                  className="btn btn-primary"
                  style={{ fontSize: '0.8rem', padding: '8px 22px', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                >
                  <Save size={14} />
                  {isSavingConfig ? 'Đang Lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Chi Tiết Yêu Cầu & Phản Hồi (Request / Response Inspector) */}
        {selectedDetailEvent && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(6px)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}
            onClick={() => setSelectedDetailEvent(null)}
          >
            <div
              className="glass-panel"
              style={{
                width: '920px',
                maxWidth: '96vw',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-color)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '1.05rem',
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Code2 size={20} style={{ color: '#3b82f6' }} />
                    Chi Tiết Yêu Cầu & Kết Quả Phản Hồi
                  </h3>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {selectedDetailEvent.partner} &bull; {selectedDetailEvent.eventType} &bull;{' '}
                    {selectedDetailEvent.timestamp
                      ? new Date(selectedDetailEvent.timestamp).toLocaleString('vi-VN')
                      : 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDetailEvent(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Đóng"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Body */}
              <div
                style={{
                  padding: '18px 20px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Thanh tóm tắt nhanh metadata */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                    backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Hệ Thống</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {PARTNER_METADATA[selectedDetailEvent.partner]?.name || selectedDetailEvent.partner}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Thao Tác</span>
                    <div style={{ marginTop: '2px' }}>{renderEventTypeBadge(selectedDetailEvent.eventType)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Mã Phản Hồi</span>
                    <div style={{ marginTop: '2px' }}>
                      {renderHttpStatusBadge(selectedDetailEvent.statusCode, selectedDetailEvent.success)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Độ Trễ</span>
                    <strong style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                      {selectedDetailEvent.durationMs} ms
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>Tài Khoản</span>
                    <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {getDisplayAccount(selectedDetailEvent)}
                    </strong>
                  </div>
                </div>

                {/* Dòng hiển thị Endpoint / URL */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: '5px',
                      color: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      flexShrink: 0,
                    }}
                  >
                    {selectedDetailEvent.metadata?.method || 'API'}
                  </span>
                  <code
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      color: 'var(--text-primary)',
                      flex: 1,
                      wordBreak: 'break-all',
                    }}
                  >
                    {selectedDetailEvent.metadata?.endpoint || 'Không có URL cụ thể'}
                  </code>
                  {selectedDetailEvent.metadata?.endpoint && (
                    <button
                      onClick={() => handleCopyText(selectedDetailEvent.metadata?.endpoint, 'URL')}
                      className="btn btn-secondary"
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.7rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        cursor: 'pointer',
                      }}
                      title="Sao chép URL"
                    >
                      {copiedField === 'URL' ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                      {copiedField === 'URL' ? 'Đã chép' : 'Chép URL'}
                    </button>
                  )}
                </div>

                {/* 2 Khối Request và Response */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
                    gap: '16px',
                  }}
                >
                  {/* Khối 1: Yêu Cầu Gửi Đi (Request) */}
                  <div
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input, rgba(255,255,255,0.01))',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Send size={14} style={{ color: '#3b82f6' }} />
                        Dữ Liệu Gửi Đi (Request)
                      </span>
                      <button
                        onClick={() =>
                          handleCopyText(
                            formatJsonSafe(selectedDetailEvent.metadata?.request || selectedDetailEvent.metadata || {}),
                            'Request JSON',
                          )
                        }
                        className="btn btn-secondary"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedField === 'Request JSON' ? (
                          <Check size={12} style={{ color: '#10b981' }} />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedField === 'Request JSON' ? 'Đã chép' : 'Chép JSON'}
                      </button>
                    </div>

                    <pre
                      style={{
                        margin: 0,
                        padding: '14px',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: '#93c5fd',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        maxHeight: '340px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.45,
                      }}
                    >
                      {formatJsonSafe(selectedDetailEvent.metadata?.request || selectedDetailEvent.metadata || 'Không có tham số gửi kèm')}
                    </pre>
                  </div>

                  {/* Khối 2: Kết Quả Phản Hồi (Response) */}
                  <div
                    style={{
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input, rgba(255,255,255,0.01))',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Inbox size={14} style={{ color: selectedDetailEvent.success ? '#10b981' : '#ef4444' }} />
                        Kết Quả Phản Hồi (Response)
                      </span>
                      <button
                        onClick={() =>
                          handleCopyText(
                            formatJsonSafe(
                              selectedDetailEvent.metadata?.response ||
                                (selectedDetailEvent.errorMessage
                                  ? { error: selectedDetailEvent.errorMessage }
                                  : { success: selectedDetailEvent.success }),
                            ),
                            'Response JSON',
                          )
                        }
                        className="btn btn-secondary"
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        {copiedField === 'Response JSON' ? (
                          <Check size={12} style={{ color: '#10b981' }} />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedField === 'Response JSON' ? 'Đã chép' : 'Chép JSON'}
                      </button>
                    </div>

                    {/* Hộp thông báo lỗi nếu có */}
                    {selectedDetailEvent.errorMessage && (
                      <div
                        style={{
                          padding: '10px 14px',
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                        }}
                      >
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <strong style={{ display: 'block' }}>Lỗi ghi nhận:</strong>
                          <span>{selectedDetailEvent.errorMessage}</span>
                        </div>
                      </div>
                    )}

                    <pre
                      style={{
                        margin: 0,
                        padding: '14px',
                        fontSize: '0.75rem',
                        fontFamily: 'monospace',
                        color: selectedDetailEvent.success ? '#86efac' : '#fca5a5',
                        backgroundColor: 'rgba(0, 0, 0, 0.35)',
                        maxHeight: '340px',
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.45,
                      }}
                    >
                      {formatJsonSafe(
                        selectedDetailEvent.metadata?.response ||
                          (selectedDetailEvent.errorMessage
                            ? { error: selectedDetailEvent.errorMessage }
                            : { status: 'Thành công', success: true }),
                      )}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div
                style={{
                  padding: '12px 20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  backgroundColor: 'var(--bg-input, rgba(255,255,255,0.02))',
                }}
              >
                <button
                  onClick={() => setSelectedDetailEvent(null)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.78rem', padding: '7px 20px', cursor: 'pointer' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
