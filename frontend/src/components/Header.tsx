'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import { 
  Sun, 
  Moon, 
  Search, 
  Minus, 
  Plus, 
  ChevronDown, 
  LogOut, 
  Settings, 
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  FileText,
  Loader2,
  BookOpen
} from 'lucide-react';
import Link from 'next/link';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobileSidebar: () => void;
}

export default function Header({ isCollapsed, onToggleCollapse, onOpenMobileSidebar }: HeaderProps) {
  const { user, token, logout, updateUser, theme, changeTheme } = useAuth();
  const [zoom, setZoom] = useState<number>(100);
  const [searchVal, setSearchVal] = useState('');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  
  // Search States
  const [searchResults, setSearchResults] = useState<{
    incidents: any[];
    tasks: any[];
    handovers: any[];
  }>({ incidents: [], tasks: [], handovers: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  // Debounced API Search Query
  useEffect(() => {
    if (!searchVal.trim()) {
      setSearchResults({ incidents: [], tasks: [], handovers: [] });
      setShowSearchResults(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      setShowSearchResults(true);
      try {
        const res = await fetch(`${API_BASE_URL || 'http://localhost:3001'}/api/v1/shifts/search/global?q=${encodeURIComponent(searchVal)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (error) {
        console.error('Error fetching global search results:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 400);

    return () => clearTimeout(delayDebounceFn);
  }, [searchVal, token]);

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
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
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
        <div ref={searchContainerRef} style={{ position: 'relative', width: '100%', maxWidth: '380px' }} className="hidden sm:block">
          <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            <Search size={16} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="form-input"
            placeholder="Tìm kiếm sự cố, biên bản..."
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
            onFocus={() => {
              if (searchVal.trim()) {
                setShowSearchResults(true);
              }
            }}
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

          {/* Global Search Results Dropdown */}
          {showSearchResults && searchVal.trim() && (
            <div 
              className="glass-panel" 
              style={{
                position: 'absolute',
                top: '42px',
                left: 0,
                width: '100%',
                maxHeight: '380px',
                overflowY: 'auto',
                background: 'var(--bg-sidebar)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--glass-shadow)',
                padding: '12px',
                zIndex: 150,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {searchLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px', color: 'var(--text-secondary)' }}>
                  <Loader2 className="animate-spin" size={16} />
                  <span style={{ fontSize: '0.85rem' }}>Đang tìm kiếm...</span>
                </div>
              ) : (
                <>
                  {/* Empty state */}
                  {searchResults.incidents.length === 0 && 
                   searchResults.tasks.length === 0 && 
                   searchResults.handovers.length === 0 ? (
                    <div style={{ padding: '12px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Không tìm thấy kết quả phù hợp.
                    </div>
                  ) : (
                    <>
                      {/* Incidents Section */}
                      {searchResults.incidents.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-critical)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <AlertTriangle size={12} />
                            Sự cố ({searchResults.incidents.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {searchResults.incidents.map((inc) => (
                              <Link 
                                href={`/checklist?id=${inc.shiftLogId?._id || inc.shiftLogId}`}
                                key={inc._id}
                                onClick={() => setShowSearchResults(false)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  transition: 'background 0.2s',
                                }}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  [{inc.code}] {inc.requiredAction}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {inc.shiftLogId?.templateId?.title || 'Ca trực'} • {inc.shiftLogId?.shiftDate || ''}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks Section */}
                      {searchResults.tasks.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <FileText size={12} />
                            Tác vụ ({searchResults.tasks.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {searchResults.tasks.map((task, idx) => (
                              <Link 
                                href={`/checklist?id=${task.shiftLogId}`}
                                key={idx}
                                onClick={() => setShowSearchResults(false)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  transition: 'background 0.2s',
                                }}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                  [{task.taskId}] {task.taskName}
                                </span>
                                {task.note && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                    Chú thích: {task.note}
                                  </span>
                                )}
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {task.shiftTitle} • {task.shiftDate}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Handovers Section */}
                      {searchResults.handovers.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                            <BookOpen size={12} />
                            Biên bản bàn giao ({searchResults.handovers.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {searchResults.handovers.map((h, idx) => (
                              <Link 
                                href={`/checklist?id=${h.shiftLogId}`}
                                key={idx}
                                onClick={() => setShowSearchResults(false)}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  padding: '8px',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  transition: 'background 0.2s',
                                }}
                                className="hover:bg-slate-100 dark:hover:bg-slate-800"
                              >
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {h.handoverNote}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {h.shiftTitle} • {h.shiftDate}
                                </span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
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
        <NotificationDropdown />

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
