'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  History, 
  Users, 
  Settings, 
  LogOut, 
  Sun, 
  Moon,
  ShieldAlert,
  Building2,
  UserCheck,
  X
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, token, updateUser } = useAuth();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Sync theme with user account settings from DB or fallback to localStorage
    const dbTheme = user?.settings?.theme;
    const savedTheme = dbTheme || (localStorage.getItem('mxv_theme') as 'dark' | 'light');
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, [user?.settings?.theme]);

  const toggleTheme = async () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('mxv_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    // Persist theme to database if user is logged in
    if (user && token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            settings: {
              ...user.settings,
              theme: newTheme
            }
          })
        });
        if (res.ok) {
          const updatedUser = await res.json();
          updateUser(updatedUser);
        }
      } catch (err) {
        console.error('Failed to sync theme to DB:', err);
      }
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

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'badge badge-critical';
      case 'CHAIRMAN': return 'badge badge-high';
      case 'CEO': return 'badge badge-high';
      case 'DIVISION_DIRECTOR': return 'badge badge-medium';
      case 'DEPARTMENT_HEAD': return 'badge badge-medium';
      default: return 'badge badge-low';
    }
  };

  if (!user) return null;

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Mobile Close Button */}
      <button 
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px'
        }}
        className="md:hidden"
      >
        <X size={20} />
      </button>

      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '32px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          background: 'rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(59, 130, 246, 0.3)'
        }}>
          <ShieldAlert size={20} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>MXV CHECKLIST</h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Operations Portal</span>
        </div>
      </div>

      {/* User profile widget */}
      <div className="glass-panel" style={{
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '24px',
        textAlign: 'left',
        border: '1px solid rgba(255, 255, 255, 0.04)'
      }}>
        <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
          {user.fullName}
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4 }}>
          {user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'CHAIRMAN'
            ? 'Ban Lãnh Đạo / Admin'
            : user.division
              ? `${user.division.name}${user.department ? ` - ${user.department.name}` : ''}`
              : user.department?.name || 'Chưa phân phòng'}
        </p>
        <span className={getRoleBadgeClass(user.role)}>
          {getRoleName(user.role)}
        </span>
      </div>

      {/* Menu links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <Link href="/dashboard" onClick={onClose} className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
          <LayoutDashboard size={18} />
          <span>Bảng điều khiển</span>
        </Link>
        <Link href="/checklist" onClick={onClose} className={`nav-link ${pathname === '/checklist' ? 'active' : ''}`}>
          <CheckSquare size={18} />
          <span>Ca trực hiện tại</span>
        </Link>
        <Link href="/history" onClick={onClose} className={`nav-link ${pathname === '/history' ? 'active' : ''}`}>
          <History size={18} />
          <span>Tra cứu lịch sử</span>
        </Link>
        <Link href="/settings" onClick={onClose} className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}>
          <Settings size={18} />
          <span>Cấu hình cá nhân</span>
        </Link>

        {['ADMIN', 'CHAIRMAN', 'CEO', 'DIVISION_DIRECTOR', 'DEPARTMENT_HEAD'].includes(user.role) && (
          <>
            <div style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              margin: '20px 0 8px 16px'
            }}>
              Quản trị hệ thống
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <Link href="/admin/departments" onClick={onClose} className={`nav-link ${pathname.startsWith('/admin/departments') ? 'active' : ''}`}>
                <Building2 size={18} />
                <span>Quản lý phòng ban</span>
              </Link>
              <Link href="/admin/users" onClick={onClose} className={`nav-link ${pathname.startsWith('/admin/users') ? 'active' : ''}`}>
                <UserCheck size={18} />
                <span>Quản lý tài khoản</span>
              </Link>
              <Link href="/admin/templates" onClick={onClose} className={`nav-link ${pathname.startsWith('/admin/templates') ? 'active' : ''}`}>
                <Settings size={18} />
                <span>Mẫu checklist</span>
              </Link>
            </div>
          </>
        )}
      </nav>

      {/* Bottom widgets */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        paddingTop: '20px',
        borderTop: '1px solid var(--border-color)',
        marginTop: '20px'
      }}>
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 16px' }}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span>{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
        </button>

        <button 
          onClick={() => {
            if (onClose) onClose();
            logout();
          }}
          className="btn btn-secondary" 
          style={{ width: '100%', justifyContent: 'flex-start', color: '#ef4444', padding: '10px 16px' }}
        >
          <LogOut size={18} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
