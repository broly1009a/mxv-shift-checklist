'use client';

import React from 'react';
import Link from 'next/link';
import { Info, ArrowLeft } from 'lucide-react';

/**
 * Route page: /admin/tkgd-dashboard
 * Phân hệ Đối Soát TKGD đã được tách ra khỏi Checklist để vận hành độc lập.
 */
export default function TkgdDashboardPage() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        padding: '24px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '560px',
          width: '100%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6',
          }}
        >
          <Info size={32} />
        </div>

        <h1
          style={{
            fontSize: '1.25rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          Phân Hệ Đã Được Tách Thành Hệ Thống Độc Lập
        </h1>

        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Màn hình và phân hệ <strong>Đối Soát Hồ Sơ Mở TKGD</strong> đã được tách ra khỏi hệ thống Shift Checklist để vận hành độc lập theo dự án riêng. Phân hệ trên giao diện này hiện đã được tắt.
        </p>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          <Link
            href="/dashboard"
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <ArrowLeft size={16} />
            Quay Về Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
