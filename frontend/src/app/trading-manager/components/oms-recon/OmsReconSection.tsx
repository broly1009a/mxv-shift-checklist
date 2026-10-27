'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Play,
  Download,
  Search,
  FileText,
  Layers,
  Calendar,
  Info,
  Clock,
  X,
  Loader2,
  TrendingUp,
  AlertCircle,
  ArrowUpDown,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';
import OmsTtmSubSection from './OmsTtmSubSection';
import OmsTtttSubSection from './OmsTtttSubSection';

export interface IOmsPortfolioItem {
  symbol: string;
  uaCode?: string;
  longQtty: number;
  shortQtty: number;
  openPositionQtty?: number;
  pendingLongIM_Qtty?: number;
  pendingShortIM_Qtty?: number;
  pendingIM_Qtty?: number;
  rmo: number;
  rma: number;
  evrplAmt: number;
  vwap: number;
}

export interface IOmsMarginReconRow {
  accountNumber: string;
  accountId: string;
  memberCode: string;
  imCash: number;
  cashAvlWithdraw: number;
  totalNav: number;
  omsRma: number;
  qlReqSecured: number;
  diffTtm: number;
  isMatchTtm: boolean;
  omsRmo: number;
  omsTotalReq: number;
  qlEReqSecured: number;
  diffTotal: number;
  isMatchTotal: boolean;
  status:
    | 'MATCH'
    | 'DIFF_TTM'
    | 'DIFF_TOTAL'
    | 'DIFF_BOTH'
    | 'NOT_FOUND_IN_QLTTTKGD'
    | 'NOT_FOUND_IN_OMS';
  statusNote: string;
  portfolios: Record<string, IOmsPortfolioItem>;
}

export interface IOmsMarginReconResult {
  success: boolean;
  sessionDate: string;
  executedAt: string;
  durationMs: number;
  source: string;
  summary: {
    totalOmsAccounts: number;
    totalActiveAccounts?: number;
    totalZeroAccounts?: number;
    totalMatched: number;
    totalDiff: number;
    totalDiffTtm: number;
    totalDiffTotal: number;
    totalDiffBoth: number;
    totalNotFoundInQl: number;
    totalNotFoundInOms: number;
  };
  rows: IOmsMarginReconRow[];
  logs?: string[];
}

export interface OmsReconSectionProps {
  token: string | null;
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

export default function OmsReconSection({
  token,
  selectedDate,
  onSelectDate,
}: OmsReconSectionProps) {
  // ── 1. Top Sub-tabs State: 1. Check Ký Quỹ TKGD | 2. Check TTM | 3. Check TTTT
  const [activeSubTab, setActiveSubTab] = useState<'MARGIN_TKGD' | 'CHECK_TTM' | 'CHECK_TTTT'>('MARGIN_TKGD');

  // ── 2. Data & Fetching States
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [reconResult, setReconResult] = useState<IOmsMarginReconResult | null>(null);

  // ── 3. Filter & Search States (Mặc định: DIFF_ANY - Discrepancy-First)
  const [filterStatus, setFilterStatus] = useState<
    'ALL' | 'DIFF_ANY' | 'DIFF_TTM' | 'DIFF_TOTAL' | 'DIFF_BOTH' | 'MATCH' | 'NOT_FOUND_IN_QL'
  >('DIFF_ANY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string>('diffTotal');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // ── 4. Pagination States (Khắc phục triệt để treo lag DOM)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  // Reset trang về 1 khi đổi bộ lọc hoặc tìm kiếm
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery, sortField, sortAsc]);

  // ── 5. Portfolio Modal State
  const [selectedAccountForModal, setSelectedAccountForModal] = useState<IOmsMarginReconRow | null>(null);

  // Helper format tiền tệ VND
  const fmt = (n: number | undefined | null) => {
    if (n === undefined || n === null) return '0';
    return Number(n).toLocaleString('en-US');
  };


