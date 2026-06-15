'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Search, 
  Calendar, 
  SlidersHorizontal, 
  CheckCircle2, 
  Clock, 
  User as UserIcon, 
  Eye, 
  X,
  FileText
} from 'lucide-react';
import Link from 'next/link';

interface Department {
  _id: string;
  name: string;
  code: string;
}

interface TaskDetail {
  taskId: string;
  taskNameSnapshot: string;
  prioritySnapshot: string;
  isChecked: boolean;
  checkedAt?: string;
  updatedBy?: {
    fullName: string;
    username: string;
  };
  note?: string;
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
  details: TaskDetail[];
  createdAt: string;
  closedBy?: {
    _id: string;
    fullName: string;
    username: string;
  };
  closedAt?: string;
  handoverNote?: string;
}

function HistoryAudit() {
  const { user, token } = useAuth();
  
  // Filters
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Results
  const [logs, setLogs] = useState<ShiftLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail Modal
  const [activeDetail, setActiveDetail] = useState<ShiftLog | null>(null);

  const fetchFilters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/v1/shifts/history?`;
      if (selectedDept) url += `departmentId=${selectedDept}&`;
      if (selectedStatus) url += `status=${selectedStatus}&`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDept, selectedStatus, startDate, endDate]);

  useEffect(() => {
    fetchFilters();
    fetchLogs();
  }, [fetchFilters, fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs();
  };

  const getSessionBadge = (type: string) => {
    switch (type) {
      case 'OPEN': return <span className="badge badge-low">Mở Cửa</span>;
      case 'DURING': return <span className="badge badge-medium">Trong Phiên</span>;
      default: return <span className="badge badge-high">Đóng Cửa</span>;
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'LOW': return <span className="badge badge-low" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Thấp</span>;
      case 'MEDIUM': return <span className="badge badge-medium" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Trung Bình</span>;
      case 'HIGH': return <span className="badge badge-high" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Cao</span>;
      default: return <span className="badge badge-critical" style={{ padding: '2px 6px', fontSize: '0.7rem' }}>Khẩn Cấp</span>;
    }
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: '4px' }}>
            Lịch Sử Ca Trực & Đối Chiếu
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tra cứu toàn bộ lịch sử trực nhật, ghi chú nghiệp vụ và chữ ký số hóa của cán bộ các phòng ban Sở Giao Dịch Hàng Hóa Việt Nam.
          </p>
        </div>

        {/* Filters Form Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <SlidersHorizontal size={18} color="var(--color-accent)" /> Bộ lọc tìm kiếm ca trực
          </h3>

          <form onSubmit={handleSearch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Phòng Ban</label>
              <select className="form-input" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)} style={{ background: 'var(--bg-app)' }}>
                <option value="">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Trạng Thái</label>
              <select className="form-input" value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ background: 'var(--bg-app)' }}>
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">ĐANG TRỰC</option>
                <option value="COMPLETED">HOÀN THÀNH</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Từ Ngày</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ background: 'var(--bg-app)' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Đến Ngày</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ background: 'var(--bg-app)' }} />
            </div>

            <div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px' }}>
                <Search size={16} /> Lọc kết quả
              </button>
            </div>
          </form>
        </div>

        {/* Results Table */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Đang tải lịch sử...</div>
          ) : logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Không tìm thấy ca trực nào phù hợp với bộ lọc.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px 16px' }}>Ngày trực</th>
                    <th style={{ padding: '12px 16px' }}>Phân hệ phòng ban</th>
                    <th style={{ padding: '12px 16px' }}>Tên Checklist</th>
                    <th style={{ padding: '12px 16px' }}>Phiên trực</th>
                    <th style={{ padding: '12px 16px' }}>Người trực</th>
                    <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                    <th style={{ padding: '12px 16px' }}>Tiến độ</th>
                    <th style={{ padding: '12px 16px' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 600 }}>{log.shiftDate}</td>
                      <td style={{ padding: '14px 16px' }}>{log.templateId?.departmentId?.name || 'ADMIN'}</td>
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
                      <td style={{ padding: '14px 16px', display: 'flex', gap: '10px' }}>
                        <button 
                          onClick={() => setActiveDetail(log)}
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                        {log.status === 'PENDING' && (
                          <Link href={`/checklist?id=${log._id}`} className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                            Mở
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Audit Details Modal Overlay */}
        {activeDetail && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div className="glass-panel animate-fade-in" style={{
              width: '100%',
              maxWidth: '800px',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#0d1326',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '32px'
            }}>
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginBottom: '6px' }}>
                    {activeDetail.templateId?.title}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span>Ngày: <strong>{activeDetail.shiftDate}</strong></span>
                    <span>•</span>
                    <span>Cán bộ trực chính: <strong>{activeDetail.userId?.fullName}</strong></span>
                    <span>•</span>
                    <span>Tiến độ: <strong>{activeDetail.progressPercentage}%</strong></span>
                    {activeDetail.status === 'COMPLETED' && activeDetail.closedBy && (
                      <>
                        <span>•</span>
                        <span>Người chốt: <strong style={{ color: 'var(--color-primary)' }}>{activeDetail.closedBy.fullName}</strong></span>
                      </>
                    )}
                    {activeDetail.status === 'COMPLETED' && activeDetail.closedAt && (
                      <>
                        <span>•</span>
                        <span>Giờ chốt: <strong style={{ color: 'var(--color-primary)' }}>{new Date(activeDetail.closedAt).toLocaleTimeString('vi-VN')} {new Date(activeDetail.closedAt).toLocaleDateString('vi-VN')}</strong></span>
                      </>
                    )}
                  </div>
                  {activeDetail.status === 'COMPLETED' && activeDetail.handoverNote && (
                    <div style={{ marginTop: '12px', padding: '10px 12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', borderLeft: '3px solid var(--color-primary)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '2px', fontWeight: 700, textTransform: 'uppercase' }}>Biên bản bàn giao ca trực:</span>
                      <p style={{ margin: 0, color: '#fff', fontSize: '0.85rem', fontStyle: 'italic' }}>"{activeDetail.handoverNote}"</p>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setActiveDetail(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Tasks details list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                {activeDetail.details?.map((task, idx) => (
                  <div key={task.taskId} style={{
                    padding: '16px',
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.015)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <span style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        background: task.isChecked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${task.isChecked ? 'var(--color-primary)' : 'var(--border-color)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-primary)',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        marginTop: '2px'
                      }}>
                        {task.isChecked && '✓'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>
                          {idx + 1}. {task.taskNameSnapshot}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                          {getPriorityBadge(task.prioritySnapshot)}
                          {task.isChecked && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} /> Đã kiểm lúc: {task.checkedAt ? new Date(task.checkedAt).toLocaleTimeString('vi-VN') : ''}
                            </span>
                          )}
                          {task.isChecked && task.updatedBy && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <UserIcon size={12} /> Người xác nhận: {task.updatedBy.fullName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Note row */}
                    {task.note && (
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)',
                        borderLeft: '3px solid var(--color-accent)',
                        marginLeft: '32px'
                      }}>
                        <strong>Ghi chú:</strong> {task.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button onClick={() => setActiveDetail(null)} className="btn btn-secondary">
                  Đóng cửa sổ
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '100px 0' }}>Đang tải lịch sử...</div>}>
      <HistoryAudit />
    </Suspense>
  );
}
