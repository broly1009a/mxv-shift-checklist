'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  Download,
  Search,
  FileText,
  Calendar,
  Clock,
  X,
  Loader2,
  ArrowUpDown,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export type OmsTtttReconStatus =
  | 'MATCH'
  | 'DIFF_VOL'
  | 'DIFF_PNL'
  | 'DIFF_BOTH'
  | 'NOT_FOUND_IN_TTTT'
  | 'NOT_FOUND_IN_OMS';

export interface IOmsTtttPositionDetail {
  accountId: string;
  symbol: string;
  txDate?: string;
  closeDate?: string;
  closeSide: string; // 'BUY' | 'SELL'
  closeQtty: number;
  costPrice?: number;
  closePrice?: number;
  vrplAmt: number;
  vrplAmt_Vnd?: number;
  orderId?: string;
  closeOrderId?: string;
  execId?: string;
  closeExecId?: string;
  currency?: string;
  source: 'OMS' | 'TTTT_FILE';
}

export interface IOmsTtttReconRow {
  accountNumber: string;
  accountId: string;
  symbol: string;

  omsBuyQty: number;
  ttttBuyQty: number;
  diffBuyQty: number;
  isMatchBuy: boolean;

  omsSellQty: number;
  ttttSellQty: number;
  diffSellQty: number;
  isMatchSell: boolean;

  omsRealizedPnl: number;
  ttttRealizedPnl: number;
  diffRealizedPnl: number;
  isMatchPnl: boolean;

  omsRealizedPnlVnd: number;
  ttttRealizedPnlVnd: number;
  diffRealizedPnlVnd: number;

  status: OmsTtttReconStatus;
  statusNote: string;

  omsDetails: IOmsTtttPositionDetail[];
  ttttDetails: IOmsTtttPositionDetail[];
}

export interface IOmsTtttReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  ttttFilePath?: string;
  summary: {
    totalPairs: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffVol: number;
    totalDiffPnl: number;
    totalDiffBoth: number;
    totalNotFoundInTttt: number;
    totalNotFoundInOms: number;
    totalOmsBuyVol: number;
    totalOmsSellVol: number;
    totalTtttBuyVol: number;
    totalTtttSellVol: number;
    totalOmsRealizedPnl: number;
    totalTtttRealizedPnl: number;
    totalDiffRealizedPnl: number;
    totalOmsRealizedPnlVnd: number;
    totalTtttRealizedPnlVnd: number;
    totalDiffRealizedPnlVnd: number;
  };
  rows: IOmsTtttReconRow[];
  logs?: string[];
}

