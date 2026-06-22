import React from 'react';
import {
  TrendingUp,
  Activity,
  Check,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { Sparkline } from './Sparkline';

interface PerformanceOverviewProps {
  averageProgress: number;
  activeShiftsCount: number;
  completedShiftsCount: number;
}

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({
  averageProgress,
  activeShiftsCount,
  completedShiftsCount
}) => {
  return (
    <>
      {/* Large Highlight Overview Card */}
      <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center">

          {/* Left part: Core KPI display */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Tiến độ hoàn thành ca trực hôm nay
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '8px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {averageProgress}%
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.9rem', fontWeight: 700 }}>
                <TrendingUp size={16} /> <span>+2.4% so với hôm qua</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span><strong>{activeShiftsCount}</strong> ca trực đang chạy</span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span><strong>{completedShiftsCount}</strong> ca trực hoàn thành</span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span style={{ color: '#ef4444' }}><strong>0</strong> cảnh báo rủi ro</span>
            </div>
          </div>

          {/* Right part: Spark mini KPIs side by side */}
          <div style={{ display: 'flex', gap: '16px' }} className="flex-col sm:flex-row">
            {/* Mini card 1 */}
            <div style={{
              flex: 1,
              padding: '16px',
              background: 'rgba(59, 130, 246, 0.04)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>TPS Hiện Tại</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>1,248</p>
              </div>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6'
              }}>
                <Activity size={16} />
              </div>
            </div>

            {/* Mini card 2 */}
            <div style={{
              flex: 1,
              padding: '16px',
              background: 'rgba(16, 185, 129, 0.04)',
              border: '1px solid rgba(16, 185, 129, 0.1)',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Tỷ Lệ Thành Công</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: '#10b981' }}>99.2%</p>
              </div>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10b981'
              }}>
                <Check size={16} />
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* 4 Analytics cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>

        {/* Card 1 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Ca trực hôm nay</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {activeShiftsCount}
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> +12.4% vs hôm qua
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: 'var(--color-accent)' }}>
              <Clock size={20} />
            </div>
            <Sparkline points={[1, 2, 2, 3, 3, 2, 4]} color="#3b82f6" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tiến độ bình quân</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {averageProgress}%
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> +8.1% vs hôm qua
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#10b981' }}>
              <CheckCircle2 size={20} />
            </div>
            <Sparkline points={[60, 75, 70, 85, 90, 92, 98.2]} color="#10b981" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Cảnh báo rủi ro</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ef4444', margin: '4px 0 6px 0' }}>
              0
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <Check size={12} /> Hệ thống an toàn
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#ef4444' }}>
              <AlertTriangle size={20} />
            </div>
            <Sparkline points={[0, 0, 0, 0, 0, 0, 0]} color="#ef4444" />
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tỷ lệ đúng hạn</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              98.6%
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> +0.3% vs hôm qua
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#a855f7' }}>
              <Activity size={20} />
            </div>
            <Sparkline points={[96, 97, 96, 98, 98, 99, 98.6]} color="#a855f7" />
          </div>
        </div>

      </div>
    </>
  );
};
