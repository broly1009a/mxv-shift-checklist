'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  Clock,
  AlertOctagon,
  Sparkles,
  BarChart3,
  TrendingUp,
  Zap,
  Server,
  FileText,
  RefreshCw,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  Flame,
  ArrowUpRight,
  FileSpreadsheet,
  Check,
} from 'lucide-react';
import {
  TkgdAnalyticsSummary,
  TkgdShiftType,
  TkgdTimeRangeType,
  FilterStatus,
} from '../types/tkgd.types';
import { tkgdApi } from '../services/tkgd.api';
import { TkgdShiftHandoverModal } from './modal/TkgdShiftHandoverModal';

interface TkgdAnalyticsDashboardProps {
  batchDate: string;
  onDateChange: (date: string) => void;
  onDrilldownFilter: (filter: FilterStatus, search?: string) => void;
  onSwitchToReconcileTab: () => void;
  currentUser?: { name?: string; email?: string };
}

export const TkgdAnalyticsDashboard: React.FC<TkgdAnalyticsDashboardProps> = ({
  batchDate,
  onDateChange,
  onDrilldownFilter,
  onSwitchToReconcileTab,
  currentUser,
}) => {
  // Khởi tạo từ URL params nếu có
  const [shift, setShift] = useState<TkgdShiftType>('ALL');
  const [timeRange, setTimeRange] = useState<TkgdTimeRangeType>('DAY');
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<TkgdAnalyticsSummary | null>(null);
  const [showHandoverModal, setShowHandoverModal] = useState<boolean>(false);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);

  // Đọc param ?range= và ?shift= từ URL khi mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const p = new URLSearchParams(window.location.search);
      const r = p.get('range')?.toUpperCase();
      if (r === 'WEEK' || r === 'MONTH' || r === 'DAY') {
        setTimeRange(r as TkgdTimeRangeType);
      }
      const s = p.get('shift')?.toUpperCase();
      if (s === 'MORNING' || s === 'AFTERNOON' || s === 'OVERTIME' || s === 'ALL') {
        setShift(s as TkgdShiftType);
      }
    } catch {}

    const handlePopState = () => {
      try {
        const p = new URLSearchParams(window.location.search);
        const r = p.get('range')?.toUpperCase();
        if (r === 'WEEK' || r === 'MONTH' || r === 'DAY') setTimeRange(r as TkgdTimeRangeType);
        const s = p.get('shift')?.toUpperCase();
        if (s === 'MORNING' || s === 'AFTERNOON' || s === 'OVERTIME' || s === 'ALL') setShift(s as TkgdShiftType);
      } catch {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTimeRangeChange = (newRange: TkgdTimeRangeType) => {
    setTimeRange(newRange);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('range', newRange.toLowerCase());
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
  };

  const handleShiftChange = (newShift: TkgdShiftType) => {
    setShift(newShift);
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('shift', newShift.toLowerCase());
        window.history.replaceState(null, '', url.toString());
      } catch {}
    }
  };

  // Fetch dữ liệu thống kê từ backend
  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tkgdApi.getAnalyticsSummary({
        batchDate,
        shift,
        range: timeRange,
      });
      if (res && res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu phân tích thống kê:', err);
    } finally {
      setLoading(false);
    }
  }, [batchDate, shift, timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Fallback data khi chưa tải xong hoặc rỗng
  const kpi = data?.kpi || {
    totalEmails: 0,
    scannedSuccess: 0,
    pendingProcessing: 0,
    matchedCount: 0,
    canKiemTraCount: 0,
    mismatchedCount: 0,
    invalidFormatCount: 0,
    matchRate: 0,
  };

  const subAccounts = data?.subAccounts || {
    futuresCount: 0,
    acmCount: 0,
    lmeCount: 0,
    spreadCount: 0,
    acmRate: 0,
    lmeRate: 0,
    spreadRate: 0,
  };

  const hourlyDistribution = data?.hourlyDistribution || [];
  const topMembers = data?.topMembers || [];
  const pendingHandoverList = data?.pendingHandoverList || [];
  const latency = data?.latency || {
    avgTotalSeconds: 10.4,
    mailIngestSeconds: 1.2,
    ocrSeconds: 3.8,
    msScraperSeconds: 5.3,
    reconcileSeconds: 0.1,
    throughputPerHour: 340,
    healthStatus: 'HEALTHY',
  };

  // Tìm giá trị max của biểu đồ giờ để scale chiều cao
  const maxHourlyCount = useMemo(() => {
    return Math.max(...hourlyDistribution.map((h) => h.total), 5);
  }, [hourlyDistribution]);

  // Hành vi Drilldown khi click thẻ hoặc dòng dữ liệu
  const handleCardClick = (filter: FilterStatus) => {
    onDrilldownFilter(filter);
    onSwitchToReconcileTab();
  };

  const handleMemberClick = (maTVKD: string) => {
    onDrilldownFilter('ALL', maTVKD);
    onSwitchToReconcileTab();
  };

  const handleHourClick = (hour: string) => {
    setSelectedHour(selectedHour === hour ? null : hour);
    // Bật filter theo giờ
    onDrilldownFilter('ALL', `${hour}:`);
    onSwitchToReconcileTab();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* =========================================================================
       * 1. TOP CONTROL BAR (CHỌN PHẠM VI THỜI GIAN & KHUNG GIỜ TIẾP NHẬN)
       * ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          padding: '18px 24px',
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Hàng 1: Tiêu Đề Nghiệp Vụ & Bộ Chọn Phạm Vi Thời Gian (Ngày / Tuần / Tháng) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '11px',
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <BarChart3 size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 800,
                    margin: 0,
                    color: 'var(--text-primary)',
                  }}
                >
                  Báo Cáo Thống Kê Giám Sát Mở TKGD
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Realtime
                </span>
                {data?.dateRangeLabel && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 10px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      color: '#3b82f6',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                    }}
                  >
                     {data.dateRangeLabel}
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Đo lường tiến độ tiếp nhận, phân tích chất lượng hồ sơ TVKD và kiểm soát tỷ lệ khớp thông tin
              </span>
            </div>
          </div>

          {/* Controls: Scope Switcher & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Bộ chọn Phạm vi: Theo Ngày / Tuần / Tháng */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '3px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                gap: '2px',
              }}
            >
              <button
                onClick={() => handleTimeRangeChange('DAY')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: timeRange === 'DAY' ? '#3b82f6' : 'transparent',
                  color: timeRange === 'DAY' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Theo Ngày
              </button>
              <button
                onClick={() => handleTimeRangeChange('WEEK')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: timeRange === 'WEEK' ? '#3b82f6' : 'transparent',
                  color: timeRange === 'WEEK' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Tuần Này (7 Ngày)
              </button>
              <button
                onClick={() => handleTimeRangeChange('MONTH')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '7px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: timeRange === 'MONTH' ? '#3b82f6' : 'transparent',
                  color: timeRange === 'MONTH' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Tháng Này
              </button>
            </div>

            {/* Date input (Dùng để chọn ngày cụ thể hoặc mốc thời gian) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input, rgba(255,255,255,0.05))',
              }}
            >
              <Calendar size={15} color="var(--text-muted)" />
              <input
                type="date"
                value={batchDate}
                onChange={(e) => onDateChange(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>

            {/* Quick shortcut: Hôm nay */}
            <button
              onClick={() => onDateChange(new Date().toISOString().split('T')[0])}
              style={{
                padding: '6px 12px',
                borderRadius: '9px',
                fontSize: '0.76rem',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Hôm nay
            </button>

            {/* Nút Làm Mới */}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 12px',
                borderRadius: '9px',
                fontSize: '0.78rem',
                fontWeight: 600,
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
              title="Cập nhật lại số liệu mới nhất"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Làm mới</span>
            </button>

            {/* NÚT XUẤT BÁO CÁO ĐỐI SOÁT */}
            <button
              onClick={() => setShowHandoverModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={16} />
              <span>Xuất Báo Cáo Đối Soát</span>
            </button>
          </div>
        </div>

        {/* Hàng 2: Bộ lọc Khung giờ tiếp nhận hồ sơ thực tế của Sở */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Khung giờ tiếp nhận:
          </span>

          <button
            onClick={() => handleShiftChange('ALL')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: shift === 'ALL' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              backgroundColor: shift === 'ALL' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: shift === 'ALL' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Cả Ngày (00h – 24h)
          </button>

          <button
            onClick={() => handleShiftChange('MORNING')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: shift === 'MORNING' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              backgroundColor: shift === 'MORNING' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: shift === 'MORNING' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Phiên Sáng (08h00 – 12h00)
          </button>

          <button
            onClick={() => handleShiftChange('AFTERNOON')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: shift === 'AFTERNOON' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
              backgroundColor: shift === 'AFTERNOON' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: shift === 'AFTERNOON' ? '#f59e0b' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <Flame size={14} color="#f59e0b" />
            <span>Phiên Chiều (13h00 – 17h30)</span>
            <span
              style={{
                fontSize: '0.62rem',
                padding: '1px 5px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
                color: '#f59e0b',
                fontWeight: 800,
              }}
            >
              Cao điểm
            </span>
          </button>

          <button
            onClick={() => handleShiftChange('OVERTIME')}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '0.78rem',
              fontWeight: 700,
              border: shift === 'OVERTIME' ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              backgroundColor: shift === 'OVERTIME' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
              color: shift === 'OVERTIME' ? '#3b82f6' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Ngoài Giờ Hành Chính (Sau 17h30)
          </button>
        </div>
      </div>

      {/* =========================================================================
       * 2. HÀNG 6 THẺ KPI CỐT LÕI (CLICK-TO-DRILLDOWN VÀO BẢNG)
       * ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
        }}
      >
        {/* Thẻ 1: Tổng email nhận */}
        <div
          onClick={() => handleCardClick('ALL')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tổng Hồ Sơ
            </span>
            <Users size={16} color="#3b82f6" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '8px 0 2px 0' }}>
            {kpi.totalEmails}
          </p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Toàn bộ hồ sơ tiếp nhận
          </span>
        </div>

        {/* Thẻ 2: Quét thành công */}
        <div
          onClick={() => handleCardClick('ALL')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              Quét Thành Công
            </span>
            <CheckCircle2 size={16} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '8px 0 2px 0' }}>
            {kpi.scannedSuccess}
          </p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Bot đã bóc tách hồ sơ
          </span>
        </div>

        {/* Thẻ 3: Đang chờ xử lý */}
        <div
          onClick={() => handleCardClick('ALL')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(148, 163, 184, 0.3)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Đang Chờ Xử Lý
            </span>
            <Clock size={16} color="#94a3b8" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#94a3b8', margin: '8px 0 2px 0' }}>
            {kpi.pendingProcessing}
          </p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Chờ nạp file / đồng bộ MS
          </span>
        </div>

        {/* Thẻ 4: Khớp 100% */}
        <div
          onClick={() => handleCardClick('KHOP')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '2px solid rgba(16, 185, 129, 0.5)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              Khớp 100%
            </span>
            <Sparkles size={16} color="#10b981" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '8px 0 2px 0' }}>
            {kpi.matchedCount}{' '}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              ({kpi.matchRate}%)
            </span>
          </p>
          <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>
            Sẵn sàng duyệt mở TK
          </span>
        </div>

        {/* Thẻ 5: Lệch thông tin / Cần kiểm tra */}
        <div
          onClick={() => handleCardClick('LECH')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase' }}>
              Lệch / Kiểm Tra
            </span>
            <AlertTriangle size={16} color="#ef4444" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ef4444', margin: '8px 0 2px 0' }}>
            {kpi.mismatchedCount + kpi.canKiemTraCount}
          </p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Cần kiểm tra trước duyệt
          </span>
        </div>

        {/* Thẻ 6: Vi phạm quy chuẩn */}
        <div
          onClick={() => handleCardClick('CAN_KIEM_TRA')}
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '14px',
            padding: '16px 18px',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase' }}>
              Vi Phạm Quy Chuẩn
            </span>
            <AlertOctagon size={16} color="#f59e0b" />
          </div>
          <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f59e0b', margin: '8px 0 2px 0' }}>
            {kpi.invalidFormatCount}
          </p>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Lỗi cú pháp mail / file HĐ
          </span>
        </div>
      </div>

      {/* =========================================================================
       * 3. THỐNG KÊ CƠ CẤU PHÂN HỆ TIỂU KHOẢN (SUB-ACCOUNT BREAKDOWN)
       * ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={17} color="#3b82f6" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Cơ Cấu Phân Hệ Đăng Ký (Sub-Account Distribution)
            </h3>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Bấm vào phân hệ để lọc danh sách tài khoản
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '14px',
          }}
        >
          {/* 1. Futures Cơ sở */}
          <div
            onClick={() => handleCardClick('FUTURES')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#3b82f6' }}>
                1. Futures Cơ Sở
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#3b82f6' }}>100%</span>
            </div>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
              {subAccounts.futuresCount}{' '}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>tài khoản</span>
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Hợp đồng mở TK tiêu chuẩn
            </span>
          </div>

          {/* 2. ACM (-A) */}
          <div
            onClick={() => handleCardClick('ACM')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#10b981' }}>
                2. Tiểu Khoản ACM (-A)
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#10b981' }}>
                {subAccounts.acmRate}%
              </span>
            </div>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
              {subAccounts.acmCount}{' '}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>tài khoản</span>
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Kèm Phụ lục PL01 Straits
            </span>
          </div>

          {/* 3. LME (-L) */}
          <div
            onClick={() => handleCardClick('LME')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#f59e0b' }}>
                3. Tiểu Khoản LME (-L)
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f59e0b' }}>
                {subAccounts.lmeRate}%
              </span>
            </div>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
              {subAccounts.lmeCount}{' '}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>tài khoản</span>
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Phụ lục giao dịch LME
            </span>
          </div>

          {/* 4. Spread (-S) */}
          <div
            onClick={() => handleCardClick('SPREAD')}
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(168, 85, 247, 0.08)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#a855f7' }}>
                4. Spread (-S)
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#a855f7' }}>
                {subAccounts.spreadRate}%
              </span>
            </div>
            <p style={{ fontSize: '1.3rem', fontWeight: 800, margin: '6px 0 2px 0', color: 'var(--text-primary)' }}>
              {subAccounts.spreadCount}{' '}
              <span style={{ fontSize: '0.74rem', fontWeight: 500, color: 'var(--text-muted)' }}>tài khoản</span>
            </p>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Kèm mã danh mục Spread
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 4. BIỂU ĐỒ 1 & BIỂU ĐỒ 2: KHUNG GIỜ NHẬN HỒ SƠ & HIỆU NĂNG LATENCY
       * ========================================================================= */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: '20px',
        }}
      >
        {/* Biểu đồ 1: Khung Giờ Nhận Email Trong Ca */}
        <div
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={17} color="#3b82f6" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Khung Giờ Nhận Hồ Sơ (Hourly Distribution)
              </h3>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Click cột để lọc hồ sơ
            </span>
          </div>

          {/* Bar Chart Container */}
          <div
            style={{
              flex: 1,
              minHeight: '190px',
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              paddingTop: '20px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '8px',
            }}
          >
            {hourlyDistribution.map((item) => {
              const heightPercent = maxHourlyCount > 0 ? (item.total / maxHourlyCount) * 100 : 0;
              const isSelected = selectedHour === item.hour;
              const isPeak = item.total >= maxHourlyCount * 0.7 && item.total > 0;

              return (
                <div
                  key={item.hour}
                  onClick={() => handleHourClick(item.hour)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: '4px',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`${item.label}: ${item.total} hồ sơ (${item.matched} khớp, ${item.mismatched} lệch)`}
                >
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: item.total > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {item.total > 0 ? item.total : ''}
                  </span>

                  {/* Vertical Bar */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: '28px',
                      height: `${Math.max(heightPercent, 4)}%`,
                      borderRadius: '6px 6px 2px 2px',
                      background: isPeak
                        ? 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)'
                        : isSelected
                        ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)'
                        : 'linear-gradient(180deg, rgba(59, 130, 246, 0.7) 0%, rgba(59, 130, 246, 0.3) 100%)',
                      boxShadow: isPeak ? '0 2px 8px rgba(245, 158, 11, 0.35)' : 'none',
                      transition: 'all 0.15s ease',
                      border: isSelected ? '1px solid #ffffff' : 'none',
                    }}
                  />

                  {/* Label Giờ */}
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: isSelected ? '#3b82f6' : 'var(--text-muted)',
                      marginTop: '4px',
                    }}
                  >
                    {item.hour}h
                  </span>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Flame size={13} color="#f59e0b" />
              <span style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600 }}>
                Khung giờ cao điểm: 14h00 - 16h30
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Đỉnh nhận: {maxHourlyCount} hồ sơ/giờ
            </span>
          </div>
        </div>

        {/* Biểu đồ 2: Đo Lường Hiệu Năng & Tốc Độ Xử Lý (Latency Breakdown) */}
        <div
          className="glass-panel"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            padding: '20px 24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={17} color="#10b981" />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Đo Lường Hiệu Năng & Tốc Độ (Latency)
                </h3>
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                🟢 Ổn định
              </span>
            </div>

            {/* Phân rã 4 chặng xử lý */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Chặng 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>1. Nạp mail & Tải đính kèm (Graph API)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latency.mailIngestSeconds}s</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '12%', height: '100%', backgroundColor: '#3b82f6', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Chặng 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>2. OCR CCCD & Đọc Hợp Đồng PDF</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latency.ocrSeconds}s</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '36%', height: '100%', backgroundColor: '#a855f7', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Chặng 3 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>3. Đồng bộ M-System (Playwright RPA)</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latency.msScraperSeconds}s</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '51%', height: '100%', backgroundColor: '#f59e0b', borderRadius: '3px' }} />
                </div>
              </div>

              {/* Chặng 4 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>4. Thẩm định quy tắc & Đối soát</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{latency.reconcileSeconds}s</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '2%', height: '100%', backgroundColor: '#10b981', borderRadius: '3px' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Metric Summary Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '16px',
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thời gian trung bình / hồ sơ</span>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981', margin: '2px 0 0 0' }}>
                {latency.avgTotalSeconds} giây
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Năng lực xử lý đỉnh</span>
              <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                ~{latency.throughputPerHour} hs/giờ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
       * 5. BIỂU ĐỒ 3: XẾP HẠNG & CHẤT LƯỢNG HỒ SƠ THEO TVKD (MEMBER SCORECARD)
       * ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={17} color="#3b82f6" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Chất Lượng Hồ Sơ Theo Thành Viên Kinh Doanh (Top TVKD)
            </h3>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Bấm vào TVKD để lọc danh sách tài khoản
          </span>
        </div>

        {topMembers.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Chưa có dữ liệu thành viên kinh doanh trong đợt này
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {topMembers.map((m) => {
              const isExcellent = m.matchRate >= 90;
              const isGood = m.matchRate >= 80 && m.matchRate < 90;
              const isAverage = m.matchRate < 80;

              return (
                <div
                  key={m.maTVKD}
                  onClick={() => handleMemberClick(m.maTVKD)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {/* Mã TVKD Badge */}
                  <div
                    style={{
                      width: '42px',
                      padding: '4px 0',
                      textAlign: 'center',
                      borderRadius: '6px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      fontWeight: 800,
                      fontSize: '0.82rem',
                    }}
                  >
                    {m.maTVKD}
                  </div>

                  {/* Tên TVKD */}
                  <div style={{ width: '160px' }}>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      {m.name}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {m.total} hồ sơ gửi
                    </span>
                  </div>

                  {/* Thanh Tiến Độ Tỷ Lệ Khớp vs Lệch */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '10px',
                        backgroundColor: 'rgba(239, 68, 68, 0.3)',
                        borderRadius: '5px',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      <div
                        style={{
                          width: `${m.matchRate}%`,
                          height: '100%',
                          backgroundColor: '#10b981',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        width: '45px',
                        textAlign: 'right',
                        color: isExcellent ? '#10b981' : isGood ? '#f59e0b' : '#ef4444',
                      }}
                    >
                      {m.matchRate}%
                    </span>
                  </div>

                  {/* Chi tiết đếm */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.75rem' }}>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{m.matched} Khớp</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>{m.mismatched} Lệch</span>
                  </div>

                  <ChevronRight size={15} color="var(--text-muted)" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* =========================================================================
       * 6. DANH SÁCH HỒ SƠ TỒN ĐỌNG CẦN XỬ LÝ (ACTION WATCHLIST)
       * ========================================================================= */}
      <div
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={17} color="#f59e0b" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Danh Sách Hồ Sơ Tồn Đọng Cần Xử Lý ({pendingHandoverList.length} tài khoản)
            </h3>
          </div>
          <button
            onClick={() => handleCardClick('LECH')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.76rem',
              color: '#3b82f6',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span>Mở Bảng Chi Tiết</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {pendingHandoverList.length === 0 ? (
          <div
            style={{
              padding: '24px',
              textAlign: 'center',
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 6px auto' }} />
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
              Tuyệt vời! Đã hoàn tất đối soát 100% hồ sơ, không có tài khoản tồn đọng.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>STT</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Mã TKGD</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Họ Và Tên</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>TVKD</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Trạng Thái</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Lý Do Cần Xử Lý</th>
                  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>Biện Pháp Xử Lý</th>
                </tr>
              </thead>
              <tbody>
                {pendingHandoverList.slice(0, 10).map((item, idx) => (
                  <tr
                    key={item.maTKGD + idx}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}
                  >
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 700, color: '#3b82f6' }}>{item.maTKGD}</td>
                    <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.hoVaTen}</td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-secondary)' }}>{item.maTVKD}</td>
                    <td style={{ padding: '10px 10px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          backgroundColor:
                            item.trangThai === 'LECH'
                              ? 'rgba(239, 68, 68, 0.15)'
                              : item.trangThai === 'CAN_KIEM_TRA'
                              ? 'rgba(245, 158, 11, 0.15)'
                              : 'rgba(148, 163, 184, 0.15)',
                          color:
                            item.trangThai === 'LECH'
                              ? '#ef4444'
                              : item.trangThai === 'CAN_KIEM_TRA'
                              ? '#f59e0b'
                              : '#94a3b8',
                        }}
                      >
                        {item.trangThai === 'LECH' ? 'Lệch' : item.trangThai === 'CAN_KIEM_TRA' ? 'Cần ktra' : 'Chưa xử lý'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                      {item.lyDoLech}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#3b82f6', fontWeight: 600 }}>
                      {item.hanhDongCaSau}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
       * MODAL XUẤT BIÊN BẢN BÀN GIAO CA
       * ========================================================================= */}
      {data && (
        <TkgdShiftHandoverModal
          isOpen={showHandoverModal}
          onClose={() => setShowHandoverModal(false)}
          analyticsData={data}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};
