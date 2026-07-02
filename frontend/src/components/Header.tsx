'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Sun, 
  Moon, 
  Search, 
  Minus, 
  Plus, 
  Bell, 
  ChevronDown, 
  LogOut, 
  Settings, 
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import Link from 'next/link';
import { io } from 'socket.io-client';

interface HeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileSidebar: () => void;
}

export default function Header({ isCollapsed, onToggleCollapse, onOpenMobileSidebar }: HeaderProps) {
  const { user, token, logout, updateUser, theme, changeTheme } = useAuth();
  const [zoom, setZoom] = useState<number>(100);
  const [searchVal, setSearchVal] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifyRef = useRef<HTMLDivElement>(null);

  // Dynamic system activities for notifications
  const [activities, setActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [lastClearedTime, setLastClearedTime] = useState<string | null>(null);
  const [lastReadTime, setLastReadTime] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLastClearedTime(localStorage.getItem('lastClearedNotificationsTime'));
      setLastReadTime(localStorage.getItem('lastReadNotificationsTime'));
    }
  }, []);

  const handleClearAll = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem('lastClearedNotificationsTime', nowStr);
    setLastClearedTime(nowStr);
    setHasUnread(false);
  };

  const handleMarkAsRead = () => {
    const nowStr = new Date().toISOString();
    localStorage.setItem('lastReadNotificationsTime', nowStr);
    setLastReadTime(nowStr);
    setHasUnread(false);
  };

  const fetchActivities = useCallback(async () => {
    if (!token) return;
    setLoadingActivities(true);
    try {
      const now = new Date();
      const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
      const todayStr = vietnamTime.toISOString().split('T')[0];

      const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/activity?date=${todayStr}&limit=10`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
        const clearedTime = localStorage.getItem('lastClearedNotificationsTime');
        const readTime = localStorage.getItem('lastReadNotificationsTime');
        const hasNew = data.some((act: any) => {
          const actTime = new Date(act.createdAt).getTime();
          const isNotCleared = !clearedTime || actTime > new Date(clearedTime).getTime();
          const isNotRead = !readTime || actTime > new Date(readTime).getTime();
          return isNotCleared && isNotRead;
        });
        if (hasNew && !showNotifications) {
          setHasUnread(true);
        } else {
          setHasUnread(false);
        }
      }
    } catch (err) {
      console.error('Error fetching header activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  }, [token, showNotifications]);

  useEffect(() => {
    if (showNotifications) {
      fetchActivities();
    }
  }, [showNotifications, fetchActivities]);

  // Fallback Polling (updates every 30 seconds as safety fallback)
  useEffect(() => {
    fetchActivities();
    const interval = setInterval(() => {
      fetchActivities();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchActivities]);

  // WebSockets Real-time Synchronization for Notifications
  useEffect(() => {
    if (!token) return;

    const socket = io(API_BASE_URL, {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      console.log('Connected to socket gateway from Header (Notifications)');
    });

    const handleUpdateEvent = (payload: any) => {
      console.log('Notification update event received via WS:', payload);
      fetchActivities();
    };

    socket.on('dashboard-updated', handleUpdateEvent);
    socket.on('task-updated', handleUpdateEvent);
    socket.on('shift-job-generated', handleUpdateEvent);
    socket.on('shift-job-closed', handleUpdateEvent);

    return () => {
      socket.disconnect();
    };
  }, [token, fetchActivities]);

  const formatTimeElapsed = (dateStr: string) => {
    const now = new Date();
    const created = new Date(dateStr);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} giờ trước`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ngày trước`;
  };

  // Filter out cleared notifications
  const displayedActivities = activities.filter(act => {
    if (!lastClearedTime) return true;
    return new Date(act.createdAt).getTime() > new Date(lastClearedTime).getTime();
  });

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

  // Set initial zoom property on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('--app-zoom', '1');
    }
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
      document.body.style.setProperty('--app-zoom', (newZoom / 100).toString());
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
            onClick={() => {
              setShowNotifications(!showNotifications);
              if (!showNotifications) {
                handleMarkAsRead();
              }
            }}
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
            {hasUnread && displayedActivities.length > 0 && (
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
                {displayedActivities.length}
              </span>
            )}
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
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span 
                    onClick={handleMarkAsRead} 
                    style={{ fontSize: '0.75rem', color: 'var(--color-accent)', cursor: 'pointer' }}
                  >
                    Đánh dấu đã đọc
                  </span>
                  <span 
                    onClick={handleClearAll} 
                    style={{ fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer' }}
                  >
                    Xóa tất cả
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                {loadingActivities ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Đang tải thông báo...
                  </div>
                ) : displayedActivities.length === 0 ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    Không có hoạt động nào hôm nay.
                  </div>
                ) : (
                  displayedActivities.map((act, idx) => {
                    let title = 'Cập nhật hệ thống';
                    if (act.type === 'TASK_UPDATED') {
                      title = 'Cập nhật tác vụ';
                    } else if (act.type === 'JOB_GENERATED') {
                      title = 'Khởi tạo ca trực';
                    }

                    const isLast = idx === displayedActivities.length - 1;

                    return (
                      <div 
                        key={act.id || idx} 
                        style={{ 
                          fontSize: '0.8rem', 
                          paddingBottom: isLast ? '0' : '8px', 
                          borderBottom: isLast ? 'none' : '1px dashed var(--border-color)' 
                        }}
                      >
                        <p style={{ fontWeight: 600, margin: '0 0 2px 0', color: 'var(--text-primary)' }}>{title}</p>
                        <p style={{ color: 'var(--text-secondary)', margin: '0 0 4px 0', lineHeight: '1.3' }}>
                          {act.message}
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {act.actorName || 'Hệ thống'}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {formatTimeElapsed(act.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
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
