'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Activity, Loader2, RotateCcw, Search, ChevronLeft, ChevronRight, Eye, CornerDownRight 
} from 'lucide-react';
import toast from 'react-hot-toast';

// Import Reusable UI Components (Quy chuẩn dùng chung)
import SearchableSelect from '@/components/ui/SearchableSelect';
import CustomSelect from '@/components/ui/CustomSelect';
import CustomDatePicker from '@/components/ui/CustomDatePicker';

interface UserInfo {
  _id: string;
  fullName: string;
  username: string;
}

interface LogEntry {
  id: string;
  userId: UserInfo | null;
  action: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export default function ActivityLogsPage() {
  const { token } = useAuth();

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('ALL');
  const [selectedMethod, setSelectedMethod] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Fetch all users for filter dropdown
  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const userList = Array.isArray(data) ? data : data.data || [];
        setUsers(userList);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách người dùng:', err);
    }
  };

  const fetchLogs = async (
    currentPage = page, 
    searchQuery = search, 
    userId = selectedUserId, 
    method = selectedMethod,
    start = startDate,
    end = endDate,
    currentLimit = limit
  ) => {
    if (!token) return;
    setLoading(true);
    try {
      const url = new URL(`${API_BASE_URL}/api/v1/activity-logs`);
      url.searchParams.append('page', currentPage.toString());
      url.searchParams.append('limit', currentLimit.toString());
      if (searchQuery) {
        url.searchParams.append('action', searchQuery);
      }
      if (userId && userId !== 'ALL') {
        url.searchParams.append('userId', userId);
      }
      if (method && method !== 'ALL') {
        url.searchParams.append('method', method);
      }
      if (start) {
        url.searchParams.append('startDate', start);
      }
      if (end) {
        url.searchParams.append('endDate', end);
      }

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error('Lỗi khi tải nhật ký thao tác');
      }
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setPages(data.pages);
      setPage(data.page);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchLogs(1, '', 'ALL', 'ALL', '', '', 10);
    }
  }, [token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(1, search, selectedUserId, selectedMethod, startDate, endDate, limit);
  };

  const handleResetFilters = () => {
    setSearch('');
    setSelectedUserId('ALL');
    setSelectedMethod('ALL');
    setStartDate('');
    setEndDate('');
    setPage(1);
    fetchLogs(1, '', 'ALL', 'ALL', '', '', limit);
  };

  // Trigger fetch when inputs change
  const handleUserChange = (userId: string) => {
    setSelectedUserId(userId);
    setPage(1);
    fetchLogs(1, search, userId, selectedMethod, startDate, endDate, limit);
  };

  const handleMethodChange = (method: string) => {
    setSelectedMethod(method);
    setPage(1);
    fetchLogs(1, search, selectedUserId, method, startDate, endDate, limit);
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    setPage(1);
    fetchLogs(1, search, selectedUserId, selectedMethod, val, endDate, limit);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    setPage(1);
    fetchLogs(1, search, selectedUserId, selectedMethod, startDate, val, limit);
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
    fetchLogs(1, search, selectedUserId, selectedMethod, startDate, endDate, newLimit);
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  const renderDetails = (detailsStr: string) => {
    try {
      const parsed = JSON.parse(detailsStr);
      return (
        <pre style={{
          margin: 0,
          padding: '12px',
          borderRadius: '8px',
          background: 'var(--bg-app)',
          color: 'var(--text-primary)',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          overflowX: 'auto',
          whiteSpace: 'pre-wrap',
          border: '1px solid var(--border-color)',
          maxHeight: '300px'
        }}>
          {JSON.stringify(parsed, null, 2)}
        </pre>
      );
    } catch (e) {
      return <span style={{ color: 'var(--text-muted)' }}>{detailsStr || 'Không có chi tiết'}</span>;
    }
  };

  // Human-friendly action mapping
  const getFriendlyAction = (actionStr: string) => {
    const parts = actionStr.split(' ');
    const method = parts[0] || '';
    const path = parts.slice(1).join(' ') || '';

    if (path.includes('/auth/profile')) {
      return 'Cập nhật thông tin / Cài đặt cá nhân';
    }
    if (path.includes('/auth/login')) {
      return 'Đăng nhập hệ thống';
    }
    if (path.includes('/roles') && path.includes('/permissions')) {
      const match = path.match(/\/roles\/(.*)\/permissions/);
      const roleName = match ? match[1] : '';
      return `Thay đổi phân quyền vai trò ${roleName || 'hệ thống'}`;
    }
    if (path.includes('/departments')) {
      if (method === 'POST') return 'Tạo phòng ban mới';
      if (method === 'PUT') return 'Cập nhật thông tin phòng ban';
      if (method === 'DELETE') return 'Xóa phòng ban';
      return 'Thay đổi thông tin phòng ban';
    }
    if (path.includes('/users')) {
      if (method === 'POST') return 'Tạo tài khoản người dùng mới';
      if (method === 'PUT') return 'Cập nhật thông tin tài khoản';
      if (method === 'DELETE') return 'Xóa tài khoản người dùng';
      return 'Thay đổi thông tin tài khoản';
    }
    if (path.includes('/shift-slots')) {
      if (method === 'POST') return 'Tạo cấu hình ca trực mới';
      if (method === 'PUT') return 'Cập nhật cấu hình ca trực';
      if (method === 'DELETE') return 'Xóa cấu hình ca trực';
      return 'Thay đổi cấu hình ca trực';
    }
    if (path.includes('/templates')) {
      if (method === 'POST') return 'Tạo mẫu checklist mới';
      if (method === 'PUT') return 'Cập nhật mẫu checklist';
      if (method === 'DELETE') return 'Xóa mẫu checklist';
      return 'Thay đổi mẫu checklist';
    }
    if (path.includes('/bot-config') || path.includes('/bot-engine')) {
      return 'Cập nhật cấu hình hệ thống Bot/RPA';
    }
    if (path.includes('/notifications')) {
      return 'Cập nhật cài đặt kênh thông báo';
    }
    if (path.includes('/calendar')) {
      return 'Cập nhật lịch trực / lịch làm việc';
    }
    if (path.includes('/reconciliation/upload-klgd')) {
      return 'Tải lên dữ liệu đối chiếu khớp lệnh';
    }
    if (path.includes('/reconciliation')) {
      return 'Thao tác đối chiếu ca trực';
    }
    if (path.includes('/incidents')) {
      if (method === 'POST') return 'Khai báo sự cố mới';
      if (method === 'PUT') return 'Cập nhật trạng thái sự cố';
      return 'Quản lý báo cáo sự cố';
    }
    if (path.includes('/margin-checker') || path.includes('/margin-change-requests')) {
      return 'Cập nhật cấu hình / Yêu cầu ký quỹ';
    }

    return `Thao tác ghi dữ liệu`;
  };

  // Convert users to SearchableSelect options format
  const userOptions = [
    { value: 'ALL', label: '-- Tất cả tài khoản --' },
    ...users.map(u => ({
      value: u._id,
      label: u.fullName,
      sublabel: `@${u.username}`
    }))
  ];

  const methodOptions = [
    { value: 'ALL', label: '-- Tất cả phương thức --' },
    { value: 'POST', label: 'POST (Tạo mới)' },
    { value: 'PUT', label: 'PUT (Cập nhật)' },
    { value: 'DELETE', label: 'DELETE (Xóa)' }
  ];

  // Pagination bounds
  const startIdx = total === 0 ? 0 : (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Activity size={28} color="var(--color-accent)" />
              Nhật Ký Thao Tác Hệ Thống
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Kiểm toán lịch sử tương tác ghi dữ liệu của các tài khoản (POST, PUT, DELETE).
            </p>
          </div>
          <button 
            onClick={() => fetchLogs(page, search, selectedUserId, selectedMethod, startDate, endDate, limit)} 
            disabled={loading}
            className="btn btn-secondary" 
            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RotateCcw size={16} className={loading ? "animate-spin" : ""} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Filter Toolbar (Using Reusable UI Components) */}
        <div className="glass-panel" style={{ padding: '20px 24px', borderRadius: '16px' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            
            {/* Search Input */}
            <div style={{ flex: 2, minWidth: '260px' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '0.82rem', fontWeight: 600 }}>Tìm kiếm hành động / API</label>
              <div style={{ position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Nhập API, endpoint (vd: users, bot-config...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '40px', width: '100%', height: '42px' }}
                />
              </div>
            </div>

            {/* Reusable SearchableSelect for User Account */}
            <SearchableSelect
              label="Người thực hiện"
              placeholder="Chọn tài khoản..."
              options={userOptions}
              selectedValue={selectedUserId}
              onChange={handleUserChange}
              flex={1.2}
              minWidth="220px"
            />

            {/* Reusable CustomSelect for HTTP Method */}
            <CustomSelect
              label="Phương thức HTTP"
              options={methodOptions}
              selectedValue={selectedMethod}
              onChange={handleMethodChange}
              flex={1}
              minWidth="180px"
            />

            {/* Reusable CustomDatePicker for Start Date */}
            <CustomDatePicker
              label="Từ ngày"
              value={startDate}
              onChange={handleStartDateChange}
              flex={1}
              minWidth="170px"
            />

            {/* Reusable CustomDatePicker for End Date */}
            <CustomDatePicker
              label="Đến ngày"
              value={endDate}
              onChange={handleEndDateChange}
              flex={1}
              minWidth="170px"
            />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: '42px', padding: '0 20px', whiteSpace: 'nowrap' }}>
                Tìm kiếm
              </button>
              <button 
                type="button" 
                onClick={handleResetFilters} 
                disabled={loading} 
                className="btn btn-secondary" 
                style={{ height: '42px', padding: '0 16px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <RotateCcw size={14} />
                <span>Xóa bộ lọc</span>
              </button>
            </div>

          </form>
        </div>

        {/* Main Logs Table */}
        <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
          {loading && logs.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
              <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
            </div>
          ) : logs.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px', color: 'var(--text-secondary)' }}>
              Không tìm thấy nhật ký thao tác nào phù hợp.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '15%' }}>Thời gian</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '18%' }}>Người thực hiện</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '10%' }}>Phương thức</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '27%' }}>Hành động nghiệp vụ</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '20%' }}>Đường dẫn API (Kỹ thuật)</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '8%' }}>Địa chỉ IP</th>
                    <th style={{ padding: '16px 24px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', width: '2%', textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const date = new Date(log.createdAt);
                    const formattedDate = date.toLocaleString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    // Parse HTTP method and url path
                    const parts = log.action.split(' ');
                    const method = parts[0] || '';
                    const path = parts.slice(1).join(' ') || '';

                    let methodColor = 'rgba(255,255,255,0.1)';
                    let methodText = '#fff';
                    if (method === 'POST') {
                      methodColor = 'rgba(16, 185, 129, 0.08)';
                      methodText = '#10b981';
                    } else if (method === 'PUT') {
                      methodColor = 'rgba(59, 130, 246, 0.08)';
                      methodText = 'var(--color-accent)';
                    } else if (method === 'DELETE') {
                      methodColor = 'rgba(239, 68, 68, 0.08)';
                      methodText = '#ef4444';
                    }

                    const friendlyName = getFriendlyAction(log.action);

                    return (
                      <React.Fragment key={log.id}>
                        <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                          <td style={{ padding: '16px 24px', fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {formattedDate}
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '0.88rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {log.userId ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 650 }}>{log.userId.fullName}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{log.userId.username}</span>
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Hệ thống / Guest</span>
                            )}
                          </td>
                          <td style={{ padding: '16px 24px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '4px 8px',
                              borderRadius: '6px',
                              background: methodColor,
                              color: methodText,
                              display: 'inline-block',
                              textAlign: 'center',
                              minWidth: '65px'
                            }}>
                              {method}
                            </span>
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {friendlyName}
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                            {path}
                          </td>
                          <td style={{ padding: '16px 24px', fontSize: '0.88rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {log.ipAddress || '---'}
                          </td>
                          <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleExpandLog(log.id)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: isExpanded ? 'var(--color-accent)' : 'var(--text-muted)',
                                transition: 'color 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px'
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)' }}>
                            <td colSpan={7} style={{ padding: '16px 24px 24px 24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  <CornerDownRight size={14} />
                                  <span>Metadata & Dữ liệu tải trọng gửi đi (Payload):</span>
                                </div>
                                {renderDetails(log.details)}
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                  <strong>Thiết bị (User Agent):</strong> {log.userAgent || '---'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination & Limit Selection (Matches User Accounts layout) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingBottom: '20px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Hiển thị <strong>{startIdx}</strong> - <strong>{endIdx}</strong> trong tổng số <strong>{total}</strong> nhật ký
          </span>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Limit selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hiển thị:</span>
              <select
                value={limit}
                onChange={(e) => handleLimitChange(parseInt(e.target.value, 10))}
                className="form-control"
                style={{ width: '70px', height: '36px', padding: '0 8px', cursor: 'pointer' }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            {/* Page navigation */}
            {pages > 1 && (
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button
                  onClick={() => fetchLogs(page - 1, search, selectedUserId, selectedMethod, startDate, endDate, limit)}
                  disabled={page === 1 || loading}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}
                >
                  <ChevronLeft size={16} />
                  <span>Trước</span>
                </button>
                
                {/* Pages number buttons */}
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1)
                  .map((p, idx, arr) => {
                    const prevPage = arr[idx - 1];
                    const showEllipsis = prevPage && p - prevPage > 1;

                    return (
                      <React.Fragment key={p}>
                        {showEllipsis && (
                          <span style={{ color: 'var(--text-muted)', padding: '0 4px' }}>...</span>
                        )}
                        <button
                          onClick={() => fetchLogs(p, search, selectedUserId, selectedMethod, startDate, endDate, limit)}
                          className={`btn ${page === p ? 'btn-primary' : 'btn-secondary'}`}
                          style={{
                            width: '36px',
                            height: '36px',
                            padding: 0,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            fontWeight: 600
                          }}
                        >
                          {p}
                        </button>
                      </React.Fragment>
                    );
                  })
                }

                <button
                  onClick={() => fetchLogs(page + 1, search, selectedUserId, selectedMethod, startDate, endDate, limit)}
                  disabled={page === pages || loading}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px', height: '36px' }}
                >
                  <span>Sau</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </ProtectedRoute>
  );
}
