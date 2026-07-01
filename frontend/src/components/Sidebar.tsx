'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { 
  LayoutDashboard, 
  CheckSquare, 
  History, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Building2,
  UserCheck,
  PanelLeftClose,
  Calendar,
  Clock,
  Bell
} from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';

interface SidebarProps {
  isOpen?: boolean;
  isCollapsed?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, isCollapsed = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { canManageTemplates, isAdmin } = usePermissions();

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
          width: '36px',
          height: '36px',
          background: 'rgba(59, 130, 246, 0.15)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          flexShrink: 0
        }}>
          <ShieldAlert size={20} color="#3b82f6" />
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

      {/* User profile widget */}
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
              </>
            )}
          </>
        )}

      </nav>

      {/* Sidebar Uptime Status Card */}
      {!isCollapsed && (
        <div className="sidebar-status-card" style={{ marginTop: '0px', marginBottom: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              background: '#10b981',
              borderRadius: '50%',
              boxShadow: '0 0 6px #10b981'
            }} />
            <strong style={{ fontSize: '0.78rem', color: 'var(--text-primary)' }}>
              Hệ thống ổn định
            </strong>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div>Uptime 99.98%</div>
            <div>TPS hiện tại: 1,248</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
              <span>Tải hệ thống:</span>
              <span style={{ color: '#10b981', fontWeight: 600 }}>Thấp</span>
            </div>
            {/* Progress line */}
            <div style={{ width: '100%', height: '4px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
              <div style={{ width: '25%', height: '100%', background: '#10b981', borderRadius: '2px' }} />
            </div>
          </div>
        </div>
      )}


      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1023px) {
          .sidebar-mobile-close {
            display: flex !important;
          }
        }
      `}} />
    </div>
  );
}
