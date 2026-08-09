'use client';

import React, { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { Shield, Save, RotateCcw, AlertCircle, Check, Loader2, Users, LayoutGrid, CheckCircle2, Info } from 'lucide-react';
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

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  VIEW_CHECKLIST: 'Cho phép xem danh sách checklist, xem tiến độ ca trực hiện tại và tra cứu lịch sử các ca trực cũ.',
  EDIT_CHECKLIST: 'Cho phép tích chọn hoàn thành tác vụ, cập nhật tiến độ công việc trong checklist ca trực.',
  INITIALIZE_SHIFT: 'Cho phép khởi tạo ca trực mới từ các mẫu cấu hình có sẵn.',
  CLOSE_SHIFT: 'Cho phép kết thúc ca trực, xác nhận hoàn thành toàn bộ checklist ca trực.',
  ACCESS_MARGIN_CHANGE: 'Cho phép truy cập phân hệ đối chiếu ký quỹ khả dụng (Nano) và lưu cấu hình quét ký quỹ.',
  ACCESS_AUTO_SHIFT: 'Cho phép truy cập các công cụ đối chiếu khớp lệnh tự động, thống kê số lot, macro giá trị giao dịch, xuất báo cáo CCP và kích hoạt Bot RPA.',
  ACCESS_HEALTH_CHECKS: 'Cho phép truy cập trang giám sát hạ tầng mạng và kiểm tra sức khỏe hệ thống.',
  RESOLVE_INCIDENTS: 'Cho phép ghi nhận ngoại lệ, báo cáo sự cố ca trực và cập nhật trạng thái xử lý sự cố.',
  MANAGE_TEMPLATES: 'Cho phép tạo mới, chỉnh sửa hoặc xóa các mẫu checklist của ca trực.',
  MANAGE_USERS: 'Cho phép quản lý tài khoản người dùng (tạo mới, sửa đổi thông tin, kích hoạt/khóa tài khoản).',
  MANAGE_ROLES: 'Cho phép thay đổi ma trận phân quyền và thiết lập quyền hạn cho các vai trò.',
  MANAGE_CALENDAR: 'Cho phép quản lý lịch trực tháng, gán ca trực và ca làm việc cho nhân viên.',
};

