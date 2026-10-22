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
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export type OmsTtmReconStatus =
  | 'MATCH'
  | 'DIFF_BUY'
  | 'DIFF_SELL'
  | 'DIFF_BOTH'
  | 'NOT_FOUND_IN_TTM'
  | 'NOT_FOUND_IN_OMS';

export interface IOmsTtmPositionDetail {
  accountId: string;
  symbol: string;
  txDate?: string;
  orderId?: string;
  execId?: string;
  longQtty: number;
  shortQtty: number;
  closeQtty?: number;
  matchPrice?: number;
  currency?: string;
  source: 'OMS' | 'TTM_FILE';
}

export interface IOmsTtmReconRow {
  accountNumber: string;
  accountId: string;
  symbol: string;

  omsBuyQty: number;
  ttmBuyQty: number;
  diffBuyQty: number;
  isMatchBuy: boolean;

  omsSellQty: number;
  ttmSellQty: number;
  diffSellQty: number;
  isMatchSell: boolean;

  status: OmsTtmReconStatus;
  statusNote: string;

  omsDetails: IOmsTtmPositionDetail[];
  ttmDetails: IOmsTtmPositionDetail[];
}

export interface IOmsTtmReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  ttmFilePath?: string;
  summary: {
    totalPairs: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffBuy: number;
    totalDiffSell: number;
    totalDiffBoth: number;
    totalNotFoundInTtm: number;
    totalNotFoundInOms: number;
    totalOmsBuyVol: number;
    totalOmsSellVol: number;
    totalTtmBuyVol: number;
    totalTtmSellVol: number;
  };
  rows: IOmsTtmReconRow[];
  logs?: string[];
}

