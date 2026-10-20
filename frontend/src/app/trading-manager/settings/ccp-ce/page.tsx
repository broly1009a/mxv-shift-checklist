'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Maximize2,
  Minimize2,
  ArrowLeft,
  FolderTree,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import TradingManagerConfigSection from '../../components/shared/TradingManagerConfigSection';

export default function ModernPathsSettingsPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          minHeight: '100%',
          backgroundColor: 'var(--bg-main)',
          padding: isFullscreen ? '20px' : '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                }}
              >
                THAM SỐ HỆ THỐNG (HỆ THỐNG MỚI)
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.35rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '4px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <FolderTree color="#10b981" size={24} />
              CẤU HÌNH ĐƯỜNG DẪN MỚI (CCP – CE – ACM)
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Chuyển nhanh sang Cấu hình cũ */}
            <Link
              href="/trading-manager/settings/ms-cqg"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '9px 14px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: '#3b82f6',
                borderColor: 'rgba(59, 130, 246, 0.35)',
              }}
            >
              <Sliders size={15} />
              <span>Cấu hình cũ (MS – CQG)</span>
            </Link>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="btn btn-secondary"
              style={{ padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Back to Dashboard */}
            <Link
              href="/trading-manager/dashboard"
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '9px 16px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={15} />
              <span>Tổng quan QLGD</span>
            </Link>
          </div>
        </div>

        {/* Nội dung Cấu hình CoreCCP & CE */}
        <TradingManagerConfigSection token={token} filterScope="CCP_CE" />
      </div>
    </ProtectedRoute>
  );
}
