import React from 'react';
import { Users, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { CleanRecord, FilterStatus } from '../types/tkgd.types';

interface TkgdStatsCardsProps {
  records: CleanRecord[];
  total: number;
  activeFilter?: FilterStatus;
  onFilterSelect?: (filter: FilterStatus) => void;
}

export const TkgdStatsCards: React.FC<TkgdStatsCardsProps> = ({
  records,
  total,
  activeFilter,
  onFilterSelect,
}) => {
  const khopCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP').length;
  const khopTextCount = records.filter((r) => r.ketLuan?.trangThai === 'KHOP_TEXT').length;
  const canKiemTraCount = records.filter((r) => r.ketLuan?.trangThai === 'CAN_KIEM_TRA').length;
  const lechCount = records.filter(
    (r) =>
      r.ketLuan?.trangThai &&
      r.ketLuan?.trangThai !== 'KHOP' &&
      r.ketLuan?.trangThai !== 'KHOP_TEXT' &&
      r.ketLuan?.trangThai !== 'CAN_KIEM_TRA' &&
      r.ketLuan?.trangThai !== 'CHUA_XU_LY'
  ).length;

  return (
    <div
      id="tutorial-tkgd-stats-cards"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
      }}
      className="animate-fade-in"
    >
      {/* Card 1: Tổng */}
      <div
        onClick={() => onFilterSelect?.('ALL')}
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: activeFilter === 'ALL' ? '2px solid #3b82f6' : '1px solid var(--border-color)',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          cursor: onFilterSelect ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Tổng Hồ Sơ (Trang này)
          </span>
          <Users size={17} color="#3b82f6" />
        </div>
        <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'var(--text-primary)', margin: '6px 0 2px 0' }}>
          {records.length} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)' }}>/ {total}</span>
        </p>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hồ sơ trong database</span>
      </div>

      {/* Card 2: Khớp */}
      <div
        onClick={() => onFilterSelect?.('KHOP')}
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: activeFilter === 'KHOP' ? '2px solid #10b981' : '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          cursor: onFilterSelect ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase' }}>
            Khớp Hoàn Toàn
          </span>
          <CheckCircle2 size={17} color="#10b981" />
        </div>
        <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#10b981', margin: '6px 0 2px 0' }}>
          {khopCount}
          {khopTextCount > 0 && (
            <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#f59e0b', marginLeft: '6px' }}>
              (+{khopTextCount} text)
            </span>
          )}
        </p>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {khopTextCount > 0 ? `${khopCount} đủ CCCD | ${khopTextCount} chờ đính kèm` : 'Tô màu xanh lá trong Excel'}
        </span>
      </div>

      {/* Card 3: Cần Kiểm Tra Lại */}
      <div
        onClick={() => onFilterSelect?.('CAN_KIEM_TRA')}
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: activeFilter === 'CAN_KIEM_TRA' ? '2px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          cursor: onFilterSelect ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
            Cần Kiểm Tra Lại
          </span>
          <AlertTriangle size={17} color="#f59e0b" />
        </div>
        <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#f59e0b', margin: '6px 0 2px 0' }}>
          {canKiemTraCount}
        </p>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Case đặc biệt / HĐ khuyết trường</span>
      </div>

      {/* Card 4: Lệch */}
      <div
        onClick={() => onFilterSelect?.('LECH')}
        className="glass-panel"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: activeFilter === 'LECH' ? '2px solid #ef4444' : '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '14px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow-sm)',
          cursor: onFilterSelect ? 'pointer' : 'default',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase' }}>
            Sai Lệch Dữ Liệu
          </span>
          <X size={17} color="#ef4444" />
        </div>
        <p style={{ fontSize: '1.7rem', fontWeight: 800, color: '#ef4444', margin: '6px 0 2px 0' }}>
          {lechCount}
        </p>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cần kiểm tra trước khi duyệt</span>
      </div>
    </div>
  );
};
