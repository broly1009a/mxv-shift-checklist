'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Maximize2,
  Minimize2,
  FileSpreadsheet,
  Layers,
  ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import LegacyGttCheckerSection from '../../components/legacy-ms-cqg/LegacyGttCheckerSection';
import CeCcpGttCheckerSection from '../../components/ce-acm/CeCcpGttCheckerSection';

export default function CheckGttCeCcpTtPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());
  const [activeTab, setActiveTab] = useState<'ALL' | 'GTT_CE_CCP_TT' | 'GTT_CCP_CE'>('ALL');

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
              <FileSpreadsheet color="#3b82f6" size={24} />
              Kiểm tra Giá thanh toán CE/CCP/TT
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
            onClick={() => setActiveTab('GTT_CE_CCP_TT')}
            className={`btn ${activeTab === 'GTT_CE_CCP_TT' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileSpreadsheet size={15} />
            <span>Kiểm tra Giá thanh toán CE/CCP/TT</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('GTT_CCP_CE')}
            className={`btn ${activeTab === 'GTT_CCP_CE' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.82rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeftRight size={15} />
            <span>Đối chiếu giá thanh toán CCP/ CE</span>
          </button>
        </div>

        {/* 1. KHỐI KIỂM TRA GIÁ THANH TOÁN CE/CCP/TT */}
        {(activeTab === 'ALL' || activeTab === 'GTT_CE_CCP_TT') && (
          <LegacyGttCheckerSection token={token} selectedDate={selectedDate} />
        )}

        {/* 2. KHỐI ĐỐI CHIẾU GIÁ THANH TOÁN CCP/ CE */}
        {(activeTab === 'ALL' || activeTab === 'GTT_CCP_CE') && (
          <CeCcpGttCheckerSection
            token={token}
            selectedDate={selectedDate}
            titleOverride="Đối chiếu giá thanh toán CCP/ CE"
          />
        )}
      </div>
    </ProtectedRoute>
  );
}
