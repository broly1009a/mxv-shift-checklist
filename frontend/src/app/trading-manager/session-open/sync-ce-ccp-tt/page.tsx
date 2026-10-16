'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Calendar,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  Layers,
  Sparkles,
  Server,
  Database,
  ArrowLeftRight,
} from 'lucide-react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { getInitialTradingSessionDate } from '../../utils/tradingDateUtils';

export default function CheckSyncCeCcpTtPage() {
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
                  backgroundColor: 'rgba(14, 165, 233, 0.15)',
                  color: '#0ea5e9',
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
              <RefreshCw color="#0ea5e9" size={24} />
              Kiểm tra đồng bộ CE/CCP/TT
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

            {/* Back to Session Open */}
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

        {/* GIAO DIỆN CHUYÊN BIỆT: THÔNG BÁO TIẾN TRÌNH UPDATE SAU VÀ MÔ HÌNH ĐỒNG BỘ */}
        <div
          className="glass-panel"
          style={{
            padding: '36px 32px',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '24px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(14, 165, 233, 0.12)',
              color: '#0ea5e9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={32} />
          </div>

          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '20px', backgroundColor: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', fontSize: '0.78rem', fontWeight: 800, marginBottom: '10px' }}>
              <Sparkles size={14} />
              <span>ĐANG CẬP NHẬT THEO LỘ TRÌNH (UPDATE SAU)</span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px 0' }}>
              Chức Năng: Check Đồng Bộ CE / CCP / TT
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
              Chức năng đồng bộ dữ liệu giao dịch và vị thế tự động 3 chiều giữa <strong>Sàn CoreEX (CE)</strong>, <strong>Bù trừ CoreCCP (CCP)</strong> và <strong>Dữ liệu Thị trường (TT)</strong> đang được hoàn thiện các giao thức API và sẽ sớm khả dụng trong phiên bản cập nhật tiếp theo.
            </p>
          </div>

          {/* Sơ đồ cấu trúc 3 chiều đang thiết kế */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              width: '100%',
              maxWidth: '750px',
              marginTop: '12px',
            }}
          >
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <Server size={24} color="#3b82f6" style={{ margin: '0 auto 8px' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                CoreEX (CE)
              </strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Hệ thống khớp lệnh sàn
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftRight size={28} color="#0ea5e9" className="animate-pulse" />
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <Database size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                CoreCCP (CCP)
              </strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Hệ thống bù trừ VNCLEAR
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftRight size={28} color="#0ea5e9" className="animate-pulse" />
            </div>

            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                textAlign: 'center',
              }}
            >
              <Layers size={24} color="#f59e0b" style={{ margin: '0 auto 8px' }} />
              <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)', display: 'block' }}>
                Thị Trường (TT)
              </strong>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                CQG / ACM / Broker quốc tế
              </span>
            </div>
          </div>

          <Link
            href="/trading-manager/session-open"
            className="btn btn-secondary"
            style={{ fontSize: '0.85rem', padding: '10px 22px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
          >
            <ArrowLeft size={16} />
            <span>Quay lại Nghiệp vụ đầu phiên</span>
          </Link>
        </div>
      </div>
    </ProtectedRoute>
  );
}