export interface OmsTtttSubSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function OmsTtttSubSection({
  token,
  selectedDate,
  onSelectDate,
}: OmsTtttSubSectionProps) {
  // ── 1. Fetching & Running States
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [reconResult, setReconResult] = useState<IOmsTtttReconResult | null>(null);

  // ── 2. Filters & Search States
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DIFF_ANY' | 'DIFF_VOL' | 'DIFF_PNL' | 'DIFF_BOTH' | 'MATCH' | 'NOT_FOUND'
  >('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('diffPnlVnd');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // ── 3. Detail Modal State
  const [selectedRowForModal, setSelectedRowForModal] = useState<IOmsTtttReconRow | null>(null);

  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('en-US');
  };

  const fmtDec = (n: number | undefined | null, dec = 2) => {
    if (n === undefined || n === null) return '0.00';
    return Number(n).toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
    });
  };

  // ── Fetch dữ liệu đối chiếu TTTT gần nhất
  const fetchLatestTtttSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.tradingOps.getOmsTtttSummary(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
      } else {
        setReconResult(null);
      }
    } catch (err: any) {
      console.warn('Không tải được kết quả đối chiếu TTTT gần nhất:', err);
      setReconResult(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchLatestTtttSummary();
  }, [fetchLatestTtttSummary]);

  // ── Chạy đối chiếu TTTT mới
  const handleRunRecon = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang gọi API OMS & Quét tệp TTTT để đối chiếu lãi lỗ...');
    try {
      const res = await api.tradingOps.checkOmsTttt(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
        const { totalMatched, totalDiff, totalPairs } = res.data.summary || {};
        if (totalDiff === 0) {
          toast.success(`Đối chiếu hoàn tất! Toàn bộ ${totalMatched}/${totalPairs} cặp vị thế tất toán KHỚP 100%.`, {
            id: toastId,
            duration: 4000,
          });
        } else {
          toast.error(
            `Đối chiếu hoàn tất: Phát hiện ${totalDiff} cặp có chênh lệch khối lượng hoặc lãi lỗ!`,
            { id: toastId, duration: 6000 },
          );
        }
      } else {
        toast.error('Đối chiếu hoàn tất nhưng không có dữ liệu trả về.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Chạy đối chiếu TTTT thất bại: ${err.message || 'Lỗi không xác định'}`, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setTriggering(false);
    }
  };

  // ── Lọc và Sắp xếp danh sách
  const filteredRows = useMemo(() => {
    if (!reconResult || !reconResult.rows) return [];

    let list = [...reconResult.rows];

    // Filter theo Status Tab
    if (filterStatus === 'DIFF_ANY') {
      list = list.filter((r) => r.status !== 'MATCH');
    } else if (filterStatus === 'DIFF_VOL') {
      list = list.filter((r) => r.status === 'DIFF_VOL' || r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'DIFF_PNL') {
      list = list.filter((r) => r.status === 'DIFF_PNL' || r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'DIFF_BOTH') {
      list = list.filter((r) => r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'MATCH') {
      list = list.filter((r) => r.status === 'MATCH');
    } else if (filterStatus === 'NOT_FOUND') {
      list = list.filter((r) => r.status === 'NOT_FOUND_IN_TTTT' || r.status === 'NOT_FOUND_IN_OMS');
    }

    // Filter theo Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.accountNumber.toLowerCase().includes(q) ||
          r.accountId.toLowerCase().includes(q) ||
          r.symbol.toLowerCase().includes(q),
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortField === 'accountNumber') {
        valA = a.accountNumber;
        valB = b.accountNumber;
      } else if (sortField === 'symbol') {
        valA = a.symbol;
        valB = b.symbol;
      } else if (sortField === 'diffVol') {
        valA = Math.abs(a.diffBuyQty) + Math.abs(a.diffSellQty);
        valB = Math.abs(b.diffBuyQty) + Math.abs(b.diffSellQty);
      } else if (sortField === 'omsPnl' || sortField === 'omsPnlVnd') {
        valA = a.omsRealizedPnlVnd;
        valB = b.omsRealizedPnlVnd;
      } else if (sortField === 'ttttPnl' || sortField === 'ttttPnlVnd') {
        valA = a.ttttRealizedPnlVnd;
        valB = b.ttttRealizedPnlVnd;
      } else if (sortField === 'diffPnl' || sortField === 'diffPnlVnd') {
        valA = Math.abs(a.diffRealizedPnlVnd);
        valB = Math.abs(b.diffRealizedPnlVnd);
      } else {
        // Mặc định: Độ lệch PnL VND + Độ lệch Khối lượng
        valA = Math.abs(a.diffRealizedPnlVnd) + (Math.abs(a.diffBuyQty) + Math.abs(a.diffSellQty)) * 1000000;
        valB = Math.abs(b.diffRealizedPnlVnd) + (Math.abs(b.diffBuyQty) + Math.abs(b.diffSellQty)) * 1000000;
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [reconResult, filterStatus, searchQuery, sortField, sortAsc]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ── Xuất File CSV
  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) {
      toast.error('Không có dữ liệu để xuất file!');
      return;
    }

    const headers = [
      'STT',
      'Mã TKGD',
      'Mã Hợp Đồng',
      'OMS Mua Đóng',
      'TTTT Mua Đóng',
      'Chênh Lệch Mua',
      'OMS Bán Đóng',
      'TTTT Bán Đóng',
      'Chênh Lệch Bán',
      'OMS Lãi Lỗ (VND)',
      'TTTT Lãi Lỗ (VND)',
      'Chênh Lệch Lãi Lỗ (VND)',
      'OMS Lãi Lỗ (USD)',
      'TTTT Lãi Lỗ (USD)',
      'Trạng Thái',
      'Ghi Chú',
    ];

    const csvRows = [headers.join(',')];

    filteredRows.forEach((r, idx) => {
      const row = [
        idx + 1,
        `"${r.accountNumber}"`,
        `"${r.symbol}"`,
        r.omsBuyQty,
        r.ttttBuyQty,
        r.diffBuyQty,
        r.omsSellQty,
        r.ttttSellQty,
        r.diffSellQty,
        r.omsRealizedPnlVnd,
        r.ttttRealizedPnlVnd,
        r.diffRealizedPnlVnd,
        r.omsRealizedPnl,
        r.ttttRealizedPnl,
        `"${r.status}"`,
        `"${r.statusNote.replace(/"/g, '""')}"`,
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `DOI_CHIEU_TTTT_OMS_${selectedDate || 'TODAY'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file báo cáo đối chiếu TTTT thành công!');
  };

  const summary = reconResult?.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* ── ACTION TOOLBAR BAR ── */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderRadius: '12px',
        }}
      >
        {/* Cụm trái: Chọn ngày & Tên tác vụ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="#f59e0b" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Phiên làm việc:
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => onSelectDate && onSelectDate(e.target.value)}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              fontSize: '0.78rem',
              color: '#f59e0b',
            }}
          >
            <Clock size={14} />
            <span>
              Nguồn dữ liệu: <strong>API OMS_PNL_DETAIL</strong> ⟷ <strong>File TTTT CCP</strong>
            </span>
          </div>

          {reconResult?.ttttFilePath && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
              title={reconResult.ttttFilePath}
            >
              <FileSpreadsheet size={13} color="#10b981" />
              <span>Tệp TTTT: {reconResult.ttttFilePath.split(/[\\/]/).pop()}</span>
            </div>
          )}
        </div>

        {/* Cụm phải: Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={handleRunRecon}
            disabled={triggering}
            className="btn btn-primary"
            style={{
              backgroundColor: '#f59e0b',
              color: '#ffffff',
              fontSize: '0.86rem',
              fontWeight: 800,
              padding: '9px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
              cursor: triggering ? 'not-allowed' : 'pointer',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {triggering ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang Đối Chiếu TTTT...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Chạy Đối Chiếu TTTT</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchLatestTtttSummary}
            disabled={loading || triggering}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
            title="Tải lại kết quả gần nhất"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span>Làm Mới</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!filteredRows || filteredRows.length === 0}
            className="btn btn-secondary"
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              cursor: !filteredRows || filteredRows.length === 0 ? 'not-allowed' : 'pointer',
            }}
            title="Xuất danh sách đối chiếu ra file CSV"
          >
            <Download size={15} />
            <span>Xuất File ({filteredRows.length})</span>
          </button>
        </div>
      </div>

      {/* ── 4 KPI SUMMARY CARDS ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Tổng số cặp TK - HĐ */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '12px',
            borderLeft: '4px solid #f59e0b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tổng Cặp Tất Toán
            </span>
            <Layers size={18} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {summary?.totalPairs ?? 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Giao dịch tất toán theo tài khoản & hợp đồng
          </span>
        </div>

        {/* Card 2: Khớp hoàn toàn */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '12px',
            borderLeft: '4px solid #10b981',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase' }}>
              Khớp Hoàn Toàn
            </span>
            <CheckCircle2 size={18} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
            {summary?.totalMatched ?? 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Trùng khớp cả khối lượng đóng và lãi lỗ thực tế
          </span>
        </div>

        {/* Card 3: Có chênh lệch */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '12px',
            borderLeft: `4px solid ${(summary?.totalDiff || 0) > 0 ? '#ef4444' : 'var(--border-color)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: (summary?.totalDiff || 0) > 0 ? '#ef4444' : 'var(--text-secondary)',
                textTransform: 'uppercase',
              }}
            >
              Phát Hiện Lệch
            </span>
            <AlertTriangle
              size={18}
              color={(summary?.totalDiff || 0) > 0 ? '#ef4444' : 'var(--text-muted)'}
            />
          </div>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 900,
              color: (summary?.totalDiff || 0) > 0 ? '#ef4444' : 'var(--text-primary)',
            }}
          >
            {summary?.totalDiff ?? 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Lệch KL: <strong>{summary?.totalDiffVol ?? 0}</strong> • Lệch PnL: <strong>{summary?.totalDiffPnl ?? 0}</strong> • Lệch Cả Hai: <strong>{summary?.totalDiffBoth ?? 0}</strong>
          </span>
        </div>

        {/* Card 4: Tổng Lãi Lỗ Thực Tế (VND) */}
        <div
          className="glass-panel"
          style={{
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            borderRadius: '12px',
            borderLeft: '4px solid #0284c7',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase' }}>
              Tổng Lãi Lỗ Thực Tế (VND)
            </span>
            <TrendingUp size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <div>OMS: <strong style={{ color: (summary?.totalOmsRealizedPnlVnd || 0) >= 0 ? '#10b981' : '#ef4444' }}>{fmt(summary?.totalOmsRealizedPnlVnd)} đ</strong></div>
            <div>TTTT: <strong style={{ color: (summary?.totalTtttRealizedPnlVnd || 0) >= 0 ? '#10b981' : '#ef4444' }}>{fmt(summary?.totalTtttRealizedPnlVnd)} đ</strong></div>
            <div style={{ fontSize: '0.76rem', color: Math.abs(summary?.totalDiffRealizedPnlVnd || 0) <= 1 ? '#10b981' : '#ef4444' }}>
              Chênh lệch: <strong>{summary?.totalDiffRealizedPnlVnd !== undefined ? (summary.totalDiffRealizedPnlVnd > 0 ? `+${fmt(summary.totalDiffRealizedPnlVnd)} đ` : `${fmt(summary.totalDiffRealizedPnlVnd)} đ`) : '0 đ'}</strong>
            </div>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Tổng hợp Realized PnL 2 nguồn quy đổi VND
          </span>
        </div>
      </div>

      {/* ── FILTER TABS & SEARCH BAR ── */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          borderRadius: '10px',
        }}
      >
        {/* Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setFilterStatus('ALL')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'ALL' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'ALL' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: filterStatus === 'ALL' ? '#f59e0b' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Tất cả ({reconResult?.rows?.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_ANY')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_ANY' ? '1px solid #ef4444' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_ANY' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_ANY' ? '#ef4444' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Có Chênh Lệch ({summary?.totalDiff ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_VOL')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_VOL' ? '1px solid #f97316' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_VOL' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_VOL' ? '#f97316' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Lệch Khối Lượng ({summary?.totalDiffVol ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_PNL')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_PNL' ? '1px solid #ec4899' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_PNL' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_PNL' ? '#ec4899' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Lệch PnL ({summary?.totalDiffPnl ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_BOTH')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_BOTH' ? '1px solid #a855f7' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_BOTH' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_BOTH' ? '#a855f7' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Lệch Cả Hai ({summary?.totalDiffBoth ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('MATCH')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'MATCH' ? '1px solid #10b981' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'MATCH' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
              color: filterStatus === 'MATCH' ? '#10b981' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Khớp Hoàn Toàn ({summary?.totalMatched ?? 0})
          </button>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search
            size={16}
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
            placeholder="Tìm theo Mã TK hoặc Hợp Đồng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
            }}
          />
        </div>
      </div>

      {/* ── DATA COMPARISON TABLE ── */}
      <div
        className="glass-panel"
        style={{
          borderRadius: '12px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.82rem',
              textAlign: 'left',
            }}
          >
            <thead>
              {/* Header Row 1: Nhóm Cột */}
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.74rem',
                  textTransform: 'uppercase',
                }}
              >
                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '45px' }}>
                  STT
                </th>
                <th
                  rowSpan={2}
                  style={{ padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => handleSort('accountNumber')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Mã TKGD</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  rowSpan={2}
                  style={{ padding: '10px 12px', cursor: 'pointer' }}
                  onClick={() => handleSort('symbol')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Hợp Đồng</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>

                {/* Nhóm Khối Lượng */}
                <th
                  colSpan={4}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderLeft: '1px solid var(--border-color)',
                    borderRight: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(2, 132, 199, 0.06)',
                    color: '#0284c7',
                    fontWeight: 800,
                  }}
                >
                  Khối Lượng Đóng (Tất Toán)
                </th>

                {/* Nhóm Lãi Lỗ VND */}
                <th
                  colSpan={3}
                  style={{
                    padding: '8px 12px',
                    textAlign: 'center',
                    borderRight: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.06)',
                    color: '#f59e0b',
                    fontWeight: 800,
                  }}
                >
                  Lãi Lỗ Thực Tế (VND)
                </th>

                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '135px' }}>
                  Trạng Thái
                </th>
                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '90px' }}>
                  Thao Tác
                </th>
              </tr>

              {/* Header Row 2: Chi tiết cột con */}
              <tr
                style={{
                  backgroundColor: 'var(--bg-input)',
                  borderBottom: '2px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.72rem',
                }}
              >
                {/* Khối lượng Mua */}
                <th style={{ padding: '8px 10px', textAlign: 'right', borderLeft: '1px solid var(--border-color)' }}>
                  OMS Mua
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>
                  TTTT Mua
                </th>
                {/* Khối lượng Bán */}
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>
                  OMS Bán
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'right', borderRight: '1px solid var(--border-color)' }}>
                  TTTT Bán
                </th>

                {/* Lãi Lỗ VND */}
                <th
                  style={{ padding: '8px 10px', textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => handleSort('omsPnlVnd')}
                >
                  OMS PnL (VND)
                </th>
                <th
                  style={{ padding: '8px 10px', textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => handleSort('ttttPnlVnd')}
                >
                  TTTT PnL (VND)
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort('diffPnlVnd')}
                >
                  Chênh Lệch (VND)
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Loader2 size={28} className="animate-spin" color="#f59e0b" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Đang nạp dữ liệu đối chiếu TTTT...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <CheckCircle2 size={32} color="#10b981" />
                      <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {reconResult ? 'Không tìm thấy bản ghi nào phù hợp bộ lọc!' : 'Chưa có dữ liệu đối chiếu TTTT cho phiên này.'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Nhấn nút <strong>"Chạy Đối Chiếu TTTT"</strong> ở thanh trên để quét trực tiếp từ OMS & TTTT CCP.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => {
                  const isMatch = row.status === 'MATCH';
                  return (
                    <tr
                      key={`${row.accountNumber}_${row.symbol}_${idx}`}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: !isMatch ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                        transition: 'background-color 0.15s',
                      }}
                    >
                      {/* STT */}
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {idx + 1}
                      </td>

                      {/* Mã TKGD */}
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {row.accountNumber}
                      </td>

                      {/* Hợp Đồng */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#f59e0b' }}>
                        {row.symbol}
                      </td>

                      {/* Mua Đóng (OMS / TTTT) */}
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          borderLeft: '1px solid var(--border-color)',
                        }}
                      >
                        {row.omsBuyQty}
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: row.isMatchBuy ? 'var(--text-primary)' : '#ef4444',
                          fontWeight: row.isMatchBuy ? 500 : 700,
                        }}
                      >
                        {row.ttttBuyQty}
                      </td>

                      {/* Bán Đóng (OMS / TTTT) */}
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.omsSellQty}
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          borderRight: '1px solid var(--border-color)',
                          color: row.isMatchSell ? 'var(--text-primary)' : '#ef4444',
                          fontWeight: row.isMatchSell ? 500 : 700,
                        }}
                      >
                        {row.ttttSellQty}
                      </td>

                      {/* Lãi Lỗ Thực Tế VND (OMS / TTTT / Chênh Lệch) */}
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: row.omsRealizedPnlVnd >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}
                      >
                        {fmt(row.omsRealizedPnlVnd)} đ
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: row.ttttRealizedPnlVnd >= 0 ? '#10b981' : '#ef4444',
                          fontWeight: 600,
                        }}
                      >
                        {fmt(row.ttttRealizedPnlVnd)} đ
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          borderRight: '1px solid var(--border-color)',
                          color: row.isMatchPnl ? '#10b981' : '#ef4444',
                        }}
                      >
                        {row.diffRealizedPnlVnd > 0 ? `+${fmt(row.diffRealizedPnlVnd)} đ` : `${fmt(row.diffRealizedPnlVnd)} đ`}
                      </td>

                      {/* Trạng Thái */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        {row.status === 'MATCH' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <CheckCircle2 size={13} />
                            <span>Khớp</span>
                          </span>
                        )}
                        {row.status === 'DIFF_VOL' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(249, 115, 22, 0.12)',
                              color: '#f97316',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Lệch KL</span>
                          </span>
                        )}
                        {row.status === 'DIFF_PNL' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(236, 72, 153, 0.12)',
                              color: '#ec4899',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Lệch PnL</span>
                          </span>
                        )}
                        {row.status === 'DIFF_BOTH' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(239, 68, 68, 0.12)',
                              color: '#ef4444',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Lệch Cả Hai</span>
                          </span>
                        )}
                        {row.status === 'NOT_FOUND_IN_TTTT' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(139, 92, 246, 0.12)',
                              color: '#8b5cf6',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Thiếu TTTT</span>
                          </span>
                        )}
                        {row.status === 'NOT_FOUND_IN_OMS' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(100, 116, 139, 0.12)',
                              color: 'var(--text-muted)',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Thiếu OMS</span>
                          </span>
                        )}
                      </td>

                      {/* Thao Tác */}
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedRowForModal(row)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                          title="Xem chi tiết các lệnh tất toán của cặp này"
                        >
                          <FileText size={13} color="#f59e0b" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: CHI TIẾT CÁC LỆNH TẤT TOÁN CỦA CẶP TK - HỢP ĐỒNG ── */}
      {selectedRowForModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setSelectedRowForModal(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '1020px',
              maxHeight: '85vh',
              borderRadius: '14px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-card)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={18} color="#f59e0b" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Chi Tiết Giao Dịch Tất Toán & Lãi Lỗ (TTTT)
                  </h4>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Tài khoản: <strong>{selectedRowForModal.accountNumber}</strong> • Hợp đồng:{' '}
                    <strong>{selectedRowForModal.symbol}</strong> • Lãi lỗ: OMS{' '}
                    <strong style={{ color: selectedRowForModal.omsRealizedPnl >= 0 ? '#10b981' : '#ef4444' }}>
                      ${fmtDec(selectedRowForModal.omsRealizedPnl)}
                    </strong>{' '}
                    / TTTT{' '}
                    <strong style={{ color: selectedRowForModal.ttttRealizedPnl >= 0 ? '#10b981' : '#ef4444' }}>
                      ${fmtDec(selectedRowForModal.ttttRealizedPnl)}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedRowForModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '6px',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: 2 Phân Hệ (OMS vs TTTT File) */}
            <div
              style={{
                padding: '16px 20px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              {/* Phân hệ 1: OMS API Records */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Layers size={16} color="#0284c7" />
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#0284c7' }}>
                    1. Bản Ghi Tất Toán Từ API Monitor OMS ({selectedRowForModal.omsDetails.length})
                  </span>
                </div>

                {selectedRowForModal.omsDetails.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Không có bản ghi tất toán nào từ phía OMS.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Chiều Lệnh</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Vốn</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Lãi Lỗ Thực Tế (USD)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Lãi Lỗ (VND)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>SHL Mở / Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Ngày Giờ Mở/Đóng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRowForModal.omsDetails.map((det, dIdx) => (
                        <tr key={dIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: det.closeSide === 'BUY' ? '#0284c7' : '#f59e0b' }}>
                            {det.closeSide === 'BUY' ? 'MUA ĐÓNG' : 'BÁN ĐÓNG'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {det.closeQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtDec(det.costPrice)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtDec(det.closePrice)}</td>
                          <td
                            style={{
                              padding: '6px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: (det.vrplAmt || 0) >= 0 ? '#10b981' : '#ef4444',
                            }}
                          >
                            ${fmtDec(det.vrplAmt)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            {fmt(det.vrplAmt_Vnd)}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                            {det.orderId || '—'} / {det.closeOrderId || '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {det.txDate || '—'} ➔ {det.closeDate || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Phân hệ 2: TTTT File Records */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileSpreadsheet size={16} color="#10b981" />
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>
                    2. Bản Ghi Tất Toán Từ Tệp TTTT CCP ({selectedRowForModal.ttttDetails.length})
                  </span>
                </div>

                {selectedRowForModal.ttttDetails.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Không có bản ghi nào từ tệp TTTT CCP.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Chiều Lệnh</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Vốn</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Lãi Lỗ Thực Tế (USD)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Lãi Lỗ (VND)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>SHL Mở / Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Ngày Mở / Đóng</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRowForModal.ttttDetails.map((det, dIdx) => (
                        <tr key={dIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: det.closeSide === 'BUY' ? '#0284c7' : '#f59e0b' }}>
                            {det.closeSide === 'BUY' ? 'MUA ĐÓNG' : 'BÁN ĐÓNG'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600 }}>
                            {det.closeQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtDec(det.costPrice)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmtDec(det.closePrice)}</td>
                          <td
                            style={{
                              padding: '6px 10px',
                              textAlign: 'right',
                              fontWeight: 700,
                              color: (det.vrplAmt || 0) >= 0 ? '#10b981' : '#ef4444',
                            }}
                          >
                            ${fmtDec(det.vrplAmt)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                            {fmt(det.vrplAmt_Vnd)}
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>
                            {det.orderId || '—'} / {det.closeOrderId || '—'}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {det.txDate || '—'} ➔ {det.closeDate || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                padding: '12px 20px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-input)',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedRowForModal(null)}
                className="btn btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  padding: '6px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
