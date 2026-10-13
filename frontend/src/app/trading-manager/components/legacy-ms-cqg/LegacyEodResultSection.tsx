'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/context/AuthContext';

export interface LegacyEodResultSectionProps {
  token: string | null;
  selectedDate: string;
}

export default function LegacyEodResultSection({
  token,
  selectedDate,
}: LegacyEodResultSectionProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [eodData, setEodData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchEodData = useCallback(async (silent: boolean = false) => {
    if (!token) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const extractedEod = data?.eod || (data?.preEod?.jobType === 'CHECK_EOD_MM' ? data?.preEod : null);
        setEodData(extractedEod);
      }
    } catch {
      // Bỏ qua lỗi kết nối
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, selectedDate]);

  useEffect(() => {
    fetchEodData();
  }, [fetchEodData]);

  const handleTriggerEod = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          jobType: 'CHECK_EOD_MM',
          date: selectedDate,
        }),
      });
      if (res.ok) {
        toast.success('Đã gửi yêu cầu đối chiếu kết quả chạy EOD!');
        setTimeout(() => fetchEodData(true), 1500);
      } else {
        toast.error('Không thể kích hoạt đối chiếu EOD');
      }
    } catch (err: any) {
      toast.error(`Lỗi: ${err.message}`);
    } finally {
      setTriggering(false);
    }
  };

  const hasExecuted = !!(eodData?.executedAt && eodData?.status !== 'IDLE');
  const mismatchedEOD: any[] = Array.isArray(eodData?.mismatchedEOD) ? eodData.mismatchedEOD : [];

  const filteredMismatches = mismatchedEOD.filter(p => {
    const q = searchQuery.trim().toLowerCase();
    return (
      (p?.tkgd || '').toLowerCase().includes(q) ||
      (p?.qltkgd || '').toLowerCase().includes(q) ||
      (p?.reason || '').toLowerCase().includes(q)
    );
  });

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
              backgroundColor: mismatchedEOD.length > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
              color: mismatchedEOD.length > 0 ? '#ef4444' : '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Check Kết Quả EOD
            </h4>
            {hasExecuted && eodData?.executedAt && (
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                Thời gian đối chiếu: {formatSubCheckTime(eodData.executedAt)}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {mismatchedEOD.length > 0 && (
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
            onClick={handleTriggerEod}
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
            <span>{triggering ? 'Đang check...' : 'Check EOD'}</span>
          </button>
        </div>
      </div>

      {/* Content Table / Status View */}
      <div style={{ padding: '20px' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <span>Đang nạp dữ liệu kết quả đối chiếu EOD...</span>
          </div>
        ) : !hasExecuted ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <Clock size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>
              Chưa chạy đối chiếu EOD phiên này
            </h5>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
              Bấm nút &quot;Check EOD&quot; phía trên để đối soát số dư và kết quả đóng sổ EOD giữa M-System và CCP.
            </p>
          </div>
        ) : eodData?.isWaitingFiles ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#f59e0b' }}>
            <Clock size={32} style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              {eodData?.waitingMessage || 'Đang chờ file dữ liệu đối chiếu EOD...'}
            </h5>
          </div>
        ) : eodData?.status === 'FAILED' ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#ef4444' }}>
            <AlertTriangle size={32} style={{ margin: '0 auto 10px' }} />
            <h5 style={{ fontSize: '0.92rem', fontWeight: 700, margin: '0 0 4px 0' }}>
              Lỗi đối chiếu EOD: {eodData?.error || 'Vui lòng kiểm tra log bot.'}
            </h5>
          </div>
        ) : mismatchedEOD.length > 0 ? (
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
                Phát hiện {mismatchedEOD.length} tài khoản lệch kết quả EOD
              </span>
            </div>

            <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-input)' }}>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.82rem', fontWeight: 700 }}>
                    <th style={{ padding: '10px 16px', width: '150px' }}>TKGD</th>
                    <th style={{ padding: '10px 16px', width: '180px' }}>QLTKGD</th>
                    <th style={{ padding: '10px 16px' }}>Kết quả / Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMismatches.map((p, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(239, 68, 68, 0.04)',
                        color: '#ef4444',
                      }}
                    >
                      <td style={{ padding: '10px 16px', fontWeight: 800, fontFamily: 'monospace' }}>{p?.tkgd || '--'}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.82rem', fontFamily: 'monospace' }}>{p?.qltkgd || '--'}</td>
                      <td style={{ padding: '10px 16px', fontSize: '0.82rem', fontWeight: 700 }}>{p?.reason || 'Lệch số dư'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <CheckCircle size={40} color="#10b981" style={{ margin: '0 auto 12px' }} />
            <h5 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#10b981', margin: '0 0 6px 0' }}>
              Tất Cả Số Dư Khớp Hoàn Toàn Với Kết Quả Chạy EOD (MS & CCP)
            </h5>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Dữ liệu đóng sổ EOD giữa M-System và CCP hoàn toàn đồng nhất, không phát hiện chênh lệch.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
