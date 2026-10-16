'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, ExternalLink, ShieldCheck } from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { QlgdExecutiveDashboard } from '../components/QlgdExecutiveDashboard';

export default function QlgdDashboardStandalonePage() {
  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* Navigation Breadcrumb & Back Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link
              href="/trading-manager"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              <ArrowLeft size={16} />
              <span>Quay lại Trading Manager</span>
            </Link>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard size={20} color="#0284c7" />
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                TRUNG TÂM ĐIỀU HÀNH & BÁO CÁO BGĐ (QLGD)
              </h1>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#10b981',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <ShieldCheck size={15} />
              <span>Executive Level Authorized</span>
            </div>
          </div>
        </div>

        {/* The Executive Dashboard Component */}
        <QlgdExecutiveDashboard />
      </div>
    </ProtectedRoute>
  );
}
