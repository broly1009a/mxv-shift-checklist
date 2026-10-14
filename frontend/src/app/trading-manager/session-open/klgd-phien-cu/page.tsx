'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import LegacyPreEodDiffSection from '../../components/legacy-ms-cqg/LegacyPreEodDiffSection';
import TradingManagerLogModal from '../../components/shared/TradingManagerLogModal';

export default function CheckKlgdPhienCuPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());
  const [preEodData, setPreEodData] = useState<any>(null);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [logModalOpen, setLogModalOpen] = useState<boolean>(false);

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

  const fetchPreEodData = async () => {
    if (!token) return;
    try {
      const data = await api.tradingOps.getConsoleSummary(selectedDate, undefined, token);
      setPreEodData(data?.preEod || null);
    } catch {
      // Bỏ qua lỗi kết nối
    }
  };

  useEffect(() => {
    fetchPreEodData();
  }, [token, selectedDate]);

  const handleTriggerRun = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    try {
      await api.tradingOps.triggerRun('CHECK_PRE_EOD', selectedDate, {}, token);
      toast.success('Đã gửi yêu cầu đối chiếu giao dịch trước EOD!');
      setTimeout(() => fetchPreEodData(), 1500);
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

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
              <Layers color="#3b82f6" size={24} />
              Đối chiếu giao dịch trước EOD
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

        {/* CHỈ HIỂN THỊ DUY NHẤT CHỨC NĂNG NÀY */}
        <LegacyPreEodDiffSection
          preEodData={preEodData}
          onTriggerCheck={handleTriggerRun}
          triggering={triggering}
          onOpenLogs={() => setLogModalOpen(true)}
        />

        <TradingManagerLogModal
          isOpen={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          jobId={preEodData?.jobId}
          status={preEodData?.status || 'COMPLETED'}
          logs={preEodData?.logs || []}
          onRetry={() => {
            setLogModalOpen(false);
            handleTriggerRun();
          }}
          isRetrying={triggering}
        />
      </div>
    </ProtectedRoute>
  );
}
