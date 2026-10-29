'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export interface LegacyNegativeMarginSectionProps {
  token: string | null;
  selectedDate: string;
}

export default function LegacyNegativeMarginSection({
  token,
  selectedDate,
}: LegacyNegativeMarginSectionProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [marginData, setMarginData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Tính ngày phiên làm việc liền trước T-1 (bỏ qua Thứ Bảy, Chủ Nhật)
  const previousTradingDayFormatted = useMemo(() => {
    if (!selectedDate) return '';
    try {
      const dt = new Date(selectedDate);
      dt.setDate(dt.getDate() - 1);
      if (dt.getDay() === 0) {
        dt.setDate(dt.getDate() - 2);
      } else if (dt.getDay() === 6) {
        dt.setDate(dt.getDate() - 1);
      }
      const d = String(dt.getDate()).padStart(2, '0');
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const y = dt.getFullYear();
      return `${d}/${m}/${y}`;
    } catch {
      return '';
    }
  }, [selectedDate]);

  const fetchMarginData = useCallback(async (silent: boolean = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const data = await api.tradingOps.getConsoleSummary(selectedDate, undefined, token);
      setMarginData(data?.negativeMargin || null);
    } catch {
      // Bỏ qua lỗi kết nối
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchMarginData();
  }, [fetchMarginData]);

  const handleTriggerCheck = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    try {
      await api.tradingOps.triggerRun('SCAN_NEGATIVE_MARGIN', selectedDate, {}, token);
      toast.success(`Đã gửi yêu cầu quét âm ký quỹ phiên T-1 (${previousTradingDayFormatted})!`);
      setTimeout(() => fetchMarginData(true), 1500);
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const hasExecuted = !!(marginData?.executedAt && marginData?.status !== 'IDLE');
  const accounts: string[] = Array.isArray(marginData?.negativeIMRAcc)
    ? marginData.negativeIMRAcc
    : Array.isArray(marginData?.accounts)
    ? marginData.accounts
    : [];

  const filteredAccounts = accounts.filter(acc =>
    acc.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const formatSubCheckTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div
      className="glass-panel"
      style={{
        padding: '0',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              backgroundColor: accounts.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: accounts.length > 0 ? '#ef4444' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldAlert size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Check TKGD Âm KQ Mới
              </h4>
              {previousTradingDayFormatted && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    color: '#3b82f6',
                  }}
                >
                  Phiên chốt sổ T-1: {previousTradingDayFormatted}
                </span>
              )}
            </div>
            {hasExecuted && marginData?.executedAt && (
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Thời gian quét: {formatSubCheckTime(marginData.executedAt)}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {accounts.length > 0 && (
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Tìm mã TKGD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  height: '34px',
                  paddingLeft: '32px',
                  paddingRight: '12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleTriggerCheck}
            disabled={triggering}
            className="btn btn-primary"
            style={{
              fontSize: '0.82rem',
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
            }}
          >
            {triggering ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>{triggering ? 'Đang quét...' : 'Quét âm ký quỹ'}</span>
          </button>
        </div>
      </div>

      {/* Content Table / Status View */}
      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <span>Đang nạp kết quả kiểm tra ký quỹ...</span>
          </div>
        ) : !hasExecuted ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              Chưa chạy kiểm tra tài khoản âm ký quỹ phiên T-1 ({previousTradingDayFormatted || selectedDate})
            </h5>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Bấm nút &quot;Quét âm ký quỹ&quot; phía trên để tự động phân tích dữ liệu ký quỹ sau EOD.
            </p>
          </div>
        ) : marginData?.isWaitingFiles ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#f59e0b' }}>
            <Clock size={32} style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              {marginData?.waitingMessage || 'Đang chờ file dữ liệu đối chiếu ký quỹ...'}
            </h5>
          </div>
        ) : marginData?.status === 'FAILED' ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              Lỗi kiểm tra ký quỹ: {marginData?.error || 'Vui lòng kiểm tra log bot.'}
            </h5>
          </div>
        ) : accounts.length > 0 ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                }}
              >
                Phát hiện {accounts.length} tài khoản âm ký quỹ mới
              </span>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <th style={{ padding: '10px 16px', width: '60px' }}>STT</th>
                    <th style={{ padding: '10px 16px' }}>Mã TKGD</th>
                    <th style={{ padding: '10px 16px' }}>Trạng thái vi phạm</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.88rem', fontWeight: 800, color: '#ef4444', fontFamily: 'monospace' }}>
                        {acc}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: '0.82rem', color: '#ef4444' }}>
                        Âm ký quỹ ban đầu (IMR) sau phiên EOD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <ShieldCheck size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h5 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', margin: '0 0 6px 0' }}>
              An Toàn: Không Có Tài Khoản Âm Ký Quỹ Mới
            </h5>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Tất cả các tài khoản giao dịch đều đáp ứng đầy đủ tỷ lệ ký quỹ an toàn theo quy định.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
