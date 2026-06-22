import React from 'react';
import { GripVertical, ShieldAlert } from 'lucide-react';

export const HealthChecksWidget: React.FC = () => {
  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', margin: 0, paddingRight: '24px' }}>
        <ShieldAlert size={16} color="#10b981" /> Kết nối và tích hợp
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>MongoDB Core</span>
          <span style={{ color: '#10b981', fontWeight: 700 }}>KẾT NỐI</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Socket Gateway</span>
          <span style={{ color: '#10b981', fontWeight: 700 }}>ĐỒNG BỘ</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Microsoft 365 SSO</span>
          <span style={{ color: '#10b981', fontWeight: 700 }}>SẴN SÀNG</span>
        </div>
      </div>
    </div>
  );
};
