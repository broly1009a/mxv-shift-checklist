'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import {
  Layers,
  GripVertical
} from 'lucide-react';
import { Template, ShiftLog } from './types';
import { InitShiftWidget } from './components/InitShiftWidget';
import { AutoShiftWidget } from './components/AutoShiftWidget';
import { HourlyChartWidget } from './components/HourlyChartWidget';
import { ActiveShiftsWidget } from './components/ActiveShiftsWidget';
import { RecentShiftsWidget } from './components/RecentShiftsWidget';
import { TemplatesSummaryWidget } from './components/TemplatesSummaryWidget';
import { HealthChecksWidget } from './components/HealthChecksWidget';
import { PerformanceOverview } from './components/PerformanceOverview';

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

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case 'chart':
        return <HourlyChartWidget showChart={showChart} />;

      case 'activeShifts':
        return <ActiveShiftsWidget loading={loading} activeShifts={activeShifts} />;

      case 'history':
        return <RecentShiftsWidget showAuditLogs={showAuditLogs} recentShifts={recentShifts} />;

      case 'initShift':
        return (
          <InitShiftWidget
            templates={templates}
            selectedTemplate={selectedTemplate}
            setSelectedTemplate={setSelectedTemplate}
            initError={initError}
            initSuccess={initSuccess}
            handleInitializeShift={handleInitializeShift}
          />
        );

      case 'autoShift':
        return (
          <AutoShiftWidget
            jobDate={jobDate}
            setJobDate={setJobDate}
            jobRunning={jobRunning}
            jobSuccess={jobSuccess}
            jobError={jobError}
            handleTriggerJob={handleTriggerJob}
          />
        );

      case 'templatesSummary':
        return <TemplatesSummaryWidget templates={templates} />;

      case 'healthChecks':
        return <HealthChecksWidget />;

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

  const renderWidgetsList = (widgets: string[], col: 'left' | 'right') => {
    const list: React.ReactNode[] = [];
    let skipNext = false;

    for (let i = 0; i < widgets.length; i++) {
      if (skipNext) {
        skipNext = false;
        continue;
      }

      const current = widgets[i];
      const next = widgets[i + 1];

      const isCurrentInit = current === 'initShift';
      const isNextAuto = next === 'autoShift';
      const isCurrentAuto = current === 'autoShift';
      const isNextInit = next === 'initShift';

      if ((isCurrentInit && isNextAuto) || (isCurrentAuto && isNextInit)) {
        const renderedCurrent = renderDraggableWidget(current, col);
        const renderedNext = renderDraggableWidget(next, col);

        if (renderedCurrent && renderedNext) {
          list.push(
            <div key={`${current}-${next}`} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px'
            }}>
              {renderedCurrent}
              {renderedNext}
            </div>
          );
          skipNext = true;
          continue;
        }
      }

      const rendered = renderDraggableWidget(current, col);
      if (rendered) {
        list.push(rendered);
      }
    }
    return list;
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

        <PerformanceOverview
          averageProgress={averageProgress}
          activeShiftsCount={activeShifts.length}
          completedShiftsCount={recentShifts.filter((s) => s.status === 'COMPLETED').length}
        />

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
            {renderWidgetsList(leftWidgets, 'left')}
          </div>

          {/* Right Column */}
          <div
            onDragOver={handleColumnDragOver}
            onDrop={(e) => handleColumnDrop(e, 'right')}
            style={{ display: 'flex', flexDirection: 'column', gap: '28px', minHeight: '200px' }}
          >
            {renderWidgetsList(rightWidgets, 'right')}
          </div>

        </div>

      </div>
    </ProtectedRoute>
  );
}
