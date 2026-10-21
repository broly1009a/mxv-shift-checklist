'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Calendar,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import CeLotStatisticsSection from '../../components/ce-acm/CeLotStatisticsSection';
import TradingManagerGuideModal from '../../components/shared/TradingManagerGuideModal';

export default function CeStatisticsPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

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
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                }}
              >
                PHÂN HỆ COREEX / ACM NANO
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
              <Activity color="#3b82f6" size={24} />
              THỐNG KÊ SỐ LOT & GIÁ TRỊ GIAO DỊCH (COREEX - ACM)
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

            {/* Back to CCP-CE Hub */}
            <Link
              href="/trading-manager/ccp-ce"
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
              <span>Về Hub CoreCCP & CoreEX</span>
            </Link>
          </div>
        </div>

        {/* Nội dung thống kê CoreEX */}
        <CeLotStatisticsSection
          token={token}
          selectedDate={selectedDate}
          onOpenGuide={() => setShowGuideModal(true)}
        />

        {/* Modal Hướng Dẫn Nghiệp Vụ */}
        <TradingManagerGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
        />
      </div>
    </ProtectedRoute>
  );
}
