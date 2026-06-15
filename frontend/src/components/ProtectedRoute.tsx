'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Menu, ShieldAlert } from 'lucide-react';
import Sidebar from './Sidebar';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

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
      {/* Mobile Navbar Header */}
      <header className="mobile-header">
        <button 
          onClick={() => setSidebarOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Menu size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert size={18} color="#3b82f6" />
          <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.025em' }}>
            MXV CHECKLIST
          </span>
        </div>
        <div style={{ width: '24px' }}></div> {/* Spacer to balance flexbox */}
      </header>

      {/* Dark overlay backdrop for mobile sidebar */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? 'show' : ''}`} 
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar with mobile toggle state */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
