'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Search, 
  Minus, 
  Plus, 
  Bell, 
  ChevronDown, 
  LogOut, 
  Settings, 
  User as UserIcon,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileSidebar: () => void;
}

export default function Header({ isCollapsed, onToggleCollapse, onOpenMobileSidebar }: HeaderProps) {
  const { user, token, logout, updateUser } = useAuth();
  const [zoom, setZoom] = useState<number>(100);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [searchVal, setSearchVal] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);

  // Sync theme
  useEffect(() => {
    const dbTheme = user?.settings?.theme;
    const savedTheme = dbTheme || (localStorage.getItem('mxv_theme') as 'light' | 'dark') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, [user?.settings?.theme]);

  // Handle Ctrl+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Zoom change
  const handleZoom = (type: 'in' | 'out' | 'reset') => {
    let newZoom = zoom;
    if (type === 'in') {
      newZoom = Math.min(zoom + 10, 120);
    } else if (type === 'out') {
      newZoom = Math.max(zoom - 10, 80);
    } else {
      newZoom = 100;
    }
    setZoom(newZoom);
    // Apply zoom on body or root document
    if (typeof document !== 'undefined') {
      // Modern browsers support standard CSS zoom (Chrome/Edge/Safari)
      (document.body.style as any).zoom = `${newZoom}%`;
    }
  };

  // Toggle Theme
  const changeTheme = async (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('mxv_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileDropdown(false);
      }
      if (notifyRef.current && !notifyRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Format date in Vietnamese
  const getFormattedDate = () => {
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const now = new Date();
    const dayName = days[now.getDay()];
    const date = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    return `${dayName}, ${date} tháng ${month} năm ${year}`;
  };

  // Get user name initials
  const getUserInitials = (name: string = '') => {
    if (!name) return 'MXV';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getRoleLabel = (role: string = '') => {
    switch (role) {
      case 'ADMIN': return 'Risk Officer / Admin';
      case 'DEPARTMENT_HEAD': return 'Trưởng bộ phận';
      case 'DIVISION_DIRECTOR': return 'Giám đốc Khối';
      case 'STAFF': return 'Risk Staff';
      default: return role;
    }
  };

  return (
    <header className="app-header">
      {/* Left side: Toggle sidebar and Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
        {/* Toggle for Desktop */}
        <button 
          onClick={onToggleCollapse}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="desktop-toggle hover:bg-slate-100 dark:hover:bg-slate-800"
          title={isCollapsed ? 'Mở rộng sidebar' : 'Thu nhỏ sidebar'}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>

        {/* Toggle for Mobile */}
        <button 
          onClick={onOpenMobileSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="mobile-toggle hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <PanelLeftOpen size={20} />
        </button>

        {/* Search Input bar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }} className="hidden sm:block">
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <Search size={16} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="form-input"
            placeholder="Mã GD, tài khoản, thành viên..."
            style={{ 
              paddingLeft: '38px', 
              paddingRight: '64px', 
              fontSize: '0.85rem',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-input)'
            }}
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
          <div style={{ 
            position: 'absolute', 
            right: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            background: 'rgba(128,128,128,0.1)',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            fontSize: '0.7rem',
            padding: '2px 6px',
            color: 'var(--text-muted)',
            fontWeight: 600,
            pointerEvents: 'none'
          }}>
            Ctrl+K
          </div>
        </div>
      </div>

      {/* Right side controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Zoom controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px', 
          padding: '4px 8px',
          background: 'var(--bg-card)'
        }} className="hidden md:flex">
          <button 
            onClick={() => handleZoom('out')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
            disabled={zoom <= 80}
            title="Thu nhỏ"
          >
            <Minus size={14} />
          </button>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, minWidth: '38px', textAlign: 'center' }}>
            {zoom}%
          </span>
          <button 
            onClick={() => handleZoom('in')}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' }}
            disabled={zoom >= 120}
            title="Phóng to"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* Theme select controls */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          border: '1px solid var(--border-color)', 
          borderRadius: '8px', 
          padding: '3px',
          background: 'var(--bg-card)'
        }}>
          <button 
            onClick={() => changeTheme('light')}
            style={{ 
              background: theme === 'light' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              color: theme === 'light' ? 'var(--color-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Chế độ sáng"
          >
            <Sun size={15} />
          </button>
          <button 
            onClick={() => changeTheme('dark')}
            style={{ 
              background: theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              border: 'none',
              color: theme === 'dark' ? 'var(--color-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              padding: '5px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Chế độ tối"
          >
            <Moon size={15} />
          </button>
        </div>

        {/* Live Date Indicator */}
        <div style={{ 
          fontSize: '0.85rem', 
          fontWeight: 500, 
          color: 'var(--text-secondary)',
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: '16px'
        }} className="hidden lg:block">
          {getFormattedDate()}
        </div>

        {/* Notifications Tray */}
        <div ref={notifyRef} style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-color)', 
              color: 'var(--text-primary)', 
              cursor: 'pointer', 
              padding: '8px', 
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              position: 'relative'
            }}
            className="hover:border-slate-300 dark:hover:border-slate-700"
          >
            <Bell size={16} />
            <span style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.65rem',
              fontWeight: 700,
              width: '16px',
              height: '16px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--bg-sidebar)'
            }}>
              3
            </span>
          </button>

          {showNotifications && (
            <div className="glass-panel" style={{
              position: 'absolute',
              right: 0,
              top: '46px',
              width: '320px',
              background: 'var(--bg-sidebar)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: 'var(--glass-shadow)',
              padding: '16px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Thông báo mới</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-accent)', cursor: 'pointer' }}>Đánh dấu đã đọc</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                <div style={{ fontSize: '0.8rem', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px 0' }}>Ca trực IT mở cửa</p>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nguyễn Văn Sơn vừa bắt đầu ca trực mới.</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>2 phút trước</span>
                </div>
                <div style={{ fontSize: '0.8rem', paddingBottom: '8px', borderBottom: '1px dashed var(--border-color)' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px 0' }}>Cảnh báo rủi ro cao</p>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Checklist chốt phiên giao dịch ghi nhận 2 lỗi.</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>1 giờ trước</span>
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  <p style={{ fontWeight: 600, margin: '0 0 2px 0' }}>Bàn giao hoàn tất</p>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Ca trực ngày 18/06 đã được phê duyệt.</p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Hôm qua</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User profile dropdown widget */}
        <div ref={profileRef} style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '10px', 
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '8px'
            }}
            className="hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {/* Initials Avatar */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--color-accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.875rem',
              boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)'
            }}>
              {getUserInitials(user?.fullName)}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }} className="hidden sm:flex">
              <span style={{ fontSize: '0.85rem', fontWeight: 700, lineHeight: 1.2 }}>
                {user?.fullName}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1 }}>
                {getRoleLabel(user?.role)}
              </span>
            </div>
            
            <ChevronDown size={14} color="var(--text-secondary)" className="hidden sm:block" />
          </div>

          {showProfileDropdown && (
            <div className="glass-panel" style={{
              position: 'absolute',
              right: 0,
              top: '46px',
              width: '180px',
              background: 'var(--bg-sidebar)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              boxShadow: 'var(--glass-shadow)',
              padding: '6px',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <Link href="/settings" onClick={() => setShowProfileDropdown(false)} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                textDecoration: 'none',
                borderRadius: '8px'
              }} className="hover:bg-slate-100 dark:hover:bg-slate-800">
                <Settings size={14} />
                <span>Cấu hình cá nhân</span>
              </Link>
              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />
              <button 
                onClick={() => {
                  setShowProfileDropdown(false);
                  logout();
                }} 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  color: '#ef4444',
                  background: 'transparent',
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: '8px'
                }}
                className="hover:bg-red-50 dark:hover:bg-red-950/20"
              >
                <LogOut size={14} />
                <span>Đăng xuất</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1024px) {
          .desktop-toggle {
            display: flex !important;
          }
          .mobile-toggle {
            display: none !important;
          }
        }
        @media (max-width: 1023px) {
          .desktop-toggle {
            display: none !important;
          }
          .mobile-toggle {
            display: flex !important;
          }
        }
      `}} />
    </header>
  );
}
