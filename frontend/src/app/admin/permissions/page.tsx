'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { Shield, Save, RotateCcw, AlertCircle, HelpCircle, Check, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Sidebar from '@/components/Sidebar';

interface Role {
  _id: string;
  code: string;
  name: string;
  permissions: string[];
}

interface SystemPermission {
  code: string;
  name: string;
  category: string;
}

export default function PermissionsPage() {
  const { user: currentUser, token } = useAuth();
  const router = useRouter();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state to keep track of edited permissions
  const [editedPermissions, setEditedPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (currentUser && currentUser.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const fetchData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [permsRes, rolesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/v1/permissions`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/api/v1/roles`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (!permsRes.ok || !rolesRes.ok) {
        throw new Error('Lỗi khi tải cấu hình phân quyền');
      }

      const permsData = await permsRes.json();
      const rolesData = await rolesRes.json();

      setPermissions(permsData);
      setRoles(rolesData);

      // Initialize edited state
      const initialEdited: Record<string, string[]> = {};
      rolesData.forEach((r: Role) => {
        initialEdited[r.code] = [...(r.permissions || [])];
      });
      setEditedPermissions(initialEdited);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi xảy ra khi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const handleTogglePermission = (roleCode: string, permCode: string) => {
    if (roleCode === 'ADMIN') return; // Cannot modify ADMIN role

    setEditedPermissions(prev => {
      const currentList = prev[roleCode] || [];
      const updatedList = currentList.includes(permCode)
        ? currentList.filter(p => p !== permCode)
        : [...currentList, permCode];
      
      return {
        ...prev,
        [roleCode]: updatedList
      };
    });
  };

  const handleReset = () => {
    const initialEdited: Record<string, string[]> = {};
    roles.forEach((r: Role) => {
      initialEdited[r.code] = [...(r.permissions || [])];
    });
    setEditedPermissions(initialEdited);
    toast.success('Đã khôi phục cấu hình ban đầu');
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      // Save each modified role
      const savePromises = roles
        .filter(r => r.code !== 'ADMIN') // Skip ADMIN
        .map(r => {
          return fetch(`${API_BASE_URL}/api/v1/roles/${r.code}/permissions`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              permissions: editedPermissions[r.code] || []
            })
          });
        });

      const results = await Promise.all(savePromises);
      const failed = results.filter(res => !res.ok);

      if (failed.length > 0) {
        throw new Error('Có lỗi xảy ra khi lưu một số vai trò');
      }

      toast.success('Lưu cấu hình phân quyền thành công!');
      // Reload roles data
      const rolesRes = await fetch(`${API_BASE_URL}/api/v1/roles`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const rolesData = await rolesRes.json();
      setRoles(rolesData);
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu cấu hình');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by category
  const categories = Array.from(new Set(permissions.map(p => p.category)));

  // Check if there are unsaved changes
  const hasChanges = () => {
    for (const r of roles) {
      if (r.code === 'ADMIN') continue;
      const current = r.permissions || [];
      const edited = editedPermissions[r.code] || [];
      if (current.length !== edited.length) return true;
      for (const p of current) {
        if (!edited.includes(p)) return true;
      }
    }
    return false;
  };

  return (
    <ProtectedRoute>
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Phân Quyền Vai Trò
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Cấu hình ma trận chức năng và quyền hạn chi tiết cho từng vai trò trong hệ thống.
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleReset} 
                disabled={saving || loading || !hasChanges()}
                className="btn btn-secondary" 
                style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', opacity: hasChanges() ? 1 : 0.5 }}
              >
                <RotateCcw size={18} />
                <span>Hoàn tác</span>
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || loading || !hasChanges()}
                className="btn btn-primary" 
                style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', opacity: hasChanges() ? 1 : 0.5 }}
              >
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>Lưu cấu hình</span>
              </button>
            </div>
          )}
        </div>

        {/* Warning Banner */}
        <div className="glass-panel" style={{
          padding: '16px 20px',
          borderRadius: '12px',
          borderLeft: '4px solid var(--color-accent)',
          background: 'rgba(59, 130, 246, 0.03)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <AlertCircle size={20} color="var(--color-accent)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            <strong>Lưu ý bảo mật:</strong> Thay đổi quyền hạn sẽ có tác dụng trực tiếp ngay khi người dùng đăng nhập lại hoặc làm mới token. Vai trò <strong>Quản trị viên (ADMIN)</strong> luôn có toàn bộ quyền hệ thống và không thể bị sửa đổi.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          </div>
        ) : (
          <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden', padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                <thead>
                  <tr style={{ background: 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '16px 24px', width: '350px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Quyền hạn / Chức năng
                    </th>
                    {roles.map(r => (
                      <th 
                        key={r.code} 
                        style={{ 
                          padding: '16px 24px', 
                          fontSize: '0.85rem', 
                          fontWeight: 700, 
                          color: 'var(--text-primary)', 
                          textAlign: 'center',
                          borderLeft: '1px solid var(--border-color)'
                        }}
                      >
                        <div>{r.name}</div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>({r.code})</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categories.map(category => (
                    <React.Fragment key={category}>
                      {/* Category Header Row */}
                      <tr style={{ background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--border-color)' }}>
                        <td 
                          colSpan={roles.length + 1} 
                          style={{ 
                            padding: '12px 24px', 
                            fontSize: '0.8rem', 
                            fontWeight: 800, 
                            color: 'var(--color-accent)', 
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}
                        >
                          {category}
                        </td>
                      </tr>

                      {/* Permissions Rows in this Category */}
                      {permissions
                        .filter(p => p.category === category)
                        .map(p => (
                          <tr 
                            key={p.code} 
                            style={{ 
                              borderBottom: '1px solid var(--border-color)', 
                              background: 'rgba(255,255,255,0.002)',
                              transition: 'background 0.2s'
                            }}
                            className="table-row-hover"
                          >
                            <td style={{ padding: '16px 24px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                  {p.name}
                                </span>
                                <code style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                  {p.code}
                                </code>
                              </div>
                            </td>

                            {roles.map(r => {
                              const isChecked = editedPermissions[r.code]?.includes(p.code) || r.code === 'ADMIN';
                              const isDisabled = r.code === 'ADMIN' || saving;

                              return (
                                <td 
                                  key={r.code} 
                                  style={{ 
                                    padding: '16px 24px', 
                                    textAlign: 'center',
                                    borderLeft: '1px solid var(--border-color)',
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                    {r.code === 'ADMIN' ? (
                                      <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        color: '#10b981',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem',
                                        fontWeight: 700
                                      }}>
                                        <Check size={12} />
                                        <span>Bypass</span>
                                      </div>
                                    ) : (
                                      <label style={{ 
                                        position: 'relative', 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        cursor: isDisabled ? 'not-allowed' : 'pointer'
                                      }}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          disabled={isDisabled}
                                          onChange={() => handleTogglePermission(r.code, p.code)}
                                          style={{
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '6px',
                                            border: '2px solid var(--border-color)',
                                            background: isChecked ? 'var(--color-accent)' : 'transparent',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            accentColor: 'var(--color-accent)',
                                            outline: 'none',
                                            transition: 'all 0.2s'
                                          }}
                                        />
                                      </label>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
