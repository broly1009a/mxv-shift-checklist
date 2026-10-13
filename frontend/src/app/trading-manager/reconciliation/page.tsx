'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  Maximize2,
  Minimize2,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import LegacyReconSection from '../components/legacy-ms-cqg/LegacyReconSection';
import { getInitialTradingSessionDate } from '../utils/tradingDateUtils';

export default function RegularReconciliationPage() {
  const { token } = useAuth();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Ngày phiên giao dịch hiện tại
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());

  // Trạng thái đối chiếu nhận từ LegacyReconSection
  const [, setReconStatus] = useState<{
    isDiffer: boolean;
    totalDifferLots: number;
    klgdStatus: string;
  }>({
    isDiffer: false,
    totalDifferLots: 0,
    klgdStatus: 'IDLE',
  });

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
        {/* HEADER SECTION */}
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
                ĐỐI CHIẾU THƯỜNG XUYÊN TRONG PHIÊN
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
              <ArrowLeftRight color="#10b981" className="animate-pulse" size={26} />
              ĐỐI CHIẾU GIAO DỊCH
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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

        {/* NỘI DUNG CHUYÊN BIỆT: CHỈ CÓ ĐỐI CHIẾU GIAO DỊCH THƯỜNG XUYÊN */}
        <LegacyReconSection
          viewMode="KLGD_ONLY"
          token={token}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onStatusChange={setReconStatus}
        />
      </div>
    </ProtectedRoute>
  );
}
