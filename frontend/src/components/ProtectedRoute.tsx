'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Header from './Header';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Sync collapse state from localStorage
    const saved = localStorage.getItem('mxv_sidebar_collapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const handleToggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('mxv_sidebar_collapsed', String(nextState));
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--bg-app)',
        color: 'var(--text-primary)',
        fontSize: '1.2rem',
        fontWeight: 600,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid rgba(59, 130, 246, 0.2)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }}></div>
          <span>Đang tải phiên làm việc...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="app-container">
      {/* Dark overlay backdrop for mobile sidebar */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar with mobile toggle state and collapsed layout */}
      <Sidebar 
        isOpen={sidebarOpen} 
        isCollapsed={isCollapsed} 
        onClose={() => setSidebarOpen(false)} 
      />

      {/* Right Content Column */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          flex: 1, 
          minHeight: '100vh',
          marginLeft: isCollapsed ? '72px' : '260px',
          transition: 'margin-left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          width: isCollapsed ? 'calc(100% - 72px)' : 'calc(100% - 260px)'
        }}
        className="mobile-content-layout"
      >
        <Header 
          isCollapsed={isCollapsed} 
          onToggleCollapse={handleToggleCollapse}
          onOpenMobileSidebar={() => setSidebarOpen(true)}
        />
        
        <main className="main-content">
          {children}
        </main>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 1023px) {
          .mobile-content-layout {
            margin-left: 0 !important;
            width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}
