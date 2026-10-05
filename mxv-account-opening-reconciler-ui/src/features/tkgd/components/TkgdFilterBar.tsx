import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Search,
  X,
  SlidersHorizontal,
  ArrowRight,
  ChevronDown,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { FilterStatus, TkgdStats, TkgdColumnKey } from '../types/tkgd.types';

export const COLUMN_DEFINITIONS: Array<{ key: TkgdColumnKey; label: string; locked?: boolean }> = [
  { key: 'stt', label: 'STT' },
  { key: 'maTKGD', label: 'Mã TKGD', locked: true },
  { key: 'phanHe', label: 'Phân hệ' },
  { key: 'tenMail', label: 'Tên trên Mail' },
  { key: 'hoTenMS', label: 'Họ & Tên trên MS' },
  { key: 'soCCCD', label: 'Số CCCD / CMT' },
  { key: 'trangThaiMS', label: 'Trạng thái MS' },
  { key: 'snapshot', label: 'Snapshot' },
  { key: 'ketLuan', label: 'Kết luận' },
  { key: 'thoiGian', label: 'Thời gian kiểm tra' },
  { key: 'soSanh', label: 'Thao tác So sánh' },
];

interface TkgdFilterBarProps {
  filter: FilterStatus;
  setFilter: (f: FilterStatus) => void;
  batchDate: string;
  setBatchDate: (d: string) => void;
  startDate?: string;
  setStartDate?: (d: string) => void;
  endDate?: string;
  setEndDate?: (d: string) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  isCompactView?: boolean;
  toggleCompactView?: () => void;
  visibleColumns?: Record<TkgdColumnKey, boolean>;
  toggleColumn?: (key: TkgdColumnKey) => void;
  setColumnPreset?: (preset: 'DEFAULT' | 'COMPACT') => void;
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
  startDate = '',
  setStartDate,
  endDate = '',
  setEndDate,
  searchTerm,
  setSearchTerm,
  isCompactView = false,
  toggleCompactView,
  visibleColumns,
  toggleColumn,
  setColumnPreset,
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

