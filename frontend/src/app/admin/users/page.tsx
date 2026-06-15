'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  UserPlus, 
  Edit, 
  Trash2, 
  Users as UsersIcon,
  Shield,
  Layers,
  X,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface Division {
  _id: string;
  name: string;
  code: string;
}

interface Department {
  _id: string;
  name: string;
  code: string;
  divisionId?: string | { _id: string };
}

interface User {
  _id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'CHAIRMAN' | 'CEO' | 'DIVISION_DIRECTOR' | 'DEPARTMENT_HEAD' | 'STAFF';
  departmentId?: {
    _id: string;
    name: string;
    code: string;
  };
  divisionId?: {
    _id: string;
    name: string;
    code: string;
  };
  isActive: boolean;
}

export default function AdminUsersPage() {
  const { user: currentUser, token } = useAuth();
  const router = useRouter();

  // Data state
  const [users, setUsers] = useState<User[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<User['role']>('STAFF');
  const [divisionId, setDivisionId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if not admin
  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch users
      const usersRes = await fetch(`${API_BASE_URL}/api/v1/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const usersData = await usersRes.json();
      setUsers(usersData);

      // Fetch divisions
      const divsRes = await fetch(`${API_BASE_URL}/api/v1/divisions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const divsData = await divsRes.json();
      setDivisions(divsData);

      // Fetch departments
      const deptsRes = await fetch(`${API_BASE_URL}/api/v1/departments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const deptsData = await deptsRes.json();
      setDepartments(deptsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openAddModal = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setRole('STAFF');
    setDivisionId('');
    setDepartmentId('');
    setIsActive(true);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setUsername(u.username);
    setPassword('');
    setFullName(u.fullName);
    setRole(u.role);
    setDivisionId(u.divisionId?._id || '');
    setDepartmentId(u.departmentId?._id || '');
    setIsActive(u.isActive !== undefined ? u.isActive : true);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!username || !fullName || !role) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    if (isActive) {
      if ((role === 'STAFF' || role === 'DEPARTMENT_HEAD') && !departmentId) {
        setError('Tài khoản Nhân viên / Trưởng bộ phận đã kích hoạt bắt buộc phải gán phòng ban trực!');
        return;
      }
      if (role === 'DIVISION_DIRECTOR' && !divisionId) {
        setError('Tài khoản Giám đốc Khối đã kích hoạt bắt buộc phải gán Khối quản lý!');
        return;
      }
    }

    try {
      let res;
      const bodyPayload = {
        username,
        fullName,
        role,
        divisionId: divisionId || null,
        departmentId: departmentId || null,
        isActive,
        ...(password ? { password } : {})
      };

      if (editingUser) {
        res = await fetch(`${API_BASE_URL}/api/v1/users/${editingUser._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(bodyPayload)
        });
      } else {
        if (!password) {
          setError('Vui lòng nhập mật khẩu cho tài khoản mới');
          return;
        }
        res = await fetch(`${API_BASE_URL}/api/v1/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(bodyPayload)
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Thao tác thất bại');
      }

      setSuccess(editingUser ? 'Cập nhật tài khoản thành công!' : 'Tạo tài khoản mới thành công!');
      setTimeout(() => {
        setModalOpen(false);
        fetchData();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA tài khoản "${name}"?`)) {
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Xóa tài khoản thất bại');
      }

      setSuccess('Đã xóa tài khoản.');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Lỗi xảy ra');
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'Quản trị viên';
      case 'CHAIRMAN': return 'Chủ tịch';
      case 'CEO': return 'Ban Giám đốc';
      case 'DIVISION_DIRECTOR': return 'Giám đốc Khối';
      case 'DEPARTMENT_HEAD': return 'Trưởng bộ phận';
      case 'STAFF': return 'Nhân viên';
      default: return role;
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN': return { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' };
      case 'CHAIRMAN': return { background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' };
      case 'CEO': return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      case 'DIVISION_DIRECTOR': return { background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', border: '1px solid rgba(139, 92, 246, 0.2)' };
      case 'DEPARTMENT_HEAD': return { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
      default: return { background: 'rgba(107, 114, 128, 0.1)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.2)' };
    }
  };

  // Filter departments based on selected division
  const filteredDepartments = departments.filter(d => {
    if (!divisionId) return true;
    const deptDivId = typeof d.divisionId === 'object' && d.divisionId !== null ? d.divisionId._id : d.divisionId;
    return deptDivId === divisionId;
  });

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Page Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', marginBottom: '4px' }}>
                  Quản Lý Tài Khoản Cán Bộ
                </h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Cấp phát, điều chỉnh phân quyền, kích hoạt tài khoản và gán Khối / Phòng ban làm việc.
                </p>
              </div>
              <button onClick={openAddModal} className="btn btn-primary" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={18} />
                <span>Thêm tài khoản mới</span>
              </button>
            </div>

            {/* Notifications */}
            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#ef4444', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}
            {success && (
              <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '8px', color: '#10b981', fontSize: '0.875rem' }}>
                {success}
              </div>
            )}

            {/* Users List */}
            <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px' }}>
              {loading ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Đang tải người dùng...</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: '950px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '12px 16px' }}>Tên đăng nhập</th>
                        <th style={{ padding: '12px 16px' }}>Họ và tên</th>
                        <th style={{ padding: '12px 16px' }}>Đơn vị quản lý</th>
                        <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                        <th style={{ padding: '12px 16px' }}>Vai trò / Chức vụ</th>
                        <th style={{ padding: '12px 16px' }}>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.005)' }}>
                          <td style={{ padding: '14px 16px', fontWeight: 700, color: '#fff' }}>{u.username}</td>
                          <td style={{ padding: '14px 16px' }}>{u.fullName}</td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              {u.divisionId ? (
                                <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 500 }}>
                                  🏢 {u.divisionId.name}
                                </span>
                              ) : null}
                              {u.departmentId ? (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Layers size={12} /> {u.departmentId.name}
                                </span>
                              ) : !u.divisionId ? (
                                <em style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Ban Lãnh Đạo / Admin</em>
                              ) : (
                                <em style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Chưa phân phòng trực</em>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            {u.isActive ? (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                background: 'rgba(16, 185, 129, 0.1)', 
                                color: '#10b981', 
                                border: '1px solid rgba(16, 185, 129, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem', 
                                fontWeight: 600 
                              }}>
                                <CheckCircle size={12} /> Hoạt động
                              </span>
                            ) : (
                              <span style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                background: 'rgba(245, 158, 11, 0.1)', 
                                color: '#f59e0b', 
                                border: '1px solid rgba(245, 158, 11, 0.2)', 
                                padding: '4px 8px', 
                                borderRadius: '4px', 
                                fontSize: '0.75rem', 
                                fontWeight: 600 
                              }}>
                                <AlertTriangle size={12} /> Chờ kích hoạt
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '6px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              ...getRoleBadgeStyle(u.role)
                            }}>
                              <Shield size={12} />
                              <span>{getRoleName(u.role)}</span>
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: '10px' }}>
                              <button 
                                onClick={() => openEditModal(u)}
                                className="btn btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              >
                                <Edit size={14} /> Sửa / Kích hoạt
                              </button>
                              {u.username !== 'admin' && (
                                <button 
                                  onClick={() => handleDelete(u._id, u.fullName)}
                                  className="btn btn-secondary" 
                                  style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444' }}
                                >
                                  <Trash2 size={14} /> Xóa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

      {/* Modal Window */}
      {modalOpen && (
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
          overflowY: 'auto',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{
            width: '100%',
            maxWidth: '500px',
            background: '#0d1326',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            margin: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UsersIcon size={20} color="var(--primary-color)" /> 
                {editingUser ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {error && (
              <div style={{ 
                background: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                color: '#ef4444', 
                fontSize: '0.85rem', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px' 
              }}>
                <AlertTriangle size={14} /> {error}
              </div>
            )}
            {success && (
              <div style={{ 
                background: 'rgba(16, 185, 129, 0.1)', 
                border: '1px solid rgba(16, 185, 129, 0.2)', 
                padding: '10px 14px', 
                borderRadius: '8px', 
                color: '#10b981', 
                fontSize: '0.85rem' 
              }}>
                {success}
              </div>
            )}

            {/* Form fields */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label className="form-label">Tên đăng nhập *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={!!editingUser}
                />
              </div>

              <div>
                <label className="form-label">
                  Mật khẩu {editingUser ? '(Bỏ trống nếu giữ nguyên)' : '*'}
                </label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Họ và tên *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Nhập họ và tên"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label">Vai trò / Chức vụ *</label>
                <select
                  className="form-input"
                  value={role}
                  onChange={(e) => {
                    const newRole = e.target.value as User['role'];
                    setRole(newRole);
                    // Clear division/department if they are board level
                    if (newRole === 'ADMIN' || newRole === 'CEO' || newRole === 'CHAIRMAN') {
                      setDivisionId('');
                      setDepartmentId('');
                    }
                  }}
                  style={{ background: 'var(--bg-app)' }}
                >
                  <option value="STAFF">STAFF (Nhân viên vận hành)</option>
                  <option value="DEPARTMENT_HEAD">DEPARTMENT_HEAD (Trưởng bộ phận / Trưởng ca)</option>
                  <option value="DIVISION_DIRECTOR">DIVISION_DIRECTOR (Giám đốc Khối)</option>
                  <option value="CEO">CEO (Tổng Giám đốc / Ban Giám đốc)</option>
                  <option value="CHAIRMAN">CHAIRMAN (Chủ tịch Hội đồng)</option>
                  <option value="ADMIN">ADMIN (Quản trị hệ thống)</option>
                </select>
              </div>

              {/* Division selection: Hidden for Admin/CEO/Chairman */}
              {role !== 'ADMIN' && role !== 'CEO' && role !== 'CHAIRMAN' && (
                <div>
                  <label className="form-label">Khối quản lý *</label>
                  <select
                    className="form-input"
                    value={divisionId}
                    onChange={(e) => {
                      setDivisionId(e.target.value);
                      setDepartmentId(''); // Reset department when division changes
                    }}
                    style={{ background: 'var(--bg-app)' }}
                  >
                    <option value="">-- Chọn Khối quản lý --</option>
                    {divisions.map(div => (
                      <option key={div._id} value={div._id}>{div.name} ({div.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Department selection: Hidden for Admin/CEO/Chairman and Division Director */}
              {role !== 'ADMIN' && role !== 'CEO' && role !== 'CHAIRMAN' && role !== 'DIVISION_DIRECTOR' && (
                <div>
                  <label className="form-label">Phòng ban trực *</label>
                  <select
                    className="form-input"
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    style={{ background: 'var(--bg-app)' }}
                  >
                    <option value="">-- Chọn phòng ban trực --</option>
                    {filteredDepartments.map(d => (
                      <option key={d._id} value={d._id}>{d.name} ({d.code})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Account Activation Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
                <input
                  type="checkbox"
                  id="isActiveCheckbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ 
                    width: '18px', 
                    height: '18px', 
                    cursor: 'pointer',
                    accentColor: 'var(--primary-color)'
                  }}
                />
                <label 
                  htmlFor="isActiveCheckbox" 
                  style={{ 
                    fontSize: '0.9rem', 
                    fontWeight: 600, 
                    color: '#fff', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Kích hoạt tài khoản (Active)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                  Lưu cấu hình
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
