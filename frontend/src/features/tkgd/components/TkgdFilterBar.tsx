import React from 'react';
import { Calendar, Search, X, SlidersHorizontal } from 'lucide-react';
import { FilterStatus, TkgdStats } from '../types/tkgd.types';

interface TkgdFilterBarProps {
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  batchDate: string;
  setBatchDate: (d: string) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  isCompactView: boolean;
  toggleCompactView: () => void;
  stats?: TkgdStats;
  total?: number;
  khopCount?: number;
  khopTextCount?: number;
  canKiemTraCount?: number;
  lechCount?: number;
  onResetPage: () => void;
}

export const TkgdFilterBar: React.FC<TkgdFilterBarProps> = ({
  filter,
  setFilter,
  batchDate,
  setBatchDate,
  searchTerm,
  setSearchTerm,
  isCompactView,
  toggleCompactView,
  stats,
  total = 0,
  khopCount = 0,
  khopTextCount = 0,
  canKiemTraCount = 0,
  lechCount = 0,
  onResetPage,
}) => {
  const effectiveTotal = stats?.totalCount ?? total;
  const effectiveKhop = stats?.matchedCount ?? khopCount;
  const effectiveKhopText = stats?.matchedTextCount ?? khopTextCount;
  const effectiveCanKiemTra = stats?.canKiemTraCount ?? canKiemTraCount;
  const effectiveLech = stats?.mismatchedCount ?? lechCount;

  return (
    <div
      className="glass-panel"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '14px',
        padding: '12px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {/* Cụm Tabs Lọc Trạng thái & Phân hệ */}
      <div id="tutorial-tkgd-tabs" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
        {[
          { id: 'ALL', label: `Tất Cả (${effectiveTotal})` },
          { id: 'KHOP', label: `Khớp 100% (${effectiveKhop})`, color: '#10b981' },
          { id: 'CAN_KIEM_TRA', label: `Cần Ktra (${effectiveCanKiemTra})`, color: '#f59e0b' },
          ...(effectiveKhopText > 0 ? [{ id: 'KHOP_TEXT', label: `Khớp Text (${effectiveKhopText})`, color: '#3b82f6' }] : []),
          { id: 'LECH', label: `Sai Lệch (${effectiveLech})`, color: '#ef4444' },
        ].map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setFilter(t.id as FilterStatus);
                onResetPage();
              }}
              style={{
                padding: '5px 11px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? '1px solid var(--border-focus)' : '1px solid var(--border-color)',
                backgroundColor: active ? (t.color ? `${t.color}20` : 'var(--bg-input)') : 'transparent',
                color: active ? (t.color || 'var(--text-primary)') : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}

        <span style={{ color: 'var(--border-color)', margin: '0 4px' }}>|</span>

        {[
          { id: 'FUTURES', label: stats?.futuresCount !== undefined ? `Futures (${stats.futuresCount})` : 'Futures', color: '#3b82f6' },
          { id: 'ACM', label: stats?.acmCount !== undefined ? `ACM (-A) (${stats.acmCount})` : 'ACM (-A)', color: '#8b5cf6' },
          { id: 'LME', label: stats?.lmeCount !== undefined ? `LME (-L) (${stats.lmeCount})` : 'LME (-L)', color: '#f59e0b' },
          { id: 'SPREAD', label: stats?.spreadCount !== undefined ? `Spread (-S) (${stats.spreadCount})` : 'Spread (-S)', color: '#14b8a6' },
        ].map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setFilter(t.id as FilterStatus);
                onResetPage();
              }}
              style={{
                padding: '5px 11px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? `1px solid ${t.color}` : '1px solid var(--border-color)',
                backgroundColor: active ? `${t.color}20` : 'transparent',
                color: active ? t.color : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Cụm Tìm kiếm, Lọc ngày & Chế độ xem gọn */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Lọc theo ngày đợt */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} color="var(--text-muted)" />
          <input
            type="date"
            value={batchDate}
            onChange={(e) => {
              setBatchDate(e.target.value);
              onResetPage();
            }}
            title="Lọc theo ngày đợt batchDate"
            style={{
              padding: '5px 8px',
              fontSize: '0.75rem',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {batchDate && (
            <button
              onClick={() => {
                setBatchDate('');
                onResetPage();
              }}
              title="Xóa lọc ngày"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px',
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Tìm kiếm */}
        <div style={{ position: 'relative', width: '230px' }}>
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
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              onResetPage();
            }}
            placeholder="Tìm mã TK, tên KH, CCCD..."
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              fontSize: '0.78rem',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                onResetPage();
              }}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Nút Toggle Chế độ xem gọn (Compact Mode) */}
        <button
          onClick={toggleCompactView}
          title={isCompactView ? 'Chuyển sang chế độ xem đầy đủ' : 'Chuyển sang chế độ xem gọn'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 10px',
            borderRadius: '8px',
            backgroundColor: isCompactView ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
            border: isCompactView ? '1px solid #3b82f6' : '1px solid var(--border-color)',
            color: isCompactView ? '#3b82f6' : 'var(--text-secondary)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={13} />
          <span>{isCompactView ? 'Gọn' : 'Đầy đủ'}</span>
        </button>
      </div>
    </div>
  );
};
