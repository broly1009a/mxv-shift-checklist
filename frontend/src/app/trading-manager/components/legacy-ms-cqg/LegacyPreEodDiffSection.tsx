'use client';

import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Copy,
  FileText,
  Play,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Layers,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface PreEodTotals {
  totalACM_MS?: number;
  totalACM_Straits?: number;
  differACM?: number;
  totalCQG_MS?: number;
  totalCQG_FR?: number;
  differCQG?: number;
}

export interface PreEodMismatchedTrade {
  source?: 'CQG' | 'MSystem' | 'MS' | string;
  maLenh?: string;
  maTKGD?: string;
  maHD?: string;
  giaKhop?: number | string;
  klGiaoDich?: number | string;
  ngayGio?: string;
  reason?: string;
}

export interface PreEodMismatchedPosition {
  account?: string;
  symbol?: string;
  msPosition?: number;
  cqgPosition?: number;
  differ?: number;
}

export interface PreEodData {
  jobId?: string | null;
  status?: string;
  executedAt?: string | null;
  error?: string | null;
  logs?: string[];
  isWaitingFiles?: boolean;
  passed?: boolean;
  totals?: PreEodTotals;
  acm?: {
    msVolume?: number;
    straitsVolume?: number;
    differ?: number;
  };
  cqg?: {
    msVolume?: number;
    cqgVolume?: number;
    differ?: number;
  };
  mismatchedTradesCount?: number;
  mismatchedTradesTotal?: number;
  mismatchedTrades?: PreEodMismatchedTrade[];
  mismatchedPositionsCount?: number;
  mismatchedPositionsTotal?: number;
  mismatchedPositions?: PreEodMismatchedPosition[];
}

export interface LegacyPreEodDiffSectionProps {
  preEodData?: PreEodData | null;
  onTriggerCheck: () => void;
  triggering: boolean;
  onOpenLogs?: (jobId?: string, logs?: string[]) => void;
}

function fmtNum(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const n = typeof val === 'number' ? val : Number(val);
  if (isNaN(n)) return String(val);
  return n.toLocaleString('en-US');
}

function formatExecTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const vnDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
  const dd = String(vnDate.getDate()).padStart(2, '0');
  const mm = String(vnDate.getMonth() + 1).padStart(2, '0');
  const yyyy = vnDate.getFullYear();
  const HH = String(vnDate.getHours()).padStart(2, '0');
  const ii = String(vnDate.getMinutes()).padStart(2, '0');
  const ss = String(vnDate.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${HH}:${ii}:${ss}`;
}

export default function LegacyPreEodDiffSection({
  preEodData,
  onTriggerCheck,
  triggering,
  onOpenLogs,
}: LegacyPreEodDiffSectionProps) {
  const [activeTab, setActiveTab] = useState<'TRADES' | 'POSITIONS'>('TRADES');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CQG' | 'MS'>('ALL');

  const totals = preEodData?.totals || {
    totalACM_MS: preEodData?.acm?.msVolume ?? 0,
    totalACM_Straits: preEodData?.acm?.straitsVolume ?? 0,
    differACM: preEodData?.acm?.differ ?? 0,
    totalCQG_MS: preEodData?.cqg?.msVolume ?? 0,
    totalCQG_FR: preEodData?.cqg?.cqgVolume ?? 0,
    differCQG: preEodData?.cqg?.differ ?? 0,
  };

  const hasExecuted = !!preEodData?.executedAt;
  const isWaitingFiles = !!preEodData?.isWaitingFiles;

  const rawTrades = useMemo(() => {
    return Array.isArray(preEodData?.mismatchedTrades) ? preEodData.mismatchedTrades : [];
  }, [preEodData?.mismatchedTrades]);

  const rawPositions = useMemo(() => {
    return Array.isArray(preEodData?.mismatchedPositions) ? preEodData.mismatchedPositions : [];
  }, [preEodData?.mismatchedPositions]);

  const tradesCount = preEodData?.mismatchedTradesTotal ?? preEodData?.mismatchedTradesCount ?? rawTrades.length;
  const positionsCount = preEodData?.mismatchedPositionsTotal ?? preEodData?.mismatchedPositionsCount ?? rawPositions.length;

  const isPassed = hasExecuted && !isWaitingFiles && (
    preEodData?.passed === true || (
      (totals.differACM ?? 0) === 0 &&
      (totals.differCQG ?? 0) === 0 &&
      tradesCount === 0 &&
      positionsCount === 0
    )
  );

  // Filtered trades
  const filteredTrades = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawTrades.filter((t) => {
      const src = (t.source || '').toUpperCase();
      if (sourceFilter === 'CQG' && !src.includes('CQG')) return false;
      if (sourceFilter === 'MS' && (src.includes('CQG') || (!src.includes('MS') && !src.includes('SYSTEM')))) return false;

      if (!q) return true;
      const acc = (t.maTKGD || '').toLowerCase();
      const sym = (t.maHD || '').toLowerCase();
      const ord = (t.maLenh || '').toLowerCase();
      const rsn = (t.reason || '').toLowerCase();
      return acc.includes(q) || sym.includes(q) || ord.includes(q) || rsn.includes(q);
    });
  }, [rawTrades, searchQuery, sourceFilter]);

  // Filtered positions
  const filteredPositions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rawPositions.filter((p) => {
      if (!q) return true;
      const acc = (p.account || '').toLowerCase();
      const sym = (p.symbol || '').toLowerCase();
      return acc.includes(q) || sym.includes(q);
    });
  }, [rawPositions, searchQuery]);

  // Copy report to clipboard
  const handleCopyReport = () => {
    const lines: string[] = [
      '================================================================================',
      'BÁO CÁO ĐỐI CHIẾU PRE-EOD (M-SYSTEM ↔ CQG ↔ STRAITS/ACM)',
      `Thời gian kiểm tra: ${formatExecTime(preEodData?.executedAt) || 'Chưa kiểm tra'}`,
      `Trạng thái: ${isWaitingFiles ? 'ĐANG CHỜ TỆP' : isPassed ? 'KHỚP HOÀN TOÀN' : 'PHÁT HIỆN LỆCH'}`,
      '--------------------------------------------------------------------------------',
      '1. TỔNG HỢP KHỐI LƯỢNG GIAO DỊCH:',
      ` [ACM / Tự Doanh]: MS=${fmtNum(totals.totalACM_MS)} lot | Straits=${fmtNum(totals.totalACM_Straits)} lot | Lệch=${fmtNum(totals.differACM)} lot`,
      ` [CQG / Khách Hàng]: MS=${fmtNum(totals.totalCQG_MS)} lot | FR=${fmtNum(totals.totalCQG_FR)} lot | Lệch=${fmtNum(totals.differCQG)} lot`,
      '--------------------------------------------------------------------------------',
      `2. CHI TIẾT LỆNH KHỚP LỆCH (${tradesCount} lệnh):`,
    ];

    if (rawTrades.length > 0) {
      rawTrades.slice(0, 50).forEach((t) => {
        lines.push(` - [${t.source || 'CQG'}] TK: ${t.maTKGD || '--'} | HĐ: ${t.maHD || '--'} | Giá: ${fmtNum(t.giaKhop)} | Qty: ${fmtNum(t.klGiaoDich)} | ${t.reason || ''}`);
      });
      if (rawTrades.length > 50) {
        lines.push(` ... và còn ${rawTrades.length - 50} lệnh lệch khác`);
      }
    } else {
      lines.push(' OK! Không có lệnh lệch nào giữa MS và CQG.');
    }

    lines.push('--------------------------------------------------------------------------------');
    lines.push(`3. CHI TIẾT LỆCH VỊ THẾ TẤT TOÁN NET (${positionsCount} vị thế):`);
    if (rawPositions.length > 0) {
      rawPositions.forEach((p) => {
        lines.push(` - TK: ${p.account || '--'} | HĐ: ${p.symbol || '--'} | MS: ${fmtNum(p.msPosition)} | CQG: ${fmtNum(p.cqgPosition)} | Lệch: ${fmtNum(p.differ)}`);
      });
    } else {
      lines.push(' OK! Không có lệch vị thế net.');
    }
    lines.push('================================================================================');

    navigator.clipboard.writeText(lines.join('\n'));
    toast.success('Đã sao chép báo cáo chi tiết Pre-EOD vào clipboard!');
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(59, 130, 246, 0.12)',
              color: '#3b82f6',
            }}
          >
            <Layers size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Chi tiết đối chiếu Pre-EOD (M-System ↔ CQG ↔ Straits/ACM)
              </h4>
              {hasExecuted && preEodData?.executedAt && (
                <span
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--text-muted)',
                    fontFamily: 'monospace',
                    fontWeight: 600,
                  }}
                >
                  ({formatExecTime(preEodData.executedAt)})
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              Kiểm tra 3 bên: Đối chiếu tổng số lot khớp, danh sách lệnh chi tiết và vị thế tất toán ròng (TTTT vs PS)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Badge */}
          {isWaitingFiles ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Chờ tệp CQG/Straits</span>
            </span>
          ) : !hasExecuted ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(148, 163, 184, 0.12)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Clock size={13} />
              <span>Chưa kiểm tra phiên này</span>
            </span>
          ) : isPassed ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={13} />
              <span>Khớp hoàn toàn</span>
            </span>
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '0.74rem',
                fontWeight: 700,
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
              }}
            >
              <AlertTriangle size={13} />
              <span>Phát hiện chênh lệch</span>
            </span>
          )}

          {/* Button Xem Log */}
          {onOpenLogs && preEodData?.logs && preEodData.logs.length > 0 && (
            <button
              type="button"
              onClick={() => onOpenLogs(preEodData.jobId || undefined, preEodData.logs)}
              className="btn btn-secondary"
              title="Xem log thực thi chi tiết của bot"
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <FileText size={13} />
              <span>Xem Log</span>
            </button>
          )}

          {/* Button Copy Report */}
          <button
            type="button"
            onClick={handleCopyReport}
            className="btn btn-secondary"
            title="Sao chép toàn bộ kết quả đối chiếu Pre-EOD vào clipboard"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <Copy size={13} />
            <span>Sao chép</span>
          </button>

          {/* Button Check Pre-EOD */}
          <button
            type="button"
            onClick={onTriggerCheck}
            disabled={triggering}
            className="btn btn-primary"
            style={{
              fontSize: '0.75rem',
              padding: '6px 16px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              cursor: triggering ? 'not-allowed' : 'pointer',
              opacity: triggering ? 0.7 : 1,
            }}
          >
            {triggering ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Đang quét Pre-EOD...</span>
              </>
            ) : (
              <>
                <RefreshCw size={13} />
                <span>Check Pre-EOD</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Top Row: 4 Metric Cards (Matching C# Part 1) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          padding: '16px 20px',
          backgroundColor: 'rgba(255, 255, 255, 0.01)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {/* Card 1: ACM / Tự Doanh */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              ACM / Tự Doanh (MS vs Straits)
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: (totals.differACM ?? 0) === 0 ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              Lệch: {fmtNum(totals.differACM)} lot
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {fmtNum(totals.totalACM_MS)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#3b82f6', fontFamily: 'monospace' }}>
              {fmtNum(totals.totalACM_Straits)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lot</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            M-System (đuôi A) vs Straits CSV
          </span>
        </div>

        {/* Card 2: CQG / Khách Hàng */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-input)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              CQG / Khách Hàng (MS vs FR)
            </span>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: (totals.differCQG ?? 0) === 0 ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
              }}
            >
              Lệch: {fmtNum(totals.differCQG)} lot
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '2px' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {fmtNum(totals.totalCQG_MS)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vs</span>
            <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#10b981', fontFamily: 'monospace' }}>
              {fmtNum(totals.totalCQG_FR)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lot</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            M-System (khác A) vs CQG FR gộp
          </span>
        </div>

        {/* Card 3: Lệnh Khớp Lệch */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: tradesCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-input)',
            borderRadius: '8px',
            border: tradesCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Lệnh Khớp Lệch (Trades)
            </span>
            {tradesCount === 0 && hasExecuted && (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>Khớp 100%</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: tradesCount > 0 ? '#ef4444' : '#10b981',
                fontFamily: 'monospace',
              }}
            >
              {fmtNum(tradesCount)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>lệnh chênh lệch</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Lệnh thiếu/lệch giữa MS và CQG FR
          </span>
        </div>

        {/* Card 4: Lệch Vị Thế Tất Toán Net */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: positionsCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-input)',
            borderRadius: '8px',
            border: positionsCount > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Vị Thế Net Lệch (Positions)
            </span>
            {positionsCount === 0 && hasExecuted && (
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10b981' }}>Khớp 100%</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '2px' }}>
            <span
              style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: positionsCount > 0 ? '#ef4444' : '#10b981',
                fontFamily: 'monospace',
              }}
            >
              {fmtNum(positionsCount)}
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>vị thế ròng lệch</span>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            M-System TTTT vs CQG PS (Tất toán)
          </span>
        </div>
      </div>

      {/* 3. Discrepancy Tabs & Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px 0 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('TRADES')}
            style={{
              padding: '10px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'TRADES' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'TRADES' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'TRADES' ? 'var(--bg-card)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Chi tiết lệnh lệch khớp lệnh</span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: tradesCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: tradesCount > 0 ? '#ef4444' : '#10b981',
              }}
            >
              {fmtNum(tradesCount)}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('POSITIONS')}
            style={{
              padding: '10px 18px',
              fontSize: '0.84rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'POSITIONS' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'POSITIONS' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'POSITIONS' ? 'var(--bg-card)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Chi tiết lệch vị thế tất toán net (TTTT vs PS)</span>
            <span
              style={{
                padding: '2px 7px',
                borderRadius: '10px',
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: positionsCount > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: positionsCount > 0 ? '#ef4444' : '#10b981',
              }}
            >
              {fmtNum(positionsCount)}
            </span>
          </button>
        </div>

        {/* Filter & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', flexWrap: 'wrap' }}>
          {activeTab === 'TRADES' && (
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
              }}
            >
              <button
                type="button"
                onClick={() => setSourceFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: sourceFilter === 'ALL' ? '#3b82f6' : 'transparent',
                  color: sourceFilter === 'ALL' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('CQG')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: sourceFilter === 'CQG' ? '#3b82f6' : 'transparent',
                  color: sourceFilter === 'CQG' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                CQG
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('MS')}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  backgroundColor: sourceFilter === 'MS' ? '#3b82f6' : 'transparent',
                  color: sourceFilter === 'MS' ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                M-System
              </button>
            </div>
          )}

          {/* Search Box */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={13}
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'TRADES' ? 'Lọc TK, HĐ, Mã lệnh...' : 'Lọc TK, HĐ...'}
              style={{
                width: '100%',
                padding: '5px 28px 5px 30px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.74rem',
                color: 'var(--text-primary)',
                outline: 'none',
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
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. Discrepancy Tables Data View */}
      <div style={{ maxHeight: '280px', minHeight: '200px', overflowY: 'auto' }}>
        {activeTab === 'TRADES' ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 10 }}>
              <tr
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <th style={{ width: '9%', padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>Nguồn</th>
                <th style={{ width: '12%', padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>Mã lệnh</th>
                <th style={{ width: '13%', padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>Mã TKGD</th>
                <th style={{ width: '11%', padding: '10px 14px', borderRight: '1px solid var(--border-color)' }}>Mã HĐ</th>
                <th style={{ width: '12%', padding: '10px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Giá khớp</th>
                <th style={{ width: '9%', padding: '10px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Khối lượng</th>
                <th style={{ width: '14%', padding: '10px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'center' }}>Thời gian khớp</th>
                <th style={{ width: '20%', padding: '10px 14px' }}>Lý do lệch</th>
              </tr>
            </thead>
            <tbody>
              {!hasExecuted ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Clock size={24} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Chưa chạy kiểm tra Pre-EOD phiên này. Nhấn “Check Pre-EOD” để quét.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : isWaitingFiles ? (
                <tr>
                  <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={24} color="#f59e0b" />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f59e0b' }}>
                        Đang chờ đầy đủ tệp đối chiếu Pre-EOD từ CQG/Straits trong thư mục Backup.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredTrades.length > 0 ? (
                filteredTrades.map((item, idx) => {
                  const isCqg = (item.source || '').toUpperCase().includes('CQG');
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(239, 68, 68, 0.04)',
                        color: 'var(--text-primary)',
                        fontFamily: 'monospace',
                        fontSize: '0.82rem',
                      }}
                    >
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            backgroundColor: isCqg ? 'rgba(59, 130, 246, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                            color: isCqg ? '#3b82f6' : '#a855f7',
                            border: `1px solid ${isCqg ? 'rgba(59, 130, 246, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                          }}
                        >
                          {isCqg ? 'CQG' : 'MS'}
                        </span>
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        {item.maLenh || '--'}
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', fontWeight: 800, color: '#ef4444' }}>
                        {item.maTKGD || '--'}
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', fontWeight: 700 }}>
                        {item.maHD || '--'}
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                        {fmtNum(item.giaKhop)}
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                        {fmtNum(item.klGiaoDich)}
                      </td>
                      <td style={{ padding: '9px 14px', borderRight: '1px solid var(--border-color)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                        {item.ngayGio || '--'}
                      </td>
                      <td style={{ padding: '9px 14px', color: '#ef4444', fontWeight: 600, fontSize: '0.78rem' }}>
                        {item.reason || 'Lệch khớp lệnh'}
                      </td>
                    </tr>
                  );
                })
              ) : rawTrades.length > 0 && filteredTrades.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Không tìm thấy lệnh nào phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={28} color="#10b981" />
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#10b981' }}>
                        OK! Khớp 100%: Không có lệnh lệch nào giữa MS và CQG.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)', zIndex: 10 }}>
              <tr
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <th style={{ width: '22%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>Mã TKGD</th>
                <th style={{ width: '20%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>Mã HĐ</th>
                <th style={{ width: '20%', padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Vị thế MS (TTTT)</th>
                <th style={{ width: '20%', padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>Vị thế CQG (PS)</th>
                <th style={{ width: '18%', padding: '10px 16px', textAlign: 'right' }}>Chênh lệch (Lệch)</th>
              </tr>
            </thead>
            <tbody>
              {!hasExecuted ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Clock size={24} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                        Chưa chạy kiểm tra Pre-EOD phiên này. Nhấn “Check Pre-EOD” để quét.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : isWaitingFiles ? (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={24} color="#f59e0b" />
                      <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f59e0b' }}>
                        Đang chờ đầy đủ tệp đối chiếu Pre-EOD từ CQG/Straits trong thư mục Backup.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : filteredPositions.length > 0 ? (
                filteredPositions.map((item, idx) => (
                  <tr
                    key={idx}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(239, 68, 68, 0.04)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace',
                      fontSize: '0.82rem',
                    }}
                  >
                    <td style={{ padding: '9px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800, color: '#ef4444' }}>
                      {item.account || '--'}
                    </td>
                    <td style={{ padding: '9px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 700 }}>
                      {item.symbol || '--'}
                    </td>
                    <td style={{ padding: '9px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                      {fmtNum(item.msPosition)}
                    </td>
                    <td style={{ padding: '9px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                      {fmtNum(item.cqgPosition)}
                    </td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                      {fmtNum(item.differ)}
                    </td>
                  </tr>
                ))
              ) : rawPositions.length > 0 && filteredPositions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Không tìm thấy vị thế nào phù hợp với từ khóa &ldquo;{searchQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={28} color="#10b981" />
                      <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#10b981' }}>
                        OK! Khớp 100%: Vị thế tất toán ròng khớp hoàn toàn giữa MS và CQG.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
