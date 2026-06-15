'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ListChecks
} from 'lucide-react';
import Link from 'next/link';

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
  templateId: {
    _id: string;
    title: string;
    sessionType: 'OPEN' | 'DURING' | 'CLOSE';
    departmentId?: {
      _id: string;
      name: string;
      code: string;
    };
  };
  userId: {
    _id: string;
    fullName: string;
    username: string;
  };
}

export default function DashboardPage() {
  const { user, token } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeShifts, setActiveShifts] = useState<ShiftLog[]>([]);
  const [recentShifts, setRecentShifts] = useState<ShiftLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [initError, setInitError] = useState('');
  const [initSuccess, setInitSuccess] = useState('');

  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    try {
      const deptIdFilter = user?.role === 'ADMIN' ? '' : `departmentId=${user?.department?.id || user?.department?._id || ''}`;

      // 1. Fetch templates (filtered by department for non-admins)
      const tplRes = await fetch(`${API_BASE_URL}/api/v1/templates${deptIdFilter ? `?${deptIdFilter}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const tplData = await tplRes.json();
      setTemplates(tplData);

      // 2. Fetch active shifts for the user's department (or all if ADMIN)
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

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Header Greeting */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Xin chào, {user?.fullName}!
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Phân hệ trực: <strong style={{ color: '#fff' }}>{user?.department?.name || 'ADMIN Portal'}</strong>. Theo dõi và quản lý checklist vận hành.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <Calendar size={18} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
              Hôm nay: {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="metrics-grid">
          <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--color-accent)' }}>
            <div className="title">Ca trực hoạt động hôm nay</div>
            <div className="value">{activeShifts.length}</div>
          </div>
          <div className="glass-panel metric-card" style={{ borderLeft: '4px solid var(--color-primary)' }}>
            <div className="title">Tiến độ trung bình ca trực</div>
            <div className="value">{averageProgress}%</div>
          </div>
          <div className="glass-panel metric-card" style={{ borderLeft: '4px solid #a855f7' }}>
            <div className="title">Mẫu checklist sẵn có</div>
            <div className="value">{templates.length}</div>
          </div>
        </div>

        {/* Mid Section Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
          {/* Active Shifts Checklist Area */}
          <div className="glass-panel" style={{ padding: '28px', minHeight: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={20} color="var(--color-accent)" /> Ca trực hiện tại hôm nay
              </h3>
              <span className="badge badge-medium">Hôm nay</span>
            </div>

            {loading ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Đang tải ca trực...</div>
            ) : activeShifts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', border: '1px dashed var(--border-color)', borderRadius: '12px' }}>
                <AlertTriangle size={32} color="var(--color-high)" style={{ marginBottom: '12px' }} />
                <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Chưa có ca trực nào được khởi tạo hôm nay</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Hãy chọn một mẫu bên cạnh để khởi tạo ca trực mới.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeShifts.map((shift) => (
                  <div key={shift._id} className="glass-panel" style={{ padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.015)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{shift.templateId.title}</h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {getSessionBadge(shift.templateId.sessionType)}
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bởi {shift.userId.fullName}</span>
                        </div>
                      </div>
                      <Link href={`/checklist?id=${shift._id}`} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.8rem' }}>
                        Mở Checklist <ArrowRight size={14} />
                      </Link>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        <span>Tiến độ hoàn thành</span>
                        <span style={{ fontWeight: 700, color: shift.progressPercentage === 100 ? 'var(--color-primary)' : 'var(--text-primary)' }}>
                          {shift.progressPercentage}%
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
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

          {/* Quick Actions & Seeding Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Initialize Shift Log Card */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Play size={20} color="var(--color-primary)" /> Khởi tạo ca trực mới
              </h3>

              {initError && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', color: '#ef4444', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {initError}
                </div>
              )}
              {initSuccess && (
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.85rem', marginBottom: '16px' }}>
                  {initSuccess}
                </div>
              )}

              <form onSubmit={handleInitializeShift} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Chọn mẫu checklist vận hành
                  </label>
                  <select
                    className="form-input"
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    style={{ background: 'var(--bg-app)', cursor: 'pointer' }}
                  >
                    <option value="">-- Chọn mẫu checklist --</option>
                    {templates.map((tpl) => (
                      <option key={tpl._id} value={tpl._id}>
                        [{tpl.sessionType === 'OPEN' ? 'Mở Cửa' : tpl.sessionType === 'DURING' ? 'Trong Phiên' : 'Đóng Cửa'}] {tpl.title}
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
                    <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{tpl.title}</p>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Phòng ban: <strong style={{ color: '#fff' }}>{tpl.departmentId?.name || 'Không xác định'}</strong></p>
                        </div>
                        {user?.role === 'ADMIN' && (
                          <Link href="/admin/templates" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', color: 'var(--color-accent)', textDecoration: 'none', background: 'rgba(59,130,246,0.1)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(59,130,246,0.2)' }}>
                            <Settings size={12} /> Chỉnh sửa mẫu
                          </Link>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px', color: sessionColor, fontWeight: 700, border: `1px solid ${sessionColor}33` }}>
                          {sessionLabel}
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.05)', padding: '3px 10px', borderRadius: '6px', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <ListChecks size={12} /> {taskCount} tác vụ
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '12px' }}>
                  <Play size={16} /> Bắt đầu ca trực
                </button>
              </form>
            </div>

            {/* All templates summary - dynamic */}
            <div className="glass-panel" style={{ padding: '28px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Layers size={18} color="#a855f7" /> Danh sách mẫu checklist
              </h3>
              {templates.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa có mẫu checklist nào.</p>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {templates.map((tpl, i) => (
                    <div key={tpl._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < templates.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: '8px' }}>
                      <span style={{ flex: 1, paddingRight: '8px' }}>{tpl.title}</span>
                      <span style={{ fontWeight: 600, color: '#fff', whiteSpace: 'nowrap' }}>{tpl.tasks?.length ?? '?'} tác vụ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History / Recent Completed Logs */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <FolderOpen size={20} color="var(--text-secondary)" /> Hoạt động ca trực gần đây
          </h3>
          {recentShifts.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>Chưa ghi nhận ca trực lịch sử nào</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px' }}>Ngày trực</th>
                    <th style={{ padding: '12px 16px' }}>Mẫu Checklist</th>
                    <th style={{ padding: '12px 16px' }}>Phiên trực</th>
                    <th style={{ padding: '12px 16px' }}>Người trực chính</th>
                    <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                    <th style={{ padding: '12px 16px' }}>Tiến độ</th>
                    <th style={{ padding: '12px 16px' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {recentShifts.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{log.shiftDate}</td>
                      <td style={{ padding: '14px 16px' }}>{log.templateId?.title}</td>
                      <td style={{ padding: '14px 16px' }}>{getSessionBadge(log.templateId?.sessionType || '')}</td>
                      <td style={{ padding: '14px 16px' }}>{log.userId?.fullName}</td>
                      <td style={{ padding: '14px 16px' }}>
                        {log.status === 'COMPLETED' ? (
                          <span style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <CheckCircle2 size={14} /> HOÀN THÀNH
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-accent)', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
                            <Clock size={14} /> ĐANG CHẠY
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 700 }}>{log.progressPercentage}%</td>
                      <td style={{ padding: '14px 16px' }}>
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
      </div>
    </ProtectedRoute>
  );
}
