'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Download,
  RefreshCw,
  FileSpreadsheet,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Award,
  Layers,
  BarChart3,
  PieChart,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

interface IMonthlyReportSectionProps {
  token: string | null;
}

// Data model matching MonthlyReportSnapshot
export interface IMonthlyReportData {
  year: number;
  month: number;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  generatedAt: string;
  summary: {
    totalVolumeCurrentMonth: number;
    totalVolumePrevMonth: number;
    volumeGrowthRate: number;
    cqgVolume: number;
    cqgShareRate: number;
    acmVolume: number;
    acmShareRate: number;
    cqgTradingDays: number;
    acmTradingDays: number;
    top1Member?: { memberCode: string; memberName: string; volume: number; shareRate: number };
    top1Commodity?: { commodityCode: string; commodityName: string; volume: number; shareRate: number };
  };
  part1Members: {
    cqgMembers: Array<{
      stt: number;
      memberCode: string;
      memberName: string;
      prevMonthVolume: number;
      currentMonthVolume: number;
      volumeDiff: number;
      growthRate: number;
      shareRate: number;
      maxDayDate: string;
      maxDayVolume: number;
      minDayDate: string;
      minDayVolume: number;
      tradingDaysCount: number;
      activeAccountsPrevMonth: number;
      activeAccountsCurrentMonth: number;
      activeAccountsDiff: number;
    }>;
    acmMembers: Array<{
      stt: number;
      memberCode: string;
      memberName: string;
      prevMonthVolume: number;
      currentMonthVolume: number;
      volumeDiff: number;
      growthRate: number;
      shareRate: number;
      maxDayDate: string;
      maxDayVolume: number;
      minDayDate: string;
      minDayVolume: number;
      tradingDaysCount: number;
      activeAccountsPrevMonth: number;
      activeAccountsCurrentMonth: number;
      activeAccountsDiff: number;
    }>;
    totals: {
      cqg: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
      acm: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
      overall: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
    };
  };
  part2Commodities: {
    cqgCommodities: Array<{
      stt: number;
      commodityCode: string;
      commodityName: string;
      exchange: string;
      prevMonthVolume: number;
      currentMonthVolume: number;
      volumeDiff: number;
      growthRate: number;
      shareRate: number;
    }>;
    acmCommodities: Array<{
      stt: number;
      commodityCode: string;
      commodityName: string;
      exchange: string;
      prevMonthVolume: number;
      currentMonthVolume: number;
      volumeDiff: number;
      growthRate: number;
      shareRate: number;
    }>;
    totals: {
      cqg: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
      acm: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
      overall: { prevMonthVolume: number; currentMonthVolume: number; volumeDiff: number; growthRate: number; shareRate: number };
    };
  };
  part3SpecialProducts: {
    spread: {
      rows: Array<{
        stt: number;
        memberCode: string;
        memberName: string;
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      }>;
      total: {
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      };
    };
    lme: {
      rows: Array<{
        stt: number;
        memberCode: string;
        memberName: string;
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      }>;
      total: {
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      };
    };
    options: {
      rows: Array<{
        stt: number;
        memberCode: string;
        memberName: string;
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      }>;
      total: {
        prevMonthVolume: number;
        currentMonthVolume: number;
        volumeDiff: number;
        activeAccountsPrevMonth: number;
        activeAccountsCurrentMonth: number;
        totalActiveAccounts: number;
      };
    };
  };
}

