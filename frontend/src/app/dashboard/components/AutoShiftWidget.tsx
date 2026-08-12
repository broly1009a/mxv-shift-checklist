import React from 'react';
import { Calendar, Activity, GripVertical } from 'lucide-react';
import CustomDatePicker from '@/components/ui/CustomDatePicker';

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
        <CustomDatePicker
          label="Chọn ngày cần chạy job"
          value={jobDate}
          onChange={setJobDate}
          minWidth="100%"
          fontSize="0.85rem"
          disabled={jobRunning}
        />

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