export default function PermissionsPage() {
  const { user: currentUser, token } = useAuth();
  const router = useRouter();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<SystemPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // View modes: 'split' (detailed tabbed) or 'matrix' (full comparison table)
  const [viewMode, setViewMode] = useState<'split' | 'matrix'>('split');

  // Split tab view: 'by-role' or 'by-permission'
  const [activeTab, setActiveTab] = useState<'by-role' | 'by-permission'>('by-role');
  const [selectedRoleCode, setSelectedRoleCode] = useState<string>('DEPARTMENT_HEAD');
  const [selectedPermissionCode, setSelectedPermissionCode] = useState<string>('VIEW_CHECKLIST');

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

      // Set default selected items
      if (rolesData.length > 0) {
        const firstNonAdmin = rolesData.find((r: Role) => r.code !== 'ADMIN');
        if (firstNonAdmin) {
          setSelectedRoleCode(firstNonAdmin.code);
        } else {
          setSelectedRoleCode(rolesData[0].code);
        }
      }
      if (permsData.length > 0) {
        setSelectedPermissionCode(permsData[0].code);
      }
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

  const handleToggleCategory = (roleCode: string, category: string, checked: boolean) => {
    if (roleCode === 'ADMIN') return;

    const categoryPermCodes = permissions
      .filter(p => p.category === category)
      .map(p => p.code);

    setEditedPermissions(prev => {
      const currentList = prev[roleCode] || [];
      let updatedList = currentList.filter(p => !categoryPermCodes.includes(p));
      
      if (checked) {
        updatedList = [...updatedList, ...categoryPermCodes];
      }

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
      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <style>{`
          .tooltip-container {
            position: relative;
            display: inline-flex;
            align-items: center;
          }
          .tooltip-text {
            visibility: hidden;
            width: 260px;
            background-color: #1a1a24;
            color: #e2e8f0;
            text-align: left;
            border-radius: 8px;
            padding: 10px 14px;
            position: absolute;
            z-index: 999;
            bottom: 130%;
            left: 50%;
            transform: translateX(-50%);
            opacity: 0;
            transition: opacity 0.2s, visibility 0.2s;
            font-size: 0.78rem;
            font-weight: 500;
            line-height: 1.45;
            border: 1px solid #3b82f640;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
            pointer-events: none;
            white-space: normal;
            font-family: inherit;
          }
          .tooltip-container:hover .tooltip-text {
            visibility: visible;
            opacity: 1;
          }
          .tooltip-text::after {
            content: "";
            position: absolute;
            top: 100%;
            left: 50%;
            margin-left: -5px;
            border-width: 5px;
            border-style: solid;
            border-color: #3b82f640 transparent transparent transparent;
          }
        `}</style>
        
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em', marginBottom: '4px' }}>
              Phân Quyền Vai Trò
            </h1>
            <p style={{ color: 'var(--text-secondary)' }}>
              Thiết lập ma trận chức năng và quyền hạn chi tiết cho từng nhóm tài khoản hệ thống.
            </p>
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleReset} 
                disabled={saving || loading || !hasChanges()}
                className="btn btn-secondary" 
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', opacity: hasChanges() ? 1 : 0.5 }}
              >
                <RotateCcw size={16} />
                <span>Hoàn tác</span>
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving || loading || !hasChanges()}
                className="btn btn-primary" 
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px', opacity: hasChanges() ? 1 : 0.5 }}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                <span>Lưu cấu hình</span>
              </button>
            </div>
          )}
        </div>

        {/* View Mode & Sub-Tab Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '12px' }}>
          
          {/* Sub-Tabs for Split Mode / Empty placeholder for Matrix Mode */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {viewMode === 'split' ? (
              <>
                <button
                  onClick={() => setActiveTab('by-role')}
                  style={{
                    padding: '12px 18px',
                    fontWeight: 750,
                    fontSize: '0.88rem',
                    color: activeTab === 'by-role' ? 'var(--color-accent)' : 'var(--text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'by-role' ? '3px solid var(--color-accent)' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    marginBottom: '-2px'
                  }}
                >
                  <Users size={16} />
                  <span>Phân quyền theo Vai trò</span>
                </button>
                <button
                  onClick={() => setActiveTab('by-permission')}
                  style={{
                    padding: '12px 18px',
                    fontWeight: 750,
                    fontSize: '0.88rem',
                    color: activeTab === 'by-permission' ? 'var(--color-accent)' : 'var(--text-secondary)',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: activeTab === 'by-permission' ? '3px solid var(--color-accent)' : '3px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s',
                    marginBottom: '-2px'
                  }}
                >
                  <Shield size={16} />
                  <span>Phân quyền theo Chức năng</span>
                </button>
              </>
            ) : (
              <div style={{ padding: '12px 18px', fontWeight: 750, fontSize: '0.88rem', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-2px', borderBottom: '3px solid var(--color-accent)' }}>
                <LayoutGrid size={16} />
                <span>Bảng so sánh Ma trận</span>
              </div>
            )}
          </div>

          {/* View Mode Toggle Controls */}
          <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '3px', marginBottom: '8px' }}>
            <button
              onClick={() => setViewMode('split')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: viewMode === 'split' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'split' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <Users size={13} />
              <span>Cấu hình chi tiết (2 cột)</span>
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                background: viewMode === 'matrix' ? 'var(--color-accent)' : 'transparent',
                color: viewMode === 'matrix' ? '#fff' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
            >
              <LayoutGrid size={13} />
              <span>Ma trận so sánh (Bảng)</span>
            </button>
          </div>

        </div>

        {/* Warning Banner */}
        <div className="glass-panel" style={{
          padding: '14px 18px',
          borderRadius: '12px',
          borderLeft: '4px solid var(--color-accent)',
          background: 'rgba(59, 130, 246, 0.03)',
          display: 'flex',
          gap: '12px',
          alignItems: 'center'
        }}>
          <AlertCircle size={18} color="var(--color-accent)" style={{ flexShrink: 0 }} />
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Vai trò <strong>Quản trị viên (ADMIN)</strong> luôn có quyền bypass toàn bộ hệ thống và không thể bị sửa đổi quyền hạn.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
            <Loader2 size={36} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
          </div>
        ) : (
          viewMode === 'split' ? (
            
            /* MODE 1: SPLIT 2-COLUMN VIEW (DETAILED EDITING) */
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }} className="permissions-grid-layout">
              
              {/* LEFT SIDE: LIST SELECTOR */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="glass-panel" style={{ padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 805, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em', margin: 0, marginBottom: '6px' }}>
                    {activeTab === 'by-role' ? 'Chọn Vai trò cấu hình' : 'Chọn Chức năng cấu hình'}
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '550px', overflowY: 'auto' }}>
                    {activeTab === 'by-role' ? (
                      roles.map(r => {
                        const isActive = selectedRoleCode === r.code;
                        const editedCount = editedPermissions[r.code]?.length || 0;

                        return (
                          <button
                            key={r.code}
                            onClick={() => setSelectedRoleCode(r.code)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '14px 16px',
                              borderRadius: '12px',
                              background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                              border: isActive ? '1.5px solid var(--color-accent)' : '1.5px solid var(--border-color)',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <span style={{ fontWeight: 700, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                {r.name}
                              </span>
                              {r.code === 'ADMIN' && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '2px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                  BYPASS
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Mã: {r.code} • {r.code === 'ADMIN' ? 'Toàn bộ quyền' : `${editedCount}/${permissions.length} quyền`}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      // Group permissions in selector list by category for cleaner browsing
                      categories.map(category => (
                        <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-accent)', padding: '4px 6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                            {category}
                          </span>
                          {permissions
                            .filter(p => p.category === category)
                            .map(p => {
                              const isActive = selectedPermissionCode === p.code;
                              const activeRolesCount = roles.filter(r => editedPermissions[r.code]?.includes(p.code) || r.code === 'ADMIN').length;

                              return (
                                <button
                                  key={p.code}
                                  onClick={() => setSelectedPermissionCode(p.code)}
                                  style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                                    border: isActive ? '1.5px solid var(--color-accent)' : '1.5px solid var(--border-color)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}
                                >
                                  <span style={{ fontWeight: 650, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.2 }}>
                                    {p.name}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    Cấp cho: {activeRolesCount}/{roles.length} vai trò
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT SIDE: CONFIGURATION DETAILS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* TAB 1 CONTENT: BY-ROLE CONFIG */}
                {activeTab === 'by-role' && (
                  (() => {
                    const roleObj = roles.find(r => r.code === selectedRoleCode);
                    if (!roleObj) return null;
                    const isRoleAdmin = roleObj.code === 'ADMIN';
                    const activeRolePerms = editedPermissions[roleObj.code] || [];

                    return (
                      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Cấu hình quyền cho: {roleObj.name}
                              </h2>
                              {isRoleAdmin && (
                                <span style={{ fontSize: '0.7rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontWeight: 800 }}>
                                  QUYỀN BYPASS HỆ THỐNG
                                </span>
                              )}
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                              Tích chọn các quyền hạn chức năng mà vai trò này được phép truy cập và thực thi.
                            </p>
                          </div>
                        </div>

                        {/* Permissions List Grouped by Category */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                          {categories.map(category => {
                            const categoryPerms = permissions.filter(p => p.category === category);
                            const assignedInCat = categoryPerms.filter(p => activeRolePerms.includes(p.code));
                            const isAllChecked = assignedInCat.length === categoryPerms.length;
                            const isSomeChecked = assignedInCat.length > 0 && !isAllChecked;

                            return (
                              <div key={category} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255, 255, 255, 0.005)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                                
                                {/* Category Header Row */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '6px' }}>
                                  <span style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {category}
                                  </span>
                                  
                                  {!isRoleAdmin && (
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                      <input
                                        type="checkbox"
                                        checked={isAllChecked}
                                        ref={el => {
                                          if (el) el.indeterminate = isSomeChecked;
                                        }}
                                        disabled={saving}
                                        onChange={(e) => handleToggleCategory(roleObj.code, category, e.target.checked)}
                                        style={{
                                          width: '15px',
                                          height: '15px',
                                          accentColor: 'var(--color-accent)',
                                          cursor: 'pointer'
                                        }}
                                      />
                                      <span>Chọn tất cả</span>
                                    </label>
                                  )}
                                </div>

                                {/* Category Permissions List */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                                  {categoryPerms.map(p => {
                                    const isChecked = activeRolePerms.includes(p.code) || isRoleAdmin;
                                    const isDisabled = isRoleAdmin || saving;

                                    return (
                                      <div 
                                        key={p.code} 
                                        onClick={() => !isDisabled && handleTogglePermission(roleObj.code, p.code)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'flex-start',
                                          gap: '12px',
                                          padding: '12px',
                                          borderRadius: '10px',
                                          background: isChecked ? 'rgba(59, 130, 246, 0.02)' : 'transparent',
                                          border: isChecked ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                                          cursor: isDisabled ? 'default' : 'pointer',
                                          transition: 'all 0.2s',
                                          userSelect: 'none'
                                        }}
                                        className={!isDisabled ? "checkbox-card-hover" : ""}
                                      >
                                        {isRoleAdmin ? (
                                          <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                                        ) : (
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isDisabled}
                                            onChange={() => {}} // Handled by card click
                                            style={{
                                              width: '18px',
                                              height: '18px',
                                              borderRadius: '5px',
                                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                                              accentColor: 'var(--color-accent)',
                                              marginTop: '2px',
                                              flexShrink: 0
                                            }}
                                          />
                                        )}
                                        
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                              {p.name}
                                            </span>
                                            <div className="tooltip-container" style={{ color: 'var(--text-muted)', cursor: 'help' }}>
                                              <Info size={13} />
                                              <span className="tooltip-text">
                                                {PERMISSION_DESCRIPTIONS[p.code] || 'Chưa có chú thích cho quyền này.'}
                                              </span>
                                            </div>
                                          </div>
                                          <code style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                            {p.code}
                                          </code>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* TAB 2 CONTENT: BY-PERMISSION CONFIG */}
                {activeTab === 'by-permission' && (
                  (() => {
                    const permObj = permissions.find(p => p.code === selectedPermissionCode);
                    if (!permObj) return null;

                    return (
                      <div className="glass-panel" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                                Chức năng: {permObj.name}
                              </h2>
                              <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--color-accent)', padding: '3px 8px', borderRadius: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                                {permObj.category}
                              </span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>
                              Chọn các nhóm vai trò được phép truy cập và thực thi chức năng này trong hệ thống.
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '6px 0 0 0', fontStyle: 'italic' }}>
                              Chi tiết: {PERMISSION_DESCRIPTIONS[permObj.code] || 'Chưa có chú thích cho quyền này.'}
                            </p>
                          </div>
                        </div>

                        {/* Roles List for this permission */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {roles.map(r => {
                            const isRoleAdmin = r.code === 'ADMIN';
                            const isChecked = editedPermissions[r.code]?.includes(permObj.code) || isRoleAdmin;
                            const isDisabled = isRoleAdmin || saving;

                            return (
                              <div 
                                key={r.code}
                                onClick={() => !isDisabled && handleTogglePermission(r.code, permObj.code)}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '16px 20px',
                                  borderRadius: '12px',
                                  background: isChecked ? 'rgba(59, 130, 246, 0.02)' : 'rgba(255, 255, 255, 0.005)',
                                  border: isChecked ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid var(--border-color)',
                                  cursor: isDisabled ? 'default' : 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                className={!isDisabled ? "checkbox-card-hover" : ""}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                    {r.name}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    Vai trò mã: {r.code}
                                  </span>
                                </div>

                                {isRoleAdmin ? (
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700
                                  }}>
                                    <Check size={12} />
                                    <span>Bypass</span>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isDisabled}
                                      onChange={() => {}} // Handled by card click
                                      style={{
                                        width: '20px',
                                        height: '20px',
                                        borderRadius: '6px',
                                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                                        accentColor: 'var(--color-accent)'
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

              </div>
            </div>
          ) : (
            
            /* MODE 2: MATRIX COMPARISON VIEW (FULL GRID TABLE) */
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
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                      {p.name}
                                    </span>
                                    <div className="tooltip-container" style={{ color: 'var(--text-muted)', cursor: 'help' }}>
                                      <Info size={13} />
                                      <span className="tooltip-text">
                                        {PERMISSION_DESCRIPTIONS[p.code] || 'Chưa có chú thích cho quyền này.'}
                                      </span>
                                    </div>
                                  </div>
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
          )
        )}
      </div>
    </ProtectedRoute>
  );
}
