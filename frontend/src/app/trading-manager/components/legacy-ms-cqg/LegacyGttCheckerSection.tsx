'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  Download,
  Loader2,
  FileText,
  Clock,
  RefreshCw,
  X,
  Search,
  Copy,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

export interface LegacyGttCheckerSectionProps {
  token: string | null;
  selectedDate: string;
}

export interface GttDataRow {
  symbol: string;
  gttMs: number | null;
  gttCqg: number | null;
  diff: number | null;
  status: 'MATCH' | 'DIFF' | 'MS_ONLY' | 'CQG_ONLY' | 'NO_PRICE';
  tickSize?: number | null;
  isMinorDiff?: boolean;
}

export interface GttReport {
  runAt: string;
  completedAt?: string;
  durationMs?: number;
  totalContracts: number;
  matched: number;
  diffCount: number;
  msOnlyCount: number;
  cqgOnlyCount: number;
  rows: GttDataRow[];
  logs?: string[];
}

export default function LegacyGttCheckerSection({
  token,
  selectedDate,
}: LegacyGttCheckerSectionProps) {
  const [mounted, setMounted] = useState<boolean>(false);
  const [gttLoading, setGttLoading] = useState<boolean>(false);
  const [gttExporting, setGttExporting] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [gttReport, setGttReport] = useState<GttReport | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'ALL' | 'DIFF' | 'MATCH' | 'MISSING'>('ALL');

  // Modal Nhật ký kiểm tra (Log Viewer)
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [logSearch, setLogSearch] = useState<string>('');
  const [copiedLog, setCopiedLog] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Tải báo cáo GTT gần nhất từ server (chống mất dữ liệu khi chuyển tab)
  const fetchGttReport = async (isManual = false) => {
    if (!token) return;
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/gtt-report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.report) {
        setGttReport(data.report);
      }
      if (Array.isArray(data.currentLogs)) {
        setLiveLogs(data.currentLogs);
      }

      if (data.isRunning) {
        setGttLoading(true);
      } else {
        setGttLoading(false);
      }

      if (isManual) {
        toast.success('Đã làm mới dữ liệu Giá thanh toán!');
      }
    } catch {
      // Bỏ qua lỗi ngầm khi unmount hoặc mạng gián đoạn
    } finally {
      if (isManual) setRefreshing(false);
    }
  };

  // Tự động load dữ liệu ngay khi component mount (hoặc khi quay lại tab)
  useEffect(() => {
    fetchGttReport(false);
  }, [token]);

  // Polling tự động mỗi 2.5s khi hệ thống đang chạy ngầm
  useEffect(() => {
    if (!gttLoading || !token) return;
    const interval = setInterval(() => {
      fetchGttReport(false);
    }, 2500);

    return () => clearInterval(interval);
  }, [gttLoading, token]);

  // 2. Kích hoạt Check GTT chạy ngầm (async: true)
  const handleCheckGtt = async () => {
    if (!token || gttLoading) return;
    setGttLoading(true);
    const toastId = toast.loading('Đang khởi động bot đối soát Giá thanh toán (GTT)...');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/run-gtt-check`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ downloadMarketCsv: true, async: true }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      toast.success(
        data.message || 'Bot đang kiểm tra GTT ngầm. Bạn có thể chuyển tab tự do mà không bị mất dữ liệu.',
        { id: toastId, duration: 6000 },
      );

      fetchGttReport(false);
    } catch (err: any) {
      toast.error(`Kích hoạt kiểm tra GTT thất bại: ${err.message}`, { id: toastId });
      setGttLoading(false);
    }
  };

  // 3. Tạo file nhập GTT (Export Correction Excel)
  const handleExportGttCorrection = async () => {
    if (!token || gttExporting) return;
    setGttExporting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/bot-engine/gtt-report/export-correction?type=settlement`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bao_Cao_GTT_${selectedDate || 'today'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Đã xuất và tải xuống báo cáo đối soát GTT đầy đủ!');
    } catch (err: any) {
      toast.error(`Tải file GTT thất bại: ${err.message}`);
    } finally {
      setGttExporting(false);
    }
  };

  // 4. Lọc dữ liệu hiển thị theo tab filter
  const allRows: GttDataRow[] = gttReport?.rows || [];
  const filteredRows = useMemo(() => {
    if (filterMode === 'DIFF') {
      return allRows.filter((r) => r.status === 'DIFF');
    }
    if (filterMode === 'MATCH') {
      return allRows.filter((r) => r.status === 'MATCH');
    }
    if (filterMode === 'MISSING') {
      return allRows.filter((r) => r.status === 'MS_ONLY' || r.status === 'CQG_ONLY');
    }
    return allRows;
  }, [allRows, filterMode]);

  // Format thời gian hiển thị
  const formattedRunTime = useMemo(() => {
    if (!gttReport?.runAt) return null;
    try {
      const d = new Date(gttReport.runAt);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return gttReport.runAt;
    }
  }, [gttReport?.runAt]);

  const formattedDuration = useMemo(() => {
    if (!gttReport?.durationMs) return null;
    const sec = Math.round(gttReport.durationMs / 1000);
    if (sec >= 60) {
      return `${Math.floor(sec / 60)}p ${sec % 60}s`;
    }
    return `${sec}s`;
  }, [gttReport?.durationMs]);

  // Tập hợp danh sách logs để hiển thị modal
  const displayLogs: string[] = useMemo(() => {
    if (gttLoading && liveLogs.length > 0) {
      return liveLogs;
    }
    return gttReport?.logs && gttReport.logs.length > 0
      ? gttReport.logs
      : liveLogs;
  }, [gttLoading, liveLogs, gttReport?.logs]);

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

  return (
    <div className="glass-panel" style={{ padding: '16px 20px' }}>
      {/* HEADER: Tiêu đề & Các nút chức năng */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Giá thanh toán (GTT M-System vs CQG)
          </span>

          <button
            type="button"
            onClick={handleCheckGtt}
            disabled={gttLoading}
            className="btn btn-primary"
            style={{
              fontSize: '0.78rem',
              padding: '5px 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {gttLoading ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span>{gttLoading ? 'Đang check GTT...' : 'Check GTT'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportGttCorrection}
            disabled={gttExporting || allRows.length === 0}
            className="btn btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '5px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Tải file Excel điều chỉnh giá cho các mã bị lệch"
          >
            {gttExporting ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Download size={13} />
            )}
            <span>Tạo file nhập GTT</span>
          </button>

          <button
            type="button"
            onClick={() => setShowLogModal(true)}
            className="btn btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '5px 12px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Xem nhật ký thực thi chi tiết"
          >
            <FileText size={13} />
            <span>Nhật ký</span>
            {displayLogs.length > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  padding: '1px 5px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  fontWeight: 700,
                }}
              >
                {displayLogs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchGttReport(true)}
            disabled={refreshing}
            className="btn btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '5px 8px',
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title="Làm mới trạng thái từ server"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* THÔNG TIN THỜI GIAN & TRẠNG THÁI */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {gttLoading ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.76rem',
                color: '#3b82f6',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}
            >
              <Loader2 size={12} className="animate-spin" />
              <span>Tiến trình đang chạy ngầm trên server...</span>
            </div>
          ) : formattedRunTime ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.74rem',
                color: 'var(--text-muted)',
                fontFamily: 'monospace',
              }}
            >
              <Clock size={12} />
              <span>
                Kiểm tra lúc: <strong style={{ color: 'var(--text-primary)' }}>{formattedRunTime}</strong>
                {formattedDuration && ` (${formattedDuration})`}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* DÒNG THỐNG KÊ KẾT QUẢ & BỘ LỌC */}
      {gttReport && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
            flexWrap: 'wrap',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '6px',
            backgroundColor: 'var(--bg-input)',
            fontSize: '0.74rem',
          }}
        >
          {/* BADGES THỐNG KÊ */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Tổng số: <strong style={{ color: 'var(--text-primary)' }}>{gttReport.totalContracts}</strong> HĐ
            </span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>
              Khớp: {gttReport.matched}
            </span>
            <span
              style={{
                color: gttReport.diffCount > 0 ? '#ef4444' : 'var(--text-muted)',
                fontWeight: gttReport.diffCount > 0 ? 800 : 400,
                backgroundColor: gttReport.diffCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
                padding: gttReport.diffCount > 0 ? '1px 6px' : '0',
                borderRadius: '4px',
              }}
            >
              Lệch: {gttReport.diffCount}
            </span>
            {(gttReport.msOnlyCount > 0 || gttReport.cqgOnlyCount > 0) && (
              <span style={{ color: '#f59e0b' }}>
                Thiếu: {gttReport.msOnlyCount + gttReport.cqgOnlyCount} (MS: {gttReport.msOnlyCount}, CQG: {gttReport.cqgOnlyCount})
              </span>
            )}
          </div>

          {/* CHIPS BỘ LỌC XEM */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterMode === 'ALL' ? 'var(--primary-color, #2563eb)' : 'transparent',
                color: filterMode === 'ALL' ? '#fff' : 'var(--text-muted)',
                fontWeight: filterMode === 'ALL' ? 700 : 400,
              }}
            >
              Tất cả ({allRows.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('DIFF')}
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterMode === 'DIFF' ? '#ef4444' : 'transparent',
                color: filterMode === 'DIFF' ? '#fff' : gttReport.diffCount > 0 ? '#ef4444' : 'var(--text-muted)',
                fontWeight: filterMode === 'DIFF' || gttReport.diffCount > 0 ? 700 : 400,
              }}
            >
              Lệch ({gttReport.diffCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('MATCH')}
              style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '4px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: filterMode === 'MATCH' ? '#10b981' : 'transparent',
                color: filterMode === 'MATCH' ? '#fff' : 'var(--text-muted)',
                fontWeight: filterMode === 'MATCH' ? 700 : 400,
              }}
            >
              Khớp ({gttReport.matched})
            </button>
          </div>
        </div>
      )}

      {/* BẢNG DỮ LIỆU GTT: Mã HĐ | GTT MS | GTT CQG */}
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          overflow: 'hidden',
          maxHeight: '380px',
          overflowY: 'auto',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr
              style={{
                backgroundColor: 'var(--bg-input)',
                borderBottom: '1px solid var(--border-color)',
                fontWeight: 800,
              }}
            >
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '25%' }}>
                Mã HĐ
              </th>
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '25%', textAlign: 'right' }}>
                GTT MS
              </th>
              <th style={{ padding: '8px 12px', borderRight: '1px solid var(--border-color)', width: '25%', textAlign: 'right' }}>
                GTT CQG
              </th>
              <th style={{ padding: '8px 12px', width: '25%', textAlign: 'right' }}>
                Chênh lệch
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    padding: '28px 12px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                  }}
                >
                  {gttLoading ? (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#3b82f6' }}>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Đang nạp và đối chiếu giá thanh toán... Bạn có thể chuyển tab mà không bị mất dữ liệu.</span>
                    </div>
                  ) : allRows.length === 0 ? (
                    'Chưa có dữ liệu đối chiếu giá thanh toán. Bấm “Check GTT” để kiểm tra.'
                  ) : (
                    'Không có mã nào phù hợp với bộ lọc hiện tại.'
                  )}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => {
                const isDiff = row.status === 'DIFF';
                const isMatch = row.status === 'MATCH';
                return (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isDiff
                        ? 'rgba(239, 68, 68, 0.08)'
                        : isMatch
                        ? 'transparent'
                        : 'rgba(245, 158, 11, 0.04)',
                      fontFamily: 'monospace',
                    }}
                  >
                    <td
                      style={{
                        padding: '6px 12px',
                        borderRight: '1px solid var(--border-color)',
                        fontWeight: 700,
                        color: isDiff ? '#ef4444' : 'var(--text-primary)',
                      }}
                    >
                      {row.symbol}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        borderRight: '1px solid var(--border-color)',
                        textAlign: 'right',
                      }}
                    >
                      {row.gttMs !== null ? row.gttMs.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        borderRight: '1px solid var(--border-color)',
                        textAlign: 'right',
                        fontWeight: isDiff ? 800 : 400,
                        color: isDiff ? '#ef4444' : 'inherit',
                      }}
                    >
                      {row.gttCqg !== null ? row.gttCqg.toLocaleString('vi-VN') : '—'}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        fontWeight: isDiff ? 800 : 400,
                        color: isDiff ? '#ef4444' : isMatch ? '#10b981' : 'var(--text-muted)',
                      }}
                    >
                      {isDiff && row.diff !== null
                        ? `Lệch ${row.diff.toLocaleString('vi-VN')}`
                        : isMatch
                        ? 'Khớp'
                        : row.status === 'MS_ONLY'
                        ? 'Chỉ MS'
                        : row.status === 'CQG_ONLY'
                        ? 'Chỉ CQG'
                        : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL NHẬT KÝ KIỂM TRA (LOG VIEWER MODAL) */}
      {showLogModal &&
        mounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setShowLogModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              backgroundColor: 'rgba(9, 14, 26, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              boxSizing: 'border-box',
            }}
          >
            <div
              className="glass-panel"
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '820px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-surface, #1e293b)',
              }}
            >
              {/* MODAL HEADER */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={18} style={{ color: '#3b82f6' }} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800 }}>
                      Nhật ký kiểm tra Giá thanh toán (GTT)
                    </h3>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formattedRunTime
                        ? `Lần chạy: ${formattedRunTime} ${formattedDuration ? `(${formattedDuration})` : ''}`
                        : 'Nhật ký tiến trình thực thi'}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '6px',
                    borderRadius: '6px',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* MODAL TOOLBAR: TÌM KIẾM & COPY */}
              <div
                style={{
                  padding: '10px 20px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                }}
              >
                <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                  <Search
                    size={14}
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
                    placeholder="Lọc nhật ký..."
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 10px 5px 30px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      fontSize: '0.76rem',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {filteredLogs.length} dòng log
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLogs}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '0.74rem',
                      padding: '4px 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    {copiedLog ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    <span>{copiedLog ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                </div>
              </div>

              {/* MODAL BODY: TERMINAL LOGS */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '16px 20px',
                  fontFamily: 'monospace',
                  fontSize: '0.76rem',
                  lineHeight: 1.6,
                  backgroundColor: '#090e1a',
                  color: '#e2e8f0',
                }}
              >
                {filteredLogs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#64748b', fontStyle: 'italic' }}>
                    {logSearch ? 'Không tìm thấy dòng log nào khớp với từ khóa.' : 'Chưa có nhật ký nào được ghi lại.'}
                  </div>
                ) : (
                  filteredLogs.map((line, idx) => {
                    const isError = line.includes('[LỖI') || line.includes('ERROR') || line.includes('thất bại');
                    const isSuccess = line.includes('THÀNH CÔNG') || line.includes('HOÀN TẤT') || line.includes('khớp');
                    const isWarn = line.includes('WARN') || line.includes('CẢNH BÁO') || line.includes('chậm');

                    return (
                      <div
                        key={idx}
                        style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                          color: isError
                            ? '#ef4444'
                            : isSuccess
                            ? '#10b981'
                            : isWarn
                            ? '#f59e0b'
                            : '#cbd5e1',
                          padding: '1px 0',
                        }}
                      >
                        {line}
                      </div>
                    );
                  })
                )}
              </div>

              {/* MODAL FOOTER */}
              <div
                style={{
                  padding: '10px 20px',
                  borderTop: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-input, #0f172a)',
                  fontSize: '0.74rem',
                  color: 'var(--text-muted)',
                }}
              >
                <span>
                  {gttReport
                    ? `Kết quả: ${gttReport.matched} khớp, ${gttReport.diffCount} lệch`
                    : 'Bấm “Check GTT” để kiểm tra giá thanh toán'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 14px' }}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