export default function MonthlyReportSection({ token }: IMonthlyReportSectionProps) {
  // 1. Selection State
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(() => {
    return currentDate.getFullYear();
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(() => {
    // Mặc định tháng trước nếu đầu tháng, hoặc tháng hiện tại
    const m = currentDate.getMonth(); // 0-based
    return m === 0 ? 12 : m; // Nếu tháng 1 thì về tháng 12
  });

  // 2. Report Data State
  const [reportData, setReportData] = useState<IMonthlyReportData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);

  // 3. UI Sub-Tab State
  const [mainTab, setMainTab] = useState<'PART1_MEMBERS' | 'PART2_COMMODITIES' | 'PART3_SPECIAL'>('PART1_MEMBERS');
  const [part1Platform, setPart1Platform] = useState<'CQG' | 'ACM'>('CQG');
  const [part2Platform, setPart2Platform] = useState<'CQG' | 'ACM'>('CQG');
  const [part3Product, setPart3Product] = useState<'SPREAD' | 'LME' | 'OPTIONS'>('SPREAD');

  // 4. Search Filter State
  const [memberSearchQuery, setMemberSearchQuery] = useState<string>('');
  const [commoditySearchQuery, setCommoditySearchQuery] = useState<string>('');

  // 5. Fetch Report Data
  const fetchMonthlyReport = useCallback(
    async (forceRefresh = false) => {
      if (!token) return;
      setIsLoading(true);
      try {
        const url = `${API_BASE_URL}/api/v1/trading-ops/monthly-report/${selectedYear}/${selectedMonth}${
          forceRefresh ? '?forceRefresh=true' : ''
        }`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }
        const json = await res.json();
        if (json.success && json.data) {
          setReportData(json.data);
          if (forceRefresh) {
            toast.success(`Đã tính toán và làm mới số liệu Tháng ${selectedMonth}/${selectedYear}`);
          }
        } else {
          toast.error(json.message || 'Không thể lấy dữ liệu báo cáo tháng');
        }
      } catch (err: any) {
        console.error('Lỗi khi tải báo cáo tháng:', err);
        toast.error(`Lỗi kết nối: ${err.message || 'Không thể tải báo cáo'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [token, selectedYear, selectedMonth]
  );

  useEffect(() => {
    fetchMonthlyReport(false);
  }, [fetchMonthlyReport]);

  // 6. Export Excel Action
  const handleExportExcel = async () => {
    if (!token) {
      toast.error('Vui lòng đăng nhập');
      return;
    }
    setIsExporting(true);
    const toastId = toast.loading(`Đang kết xuất Báo cáo Tháng ${selectedMonth}.${selectedYear} chuẩn 100% template MXV...`);
    try {
      const url = `${API_BASE_URL}/api/v1/trading-ops/monthly-report/${selectedYear}/${selectedMonth}/export-excel`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Không thể tải file excel (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const formattedMonth = selectedMonth < 10 ? `0${selectedMonth}` : `${selectedMonth}`;
      a.download = `Bao cao thang ${formattedMonth}.${selectedYear} - Final.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(`Đã tải về thành công file Báo Cáo Tháng ${formattedMonth}.${selectedYear}`, { id: toastId });
    } catch (err: any) {
      console.error('Lỗi kết xuất Excel:', err);
      toast.error(`Lỗi kết xuất Excel: ${err.message || 'Thao tác thất bại'}`, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // 7. Lock Snapshot Action
  const handleLockSnapshot = async () => {
    if (!token) return;
    const isAlreadyLocked = reportData?.isLocked;
    const confirmMessage = isAlreadyLocked
      ? `Kỳ báo cáo Tháng ${selectedMonth}/${selectedYear} đã được khóa sổ. Bạn có muốn cập nhật lại và khóa sổ lại không?`
      : `Bạn có chắc chắn muốn CHỐT SỔ & KHÓA DỮ LIỆU kỳ Tháng ${selectedMonth}/${selectedYear}? Dữ liệu sau khi khóa sẽ được lưu trữ bất biến.`;

    if (!window.confirm(confirmMessage)) return;

    setIsLocking(true);
    const toastId = toast.loading('Đang lưu và khóa sổ snapshot...');
    try {
      const url = `${API_BASE_URL}/api/v1/trading-ops/monthly-report/${selectedYear}/${selectedMonth}/lock-snapshot`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Đã khóa sổ thành công kỳ Tháng ${selectedMonth}/${selectedYear}!`, { id: toastId });
        await fetchMonthlyReport(false);
      } else {
        toast.error(json.message || 'Khóa sổ thất bại', { id: toastId });
      }
    } catch (err: any) {
      console.error('Lỗi khóa sổ:', err);
      toast.error(`Lỗi khóa sổ: ${err.message}`, { id: toastId });
    } finally {
      setIsLocking(false);
    }
  };

  // Helpers formatting
  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    return num.toLocaleString('en-US');
  };

  const formatPercent = (pct: number | undefined | null) => {
    if (pct === undefined || pct === null || isNaN(pct)) return '0.00%';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${(pct * 100).toFixed(2)}%`;
  };

  const formatShare = (pct: number | undefined | null) => {
    if (pct === undefined || pct === null || isNaN(pct)) return '0.00%';
    return `${(pct * 100).toFixed(2)}%`;
  };

  // Filtered members
  const filteredCqgMembers = useMemo(() => {
    if (!reportData?.part1Members?.cqgMembers) return [];
    if (!memberSearchQuery.trim()) return reportData.part1Members.cqgMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return reportData.part1Members.cqgMembers.filter(
      (m) => m.memberCode.toLowerCase().includes(q) || m.memberName.toLowerCase().includes(q)
    );
  }, [reportData, memberSearchQuery]);

  const filteredAcmMembers = useMemo(() => {
    if (!reportData?.part1Members?.acmMembers) return [];
    if (!memberSearchQuery.trim()) return reportData.part1Members.acmMembers;
    const q = memberSearchQuery.toLowerCase().trim();
    return reportData.part1Members.acmMembers.filter(
      (m) => m.memberCode.toLowerCase().includes(q) || m.memberName.toLowerCase().includes(q)
    );
  }, [reportData, memberSearchQuery]);

  // Filtered commodities
  const filteredCqgCommodities = useMemo(() => {
    if (!reportData?.part2Commodities?.cqgCommodities) return [];
    if (!commoditySearchQuery.trim()) return reportData.part2Commodities.cqgCommodities;
    const q = commoditySearchQuery.toLowerCase().trim();
    return reportData.part2Commodities.cqgCommodities.filter(
      (c) =>
        c.commodityCode.toLowerCase().includes(q) ||
        c.commodityName.toLowerCase().includes(q) ||
        c.exchange.toLowerCase().includes(q)
    );
  }, [reportData, commoditySearchQuery]);

  const filteredAcmCommodities = useMemo(() => {
    if (!reportData?.part2Commodities?.acmCommodities) return [];
    if (!commoditySearchQuery.trim()) return reportData.part2Commodities.acmCommodities;
    const q = commoditySearchQuery.toLowerCase().trim();
    return reportData.part2Commodities.acmCommodities.filter(
      (c) =>
        c.commodityCode.toLowerCase().includes(q) ||
        c.commodityName.toLowerCase().includes(q) ||
        c.exchange.toLowerCase().includes(q)
    );
  }, [reportData, commoditySearchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. CONTROL HEADER BAR */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e2e8f0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        {/* Left: Year & Month Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#0284c7" />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Kỳ Báo Cáo:</span>
          </div>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m < 10 ? `0${m}` : m}
              </option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>

          {/* Snapshot Status Badge */}
          {reportData && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: reportData.isLocked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                color: reportData.isLocked ? '#059669' : '#b45309',
                border: reportData.isLocked ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(234, 179, 8, 0.3)',
              }}
            >
              {reportData.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
              <span>{reportData.isLocked ? 'Đã Chốt Sổ (Locked)' : 'Bản Nháp Realtime (Draft)'}</span>
            </div>
          )}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Refresh / Recompute Button */}
          <button
            type="button"
            onClick={() => fetchMonthlyReport(true)}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border-color, #cbd5e1)',
              backgroundColor: 'var(--bg-card, #ffffff)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            title="Tính toán lại toàn bộ số liệu tháng từ file backup hàng ngày"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>{isLoading ? 'Đang tính...' : 'Làm Mới'}</span>
          </button>

          {/* Lock Snapshot Button */}
          <button
            type="button"
            onClick={handleLockSnapshot}
            disabled={isLocking || isLoading || !reportData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(2, 132, 199, 0.3)',
              backgroundColor: 'rgba(2, 132, 199, 0.08)',
              color: '#0284c7',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: isLocking || isLoading || !reportData ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
            title="Lưu bản ghi chốt sổ cố định vào CSDL"
          >
            <ShieldCheck size={14} />
            <span>{reportData?.isLocked ? 'Cập Nhật Chốt Sổ' : 'Chốt Sổ Kỳ Này'}</span>
          </button>

          {/* Export Excel Button */}
          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExporting || isLoading || !reportData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: isExporting || isLoading || !reportData ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s',
            }}
          >
            <FileSpreadsheet size={15} />
            <span>{isExporting ? 'Đang tạo Excel...' : 'Tải File Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI SUMMARY CARDS */}
      {reportData && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Card 1: Tổng Khối Lượng */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                TỔNG KHỐI LƯỢNG THÁNG
              </span>
              <BarChart3 size={16} color="#0284c7" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text-primary)' }}>
              {formatNumber(reportData.summary.totalVolumeCurrentMonth)}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>lots</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
              {reportData.summary.volumeGrowthRate > 0 ? (
                <span
                  style={{
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: 700,
                  }}
                >
                  <TrendingUp size={13} /> {formatPercent(reportData.summary.volumeGrowthRate)}
                </span>
              ) : reportData.summary.volumeGrowthRate < 0 ? (
                <span
                  style={{
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    fontWeight: 700,
                  }}
                >
                  <TrendingDown size={13} /> {formatPercent(reportData.summary.volumeGrowthRate)}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                  <Minus size={13} /> 0.00%
                </span>
              )}
              <span style={{ color: 'var(--text-muted)' }}>
                vs Tháng {selectedMonth === 1 ? 12 : selectedMonth - 1} (
                {formatNumber(reportData.summary.totalVolumePrevMonth)} lots)
              </span>
            </div>
          </div>

          {/* Card 2: Khối CQG */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>KHỐI LƯỢNG CQG</span>
              <Layers size={16} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#10b981' }}>
              {formatNumber(reportData.summary.cqgVolume)}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>lots</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tỷ trọng: <strong>{formatShare(reportData.summary.cqgShareRate)}</strong> toàn thị trường (
              {reportData.summary.cqgTradingDays} phiên)
            </div>
          </div>

          {/* Card 3: Khối ACM */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                KHỐI LƯỢNG ACM (NANO)
              </span>
              <PieChart size={16} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.45rem', fontWeight: 900, color: '#f59e0b' }}>
              {formatNumber(reportData.summary.acmVolume)}{' '}
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>lots</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tỷ trọng: <strong>{formatShare(reportData.summary.acmShareRate)}</strong> toàn thị trường (
              {reportData.summary.acmTradingDays} phiên)
            </div>
          </div>

          {/* Card 4: Top TVKD & Top Hàng */}
          <div
            style={{
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                TOP 1 TVKD & MẶT HÀNG
              </span>
              <Award size={16} color="#8b5cf6" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {reportData.summary.top1Member ? (
                  <>
                    TVKD: {reportData.summary.top1Member.memberCode} ({formatNumber(reportData.summary.top1Member.volume)}{' '}
                    lot - {formatShare(reportData.summary.top1Member.shareRate)})
                  </>
                ) : (
                  'Chưa có dữ liệu'
                )}
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0284c7' }}>
                {reportData.summary.top1Commodity ? (
                  <>
                    Hàng: {reportData.summary.top1Commodity.commodityCode} (
                    {formatNumber(reportData.summary.top1Commodity.volume)} lot -{' '}
                    {formatShare(reportData.summary.top1Commodity.shareRate)})
                  </>
                ) : (
                  'Chưa có dữ liệu'
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN NAVIGATION TABS */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '2px solid var(--border-color, #e2e8f0)',
          paddingBottom: '2px',
        }}
      >
        {/* Tab 1: Xếp hạng TVKD */}
        <button
          type="button"
          onClick={() => setMainTab('PART1_MEMBERS')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: mainTab === 'PART1_MEMBERS' ? '2px solid #0284c7' : '2px solid transparent',
            color: mainTab === 'PART1_MEMBERS' ? '#0284c7' : 'var(--text-secondary)',
            backgroundColor: mainTab === 'PART1_MEMBERS' ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Building2 size={16} />
          <span>I. Xếp Hạng TVKD (CQG & ACM)</span>
        </button>

        {/* Tab 2: Cơ cấu Mặt hàng */}
        <button
          type="button"
          onClick={() => setMainTab('PART2_COMMODITIES')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: mainTab === 'PART2_COMMODITIES' ? '2px solid #0284c7' : '2px solid transparent',
            color: mainTab === 'PART2_COMMODITIES' ? '#0284c7' : 'var(--text-secondary)',
            backgroundColor: mainTab === 'PART2_COMMODITIES' ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <BarChart3 size={16} />
          <span>II. Cơ Cấu Mặt Hàng</span>
        </button>

        {/* Tab 3: Sản phẩm đặc thù */}
        <button
          type="button"
          onClick={() => setMainTab('PART3_SPECIAL')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            borderRadius: '8px 8px 0 0',
            border: 'none',
            borderBottom: mainTab === 'PART3_SPECIAL' ? '2px solid #0284c7' : '2px solid transparent',
            color: mainTab === 'PART3_SPECIAL' ? '#0284c7' : 'var(--text-secondary)',
            backgroundColor: mainTab === 'PART3_SPECIAL' ? 'rgba(2, 132, 199, 0.08)' : 'transparent',
            fontWeight: 700,
            fontSize: '0.85rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Layers size={16} />
          <span>III. Sản Phẩm Đặc Thù (Spread, LME, Options)</span>
        </button>
      </div>

      {/* 4. TAB CONTENTS */}
      {isLoading ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            gap: '12px',
          }}
        >
          <RefreshCw size={28} className="animate-spin" color="#0284c7" />
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Đang tổng hợp dữ liệu Báo Cáo Tháng {selectedMonth}/{selectedYear}...
          </span>
        </div>
      ) : !reportData ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--bg-card, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border-color, #e2e8f0)',
            gap: '12px',
          }}
        >
          <AlertCircle size={32} color="#f59e0b" />
          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Chưa có dữ liệu cho Tháng {selectedMonth}/{selectedYear}
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Nhấn nút &quot;Làm Mới&quot; để hệ thống quét dữ liệu từ các file backup trong tháng và tự động tính toán.
          </span>
          <button
            type="button"
            onClick={() => fetchMonthlyReport(true)}
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Quét & Tính Toán Ngay
          </button>
        </div>
      ) : (
        <>
          {/* TAB 1: PHẦN I - XẾP HẠNG TVKD */}
          {mainTab === 'PART1_MEMBERS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Sub-Switch Platform & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Platform Switch Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPart1Platform('CQG')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: part1Platform === 'CQG' ? '#10b981' : 'var(--border-color, #cbd5e1)',
                      backgroundColor: part1Platform === 'CQG' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card, #ffffff)',
                      color: part1Platform === 'CQG' ? '#059669' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    1. Khối CQG ({reportData.part1Members.cqgMembers.length} TVKD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPart1Platform('ACM')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: part1Platform === 'ACM' ? '#f59e0b' : 'var(--border-color, #cbd5e1)',
                      backgroundColor: part1Platform === 'ACM' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card, #ffffff)',
                      color: part1Platform === 'ACM' ? '#b45309' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    2. Khối ACM Nano ({reportData.part1Members.acmMembers.length} TVKD)
                  </button>
                </div>

                {/* Search input */}
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search
                    size={15}
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
                    placeholder="Tìm theo mã hoặc tên TVKD..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 12px 6px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  overflowX: 'auto',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        borderBottom: '2px solid var(--border-color, #e2e8f0)',
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>STT</th>
                      <th style={{ padding: '10px 12px', width: '80px' }}>Mã TV</th>
                      <th style={{ padding: '10px 12px' }}>Tên Thành Viên Kinh Doanh</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                        Tháng {selectedMonth === 1 ? 12 : selectedMonth - 1}
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                        Tháng {selectedMonth}
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chênh Lệch</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Biến Động</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Thị Phần</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ngày Đỉnh</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Lot Đỉnh</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Ngày Đáy</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Lot Đáy</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center' }}>Số Phiên</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TK Active T-1</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TK Active T</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>TK +/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(part1Platform === 'CQG' ? filteredCqgMembers : filteredAcmMembers).map((m, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={m.memberCode}
                          style={{
                            borderBottom: '1px solid var(--border-color, #f1f5f9)',
                            backgroundColor: isEven ? 'transparent' : 'var(--bg-app, #fafafa)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {m.stt}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {m.memberCode}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {m.memberName}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(m.prevMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: '#0284c7',
                            }}
                          >
                            {formatNumber(m.currentMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: m.volumeDiff > 0 ? '#059669' : m.volumeDiff < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {m.volumeDiff > 0 ? `+${formatNumber(m.volumeDiff)}` : formatNumber(m.volumeDiff)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: m.growthRate > 0 ? '#059669' : m.growthRate < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {formatPercent(m.growthRate)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatShare(m.shareRate)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {m.maxDayDate || '-'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(m.maxDayVolume)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {m.minDayDate || '-'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(m.minDayVolume)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>{m.tradingDaysCount}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(m.activeAccountsPrevMonth)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 700,
                            }}
                          >
                            {formatNumber(m.activeAccountsCurrentMonth)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: m.activeAccountsDiff > 0 ? '#059669' : m.activeAccountsDiff < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {m.activeAccountsDiff > 0 ? `+${m.activeAccountsDiff}` : m.activeAccountsDiff}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    {(() => {
                      const t =
                        part1Platform === 'CQG'
                          ? reportData.part1Members.totals.cqg
                          : reportData.part1Members.totals.acm;
                      return (
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-app, #f1f5f9)',
                            borderTop: '2px solid var(--border-color, #cbd5e1)',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <td colSpan={3} style={{ padding: '12px', textAlign: 'center' }}>
                            TỔNG CỘNG ({part1Platform})
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(t.prevMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0284c7',
                            }}
                          >
                            {formatNumber(t.currentMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: t.volumeDiff > 0 ? '#059669' : t.volumeDiff < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {t.volumeDiff > 0 ? `+${formatNumber(t.volumeDiff)}` : formatNumber(t.volumeDiff)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              color: t.growthRate > 0 ? '#059669' : t.growthRate < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {formatPercent(t.growthRate)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{formatShare(t.shareRate)}</td>
                          <td colSpan={8} style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            -
                          </td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: PHẦN II - CƠ CẤU MẶT HÀNG */}
          {mainTab === 'PART2_COMMODITIES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Sub-Switch Platform & Search */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Platform Switch Buttons */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setPart2Platform('CQG')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: part2Platform === 'CQG' ? '#10b981' : 'var(--border-color, #cbd5e1)',
                      backgroundColor: part2Platform === 'CQG' ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-card, #ffffff)',
                      color: part2Platform === 'CQG' ? '#059669' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    1. Mặt Hàng CQG ({reportData.part2Commodities.cqgCommodities.length} mặt hàng)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPart2Platform('ACM')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: part2Platform === 'ACM' ? '#f59e0b' : 'var(--border-color, #cbd5e1)',
                      backgroundColor: part2Platform === 'ACM' ? 'rgba(245, 158, 11, 0.12)' : 'var(--bg-card, #ffffff)',
                      color: part2Platform === 'ACM' ? '#b45309' : 'var(--text-secondary)',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                    }}
                  >
                    2. Mặt Hàng ACM Nano ({reportData.part2Commodities.acmCommodities.length} mặt hàng)
                  </button>
                </div>

                {/* Search input */}
                <div style={{ position: 'relative', width: '260px' }}>
                  <Search
                    size={15}
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
                    placeholder="Tìm theo mã hàng, tên hàng, sàn..."
                    value={commoditySearchQuery}
                    onChange={(e) => setCommoditySearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 12px 6px 32px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '0.82rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Data Table */}
              <div
                style={{
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  overflowX: 'auto',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-app, #f8fafc)',
                        borderBottom: '2px solid var(--border-color, #e2e8f0)',
                        color: 'var(--text-secondary)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        fontSize: '0.72rem',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>STT</th>
                      <th style={{ padding: '10px 12px', width: '90px' }}>Mã Hàng</th>
                      <th style={{ padding: '10px 12px' }}>Tên Hàng Hóa</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', width: '100px' }}>Sàn Niêm Yết</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>
                        Tháng {selectedMonth === 1 ? 12 : selectedMonth - 1} (Lots)
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', color: '#0284c7' }}>
                        Tháng {selectedMonth} (Lots)
                      </th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Chênh Lệch</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Biến Động</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tỷ Trọng (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(part2Platform === 'CQG' ? filteredCqgCommodities : filteredAcmCommodities).map((c, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr
                          key={c.commodityCode}
                          style={{
                            borderBottom: '1px solid var(--border-color, #f1f5f9)',
                            backgroundColor: isEven ? 'transparent' : 'var(--bg-app, #fafafa)',
                          }}
                        >
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {c.stt}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                            {c.commodityCode}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {c.commodityName}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>
                            {c.exchange}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(c.prevMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: '#0284c7',
                            }}
                          >
                            {formatNumber(c.currentMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: c.volumeDiff > 0 ? '#059669' : c.volumeDiff < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {c.volumeDiff > 0 ? `+${formatNumber(c.volumeDiff)}` : formatNumber(c.volumeDiff)}
                          </td>
                          <td
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: c.growthRate > 0 ? '#059669' : c.growthRate < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {formatPercent(c.growthRate)}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700 }}>
                            {formatShare(c.shareRate)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals Row */}
                  <tfoot>
                    {(() => {
                      const t =
                        part2Platform === 'CQG'
                          ? reportData.part2Commodities.totals.cqg
                          : reportData.part2Commodities.totals.acm;
                      return (
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-app, #f1f5f9)',
                            borderTop: '2px solid var(--border-color, #cbd5e1)',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <td colSpan={4} style={{ padding: '12px', textAlign: 'center' }}>
                            TỔNG CỘNG ({part2Platform})
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(t.prevMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0284c7',
                            }}
                          >
                            {formatNumber(t.currentMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: t.volumeDiff > 0 ? '#059669' : t.volumeDiff < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {t.volumeDiff > 0 ? `+${formatNumber(t.volumeDiff)}` : formatNumber(t.volumeDiff)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              color: t.growthRate > 0 ? '#059669' : t.growthRate < 0 ? '#dc2626' : 'inherit',
                            }}
                          >
                            {formatPercent(t.growthRate)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>{formatShare(t.shareRate)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: PHẦN III - SẢN PHẨM ĐẶC THÙ */}
          {mainTab === 'PART3_SPECIAL' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Product Switch */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPart3Product('SPREAD')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: part3Product === 'SPREAD' ? '#0284c7' : 'var(--border-color, #cbd5e1)',
                    backgroundColor: part3Product === 'SPREAD' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card, #ffffff)',
                    color: part3Product === 'SPREAD' ? '#0284c7' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  1. Hợp Đồng Chênh Lệch Giá (Calendar Spread)
                </button>
                <button
                  type="button"
                  onClick={() => setPart3Product('LME')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: part3Product === 'LME' ? '#0284c7' : 'var(--border-color, #cbd5e1)',
                    backgroundColor: part3Product === 'LME' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card, #ffffff)',
                    color: part3Product === 'LME' ? '#0284c7' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  2. Kim Loại LME (London Metal Exchange)
                </button>
                <button
                  type="button"
                  onClick={() => setPart3Product('OPTIONS')}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: part3Product === 'OPTIONS' ? '#0284c7' : 'var(--border-color, #cbd5e1)',
                    backgroundColor: part3Product === 'OPTIONS' ? 'rgba(2, 132, 199, 0.12)' : 'var(--bg-card, #ffffff)',
                    color: part3Product === 'OPTIONS' ? '#0284c7' : 'var(--text-secondary)',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                  }}
                >
                  3. Hợp Đồng Quyền Chọn (Options)
                </button>
              </div>

              {/* Data Table with 2-Tier Header */}
              {(() => {
                const specialData =
                  part3Product === 'SPREAD'
                    ? reportData.part3SpecialProducts.spread
                    : part3Product === 'LME'
                    ? reportData.part3SpecialProducts.lme
                    : reportData.part3SpecialProducts.options;

                return (
                  <div
                    style={{
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-color, #e2e8f0)',
                      overflowX: 'auto',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                      <thead>
                        {/* Tier 1 Header */}
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-app, #f8fafc)',
                            borderBottom: '1px solid var(--border-color, #e2e8f0)',
                            color: 'var(--text-secondary)',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            fontSize: '0.72rem',
                            letterSpacing: '0.04em',
                          }}
                        >
                          <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>
                            STT
                          </th>
                          <th rowSpan={2} style={{ padding: '10px 12px', width: '80px' }}>
                            Mã TV
                          </th>
                          <th rowSpan={2} style={{ padding: '10px 12px' }}>
                            Tên Thành Viên Kinh Doanh
                          </th>
                          <th
                            colSpan={3}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'center',
                              backgroundColor: 'rgba(2, 132, 199, 0.08)',
                              color: '#0284c7',
                              borderLeft: '1px solid var(--border-color, #e2e8f0)',
                              borderRight: '1px solid var(--border-color, #e2e8f0)',
                            }}
                          >
                            Số Hợp Đồng (Lots)
                          </th>
                          <th
                            colSpan={3}
                            style={{
                              padding: '8px 12px',
                              textAlign: 'center',
                              backgroundColor: 'rgba(16, 185, 129, 0.08)',
                              color: '#059669',
                            }}
                          >
                            Số Tài Khoản Hoạt Động (Active)
                          </th>
                        </tr>
                        {/* Tier 2 Header */}
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-app, #f8fafc)',
                            borderBottom: '2px solid var(--border-color, #e2e8f0)',
                            color: 'var(--text-secondary)',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                          }}
                        >
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              borderLeft: '1px solid var(--border-color, #e2e8f0)',
                            }}
                          >
                            Tháng {selectedMonth === 1 ? 12 : selectedMonth - 1}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', color: '#0284c7' }}>
                            Tháng {selectedMonth}
                          </th>
                          <th
                            style={{
                              padding: '8px 12px',
                              textAlign: 'right',
                              borderRight: '1px solid var(--border-color, #e2e8f0)',
                            }}
                          >
                            So Sánh (+/-)
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>
                            Hết Tháng {selectedMonth === 1 ? 12 : selectedMonth - 1}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>Tháng {selectedMonth}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800 }}>Tổng Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {specialData.rows.length === 0 ? (
                          <tr>
                            <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              Không có giao dịch hoặc tài khoản active trong kỳ này
                            </td>
                          </tr>
                        ) : (
                          specialData.rows.map((r, idx) => {
                            const isEven = idx % 2 === 0;
                            return (
                              <tr
                                key={r.memberCode}
                                style={{
                                  borderBottom: '1px solid var(--border-color, #f1f5f9)',
                                  backgroundColor: isEven ? 'transparent' : 'var(--bg-app, #fafafa)',
                                }}
                              >
                                <td style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                  {r.stt}
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                                  {r.memberCode}
                                </td>
                                <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  {r.memberName}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 12px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    borderLeft: '1px solid var(--border-color, #f1f5f9)',
                                  }}
                                >
                                  {formatNumber(r.prevMonthVolume)}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 12px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    color: '#0284c7',
                                  }}
                                >
                                  {formatNumber(r.currentMonthVolume)}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 12px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    color: r.volumeDiff > 0 ? '#059669' : r.volumeDiff < 0 ? '#dc2626' : 'inherit',
                                    borderRight: '1px solid var(--border-color, #f1f5f9)',
                                  }}
                                >
                                  {r.volumeDiff > 0 ? `+${formatNumber(r.volumeDiff)}` : formatNumber(r.volumeDiff)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {formatNumber(r.activeAccountsPrevMonth)}
                                </td>
                                <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                                  {formatNumber(r.activeAccountsCurrentMonth)}
                                </td>
                                <td
                                  style={{
                                    padding: '8px 12px',
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    fontWeight: 800,
                                    color: '#059669',
                                  }}
                                >
                                  {formatNumber(r.totalActiveAccounts)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {/* Totals Row */}
                      <tfoot>
                        <tr
                          style={{
                            backgroundColor: 'var(--bg-app, #f1f5f9)',
                            borderTop: '2px solid var(--border-color, #cbd5e1)',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                          }}
                        >
                          <td colSpan={3} style={{ padding: '12px', textAlign: 'center' }}>
                            TỔNG CỘNG
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              borderLeft: '1px solid var(--border-color, #cbd5e1)',
                            }}
                          >
                            {formatNumber(specialData.total.prevMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color: '#0284c7',
                            }}
                          >
                            {formatNumber(specialData.total.currentMonthVolume)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              color:
                                specialData.total.volumeDiff > 0
                                  ? '#059669'
                                  : specialData.total.volumeDiff < 0
                                  ? '#dc2626'
                                  : 'inherit',
                              borderRight: '1px solid var(--border-color, #cbd5e1)',
                            }}
                          >
                            {specialData.total.volumeDiff > 0
                              ? `+${formatNumber(specialData.total.volumeDiff)}`
                              : formatNumber(specialData.total.volumeDiff)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(specialData.total.activeAccountsPrevMonth)}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatNumber(specialData.total.activeAccountsCurrentMonth)}
                          </td>
                          <td
                            style={{
                              padding: '12px',
                              textAlign: 'right',
                              fontFamily: 'monospace',
                              fontWeight: 800,
                              color: '#059669',
                            }}
                          >
                            {formatNumber(specialData.total.totalActiveAccounts)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

