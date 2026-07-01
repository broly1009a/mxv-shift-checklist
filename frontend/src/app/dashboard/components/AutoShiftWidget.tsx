import React from 'react';
import { Calendar, Activity, GripVertical } from 'lucide-react';

interface AutoShiftWidgetProps {
  jobDate: string;
  setJobDate: (val: string) => void;
  jobRunning: boolean;
  handleTriggerJob: () => void;
}

export const AutoShiftWidget: React.FC<AutoShiftWidgetProps> = ({
  jobDate,
  setJobDate,
  jobRunning,
  handleTriggerJob,
}) => {
  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
        <Calendar size={18} color="var(--color-primary)" /> Sinh ca trực tự động
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Chọn ngày cần chạy job
          </label>
          <input
            type="date"
            className="form-input"
            value={jobDate}
            onChange={(e) => setJobDate(e.target.value)}
            style={{ background: 'var(--bg-app)', cursor: 'pointer', height: '38px', padding: '0 12px', fontSize: '0.85rem' }}
            disabled={jobRunning}
          />
        </div>

        <button
          type="button"
          onClick={handleTriggerJob}
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem', gap: '8px' }}
          disabled={jobRunning}
        >
          <Activity size={14} />
          {jobRunning ? 'Đang khởi tạo ca trực...' : 'Kích hoạt khởi tạo'}
        </button>
      </div>
    </div>
  );
};
