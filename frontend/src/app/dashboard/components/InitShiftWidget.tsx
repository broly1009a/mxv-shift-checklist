import React, { useMemo } from 'react';
import { Play, ListChecks, GripVertical } from 'lucide-react';
import { Template } from '../types';
import CustomSelect from '@/components/ui/CustomSelect';

interface InitShiftWidgetProps {
  templates: Template[];
  selectedTemplate: string;
  setSelectedTemplate: (val: string) => void;
  handleInitializeShift: (e: React.FormEvent) => void;
  isInitializing: boolean;
}

export const InitShiftWidget: React.FC<InitShiftWidgetProps> = ({
  templates,
  selectedTemplate,
  setSelectedTemplate,
  handleInitializeShift,
  isInitializing,
}) => {
  const activeTemplates = useMemo(() => {
    return templates.filter((tpl) => tpl.isActive !== false);
  }, [templates]);

  const templateOptions = useMemo(() => {
    return activeTemplates.map((tpl) => {
      const sessionText =
        tpl.sessionType === 'OPEN'
          ? 'Mở'
          : tpl.sessionType === 'DURING'
          ? 'Trong'
          : 'Đóng';
      return {
        value: tpl._id,
        label: `[${sessionText}] ${tpl.title}`,
      };
    });
  }, [activeTemplates]);

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
        <Play size={18} color="var(--color-primary)" /> Khởi tạo ca trực mới
      </h3>

      <form onSubmit={handleInitializeShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ width: '100%' }}>
          <CustomSelect
            label="Chọn mẫu checklist vận hành"
            options={templateOptions}
            selectedValue={selectedTemplate}
            onChange={setSelectedTemplate}
            clearable={false}
            flex="none"
            minWidth="0"
            fontSize="0.85rem"
          />
        </div>

        {/* Template Preview Card */}
        {(() => {
          const tpl = templates.find((t) => t._id === selectedTemplate);
          if (!tpl) return null;
          const sessionLabel = tpl.sessionType === 'OPEN' ? 'Mở Cửa' : tpl.sessionType === 'DURING' ? 'Trong Phiên' : 'Đóng Cửa';
          const sessionColor = tpl.sessionType === 'OPEN' ? 'var(--color-low)' : tpl.sessionType === 'DURING' ? 'var(--color-medium)' : 'var(--color-high)';
          const taskCount = tpl.tasks?.length ?? '...';
          return (
            <div className="glass-panel" style={{ background: 'rgba(59, 130, 246, 0.04)', border: '1px solid rgba(59, 130, 246, 0.12)', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <p style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px 0' }}>{tpl.title}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Phòng ban: <strong style={{ color: 'var(--text-primary)' }}>{tpl.departmentId?.name || 'Không xác định'}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: sessionColor, fontWeight: 700, border: `1px solid ${sessionColor}33` }}>
                  {sessionLabel}
                </span>
                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <ListChecks size={12} /> {taskCount} tác vụ
                </span>
              </div>
            </div>
          );
        })()}

        <button
          type="submit"
          className="btn btn-success"
          disabled={isInitializing || !selectedTemplate}
          style={{
            width: '100%',
            padding: '10px 14px',
            fontSize: '0.85rem',
            opacity: isInitializing ? 0.7 : 1,
            cursor: isInitializing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {isInitializing ? (
            'Đang khởi tạo...'
          ) : (
            <>
              <Play size={14} /> Bắt đầu ca trực
            </>
          )}
        </button>
      </form>
    </div>
  );
};
