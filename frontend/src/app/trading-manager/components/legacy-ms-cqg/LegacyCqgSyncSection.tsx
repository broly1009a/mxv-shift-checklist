'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  Loader2,
  Info,
  AlertTriangle,
  Search,
  Filter,
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
  const [filterMode, setFilterMode] = useState<'ALL' | 'BOTH' | 'ONLY_CQG'>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const fetchCqgSyncData = useCallback(
    async (silent: boolean = false) => {
      if (!token) return;
      if (!silent) setLoading(true);
      try {
        const data = await api.tradingOps.getConsoleSummary(selectedDate, undefined, token);
        setCqgSyncData(data?.cqgSync || null);
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
    const toastId = toast.loading('Đang khởi chạy đối chiếu số dư CQG (tải dữ liệu tươi)...');

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

      // Poll until completion (tối đa 3 phút cho quy trình tải tươi qua Playwright + REST API)
      const startTime = Date.now();
      const MAX_WAIT_MS = 180000;
      const POLL_INTERVAL_MS = 3000;
      let completed = false;

      while (Date.now() - startTime < MAX_WAIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

        try {
          const job = await api.checklistHub.getJobDetail(jobId, token);
          if (!job) continue;

          if (job.status === 'PROCESSING') {
            toast.loading('Đang tải dữ liệu tươi từ CQG CAST & M-System...', { id: toastId });
          } else if (job.status === 'COMPLETED') {
            completed = true;
            const passed = job.payload?.result?.passed !== false;
            if (passed) {
              toast.success(job.payload?.result?.summary || 'Đồng bộ số dư CQG hoàn tất: Khớp 100%!', { id: toastId });
            } else {
              toast(job.payload?.result?.summary || 'Đã đối chiếu số dư CQG: Phát hiện chênh lệch!', { id: toastId });
            }
            break;
          } else if (job.status === 'WAITING' || job.payload?.result?.isWaitingFiles) {
            completed = true;
            toast(
              job.payload?.result?.summary ||
                job.payload?.result?.message ||
                'Đang chờ file đối chiếu số dư CQG (QLTKGD.xlsx / Accounts_Balances.xlsx).',
              { id: toastId },
            );
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

  const bothCount = useMemo(() => cqgResult.filter((item) => item.inMS !== false).length, [cqgResult]);
  const onlyCqgCount = useMemo(() => cqgResult.filter((item) => item.inMS === false).length, [cqgResult]);
  const totalCount = cqgResult.length;

  const filteredResult = useMemo(() => {
    return cqgResult.filter((item: any) => {
      const acc = String(item.maTKGD || item.account || '').toLowerCase();
      const kw = searchKeyword.trim().toLowerCase();
      if (kw && !acc.includes(kw)) return false;

      if (filterMode === 'BOTH') return item.inMS !== false;
      if (filterMode === 'ONLY_CQG') return item.inMS === false;
      return true;
    });
  }, [cqgResult, searchKeyword, filterMode]);

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

      {/* FILTER & SEARCH TOOLBAR */}
      {hasExecuted && cqgResult.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 18px',
            backgroundColor: 'var(--bg-card)',
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          {/* Filter Tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={13} />
              Lọc theo MS:
            </span>

            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className="btn"
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                fontWeight: 700,
                borderRadius: '6px',
                border: filterMode === 'ALL' ? '1px solid #38bdf8' : '1px solid var(--border-color)',
                backgroundColor: filterMode === 'ALL' ? 'rgba(56, 189, 248, 0.15)' : 'var(--bg-input)',
                color: filterMode === 'ALL' ? '#38bdf8' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Tất cả</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: filterMode === 'ALL' ? '#38bdf8' : 'rgba(148, 163, 184, 0.2)',
                  color: filterMode === 'ALL' ? '#000' : 'inherit',
                  fontWeight: 800,
                }}
              >
                {totalCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('BOTH')}
              className="btn"
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                fontWeight: 700,
                borderRadius: '6px',
                border: filterMode === 'BOTH' ? '1px solid #f59e0b' : '1px solid var(--border-color)',
                backgroundColor: filterMode === 'BOTH' ? 'rgba(245, 158, 11, 0.15)' : 'var(--bg-input)',
                color: filterMode === 'BOTH' ? '#f59e0b' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Lệch cả 2 bên (Có trên MS)</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: filterMode === 'BOTH' ? '#f59e0b' : 'rgba(245, 158, 11, 0.2)',
                  color: filterMode === 'BOTH' ? '#000' : '#f59e0b',
                  fontWeight: 800,
                }}
              >
                {bothCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('ONLY_CQG')}
              className="btn"
              style={{
                fontSize: '0.74rem',
                padding: '4px 10px',
                fontWeight: 700,
                borderRadius: '6px',
                border: filterMode === 'ONLY_CQG' ? '1px solid #ef4444' : '1px solid var(--border-color)',
                backgroundColor: filterMode === 'ONLY_CQG' ? 'rgba(239, 68, 68, 0.15)' : 'var(--bg-input)',
                color: filterMode === 'ONLY_CQG' ? '#ef4444' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>Chỉ có CQG (Không có trên MS)</span>
              <span
                style={{
                  fontSize: '0.68rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: filterMode === 'ONLY_CQG' ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                  color: filterMode === 'ONLY_CQG' ? '#fff' : '#ef4444',
                  fontWeight: 800,
                }}
              >
                {onlyCqgCount}
              </span>
            </button>
          </div>

          {/* Search box */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Tìm kiếm mã TKGD..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '0.76rem',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'monospace',
              }}
            />
          </div>
        </div>
      )}

      {/* BẢNG SỐ DƯ RỘNG THOÁNG */}
      <div style={{ minHeight: '520px', maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
            ) : cqgSyncData?.status === 'WAITING' || cqgSyncData?.isWaitingFiles ? (
              <tr>
                <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Clock size={26} color="#f59e0b" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#f59e0b' }}>
                      {cqgSyncData?.waitingMessage ||
                        'Đang chờ file QLTKGD.xlsx và Accounts_Balances.xlsx trong thư mục backup ngày.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : ['FAILED', 'CANCELLED', 'ABORTED'].includes(cqgSyncData?.status) ? (
              <tr>
                <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={26} color="#ef4444" />
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#ef4444' }}>
                      {cqgSyncData?.error || 'Tiến trình đối chiếu số dư CQG gặp sự cố.'}
                    </span>
                  </div>
                </td>
              </tr>
            ) : cqgResult.length > 0 ? (
              filteredResult.length > 0 ? (
                filteredResult.map((item: any, idx: number) => {
                  const hasMS = item.inMS !== false;
                  return (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: hasMS ? 'rgba(245, 158, 11, 0.06)' : 'rgba(239, 68, 68, 0.04)',
                        color: hasMS ? '#f59e0b' : '#ef4444',
                        fontFamily: 'monospace',
                        fontSize: '0.86rem',
                      }}
                    >
                      <td style={{ padding: '12px 20px', borderRight: '1px solid var(--border-color)', fontWeight: 800 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{item.maTKGD || item.account || '--'}</span>
                          {!hasMS && (
                            <span
                              style={{
                                fontSize: '0.68rem',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontWeight: 700,
                                fontFamily: 'sans-serif',
                              }}
                            >
                              Không có trên MS
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '12px 20px', borderRight: '1px solid var(--border-color)', textAlign: 'right', fontWeight: 700 }}>
                        {/* Chuẩn C# dòng 663: Nếu không có trên MS thì hiện trắng (empty string), không hiện $0 */}
                        {hasMS ? `${fmt(item.calculatedBalance ?? item.balanceMS ?? 0)}` : ''}
                      </td>
                      <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                        ${fmt(item.cqgBalance ?? item.balanceCQG ?? 0)}{' '}
                        {item.differ !== undefined && item.differ > 0 ? `(Lệch: ${fmt(item.differ)})` : ''}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                    Không có tài khoản nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
                  </td>
                </tr>
              )
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
