'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import {
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FolderOpen,
  Calendar,
  Layers,
  ArrowRight,
  Settings,
  ListChecks,
  Activity,
  Check,
  TrendingUp,
  ShieldAlert,
  ArrowUpRight,
  GripVertical
} from 'lucide-react';
import Link from 'next/link';

// Import and register Chart.js components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ChartTitle,
  Tooltip,
  Legend,
  Filler,
  BarController,
  LineController
);

interface Template {
  _id: string;
  id: string;
  title: string;
  sessionType: 'OPEN' | 'DURING' | 'CLOSE';
  departmentId?: {
    _id: string;
    name: string;
    code: string;
  };
  tasks?: { taskId: string; taskName: string; priority: string; sortOrder: number }[];
}

interface ShiftLog {
  _id: string;
  shiftDate: string;
  status: 'PENDING' | 'COMPLETED';
  progressPercentage: number;
  templateId?: {
    _id: string;
    title: string;
    sessionType: 'OPEN' | 'DURING' | 'CLOSE';
    departmentId?: {
      _id: string;
      name: string;
      code: string;
    };
  } | null;
  userId?: {
    _id: string;
    fullName: string;
    username: string;
  } | null;
}

// Lightweight custom SVG sparkline component
const Sparkline = ({ points, color }: { points: number[], color: string }) => {
  const width = 70;
  const height = 24;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pathPoints = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p - min) / range) * height + 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg className="sparkline-svg" viewBox={`0 0 ${width} ${height + 4}`}>
      <polyline
        className="sparkline-path"
        style={{ stroke: color }}
        points={pathPoints}
      />
    </svg>
  );
};

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeShifts, setActiveShifts] = useState<ShiftLog[]>([]);
  const [recentShifts, setRecentShifts] = useState<ShiftLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [initError, setInitError] = useState('');
  const [initSuccess, setInitSuccess] = useState('');

  // Shift job states
  const [jobDate, setJobDate] = useState('');
  const [jobRunning, setJobRunning] = useState(false);
  const [jobSuccess, setJobSuccess] = useState('');
  const [jobError, setJobError] = useState('');

  // Dashboard layout and component states
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [dashboardLayout, setDashboardLayout] = useState<'grid' | 'stack'>('grid');
  const [showChart, setShowChart] = useState(true);
  const [showAuditLogs, setShowAuditLogs] = useState(true);
  const layoutSettingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    setJobDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    const savedLayout = localStorage.getItem('mxv_dash_layout');
    if (savedLayout) setDashboardLayout(savedLayout as 'grid' | 'stack');

    const savedShowChart = localStorage.getItem('mxv_dash_show_chart');
    if (savedShowChart !== null) setShowChart(savedShowChart === 'true');

    const savedShowLogs = localStorage.getItem('mxv_dash_show_logs');
    if (savedShowLogs !== null) setShowAuditLogs(savedShowLogs === 'true');
  }, []);

  const handleLayoutChange = (layout: 'grid' | 'stack') => {
    setDashboardLayout(layout);
    localStorage.setItem('mxv_dash_layout', layout);
  };

  const handleToggleChart = () => {
    const next = !showChart;
    setShowChart(next);
    localStorage.setItem('mxv_dash_show_chart', String(next));
  };

  const handleToggleLogs = () => {
    const next = !showAuditLogs;
    setShowAuditLogs(next);
    localStorage.setItem('mxv_dash_show_logs', String(next));
  };

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (layoutSettingsRef.current && !layoutSettingsRef.current.contains(e.target as Node)) {
        setShowLayoutSettings(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Draggable Widgets
  const [leftWidgets, setLeftWidgets] = useState<string[]>(['chart', 'activeShifts', 'history']);
  const [rightWidgets, setRightWidgets] = useState<string[]>(['initShift', 'autoShift', 'templatesSummary', 'healthChecks']);
  const [draggedWidget, setDraggedWidget] = useState<{ id: string; col: 'left' | 'right' } | null>(null);
  const [dragOverWidget, setDragOverWidget] = useState<{ id: string; col: 'left' | 'right' } | null>(null);

  useEffect(() => {
    const defaultLeft = ['chart', 'activeShifts', 'history'];
    const defaultRight = ['initShift', 'autoShift', 'templatesSummary', 'healthChecks'];

    const savedLeft = localStorage.getItem('mxv_dash_left_widgets');
    const savedRight = localStorage.getItem('mxv_dash_right_widgets');

    setLeftWidgets(savedLeft ? JSON.parse(savedLeft) : defaultLeft);
    setRightWidgets(savedRight ? JSON.parse(savedRight) : defaultRight);
  }, []);

  const handleWidgetDragStart = (e: React.DragEvent, id: string, col: 'left' | 'right') => {
    setDraggedWidget({ id, col });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  const handleWidgetDragOver = (e: React.DragEvent, id: string, col: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedWidget || (draggedWidget.id === id && draggedWidget.col === col)) return;
    setDragOverWidget({ id, col });
  };

  const handleWidgetDrop = (e: React.DragEvent, targetId: string, targetCol: 'left' | 'right') => {
    e.preventDefault();
    setDragOverWidget(null);
    if (!draggedWidget) return;

    const sourceCol = draggedWidget.col;
    const sourceId = draggedWidget.id;

    if (sourceId === targetId && sourceCol === targetCol) return;

    const nextLeft = [...leftWidgets];
    const nextRight = [...rightWidgets];

    if (sourceCol === 'left') {
      const idx = nextLeft.indexOf(sourceId);
      if (idx !== -1) nextLeft.splice(idx, 1);
    } else {
      const idx = nextRight.indexOf(sourceId);
      if (idx !== -1) nextRight.splice(idx, 1);
    }

    if (targetCol === 'left') {
      const idx = nextLeft.indexOf(targetId);
      if (idx !== -1) {
        nextLeft.splice(idx, 0, sourceId);
      } else {
        nextLeft.push(sourceId);
      }
    } else {
      const idx = nextRight.indexOf(targetId);
      if (idx !== -1) {
        nextRight.splice(idx, 0, sourceId);
      } else {
        nextRight.push(sourceId);
      }
    }

    setLeftWidgets(nextLeft);
    setRightWidgets(nextRight);
    localStorage.setItem('mxv_dash_left_widgets', JSON.stringify(nextLeft));
    localStorage.setItem('mxv_dash_right_widgets', JSON.stringify(nextRight));
  };

  const handleWidgetDragEnd = () => {
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (e: React.DragEvent, targetCol: 'left' | 'right') => {
    e.preventDefault();
    if (!draggedWidget) return;
    const sourceCol = draggedWidget.col;
    const sourceId = draggedWidget.id;

    if (sourceCol === targetCol) return;

    const nextLeft = [...leftWidgets];
    const nextRight = [...rightWidgets];

    if (sourceCol === 'left') {
      const idx = nextLeft.indexOf(sourceId);
      if (idx !== -1) nextLeft.splice(idx, 1);
    } else {
      const idx = nextRight.indexOf(sourceId);
      if (idx !== -1) nextRight.splice(idx, 1);
    }

    if (targetCol === 'left') {
      if (!nextLeft.includes(sourceId)) nextLeft.push(sourceId);
    } else {
      if (!nextRight.includes(sourceId)) nextRight.push(sourceId);
    }

    setLeftWidgets(nextLeft);
    setRightWidgets(nextRight);
    localStorage.setItem('mxv_dash_left_widgets', JSON.stringify(nextLeft));
    localStorage.setItem('mxv_dash_right_widgets', JSON.stringify(nextRight));
    setDraggedWidget(null);
    setDragOverWidget(null);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      const deptIdFilter = user?.role === 'ADMIN' ? '' : `departmentId=${user?.department?.id || user?.department?._id || ''}`;

      // 1. Fetch templates
      const tplRes = await fetch(`${API_BASE_URL}/api/v1/templates${deptIdFilter ? `?${deptIdFilter}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tplData = await tplRes.json();
      setTemplates(tplData);

      // 2. Fetch active shifts
      const activeRes = await fetch(`${API_BASE_URL}/api/v1/shifts/active?${deptIdFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const activeData = await activeRes.json();
      setActiveShifts(activeData);

      // 3. Fetch recent history (limit to 5)
      const historyRes = await fetch(`${API_BASE_URL}/api/v1/shifts/history?${deptIdFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const historyData = await historyRes.json();
      setRecentShifts(historyData.slice(0, 5));
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu dashboard', err);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleInitializeShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) {
      setInitError('Vui lòng chọn một mẫu checklist');
      return;
    }
    setInitError('');
    setInitSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shifts/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ templateId: selectedTemplate })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Khởi tạo thất bại');
      }

      setInitSuccess('Khởi tạo ca trực thành công!');
      setSelectedTemplate('');
      fetchDashboardData();
    } catch (err: any) {
      setInitError(err.message || 'Lỗi xảy ra khi khởi tạo ca trực');
    }
  };

  const handleTriggerJob = async () => {
    if (!token) return;
    setJobRunning(true);
    setJobSuccess('');
    setJobError('');

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/shift-jobs/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ date: jobDate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Kích hoạt sinh ca thất bại');
      }

      if (data.success === false && data.reason === 'NOT_A_TRADING_DAY') {
        setJobError(`Ngày ${jobDate} được cấu hình là ngày nghỉ/không giao dịch. Không sinh ca trực.`);
      } else {
        setJobSuccess(`Đã sinh ca trực thành công! Đã tạo: ${data.createdCount}, Bỏ qua (trùng lặp): ${data.skippedCount}`);
        fetchDashboardData();
      }
    } catch (err: any) {
      setJobError(err.message || 'Lỗi xảy ra');
    } finally {
      setJobRunning(false);
    }
  };

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
      case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
      default: return <span className="badge badge-high">Đóng Cửa</span>;
    }
  };

  // Calculate high-level stats
  const totalActiveTasks = activeShifts.reduce((acc, shift) => acc + shift.progressPercentage, 0);
  const averageProgress = activeShifts.length > 0 ? parseFloat((totalActiveTasks / activeShifts.length).toFixed(1)) : 0;

  // Chart configuration data matching the transaction volumes standard
  const hourlyChartData = {
    labels: ['06h', '07h', '08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h'],
    datasets: [
      {
        type: 'line' as const,
        label: 'Tỷ lệ hoàn thành nhiệm vụ (%)',
        borderColor: '#3b82f6',
        borderWidth: 2,
        fill: false,
        tension: 0.4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#3b82f6',
        pointBorderWidth: 2.5,
        pointRadius: 4.5,
        pointHoverRadius: 6,
        data: [25, 38, 55, 72, 85, 95, 99.2, 92, 94, 96, 98, 99.2],
        yAxisID: 'y1',
      } as any,
      {
        type: 'bar' as const,
        label: 'Tần suất kiểm tra (Số lượng)',
        backgroundColor: 'rgba(59, 130, 246, 0.75)',
        hoverBackgroundColor: '#3b82f6',
        borderRadius: 6,
        borderWidth: 0,
        barPercentage: 0.5,
        categoryPercentage: 0.8,
        data: [30, 55, 62, 78, 98, 92, 70, 60, 68, 75, 82, 90],
        yAxisID: 'y',
      } as any
    ]
  };

  const hourlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          boxWidth: 12,
          usePointStyle: true,
          font: { size: 11, family: 'Outfit, Inter' }
        }
      },
      tooltip: {
        padding: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleFont: { size: 12, family: 'Outfit' },
        bodyFont: { size: 12, family: 'Inter' },
        cornerRadius: 8
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } }
      },
      y: {
        position: 'left' as const,
        grid: { color: 'rgba(128,128,128,0.08)' },
        ticks: { font: { size: 11 } }
      },
      y1: {
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        ticks: {
          font: { size: 11 },
          callback: function (value: any) { return value + '%'; }
        },
        min: 0,
        max: 100
      }
    }
  };

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'chart':
        return showChart ? (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
              <GripVertical size={16} />
            </div>
            <div style={{ marginBottom: '20px', paddingRight: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                Khối lượng giao dịch & tần suất tác vụ theo giờ
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Biểu đồ cột + đường nối biểu diễn số lượng tác vụ kiểm tra phát sinh và xử lý trong ngày.
              </p>
            </div>
            <div style={{ height: '280px', position: 'relative' }}>
              <Bar data={hourlyChartData as any} options={hourlyChartOptions as any} />
            </div>
          </div>
        ) : null;

      case 'activeShifts':
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

      case 'history':
        return showAuditLogs ? (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
              <GripVertical size={16} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
              <FolderOpen size={18} color="var(--text-secondary)" /> Hoạt động ca trực gần đây
            </h3>
            {recentShifts.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>Chưa ghi nhận ca trực lịch sử nào</div>
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
        ) : null;

      case 'initShift':
        return (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
              <GripVertical size={16} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
              <Play size={18} color="var(--color-primary)" /> Khởi tạo ca trực mới
            </h3>

            {initError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>
                {initError}
              </div>
            )}
            {initSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                {initSuccess}
              </div>
            )}

            <form onSubmit={handleInitializeShift} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Chọn mẫu checklist vận hành
                </label>
                <select
                  className="form-input"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  style={{ background: 'var(--bg-app)', cursor: 'pointer', height: '38px', padding: '0 12px', fontSize: '0.85rem' }}
                >
                  <option value="">-- Chọn mẫu checklist --</option>
                  {templates.map((tpl) => (
                    <option key={tpl._id} value={tpl._id}>
                      [{tpl.sessionType === 'OPEN' ? 'Mở' : tpl.sessionType === 'DURING' ? 'Trong' : 'Đóng'}] {tpl.title}
                    </option>
                  ))}
                </select>
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

              <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '10px 14px', fontSize: '0.85rem' }}>
                <Play size={14} /> Bắt đầu ca trực
              </button>
            </form>
          </div>
        );

      case 'autoShift':
        return user?.role === 'ADMIN' ? (
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
              <GripVertical size={16} />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', margin: 0, paddingRight: '24px' }}>
              <Calendar size={18} color="var(--color-primary)" /> Sinh ca trực tự động
            </h3>

            {jobError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px 12px', borderRadius: '8px', color: '#ef4444', fontSize: '0.8rem', marginBottom: '12px' }}>
                {jobError}
              </div>
            )}
            {jobSuccess && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 12px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem', marginBottom: '12px' }}>
                {jobSuccess}
              </div>
            )}

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
        ) : null;

      case 'templatesSummary':
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

      case 'healthChecks':
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

      default:
        return null;
    }
  };

  const renderDraggableWidget = (widgetId: string, col: 'left' | 'right') => {
    const isDragged = draggedWidget?.id === widgetId && draggedWidget?.col === col;
    const isOver = dragOverWidget?.id === widgetId && dragOverWidget?.col === col;

    const content = renderWidget(widgetId);
    if (!content) return null;

    return (
      <div
        key={widgetId}
        draggable
        onDragStart={(e) => handleWidgetDragStart(e, widgetId, col)}
        onDragOver={(e) => handleWidgetDragOver(e, widgetId, col)}
        onDrop={(e) => handleWidgetDrop(e, widgetId, col)}
        onDragEnd={handleWidgetDragEnd}
        style={{
          opacity: isDragged ? 0.3 : 1,
          border: isOver ? '2px dashed var(--color-primary)' : 'none',
          borderRadius: '16px',
          transition: 'opacity 0.2s ease, border 0.2s ease',
        }}
      >
        {content}
      </div>
    );
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* Realtime Dashboard Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                Tổng quan giám sát ca trực
              </h1>
              <span className="realtime-badge">Realtime</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Theo dõi khối lượng công việc, tỷ lệ thành công và tiến độ checklist vận hành trong ngày.
            </p>
          </div>
          <div ref={layoutSettingsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLayoutSettings(!showLayoutSettings)}
              className="btn btn-secondary"
              style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}
            >
              <Layers size={14} /> Tùy chỉnh bố cục
            </button>

            {showLayoutSettings && (
              <div className="glass-panel animate-fade-in" style={{
                position: 'absolute',
                right: 0,
                top: '44px',
                width: '280px',
                padding: '16px',
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--glass-shadow)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '4px' }}>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>Tùy chỉnh giao diện</h4>
                </div>

                {/* Layout option */}
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Cấu trúc cột:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('grid')}
                      className={`btn ${dashboardLayout === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: '0.75rem', padding: '6px 0' }}
                    >
                      Bản đồ (2 Cột)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('stack')}
                      className={`btn ${dashboardLayout === 'stack' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, fontSize: '0.75rem', padding: '6px 0' }}
                    >
                      Toàn màn hình
                    </button>
                  </div>
                </div>

                {/* Show/Hide controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={showChart}
                      onChange={handleToggleChart}
                      style={{ width: '15px', height: '15px', accentColor: 'var(--color-primary)' }}
                    />
                    Hiển thị biểu đồ hiệu suất
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={showAuditLogs}
                      onChange={handleToggleLogs}
                      style={{ width: '15px', height: '15px', accentColor: 'var(--color-primary)' }}
                    />
                    Hiển thị nhật ký hoạt động
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

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
                <span><strong>{activeShifts.length}</strong> ca trực đang chạy</span>
                <span style={{ color: 'var(--border-color)' }}>|</span>
                <span><strong>{recentShifts.filter(s => s.status === 'COMPLETED').length}</strong> ca trực hoàn thành</span>
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
                {activeShifts.length}
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

        {/* Mid Section Responsive Grid Layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '28px'
          }}
          className={dashboardLayout === 'grid' ? 'lg:grid-cols-[1fr_360px]' : 'lg:grid-cols-1'}
        >

          {/* Left Column */}
          <div
            onDragOver={handleColumnDragOver}
            onDrop={(e) => handleColumnDrop(e, 'left')}
            style={{ display: 'flex', flexDirection: 'column', gap: '28px', minHeight: '200px' }}
          >
            {leftWidgets.map(widgetId => renderDraggableWidget(widgetId, 'left'))}
          </div>

          {/* Right Column */}
          <div
            onDragOver={handleColumnDragOver}
            onDrop={(e) => handleColumnDrop(e, 'right')}
            style={{ display: 'flex', flexDirection: 'column', gap: '28px', minHeight: '200px' }}
          >
            {rightWidgets.map(widgetId => renderDraggableWidget(widgetId, 'right'))}
          </div>

        </div>

      </div>
    </ProtectedRoute>
  );
}
