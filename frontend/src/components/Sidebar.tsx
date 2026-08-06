'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  History,
  Settings,
  Building2,
  UserCheck,
  PanelLeftClose,
  Calendar,
  Clock,
  Bell,
  Cpu,
  ShieldAlert,
  HelpCircle,
  Activity,
  TrendingUp
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, isCollapsed = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, token, logout } = useAuth();
  const {
    canManageTemplates,
    isAdmin,
    canViewChecklist,
    isITDept,
    isTradeDept,
    canAccessHealthChecks
  } = usePermissions();

  const isTechAdmin = isAdmin || canAccessHealthChecks || (isITDept && user?.role !== 'STAFF');
  const isOperator = canViewChecklist || isTradeDept;

  interface SystemMetrics {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    totalMemoryGB: number;
    usedMemoryGB: number;
    tps: number;
    systemLoad: string;
  }
  const [metrics, setMetrics] = useState<SystemMetrics | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('mxv_sidebar_metrics');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });

  interface ChecklistProgress {
    completionPercentage: number;
    completedTasks: number;
    totalTasks: number;
  }
  const [progress, setProgress] = useState<ChecklistProgress | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('mxv_sidebar_progress');
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [showStatusCards, setShowStatusCards] = useState(true);

  useEffect(() => {
    const handleToggle = () => {
      const saved = localStorage.getItem('mxv_sidebar_show_status');
      setShowStatusCards(saved !== 'false');
    };
    handleToggle();
    window.addEventListener('sidebar-status-toggle', handleToggle);
    return () => window.removeEventListener('sidebar-status-toggle', handleToggle);
  }, []);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}n ${h}g ${m}p`;
    if (h > 0) return `${h}g ${m}p`;
    return `${m}p`;
  };

  useEffect(() => {
    if (!token) return;

    const fetchMetrics = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/system-status`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
          sessionStorage.setItem('mxv_sidebar_metrics', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Error fetching system metrics:', err);
      }
    };

    const fetchProgress = async () => {
      try {
        const now = new Date();
        const vietnamTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
        const todayStr = vietnamTime.toISOString().split('T')[0];

        const res = await fetch(`${API_BASE_URL}/api/v1/dashboard/summary?date=${todayStr}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const progressData = {
            completionPercentage: data.completionPercentage,
            completedTasks: data.completedTasks,
            totalTasks: data.totalTasks
          };
          setProgress(progressData);
          sessionStorage.setItem('mxv_sidebar_progress', JSON.stringify(progressData));
        }
      } catch (err) {
        console.warn('Error fetching checklist progress:', err);
      }
    };

    let metricsInterval: NodeJS.Timeout | null = null;
    let progressInterval: NodeJS.Timeout | null = null;

    if (isTechAdmin) {
      fetchMetrics();
      metricsInterval = setInterval(fetchMetrics, 15000);
    }
    
    if (isOperator) {
      fetchProgress();
      progressInterval = setInterval(fetchProgress, 30000);
    }

    return () => {
      if (metricsInterval) clearInterval(metricsInterval);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, [token, isTechAdmin, isOperator]);

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
      case 'DIVISION_DIRECTOR': return 'badge badge-high';
      case 'DEPARTMENT_HEAD': return 'badge badge-medium';
      default: return 'badge badge-low';
    }
  };

  if (!user) return null;

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
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
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          zIndex: 10
        }}
        className="sidebar-mobile-close"
      >
        <PanelLeftClose size={20} />
      </button>

      {/* Brand Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        gap: isCollapsed ? '0' : '12px',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-color)',
        minHeight: '57px',
        flexShrink: 0
      }}>
        <div style={{
          width: '46px',
          height: '46px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <img
            src="/logomxv.svg"
            alt="MXV Logo"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
        <div className="sidebar-header-text">
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
            OPERATE CHECKLIST
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 600 }}>
            MXV SHIFT SYSTEM
          </span>
        </div>
      </div>
      {/* User profile widget - Hidden on desktop to avoid duplicate with Header, shown on mobile */}
      <div className="glass-panel sidebar-user-details" style={{
        padding: '16px',
        borderRadius: '12px',
        marginBottom: '20px',
        textAlign: 'left',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        display: isCollapsed ? 'none' : 'block',
        flexShrink: 0
      }}>
        <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.fullName}
        </p>
        <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.role === 'ADMIN' || user.role === 'CEO' || user.role === 'CHAIRMAN' || user.role === 'DIVISION_DIRECTOR'
            ? 'Ban Lãnh Đạo'
            : user.department?.name || 'Chưa phân phòng'}
        </p>
        <span className={getRoleBadgeClass(user.role)}>
          {getRoleName(user.role)}
        </span>
      </div>

      {/* Menu links */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto', overflowX: 'hidden', minHeight: '120px', marginBottom: '16px' }}>

        {/* Section Header */}
        <div className="sidebar-section-header" style={{
          fontSize: '0.68rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--text-muted)',
          margin: '12px 0 6px 16px',
          display: isCollapsed ? 'none' : 'block'
        }}>
          Giám sát
        </div>

        <Link
          href="/dashboard"
          onClick={onClose}
          className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}
          title={isCollapsed ? "Tổng quan giám sát" : undefined}
        >
          <LayoutDashboard size={18} style={{ flexShrink: 0 }} />
          <span>Tổng quan</span>
        </Link>
        {canViewChecklist && (
          <>
            <Link
              href="/checklist"
              onClick={onClose}
              className={`nav-link ${pathname === '/checklist' ? 'active' : ''}`}
              title={isCollapsed ? "Ca trực hiện tại" : undefined}
            >
              <CheckSquare size={18} style={{ flexShrink: 0 }} />
              <span>Ca trực hiện tại</span>
            </Link>
            <Link
              href="/history"
              onClick={onClose}
              className={`nav-link ${pathname === '/history' ? 'active' : ''}`}
              title={isCollapsed ? "Tra cứu lịch sử" : undefined}
            >
              <History size={18} style={{ flexShrink: 0 }} />
              <span>Tra cứu lịch sử</span>
            </Link>
          </>
        )}
        <Link
          href="/settings"
          onClick={onClose}
          className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
          title={isCollapsed ? "Cấu hình cá nhân" : undefined}
        >
          <Settings size={18} style={{ flexShrink: 0 }} />
          <span>Cấu hình</span>
        </Link>

        {canManageTemplates && (
          <>
            <div className="sidebar-section-header" style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              margin: '20px 0 6px 16px',
              display: isCollapsed ? 'none' : 'block'
            }}>
              Quản trị hệ thống
            </div>

            {isAdmin && (
              <>
                <Link
                  href="/admin/departments"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/departments') ? 'active' : ''}`}
                  title={isCollapsed ? "Quản lý phòng ban" : undefined}
                >
                  <Building2 size={18} style={{ flexShrink: 0 }} />
                  <span>Quản lý phòng ban</span>
                </Link>
                <Link
                  href="/admin/users"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/users') ? 'active' : ''}`}
                  title={isCollapsed ? "Quản lý tài khoản" : undefined}
                >
                  <UserCheck size={18} style={{ flexShrink: 0 }} />
                  <span>Quản lý tài khoản</span>
                </Link>
                <Link
                  href="/admin/shift-slots"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/shift-slots') ? 'active' : ''}`}
                  title={isCollapsed ? "Cấu hình ca trực" : undefined}
                >
                  <Clock size={18} style={{ flexShrink: 0 }} />
                  <span>Cấu hình ca trực</span>
                </Link>
                <Link
                  href="/admin/bot-config"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/bot-config') ? 'active' : ''}`}
                  title={isCollapsed ? "Cấu hình Bot/RPA" : undefined}
                >
                  <Cpu size={18} style={{ flexShrink: 0 }} />
                  <span>Cấu hình Bot/RPA</span>
                </Link>
              </>
            )}

            <Link
              href="/admin/templates"
              onClick={onClose}
              className={`nav-link ${pathname.startsWith('/admin/templates') ? 'active' : ''}`}
              title={isCollapsed ? "Mẫu checklist" : undefined}
            >
              <Settings size={18} style={{ flexShrink: 0 }} />
              <span>Mẫu checklist</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  href="/admin/calendar"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/calendar') ? 'active' : ''}`}
                  title={isCollapsed ? "Lịch giao dịch" : undefined}
                >
                  <Calendar size={18} style={{ flexShrink: 0 }} />
                  <span>Lịch giao dịch</span>
                </Link>
                <Link
                  href="/admin/notifications"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/notifications') ? 'active' : ''}`}
                  title={isCollapsed ? "Cấu hình thông báo" : undefined}
                >
                  <Bell size={18} style={{ flexShrink: 0 }} />
                  <span>Cấu hình thông báo</span>
                </Link>
                <Link
                  href="/admin/permissions"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/permissions') ? 'active' : ''}`}
                  title={isCollapsed ? "Phân quyền vai trò" : undefined}
                >
                  <ShieldAlert size={18} style={{ flexShrink: 0 }} />
                  <span>Phân quyền vai trò</span>
                </Link>
                <Link
                  href="/admin/activity-logs"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/activity-logs') ? 'active' : ''}`}
                  title={isCollapsed ? "Nhật ký hệ thống" : undefined}
                >
                  <Activity size={18} style={{ flexShrink: 0 }} />
                  <span>Nhật ký hệ thống</span>
                </Link>
              </>
            )}
          </>
        )}

      </nav>

      {/* Sidebar Uptime Status Card or User Guide Link Card */}
      {!isCollapsed && showStatusCards && (
        <>
          {isTechAdmin && (
            <div className="sidebar-status-card" style={{
              marginTop: '0px',
              marginBottom: '16px',
              flexShrink: 0,
              background: 'rgba(16, 185, 129, 0.03)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              padding: '12px',
              borderRadius: '12px',
              marginRight: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    background: '#10b981',
                    borderRadius: '50%',
                    boxShadow: '0 0 8px #10b981'
                  }} />
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    Hệ thống ổn định
                  </strong>
                </div>
                <Cpu size={14} color="#10b981" style={{ opacity: 0.8 }} />
              </div>
              
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Uptime:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {metrics ? formatUptime(metrics.uptime) : 'Đang tải...'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>TPS:</span>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {metrics ? metrics.tps.toLocaleString() : '---'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>CPU:</span>
                  <span style={{ fontWeight: 600, color: metrics && metrics.cpuUsage > 80 ? '#ef4444' : 'var(--text-primary)' }}>
                    {metrics ? `${metrics.cpuUsage}%` : '---'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>RAM:</span>
                    <span>{metrics ? `${metrics.usedMemoryGB} / ${metrics.totalMemoryGB} GB` : '---'}</span>
                  </div>
                  {/* Memory usage bar */}
                  <div style={{ width: '100%', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      width: metrics ? `${metrics.memoryUsage}%` : '0%',
                      height: '100%',
                      background: metrics && metrics.memoryUsage > 80 ? '#ef4444' : '#10b981',
                      transition: 'width 0.5s ease-in-out'
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {isOperator && (
            <div className="sidebar-status-card" style={{
              marginTop: '0px',
              marginBottom: '16px',
              flexShrink: 0,
              background: 'rgba(59, 130, 246, 0.03)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              padding: '12px',
              borderRadius: '12px',
              marginRight: '24px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={14} color="#3b82f6" />
                  <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
                    Tiến độ ca trực
                  </strong>
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#3b82f6',
                  background: 'rgba(59, 130, 246, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {progress ? `${progress.completionPercentage}%` : '0%'}
                </span>
              </div>

              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Hoàn thành:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                    {progress ? `${progress.completedTasks} / ${progress.totalTasks}` : '0 / 0'} công việc
                  </span>
                </div>
                
                {/* Progress bar */}
                <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{
                    width: progress ? `${progress.completionPercentage}%` : '0%',
                    height: '100%',
                    background: '#3b82f6',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease-in-out'
                  }} />
                </div>
              </div>
            </div>
          )}

          {!isTechAdmin && !isOperator && (
            <Link
              href="/guide"
              onClick={onClose}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '14px',
                borderRadius: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                background: 'rgba(59, 130, 246, 0.03)',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.2s',
                flexShrink: 0,
                marginRight: '24px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HelpCircle size={16} color="var(--color-accent)" />
                <strong style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                  Hướng Dẫn Sử Dụng
                </strong>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                Xem hướng dẫn chi tiết quy trình bàn giao ca và đối chiếu dữ liệu.
              </p>
            </Link>
          )}
        </>
      )}


      <style dangerouslySetInnerHTML={{
        __html: `
        @media (max-width: 1023px) {
          .sidebar-mobile-close {
            display: flex !important;
          }
        }
        @media (min-width: 1024px) {
          .sidebar-user-details {
            display: none !important;
          }
        }
      `}} />
    </div>
  );
}
