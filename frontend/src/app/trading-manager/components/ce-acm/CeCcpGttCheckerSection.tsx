'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  FileSpreadsheet,
  Layers,
  Search,
  Filter,
  Terminal,
  Copy,
  Check,
  Clock,
  ArrowUpDown,
  ExternalLink,
  Loader2,
  FileText,
  Sliders,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

export interface CeCcpGttCheckerSectionProps {
  token: string | null;
  selectedDate: string;
}

export interface CeCcpGttDataRow {
  symbol: string;
  commodity: string;
  priceCe: number | null;
  priceCcp: number | null;
  diff: number | null;
  tickSize: number;
  status: 'MATCH' | 'MINOR_DIFF' | 'DIFF' | 'CE_ONLY' | 'CCP_ONLY' | 'NO_PRICE';
  dateCe: string | null;
  dateCcp: string | null;
  currency: string;
}

export interface CeCcpGttReport {
  runAt: string;
  completedAt?: string;
  durationMs?: number;
  targetDate?: string;
  totalContracts: number;
  matched: number;
  minorDiffCount: number;
  diffCount: number;
  ceOnlyCount: number;
  ccpOnlyCount: number;
  noPriceCount: number;
  filterOpen: boolean;
  rows: CeCcpGttDataRow[];
  logs?: string[];
  filePaths?: {
    ceGtt: string | null;
    ccpGtt: string | null;
    ceHh: string | null;
    ccpHh: string | null;
    ttm: string | null;
  };
}

