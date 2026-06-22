import React from 'react';
import Link from 'next/link';
import { GripVertical, Clock, AlertTriangle, ArrowRight } from 'lucide-react';
import { ShiftLog } from '../types';

interface ActiveShiftsWidgetProps {
  loading: boolean;
  activeShifts: ShiftLog[];
}

const getSessionBadge = (type: string) => {
  switch (type) {
    case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
    case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
    default: return <span className="badge badge-high">Đóng Cửa</span>;
  }
};

export const ActiveShiftsWidget: React.FC<ActiveShiftsWidgetProps> = ({ loading, activeShifts }) => {
  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingRight: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Clock size={18} color="var(--color-accent)" /> Ca trực hiện tại hôm nay
        </h3>
        <span className="badge badge-medium">Hôm nay</span>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '30px 0' }}>Đang tải ca trực...</div>
      ) : activeShifts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
          <AlertTriangle size={28} color="var(--color-high)" style={{ marginBottom: '10px' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>Chưa có ca trực nào được khởi tạo hôm nay</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', margin: '4px 0 0 0' }}>
            Hãy chọn một mẫu bên cạnh để khởi tạo ca trực mới.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeShifts.map((shift) => (
            <div key={shift._id} className="glass-panel" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.015)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>{shift.templateId?.title || 'Không rõ mẫu'}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {getSessionBadge(shift.templateId?.sessionType || 'OPEN')}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bởi {shift.userId?.fullName || 'Hệ thống'}</span>
                  </div>
                </div>
                <Link href={`/checklist?id=${shift._id}`} style={{ textDecoration: 'none' }}>
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.78rem' }}>
                    Mở Checklist <ArrowRight size={12} />
                  </button>
                </Link>
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Tiến độ hoàn thành</span>
                  <span style={{ fontWeight: 700, color: shift.progressPercentage === 100 ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                    {shift.progressPercentage}%
                  </span>
                </div>
                <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${shift.progressPercentage}%`,
                    height: '100%',
                    background: shift.progressPercentage === 100 ? 'var(--color-primary)' : 'var(--color-accent)',
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }}></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