  // Popover Quản lý cột
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  // Đóng Popover khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(event.target as Node)) {
        setShowColumnMenu(false);
      }
    };
    if (showColumnMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showColumnMenu]);

  // Bộ chọn nhanh khoảng thời gian
  const handleQuickPreset = (preset: 'today' | '3days' | '7days' | 'all') => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (preset === 'today') {
      if (setStartDate) setStartDate(todayStr);
      if (setEndDate) setEndDate(todayStr);
      setBatchDate(todayStr);
    } else if (preset === '3days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 2);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      if (setStartDate) setStartDate(pastStr);
      if (setEndDate) setEndDate(todayStr);
      setBatchDate('');
    } else if (preset === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      const pastStr = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, '0')}-${String(past.getDate()).padStart(2, '0')}`;
      if (setStartDate) setStartDate(pastStr);
      if (setEndDate) setEndDate(todayStr);
      setBatchDate('');
    } else if (preset === 'all') {
      if (setStartDate) setStartDate('');
      if (setEndDate) setEndDate('');
      setBatchDate('');
    }
    onResetPage();
  };

  // Tính số cột đang active
  const activeColumnCount = visibleColumns
    ? COLUMN_DEFINITIONS.filter((c) => visibleColumns[c.key] !== false).length
    : COLUMN_DEFINITIONS.length;

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
      {/* Cụm Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {[
          { key: 'ALL', label: `Tất Cả (${effectiveTotal})`, color: 'var(--text-primary)' },
          { key: 'KHOP', label: `Khớp 100% (${effectiveKhop})`, color: '#10b981' },
          { key: 'CAN_KIEM_TRA', label: `Cần KTra (${effectiveCanKiemTra})`, color: '#f59e0b' },
          { key: 'LECH', label: `Sai Lệch (${effectiveLech})`, color: '#ef4444' },
        ].map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setFilter(tab.key as FilterStatus);
                onResetPage();
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? `1px solid ${tab.color}` : '1px solid var(--border-color)',
                backgroundColor: active ? `${tab.color}15` : 'transparent',
                color: active ? tab.color : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}

        <div style={{ height: '18px', width: '1px', backgroundColor: 'var(--border-color)', margin: '0 4px' }} />

        {/* Lọc theo Phân hệ */}
        {[
          { key: 'FUTURES', label: `Futures (${stats?.futuresCount ?? 0})`, color: '#3b82f6' },
          { key: 'ACM', label: `ACM (-A) (${stats?.acmCount ?? 0})`, color: '#8b5cf6' },
          { key: 'LME', label: `LME (-L) (${stats?.lmeCount ?? 0})`, color: '#ec4899' },
          { key: 'SPREAD', label: `Spread (-S) (${stats?.spreadCount ?? 0})`, color: '#06b6d4' },
        ].map((t) => {
          const active = filter === t.key;
          return (
            <button
              key={t.key}
              onClick={() => {
                setFilter(active ? 'ALL' : (t.key as FilterStatus));
                onResetPage();
              }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
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

      {/* Cụm Tìm kiếm, Lọc khoảng thời gian & Quản lý cột */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        {/* Lọc khoảng thời gian (Date Range) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px 8px',
          }}
        >
          <Calendar size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Từ</span>
          <input
            type="date"
            value={startDate || (!endDate && batchDate ? batchDate : '')}
            onChange={(e) => {
              const val = e.target.value;
              if (setStartDate) setStartDate(val);
              if (!endDate && setEndDate) setEndDate(val);
              if (!val && !endDate) setBatchDate('');
              onResetPage();
            }}
            title="Lọc từ ngày"
            style={{
              padding: '2px 4px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <ArrowRight size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Đến</span>
          <input
            type="date"
            value={endDate || (!startDate && batchDate ? batchDate : '')}
            onChange={(e) => {
              const val = e.target.value;
              if (setEndDate) setEndDate(val);
              if (!startDate && setStartDate) setStartDate(val);
              if (!val && !startDate) setBatchDate('');
              onResetPage();
            }}
            title="Lọc đến ngày"
            style={{
              padding: '2px 4px',
              fontSize: '0.74rem',
              borderRadius: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          {(startDate || endDate || batchDate) && (
            <button
              onClick={() => {
                if (setStartDate) setStartDate('');
                if (setEndDate) setEndDate('');
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
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Nút Preset nhanh khoảng thời gian */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          {(() => {
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const isTodaySelected = (startDate === todayStr && endDate === todayStr) || (!startDate && !endDate && batchDate === todayStr);
            return (
              <button
                onClick={() => handleQuickPreset('today')}
                title="Xem hồ sơ hôm nay"
                style={{
                  padding: '4px 7px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: isTodaySelected ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                  border: isTodaySelected ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                  color: isTodaySelected ? '#3b82f6' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Hôm nay
              </button>
            );
          })()}
          <button
            onClick={() => handleQuickPreset('3days')}
            title="Xem hồ sơ 3 ngày gần nhất"
            style={{
              padding: '4px 7px',
              fontSize: '0.7rem',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            3 ngày
          </button>
          <button
            onClick={() => handleQuickPreset('7days')}
            title="Xem hồ sơ 7 ngày gần nhất"
            style={{
              padding: '4px 7px',
              fontSize: '0.7rem',
              fontWeight: 600,
              borderRadius: '6px',
              backgroundColor: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            7 ngày
          </button>
        </div>

        {/* Tìm kiếm */}
        <div style={{ position: 'relative', width: '210px' }}>
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

        {/* Nút Quản lý hiển thị các cột (Column Visibility Selector) */}
        <div style={{ position: 'relative' }} ref={columnMenuRef}>
          <button
            onClick={() => setShowColumnMenu((prev) => !prev)}
            title="Chọn các cột để hiển thị trên bảng"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: showColumnMenu ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
              border: showColumnMenu ? '1px solid #3b82f6' : '1px solid var(--border-color)',
              color: showColumnMenu ? '#3b82f6' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <SlidersHorizontal size={13} />
            <span>
              {activeColumnCount === COLUMN_DEFINITIONS.length
                ? 'Đầy đủ'
                : `Cột (${activeColumnCount}/${COLUMN_DEFINITIONS.length})`}
            </span>
            <ChevronDown
              size={12}
              style={{
                transform: showColumnMenu ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {showColumnMenu && (
            <div
              className="glass-panel"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 6px)',
                width: '260px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)',
                padding: '12px',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '8px',
                  marginBottom: '8px',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <SlidersHorizontal size={13} style={{ color: '#3b82f6' }} />
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Tùy chọn cột
                  </span>
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {activeColumnCount}/{COLUMN_DEFINITIONS.length}
                </span>
              </div>

              {/* Nút Preset nhanh: Đầy đủ / Thu gọn */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (setColumnPreset) setColumnPreset('DEFAULT');
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor:
                      activeColumnCount === COLUMN_DEFINITIONS.length ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    border:
                      activeColumnCount === COLUMN_DEFINITIONS.length
                        ? '1px solid #3b82f6'
                        : '1px solid var(--border-color)',
                    color:
                      activeColumnCount === COLUMN_DEFINITIONS.length ? '#3b82f6' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={11} />
                  <span>Đầy đủ</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (setColumnPreset) setColumnPreset('COMPACT');
                  }}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    backgroundColor: isCompactView ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-input)',
                    border: isCompactView ? '1px solid #3b82f6' : '1px solid var(--border-color)',
                    color: isCompactView ? '#3b82f6' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Thu gọn</span>
                </button>
              </div>

              {/* Danh sách các cột có thể bật / tắt */}
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {COLUMN_DEFINITIONS.map((col) => {
                  const isChecked = visibleColumns ? visibleColumns[col.key] !== false : true;
                  return (
                    <label
                      key={col.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 6px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        color: 'var(--text-primary)',
                        cursor: col.locked ? 'not-allowed' : 'pointer',
                        opacity: col.locked ? 0.7 : 1,
                      }}
                      className="hover:bg-slate-100 dark:hover:bg-slate-800/50"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={col.locked}
                          onChange={() => {
                            if (!col.locked && toggleColumn) toggleColumn(col.key);
                          }}
                          style={{
                            cursor: col.locked ? 'not-allowed' : 'pointer',
                            width: '14px',
                            height: '14px',
                            accentColor: '#3b82f6',
                          }}
                        />
                        <span>{col.label}</span>
                      </div>
                      {col.locked && (
                        <span
                          style={{
                            fontSize: '0.62rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-input)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          Cố định
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
