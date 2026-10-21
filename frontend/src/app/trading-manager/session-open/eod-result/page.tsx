'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Maximize2,
  Minimize2,
  ShieldCheck,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import LegacyEodResultSection from '../../components/legacy-ms-cqg/LegacyEodResultSection';
import LegacyNegativeMarginSection from '../../components/legacy-ms-cqg/LegacyNegativeMarginSection';
import CcpCeEodReconSection from '../../components/core-ccp/CcpCeEodReconSection';

export default function CheckEodResultPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());
  const [scopeTab, setScopeTab] = useState<'CCP_CE' | 'MS_CQG'>('CCP_CE');
  const [activeTab, setActiveTab] = useState<'ALL' | 'EOD_RESULT' | 'NEGATIVE_MARGIN'>('ALL');

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
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                }}
              >
                NGHIỆP VỤ ĐẦU PHIÊN (SOD)
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
              <ShieldCheck color="#10b981" size={24} />
              Đối chiếu kết quả EOD
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

            {/* Thanh Tab Switcher phân hệ - ĐẶT NGAY BÊN CẠNH NGÀY PHIÊN */}
            <div
              style={{
                display: 'flex',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                padding: '3px',
                border: '1px solid var(--border-color)',
              }}
            >
              {[
                { id: 'CCP_CE', label: 'Phân hệ CoreCCP – CoreEX' },
                { id: 'MS_CQG', label: 'Phân hệ MS – CQG' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScopeTab(tab.id as 'CCP_CE' | 'MS_CQG')}
                  style={{
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: scopeTab === tab.id ? '#3b82f6' : 'transparent',
                    color: scopeTab === tab.id ? '#ffffff' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {tab.label}
                </button>
              ))}
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

            {/* Chuyển về Nghiệp vụ đầu phiên */}
            <Link
              href="/trading-manager/session-open"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '9px 16px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} />
              <span>Nghiệp vụ đầu phiên</span>
            </Link>
          </div>
        </div>

        {/* Thanh Tabs chọn hiển thị chức năng */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '2px',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`btn ${activeTab === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Layers size={15} />
            <span>Tất cả (2)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EOD_RESULT')}
            className={`btn ${activeTab === 'EOD_RESULT' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldCheck size={15} />
            <span>Đối chiếu kết quả EOD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('NEGATIVE_MARGIN')}
            className={`btn ${activeTab === 'NEGATIVE_MARGIN' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ShieldAlert size={15} />
            <span>Check TKGD âm KQ mới</span>
          </button>
        </div>

        {/* PHÂN HỆ 1: CORECCP - COREEX (MẶC ĐỊNH) */}
        {scopeTab === 'CCP_CE' && (
          <CcpCeEodReconSection
            token={token}
            selectedDate={selectedDate}
            viewMode="EOD_ONLY"
            activeTab={activeTab}
          />
        )}

        {/* PHÂN HỆ 2: M-SYSTEM - CQG */}
        {scopeTab === 'MS_CQG' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1. KHỐI ĐỐI CHIẾU KẾT QUẢ EOD */}
            {(activeTab === 'ALL' || activeTab === 'EOD_RESULT') && (
              <LegacyEodResultSection token={token} selectedDate={selectedDate} />
            )}

            {/* 2. KHỐI CHECK TKGD ÂM KQ MỚI */}
            {(activeTab === 'ALL' || activeTab === 'NEGATIVE_MARGIN') && (
              <LegacyNegativeMarginSection token={token} selectedDate={selectedDate} />
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
