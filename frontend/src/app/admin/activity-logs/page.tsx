'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import { 
  Activity, Loader2, RotateCcw, Search, ChevronLeft, ChevronRight, Eye, CornerDownRight,
  Code2, Sliders, CheckCircle2, Copy, Check, Globe, Laptop
} from 'lucide-react';
import toast from 'react-hot-toast';
import { parseActivityLog } from '@/utils/activity-log-mapper';

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
  const [detailTabs, setDetailTabs] = useState<Record<string, 'business' | 'raw'>>({});
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);

  const setTabForLog = (logId: string, tab: 'business' | 'raw') => {
    setDetailTabs(prev => ({ ...prev, [logId]: tab }));
  };

  const handleCopyJson = (logId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLogId(logId);
    toast.success('Đã sao chép dữ liệu JSON vào bộ nhớ tạm');
    setTimeout(() => {
      setCopiedLogId(prev => (prev === logId ? null : prev));
    }, 2000);
  };

  // Fetch all users for filter dropdown
  const fetchUsers = async () => {
    if (!token) return;
    try {
      const data = await api.admin.getUsers({ limit: 1000 }, token);
      const userList = Array.isArray(data) ? data : data?.data || [];
      setUsers(userList);
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
      const params: Record<string, any> = {
        page: currentPage.toString(),
        limit: currentLimit.toString(),
      };
      if (searchQuery) params.action = searchQuery;
      if (userId && userId !== 'ALL') params.userId = userId;
      if (method && method !== 'ALL') params.method = method;
      if (start) params.startDate = start;
      if (end) params.endDate = end;

      const data = await api.admin.getActivityLogs(params, token);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPage(data.page || 1);
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
                  placeholder="Nhập API, thao tác (vd: trigger-ce, console-run, users, system-settings...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '40px', width: '100%', height: '42px', fontSize: '0.85rem' }}
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
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1050px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '13%' }}>Thời gian</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '16%' }}>Người thực hiện</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '9%' }}>Phương thức</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '30%' }}>Hành động nghiệp vụ</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '20%' }}>Đường dẫn API (Kỹ thuật)</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '9%' }}>Địa chỉ IP</th>
                    <th style={{ padding: '16px 20px', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', width: '3%', textAlign: 'center' }}>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const date = new Date(log.createdAt);
                    const formattedDate = date.toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit'
                    });
                    const formattedTime = date.toLocaleTimeString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    // Parse using Activity Log Mapper
                    const parsed = parseActivityLog(log.action, log.details, log.ipAddress, log.userAgent);
                    const activeTab = detailTabs[log.id] || 'business';

                    let methodColor = 'rgba(255,255,255,0.1)';
                    let methodText = '#fff';
                    if (parsed.method === 'POST') {
                      methodColor = 'rgba(16, 185, 129, 0.1)';
                      methodText = '#10b981';
                    } else if (parsed.method === 'PUT') {
                      methodColor = 'rgba(59, 130, 246, 0.1)';
                      methodText = 'var(--color-accent)';
                    } else if (parsed.method === 'DELETE') {
                      methodColor = 'rgba(239, 68, 68, 0.1)';
                      methodText = '#ef4444';
                    }

                    return (
                      <React.Fragment key={log.id}>
                        <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                          {/* Thời gian */}
                          <td style={{ padding: '14px 20px', fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 650 }}>{formattedTime}</span>
                              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>{formattedDate}</span>
                            </div>
                          </td>

                          {/* Người thực hiện */}
                          <td style={{ padding: '14px 20px', fontSize: '0.86rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                            {log.userId ? (
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 650 }}>{log.userId.fullName}</span>
                                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>@{log.userId.username}</span>
                              </div>
                            ) : (
                              <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>Hệ thống / Guest</span>
                            )}
                          </td>

                          {/* Phương thức HTTP */}
                          <td style={{ padding: '14px 20px' }}>
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: methodColor,
                              color: methodText,
                              display: 'inline-block',
                              textAlign: 'center',
                              minWidth: '60px'
                            }}>
                              {parsed.method}
                            </span>
                          </td>

                          {/* Hành động nghiệp vụ (Module Badge + Tiêu đề chi tiết) */}
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                              <div>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  background: parsed.module.bgLight,
                                  color: parsed.module.color,
                                  border: `1px solid ${parsed.module.border}`,
                                  display: 'inline-block',
                                }}>
                                  {parsed.module.name}
                                </span>
                              </div>
                              <div style={{ fontSize: '0.88rem', fontWeight: 650, color: 'var(--text-primary)', lineHeight: 1.35 }}>
                                {parsed.actionTitle}
                              </div>
                            </div>
                          </td>

                          {/* Đường dẫn API & Technical Tag */}
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span style={{
                                fontSize: '0.8rem',
                                fontFamily: 'monospace',
                                color: 'var(--text-secondary)',
                                wordBreak: 'break-all',
                                lineHeight: 1.3
                              }}>
                                {parsed.cleanEndpoint}
                              </span>
                              {parsed.technicalTag && (
                                <div>
                                  <span style={{
                                    fontSize: '0.66rem',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(59, 130, 246, 0.12)',
                                    color: 'var(--color-accent)',
                                    border: '1px solid rgba(59, 130, 246, 0.25)',
                                    display: 'inline-block'
                                  }}>
                                    Tag: {parsed.technicalTag}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Địa chỉ IP */}
                          <td style={{ padding: '14px 20px', fontSize: '0.82rem', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                            {parsed.clientInfo.ip}
                          </td>

                          {/* Nút Chi tiết */}
                          <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                            <button
                              onClick={() => toggleExpandLog(log.id)}
                              title={isExpanded ? 'Đóng chi tiết' : 'Xem chi tiết'}
                              style={{
                                background: isExpanded ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: isExpanded ? 'var(--color-accent)' : 'var(--text-muted)',
                                transition: 'all 0.2s',
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '6px'
                              }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                        
                        {/* Expanded details row */}
                        {isExpanded && (
                          <tr style={{ background: 'rgba(13, 20, 38, 0.85)', borderBottom: '1px solid var(--border-color)' }}>
                            <td colSpan={7} style={{ padding: '20px 24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                
                                {/* Header chi tiết: Thông tin tổng quan & Chuyển Tab */}
                                <div style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                  flexWrap: 'wrap',
                                  gap: '12px',
                                  paddingBottom: '14px',
                                  borderBottom: '1px solid var(--border-color)'
                                }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '280px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                      <span style={{
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        background: parsed.module.bgLight,
                                        color: parsed.module.color,
                                        border: `1px solid ${parsed.module.border}`
                                      }}>
                                        {parsed.module.name}
                                      </span>
                                      <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {parsed.actionTitle}
                                      </span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                                      {parsed.actionDescription}
                                    </p>
                                  </div>

                                  {/* Tab Switcher Pills */}
                                  <div style={{
                                    display: 'inline-flex',
                                    background: 'var(--bg-app)',
                                    padding: '3px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    gap: '4px'
                                  }}>
                                    <button
                                      type="button"
                                      onClick={() => setTabForLog(log.id, 'business')}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: activeTab === 'business' ? 'var(--color-accent)' : 'transparent',
                                        color: activeTab === 'business' ? '#ffffff' : 'var(--text-secondary)',
                                        fontSize: '0.78rem',
                                        fontWeight: activeTab === 'business' ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <Sliders size={14} />
                                      <span>Giao diện Nghiệp vụ</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTabForLog(log.id, 'raw')}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: activeTab === 'raw' ? 'var(--color-accent)' : 'transparent',
                                        color: activeTab === 'raw' ? '#ffffff' : 'var(--text-secondary)',
                                        fontSize: '0.78rem',
                                        fontWeight: activeTab === 'raw' ? 700 : 500,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                      }}
                                    >
                                      <Code2 size={14} />
                                      <span>Dữ liệu Kỹ thuật (Payload)</span>
                                    </button>
                                  </div>
                                </div>

                                {/* TAB 1: Giao diện Nghiệp vụ trực quan */}
                                {activeTab === 'business' ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    
                                    {/* Parameters Grid */}
                                    <div>
                                      <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                        Tham số nghiệp vụ ghi nhận:
                                      </div>
                                      
                                      {parsed.businessParameters.length > 0 ? (
                                        <div style={{
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                                          gap: '10px'
                                        }}>
                                          {parsed.businessParameters.map((param, idx) => (
                                            <div
                                              key={idx}
                                              style={{
                                                padding: '10px 14px',
                                                background: 'var(--bg-app)',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '4px'
                                              }}
                                            >
                                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                {param.label}
                                              </span>
                                              <span style={{
                                                fontSize: '0.85rem',
                                                fontWeight: param.isHighlight ? 700 : 600,
                                                color: param.badgeColor || 'var(--text-primary)',
                                                wordBreak: 'break-word'
                                              }}>
                                                {param.value}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <div style={{
                                          padding: '12px 16px',
                                          background: 'var(--bg-app)',
                                          borderRadius: '8px',
                                          border: '1px dashed var(--border-color)',
                                          fontSize: '0.82rem',
                                          color: 'var(--text-muted)'
                                        }}>
                                          Thao tác kích hoạt trực tiếp theo tham số mặc định của hệ thống (không gửi kèm dữ liệu bổ sung).
                                        </div>
                                      )}
                                    </div>

                                    {/* Server Response Card */}
                                    {parsed.responseSummary && (
                                      <div style={{
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        background: 'rgba(16, 185, 129, 0.08)',
                                        border: '1px solid rgba(16, 185, 129, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        <CheckCircle2 size={16} color="#10b981" />
                                        <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600 }}>
                                          {parsed.responseSummary.message}
                                        </span>
                                      </div>
                                    )}

                                    {/* Execution Context Cards */}
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                      gap: '10px',
                                      paddingTop: '6px'
                                    }}>
                                      <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        <Laptop size={15} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Thiết bị & Trình duyệt</span>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {parsed.clientInfo.browser} trên {parsed.clientInfo.os}
                                          </span>
                                        </div>
                                      </div>

                                      <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(255, 255, 255, 0.02)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                      }}>
                                        <Globe size={15} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Địa chỉ IP mạng</span>
                                          <span style={{ fontSize: '0.8rem', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                            {parsed.clientInfo.ip}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                  </div>
                                ) : (
                                  /* TAB 2: Dữ liệu Kỹ thuật nguyên bản (Raw Payload) */
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        <CornerDownRight size={14} />
                                        <span>Dữ liệu Payload nguyên bản (JSON):</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyJson(log.id, JSON.stringify(parsed.rawPayload || log.details, null, 2))}
                                        className="btn btn-secondary"
                                        style={{
                                          padding: '4px 10px',
                                          fontSize: '0.75rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          height: '28px'
                                        }}
                                      >
                                        {copiedLogId === log.id ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                                        <span>{copiedLogId === log.id ? 'Đã sao chép' : 'Sao chép JSON'}</span>
                                      </button>
                                    </div>

                                    <pre style={{
                                      margin: 0,
                                      padding: '14px',
                                      borderRadius: '8px',
                                      background: 'var(--bg-app)',
                                      color: '#38bdf8',
                                      fontSize: '0.78rem',
                                      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                      overflowX: 'auto',
                                      whiteSpace: 'pre-wrap',
                                      border: '1px solid var(--border-color)',
                                      maxHeight: '320px',
                                      lineHeight: 1.5
                                    }}>
                                      {parsed.hasPayload ? JSON.stringify(parsed.rawPayload, null, 2) : (log.details || 'Không có chi tiết')}
                                    </pre>

                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                      <strong>User-Agent gốc:</strong> {log.userAgent || '---'}
                                    </div>
                                  </div>
                                )}

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
                className="form-input"
                style={{ width: '70px', height: '36px', padding: '0 8px', cursor: 'pointer', fontSize: '0.85rem' }}
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
