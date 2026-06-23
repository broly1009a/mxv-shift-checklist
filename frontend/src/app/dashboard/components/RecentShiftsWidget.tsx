import React from 'react';
import Link from 'next/link';
import { GripVertical, FolderOpen, CheckCircle2, Clock } from 'lucide-react';
import { ShiftLog } from '../types';

interface RecentShiftsWidgetProps {
  showAuditLogs: boolean;
  recentShifts: ShiftLog[];
  dateStr?: string;
}

const getSessionBadge = (type: string) => {
  switch (type) {
    case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
    case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
    default: return <span className="badge badge-high">Đóng Cửa</span>;
  }
};

export const RecentShiftsWidget: React.FC<RecentShiftsWidgetProps> = ({ showAuditLogs, recentShifts, dateStr }) => {
  if (!showAuditLogs) return null;

  const formatDate = (ds?: string) => {
    if (!ds) return 'gần đây';
    const parts = ds.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return ds;
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
        <FolderOpen size={18} color="var(--text-secondary)" /> Hoạt động ca trực ngày {formatDate(dateStr)}
      </h3>
      {recentShifts.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Chưa ghi nhận ca trực hoàn thành nào ngày {formatDate(dateStr)}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Ngày trực</th>
                <th style={{ padding: '10px 12px' }}>Mẫu Checklist</th>
                <th style={{ padding: '10px 12px' }}>Phiên trực</th>
                <th style={{ padding: '10px 12px' }}>Người trực chính</th>
                <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                <th style={{ padding: '10px 12px' }}>Tiến độ</th>
                <th style={{ padding: '10px 12px' }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {recentShifts.map((log) => (
                <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                  <td style={{ padding: '12px 12px', fontWeight: 600 }}>{log.shiftDate}</td>
                  <td style={{ padding: '12px 12px' }}>{log.templateId?.title || 'Không rõ mẫu'}</td>
                  <td style={{ padding: '12px 12px' }}>{getSessionBadge(log.templateId?.sessionType || 'OPEN')}</td>
                  <td style={{ padding: '12px 12px' }}>{log.userId?.fullName || 'Hệ thống'}</td>
                  <td style={{ padding: '12px 12px' }}>
                    {log.status === 'COMPLETED' ? (
                      <span style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <CheckCircle2 size={12} /> HOÀN THÀNH
                      </span>
                    ) : (
                      <span style={{ color: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                        <Clock size={12} /> ĐANG CHẠY
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 12px', fontWeight: 700 }}>{log.progressPercentage}%</td>
                  <td style={{ padding: '12px 12px' }}>
                    <Link href={`/checklist?id=${log._id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}>
                      Xem
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
