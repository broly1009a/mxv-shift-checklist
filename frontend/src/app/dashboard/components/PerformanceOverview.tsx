import React from 'react';
import {
  TrendingUp,
  Activity,
  Check,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Cpu
} from 'lucide-react';
import { Sparkline } from './Sparkline';

interface PerformanceOverviewProps {
  summary: {
    totalJobs: number;
    pendingJobs: number;
    completedJobs: number;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    completionPercentage: number;
    failedTasks: number;
    botTasks: number;
    manualTasks: number;
  } | null;
  dateStr?: string;
}

export const PerformanceOverview: React.FC<PerformanceOverviewProps> = ({ summary, dateStr }) => {
  const formatDate = (ds?: string) => {
    if (!ds) return 'hôm nay';
    const parts = ds.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return ds;
  };

  const completionPercentage = summary?.completionPercentage ?? 0;
  const activeShiftsCount = summary?.pendingJobs ?? 0;
  const completedShiftsCount = summary?.completedJobs ?? 0;
  const totalJobs = summary?.totalJobs ?? 0;
  const totalTasks = summary?.totalTasks ?? 0;
  const completedTasks = summary?.completedTasks ?? 0;
  const failedTasks = summary?.failedTasks ?? 0;
  const botTasks = summary?.botTasks ?? 0;
  const manualTasks = summary?.manualTasks ?? 0;

  return (
    <>
      {/* Large Highlight Overview Card */}
      <div className="glass-panel" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-center">

          {/* Left part: Core KPI display */}
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              Tiến độ hoàn thành ca trực ngày {formatDate(dateStr)}
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', marginTop: '8px', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {completionPercentage}%
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.9rem', fontWeight: 700 }}>
                <TrendingUp size={16} /> <span>Hệ thống ổn định</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <span><strong>{activeShiftsCount}</strong> ca trực đang chạy</span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span><strong>{completedShiftsCount}</strong> ca trực hoàn thành</span>
              <span style={{ color: 'var(--border-color)' }}>|</span>
              <span style={{ color: failedTasks > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                <strong>{failedTasks}</strong> cảnh báo rủi ro
              </span>
            </div>
          </div>

          {/* Right part: Spark mini KPIs side by side */}
          <div style={{ display: 'flex', gap: '16px' }} className="flex-col sm:flex-row">
            {/* Mini card 1 */}
            <div style={{
              flex: 1,
              padding: '16px',
              background: 'rgba(168, 85, 247, 0.04)',
              border: '1px solid rgba(168, 85, 247, 0.1)',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Tác Vụ Tự Động (Bot)</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: 'var(--text-primary)' }}>{botTasks}</p>
              </div>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#a855f7'
              }}>
                <Cpu size={16} />
              </div>
            </div>

            {/* Mini card 2 */}
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
                <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700 }}>Tác Vụ Thủ Công</span>
                <p style={{ fontSize: '1.25rem', fontWeight: 800, margin: '4px 0 0 0', color: '#3b82f6' }}>{manualTasks}</p>
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
          </div>

        </div>
      </div>

      {/* 4 Analytics cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>

        {/* Card 1 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Ca trực ngày {formatDate(dateStr)}</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {totalJobs}
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> {activeShiftsCount} ca đang xử lý
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: 'var(--color-accent)' }}>
              <Clock size={20} />
            </div>
            <Sparkline points={[1, 2, 2, 3, 3, 2, totalJobs || 1]} color="#3b82f6" />
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tiến độ bình quân</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {completionPercentage}%
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> {completedShiftsCount} ca hoàn thành
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#10b981' }}>
              <CheckCircle2 size={20} />
            </div>
            <Sparkline points={[60, 75, 70, 85, 90, 92, completionPercentage || 1]} color="#10b981" />
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Cảnh báo rủi ro</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: failedTasks > 0 ? '#ef4444' : 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {failedTasks}
            </h3>
            <span style={{ color: failedTasks > 0 ? '#ef4444' : '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              {failedTasks > 0 ? <AlertTriangle size={12} /> : <Check size={12} />} {failedTasks > 0 ? 'Phát hiện sự cố' : 'Hệ thống an toàn'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: failedTasks > 0 ? '#ef4444' : '#10b981' }}>
              <AlertTriangle size={20} />
            </div>
            <Sparkline points={[0, 0, 0, 0, 0, 0, failedTasks]} color={failedTasks > 0 ? '#ef4444' : '#10b981'} />
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Tác vụ hoàn thành</span>
            <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 6px 0' }}>
              {completedTasks}/{totalTasks}
            </h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
              <ArrowUpRight size={12} /> {totalTasks - completedTasks} tác vụ còn lại
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ color: '#a855f7' }}>
              <Activity size={20} />
            </div>
            <Sparkline points={[96, 97, 96, 98, 98, 99, totalTasks ? (completedTasks / totalTasks) * 100 : 0]} color="#a855f7" />
          </div>
        </div>

      </div>
    </>
  );
};
