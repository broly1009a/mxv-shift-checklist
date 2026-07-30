'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { 
  Search, 
  SlidersHorizontal, 
  CheckCircle2, 
  Clock, 
  Eye,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/Skeleton';

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
  status?: string;
  resultNote?: string;
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
  const { token } = useAuth();
  const { canViewChecklist } = usePermissions();
  
  // Filters
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Results
  const [logs, setLogs] = useState<ShiftLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [loading, setLoading] = useState(true);



  const fetchFilters = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setDepartments(data);
      } else {
        setDepartments([]);
      }
    } catch (err) {
      console.error(err);
      setDepartments([]);
    }
  }, [token]);

  const fetchLogs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/v1/shifts/history?page=${currentPage}&limit=${limit}&`;
      if (selectedDept) url += `departmentId=${selectedDept}&`;
      if (selectedStatus) url += `status=${selectedStatus}&`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}&`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await res.json();
      if (resData && Array.isArray(resData.data)) {
        setLogs(resData.data);
        setTotalLogs(resData.total || 0);
      } else if (Array.isArray(resData)) {
        setLogs(resData);
        setTotalLogs(resData.length);
      } else {
        setLogs([]);
        setTotalLogs(0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDept, selectedStatus, startDate, endDate, currentPage, limit]);



  useEffect(() => {
    Promise.resolve().then(() => {
      fetchFilters();
      fetchLogs();
    });
  }, [fetchFilters, fetchLogs]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
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

  if (!canViewChecklist) {
    return (
      <ProtectedRoute>
        <div className="glass-panel no-print" style={{
          padding: '40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={40} color="var(--color-critical)" />
          <p style={{ color: 'var(--text-primary)', fontWeight: 700, margin: 0 }}>Không có quyền truy cập</p>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Tài khoản của bạn không có quyền tra cứu lịch sử ca trực.</p>
          <Link href="/dashboard" className="btn btn-secondary" style={{ marginTop: '8px' }}>
            Quay lại bảng điều khiển
          </Link>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
            Lịch Sử Ca Trực & Đối Chiếu
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tra cứu toàn bộ lịch sử trực nhật, ghi chú nghiệp vụ và chữ ký số hóa của cán bộ các phòng ban Sở Giao Dịch Hàng Hóa Việt Nam.
          </p>
        </div>

        {/* Filters Form Panel */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <SlidersHorizontal size={18} color="var(--color-accent)" /> Bộ lọc tìm kiếm ca trực
          </h3>

          <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Phòng Ban</label>
              <select className="form-input" value={selectedDept} onChange={(e) => { setSelectedDept(e.target.value); setCurrentPage(1); }} style={{ background: 'var(--bg-app)' }}>
                <option value="">Tất cả phòng ban</option>
                {departments.map(d => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Trạng Thái</label>
              <select className="form-input" value={selectedStatus} onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }} style={{ background: 'var(--bg-app)' }}>
                <option value="">Tất cả trạng thái</option>
                <option value="PENDING">ĐANG TRỰC</option>
                <option value="COMPLETED">HOÀN THÀNH</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Từ Ngày</label>
              <input type="date" className="form-input" value={startDate} onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} style={{ background: 'var(--bg-app)' }} />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Đến Ngày</label>
              <input type="date" className="form-input" value={endDate} onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} style={{ background: 'var(--bg-app)' }} />
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
            <TableSkeleton rows={5} cols={8} />
          ) : logs.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Không tìm thấy ca trực nào phù hợp với bộ lọc.</div>
          ) : (
            <>
              <div className="table-responsive-wrapper">

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
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '0.75rem', fontWeight: 700,
                              color: '#10b981',
                              background: 'rgba(16,185,129,0.1)',
                              border: '1px solid rgba(16,185,129,0.2)',
                              borderRadius: '20px', padding: '3px 10px',
                            }}>
                              <CheckCircle2 size={12} /> Hoàn thành
                            </span>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '5px',
                              fontSize: '0.75rem', fontWeight: 700,
                              color: '#f59e0b',
                              background: 'rgba(245,158,11,0.1)',
                              border: '1px solid rgba(245,158,11,0.2)',
                              borderRadius: '20px', padding: '3px 10px',
                            }}>
                              <Clock size={12} className="animate-pulse" /> Đang chạy
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '80px' }}>
                            <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border-color)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%',
                                width: `${log.progressPercentage}%`,
                                borderRadius: '3px',
                                background: log.progressPercentage === 100
                                  ? '#10b981' // Green
                                  : log.progressPercentage >= 50
                                    ? '#3b82f6' // Blue
                                    : log.progressPercentage >= 30
                                      ? '#f59e0b' // Yellow
                                      : '#ef4444', // Red
                                transition: 'width 0.3s ease',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '36px' }}>{log.progressPercentage}%</span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', display: 'flex', gap: '10px' }}>
                          {log.status === 'PENDING' ? (
                            <Link 
                              href={`/checklist?id=${log._id}`} 
                              className="btn btn-primary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              Mở
                            </Link>
                          ) : (
                            <Link 
                              href={`/checklist?id=${log._id}`}
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Eye size={14} /> Chi tiết
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalLogs > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginTop: '20px', 
                  paddingTop: '20px', 
                  borderTop: '1px solid var(--border-color)',
                  flexWrap: 'wrap',
                  gap: '16px',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div>
                    Hiển thị <strong>{Math.min((currentPage - 1) * limit + 1, totalLogs)}</strong> - <strong>{Math.min(currentPage * limit, totalLogs)}</strong> trong tổng số <strong>{totalLogs}</strong> bản ghi
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>Số dòng:</span>
                      <select 
                        value={limit} 
                        onChange={(e) => {
                          setLimit(parseInt(e.target.value, 10));
                          setCurrentPage(1);
                        }}
                        style={{
                          background: 'var(--bg-app)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '4px 8px',
                          color: 'var(--text-primary)',
                          outline: 'none',
                          cursor: 'pointer'
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: currentPage === 1 ? 'transparent' : 'rgba(255,255,255,0.03)',
                          color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Trước
                      </button>
                      
                      {(() => {
                        const totalPages = Math.ceil(totalLogs / limit);
                        const maxVisible = 5;
                        let start = Math.max(1, currentPage - 2);
                        let end = Math.min(totalPages, start + maxVisible - 1);
                        if (end - start + 1 < maxVisible) {
                          start = Math.max(1, end - maxVisible + 1);
                        }
                        const pages = [];
                        for (let i = start; i <= end; i++) {
                          if (i >= 1) pages.push(i);
                        }
                        return pages.map((pageNum) => {
                          const isSelected = pageNum === currentPage;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setCurrentPage(pageNum)}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                border: `1px solid ${isSelected ? 'var(--color-primary)' : 'var(--border-color)'}`,
                                background: isSelected ? 'var(--color-primary)' : 'transparent',
                                color: isSelected ? '#ffffff' : 'var(--text-primary)',
                                fontWeight: isSelected ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        });
                      })()}

                      <button 
                        disabled={currentPage === Math.ceil(totalLogs / limit) || totalLogs === 0}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalLogs / limit)))}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          background: (currentPage === Math.ceil(totalLogs / limit) || totalLogs === 0) ? 'transparent' : 'rgba(255,255,255,0.03)',
                          color: (currentPage === Math.ceil(totalLogs / limit) || totalLogs === 0) ? 'var(--text-muted)' : 'var(--text-primary)',
                          cursor: (currentPage === Math.ceil(totalLogs / limit) || totalLogs === 0) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        Sau
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>


    </ProtectedRoute>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="glass-panel" style={{ padding: '24px' }}>
        <TableSkeleton rows={5} cols={8} />
      </div>
    }>
      <HistoryAudit />
    </Suspense>
  );
}
