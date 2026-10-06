'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Database,
  Sliders,
  Maximize2,
  Minimize2,
  ArrowLeft,
  Terminal,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import TradingManagerGuideModal from '../components/shared/TradingManagerGuideModal';
import TradingManagerConfigSection from '../components/shared/TradingManagerConfigSection';
import LegacyBackupThongKeSection from '../components/legacy-ms-cqg/LegacyBackupThongKeSection';
import LegacyReconSection from '../components/legacy-ms-cqg/LegacyReconSection';
import TradingManagerJobQueueSection from '../components/job-queue/TradingManagerJobQueueSection';
import { getInitialTradingSessionDate } from '../utils/tradingDateUtils';

export default function MsCqgTradingManagerPage() {
  const { token } = useAuth();

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tabs của Phân hệ MS & CQG:
  // 1. Đối soát khớp lệnh (KLGD 4 bên dùng chung)
  // 2. Check & Chạy EOD MS-CQG (Pre-EOD, Check DSGD trước EOD, Chạy EOD MS, Âm KQ mới, Đồng bộ CQG)
  // 3. Backup & Thống kê MS-CQG (20 báo cáo MS, 9 báo cáo CQG, Macro Lot & Macro Value)
  // 4. Cấu hình MS-CQG (Tỷ giá USD MS, giờ mở/đóng phiên MS, đường dẫn thư mục MS & CQG)
  // 5. Hàng đợi & Logs Robot
  const [activeTab, setActiveTab] = useState<
    'CHECK_KLGD' | 'CHECK_EOD_MS_CQG' | 'BACKUP_THONG_KE' | 'CONFIG_MS_CQG' | 'HANG_DOI_LOGS'
  >('CHECK_KLGD');

  // Số lượng background job đang chạy
  const [activeJobsCount, setActiveJobsCount] = useState<number>(0);

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

  // Khởi tạo ngày phiên hiện tại (tự động nhận diện ca đêm T-1 trước 06:30 sáng)
  useEffect(() => {
    setSelectedDate(getInitialTradingSessionDate());
  }, []);

  // Polling số lượng tác vụ MS-CQG đang chạy
  useEffect(() => {
    if (!token) return;
    const MS_CQG_JOB_TYPES = [
      'CHECK_KLGD',
      'CHECK_PRE_EOD',
      'CHECK_CQG_SYNC',
      'SCAN_NEGATIVE_MARGIN',
      'CHECK_EOD_MM',
      'RUN_LOT_MACRO',
      'RUN_VALUE_MACRO',
      'RUN_MACRO',
      'RPA_DOWNLOAD_REPORTS',
      'FILE_AUDIT_MS',
      'FILE_AUDIT_CQG',
      'FILE_AUDIT_ACM',
      'CREATE_GTT_FILE',
      'CHECK_GTT',
      'GENERATE_IMPORT_GTT_FILE',
    ].join(',');

    const pollActiveJobs = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/bot-engine/jobs?jobTypes=${MS_CQG_JOB_TYPES}`, {
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
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                PHÂN HỆ TRUYỀN THỐNG
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                M-System (MXV) ↔ CQG ↔ Straits/ACM
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
              <Activity color="#10b981" className="animate-pulse" size={26} />
              GIÁM SÁT VẬN HÀNH GIAO DỊCH (M-SYSTEM & CQG)
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Bàn điều khiển đối soát khớp lệnh phiên, kiểm soát Pre-EOD, EOD M-System, đồng bộ số dư CQG và sao lưu báo cáo.
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
              borderBottom: activeTab === 'CHECK_KLGD' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'CHECK_KLGD' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CHECK_KLGD' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Activity size={16} color={activeTab === 'CHECK_KLGD' ? '#10b981' : 'var(--text-muted)'} />
            <span>Đối Soát Khớp Lệnh (KLGD)</span>
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                padding: '1px 6px',
                borderRadius: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#10b981',
              }}
            >
              4 BÊN
            </span>
          </button>

          {/* TAB 2: CHECK & CHẠY EOD MS-CQG */}
          <button
            type="button"
            onClick={() => setActiveTab('CHECK_EOD_MS_CQG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'CHECK_EOD_MS_CQG' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'CHECK_EOD_MS_CQG' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CHECK_EOD_MS_CQG' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ShieldCheck size={16} color={activeTab === 'CHECK_EOD_MS_CQG' ? '#10b981' : 'var(--text-muted)'} />
            <span>Check & Chạy EOD (MS – CQG)</span>
          </button>

          {/* TAB 3: BACKUP – THỐNG KÊ MS-CQG */}
          <button
            type="button"
            onClick={() => setActiveTab('BACKUP_THONG_KE')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'BACKUP_THONG_KE' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'BACKUP_THONG_KE' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'BACKUP_THONG_KE' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Database size={16} color={activeTab === 'BACKUP_THONG_KE' ? '#10b981' : 'var(--text-muted)'} />
            <span>Backup – Thống Kê MS – CQG</span>
          </button>

          {/* TAB 4: CẤU HÌNH MS-CQG */}
          <button
            type="button"
            onClick={() => setActiveTab('CONFIG_MS_CQG')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              fontSize: '0.85rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              border: 'none',
              borderBottom: activeTab === 'CONFIG_MS_CQG' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'CONFIG_MS_CQG' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'CONFIG_MS_CQG' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sliders size={16} color={activeTab === 'CONFIG_MS_CQG' ? '#10b981' : 'var(--text-muted)'} />
            <span>Cấu Hình MS & CQG</span>
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
              borderBottom: activeTab === 'HANG_DOI_LOGS' ? '2px solid #10b981' : '2px solid transparent',
              color: activeTab === 'HANG_DOI_LOGS' ? '#10b981' : 'var(--text-secondary)',
              backgroundColor: activeTab === 'HANG_DOI_LOGS' ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Terminal size={16} color={activeTab === 'HANG_DOI_LOGS' ? '#10b981' : 'var(--text-muted)'} />
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
        ) : activeTab === 'CHECK_EOD_MS_CQG' ? (
          /* TAB 2: CHECK & CHẠY EOD MS - CQG */
          <LegacyReconSection
            viewMode="EOD_ONLY"
            token={token}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onOpenGuide={() => setShowGuideModal(true)}
            onStatusChange={setReconStatus}
          />
        ) : activeTab === 'BACKUP_THONG_KE' ? (
          /* TAB 3: BACKUP – THỐNG KÊ (LỌC RIÊNG PHÂN HỆ MS & CQG) */
          <LegacyBackupThongKeSection
            token={token}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            filterScope="MS_CQG"
          />
        ) : activeTab === 'CONFIG_MS_CQG' ? (
          /* TAB 4: CẤU HÌNH MS & CQG (TỶ GIÁ MS, GIỜ PHIÊN MS, 10 ĐƯỜNG DẪN MS/CQG) */
          <TradingManagerConfigSection
            token={token}
            filterScope="MS_CQG"
          />
        ) : activeTab === 'HANG_DOI_LOGS' ? (
          /* TAB 5: HÀNG ĐỢI & LOGS ROBOT MS-CQG */
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
                style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}
                className="animate-pulse"
              />
              <span>Phân hệ: <strong style={{ color: 'var(--text-primary)' }}>M-System & CQG</strong></span>
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
            Server: 10.0.0.26:3001 | Route: /trading-manager/ms-cqg
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
