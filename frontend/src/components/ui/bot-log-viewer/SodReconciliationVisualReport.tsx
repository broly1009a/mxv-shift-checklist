import React, { useState, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Search, Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ParsedBotData } from './types';
import { BotStatusStateBanner, shouldShowBotStatusBanner } from './BotStatusStateBanner';

interface SodDiscrepancyItem {
  maTKGD: string;
  calculatedBalance: number;
  cqgBalance: number;
  differ: number;
}

interface SodReconciliationVisualReportProps {
  parsedData: ParsedBotData;
  activeStatus: string;
}

const ITEMS_PER_PAGE = 50;

export const SodReconciliationVisualReport: React.FC<SodReconciliationVisualReportProps> = ({ parsedData, activeStatus }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'differ' | 'maTKGD'>('differ');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

  const allDiscrepancies = useMemo<SodDiscrepancyItem[]>(() => {
    const raw = parsedData.jsonResult;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw.sodDiscrepancies || raw.cqgDiscrepancies || raw.discrepancies || [];
  }, [parsedData]);

  const isPassed = allDiscrepancies.length === 0;
  const isWaitingFiles = parsedData.jsonResult?.isWaitingFiles;

  const filteredAndSorted = useMemo(() => {
    let list = [...allDiscrepancies];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => (item.maTKGD || '').toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortField === 'differ') {
        return sortDir === 'desc' ? b.differ - a.differ : a.differ - b.differ;
      }
      return sortDir === 'desc'
        ? (b.maTKGD || '').localeCompare(a.maTKGD || '')
        : (a.maTKGD || '').localeCompare(b.maTKGD || '');
    });
    return list;
  }, [allDiscrepancies, searchQuery, sortField, sortDir]);

  const totalPages = Math.ceil(filteredAndSorted.length / ITEMS_PER_PAGE);
  const pageItems = filteredAndSorted.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalDiffer = allDiscrepancies.reduce((s, x) => s + (x.differ || 0), 0);
  const maxDiffer = allDiscrepancies.length > 0
    ? Math.max(...allDiscrepancies.map(x => x.differ || 0))
    : 0;

  const handleSort = (field: 'differ' | 'maTKGD') => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortField(field); setSortDir('desc'); }
    setCurrentPage(1);
  };

  const handleCopy = () => {
    const content = 'Mã TKGD\tSố dư MS ($)\tSố dư CQG ($)\tChênh lệch ($)\n' +
      filteredAndSorted.map(r =>
        `${r.maTKGD}\t${r.calculatedBalance?.toFixed(2)}\t${r.cqgBalance?.toFixed(2)}\t${r.differ?.toFixed(2)}`
      ).join('\n');
    navigator.clipboard.writeText(content);
    toast.success('Đã sao chép danh sách SOD lệch!');
  };

  const fmtUSD = (v: number) =>
    (v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (shouldShowBotStatusBanner(activeStatus, !!parsedData.jsonResult)) {
    return (
      <BotStatusStateBanner
        status={activeStatus}
        hasJsonResult={!!parsedData.jsonResult}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
        {isWaitingFiles ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24' }}>
            <AlertCircle size={18} /> Trạng Thái: Đang chờ tệp đối chiếu
          </span>
        ) : isPassed ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399' }}>
            <CheckCircle2 size={18} /> Kết quả SOD: Số dư khớp hoàn toàn
          </span>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f87171' }}>
            <AlertCircle size={18} /> Kết quả SOD: Phát hiện {allDiscrepancies.length} tài khoản lệch
          </span>
        )}
      </div>

      {isWaitingFiles && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(251, 191, 36, 0.08)',
          border: '1px solid rgba(251, 191, 36, 0.25)',
          borderRadius: '8px',
          color: '#fbbf24',
          fontSize: '0.82rem',
          fontWeight: 600,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
            <AlertCircle size={16} /> Đang chờ dữ liệu đầu vào:
          </div>
          <div style={{ fontWeight: 500, fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
            {parsedData.jsonResult?.message || 'Thư mục backup đang chờ cập nhật đầy đủ file đối chiếu.'}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: isWaitingFiles ? '4px solid #fbbf24' : isPassed ? '4px solid #10b981' : '4px solid #ef4444' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600 }}>SỐ TK LỆCH SỐ DƯ (&gt; $100)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: isWaitingFiles ? '#fbbf24' : isPassed ? '#34d399' : '#f87171' }}>{isWaitingFiles ? 'Chờ file...' : `${allDiscrepancies.length} tài khoản`}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>M-System vs CQG CAST (SOD)</div>
        </div>
        {!isPassed && (
          <>
            <div style={{ padding: '14px 16px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '0.68rem', color: '#f87171', marginBottom: '4px', fontWeight: 600 }}>CHÊNH LỆCH LỚN NHẤT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f87171' }}>${fmtUSD(maxDiffer)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tài khoản lệch nhiều nhất</div>
            </div>
            <div style={{ padding: '14px 16px', background: 'rgba(251, 191, 36, 0.04)', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
              <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginBottom: '4px', fontWeight: 600 }}>TỔNG CHÊNH LỆCH</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fbbf24' }}>${fmtUSD(totalDiffer)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tổng cộng tất cả TK lệch</div>
            </div>
          </>
        )}
      </div>

      {!isPassed && (
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Tìm mã TKGD..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', paddingLeft: 28, paddingRight: 8, height: 30, background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 6, color: 'var(--text-primary)', fontSize: '0.75rem', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{filteredAndSorted.length} tài khoản lệch</span>
            <button onClick={handleCopy} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.72rem' }}>
              <Copy size={12} /> Sao chép
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '9px 12px', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', fontWeight: 600 }} onClick={() => handleSort('maTKGD')}>
                    Mã TKGD {sortField === 'maTKGD' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>Số dư MS ($)</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 600 }}>Số dư CQG ($)</th>
                  <th style={{ padding: '9px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', fontWeight: 600 }} onClick={() => handleSort('differ')}>
                    Chênh lệch ($) {sortField === 'differ' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Không tìm thấy tài khoản.</td></tr>
                ) : (
                  pageItems.map((item, idx) => {
                    const isLarge = item.differ >= 1000;
                    return (
                      <tr key={`${item.maTKGD}-${idx}`} style={{ borderBottom: '1px solid var(--border-color)', background: isLarge ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.77rem' }}>{item.maTKGD}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtUSD(item.calculatedBalance)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtUSD(item.cqgBalance)}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: isLarge ? '#f87171' : '#fbbf24' }}>{fmtUSD(item.differ)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-input)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>Trang {currentPage}/{totalPages}</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ padding: '3px 10px', borderRadius: 5, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '0.72rem' }}>Trước</button>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ padding: '3px 10px', borderRadius: 5, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: '0.72rem' }}>Tiếp</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isPassed && (
        <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
          <CheckCircle2 size={28} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
          <div>Tất cả số dư đầu ngày (SOD) khớp hoàn toàn giữa M-System và CQG CAST.</div>
        </div>
      )}
    </div>
  );
};