export default function CeCcpGttCheckerSection({
  token,
  selectedDate,
}: CeCcpGttCheckerSectionProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [exportingReport, setExportingReport] = useState<boolean>(false);
  const [exportingCorrection, setExportingCorrection] = useState<boolean>(false);
  const [report, setReport] = useState<CeCcpGttReport | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<
    'ALL' | 'DIFF' | 'MINOR_DIFF' | 'MATCH' | 'CE_ONLY' | 'CCP_ONLY'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterOpenPositions, setFilterOpenPositions] = useState<boolean>(false);

  // Modal Logs
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logSearch, setLogSearch] = useState<string>('');
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Tải báo cáo đối soát từ server
  const fetchReport = useCallback(
    async (isManual = false) => {
      if (!token) return;
      if (isManual) setRefreshing(true);
      try {
        const url = selectedDate?.trim()
          ? `${API_BASE_URL}/api/v1/bot-engine/ce-ccp-gtt-report?date=${selectedDate.trim().slice(0, 10)}`
          : `${API_BASE_URL}/api/v1/bot-engine/ce-ccp-gtt-report`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return;
        const data = await res.json();

        setReport(data.report || null);
        if (Array.isArray(data.currentLogs)) {
          setLiveLogs(data.currentLogs);
        }

        if (data.isRunning) {
          setLoading(true);
        } else {
          setLoading(false);
        }

        if (isManual) {
          if (data.report) {
            toast.success('Đã cập nhật kết quả đối soát GTT CE-CCP!');
          } else {
            toast(data.message || 'Chưa có dữ liệu đối soát GTT phiên này.');
          }
        }
      } catch {
        // Ignore silent fetch network error
      } finally {
        if (isManual) setRefreshing(false);
      }
    },
    [token, selectedDate]
  );

  // Tự động load dữ liệu khi mount hoặc khi đổi ngày phiên
  useEffect(() => {
    fetchReport(false);
  }, [fetchReport]);

  // Polling tự động khi tiến trình đang chạy ngầm
  useEffect(() => {
    if (!loading || !token) return;
    const interval = setInterval(() => {
      fetchReport(false);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading, token, fetchReport]);

  // 2. Kích hoạt Check GTT CE vs CCP
  const handleRunCheck = async () => {
    if (!token || loading) return;
    setLoading(true);
    const toastId = toast.loading(
      'Đang khởi chạy đối soát Giá thanh toán (GTT): CoreEX vs CoreCCP...'
    );

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/bot-engine/run-ce-ccp-gtt-check`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            targetDate: selectedDate,
            filterOpen: filterOpenPositions,
            async: true,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      toast.success(
        data.message ||
          'Robot đang chạy đối soát GTT CE-CCP ngầm. Bảng kết quả sẽ tự động cập nhật!',
        { id: toastId, duration: 5000 }
      );

      fetchReport(false);
    } catch (err: any) {
      toast.error(`Kích hoạt đối soát GTT thất bại: ${err.message}`, {
        id: toastId,
        duration: 6000,
      });
      setLoading(false);
    }
  };

  // 3. Xuất file Excel
  const handleExportExcel = async (type: 'report' | 'correction') => {
    if (!token) return;
    if (type === 'report') setExportingReport(true);
    else setExportingCorrection(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/bot-engine/ce-ccp-gtt-report/export?type=${type}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        type === 'correction'
          ? `Dieu_Chinh_GTT_CE_CCP_${selectedDate || 'today'}.xlsx`
          : `Bao_Cao_CheckGTT_CE_CCP_${selectedDate || 'today'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(
        type === 'correction'
          ? 'Đã tải file danh sách hợp đồng cần điều chỉnh giá!'
          : 'Đã tải báo cáo đối soát GTT CE-CCP đầy đủ!'
      );
    } catch (err: any) {
      toast.error(`Xuất file Excel thất bại: ${err.message}`);
    } finally {
      if (type === 'report') setExportingReport(false);
      else setExportingCorrection(false);
    }
  };

  // 4. Lọc dữ liệu hiển thị
  const allRows: CeCcpGttDataRow[] = report?.rows || [];

  const filteredRows = useMemo(() => {
    let result = allRows;

    // Filter theo Tab
    if (filterMode === 'DIFF') {
      result = result.filter((r) => r.status === 'DIFF');
    } else if (filterMode === 'MINOR_DIFF') {
      result = result.filter((r) => r.status === 'MINOR_DIFF');
    } else if (filterMode === 'MATCH') {
      result = result.filter((r) => r.status === 'MATCH');
    } else if (filterMode === 'CE_ONLY') {
      result = result.filter((r) => r.status === 'CE_ONLY');
    } else if (filterMode === 'CCP_ONLY') {
      result = result.filter((r) => r.status === 'CCP_ONLY');
    }

    // Filter theo ô tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter(
        (r) =>
          r.symbol.toUpperCase().includes(q) ||
          r.commodity.toUpperCase().includes(q)
      );
    }

    return result;
  }, [allRows, filterMode, searchQuery]);

  // Formatted date & duration
  const formattedRunTime = useMemo(() => {
    if (!report?.runAt) return null;
    try {
      return new Date(report.runAt).toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return report.runAt;
    }
  }, [report?.runAt]);

  const formattedDuration = useMemo(() => {
    if (!report?.durationMs) return null;
    const sec = Math.round(report.durationMs / 1000);
    if (sec >= 60) {
      return `${Math.floor(sec / 60)}p ${sec % 60}s`;
    }
    return `${sec}s`;
  }, [report?.durationMs]);

  // Logs hiển thị trong modal
  const displayLogs: string[] = useMemo(() => {
    if (loading && liveLogs.length > 0) return liveLogs;
    return report?.logs && report.logs.length > 0 ? report.logs : liveLogs;
  }, [loading, liveLogs, report?.logs]);

  const filteredLogs = useMemo(() => {
    if (!logSearch.trim()) return displayLogs;
    const q = logSearch.toLowerCase();
    return displayLogs.filter((l) => l.toLowerCase().includes(q));
  }, [displayLogs, logSearch]);

  const handleCopyLogs = () => {
    if (displayLogs.length === 0) return;
    navigator.clipboard.writeText(displayLogs.join('\n'));
    setCopiedLog(true);
    toast.success('Đã sao chép toàn bộ nhật ký!');
    setTimeout(() => setCopiedLog(false), 2000);
  };

  if (!mounted) return null;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* ===== HEADER TIÊU ĐỀ & ACTIONS ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#3b82f6',
            }}
          >
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                }}
              >
                Đối Chiếu Giá Thanh Toán (GTT): CoreEX (CE) vs CoreCCP (VNCLEAR)
              </h3>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                }}
              >
                PHÂN HỆ MỚI
              </span>
            </div>
            <p
              style={{
                margin: '3px 0 0',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              So khớp Giá thanh toán (GTT) theo bước giá tối thiểu (TickSize), hỗ trợ kiểm tra chéo hợp đồng mở (TTM).
              {formattedRunTime && (
                <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>
                  (Lần chạy gần nhất: {formattedRunTime} {formattedDuration ? `• ${formattedDuration}` : ''})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Nút thao tác nhanh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleRunCheck}
            disabled={loading}
            className="btn btn-primary"
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#3b82f6',
              borderColor: '#3b82f6',
            }}
          >
            {loading ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <span>{loading ? 'Đang Đối Soát...' : 'Đối Chiếu GTT (CE vs CCP)'}</span>
          </button>

          <button
            type="button"
            onClick={() => fetchReport(true)}
            disabled={refreshing || loading}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Làm mới kết quả đối soát"
          >
            <RefreshCw
              size={14}
              className={refreshing ? 'animate-spin' : ''}
            />
            <span>Làm Mới</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Xem nhật ký chạy chi tiết"
          >
            <Terminal size={14} />
            <span>Nhật Ký ({displayLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ===== THẺ KPI SUMMARY CARDS ===== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '12px',
        }}
      >
        {/* TỔNG SỐ HỢP ĐỒNG */}
        <div
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Tổng số Hợp đồng
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {report ? report.totalContracts : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {report?.filterOpen ? 'Đã lọc theo TTM' : 'Toàn bộ danh mục'}
          </div>
        </div>

        {/* KHỚP HOÀN TOÀN (MATCH) */}
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.06)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 700 }}>
            Khớp Hoàn Toàn (MATCH)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#10b981' }}>
            {report ? report.matched : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            {report && report.totalContracts > 0
              ? `${((report.matched / report.totalContracts) * 100).toFixed(1)}% danh mục`
              : 'Diff < 0.0001'}
          </div>
        </div>

        {/* LỆCH NHỎ <= 1 TICK */}
        <div
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.06)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#f59e0b', fontWeight: 700 }}>
            Lệch Nhỏ (&le; 1 Tick)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>
            {report ? report.minorDiffCount : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Biên độ làm tròn hợp lệ
          </div>
        </div>

        {/* LỆCH GIÁ BẤT THƯỜNG (DIFF) */}
        <div
          style={{
            backgroundColor:
              report && report.diffCount > 0
                ? 'rgba(239, 68, 68, 0.1)'
                : 'rgba(239, 68, 68, 0.04)',
            border: `1px solid ${
              report && report.diffCount > 0
                ? '#ef4444'
                : 'rgba(239, 68, 68, 0.25)'
            }`,
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#ef4444', fontWeight: 700 }}>
            Lệch Giá (DIFF)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ef4444' }}>
            {report ? report.diffCount : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#ef4444' }}>
            {report && report.diffCount > 0 ? 'Cần xuất file sửa giá!' : 'Không phát hiện lệch'}
          </div>
        </div>

        {/* CHỈ CÓ TRÊN COREEX */}
        <div
          style={{
            backgroundColor: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#3b82f6', fontWeight: 700 }}>
            Chỉ Trên CoreEX (CE)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#3b82f6' }}>
            {report ? report.ceOnlyCount : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            HĐ chỉ có trên CE
          </div>
        </div>

        {/* CHỈ CÓ TRÊN CORECCP */}
        <div
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.06)',
            border: '1px solid rgba(168, 85, 247, 0.25)',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ fontSize: '0.74rem', color: '#a855f7', fontWeight: 700 }}>
            Chỉ Trên CoreCCP
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a855f7' }}>
            {report ? report.ccpOnlyCount : '—'}
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            HĐ chỉ có trên CCP
          </div>
        </div>
      </div>

      {/* ===== THANH CÔNG CỤ: TÌM KIẾM, LỌC TAB, XUẤT EXCEL ===== */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '10px 14px',
          backgroundColor: 'var(--bg-input)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* Bộ lọc Tab */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'ALL', label: 'Tất Cả', count: allRows.length, color: 'var(--text-primary)' },
            {
              key: 'DIFF',
              label: 'Lệch Giá (DIFF)',
              count: report?.diffCount ?? 0,
              color: '#ef4444',
            },
            {
              key: 'MINOR_DIFF',
              label: 'Lệch Nhỏ (&le; 1 tick)',
              count: report?.minorDiffCount ?? 0,
              color: '#f59e0b',
            },
            {
              key: 'MATCH',
              label: 'Khớp Hoàn Toàn',
              count: report?.matched ?? 0,
              color: '#10b981',
            },
            {
              key: 'CE_ONLY',
              label: 'Chỉ CE',
              count: report?.ceOnlyCount ?? 0,
              color: '#3b82f6',
            },
            {
              key: 'CCP_ONLY',
              label: 'Chỉ CCP',
              count: report?.ccpOnlyCount ?? 0,
              color: '#a855f7',
            },
          ].map((tab) => {
            const active = filterMode === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterMode(tab.key as any)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: active ? '1px solid var(--border-color)' : '1px solid transparent',
                  backgroundColor: active ? 'var(--bg-card)' : 'transparent',
                  color: active ? tab.color : 'var(--text-secondary)',
                  fontSize: '0.78rem',
                  fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    padding: '1px 5px',
                    borderRadius: '8px',
                    backgroundColor: active
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.1)',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ô Tìm Kiếm, Checkbox TTM & Nút Xuất Excel */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Checkbox lọc TTM */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.76rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            title="Chỉ so khớp các mã hợp đồng hiện đang có vị thế mở trên CoreCCP"
          >
            <input
              type="checkbox"
              checked={filterOpenPositions}
              onChange={(e) => setFilterOpenPositions(e.target.checked)}
              style={{ accentColor: '#3b82f6', width: '13px', height: '13px' }}
            />
            <span>Lọc theo HĐ Mở (TTM)</span>
          </label>

          {/* Ô Tìm kiếm */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={13}
              color="var(--text-muted)"
              style={{ position: 'absolute', left: '10px' }}
            />
            <input
              type="text"
              placeholder="Tìm mã HĐ, hàng hóa..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                fontSize: '0.78rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                width: '180px',
                outline: 'none',
              }}
            />
          </div>

          {/* Nút Xuất Báo Cáo */}
          <button
            type="button"
            onClick={() => handleExportExcel('report')}
            disabled={exportingReport || !report || allRows.length === 0}
            className="btn btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {exportingReport ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            <span>Xuất Báo Cáo Excel</span>
          </button>

          {/* Nút Xuất Sửa Giá (Chỉ bật khi có DIFF hoặc MINOR_DIFF) */}
          <button
            type="button"
            onClick={() => handleExportExcel('correction')}
            disabled={
              exportingCorrection ||
              !report ||
              (report.diffCount === 0 && report.minorDiffCount === 0)
            }
            className="btn btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor:
                report && report.diffCount > 0
                  ? 'rgba(239, 68, 68, 0.15)'
                  : undefined,
              borderColor:
                report && report.diffCount > 0
                  ? 'rgba(239, 68, 68, 0.4)'
                  : undefined,
              color: report && report.diffCount > 0 ? '#ef4444' : undefined,
            }}
            title="Xuất file danh sách hợp đồng lệch giá để phục vụ điều chỉnh"
          >
            {exportingCorrection ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={13} />
            )}
            <span>Xuất File Điều Chỉnh GTT</span>
          </button>
        </div>
      </div>

      {/* ===== BẢNG CHI TIẾT ĐỐI SOÁT GTT ===== */}
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        <div style={{ overflowX: 'auto', maxHeight: '520px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.78rem',
              textAlign: 'left',
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                }}
              >
                <th style={{ padding: '10px 12px', width: '45px', color: 'var(--text-muted)' }}>
                  STT
                </th>
                <th style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>
                  Mã Hợp Đồng
                </th>
                <th style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                  Hàng Hóa
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    color: '#3b82f6',
                    fontWeight: 700,
                  }}
                >
                  Giá CoreEX (CE)
                </th>
                <th
                  style={{
                    padding: '10px 12px',
                    textAlign: 'right',
                    color: '#a855f7',
                    fontWeight: 700,
                  }}
                >
                  Giá CoreCCP
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>
                  Độ Lệch (|CE - CCP|)
                </th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                  Tick Size
                </th>
                <th style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--text-primary)' }}>
                  Trạng Thái
                </th>
                <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                  Tiền Tệ
                </th>
                <th style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>
                  Ngày Phiên CE / CCP
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {report
                      ? 'Không có hợp đồng nào phù hợp với điều kiện lọc hiện tại.'
                      : 'Chưa có dữ liệu đối soát GTT CE-CCP. Vui lòng bấm "Đối Chiếu GTT (CE vs CCP)" để bắt đầu.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  let badgeBg = 'rgba(16, 185, 129, 0.12)';
                  let badgeBorder = 'rgba(16, 185, 129, 0.3)';
                  let badgeColor = '#10b981';
                  let statusLabel = 'KHỚP (MATCH)';

                  if (row.status === 'DIFF') {
                    badgeBg = 'rgba(239, 68, 68, 0.15)';
                    badgeBorder = 'rgba(239, 68, 68, 0.4)';
                    badgeColor = '#ef4444';
                    statusLabel = 'LỆCH GIÁ (DIFF)';
                  } else if (row.status === 'MINOR_DIFF') {
                    badgeBg = 'rgba(245, 158, 11, 0.15)';
                    badgeBorder = 'rgba(245, 158, 11, 0.4)';
                    badgeColor = '#f59e0b';
                    statusLabel = 'LỆCH <= 1 TICK';
                  } else if (row.status === 'CE_ONLY') {
                    badgeBg = 'rgba(59, 130, 246, 0.12)';
                    badgeBorder = 'rgba(59, 130, 246, 0.3)';
                    badgeColor = '#3b82f6';
                    statusLabel = 'CHỈ CÓ TRÊN CE';
                  } else if (row.status === 'CCP_ONLY') {
                    badgeBg = 'rgba(168, 85, 247, 0.12)';
                    badgeBorder = 'rgba(168, 85, 247, 0.3)';
                    badgeColor = '#a855f7';
                    statusLabel = 'CHỈ CÓ TRÊN CCP';
                  } else if (row.status === 'NO_PRICE') {
                    badgeBg = 'rgba(148, 163, 184, 0.12)';
                    badgeBorder = 'rgba(148, 163, 184, 0.3)';
                    badgeColor = '#94a3b8';
                    statusLabel = 'KHÔNG CÓ GIÁ';
                  }

                  const isDiffRow = row.status === 'DIFF';

                  return (
                    <tr
                      key={row.symbol}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: isDiffRow
                          ? 'rgba(239, 68, 68, 0.05)'
                          : idx % 2 === 0
                          ? 'transparent'
                          : 'rgba(255, 255, 255, 0.02)',
                        transition: 'background-color 0.15s ease',
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: '8px 12px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                        {row.symbol}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {row.commodity}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: row.priceCe !== null ? '#3b82f6' : 'var(--text-muted)',
                        }}
                      >
                        {row.priceCe !== null ? row.priceCe : '—'}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: row.priceCcp !== null ? '#a855f7' : 'var(--text-muted)',
                        }}
                      >
                        {row.priceCcp !== null ? row.priceCcp : '—'}
                      </td>
                      <td
                        style={{
                          padding: '8px 12px',
                          textAlign: 'right',
                          fontFamily: 'monospace',
                          fontWeight: isDiffRow ? 800 : 500,
                          color: isDiffRow ? '#ef4444' : 'var(--text-primary)',
                        }}
                      >
                        {row.diff !== null ? row.diff : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {row.tickSize}
                      </td>
                      <td style={{ padding: '8px 14px', textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            backgroundColor: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            color: badgeColor,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {row.currency || 'USD'}
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {row.dateCe || row.dateCcp || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MODAL NHẬT KÝ CHI TIẾT (LIVE LOGS) ===== */}
      {showLogModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '850px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
              overflow: 'hidden',
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Terminal size={18} color="#3b82f6" />
                <h4
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                  }}
                >
                  Nhật Ký Robot Đối Soát GTT: CoreEX (CE) vs CoreCCP
                </h4>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyLogs}
                  className="btn btn-secondary"
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.76rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copiedLog ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  <span>{copiedLog ? 'Đã Sao Chép' : 'Sao Chép'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                >
                  Đóng
                </button>
              </div>
            </div>

            {/* Ô tìm kiếm Logs */}
            <div
              style={{
                padding: '8px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search
                  size={14}
                  color="var(--text-muted)"
                  style={{ position: 'absolute', left: '10px' }}
                />
                <input
                  type="text"
                  placeholder="Lọc dòng nhật ký..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 32px',
                    fontSize: '0.78rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Danh sách log */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                backgroundColor: '#090d16',
                fontFamily: 'monospace',
                fontSize: '0.76rem',
                color: '#e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {filteredLogs.length > 0 ? (
                filteredLogs.map((line, idx) => (
                  <div key={idx} style={{ wordBreak: 'break-all', lineHeight: '1.4' }}>
                    {line}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
                  Chưa có nhật ký nào được ghi nhận. Hãy bấm nút [Đối Chiếu GTT (CE vs CCP)] để theo dõi tiến trình.
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.76rem',
                color: 'var(--text-muted)',
              }}
            >
              <span>Tổng số {filteredLogs.length} dòng nhật ký</span>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '6px 14px' }}
              >
                Xác Nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
