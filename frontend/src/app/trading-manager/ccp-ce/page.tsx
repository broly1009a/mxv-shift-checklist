'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  FileSpreadsheet,
  Sliders,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Terminal,
  ShieldCheck,
  TrendingUp,
  Layers,
  BarChart3,
  Server,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import TradingManagerGuideModal from '../components/shared/TradingManagerGuideModal';
import TradingManagerConfigSection from '../components/shared/TradingManagerConfigSection';
import CoreCcpBackupSection from '../components/core-ccp/CoreCcpBackupSection';
import CcpLotStatisticsSection from '../components/core-ccp/CcpLotStatisticsSection';
import CeAcmBackupSection from '../components/ce-acm/CeAcmBackupSection';
import LegacyReconSection from '../components/legacy-ms-cqg/LegacyReconSection';
import TradingManagerJobQueueSection from '../components/job-queue/TradingManagerJobQueueSection';
import { getInitialTradingSessionDate } from '../utils/tradingDateUtils';

export default function CcpCeTradingManagerPage() {
  const { token } = useAuth();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tabs của Phân hệ CoreCCP (VNCLEAR) & CoreEX (CE):
  // 1. Đối soát khớp lệnh (KLGD 4 bên dùng chung)
  // 2. Đối soát EOD CoreCCP (25 báo cáo VNCLEAR Maker, đối soát số dư EOD, IMR, quỹ bù trừ, âm ký quỹ)
  // 3. Thống kê & Báo cáo OMS (Thống kê số lot/GTGD CoreCCP & Báo cáo sàn CoreEX)
  // 4. Cấu hình OMS (Ma trận tỷ giá đa nguyên tệ VNCLEAR USD, EUR, JPY, MYR, VND, đường dẫn CoreCCP & CoreEX)
  // 5. Hàng đợi & Logs Robot
  const [activeTab, setActiveTab] = useState<
    'CHECK_KLGD' | 'EOD_RECON_CORECCP' | 'THONG_KE_BAO_CAO' | 'CONFIG_OMS' | 'HANG_DOI_LOGS'
  >('CHECK_KLGD');

  // Sub-tab cho Tab 3: Thống kê số lot CCP vs Báo cáo sàn CoreEX
  const [reportSubTab, setReportSubTab] = useState<'LOT_STATS_CCP' | 'BACKUP_CORE_EX'>('LOT_STATS_CCP');

  // Số lượng background job đang chạy
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);

  // Selected Date (Mặc định phiên làm việc hiện tại theo giờ Việt Nam GMT+7)
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());

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

  // Khởi tạo ngày phiên hiện tại (tự động nhận diện ca đêm T-1 trước 06:30 sáng)
  useEffect(() => {
    setSelectedDate(getInitialTradingSessionDate());
  }, []);

  // Polling số lượng tác vụ CoreCCP & CE đang chạy
  useEffect(() => {
    if (!token) return;
    const CCP_CE_JOB_TYPES = [
      'CHECK_KLGD',
      'CHECK_EOD_CCP',
      'DOWNLOAD_CCP_REPORT',
      'DOWNLOAD_CE_REPORT',
      'FILE_AUDIT_CCP',
      'CALCULATE_CCP_LOT_STATS',
      'EXPORT_CCP_REPORT',
      'SYNC_CCP_EXCHANGE_RATE',
    ].join(',');

    const pollActiveJobs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=${CCP_CE_JOB_TYPES}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const active = data.filter(
              (j: any) => j.status === 'PROCESSING' || j.status === 'AWAITING_CAPTCHA' || j.status === 'PENDING',
            ).length;
            setActiveJobsCount(active);
          }
        }
      } catch {}
    };

    pollActiveJobs();
    const interval = setInterval(pollActiveJobs, 8000);
    return () => clearInterval(interval);
  }, [token]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                PHÂN HỆ MỚI (VNCLEAR & OMS)
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                CoreCCP (Bù Trừ Thanh Toán) ↔ CoreEX (Sàn Giao Dịch)
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
              <FileSpreadsheet color="#3b82f6" className="animate-pulse" size={26} />
              GIÁM SÁT VẬN HÀNH GIAO DỊCH (CORECCP & COREEX)
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Bàn điều khiển đối soát khớp lệnh phiên 4 bên, đối chiếu EOD CoreCCP (25 báo cáo VNCLEAR), thống kê số lô/giá trị DSGD CCP & báo cáo sàn CoreEX.
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
              <span style={{ fontSize: '0.78rem', fontWeight: 700, fontFamily: 'monospace' }}>
                {!isDiffer ? 'Khớp 100%' : `Lệch ${totalDifferLots} lot`}
              </span>
            </div>

            {/* Session Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={15} color="#10b981" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="form-input"
                style={{
                  width: '145px',
                  height: '34px',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  padding: '2px 8px',
                }}
              />
              <button
                type="button"
                onClick={() => setSelectedDate(getInitialTradingSessionDate())}
                className="btn btn-secondary"
                title="Đặt lại về phiên ngày hôm nay"
                style={{ height: '34px', padding: '0 8px', fontSize: '0.75rem', fontWeight: 600 }}
              >
                Hôm nay
              </button>
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

            {/* Link to Full Hub */}
            <Link
              href="/trading-manager"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '9px 14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Mở Bàn Điều Khiển Tổng Hợp Song Song"
            >
              <Layers size={15} />
              <span>Bàn Tổng Hợp</span>
            </Link>

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
          {/* TAB 1: ĐỐI SOÁT KHỚP LỆNH (DÙNG CHUNG) */}
          <button
            type="button"
            onClick={() => setActiveTab('CHECK_KLGD')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'CHECK_KLGD' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'CHECK_KLGD' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CHECK_KLGD' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} color={activeTab === 'CHECK_KLGD' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Đối Soát Khớp Lệnh (KLGD)</span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
              }}
            >
              4 BÊN
            </span>
          </button>

          {/* TAB 2: ĐỐI SOÁT EOD CORECCP */}
          <button
            type="button"
            onClick={() => setActiveTab('EOD_RECON_CORECCP')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'EOD_RECON_CORECCP' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'EOD_RECON_CORECCP' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'EOD_RECON_CORECCP' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ShieldCheck size={16} color={activeTab === 'EOD_RECON_CORECCP' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Đối Soát EOD CoreCCP</span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                color: '#3b82f6',
              }}
            >
              25 BÁO CÁO
            </span>
          </button>

          {/* TAB 3: THỐNG KÊ & BÁO CÁO OMS */}
          <button
            type="button"
            onClick={() => setActiveTab('THONG_KE_BAO_CAO')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'THONG_KE_BAO_CAO' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'THONG_KE_BAO_CAO' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'THONG_KE_BAO_CAO' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <BarChart3 size={16} color={activeTab === 'THONG_KE_BAO_CAO' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Thống Kê & Báo Cáo OMS</span>
          </button>

          {/* TAB 4: CẤU HÌNH OMS */}
          <button
            type="button"
            onClick={() => setActiveTab('CONFIG_OMS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'CONFIG_OMS' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'CONFIG_OMS' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CONFIG_OMS' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={16} color={activeTab === 'CONFIG_OMS' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Cấu Hình OMS</span>
          </button>

          {/* TAB 5: HÀNG ĐỢI & LOGS */}
          <button
            type="button"
            onClick={() => setActiveTab('HANG_DOI_LOGS')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'HANG_DOI_LOGS' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'HANG_DOI_LOGS' ? '#3b82f6' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'HANG_DOI_LOGS' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Terminal size={16} color={activeTab === 'HANG_DOI_LOGS' ? '#3b82f6' : 'var(--text-muted)'} />
            <span>Hàng Đợi & Logs</span>
            {activeJobsCount > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  padding: '1px 7px',
                  borderRadius: '10px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  lineHeight: '1.2',
                }}
                className="animate-pulse"
              >
                {activeJobsCount}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONTENTS */}
        {activeTab === 'CHECK_KLGD' ? (
          /* TAB 1: MÀN HÌNH ĐỐI SOÁT KHỚP LỆNH DÙNG CHUNG (4 BÊN) */
          <LegacyReconSection
            viewMode="KLGD_ONLY"
            token={token}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenGuide={() => setShowGuideModal(true)}
            onStatusChange={setReconStatus}
          />
        ) : activeTab === 'EOD_RECON_CORECCP' ? (
          /* TAB 2: ĐỐI SOÁT EOD CORECCP (VNCLEAR: 25 BÁO CÁO, KÝ QUỸ, SỐ DƯ) */
          <CoreCcpBackupSection
            token={token}
            selectedDate={selectedDate}
            onOpenGuide={() => setShowGuideModal(true)}
          />
        ) : activeTab === 'THONG_KE_BAO_CAO' ? (
          /* TAB 3: THỐNG KÊ LOT & BÁO CÁO SÀN COREEX */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Sub-tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
              <button
                type="button"
                onClick={() => setReportSubTab('LOT_STATS_CCP')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '6px 6px 0 0',
                  border: 'none',
                  borderBottom: reportSubTab === 'LOT_STATS_CCP' ? '2px solid #3b82f6' : '2px solid transparent',
                  color: reportSubTab === 'LOT_STATS_CCP' ? '#3b82f6' : 'var(--text-secondary)',
                  backgroundColor: reportSubTab === 'LOT_STATS_CCP' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <TrendingUp size={15} />
                <span>Thống Kê Số Lot & GTGD (CoreCCP)</span>
              </button>
              <button
                type="button"
                onClick={() => setReportSubTab('BACKUP_CORE_EX')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  borderRadius: '6px 6px 0 0',
                  border: 'none',
                  borderBottom: reportSubTab === 'BACKUP_CORE_EX' ? '2px solid #3b82f6' : '2px solid transparent',
                  color: reportSubTab === 'BACKUP_CORE_EX' ? '#3b82f6' : 'var(--text-secondary)',
                  backgroundColor: reportSubTab === 'BACKUP_CORE_EX' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <Server size={15} />
                <span>Báo Cáo Sàn CoreEX (CE)</span>
              </button>
            </div>

            {/* Sub-tab content */}
            {reportSubTab === 'LOT_STATS_CCP' ? (
              <CcpLotStatisticsSection
                token={token}
                selectedDate={selectedDate}
                onOpenGuide={() => setShowGuideModal(true)}
              />
            ) : (
              <CeAcmBackupSection
                token={token}
                selectedDate={selectedDate}
              />
            )}
          </div>
        ) : activeTab === 'CONFIG_OMS' ? (
          /* TAB 4: CẤU HÌNH OMS (MA TRẬN TỶ GIÁ VNCLEAR, ĐƯỜNG DẪN CORECCP & COREEX) */
          <TradingManagerConfigSection
            token={token}
            filterScope="OMS"
          />
        ) : activeTab === 'HANG_DOI_LOGS' ? (
          /* TAB 5: HÀNG ĐỢI & LOGS ROBOT OMS */
          <TradingManagerJobQueueSection
            token={token}
            selectedDate={selectedDate}
            onActiveCountChange={setActiveJobsCount}
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
                style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span>Phân hệ: <strong style={{ color: 'var(--text-primary)' }}>CoreCCP (VNCLEAR) & CoreEX</strong></span>
            </span>
            <span>•</span>
            <span>Phiên làm việc: <strong style={{ color: 'var(--text-primary)' }}>{selectedDate || 'Hôm nay'}</strong></span>
            <span>•</span>
            <span>
              Độ lệch khớp lệnh:{' '}
              <strong style={{ color: isDiffer ? '#ef4444' : '#10b981', fontFamily: 'monospace', fontWeight: 800 }}>
                {!isDiffer ? '0 lot (Khớp 100%)' : `${totalDifferLots} lot`}
              </strong>
            </span>
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Server: 10.0.0.26:3001 | Route: /trading-manager/ccp-ce
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
