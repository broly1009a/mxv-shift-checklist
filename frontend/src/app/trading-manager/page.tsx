'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Database,
  Sliders,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  BookOpen,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import TradingManagerGuideModal from './components/shared/TradingManagerGuideModal';
import TradingManagerConfigSection from './components/shared/TradingManagerConfigSection';
import CoreCcpBackupSection from './components/core-ccp/CoreCcpBackupSection';
import LegacyBackupThongKeSection from './components/legacy-ms-cqg/LegacyBackupThongKeSection';
import LegacyReconSection from './components/legacy-ms-cqg/LegacyReconSection';

export default function TradingManagerPage() {
  const { token } = useAuth();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Top Tabs: Màn hình đối chiếu Khớp lệnh, Backup MS/CQG, Cấu hình, và Hệ thống mới CoreCCP (VNCLEAR)
  const [topTab, setTopTab] = useState<
    'CHECK_GD_EOD_SYNC' | 'BACKUP_THONG_KE_GTT' | 'CAU_HINH_DUONG_DAN' | 'CORE_CCP_VNCLEAR'
  >('CHECK_GD_EOD_SYNC');

  // Selected Date (Mặc định hôm nay theo giờ Việt Nam GMT+7)
  const [selectedDate, setSelectedDate] = useState<string>('');

  // Guide Modal
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Trạng thái đối chiếu cập nhật từ LegacyReconSection
  const [reconStatus, setReconStatus] = useState<{
    isDiffer: boolean;
    totalDifferLots: number;
    klgdStatus: string;
  }>({
    isDiffer: false,
    totalDifferLots: 0,
    klgdStatus: 'IDLE',
  });

  // Khởi tạo ngày hiện tại
  useEffect(() => {
    const today = new Date();
    const vnTime = new Date(today.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = vnTime.toISOString().split('T')[0];
    setSelectedDate(dateStr);
  }, []);

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const isDiffer = reconStatus.isDiffer;
  const totalDifferLots = reconStatus.totalDifferLots;

  return (
    <ProtectedRoute>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          minHeight: isFullscreen ? '100vh' : 'auto',
          height: isFullscreen ? '100vh' : 'auto',
          color: 'var(--text-primary)',
          padding: isFullscreen ? '24px' : '0',
          backgroundColor: isFullscreen ? 'var(--bg-app)' : 'transparent',
          position: 'relative',
          overflowY: isFullscreen ? 'auto' : 'visible',
          boxSizing: 'border-box',
        }}
        className="animate-fade-in"
      >
        {/* PAGE HEADER */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '16px',
            flexShrink: 0,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <Activity color="#10b981" className="animate-pulse" size={26} />
              Trading Manager — Bàn Giám Sát Đối Soát Nghiệp Vụ
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Trung tâm kiểm soát, đối chiếu giao dịch trong phiên & Pre-EOD (M-System, CQG & CoreCCP).
            </p>
          </div>

          {/* Right Header Status Badges & Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* System Online Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 16px',
                borderRadius: '12px',
                border: !isDiffer ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: !isDiffer ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: !isDiffer ? '#34d399' : '#f87171',
              }}
            >
              <div style={{ position: 'relative', width: '10px', height: '10px' }}>
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    backgroundColor: !isDiffer ? '#10b981' : '#ef4444',
                  }}
                  className="animate-ping"
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    backgroundColor: !isDiffer ? '#10b981' : '#ef4444',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Hệ thống: Online
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace' }}>
                  {!isDiffer ? 'Khớp 100%' : `Lệch ${totalDifferLots} lot`}
                </span>
              </div>
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

            {/* In-App Guide Button */}
            <button
              type="button"
              onClick={() => setShowGuideModal(true)}
              className="btn btn-secondary"
              style={{
                fontSize: '0.8rem',
                padding: '9px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.35)',
                color: '#10b981',
                cursor: 'pointer',
              }}
            >
              <BookOpen size={15} />
              <span>Hướng Dẫn Nghiệp Vụ</span>
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

        {/* TAB BUTTONS BAR */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '4px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            minHeight: '44px',
          }}
          className="table-responsive-wrapper"
        >
          {/* TAB 1: CHECK GD - EOD - SYNC */}
          <button
            type="button"
            onClick={() => setTopTab('CHECK_GD_EOD_SYNC')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CHECK_GD_EOD_SYNC' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CHECK_GD_EOD_SYNC' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CHECK_GD_EOD_SYNC' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} color={topTab === 'CHECK_GD_EOD_SYNC' ? '#10b981' : 'var(--text-muted)'} />
            <span>Check GD - EOD - Sync</span>
          </button>

          {/* TAB 2: BACKUP – THỐNG KÊ – GTT */}
          <button
            type="button"
            onClick={() => setTopTab('BACKUP_THONG_KE_GTT')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'BACKUP_THONG_KE_GTT' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'BACKUP_THONG_KE_GTT' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'BACKUP_THONG_KE_GTT' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={16} color={topTab === 'BACKUP_THONG_KE_GTT' ? '#10b981' : 'var(--text-muted)'} />
            <span>Backup – Thống kê – GTT</span>
          </button>

          {/* TAB 3: CẤU HÌNH - ĐƯỜNG DẪN */}
          <button
            type="button"
            onClick={() => setTopTab('CAU_HINH_DUONG_DAN')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CAU_HINH_DUONG_DAN' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CAU_HINH_DUONG_DAN' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CAU_HINH_DUONG_DAN' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={16} color={topTab === 'CAU_HINH_DUONG_DAN' ? '#10b981' : 'var(--text-muted)'} />
            <span>Cấu hình – Đường dẫn</span>
          </button>

          {/* TAB 4: BÁO CÁO & ĐỐI CHIẾU CORECCP (VNCLEAR) */}
          <button
            type="button"
            onClick={() => setTopTab('CORE_CCP_VNCLEAR')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: topTab === 'CORE_CCP_VNCLEAR' ? '2px solid #10b981' : '2px solid transparent',
              color: topTab === 'CORE_CCP_VNCLEAR' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: topTab === 'CORE_CCP_VNCLEAR' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <FileSpreadsheet size={16} color={topTab === 'CORE_CCP_VNCLEAR' ? '#10b981' : 'var(--text-muted)'} />
            <span>Báo Cáo & Đối Chiếu CoreCCP</span>
          </button>
        </div>

        {/* TAB CONTENTS (MODULARIZED ARCHITECTURE) */}
        {topTab === 'CHECK_GD_EOD_SYNC' ? (
          /* TAB 1: NỘI DUNG CHÍNH (CHECK GD - EOD - SYNC LEGACY) */
          <LegacyReconSection
            token={token}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenGuide={() => setShowGuideModal(true)}
            onStatusChange={setReconStatus}
          />
        ) : topTab === 'BACKUP_THONG_KE_GTT' ? (
          /* TAB 2: BACKUP – THỐNG KÊ – GTT (LEGACY MS & CQG) */
          <LegacyBackupThongKeSection
            token={token}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        ) : topTab === 'CAU_HINH_DUONG_DAN' ? (
          /* TAB 3: CẤU HÌNH - ĐƯỜNG DẪN (1:1 C# FormConfig) */
          <TradingManagerConfigSection token={token} />
        ) : topTab === 'CORE_CCP_VNCLEAR' ? (
          /* TAB 4: BÁO CÁO & ĐỐI CHIẾU CORECCP (VNCLEAR TƯƠNG LAI) */
          <CoreCcpBackupSection
            token={token}
            selectedDate={selectedDate}
            onOpenGuide={() => setShowGuideModal(true)}
          />
        ) : null}

        {/* STATUS FOOTER */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '12px 20px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
              <span
                style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span>Hệ thống: <strong style={{ color: 'var(--text-primary)' }}>Online</strong></span>
            </span>
            <span>•</span>
            <span>Phiên làm việc: <strong style={{ color: 'var(--text-primary)' }}>{selectedDate || 'Hôm nay'}</strong></span>
            <span>•</span>
            <span>
              Độ lệch:{' '}
              <strong style={{ color: isDiffer ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontWeight: 800 }}>
                {!isDiffer ? '0 lot (Khớp 100%)' : `${totalDifferLots} lot`}
              </strong>
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Server: 10.0.0.26:3001
          </div>
        </div>

        {/* IN-APP GUIDE MODAL */}
        <TradingManagerGuideModal
          isOpen={showGuideModal}
          onClose={() => setShowGuideModal(false)}
        />
      </div>
    </ProtectedRoute>
  );
}
