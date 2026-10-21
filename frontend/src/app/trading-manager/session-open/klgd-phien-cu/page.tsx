'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Maximize2,
  Minimize2,
  Layers,
  ShieldCheck,
  Activity,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/services/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import toast from 'react-hot-toast';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';
import DsgdBeforeEodSection from '../../components/shared/DsgdBeforeEodSection';
import TradingManagerLogModal from '../../components/shared/TradingManagerLogModal';

export default function CheckKlgdPhienCuPage() {
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => getInitialTradingSessionDate());
  const [dsgdBeforeEodData, setDsgdBeforeEodData] = useState<any>(null);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [logModalOpen, setLogModalOpen] = useState<boolean>(false);
  const [scopeTab, setScopeTab] = useState<'ALL' | 'MS_CQG' | 'CCP_CE'>('CCP_CE');

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

  const fetchDsgdBeforeEodData = async () => {
    if (!token) return;
    try {
      const data = await api.tradingOps.getConsoleSummary(selectedDate, undefined, token);
      setDsgdBeforeEodData(data?.dsgdBeforeEod || null);
    } catch {
      // Bỏ qua lỗi kết nối
    }
  };

  useEffect(() => {
    fetchDsgdBeforeEodData();
  }, [token, selectedDate]);

  const handleTriggerRun = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    try {
      await api.tradingOps.triggerRun('CHECK_DSGD_BEFORE_EOD', selectedDate, {}, token);
      toast.success('Đã gửi yêu cầu đối chiếu giao dịch trước EOD (MS – CQG)!');
      setTimeout(() => fetchDsgdBeforeEodData(), 1500);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                { id: 'ALL', label: 'Tất cả (MS & CCP)' },
                { id: 'MS_CQG', label: 'Phân hệ MS – CQG' },
                { id: 'CCP_CE', label: 'Phân hệ CoreCCP – CoreEX' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScopeTab(tab.id as any)}
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
              style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title={isFullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            {/* Chuyển về Nghiệp vụ đầu phiên */}
            <Link
              href="/trading-manager/session-open"
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '8px 14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={15} />
              <span>Nghiệp vụ đầu phiên</span>
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* KHUNG ĐỐI CHIẾU GIAO DỊCH TRƯỚC EOD (CỦA CẢ MS VÀ CCP)                    */}
        {/* ========================================================================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Phân hệ 1: MS - CQG */}
          {(scopeTab === 'ALL' || scopeTab === 'MS_CQG') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scopeTab === 'ALL' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      letterSpacing: '0.04em',
                    }}
                  >
                    PHÂN HỆ 1: M-SYSTEM ↔ CQG & ACM (DSGD TRƯỚC EOD)
                  </span>
                </div>
              )}
              <DsgdBeforeEodSection
                system="MS"
                token={token}
                selectedDate={selectedDate}
              />
            </div>
          )}

          {/* Phân hệ 2: CoreCCP - CoreEX */}
          {(scopeTab === 'ALL' || scopeTab === 'CCP_CE') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {scopeTab === 'ALL' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(59, 130, 246, 0.15)',
                      color: '#3b82f6',
                      letterSpacing: '0.04em',
                    }}
                  >
                    PHÂN HỆ 2: CORECCP (DSGD TRƯỚC EOD)
                  </span>
                </div>
              )}
              <DsgdBeforeEodSection
                system="CCP"
                token={token}
                selectedDate={selectedDate}
              />
            </div>
          )}
        </div>

        <TradingManagerLogModal
          isOpen={logModalOpen}
          onClose={() => setLogModalOpen(false)}
          jobId={dsgdBeforeEodData?.jobId}
          status={dsgdBeforeEodData?.status || 'COMPLETED'}
          logs={dsgdBeforeEodData?.logs || []}
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
