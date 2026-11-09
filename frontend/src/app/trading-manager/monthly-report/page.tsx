'use client';

import React from 'react';
import { Calendar } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import MonthlyReportSection from '../components/monthly-report/MonthlyReportSection';

export default function MonthlyReportStandalonePage() {
  const { token } = useAuth();

  return (
    <ProtectedRoute>
      <div
        style={{
          minHeight: '100%',
          backgroundColor: 'var(--bg-main)',
          padding: '24px 28px',
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
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(139, 92, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#8b5cf6',
              }}
            >
              <Calendar size={20} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                BÁO CÁO THÁNG HOẠT ĐỘNG GIAO DỊCH
              </h1>
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                Thống kê xếp hạng TVKD, cơ cấu mặt hàng và sản phẩm đặc thù (Spread, LME, Options)
              </p>
            </div>
          </div>
        </div>

        {/* MAIN BODY */}
        <MonthlyReportSection token={token} />
      </div>
    </ProtectedRoute>
  );
}
