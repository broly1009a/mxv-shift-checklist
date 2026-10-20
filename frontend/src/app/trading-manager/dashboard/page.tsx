'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Calendar,
} from 'lucide-react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { QlgdExecutiveDashboard } from '../components/QlgdExecutiveDashboard';
import { getInitialTradingSessionDate } from '../utils/tradingDateUtils';

export default function QlgdDashboardStandalonePage() {
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
        {/* HEADER SECTION - ĐỒNG BỘ 100% VỚI RECONCILIATION */}
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
                QUẢN LÝ GIAO DỊCH (QLGD)
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
              <LayoutDashboard color="#10b981" size={26} />
              DASHBOARD
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
          </div>
        </div>

        {/* NỘI DUNG DASHBOARD ĐIỀU HÀNH */}
        <QlgdExecutiveDashboard
          hideHeaderCard={true}
          sessionDateProp={selectedDate}
          onSelectDate={setSelectedDate}
        />
      </div>
    </ProtectedRoute>
  );
}
