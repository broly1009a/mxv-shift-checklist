import React from 'react';
import { GripVertical, Layers } from 'lucide-react';
import { Template } from '../types';

interface TemplatesSummaryWidgetProps {
  templates: Template[];
}

export const TemplatesSummaryWidget: React.FC<TemplatesSummaryWidgetProps> = ({ templates }) => {
  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', margin: 0, paddingRight: '24px' }}>
        <Layers size={16} color="#a855f7" /> Danh sách mẫu checklist
      </h3>
      {templates.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Chưa có mẫu checklist nào.</p>
      ) : (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {templates.map((tpl, i) => (
            <div key={tpl._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < templates.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: '6px' }}>
              <span style={{ flex: 1, paddingRight: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.title}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{tpl.tasks?.length ?? 0} tác vụ</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