export interface OmsTtmSubSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function OmsTtmSubSection({
  token,
  selectedDate,
  onSelectDate,
}: OmsTtmSubSectionProps) {
  // ── 1. Fetching & Running States
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [reconResult, setReconResult] = useState<IOmsTtmReconResult | null>(null);

  // ── 2. Filters & Search States (Mặc định: DIFF_ANY - Discrepancy-First)
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DIFF_ANY' | 'DIFF_BUY' | 'DIFF_SELL' | 'DIFF_BOTH' | 'MATCH' | 'NOT_FOUND'
  >('DIFF_ANY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('diff');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // ── 3. Pagination States (Khắc phục giật lag DOM)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Reset trang về 1 khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, sortField, sortAsc]);

  // ── 4. Detail Modal State
  const [selectedRowForModal, setSelectedRowForModal] = useState<IOmsTtmReconRow | null>(null);

  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('en-US');
  };

  // ── Fetch dữ liệu đối chiếu TTM gần nhất
  const fetchLatestTtmSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.tradingOps.getOmsTtmSummary(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
      } else {
        setReconResult(null);
      }
    } catch (err: any) {
      console.warn('Không tải được kết quả đối chiếu TTM gần nhất:', err);
      setReconResult(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchLatestTtmSummary();
  }, [fetchLatestTtmSummary]);

  // ── Chạy đối chiếu TTM mới
  const handleRunRecon = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang gọi API OMS & Quét tệp TTM để đối chiếu...');
    try {
      const res = await api.tradingOps.checkOmsTtm(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
        const { totalMatched, totalDiff, totalPairs } = res.data.summary || {};
        if (totalDiff === 0) {
          toast.success(`Đối chiếu hoàn tất! Toàn bộ ${totalMatched}/${totalPairs} cặp vị thế KHỚP 100%.`, {
            id: toastId,
            duration: 4000,
          });
        } else {
          toast.error(
            `Đối chiếu hoàn tất: Phát hiện ${totalDiff} cặp có chênh lệch vị thế mua/bán!`,
            { id: toastId, duration: 6000 },
          );
        }
      } else {
        toast.error('Đối chiếu hoàn tất nhưng không có dữ liệu trả về.', { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Chạy đối chiếu TTM thất bại: ${err.message || 'Lỗi không xác định'}`, {
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
    } else if (filterStatus === 'DIFF_BUY') {
      list = list.filter((r) => r.status === 'DIFF_BUY' || r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'DIFF_SELL') {
      list = list.filter((r) => r.status === 'DIFF_SELL' || r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'DIFF_BOTH') {
      list = list.filter((r) => r.status === 'DIFF_BOTH');
    } else if (filterStatus === 'MATCH') {
      list = list.filter((r) => r.status === 'MATCH');
    } else if (filterStatus === 'NOT_FOUND') {
      list = list.filter((r) => r.status === 'NOT_FOUND_IN_TTM' || r.status === 'NOT_FOUND_IN_OMS');
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
      } else if (sortField === 'omsBuy') {
        valA = a.omsBuyQty;
        valB = b.omsBuyQty;
      } else if (sortField === 'ttmBuy') {
        valA = a.ttmBuyQty;
        valB = b.ttmBuyQty;
      } else if (sortField === 'diffBuy') {
        valA = Math.abs(a.diffBuyQty);
        valB = Math.abs(b.diffBuyQty);
      } else if (sortField === 'omsSell') {
        valA = a.omsSellQty;
        valB = b.omsSellQty;
      } else if (sortField === 'ttmSell') {
        valA = a.ttmSellQty;
        valB = b.ttmSellQty;
      } else if (sortField === 'diffSell') {
        valA = Math.abs(a.diffSellQty);
        valB = Math.abs(b.diffSellQty);
      } else {
        // Mặc định: Tổng độ lệch tuyệt đối
        valA = Math.abs(a.diffBuyQty) + Math.abs(a.diffSellQty);
        valB = Math.abs(b.diffBuyQty) + Math.abs(b.diffSellQty);
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? valA - valB : valB - valA;
    });

    return list;
  }, [reconResult, filterStatus, searchQuery, sortField, sortAsc]);

  // ── Phân trang (Pagination)
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

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
      'OMS Mua',
      'TTM Mua',
      'Chênh Lệch Mua',
      'Khớp Mua ?',
      'OMS Bán',
      'TTM Bán',
      'Chênh Lệch Bán',
      'Khớp Bán ?',
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
        r.ttmBuyQty,
        r.diffBuyQty,
        r.isMatchBuy ? 'KHỚP' : 'LỆCH',
        r.omsSellQty,
        r.ttmSellQty,
        r.diffSellQty,
        r.isMatchSell ? 'KHỚP' : 'LỆCH',
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
    link.setAttribute('download', `DOI_CHIEU_TTM_OMS_${selectedDate || 'TODAY'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Đã xuất file báo cáo đối chiếu TTM thành công!');
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
            <Calendar size={18} color="#8b5cf6" />
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
              backgroundColor: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              fontSize: '0.78rem',
              color: '#8b5cf6',
            }}
          >
            <Layers size={14} />
            <span>
              Nguồn dữ liệu: <strong>API OMS_OPEN_POSITION</strong> ⟷ <strong>File TTM CCP</strong>
            </span>
          </div>

          {reconResult?.ttmFilePath && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
              }}
              title={reconResult.ttmFilePath}
            >
              <FileSpreadsheet size={13} color="#10b981" />
              <span>Tệp TTM: {reconResult.ttmFilePath.split(/[\\/]/).pop()}</span>
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
              backgroundColor: '#8b5cf6',
              color: '#ffffff',
              fontSize: '0.86rem',
              fontWeight: 800,
              padding: '9px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)',
              cursor: triggering ? 'not-allowed' : 'pointer',
              border: 'none',
              transition: 'all 0.2s',
            }}
          >
            {triggering ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang Đối Chiếu TTM...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Chạy Đối Chiếu TTM</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchLatestTtmSummary}
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
            borderLeft: '4px solid #8b5cf6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Tổng Cặp TK - HĐ
            </span>
            <Layers size={18} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
            {summary?.totalPairs ?? 0}
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Vị thế mở được gom nhóm theo tài khoản & hợp đồng
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
            Cặp trùng khớp cả khối lượng mua và bán
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
            Lệch Mua: <strong>{summary?.totalDiffBuy ?? 0}</strong> • Lệch Bán: <strong>{summary?.totalDiffSell ?? 0}</strong> • Cả Hai: <strong>{summary?.totalDiffBoth ?? 0}</strong>
          </span>
        </div>

        {/* Card 4: Tổng khối lượng */}
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
              Tổng Khối Lượng
            </span>
            <Layers size={18} color="#0284c7" />
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
            <div>OMS: Mua <strong style={{ color: '#0284c7' }}>{fmt(summary?.totalOmsBuyVol)}</strong> | Bán <strong style={{ color: '#f59e0b' }}>{fmt(summary?.totalOmsSellVol)}</strong></div>
            <div>TTM: Mua <strong style={{ color: '#0284c7' }}>{fmt(summary?.totalTtmBuyVol)}</strong> | Bán <strong style={{ color: '#f59e0b' }}>{fmt(summary?.totalTtmSellVol)}</strong></div>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            Tổng hợp quy mô vị thế 2 nguồn
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
              border: filterStatus === 'ALL' ? '1px solid #8b5cf6' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'ALL' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
              color: filterStatus === 'ALL' ? '#8b5cf6' : 'var(--text-secondary)',
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
            onClick={() => setFilterStatus('DIFF_BUY')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_BUY' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_BUY' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_BUY' ? '#f59e0b' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Lệch Mua ({summary?.totalDiffBuy ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_SELL')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_SELL' ? '1px solid #f97316' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_SELL' ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_SELL' ? '#f97316' : 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            Lệch Bán ({summary?.totalDiffSell ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setFilterStatus('DIFF_BOTH')}
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: '6px',
              border: filterStatus === 'DIFF_BOTH' ? '1px solid #ec4899' : '1px solid var(--border-color)',
              backgroundColor: filterStatus === 'DIFF_BOTH' ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
              color: filterStatus === 'DIFF_BOTH' ? '#ec4899' : 'var(--text-secondary)',
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
                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '50px' }}>
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

                {/* Nhóm MUA */}
                <th
                  colSpan={3}
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
                  Vị Thế Mua (Long)
                </th>

                {/* Nhóm BÁN */}
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
                  Vị Thế Bán (Short)
                </th>

                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '150px' }}>
                  Trạng Thái
                </th>
                <th rowSpan={2} style={{ padding: '10px 12px', textAlign: 'center', width: '100px' }}>
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
                {/* Mua */}
                <th
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderLeft: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort('omsBuy')}
                >
                  OMS
                </th>
                <th
                  style={{ padding: '8px 10px', textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => handleSort('ttmBuy')}
                >
                  TTM
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort('diffBuy')}
                >
                  Lệch Mua
                </th>

                {/* Bán */}
                <th
                  style={{ padding: '8px 10px', textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => handleSort('omsSell')}
                >
                  OMS
                </th>
                <th
                  style={{ padding: '8px 10px', textAlign: 'right', cursor: 'pointer' }}
                  onClick={() => handleSort('ttmSell')}
                >
                  TTM
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    textAlign: 'right',
                    borderRight: '1px solid var(--border-color)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleSort('diffSell')}
                >
                  Lệch Bán
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ padding: '40px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                      <Loader2 size={28} className="animate-spin" color="#8b5cf6" />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Đang nạp dữ liệu đối chiếu TTM...
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
                        {reconResult ? 'Không tìm thấy bản ghi nào phù hợp bộ lọc!' : 'Chưa có dữ liệu đối chiếu TTM cho phiên này.'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Nhấn nút <strong>"Chạy Đối Chiếu TTM"</strong> ở thanh trên để quét trực tiếp từ OMS & TTM CCP.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const isMatch = row.status === 'MATCH';
                  const stt = (currentPage - 1) * pageSize + idx + 1;
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
                        {stt}
                      </td>

                      {/* Mã TKGD */}
                      <td style={{ padding: '10px 12px', fontWeight: 800, color: 'var(--text-primary)' }}>
                        {row.accountNumber}
                      </td>

                      {/* Hợp Đồng */}
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: '#8b5cf6' }}>
                        {row.symbol}
                      </td>

                      {/* Vị Thế Mua (OMS, TTM, Lệch) */}
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
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.ttmBuyQty}
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          borderRight: '1px solid var(--border-color)',
                          color: row.isMatchBuy ? '#10b981' : '#ef4444',
                        }}
                      >
                        {row.diffBuyQty > 0 ? `+${row.diffBuyQty}` : row.diffBuyQty}
                      </td>

                      {/* Vị Thế Bán (OMS, TTM, Lệch) */}
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.omsSellQty}
                      </td>
                      <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.ttmSellQty}
                      </td>
                      <td
                        style={{
                          padding: '10px 10px',
                          textAlign: 'right',
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          borderRight: '1px solid var(--border-color)',
                          color: row.isMatchSell ? '#10b981' : '#ef4444',
                        }}
                      >
                        {row.diffSellQty > 0 ? `+${row.diffSellQty}` : row.diffSellQty}
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
                        {row.status === 'DIFF_BUY' && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(245, 158, 11, 0.12)',
                              color: '#f59e0b',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Lệch Mua</span>
                          </span>
                        )}
                        {row.status === 'DIFF_SELL' && (
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
                            <span>Lệch Bán</span>
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
                        {row.status === 'NOT_FOUND_IN_TTM' && (
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
                            <span>Thiếu TTM</span>
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
                          title="Xem chi tiết các lệnh mở của cặp này"
                        >
                          <FileText size={13} color="#8b5cf6" />
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

        {/* TABLE FOOTER & PAGINATION */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 16px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-input)',
            fontSize: '0.78rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span>
              Hiển thị <strong>{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> / Tổng số <strong>{filteredRows.length.toLocaleString()}</strong> bản ghi
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Số dòng/trang:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="btn btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage <= 1 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <span style={{ padding: '0 8px', fontWeight: 700 }}>
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="btn btn-secondary"
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage >= totalPages ? 0.4 : 1,
                }}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MODAL: CHI TIẾT CÁC LỆNH VỊ THẾ MỞ CỦA CẶP TK - HỢP ĐỒNG ── */}
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
              maxWidth: '960px',
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
                <Layers size={18} color="#8b5cf6" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Chi Tiết Bản Ghi Vị Thế Mở (TTM)
                  </h4>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Tài khoản: <strong>{selectedRowForModal.accountNumber}</strong> • Hợp đồng:{' '}
                    <strong>{selectedRowForModal.symbol}</strong> • Mua: OMS{' '}
                    <strong>{selectedRowForModal.omsBuyQty}</strong> / TTM{' '}
                    <strong>{selectedRowForModal.ttmBuyQty}</strong> • Bán: OMS{' '}
                    <strong>{selectedRowForModal.omsSellQty}</strong> / TTM{' '}
                    <strong>{selectedRowForModal.ttmSellQty}</strong>
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

            {/* Modal Body: 2 Phân Hệ (OMS vs TTM File) */}
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
                    1. Bản Ghi Từ API Monitor OMS ({selectedRowForModal.omsDetails.length})
                  </span>
                </div>

                {selectedRowForModal.omsDetails.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Không có bản ghi nào từ phía OMS.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Order ID</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Exec ID</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Mua</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Bán</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Khớp</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Ngày Giờ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRowForModal.omsDetails.map((det, dIdx) => (
                        <tr key={dIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px' }}>{det.orderId || '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{det.execId || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>
                            {det.longQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>
                            {det.shortQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{det.closeQtty || 0}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(det.matchPrice)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {det.txDate || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Phân hệ 2: TTM File Records */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FileSpreadsheet size={16} color="#10b981" />
                  <span style={{ fontSize: '0.86rem', fontWeight: 800, color: '#10b981' }}>
                    2. Bản Ghi Từ Tệp TTM CCP ({selectedRowForModal.ttmDetails.length})
                  </span>
                </div>

                {selectedRowForModal.ttmDetails.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Không có bản ghi nào từ tệp TTM CCP.
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Mã GD (Order)</th>
                        <th style={{ padding: '6px 10px', textAlign: 'left' }}>Exec ID</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Mua</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Bán</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>KL Đóng</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right' }}>Giá Khớp</th>
                        <th style={{ padding: '6px 10px', textAlign: 'center' }}>Ngày Thực Hiện</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRowForModal.ttmDetails.map((det, dIdx) => (
                        <tr key={dIdx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 10px' }}>{det.orderId || '—'}</td>
                          <td style={{ padding: '6px 10px' }}>{det.execId || '—'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#0284c7' }}>
                            {det.longQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 600, color: '#f59e0b' }}>
                            {det.shortQtty}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{det.closeQtty || 0}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>{fmt(det.matchPrice)}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {det.txDate || '—'}
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