  // ── Fetch dữ liệu đã lưu gần nhất
  const fetchLatestSummary = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.tradingOps.getOmsMarginSummary(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
      } else {
        setReconResult(null);
      }
    } catch (err: any) {
      console.warn('Không tải được kết quả đối chiếu OMS gần nhất:', err);
      setReconResult(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchLatestSummary();
  }, [fetchLatestSummary]);

  // ── Chạy đối chiếu ký quỹ OMS mới
  const handleRunRecon = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang gọi API OMS & CoreCCP (QLTTTKGD) để đối chiếu...');
    try {
      const res = await api.tradingOps.checkOmsMargin(selectedDate, token);
      if (res && res.success && res.data) {
        setReconResult(res.data);
        const { totalMatched, totalDiff, totalOmsAccounts } = res.data.summary || {};
        if (totalDiff === 0) {
          toast.success(`Đối chiếu hoàn tất! Toàn bộ ${totalMatched?.toLocaleString('vi-VN')}/${totalOmsAccounts?.toLocaleString('vi-VN')} tài khoản KHỚP 100%.`, {
            id: toastId,
            duration: 5000,
          });
        } else {
          toast.error(`Đối chiếu hoàn tất! Phát hiện ${totalDiff?.toLocaleString('vi-VN')} tài khoản có chênh lệch ký quỹ.`, {
            id: toastId,
            duration: 6000,
          });
        }
      } else {
        throw new Error(res?.message || 'Không nhận được kết quả đối chiếu từ máy chủ');
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi chạy đối chiếu ký quỹ OMS', { id: toastId });
    } finally {
      setTriggering(false);
    }
  };

  // ── Filtered & Sorted Rows
  const filteredRows = useMemo(() => {
    if (!reconResult || !reconResult.rows) return [];
    let list = [...reconResult.rows];

    // Lọc theo search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter(
        (r) =>
          r.accountNumber.toUpperCase().includes(q) ||
          r.accountId.toUpperCase().includes(q) ||
          r.memberCode.toUpperCase().includes(q)
      );
    }

    // Lọc theo tab trạng thái
    if (filterStatus === 'DIFF_ANY') {
      list = list.filter((r) => !r.isMatchTtm || !r.isMatchTotal);
    } else if (filterStatus === 'DIFF_TTM') {
      list = list.filter((r) => !r.isMatchTtm && r.isMatchTotal);
    } else if (filterStatus === 'DIFF_TOTAL') {
      list = list.filter((r) => r.isMatchTtm && !r.isMatchTotal);
    } else if (filterStatus === 'DIFF_BOTH') {
      list = list.filter((r) => !r.isMatchTtm && !r.isMatchTotal);
    } else if (filterStatus === 'MATCH') {
      list = list.filter((r) => r.isMatchTtm && r.isMatchTotal);
    } else if (filterStatus === 'NOT_FOUND_IN_QL') {
      list = list.filter((r) => r.status === 'NOT_FOUND_IN_QLTTTKGD');
    }

    // Sắp xếp
    list.sort((a, b) => {
      let va: any = 0;
      let vb: any = 0;
      if (sortField === 'diffTotal') {
        va = Math.abs(a.diffTotal);
        vb = Math.abs(b.diffTotal);
      } else if (sortField === 'diffTtm') {
        va = Math.abs(a.diffTtm);
        vb = Math.abs(b.diffTtm);
      } else if (sortField === 'imCash') {
        va = a.imCash;
        vb = b.imCash;
      } else if (sortField === 'accountNumber') {
        va = a.accountNumber;
        vb = b.accountNumber;
      }
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  }, [reconResult, searchQuery, filterStatus, sortField, sortAsc]);

  // ── Phân trang (Pagination) - Triệt tiêu 100% lag giật trình duyệt
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // ── Xuất file Excel / CSV
  const handleExportCsv = () => {
    if (!filteredRows || filteredRows.length === 0) {
      toast.error('Không có dữ liệu để xuất file');
      return;
    }

    const headers = [
      'STT',
      'Mã TK (Account)',
      'Mã TVKD',
      'Tiền Ký Quỹ (IM Cash)',
      'KQ Yêu Cầu TTM (OMS RMA)',
      'KQ Yêu Cầu TTM (QLTTTKGD REQSECURED)',
      'Chênh Lệch TTM',
      'KQ Lệnh Chờ (OMS RMO)',
      'Tổng KQ Tạm Tính (OMS)',
      'Tổng KQ Tạm Tính (QLTTTKGD EREQSECURED)',
      'Chênh Lệch Tổng',
      'Trạng Thái',
      'Ghi Chú',
    ];

    const lines = filteredRows.map((r, idx) => [
      idx + 1,
      `"${r.accountNumber}"`,
      `"${r.memberCode}"`,
      r.imCash,
      r.omsRma,
      r.qlReqSecured,
      r.diffTtm,
      r.omsRmo,
      r.omsTotalReq,
      r.qlEReqSecured,
      r.diffTotal,
      `"${r.status}"`,
      `"${r.statusNote}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...lines.map((l) => l.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DoiChieu_KyQuy_OMS_${selectedDate || 'HomNay'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Đã xuất file đối chiếu thành công!');
  };

  const summary = reconResult?.summary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── SUB-TABS NAVIGATION: 1. Check Ký Quỹ TKGD | 2. Check TTM | 3. Check TTTT ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Subtab 1: Check Ký Quỹ TKGD */}
          <button
            type="button"
            onClick={() => setActiveSubTab('MARGIN_TKGD')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '0.86rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'MARGIN_TKGD' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeSubTab === 'MARGIN_TKGD' ? '#0284c7' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === 'MARGIN_TKGD' ? 'rgba(2, 132, 199, 0.12)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ShieldCheck size={16} color={activeSubTab === 'MARGIN_TKGD' ? '#0284c7' : 'var(--text-muted)'} />
            <span>Check Ký Quỹ TKGD</span>
            {summary && summary.totalDiff > 0 && (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                }}
              >
                {summary.totalDiff} lệch
              </span>
            )}
          </button>

          {/* Subtab 2: Check TTM */}
          <button
            type="button"
            onClick={() => setActiveSubTab('CHECK_TTM')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '0.86rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'CHECK_TTM' ? '2px solid #8b5cf6' : '2px solid transparent',
              color: activeSubTab === 'CHECK_TTM' ? '#8b5cf6' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === 'CHECK_TTM' ? 'rgba(139, 92, 246, 0.12)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Layers size={16} color={activeSubTab === 'CHECK_TTM' ? '#8b5cf6' : 'var(--text-muted)'} />
            <span>Check TTM</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(139, 92, 246, 0.15)',
                color: '#8b5cf6',
                border: '1px solid rgba(139, 92, 246, 0.3)',
              }}
            >
              Vị thế mở
            </span>
          </button>

          {/* Subtab 3: Check TTTT */}
          <button
            type="button"
            onClick={() => setActiveSubTab('CHECK_TTTT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              fontSize: '0.86rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeSubTab === 'CHECK_TTTT' ? '2px solid #f59e0b' : '2px solid transparent',
              color: activeSubTab === 'CHECK_TTTT' ? '#f59e0b' : 'var(--text-secondary)',
              backgroundColor: activeSubTab === 'CHECK_TTTT' ? 'rgba(245, 158, 11, 0.12)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Clock size={16} color={activeSubTab === 'CHECK_TTTT' ? '#f59e0b' : 'var(--text-muted)'} />
            <span>Check TTTT</span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '2px 6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              Lãi lỗ & Tất toán
            </span>
          </button>
        </div>

        {/* Thông tin metadata phiên đối chiếu */}
        {reconResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} />
              Lần chạy gần nhất: <strong>{new Date(reconResult.executedAt).toLocaleTimeString('vi-VN')}</strong>
            </span>
            <span>•</span>
            <span>
              Thời gian xử lý: <strong>{reconResult.durationMs}ms</strong>
            </span>
          </div>
        )}
      </div>

      {/* ── TAB 1 CONTENT: CHECK KÝ QUỸ TKGD ── */}
      {activeSubTab === 'MARGIN_TKGD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* ACTION TOOLBAR BAR */}
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
                <Calendar size={18} color="#0284c7" />
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
                  backgroundColor: 'rgba(2, 132, 199, 0.08)',
                  border: '1px solid rgba(2, 132, 199, 0.2)',
                  fontSize: '0.78rem',
                  color: '#0284c7',
                }}
              >
                <Info size={14} />
                <span>
                  Công thức: <strong>RMA == REQSECURED</strong> và{' '}
                  <strong>(RMA + RMO) == EREQSECURED</strong>
                </span>
              </div>
            </div>

            {/* Cụm phải: Nút thao tác Chạy, Làm mới, Xuất Excel */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleRunRecon}
                disabled={triggering}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  padding: '9px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  cursor: triggering ? 'not-allowed' : 'pointer',
                  border: 'none',
                  transition: 'all 0.2s',
                }}
              >
                {triggering ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Đang Đối Chiếu OMS...</span>
                  </>
                ) : (
                  <>
                    <Play size={16} fill="currentColor" />
                    <span>Chạy Đối Chiếu Ký Quỹ OMS</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={fetchLatestSummary}
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
                title="Xuất danh sách đối chiếu ra file CSV/Excel"
              >
                <Download size={15} />
                <span>Xuất File ({filteredRows.length})</span>
              </button>
            </div>
          </div>

          {/* 4 KPI SUMMARY CARDS */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Card 1: Tổng số tài khoản */}
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
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Tổng TK Quét Được
                </span>
                <Layers size={18} color="#0284c7" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {summary?.totalOmsAccounts?.toLocaleString('vi-VN') ?? 0}
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                {summary?.totalActiveAccounts !== undefined
                  ? `${summary.totalActiveAccounts.toLocaleString('vi-VN')} TK có phát sinh KQ/tiền (${(summary.totalZeroAccounts ?? 0).toLocaleString('vi-VN')} TK số dư 0)`
                  : 'Tài khoản lấy từ CoreCCP OMS_ACM'}
              </span>
            </div>

            {/* Card 2: Khớp hoàn toàn 100% */}
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
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Khớp Hoàn Toàn
                </span>
                <CheckCircle2 size={18} color="#10b981" />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#10b981' }}>
                {summary?.totalMatched?.toLocaleString('vi-VN') ?? 0}
              </div>
              <span style={{ fontSize: '0.74rem', color: '#10b981' }}>
                {summary && summary.totalOmsAccounts > 0
                  ? `${Math.round((summary.totalMatched / summary.totalOmsAccounts) * 100)}% tổng số tài khoản`
                  : 'Chưa có dữ liệu'}
              </span>
            </div>

            {/* Card 3: Lệch Ký Quỹ TTM */}
            <div
              className="glass-panel"
              style={{
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRadius: '12px',
                borderLeft: `4px solid ${summary && summary.totalDiffTtm > 0 ? '#f59e0b' : '#10b981'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Lệch Ký Quỹ TTM
                </span>
                <AlertTriangle size={18} color={summary && summary.totalDiffTtm > 0 ? '#f59e0b' : '#10b981'} />
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  color: summary && summary.totalDiffTtm > 0 ? '#f59e0b' : '#10b981',
                }}
              >
                {summary?.totalDiffTtm ?? 0} TK
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                OMS.rma != QLTTTKGD.REQSECURED
              </span>
            </div>

            {/* Card 4: Lệch Tổng KQ Tạm Tính */}
            <div
              className="glass-panel"
              style={{
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                borderRadius: '12px',
                borderLeft: `4px solid ${summary && summary.totalDiffTotal > 0 ? '#ef4444' : '#10b981'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Lệch Tổng KQ Tạm Tính
                </span>
                <AlertCircle size={18} color={summary && summary.totalDiffTotal > 0 ? '#ef4444' : '#10b981'} />
              </div>
              <div
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 900,
                  color: summary && summary.totalDiffTotal > 0 ? '#ef4444' : '#10b981',
                }}
              >
                {summary?.totalDiffTotal ?? 0} TK
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                OMS.(rma+rmo) != QLTTTKGD.EREQSECURED
              </span>
            </div>
          </div>

          {/* FILTER TABS & SEARCH BAR */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '12px',
            }}
          >
            {/* Filter buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {[
                { key: 'ALL', label: 'Tất Cả', count: summary?.totalOmsAccounts },
                { key: 'DIFF_ANY', label: 'Lệch (Bất Kỳ)', count: summary?.totalDiff, color: '#ef4444' },
                { key: 'DIFF_TTM', label: 'Lệch TTM', count: summary?.totalDiffTtm, color: '#f59e0b' },
                { key: 'DIFF_TOTAL', label: 'Lệch Tổng Tạm Tính', count: summary?.totalDiffTotal, color: '#dc2626' },
                { key: 'MATCH', label: 'Khớp', count: summary?.totalMatched, color: '#10b981' },
                { key: 'NOT_FOUND_IN_QL', label: 'Không Thấy Trên QL', count: summary?.totalNotFoundInQl, color: '#8b5cf6' },
              ].map(({ key, label, count, color }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterStatus(key as any)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: filterStatus === key ? `1px solid ${color || '#0284c7'}` : '1px solid var(--border-color)',
                    backgroundColor:
                      filterStatus === key
                        ? color
                          ? `${color}18`
                          : 'rgba(2, 132, 199, 0.12)'
                        : 'var(--bg-input)',
                    color: filterStatus === key ? (color || '#0284c7') : 'var(--text-secondary)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{label}</span>
                  {count !== undefined && (
                    <span
                      style={{
                        padding: '1px 6px',
                        borderRadius: '999px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        backgroundColor: filterStatus === key ? (color || '#0284c7') : 'var(--bg-card)',
                        color: filterStatus === key ? '#ffffff' : 'var(--text-muted)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '280px' }}>
              <Search
                size={15}
                color="var(--text-muted)"
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm theo Mã TK, Mã TVKD..."
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
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* DATA COMPARISON TABLE */}
          <div
            className="glass-panel"
            style={{
              borderRadius: '12px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ overflowX: 'auto', maxHeight: '620px' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.81rem',
                  textAlign: 'left',
                }}
              >
                {/* TABLE HEADERS WITH 2-TIER CLASSIFICATION */}
                <thead>
                  <tr
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      borderBottom: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.74rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                    }}
                  >
                    <th style={{ padding: '10px 12px', width: '50px' }}>STT</th>
                    <th style={{ padding: '10px 12px' }}>Mã TK</th>
                    <th style={{ padding: '10px 12px' }}>TVKD</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Tiền KQ (IM Cash)</th>

                    {/* Group 1: Ký Quỹ TTM */}
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(2, 132, 199, 0.05)',
                        borderLeft: '1px solid var(--border-color)',
                      }}
                    >
                      KQ TTM (OMS RMA)
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(2, 132, 199, 0.05)',
                      }}
                    >
                      KQ TTM (QLTTTKGD)
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setSortField('diffTtm');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Lệch TTM</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>

                    {/* Group 2: Ký Quỹ Lệnh Chờ */}
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(139, 92, 246, 0.05)',
                        borderLeft: '1px solid var(--border-color)',
                      }}
                    >
                      KQ Lệnh Chờ (OMS RMO)
                    </th>

                    {/* Group 3: Tổng Ký Quỹ Tạm Tính */}
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderLeft: '1px solid var(--border-color)',
                      }}
                    >
                      Tổng KQ (OMS)
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                      }}
                    >
                      Tổng KQ (QLTTTKGD)
                    </th>
                    <th
                      style={{
                        padding: '10px 12px',
                        textAlign: 'right',
                        backgroundColor: 'rgba(245, 158, 11, 0.08)',
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        setSortField('diffTotal');
                        setSortAsc(!sortAsc);
                      }}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>Lệch Tổng</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>

                    {/* Status & Actions */}
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '130px' }}>Trạng Thái</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center', width: '110px' }}>Hợp Đồng</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {filterStatus === 'DIFF_ANY' && summary && summary.totalDiff === 0 && summary.totalOmsAccounts > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '52px', height: '52px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <CheckCircle2 size={30} color="#10b981" />
                            </div>
                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981' }}>
                              KHỚP HOÀN TOÀN 100%
                            </div>
                            <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', maxWidth: '460px' }}>
                              Toàn bộ <strong>{summary.totalMatched?.toLocaleString()}</strong> tài khoản đều khớp số liệu ký quỹ giữa OMS và QLTTTKGD. Không phát hiện tài khoản nào lệch!
                            </div>
                            <button
                              type="button"
                              onClick={() => setFilterStatus('ALL')}
                              className="btn btn-secondary"
                              style={{ marginTop: '6px', fontSize: '0.8rem', padding: '6px 14px' }}
                            >
                              Xem tất cả {summary.totalOmsAccounts?.toLocaleString()} tài khoản
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <FileSpreadsheet size={32} strokeWidth={1.5} color="var(--text-muted)" />
                            <span>
                              {loading
                                ? 'Đang tải dữ liệu đối chiếu...'
                                : reconResult
                                ? 'Không tìm thấy tài khoản phù hợp với bộ lọc hiện tại'
                                : 'Chưa có dữ liệu đối chiếu. Vui lòng bấm "Chạy Đối Chiếu Ký Quỹ OMS".'}
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const portfolioKeys = Object.keys(row.portfolios || {});
                      const portfolioCount = portfolioKeys.length;
                      const stt = (currentPage - 1) * pageSize + idx + 1;

                      return (
                        <tr
                          key={row.accountNumber || idx}
                          style={{
                            borderBottom: '1px solid var(--border-color)',
                            backgroundColor:
                              !row.isMatchTtm || !row.isMatchTotal
                                ? 'rgba(239, 68, 68, 0.03)'
                                : 'transparent',
                            transition: 'background-color 0.15s ease',
                          }}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        >
                          {/* STT */}
                          <td style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {stt}
                          </td>

                          {/* Mã TK */}
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            <span>{row.accountNumber}</span>
                          </td>

                          {/* TVKD */}
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {row.memberCode || '—'}
                          </td>

                          {/* Tiền Ký Quỹ IM Cash */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(row.imCash)}
                          </td>

                          {/* KQ TTM (OMS RMA) */}
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              borderLeft: '1px solid var(--border-color)',
                            }}
                          >
                            {fmt(row.omsRma)}
                          </td>

                          {/* KQ TTM (QLTTTKGD REQSECURED) */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(row.qlReqSecured)}
                          </td>

                          {/* Lệch TTM */}
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: row.diffTtm !== 0 ? 800 : 500,
                              color: row.diffTtm === 0 ? '#10b981' : '#f59e0b',
                              backgroundColor: row.diffTtm !== 0 ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
                            }}
                          >
                            {row.diffTtm === 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={13} color="#10b981" /> 0
                              </span>
                            ) : (
                              `${row.diffTtm > 0 ? '+' : ''}${fmt(row.diffTtm)}`
                            )}
                          </td>

                          {/* KQ Lệnh Chờ (OMS RMO) */}
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              borderLeft: '1px solid var(--border-color)',
                            }}
                          >
                            {fmt(row.omsRmo)}
                          </td>

                          {/* Tổng KQ (OMS RMA + RMO) */}
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              borderLeft: '1px solid var(--border-color)',
                            }}
                          >
                            {fmt(row.omsTotalReq)}
                          </td>

                          {/* Tổng KQ (QLTTTKGD EREQSECURED) */}
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(row.qlEReqSecured)}
                          </td>

                          {/* Lệch Tổng */}
                          <td
                            style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontVariantNumeric: 'tabular-nums',
                              fontWeight: row.diffTotal !== 0 ? 800 : 500,
                              color: row.diffTotal === 0 ? '#10b981' : '#ef4444',
                              backgroundColor: row.diffTotal !== 0 ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                            }}
                          >
                            {row.diffTotal === 0 ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                <CheckCircle2 size={13} color="#10b981" /> 0
                              </span>
                            ) : (
                              `${row.diffTotal > 0 ? '+' : ''}${fmt(row.diffTotal)}`
                            )}
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {row.status === 'MATCH' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                                  color: '#10b981',
                                }}
                              >
                                <CheckCircle2 size={12} />
                                KHỚP
                              </span>
                            )}
                            {row.status === 'DIFF_TTM' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                  color: '#f59e0b',
                                }}
                              >
                                <AlertTriangle size={12} />
                                LỆCH TTM
                              </span>
                            )}
                            {row.status === 'DIFF_TOTAL' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                                  color: '#ef4444',
                                }}
                              >
                                <AlertTriangle size={12} />
                                LỆCH TỔNG
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
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(220, 38, 38, 0.15)',
                                  color: '#dc2626',
                                }}
                              >
                                <XCircle size={12} />
                                LỆCH CẢ HAI
                              </span>
                            )}
                            {row.status === 'NOT_FOUND_IN_QLTTTKGD' && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  backgroundColor: 'rgba(139, 92, 246, 0.12)',
                                  color: '#8b5cf6',
                                }}
                              >
                                <AlertCircle size={12} />
                                THIẾU TRÊN QL
                              </span>
                            )}
                          </td>

                          {/* Hành động: Chi tiết Hợp đồng */}
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            {portfolioCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => setSelectedAccountForModal(row)}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: 700,
                                  backgroundColor: 'rgba(2, 132, 199, 0.1)',
                                  color: '#0284c7',
                                  border: '1px solid rgba(2, 132, 199, 0.25)',
                                  cursor: 'pointer',
                                }}
                                title="Xem danh mục vị thế hợp đồng của tài khoản"
                              >
                                <FileText size={12} />
                                <span>{portfolioCount} HĐ</span>
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>0 HĐ</span>
                            )}
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
                  Hiển thị <strong>{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> - <strong>{Math.min(currentPage * pageSize, filteredRows.length)}</strong> / Tổng số <strong>{filteredRows.length.toLocaleString()}</strong> tài khoản
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
        </div>
      )}

      {/* ── TAB 2 CONTENT: CHECK TTM (VỊ THẾ MỞ) ── */}
      {activeSubTab === 'CHECK_TTM' && (
        <OmsTtmSubSection
          token={token}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      )}

      {/* ── TAB 3 CONTENT: CHECK TTTT (TẤT TOÁN & LÃI LỖ) ── */}
      {activeSubTab === 'CHECK_TTTT' && (
        <OmsTtttSubSection
          token={token}
          selectedDate={selectedDate}
          onSelectDate={onSelectDate}
        />
      )}

      {/* ── MODAL: CHI TIẾT DANH MỤC HỢP ĐỒNG (PORTFOLIOS) CỦA TÀI KHOẢN ── */}
      {selectedAccountForModal && (
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
          onClick={() => setSelectedAccountForModal(null)}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: '920px',
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
                <FileText size={18} color="#0284c7" />
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Chi Tiết Danh Mục Hợp Đồng OMS
                  </h4>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Tài khoản: <strong>{selectedAccountForModal.accountNumber}</strong> • TVKD:{' '}
                    <strong>{selectedAccountForModal.memberCode || '—'}</strong> • Tiền KQ:{' '}
                    <strong>{fmt(selectedAccountForModal.imCash)} VND</strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAccountForModal(null)}
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

            {/* Modal Body: Contracts Table */}
            <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
              {Object.keys(selectedAccountForModal.portfolios || {}).length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Tài khoản không có vị thế hợp đồng mở nào trong danh mục OMS.
                </div>
              ) : (
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-input)',
                        borderBottom: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.73rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '8px 10px' }}>Hợp Đồng (Symbol)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vị Thế Mua</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Vị Thế Bán</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chờ Mua</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Chờ Bán</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Giá VWAP</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>KQ HĐ (RMA)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>KQ Chờ (RMO)</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Lãi Lỗ Dự Kiến</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(selectedAccountForModal.portfolios).map(([symbol, p]) => (
                      <tr
                        key={symbol}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                        }}
                      >
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#0284c7' }}>{symbol}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {p.longQtty || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {p.shortQtty || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {p.pendingLongIM_Qtty || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {p.pendingShortIM_Qtty || 0}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(p.vwap)}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                          }}
                        >
                          {fmt(p.rma)}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            fontWeight: 700,
                          }}
                        >
                          {fmt(p.rmo)}
                        </td>
                        <td
                          style={{
                            padding: '8px 10px',
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                            color: (p.evrplAmt || 0) >= 0 ? '#10b981' : '#ef4444',
                          }}
                        >
                          {fmt(p.evrplAmt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
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
                onClick={() => setSelectedAccountForModal(null)}
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
