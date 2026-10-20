'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  Clock,
  Loader2,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '@/services/api';

export interface LegacyCqgSyncSectionProps {
  token: string | null;
  selectedDate: string;
}

export default function LegacyCqgSyncSection({
  token,
  selectedDate,
}: LegacyCqgSyncSectionProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [cqgSyncData, setCqgSyncData] = useState<any>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const fetchCqgSyncData = useCallback(
    async (silent: boolean = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.tradingOps.getConsoleSummary(selectedDate, undefined, token);
        setCqgSyncData(data?.cqgSync || (data as any)?.dsgdBeforeEod || null);
      } catch (err: any) {
        console.error('Lỗi nạp dữ liệu đồng bộ CQG:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [token, selectedDate],
  );

  useEffect(() => {
    fetchCqgSyncData();
  }, [fetchCqgSyncData]);

  const handleTriggerCheck = async () => {
    if (!token || triggering) return;
    setTriggering(true);
    const toastId = toast.loading('Đang khởi chạy đối chiếu số dư CQG...');

    try {
      const result = await api.tradingOps.triggerRun(
        'CHECK_CQG_SYNC',
        selectedDate,
        { sectionId: 'balance' },
        token,
      );

      const jobId = result.jobId;

      if (!jobId) {
        toast.success(result.message || 'Đã kiểm tra số dư CQG hoàn tất!', { id: toastId });
        await fetchCqgSyncData(true);
        setTriggering(false);
        return;
      }

      // Poll until completion
      const startTime = Date.now();
      const MAX_WAIT_MS = 120000;
      const POLL_INTERVAL_MS = 3000;
      let completed = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const job = await api.checklistHub.getJobDetail(jobId, token);
          if (!job) continue;

          if (job.status === 'COMPLETED') {
            completed = true;
            toast.success('Đồng bộ số dư CQG hoàn tất!', { id: toastId });
            break;
          } else if (['FAILED', 'CANCELLED', 'ABORTED'].includes(job.status)) {
            completed = true;
            toast.error(`Tiến trình đồng bộ CQG dừng: ${job.error || job.status}`, { id: toastId });
            break;
          }
        } catch {}
      }

      if (!completed) {
        toast.dismiss(toastId);
        toast.error('Hết thời gian chờ kết quả đồng bộ CQG.');
      }

      await fetchCqgSyncData(true);
    } catch (err: any) {
      toast.error(`Lỗi kiểm tra số dư: ${err.message}`, { id: toastId });
    } finally {
      setTriggering(false);
    }
  };

  const formatSubCheckTime = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const vn = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
      const hh = String(vn.getHours()).padStart(2, '0');
      const mm = String(vn.getMinutes()).padStart(2, '0');
      const ss = String(vn.getSeconds()).padStart(2, '0');
      const dd = String(vn.getDate()).padStart(2, '0');
      const mo = String(vn.getMonth() + 1).padStart(2, '0');
      return `${hh}:${mm}:${ss} ${dd}/${mo}`;
    } catch {
      return '';
    }
  };

  const fmt = (n?: number | null) => {
    if (n === undefined || n === null || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US');
  };

  const hasExecuted = !!(cqgSyncData?.executedAt && cqgSyncData?.status !== 'IDLE');
  const cqgResult: any[] = cqgSyncData?.cqgResult || [];

  return (
    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          backgroundColor: 'var(--bg-input)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h5 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Kết quả đồng bộ số dư CQG
          </h5>
          {hasExecuted && cqgSyncData?.executedAt && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ({formatSubCheckTime(cqgSyncData.executedAt)})
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            className="btn btn-secondary"
            title="Xem chú thích nghiệp vụ, thời điểm T / T-1 và các file cần thiết"
            style={{
              fontSize: '0.75rem',
              padding: '6px 12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              border: showGuide ? '1px solid #38bdf8' : undefined,
              backgroundColor: showGuide ? 'rgba(56, 189, 248, 0.12)' : undefined,
              color: showGuide ? '#38bdf8' : undefined,
            }}
          >
            <Info size={13} color={showGuide ? '#38bdf8' : 'currentColor'} />
            <span>{showGuide ? 'Ẩn Chú Thích' : 'Chú Thích (i)'}</span>
          </button>
          <button
            type="button"
            onClick={handleTriggerCheck}
            disabled={triggering || loading}
            className="btn btn-secondary"
            style={{
              fontSize: '0.75rem',
              padding: '6px 14px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: triggering || loading ? 'not-allowed' : 'pointer',
              opacity: triggering || loading ? 0.6 : 1,
            }}
          >
            {triggering ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Checking...</span>
              </>
            ) : (
              'Check'
            )}
          </button>
        </div>
      </div>

      {/* GUIDANCE PANEL */}
      {showGuide && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(56, 189, 248, 0.05)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontWeight: 800, fontSize: '0.82rem' }}>
            <Info size={15} />
            <span>CHÚ THÍCH NGUYÊN LÝ HOẠT ĐỘNG & NGHIỆP VỤ (CHECK_CQG_SYNC)</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '10px',
              fontSize: '0.76rem',
            }}
          >
            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#38bdf8', marginBottom: '3px' }}>1. Nghiệp vụ cốt lõi</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Đối chiếu số dư tài khoản giao dịch giữa M-System (Balance MS) và CQG (Balance CQG) để phát hiện sai lệch số dư.
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#f59e0b', marginBottom: '3px' }}>2. Thời điểm phiên: T</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Chạy trong phiên hoặc cuối phiên ngày <b>T</b> sau khi kết xuất dữ liệu quản lý tài khoản và số dư CQG.
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#10b981', marginBottom: '3px' }}>3. Tệp tin đầu vào</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                • <code>QLTKGD.xlsx</code> (trong Backup MS)<br />
                • <code>Accounts_Balances.xlsx</code> (trong Backup CQG)
              </div>
            </div>

            <div style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 800, color: '#a855f7', marginBottom: '3px' }}>4. Tiêu chuẩn Pass</div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Toàn bộ tài khoản có <code>|Balance MS - Balance CQG| = 0</code> (Không có tài khoản nào lệch số dư).
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ height: '160px', minHeight: '140px', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: 'rgba(255,255,255,0.02)', zIndex: 5 }}>
            <tr
              style={{
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: 700,
                borderBottom: '1px solid var(--border-color)',
              }}
            >
              <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)' }}>TKGD</th>
              <th style={{ width: '33%', padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right' }}>
                Balance MS
              </th>
              <th style={{ width: '34%', padding: '10px 16px', textAlign: 'right' }}>Balance CQG</th>
            </tr>
          </thead>
          <tbody>
            {!hasExecuted ? (
              <tr>
                <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Clock size={24} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Chưa chạy đồng bộ số dư CQG phiên này. Bấm “Check” để kiểm tra.
                    </span>
                  </div>
                </td>
              </tr>
            ) : cqgResult.length > 0 ? (
              cqgResult.map((item: any, idx: number) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    color: '#ef4444',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  }}
                >
                  <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>
                    {item.maTKGD || item.account || '--'}
                  </td>
                  <td style={{ padding: '10px 16px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                    ${fmt(item.calculatedBalance ?? item.balanceMS ?? 0)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 700 }}>
                    ${fmt(item.cqgBalance ?? item.balanceCQG ?? 0)}{' '}
                    {item.differ !== undefined && item.differ > 0 ? `(Lệch: $${fmt(item.differ)})` : ''}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle size={28} color="#10b981" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>
                      Số dư tài khoản đồng bộ khớp hoàn toàn giữa MS và CQG
                    </span>
                    {cqgSyncData?.executedAt && (
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Kiểm tra lúc: {formatSubCheckTime(cqgSyncData.executedAt)}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
