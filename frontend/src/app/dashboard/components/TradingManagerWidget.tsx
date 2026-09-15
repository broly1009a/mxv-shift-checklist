import React, { useState, useEffect, useCallback } from 'react';
import { Layers, ExternalLink, Play, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Activity, GripVertical } from 'lucide-react';
import Link from 'next/link';
import { useAuth, API_BASE_URL } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface TradingManagerWidgetProps {
  dateStr?: string;
}

export const TradingManagerWidget: React.FC<TradingManagerWidgetProps> = ({ dateStr }) => {
  const { token } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);

  const fetchSummary = useCallback(async () => {
    if (!token) return;
    try {
      const qDate = dateStr || new Date().toISOString().split('T')[0];
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/console-summary?date=${qDate}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token, dateStr]);

  useEffect(() => {
    fetchSummary();
    const timer = setInterval(fetchSummary, 30000);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  const handleQuickRun = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang kích hoạt đối chiếu lại ngay...');
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/reconciliation/trigger-console-run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: dateStr, jobType: 'CHECK_KLGD' }),
      });
      const resJson = await res.json();
      if (res.ok && resJson.success) {
        toast.success('Đã kích hoạt đối chiếu lại!', { id: toastId });
        await fetchSummary();
      } else {
        throw new Error(resJson.message || 'Lỗi kích hoạt');
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setTriggering(false);
    }
  };

  const klgdDiffer = (data?.klgd?.totals?.differ ?? 0) + (data?.klgd?.totals?.differACM ?? 0);
  const isKlgdWaiting = data?.klgd?.isWaitingFiles;
  const isPreEodWaiting = data?.preEod?.isWaitingFiles;
  const preEodDiffer = (data?.preEod?.mismatchedPositionsCount ?? 0);
  const negativeIMR = data?.negativeMargin?.negativeIMRAccCount ?? 0;

  return (
    <div className="glass-panel animate-fade-in" style={{ padding: '24px', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '24px', right: '24px', color: 'var(--text-muted)', cursor: 'grab' }} title="Kéo thả để sắp xếp">
        <GripVertical size={16} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', paddingRight: '28px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <Layers size={18} color="#3b82f6" />
          Bàn Giám Sát GD
        </h3>
        <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', fontWeight: 600, border: '1px solid rgba(59, 130, 246, 0.25)' }}>
          Shadow Run
        </span>
      </div>

      {/* KPI Tóm Tắt 3 Mục Trọng Yếu */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        
        {/* Khớp lệnh */}
        <div style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={11} /> Khớp lệnh trong phiên
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isKlgdWaiting ? '#fbbf24' : klgdDiffer === 0 ? '#34d399' : '#fb7185', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isKlgdWaiting ? (
              'Chờ file...'
            ) : klgdDiffer === 0 ? (
              <>
                <CheckCircle2 size={13} /> Khớp 100%
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> Lệch {klgdDiffer} lot
              </>
            )}
          </div>
        </div>

        {/* Chốt Pre-EOD */}
        <div style={{ backgroundColor: 'var(--bg-input, rgba(255,255,255,0.03))', borderRadius: '8px', padding: '10px 12px', border: '1px solid var(--border-color, rgba(255,255,255,0.08))' }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #94a3b8)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={11} /> Chốt Pre-EOD 3 bên
          </div>
          <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isPreEodWaiting ? '#fbbf24' : preEodDiffer === 0 ? '#34d399' : '#fb7185', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isPreEodWaiting ? (
              'Chờ file...'
            ) : preEodDiffer === 0 ? (
              <>
                <CheckCircle2 size={13} /> Vị thế net khớp
              </>
            ) : (
              <>
                <AlertTriangle size={13} /> Lệch {preEodDiffer} TK
              </>
            )}
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Link
          href="/trading-manager"
          className="btn btn-primary"
          style={{ flex: 1, padding: '8px 12px', fontSize: '0.8rem', gap: '6px', justifyContent: 'center', textDecoration: 'none' }}
        >
          <ExternalLink size={13} />
          Mở Console Đối Soát
        </Link>

        <button
          type="button"
          onClick={handleQuickRun}
          disabled={triggering || loading}
          className="btn btn-secondary"
          style={{ padding: '8px 12px', fontSize: '0.8rem', gap: '6px' }}
          title="Chạy lại đối chiếu ngay lập tức"
        >
          <Play size={13} className={triggering ? 'animate-spin' : ''} />
          {triggering ? '...' : 'Chạy Ngay'}
        </button>
      </div>

    </div>
  );
};
