'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
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
  TrendingUp,
  FileSpreadsheet,
  KeyRound,
  Layers,
  ArrowLeftRight,
  Sunrise,
  ChevronDown,
  ChevronRight,
  Database,
  BarChart3,
  Sliders,
  Folder,
  FolderTree,
  Terminal,
  ShieldCheck,
} from 'lucide-react';


import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, isCollapsed = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, token, logout } = useAuth();
  const {
    canManageTemplates,
    isAdmin,
    canViewChecklist,
    isITDept,
    isTradeDept,
    isQlgd,
    canAccessHealthChecks
  } = usePermissions();

  const isTechAdmin = isAdmin || canAccessHealthChecks || (isITDept && user?.role !== 'STAFF');
  const isOperator = canViewChecklist || isTradeDept;

  // Trạng thái override dành riêng cho Admin để kiểm thử nhanh giữa 2 sidebar
  const [adminOverrideQlgd, setAdminOverrideQlgd] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mxv_sidebar_override') === 'QLGD';
    }
    return false;
  });

  const showQlgdSidebar = isQlgd || (isAdmin && adminOverrideQlgd);

  // Trạng thái đóng/mở submenu cho Backup, Thống kê và Tham số hệ thống
  const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({
    backup: true,
    stats: true,
    params: true,
  });

  useEffect(() => {
    if (pathname.startsWith('/trading-manager/backup')) {
      setOpenSubMenus((prev) => ({ ...prev, backup: true }));
    }
    if (pathname.startsWith('/trading-manager/statistics')) {
      setOpenSubMenus((prev) => ({ ...prev, stats: true }));
    }
    if (pathname.startsWith('/trading-manager/settings')) {
      setOpenSubMenus((prev) => ({ ...prev, params: true }));
    }
  }, [pathname]);

  const toggleSubMenu = (menuKey: string) => {
    setOpenSubMenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  // Flyout menu state for Collapsed Sidebar hover
  const [mounted, setMounted] = useState<boolean>(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  interface FlyoutItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
  }

  interface FlyoutData {
    title: string;
    top: number;
    left: number;
    items: FlyoutItem[];
  }

  const [flyoutData, setFlyoutData] = useState<FlyoutData | null>(null);
  const flyoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleItemMouseEnter = (
    e: React.MouseEvent<HTMLElement>,
    title: string,
    items: FlyoutItem[]
  ) => {
    if (!isCollapsed) return;
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
      flyoutTimerRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const approxHeight = 44 + items.length * 38;
    const maxTop = (typeof window !== 'undefined' ? window.innerHeight : 800) - approxHeight - 16;
    const top = Math.max(12, Math.min(rect.top, maxTop));
    setFlyoutData({
      title,
      top,
      left: Math.round(rect.right) + 6,
      items,
    });
  };

  const handleItemMouseLeave = () => {
    if (!isCollapsed) return;
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
    }
    flyoutTimerRef.current = setTimeout(() => {
      setFlyoutData(null);
    }, 180);
  };

  const handleFlyoutMouseEnter = () => {
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
      flyoutTimerRef.current = null;
    }
  };

  const handleFlyoutMouseLeave = () => {
    setFlyoutData(null);
  };

  useEffect(() => {
    setFlyoutData(null);
  }, [pathname, isCollapsed]);

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
        const data = await api.dashboard.getSystemStatus(token);
        if (data) {
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

        const data = await api.dashboard.getSummary(todayStr, token);
        if (data) {
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

        {showQlgdSidebar ? (
          <>
            {/* Section Header QLGD */}
            <div className="sidebar-section-header" style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              margin: '12px 0 6px 12px',
              display: isCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingRight: '8px',
            }}>
              <span>{user.department?.name || 'Quản lý giao dịch'}</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !adminOverrideQlgd;
                    setAdminOverrideQlgd(next);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('mxv_sidebar_override', next ? 'QLGD' : 'DEFAULT');
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#60a5fa',
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Chuyển đổi giao diện Sidebar về chế độ IT Mặc định"
                >
                  Về IT
                </button>
              )}
            </div>

            {/* 1. Tổng quan -> /trading-manager/dashboard */}
            <Link
              href="/trading-manager/dashboard"
              onClick={onClose}
              onMouseEnter={() => { if (isCollapsed) setFlyoutData(null); }}
              className={`nav-link ${pathname === '/trading-manager/dashboard' ? 'active' : ''}`}
              title={isCollapsed ? "Tổng quan QLGD" : undefined}
            >
              <LayoutDashboard size={18} style={{ flexShrink: 0 }} />
              <span>Tổng quan</span>
            </Link>

            {/* 2. Đối chiếu giao dịch -> /trading-manager/reconciliation */}
            <Link
              href="/trading-manager/reconciliation"
              onClick={onClose}
              onMouseEnter={() => { if (isCollapsed) setFlyoutData(null); }}
              className={`nav-link ${pathname.startsWith('/trading-manager/reconciliation') ? 'active' : ''}`}
              title={isCollapsed ? "Đối chiếu giao dịch" : undefined}
            >
              <ArrowLeftRight size={18} style={{ flexShrink: 0 }} />
              <span>Đối chiếu giao dịch</span>
            </Link>

            {/* 3. Đối chiếu OMS ACM -> /trading-manager/oms-recon */}
            <Link
              href="/trading-manager/oms-recon"
              onClick={onClose}
              onMouseEnter={() => { if (isCollapsed) setFlyoutData(null); }}
              className={`nav-link ${pathname.startsWith('/trading-manager/oms-recon') || pathname.startsWith('/trading-manager/oms') ? 'active' : ''}`}
              title={isCollapsed ? "Đối chiếu OMS ACM" : undefined}
            >
              <ShieldCheck size={18} style={{ flexShrink: 0 }} />
              <span>Đối chiếu OMS ACM</span>
            </Link>

            {/* 4. Nghiệp vụ đầu phiên -> /trading-manager/session-open */}
            <Link
              href="/trading-manager/session-open"
              onClick={onClose}
              onMouseEnter={() => { if (isCollapsed) setFlyoutData(null); }}
              className={`nav-link ${pathname.startsWith('/trading-manager/session-open') ? 'active' : ''}`}
              title={isCollapsed ? "Nghiệp vụ đầu phiên" : undefined}
            >
              <Sunrise size={18} style={{ flexShrink: 0 }} />
              <span>Nghiệp vụ đầu phiên</span>
            </Link>

            {/* 4. Backup (Sub cha & sub con: Backup MS – CQG & Backup CCP – CE) */}
            <div
              style={{ display: 'flex', flexDirection: 'column' }}
              onMouseEnter={(e) => handleItemMouseEnter(e, 'Sao lưu dữ liệu (Backup)', [
                {
                  href: '/trading-manager/backup/ms-cqg',
                  label: 'Backup MS – CQG',
                  icon: <Folder size={15} style={{ flexShrink: 0 }} />,
                  active: pathname === '/trading-manager/backup/ms-cqg'
                },
                {
                  href: '/trading-manager/backup/ccp-ce',
                  label: 'Backup CCP – CE',
                  icon: <Layers size={15} style={{ flexShrink: 0 }} />,
                  active: pathname === '/trading-manager/backup/ccp-ce'
                }
              ])}
              onMouseLeave={handleItemMouseLeave}
            >
              <div
                onClick={() => {
                  if (isCollapsed) {
                    router.push('/trading-manager/backup/ms-cqg');
                  } else {
                    toggleSubMenu('backup');
                  }
                }}
                className={`nav-link ${pathname.startsWith('/trading-manager/backup') ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0' : '10px' }}>
                  <Database size={18} style={{ flexShrink: 0 }} />
                  <span>Backup</span>
                </div>
                {!isCollapsed && (
                  openSubMenus.backup ? <ChevronDown size={14} style={{ opacity: 0.7 }} /> : <ChevronRight size={14} style={{ opacity: 0.7 }} />
                )}
              </div>

              {/* Sub items: Backup MS – CQG & Backup CCP – CE */}
              {!isCollapsed && openSubMenus.backup && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginLeft: '16px',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.08)',
                  paddingLeft: '6px',
                  marginBottom: '4px',
                }}>
                  <Link
                    href="/trading-manager/backup/ms-cqg"
                    onClick={onClose}
                    className={`nav-link ${pathname === '/trading-manager/backup/ms-cqg' ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Folder size={15} style={{ flexShrink: 0 }} />
                    <span>Backup MS – CQG</span>
                  </Link>

                  <Link
                    href="/trading-manager/backup/ccp-ce"
                    onClick={onClose}
                    className={`nav-link ${pathname === '/trading-manager/backup/ccp-ce' ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Layers size={15} style={{ flexShrink: 0 }} />
                    <span>Backup CCP – CE</span>
                  </Link>
                </div>
              )}
            </div>

            {/* 5. Thống kê (Sub cha & sub con: Thống kê MS & Thống kê CCP) */}
            <div
              style={{ display: 'flex', flexDirection: 'column' }}
              onMouseEnter={(e) => handleItemMouseEnter(e, 'Thống kê (MS & CCP)', [
                {
                  href: '/trading-manager/statistics/ms',
                  label: 'Thống kê MS',
                  icon: <FileSpreadsheet size={15} style={{ flexShrink: 0 }} />,
                  active: pathname === '/trading-manager/statistics/ms'
                },
                {
                  href: '/trading-manager/statistics/ccp',
                  label: 'Thống kê CCP',
                  icon: <Layers size={15} style={{ flexShrink: 0 }} />,
                  active: pathname === '/trading-manager/statistics/ccp'
                }
              ])}
              onMouseLeave={handleItemMouseLeave}
            >
              <div
                onClick={() => {
                  if (isCollapsed) {
                    router.push('/trading-manager/statistics/ms');
                  } else {
                    toggleSubMenu('stats');
                  }
                }}
                className={`nav-link ${pathname.startsWith('/trading-manager/statistics') ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0' : '10px' }}>
                  <BarChart3 size={18} style={{ flexShrink: 0 }} />
                  <span>Thống kê</span>
                </div>
                {!isCollapsed && (
                  openSubMenus.stats ? <ChevronDown size={14} style={{ opacity: 0.7 }} /> : <ChevronRight size={14} style={{ opacity: 0.7 }} />
                )}
              </div>

              {/* Sub items: Thống kê MS & Thống kê CCP */}
              {!isCollapsed && openSubMenus.stats && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginLeft: '16px',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.08)',
                  paddingLeft: '6px',
                  marginBottom: '4px',
                }}>
                  <Link
                    href="/trading-manager/statistics/ms"
                    onClick={onClose}
                    className={`nav-link ${pathname === '/trading-manager/statistics/ms' ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <FileSpreadsheet size={15} style={{ flexShrink: 0 }} />
                    <span>Thống kê MS</span>
                  </Link>

                  <Link
                    href="/trading-manager/statistics/ccp"
                    onClick={onClose}
                    className={`nav-link ${pathname === '/trading-manager/statistics/ccp' ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                  >
                    <Layers size={15} style={{ flexShrink: 0 }} />
                    <span>Thống kê CCP</span>
                  </Link>

                  <Link
                    href="/trading-manager/statistics/ce"
                    onClick={onClose}
                    className={`nav-link ${pathname === '/trading-manager/statistics/ce' ? 'active' : ''}`}
                    style={{
                      paddingLeft: isCollapsed ? '12px' : '10px',
                      fontSize: '0.82rem',
                    }}
                    title={isCollapsed ? "Thống kê CE (ACM Nano)" : undefined}
                  >
                    <Activity size={15} style={{ flexShrink: 0 }} />
                    <span>Thống kê CE</span>
                  </Link>
                </div>
              )}
            </div>

            {/* 6. Tham số hệ thống (Sub cha & sub con: Cấu hình đường dẫn cũ & Cấu hình đường dẫn mới) */}
            <div
              style={{ display: 'flex', flexDirection: 'column' }}
              onMouseEnter={(e) => handleItemMouseEnter(e, 'Tham số hệ thống', [
                {
                  href: '/trading-manager/settings/ms-cqg',
                  label: 'Đường dẫn cũ (MS - CQG)',
                  icon: <Folder size={15} style={{ flexShrink: 0 }} />,
                  active: pathname.startsWith('/trading-manager/settings/ms-cqg') || pathname.startsWith('/trading-manager/settings/legacy-paths')
                },
                {
                  href: '/trading-manager/settings/ccp-ce',
                  label: 'Đường dẫn mới (CCP - CE)',
                  icon: <FolderTree size={15} style={{ flexShrink: 0 }} />,
                  active: pathname.startsWith('/trading-manager/settings/ccp-ce') || pathname.startsWith('/trading-manager/settings/modern-paths')
                }
              ])}
              onMouseLeave={handleItemMouseLeave}
            >
              <div
                onClick={() => {
                  if (isCollapsed) {
                    router.push('/trading-manager/settings/ms-cqg');
                  } else {
                    toggleSubMenu('params');
                  }
                }}
                className={`nav-link ${pathname.startsWith('/trading-manager/settings') ? 'active' : ''}`}
                style={{
                  cursor: 'pointer',
                  justifyContent: isCollapsed ? 'center' : 'space-between',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: isCollapsed ? '0' : '10px' }}>
                  <Sliders size={18} style={{ flexShrink: 0 }} />
                  <span>Tham số hệ thống</span>
                </div>
                {!isCollapsed && (
                  openSubMenus.params ? <ChevronDown size={14} style={{ opacity: 0.7 }} /> : <ChevronRight size={14} style={{ opacity: 0.7 }} />
                )}
              </div>

              {/* Sub items: Đường dẫn cũ & Đường dẫn mới */}
              {!isCollapsed && openSubMenus.params && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  marginLeft: '16px',
                  borderLeft: '2px solid rgba(255, 255, 255, 0.08)',
                  paddingLeft: '6px',
                  marginBottom: '4px',
                }}>
                  <Link
                    href="/trading-manager/settings/ms-cqg"
                    onClick={onClose}
                    className={`nav-link ${pathname.startsWith('/trading-manager/settings/ms-cqg') || pathname.startsWith('/trading-manager/settings/legacy-paths') ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                    title="Dành cho MS, CQG, ACM"
                  >
                    <Folder size={15} style={{ flexShrink: 0 }} />
                    <span>Đường dẫn cũ (MS - CQG)</span>
                  </Link>

                  <Link
                    href="/trading-manager/settings/ccp-ce"
                    onClick={onClose}
                    className={`nav-link ${pathname.startsWith('/trading-manager/settings/ccp-ce') || pathname.startsWith('/trading-manager/settings/modern-paths') ? 'active' : ''}`}
                    style={{
                      paddingLeft: '10px',
                      fontSize: '0.82rem',
                    }}
                    title="Dành cho CCP, CE, ACM"
                  >
                    <FolderTree size={15} style={{ flexShrink: 0 }} />
                    <span>Đường dẫn mới (CCP - CE)</span>
                  </Link>
                </div>
              )}
            </div>

            {/* 7. Logs Hàng Đợi -> /trading-manager/job-queue */}
            <Link
              href="/trading-manager/job-queue"
              onClick={onClose}
              onMouseEnter={() => { if (isCollapsed) setFlyoutData(null); }}
              className={`nav-link ${pathname.startsWith('/trading-manager/job-queue') || pathname.startsWith('/trading-manager/logs') ? 'active' : ''}`}
              title={isCollapsed ? "Logs hàng đợi robot" : undefined}
            >
              <Terminal size={18} style={{ flexShrink: 0 }} />
              <span>Logs Hàng đợi</span>
            </Link>
          </>
        ) : (
          /* MẶC ĐỊNH CHO CÁC KHỐI KHÁC (IT, ADMIN, V.V...) - GIỮ NGUYÊN HOÀN TOÀN NHƯ CŨ */
          <>
            {/* Section Header */}
            <div className="sidebar-section-header" style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              margin: '12px 0 6px 12px',
              display: isCollapsed ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingRight: '8px',
            }}>
              <span>Giám sát</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const next = !adminOverrideQlgd;
                    setAdminOverrideQlgd(next);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('mxv_sidebar_override', next ? 'QLGD' : 'DEFAULT');
                    }
                  }}
                  style={{
                    border: 'none',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    fontSize: '0.64rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                  title="Chuyển sang giao diện Sidebar dành riêng cho khối QLGD"
                >
                  Xem QLGD
                </button>
              )}
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
                {/* Tạm ẩn 'Ca trực hiện tại' theo yêu cầu người dùng (giữ nguyên toàn bộ logic chức năng) */}
                {/*
                <Link
                  href="/checklist"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/checklist' ? 'active' : ''}`}
                  title={isCollapsed ? "Ca trực hiện tại" : undefined}
                >
                  <CheckSquare size={18} style={{ flexShrink: 0 }} />
                  <span>Ca trực hiện tại</span>
                </Link>
                */}
                {/* Tạm ẩn 'Tra cứu lịch sử' theo yêu cầu người dùng (giữ nguyên toàn bộ logic chức năng) */}
                {/*
                <Link
                  href="/history"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/history' ? 'active' : ''}`}
                  title={isCollapsed ? "Tra cứu lịch sử" : undefined}
                >
                  <History size={18} style={{ flexShrink: 0 }} />
                  <span>Tra cứu lịch sử</span>
                </Link>
                */}
                <Link
                  href="/trading-manager/reconciliation"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/trading-manager/reconciliation' ? 'active' : ''}`}
                  title={isCollapsed ? "Đối chiếu giao dịch" : undefined}
                >
                  <ArrowLeftRight size={18} style={{ flexShrink: 0 }} />
                  <span>Đối chiếu giao dịch</span>
                </Link>
                <Link
                  href="/trading-manager/oms-recon"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/trading-manager/oms-recon') || pathname.startsWith('/trading-manager/oms') ? 'active' : ''}`}
                  title={isCollapsed ? "Đối chiếu OMS ACM" : undefined}
                >
                  <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                  <span>Đối chiếu OMS ACM</span>
                </Link>
                <Link
                  href="/trading-manager/session-open"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/trading-manager/session-open' ? 'active' : ''}`}
                  title={isCollapsed ? "Nghiệp vụ đầu phiên" : undefined}
                >
                  <Sunrise size={18} style={{ flexShrink: 0 }} />
                  <span>Nghiệp vụ đầu phiên</span>
                </Link>
                <Link
                  href="/trading-manager/ms-cqg"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/trading-manager/ms-cqg' ? 'active' : ''}`}
                  title={isCollapsed ? "Giám sát MS & CQG" : undefined}
                >
                  <Activity size={18} style={{ flexShrink: 0 }} />
                  <span>Giám Sát MS & CQG</span>
                </Link>
                <Link
                  href="/trading-manager/ccp-ce"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/trading-manager/ccp-ce' ? 'active' : ''}`}
                  title={isCollapsed ? "Giám sát CoreCCP & CE" : undefined}
                >
                  <FileSpreadsheet size={18} style={{ flexShrink: 0 }} />
                  <span>Giám Sát CoreCCP & CE</span>
                </Link>
                <Link
                  href="/trading-manager"
                  onClick={onClose}
                  className={`nav-link ${pathname === '/trading-manager' ? 'active' : ''}`}
                  title={isCollapsed ? "Bàn Giám Sát GD Tổng Hợp" : undefined}
                >
                  <Layers size={18} style={{ flexShrink: 0 }} />
                  <span>Trading Manager (Hub)</span>
                </Link>
              </>
            )}
          </>
        )}
        {/* Tạm ẩn 'Cấu hình' theo yêu cầu người dùng (giữ nguyên toàn bộ logic chức năng) */}
        {/*
        <Link
          href="/settings"
          onClick={onClose}
          className={`nav-link ${pathname === '/settings' ? 'active' : ''}`}
          title={isCollapsed ? "Cấu hình cá nhân" : undefined}
        >
          <Settings size={18} style={{ flexShrink: 0 }} />
          <span>Cấu hình</span>
        </Link>
        */}

        {canManageTemplates && (
          <>
            <div className="sidebar-section-header" style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              margin: '20px 0 6px 12px',
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
                {/* 
                <Link
                  href="/admin/notifications"
                  onClick={onClose}
                  className={`nav-link ${pathname.startsWith('/admin/notifications') ? 'active' : ''}`}
                  title={isCollapsed ? "Cấu hình thông báo" : undefined}
                >
                  <Bell size={18} style={{ flexShrink: 0 }} />
                  <span>Cấu hình thông báo</span>
                </Link>
                */}
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

      {/* Flyout Popup Menu when Sidebar is Collapsed */}
      {mounted && isCollapsed && flyoutData && typeof document !== 'undefined' && createPortal(
        <div
          className="sidebar-flyout-menu"
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleFlyoutMouseLeave}
          style={{
            top: `${flyoutData.top}px`,
            left: `${flyoutData.left}px`,
          }}
        >
          {/* Header */}
          <div className="sidebar-flyout-header">
            <span>{flyoutData.title}</span>
          </div>

          {/* Items */}
          <div className="sidebar-flyout-body">
            {flyoutData.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  setFlyoutData(null);
                  if (onClose) onClose();
                }}
                className={`sidebar-flyout-item ${item.active ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
