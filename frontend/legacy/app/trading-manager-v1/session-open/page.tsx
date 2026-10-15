'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sunrise,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Calendar,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getInitialTradingSessionDate } from '../utils/tradingDateUtils';

export interface SodModuleCard {
  id: string;
  title: string;
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

export default function SessionOpenPage() {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());

  useEffect(() => {
    setSelectedDate(getInitialTradingSessionDate());
  }, []);

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

  // Danh sách các Box chức năng theo thứ tự
  const sodModules: SodModuleCard[] = [
    {
      id: 'SOD_KLGD_PHIENTRUOC',
      title: 'Đối chiếu giao dịch trước EOD',
      href: '/trading-manager/session-open/klgd-phien-cu',
      icon: Layers,
      iconColor: '#3b82f6',
      iconBg: 'rgba(59, 130, 246, 0.12)',
    },
    {
      id: 'SOD_GTT_CE_CCP_TT',
      title: 'Kiểm tra Giá thanh toán CE/CCP/TT',
      href: '/trading-manager/session-open/gtt',
      icon: FileSpreadsheet,
      iconColor: '#10b981',
      iconBg: 'rgba(16, 185, 129, 0.12)',
    },
    {
      id: 'SOD_KET_QUA_EOD',
      title: 'Đối chiếu kết quả EOD',
      href: '/trading-manager/session-open/eod-result',
      icon: ShieldCheck,
      iconColor: '#6366f1',
      iconBg: 'rgba(99, 102, 241, 0.12)',
    },
    {
      id: 'SOD_SYNC_CE_CCP_TT',
      title: 'Kiểm tra đồng bộ CE/CCP/TT',
      href: '/trading-manager/session-open/sync-ce-ccp-tt',
      icon: RefreshCw,
      iconColor: '#0ea5e9',
      iconBg: 'rgba(14, 165, 233, 0.12)',
    },
  ];

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
        {/* 1. HEADER SECTION */}
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
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#d97706',
                }}
              >
                QUY TRÌNH MỞ CỬA PHIÊN (START OF DAY - SOD)
              </span>
            </div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '6px 0 0 0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Sunrise color="#f59e0b" className="animate-pulse" size={28} />
              NGHIỆP VỤ ĐẦU PHIÊN
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Bộ chọn ngày giao dịch */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
              }}
            >
              <Calendar size={15} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Phiên:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                }}
              />
            </div>

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
              href="/dashboard"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '9px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} />
              <span>Dashboard</span>
            </Link>
          </div>
        </div>

        {/* 2. DANH SÁCH CÁC BOX CHỨC NĂNG DẠNG HÀNG DÀI */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {sodModules.map((item) => {
            const IconComp = item.icon;

            return (
              <Link
                key={item.id}
                href={item.href}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  className="glass-panel"
                  style={{
                    padding: '16px 20px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-card)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                    e.currentTarget.style.borderColor = item.iconColor;
                    e.currentTarget.style.boxShadow = `0 6px 20px -2px ${item.iconColor}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
                  }}
                >
                  {/* Bên trái: Icon & Tên box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        backgroundColor: item.iconBg,
                        color: item.iconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <IconComp size={20} />
                    </div>
                    <span
                      style={{
                        fontSize: '0.98rem',
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {item.title}
                    </span>
                  </div>

                  {/* Bên phải: Biểu tượng mũi tên */}
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <ChevronRight size={18} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </ProtectedRoute>
  );
}
